export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email } = req.body;

    if (!email || !email.includes('@')) {
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

        const data = await response.json();

        if (!response.ok) {
            return res.status(400).json({ error: '구독 처리 중 오류가 발생했습니다.' });
        }

        return res.status(200).json({ message: '구독 완료' });
    } catch (error) {
        return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
}
