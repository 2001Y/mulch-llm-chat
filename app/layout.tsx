import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/react'
import '@/styles/globals.scss'

export const metadata: Metadata = {
    title: 'Multi AI Chat | OpenRouter Chat Client',
    description: 'A chat application using LLM',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="ja">
            <body>
                {children}
                <Analytics />
            </body>
        </html>
    )
}