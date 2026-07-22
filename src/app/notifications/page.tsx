import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import {
  getNotificationCenter,
  type NotificationItem,
  type NewsItem,
} from "@/lib/notifications";
import MarkNotificationsRead from "@/components/MarkNotificationsRead";

export const metadata = { title: "การแจ้งเตือน · Premier XI" };

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

export default async function NotificationsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  // capture cutoff ก่อนอ่าน snapshot เสมอ — ส่งไป mark-as-read ฝั่ง client (ดู MarkNotificationsRead) กัน
  // รายการที่เพิ่งถูกสร้างขึ้นระหว่างเปิดหน้า (หลัง snapshot นี้) โดนนับว่าอ่านแล้วทั้งที่ไม่เคยแสดงให้เห็น
  const cutoff = new Date();
  const { news, notifications } = await getNotificationCenter(userId);

  const empty = news.length === 0 && notifications.length === 0;

  return (
    <div className="px-4 pt-5">
      <MarkNotificationsRead cutoff={cutoff.toISOString()} />
      <h1 className="mb-4 text-lg font-bold">การแจ้งเตือน</h1>

      {empty && (
        <p className="mt-16 text-center text-sm text-muted">
          ยังไม่มีการแจ้งเตือน
        </p>
      )}

      {news.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            ข่าวสาร
          </h2>
          <ul className="space-y-2">
            {news.map((n) => (
              <NewsRow key={n.id} item={n} />
            ))}
          </ul>
        </section>
      )}

      {notifications.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            กิจกรรม
          </h2>
          <ul className="space-y-2">
            {notifications.map((n) => (
              <ActivityRow key={n.id} item={n} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function NewsRow({ item }: { item: NewsItem }) {
  return (
    <li
      className={`rounded-xl border p-3 ${
        item.isNew ? "border-primary/50 bg-primary/5" : "border-border bg-surface/60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{item.title}</h3>
        {item.isNew && (
          <span className="mt-0.5 shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
            ใหม่
          </span>
        )}
      </div>
      <p className="mt-1 whitespace-pre-line text-sm text-muted">{item.body}</p>
      <p className="mt-2 text-[11px] text-muted">{timeAgo(item.createdAt)}</p>
    </li>
  );
}

function ActivityRow({ item }: { item: NotificationItem }) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium">{item.title}</h3>
        {!item.read && (
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
        )}
      </div>
      {item.body && <p className="mt-0.5 text-sm text-muted">{item.body}</p>}
      <p className="mt-2 text-[11px] text-muted">{timeAgo(item.createdAt)}</p>
    </>
  );

  const cls = `block rounded-xl border p-3 ${
    item.read ? "border-border bg-surface/60" : "border-accent/40 bg-accent/5"
  }`;

  return (
    <li>
      {item.href ? (
        <Link href={item.href} className={cls}>
          {inner}
        </Link>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </li>
  );
}
