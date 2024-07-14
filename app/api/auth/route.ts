import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const { code } = await req.json();

    try {
        const response = await fetch('https://openrouter.ai/api/v1/auth/keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                code: "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"
            }),
        });

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching access token:', error);
        return NextResponse.json({ error: 'Error fetching access token' }, { status: 500 });
    }
}