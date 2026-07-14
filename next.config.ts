import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // อนุญาต origin ของ Preview proxy ในโหมด dev (กัน asset /_next/* ถูกบล็อกเพราะ cross-origin)
  // "null" = preview ถูกฝังใน sandboxed iframe ของ mycoder → browser ส่ง Origin: null
  allowedDevOrigins: [
    "null",
    "mycoder-p5.knetwork.app",
    "*.knetwork.app",
  ],
  experimental: {
    // อนุญาต Server Actions จาก origin ของ Preview proxy (กัน "Invalid Server Actions request" 500)
    // "null": sandboxed iframe ส่ง Origin: null แต่ proxy ใส่ x-forwarded-host = mycoder-p5.*
    // ทำให้ Next CSRF check ไม่ผ่าน — ต้อง allow "null" ปุ่มล็อกอิน/ฟอร์มต่างๆ จึงทำงานใน preview
    serverActions: {
      allowedOrigins: [
        "null",
        "mycoder-p5.knetwork.app",
        "*.knetwork.app",
      ],
    },
  },
};

export default nextConfig;
