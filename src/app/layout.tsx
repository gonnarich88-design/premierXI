import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {/* Mobile-first shell: constrain to a phone width, bottom nav inside */}
        <div className="mx-auto flex min-h-dvh max-w-md flex-col">
          <main className="flex-1 pb-2">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
