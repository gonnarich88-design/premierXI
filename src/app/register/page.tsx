import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { registerAction } from "@/app/actions/auth";
import { getSessionUserId } from "@/lib/auth";

export default async function RegisterPage() {
  if (await getSessionUserId()) redirect("/");
  return <AuthForm mode="register" action={registerAction} />;
}
