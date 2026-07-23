"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Card from "@/components/ui/Card";

export default function StarterPackModal() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
      onClick={() => setOpen(false)}
    >
      <Card
        hub
        className="relative w-full max-w-xs border border-accent p-6 text-center shadow-xl"
      >
        <button
          type="button"
          aria-label="ปิด"
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-muted hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6 6.4 5Z" />
          </svg>
        </button>

        <span className="mb-3 inline-block rounded-full bg-accent px-3 py-1 text-xs font-bold text-primary-foreground">
          ยินดีต้อนรับ
        </span>
        <h2 className="text-lg font-bold">คุณได้รับ Starter Pack ฟรี!</h2>
        <p className="mt-2 text-sm text-muted">
          เปิดฟรีเพื่อรับการ์ดตั้งต้น 11 ใบ + 300 Silver + 1 Ticket
        </p>

        <button
          type="button"
          onClick={() => router.push("/pack")}
          className="mt-5 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary-strong"
        >
          ไปเปิดการ์ด
        </button>
      </Card>
    </div>
  );
}
