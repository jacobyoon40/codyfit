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
            { type: 'text', text: '이 옷 사진을 분석해서 JSON으로만 답해줘. 다른 설명 없이 JSON만. {"name":"옷 이름 (간결하게)","category":"상의|하의|아우터|원피스|신발|가방|액세서리 중 하나","color":"주요 색상 (예: 네이비, 베이지, 블랙)","tpo":"어울리는 상황 (예: 데일리, 출근룩, 모임/외출, 운동, 집콕)","material":"소재 추정 (예: 면, 데님, 니트, 가죽)","style":"스타일 한 단어 (예: 캐주얼, 미니멀, 스트릿)","season":"어울리는 계절 (예: 봄/가을, 사계절, 여름)","priceRange":"신품 예상 가격대 (예: 3~5만원)","tags":[{"text":"태그","type":"color|style|size"}]}' }
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
