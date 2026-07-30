// AI 스타일 상담 챗봇 — Anthropic API 프록시
// wardrobeItems의 실제 이미지를 Claude에게 전달해서 옷장 기반 코디 상담
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST만 지원합니다' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다' });
    return;
  }

  const { message, history = [], wardrobeItems = [] } = req.body || {};
  if (!message || !message.trim()) {
    res.status(400).json({ error: 'message가 필요합니다' });
    return;
  }

  // 최대 6개 아이템 (최근 등록 순, 이미 클라이언트에서 최신순 정렬 가정)
  const items = wardrobeItems.slice(0, 6);

  // 옷장 컨텍스트 content 블록 (이미지 + 텍스트 라벨 교차)
  const wardrobeContent = [];
  for (const item of items) {
    if (item.imageData) {
      const match = item.imageData.match(/^data:([^;]+);base64,(.+)$/s);
      if (match) {
        wardrobeContent.push({
          type: 'image',
          source: { type: 'base64', media_type: match[1], data: match[2] }
        });
      }
    }
    wardrobeContent.push({
      type: 'text',
      text: `[아이템: ${item.name}] 카테고리:${item.category||'-'} 색상:${item.color||'-'} TPO:${item.tpo||'-'} 스타일:${item.style||'-'} 계절:${item.season||'-'} 소재:${item.material||'-'} 참고시세:${item.referencePrice||'-'}`
    });
  }

  const systemPrompt = `당신은 사용자의 실제 옷장 사진을 보고 스타일을 상담해주는 AI 어시스턴트입니다.
사용자 옷장 아이템 ${items.length}개가 이미지와 함께 제공됩니다.

반드시 지켜야 할 규칙:
1. 제공된 실제 이미지를 직접 보고 색상 조화·핏 밸런스까지 고려해서 답하세요. 텍스트 라벨만으로 판단하지 마세요.
2. 답변에는 반드시 옷장에 등록된 실제 아이템 이름을 최소 1개 이상 구체적으로 언급하세요. 옷장 데이터 없이도 나올 법한 일반론적 조언은 하지 마세요.
3. 옷장에 없는 아이템·색상·종류는 절대 지어내지 마세요. 해당 상황에 맞는 아이템이 없으면 "지금 옷장에 그 상황에 맞는 아이템이 없어서 정확한 추천이 어렵습니다"라고 솔직히 말하세요.
4. 소재·참고시세는 AI 추정치이므로 확정적 사실처럼 말하지 마세요. 브랜드는 정보가 없으므로 절대 언급하지 마세요.
5. 패션·코디·옷장 관련 질문에만 답하고, 그 외 주제(건강, 감정 상담, 일반 지식 등)는 "저는 스타일 상담만 도와드릴 수 있어요. 코디나 옷 관련 질문이 있으시면 편하게 물어보세요!"라고 안내하세요.
6. 답변은 간결하게 3~5문장 이내로, 핵심만 말하세요.`;

  // 대화 메시지 구성 — 첫 번째 유저 메시지에만 옷장 이미지 포함
  const messages = [];

  if (history.length === 0) {
    // 첫 턴
    messages.push({
      role: 'user',
      content: wardrobeContent.length > 0
        ? [...wardrobeContent, { type: 'text', text: message.trim() }]
        : message.trim()
    });
  } else {
    // 이후 턴: history 재구성 (첫 user 메시지에만 이미지 삽입)
    for (let i = 0; i < history.length; i++) {
      const h = history[i];
      if (i === 0 && h.role === 'user' && wardrobeContent.length > 0) {
        messages.push({
          role: 'user',
          content: [...wardrobeContent, { type: 'text', text: h.content }]
        });
      } else {
        messages.push({ role: h.role, content: h.content });
      }
    }
    messages.push({ role: 'user', content: message.trim() });
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: systemPrompt,
        messages
      })
    });

    const data = await anthropicRes.json();
    if (!anthropicRes.ok) {
      res.status(anthropicRes.status).json({ error: data.error?.message || 'Anthropic API 오류' });
      return;
    }

    const responseText = data.content[0].text;

    // 환각 방지 경량 체크: 옷장 속성(이름/색상/카테고리) 중 하나라도 언급됐는지
    const attributes = wardrobeItems.flatMap(it => [it.name, it.color, it.category]).filter(Boolean);
    const mentionsWardrobe = attributes.some(attr => responseText.includes(attr));
    const needsWarning = wardrobeItems.length > 0 && !mentionsWardrobe;

    res.status(200).json({ text: responseText, needsWarning });
  } catch (err) {
    res.status(500).json({ error: err.message || '서버 오류' });
  }
};
