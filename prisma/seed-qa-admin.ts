/**
 * สร้างบัญชี admin สำหรับทดสอบระบบ — ไม่ถูกลบโดยปุ่ม "เริ่มใหม่" (resetTestUserAction ลบเฉพาะ username "test")
 * มีการ์ดครบทุกใบ + เหรียญเยอะสำหรับเทสเปิดซอง รันซ้ำได้เสมอ (idempotent): ไม่ทับ silver/gold ที่ผู้ทดสอบใช้ไปแล้ว
 * แต่จะไล่แจกการ์ดที่ยังขาดให้ครบทุกครั้ง (เผื่อ import การ์ดเพิ่มทีหลัง หรือรอบก่อนล้มกลางทาง)
 *
 * เช็ค ENABLE_DEV_LOGIN=true เหมือน devLoginAction/resetTestUserAction (src/app/actions/auth.ts) กันรันพลาดใส่
 * environment ที่ไม่ใช่ dev/QA เพราะสร้างบัญชี isAdmin:true ที่มี credential คงที่ในไฟล์นี้
 *
 * รัน: ENABLE_DEV_LOGIN=true npx tsx prisma/seed-qa-admin.ts
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";

const prisma = new PrismaClient();

const QA_ADMIN_USERNAME = "qa_admin";
const QA_ADMIN_PHONE = "0800000001";
const QA_ADMIN_PASSWORD = "qa123456";

async function main() {
  if (process.env.ENABLE_DEV_LOGIN !== "true") {
    console.error("ปฏิเสธการรัน: ต้องตั้ง ENABLE_DEV_LOGIN=true ก่อน (สคริปต์นี้สร้างบัญชี admin ทดสอบ ใช้เฉพาะ dev/QA เท่านั้น)");
    process.exitCode = 1;
    return;
  }

  // เช็ค identity ก่อนแตะข้อมูลใดๆ — username ชนกับผู้ใช้ทั่วไปที่ลงทะเบียนเองได้ (ไม่ใช่แค่บัญชีที่สคริปต์นี้สร้าง)
  // ถ้ามี username นี้อยู่แล้วแต่ phone ไม่ตรง แปลว่าเป็นบัญชีคนละคน ต้องหยุดทันที ห้ามแจกการ์ด/แก้ isAdmin ทับ
  const existing = await prisma.user.findUnique({ where: { username: QA_ADMIN_USERNAME } });
  if (existing && existing.phone !== QA_ADMIN_PHONE) {
    console.error(
      `ปฏิเสธการรัน: มีบัญชี username="${QA_ADMIN_USERNAME}" อยู่แล้วแต่ phone ไม่ตรง (${existing.phone} !== ${QA_ADMIN_PHONE}) — น่าจะเป็นบัญชีผู้ใช้ทั่วไปที่ชื่อชนกัน ไม่ใช่บัญชี QA admin ของสคริปต์นี้ ไม่แจกการ์ด/แก้ไขข้อมูลใดๆ`,
    );
    process.exitCode = 1;
    return;
  }

  const { user, cardCount } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { username: QA_ADMIN_USERNAME },
      create: {
        username: QA_ADMIN_USERNAME,
        phone: QA_ADMIN_PHONE,
        passwordHash: hashPassword(QA_ADMIN_PASSWORD),
        isAdmin: true,
        silver: 999_999,
        gold: 99_999,
      },
      update: {}, // บัญชีเดิม: ไม่ทับ silver/gold/isAdmin ที่อาจถูกใช้/แก้ไปแล้วระหว่างทดสอบ
    });

    // เช็คซ้ำภายใน transaction เดียวกับที่เพิ่งเขียน (กัน TOCTOU — username นี้อาจถูกคนอื่นสมัครแทรกได้พอดีระหว่าง
    // preflight check ข้างบนกับ upsert นี้) ถ้า phone ไม่ตรงคือคนละบัญชีจริง ต้อง throw ให้ transaction rollback
    // ทั้งหมด ไม่แจกการ์ดสักใบ
    if (user.phone !== QA_ADMIN_PHONE) {
      throw new Error(
        `ยกเลิก: username="${QA_ADMIN_USERNAME}" ถูกบัญชีอื่นชิงสมัครไปแล้ว (phone=${user.phone} !== ${QA_ADMIN_PHONE}) ระหว่างสคริปต์กำลังรัน`,
      );
    }

    const cards = await tx.card.findMany({ select: { id: true } });
    const owned = await tx.userCard.findMany({ where: { userId: user.id }, select: { cardId: true } });
    const ownedIds = new Set(owned.map((o) => o.cardId));
    const missing = cards.filter((c) => !ownedIds.has(c.id));
    // SQLite provider ไม่รองรับ createMany({ skipDuplicates: true }) — กรอง missing เองแทน ไล่แจกเฉพาะใบที่ยังขาด
    // ปลอดภัยจะรันซ้ำแม้ import การ์ดเพิ่มทีหลัง หรือรอบก่อนล้มกลางทาง
    if (missing.length > 0) {
      await tx.userCard.createMany({ data: missing.map((c) => ({ userId: user.id, cardId: c.id })) });
    }

    return { user, cardCount: cards.length };
  });

  console.log(
    `บัญชี ${QA_ADMIN_USERNAME} (id=${user.id}) พร้อมใช้งาน — มีการ์ดครบ ${cardCount} ใบ, silver=${user.silver}, gold=${user.gold}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
