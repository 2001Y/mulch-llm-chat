import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
    const session = await getServerSession(authOptions);

    if (session) {
        return NextResponse.json({ isLoggedIn: true });
    } else {
        return NextResponse.json({ isLoggedIn: false });
    }
}