// src/app/fantasy/news/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { getNews } from "@/lib/notifications";

export const metadata = { title: "ข่าว Fantasy · Premier XI" };

function timeAgo(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "เมื่อสักครู่";
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day} วันที่แล้ว`;
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

export default async function FantasyNewsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const news = await getNews();

  return (
    <div className="px-4 pt-3 pb-6">
      <Link href="/fantasy" className="text-sm text-primary">
        ← กลับ
      </Link>

      <h1 className="mb-4 mt-3 text-lg font-bold">ข่าว</h1>

      {news.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">ยังไม่มีข่าว</p>
      ) : (
        <ul className="space-y-2">
          {news.map((n) => (
            <li key={n.id} className="rounded-xl border border-border bg-surface/60 p-3">
              <h3 className="font-semibold">{n.title}</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-muted">{n.body}</p>
              <p className="mt-2 text-[11px] text-muted">{timeAgo(n.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
