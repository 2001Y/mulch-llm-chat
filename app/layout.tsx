import { Suspense } from 'react';
import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/react'
import '@/styles/globals.scss'
import { ManifestLink } from '_components/ManifestLink'

export const metadata: Metadata = {
    title: 'Multi AI Chat | OpenRouter Chat Client',
    description: 'A chat application using LLM',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black',
        title: 'Multi AI Chat'
    },
    icons: {
        icon: 'https://mulch-llm-chat.vercel.app/apple-touch-icon.jpg',
        apple: 'https://mulch-llm-chat.vercel.app/apple-touch-icon.jpg'
    },
}

export const viewport = {
    width: 'device-width',
    initialScale: 1.0,
    maximumScale: 1.0,
    userScalable: 'no',
    viewportFit: 'cover',
    themeColor: '#000000',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="ja">
            <head>
                <Suspense>
                    <ManifestLink />
                </Suspense>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Glegoo:wght@400;700&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap" rel="stylesheet" />
            </head>
            <body>
                {children}
                <Analytics />
            </body>
        </html>
    )
}