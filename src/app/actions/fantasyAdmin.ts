"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createGameweek, upsertMatch, upsertPlayerStat, type MatchInput, type PlayerStatInput } from "@/lib/fantasyAdmin";
import { closeGameweek } from "@/lib/fantasy";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) redirect("/");
  return user;
}

function errorRedirect(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createGameweekAction(formData: FormData) {
  await requireAdmin();

  const number = Number(formData.get("number"));
  const deadline = new Date(String(formData.get("deadline") ?? ""));
  if (!Number.isInteger(number) || number <= 0 || Number.isNaN(deadline.getTime())) {
    errorRedirect("/admin/fantasy", "กรอกหมายเลข Gameweek และ deadline ให้ถูกต้อง");
  }

  let gameweekId: string;
  try {
    const gw = await createGameweek(number, deadline);
    gameweekId = gw.id;
  } catch (e) {
    errorRedirect("/admin/fantasy", e instanceof Error ? e.message : "สร้าง Gameweek ไม่สำเร็จ");
  }

  revalidatePath("/admin/fantasy");
  redirect(`/admin/fantasy/${gameweekId}`);
}

export async function upsertMatchAction(formData: FormData) {
  await requireAdmin();

  const gameweekId = String(formData.get("gameweekId") ?? "");
  const matchIdRaw = String(formData.get("matchId") ?? "");
  const status = String(formData.get("status") ?? "SCHEDULED") as MatchInput["status"];
  const homeScoreRaw = String(formData.get("homeScore") ?? "");
  const awayScoreRaw = String(formData.get("awayScore") ?? "");
  const kickoffAtRaw = String(formData.get("kickoffAt") ?? "");

  const input: MatchInput = {
    id: matchIdRaw || undefined,
    homeClub: String(formData.get("homeClub") ?? "").trim(),
    awayClub: String(formData.get("awayClub") ?? "").trim(),
    homeScore: homeScoreRaw === "" ? null : Number(homeScoreRaw),
    awayScore: awayScoreRaw === "" ? null : Number(awayScoreRaw),
    kickoffAt: kickoffAtRaw ? new Date(kickoffAtRaw) : null,
    status,
  };

  if (!gameweekId || !input.homeClub || !input.awayClub) {
    errorRedirect("/admin/fantasy", "กรอกทีมเหย้า/ทีมเยือนให้ครบ");
  }

  try {
    await upsertMatch(gameweekId, input);
  } catch (e) {
    errorRedirect(`/admin/fantasy/${gameweekId}`, e instanceof Error ? e.message : "บันทึกแมตช์ไม่สำเร็จ");
  }

  revalidatePath(`/admin/fantasy/${gameweekId}`);
  redirect(`/admin/fantasy/${gameweekId}`);
}

export async function upsertPlayerStatAction(formData: FormData) {
  await requireAdmin();

  const gameweekId = String(formData.get("gameweekId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  const clubSide = String(formData.get("clubSide") ?? "") as "HOME" | "AWAY";

  const stat: PlayerStatInput = {
    minutes: Number(formData.get("minutes") ?? 0),
    goals: Number(formData.get("goals") ?? 0),
    assists: Number(formData.get("assists") ?? 0),
    yellow: Number(formData.get("yellow") ?? 0),
    red: Number(formData.get("red") ?? 0),
    ownGoals: Number(formData.get("ownGoals") ?? 0),
  };

  if (!matchId || !playerId || (clubSide !== "HOME" && clubSide !== "AWAY")) {
    errorRedirect(`/admin/fantasy/${gameweekId}`, "ข้อมูลกรอกสถิติไม่ครบ");
  }

  try {
    await upsertPlayerStat(matchId, playerId, clubSide, stat);
  } catch (e) {
    errorRedirect(`/admin/fantasy/${gameweekId}`, e instanceof Error ? e.message : "บันทึกสถิติไม่สำเร็จ");
  }

  revalidatePath(`/admin/fantasy/${gameweekId}`);
  redirect(`/admin/fantasy/${gameweekId}`);
}

export async function closeGameweekAction(formData: FormData) {
  await requireAdmin();

  const gameweekId = String(formData.get("gameweekId") ?? "");
  if (!gameweekId) redirect("/admin/fantasy");

  try {
    const result = await closeGameweek(gameweekId);
    if (!result.ok) errorRedirect(`/admin/fantasy/${gameweekId}`, result.error);
  } catch (e) {
    errorRedirect(`/admin/fantasy/${gameweekId}`, e instanceof Error ? e.message : "ปิด Gameweek ไม่สำเร็จ");
  }

  revalidatePath(`/admin/fantasy/${gameweekId}`);
  revalidatePath("/admin/fantasy");
  revalidatePath("/fantasy");
  redirect(`/admin/fantasy/${gameweekId}`);
}
