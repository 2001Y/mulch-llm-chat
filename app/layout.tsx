import { Suspense } from "react";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { ManifestLink } from "components/ManifestLink";
import { Toaster } from "sonner";
import ClientOnly from "components/ClientOnly";
import Sidebar from "components/Sidebar";
import { ChatLogicProvider } from "contexts/ChatLogicContext";
import "@/styles/layout.scss";
import "@/styles/modals.scss";
import { Glegoo, JetBrains_Mono } from "next/font/google";

const glegoo = Glegoo({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-glegoo",
});

const jetbrains_mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Multi AI Chat | OpenRouter Chat Client",
  description: "A chat application using LLM",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "Multi AI Chat",
  },
  icons: {
    icon: "https://mulch-llm-chat.vercel.app/apple-touch-icon.jpg",
    apple: "https://mulch-llm-chat.vercel.app/apple-touch-icon.jpg",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: "no",
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${glegoo.variable} ${jetbrains_mono.variable}`}>
      <head>
        <Suspense>
          <ManifestLink />
        </Suspense>
        {/* <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\" /> */}
        {/* <link */}
        {/*   rel=\"preconnect\" */}
        {/*   href=\"https://fonts.gstatic.com\" */}
        {/*   crossOrigin=\"anonymous\" */}
        {/* /> */}
        {/* <link */}
        {/*   href=\"https://fonts.googleapis.com/css2?family=Glegoo:wght@400;700&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap\" */}
        {/*   rel=\"stylesheet\" */}
        {/* /> */}
      </head>
      <body>
        <ChatLogicProvider isShared={false}>
          <div className="layout">
            <Sidebar />
            <main className="main-content">{children}</main>
          </div>
          <ClientOnly />
          <Analytics />
          <Toaster />
        </ChatLogicProvider>
      </body>
    </html>
  );
}
