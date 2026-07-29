// Vercel 서버리스 함수 — Anthropic API 키를 서버에서만 보관하고
// 클라이언트는 이 엔드포인트(/api/analyze)만 호출합니다.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST만 지원합니다' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다' });
    return;
  }

  try {
    const { image, mediaType } = req.body || {};
    if (!image) {
      res.status(400).json({ error: 'image(base64)가 필요합니다' });
      return;
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image } },
            { type: 'text', text: '이 옷 사진을 분석해서 JSON으로만 답해줘. {"name":"옷 이름","tags":[{"text":"태그","type":"color|style|size"}],"style":"전체 스타일 설명 한 줄"}' }
          ]
        }]
      })
    });

    const data = await anthropicRes.json();
    if (!anthropicRes.ok) {
      res.status(anthropicRes.status).json({ error: (data && data.error && data.error.message) || 'Anthropic API 오류' });
      return;
    }
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || '서버 오류' });
  }
};
