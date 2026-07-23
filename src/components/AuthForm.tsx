"use client";

import { useActionState } from "react";
import type { AuthState } from "@/app/actions/auth";
import Button from "@/components/ui/Button";

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

        <Button type="submit" variant="gradient" size="lg" disabled={pending} className="w-full">
          {pending ? "กำลังดำเนินการ..." : isRegister ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
        </Button>
      </form>

      <Button
        href={isRegister ? "/login" : "/register"}
        variant="outline"
        size="lg"
        className="mt-3 w-full"
      >
        {isRegister ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
      </Button>
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
