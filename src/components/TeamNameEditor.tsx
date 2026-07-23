"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setTeamNameAction } from "@/app/actions/club";

export default function TeamNameEditor({ initialName }: { initialName: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialName ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    const res = await setTeamNameAction(value);
    setPending(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      setError(res.error ?? "ผิดพลาด");
    }
  }

  if (!editing) {
    return (
      <div className="surface-card flex items-center justify-between rounded-2xl p-4">
        <div>
          <p className="text-xs text-muted">ชื่อทีม</p>
          <h2 className="text-lg font-bold">{initialName ?? "ยังไม่ได้ตั้งชื่อทีม"}</h2>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:border-primary"
        >
          แก้ไข
        </button>
      </div>
    );
  }

  return (
    <div className="surface-card rounded-2xl p-4">
      <p className="mb-2 text-xs text-muted">ชื่อทีม (2-20 ตัวอักษร)</p>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={20}
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        placeholder="ตั้งชื่อทีมของคุณ"
      />
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40"
        >
          {pending ? "..." : "บันทึก"}
        </button>
        <button
          onClick={() => {
            setValue(initialName ?? "");
            setError(null);
            setEditing(false);
          }}
          className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
        >
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
