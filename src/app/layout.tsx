import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "J.A.R.V.I.S. — AI Assistant",
  description: "Just A Rather Very Intelligent System — your personal AI assistant with voice control, vision and real-time intelligence.",
  keywords: ["JARVIS", "AI assistant", "voice assistant", "AI", "Z.ai"],
  authors: [{ name: "Stark Industries" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "J.A.R.V.I.S. AI Assistant",
    description: "Your personal intelligent AI assistant",
    siteName: "J.A.R.V.I.S.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "J.A.R.V.I.S. AI Assistant",
    description: "Your personal intelligent AI assistant",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
