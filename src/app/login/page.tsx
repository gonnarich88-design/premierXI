import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { loginAction, devLoginAction } from "@/app/actions/auth";
import { getSessionUserId } from "@/lib/auth";

export default async function LoginPage() {
  if (await getSessionUserId()) redirect("/");
  return (
    <>
      <AuthForm mode="login" action={loginAction} />

      {/* TEMP: ปุ่มเข้าสู่ระบบด้วยบัญชีทดสอบ (ลบเมื่อระบบเสร็จ) */}
      <div className="px-5">
        <form action={devLoginAction}>
          <button
            type="submit"
            className="w-full rounded-xl border border-dashed border-accent/60 bg-surface py-3 text-sm font-semibold text-accent"
          >
            เข้าสู่ระบบด้วยบัญชีทดสอบ (test)
          </button>
        </form>
      </div>
    </>
  );
}
