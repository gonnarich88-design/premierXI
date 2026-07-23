# Assets ทั่วไป (ซอง / โลโก้ / รูปอื่นๆ ในเกม)

แยกจาก `public/card/` ที่เก็บเฉพาะรูปการ์ดนักเตะ — โฟลเดอร์นี้ (`public/assets/`) ไว้เก็บรูปประกอบอื่นของเกม เข้าถึงได้ผ่าน URL `/assets/<โฟลเดอร์ย่อย>/<ชื่อไฟล์>`

## โครงสร้าง
- `packs/` — รูปซอง (Standard/Evolution/Royal Prime/Starter Pack ฯลฯ)
- `logos/` — โลโก้สโมสร/ลีก/แบรนด์เกม
- `misc/` — รูปอื่นที่ไม่เข้าพวกข้างบน

## หมายเหตุ
- รองรับ `.png`, `.jpg`, `.webp`, `.svg`
- ตั้งชื่อไฟล์สื่อความหมาย เช่น `standard-pack.png`, `royalprime-pack.png`, `arsenal.png`
