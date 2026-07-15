import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createAnnouncementAction,
  toggleAnnouncementAction,
  deleteAnnouncementAction,
} from "@/app/actions/notifications";

export const metadata = { title: "จัดการข่าว · Admin" };

export default async function AdminNewsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/");

  const items = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="px-4 pt-5">
      <h1 className="mb-4 text-lg font-bold">จัดการข่าว/ประกาศ</h1>

      {/* ฟอร์มเขียนข่าวใหม่ (server action — ทำงานได้แม้ยังไม่ hydrate) */}
      <form
        action={createAnnouncementAction}
        className="mb-6 space-y-3 rounded-xl border border-border bg-surface/60 p-4"
      >
        <div>
          <label className="mb-1 block text-sm text-muted">หัวข้อ</label>
          <input
            name="title"
            required
            maxLength={120}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="เช่น อัพเดตซีซั่นใหม่"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">เนื้อหา</label>
          <textarea
            name="body"
            required
            rows={4}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="รายละเอียดข่าว…"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
        >
          เผยแพร่ข่าว
        </button>
      </form>

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        ข่าวทั้งหมด ({items.length})
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">ยังไม่มีข่าว</p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className="rounded-xl border border-border bg-surface/60 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{n.title}</h3>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    n.published
                      ? "bg-primary/20 text-primary"
                      : "bg-border text-muted"
                  }`}
                >
                  {n.published ? "เผยแพร่" : "ซ่อน"}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-muted">
                {n.body}
              </p>
              <p className="mt-2 text-[11px] text-muted">
                {n.createdAt.toLocaleString("th-TH")}
              </p>
              <div className="mt-3 flex gap-2">
                <form action={toggleAnnouncementAction}>
                  <input type="hidden" name="id" value={n.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary"
                  >
                    {n.published ? "ซ่อน" : "เผยแพร่"}
                  </button>
                </form>
                <form action={deleteAnnouncementAction}>
                  <input type="hidden" name="id" value={n.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-red-300 hover:border-red-400/50"
                  >
                    ลบ
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
