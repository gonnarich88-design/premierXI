import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import AppHeader from "@/components/AppHeader";
import { getSessionUserId } from "@/lib/auth";
import { getUnreadCount } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Premier XI",
  description: "เกมสะสมการ์ดนักฟุตบอลพรีเมียร์ลีก",
};

export const viewport: Viewport = {
  themeColor: "#0f0720",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const userId = await getSessionUserId();
  const unread = userId ? await getUnreadCount(userId) : 0;
  const wallet = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { silver: true, gold: true } })
    : null;

  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {/* Mobile-first shell: constrain to a phone width, bottom nav inside */}
        <div className="mx-auto flex min-h-dvh max-w-md flex-col">
          {userId && wallet && (
            <AppHeader unread={unread} silver={wallet.silver} gold={wallet.gold} />
          )}
          <main className="flex-1 pb-2">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
