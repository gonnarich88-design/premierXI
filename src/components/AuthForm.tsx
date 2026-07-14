"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AuthState } from "@/app/actions/auth";

type Props = {
  mode: "login" | "register";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
};

export default function AuthForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    undefined,
  );
  const isRegister = mode === "register";

  return (
    <div className="px-5 pt-10">
      <header className="mb-8 text-center">
        <h1 className="bg-gradient-to-r from-accent to-primary bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
          PREMIER XI
        </h1>
        <p className="mt-1 text-sm text-muted">
          {isRegister ? "สมัครสมาชิกใหม่" : "เข้าสู่ระบบ"}
        </p>
      </header>

      <form action={formAction} className="space-y-4">
        <Field
          name="username"
          label="Username"
          type="text"
          placeholder="ตั้งชื่อผู้ใช้ (a-z, 0-9, _)"
          autoComplete="username"
        />
        {isRegister && (
          <Field
            name="phone"
            label="เบอร์โทรศัพท์"
            type="tel"
            placeholder="เช่น 0812345678"
            autoComplete="tel"
          />
        )}
        <Field
          name="password"
          label="รหัสผ่าน"
          type="password"
          placeholder="อย่างน้อย 6 ตัวอักษร"
          autoComplete={isRegister ? "new-password" : "current-password"}
        />

        {state?.error && (
          <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground transition hover:bg-primary-strong disabled:opacity-60"
        >
          {pending ? "กำลังดำเนินการ..." : isRegister ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {isRegister ? (
          <>
            มีบัญชีแล้ว?{" "}
            <Link href="/login" className="font-semibold text-accent">
              เข้าสู่ระบบ
            </Link>
          </>
        ) : (
          <>
            ยังไม่มีบัญชี?{" "}
            <Link href="/register" className="font-semibold text-accent">
              สมัครสมาชิก
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

function Field({
  name,
  label,
  type,
  placeholder,
  autoComplete,
}: {
  name: string;
  label: string;
  type: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-muted">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground outline-none transition focus:border-primary"
      />
    </label>
  );
}
