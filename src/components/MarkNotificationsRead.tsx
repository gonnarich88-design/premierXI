"use client";

import { useEffect } from "react";
import { markNotificationsReadAction } from "@/app/actions/notifications";

// ไม่ render อะไร แค่ trigger mark-as-read + revalidate header badge ตอนเปิดหน้านี้
// cutoff = เวลาที่ page.tsx capture ไว้ก่อนโหลด snapshot — กันรายการที่เพิ่งถูกสร้างระหว่างเปิดหน้าโดนนับว่าอ่านแล้ว
export default function MarkNotificationsRead({ cutoff }: { cutoff: string }) {
  useEffect(() => {
    markNotificationsReadAction(cutoff);
  }, [cutoff]);
  return null;
}
