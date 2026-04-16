const recentRequests = new Map();

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const lastRequest = recentRequests.get(clientIp);
    if (lastRequest && now - lastRequest < 10000) {
        return res.status(429).json({ error: '잠시 후 다시 시도해주세요.' });
    }
    recentRequests.set(clientIp, now);

    const { email } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ error: '올바른 이메일 주소를 입력해주세요.' });
    }

    try {
        const response = await fetch(
            `https://api.resend.com/audiences/${process.env.RESEND_AUDIENCE_ID}/contacts`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    unsubscribed: false,
                }),
            }
        );

        if (!response.ok) {
            return res.status(400).json({ error: '구독 처리 중 오류가 발생했습니다.' });
        }

        return res.status(200).json({ message: '구독 완료' });
    } catch (error) {
        return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
}
