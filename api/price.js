// Vercel 서버리스 함수 — Naver 쇼핑 검색 API 프록시
// NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 은 서버에서만 사용, 클라이언트에 노출되지 않음
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET만 지원합니다' });
    return;
  }

  const { query } = req.query;
  if (!query || !query.trim()) {
    res.status(400).json({ error: 'query 파라미터가 필요합니다' });
    return;
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    res.status(500).json({ error: 'Naver API 키가 설정되지 않았습니다' });
    return;
  }

  try {
    const url =
      'https://openapi.naver.com/v1/search/shop.json' +
      '?query=' + encodeURIComponent(query.trim()) +
      '&display=10&sort=asc';

    const naverRes = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret
      }
    });

    const data = await naverRes.json();
    if (!naverRes.ok) {
      res.status(naverRes.status).json({ error: data.errorMessage || 'Naver API 오류' });
      return;
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || '서버 오류' });
  }
};
