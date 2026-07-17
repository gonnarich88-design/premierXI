import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { loginAction, devLoginAction, resetTestUserAction } from "@/app/actions/auth";
import { getSessionUserId } from "@/lib/auth";

export default async function LoginPage() {
  if (await getSessionUserId()) redirect("/");
  const devLoginEnabled = process.env.ENABLE_DEV_LOGIN === "true";
  return (
    <>
      <AuthForm mode="login" action={loginAction} />

      {/* TEMP: ปุ่มเข้าสู่ระบบด้วยบัญชีทดสอบ (ลบเมื่อระบบเสร็จ) — ซ่อนถ้าไม่ได้เปิด ENABLE_DEV_LOGIN */}
      {devLoginEnabled && (
        <div className="px-5">
          <form action={devLoginAction}>
            <button
              type="submit"
              className="w-full rounded-xl border border-dashed border-accent/60 bg-surface py-3 text-sm font-semibold text-accent"
            >
              เข้าสู่ระบบด้วยบัญชีทดสอบ (test)
            </button>
          </form>
          <form action={resetTestUserAction} className="mt-2">
            <button
              type="submit"
              className="w-full rounded-xl border border-dashed border-border bg-surface py-3 text-sm font-semibold text-muted"
            >
              เริ่มใหม่ (ล้าง test แล้วเข้าครั้งแรก)
            </button>
          </form>
        </div>
      )}
    </>
  );
}
