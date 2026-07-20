/**
 * Generate database.dbml (root ของโปรเจค) จาก "ฐานข้อมูลจริง" (SQLite) ไม่ใช่จาก schema.prisma
 *
 * อ่านโครงสร้างสดผ่าน PRAGMA (table_info / foreign_key_list / index_list) เพื่อให้ไฟล์ DBML
 * สะท้อนสภาพ database ปัจจุบันเสมอ — ใช้เป็น reference ตอนเขียน query/migration
 *
 * รัน: npm run db:dbml   (รันซ้ำได้ทุกครั้งหลัง migrate)
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const OUTPUT_PATH = join(process.cwd(), "database.dbml");

type TableRow = { name: string; sql: string };
type ColumnRow = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};
type FkRow = {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string | null;
  on_update: string;
  on_delete: string;
};
type IndexRow = { seq: number; name: string; unique: number; origin: string; partial: number };
type IndexColumnRow = { seqno: number; cid: number; name: string | null };

/** PRAGMA คืนตัวเลขเป็น BigInt — แปลงเป็น number เพื่อให้ sort/เทียบค่าได้ */
async function pragma<T>(sql: string): Promise<T[]> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql);
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v])
    )
  ) as T[];
}

/** ชื่อที่ไม่ใช่ [a-zA-Z_][a-zA-Z0-9_]* ต้องครอบด้วย "..." ใน DBML */
function quote(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `"${name}"`;
}

async function main() {
  const tables = await prisma.$queryRawUnsafe<TableRow[]>(
    `SELECT name, sql FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'
     ORDER BY name`
  );

  const out: string[] = [];
  out.push(`// Premier XI — database schema (generated)`);
  out.push(`// สร้างอัตโนมัติจาก database จริงด้วย \`npm run db:dbml\` — ห้ามแก้ไฟล์นี้ด้วยมือ`);
  out.push(`// Provider: sqlite`);
  out.push("");

  const refs: string[] = [];

  for (const table of tables) {
    const columns = await pragma<ColumnRow>(`PRAGMA table_info(${quote(table.name)})`);
    const fks = await pragma<FkRow>(`PRAGMA foreign_key_list(${quote(table.name)})`);
    const indexes = await pragma<IndexRow>(`PRAGMA index_list(${quote(table.name)})`);

    // composite PK ต้องประกาศเป็น indexes block แทน `pk` ราย column
    const pkColumns = columns.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk);
    const singlePk = pkColumns.length === 1 ? pkColumns[0].name : null;

    const fkByColumn = new Map<string, FkRow>();
    for (const fk of fks) fkByColumn.set(fk.from, fk);

    // เก็บ column ของแต่ละ index ไว้ใช้ทั้ง unique flag และ indexes block
    const indexColumns = new Map<string, string[]>();
    for (const idx of indexes) {
      const cols = await pragma<IndexColumnRow>(`PRAGMA index_info(${quote(idx.name)})`);
      indexColumns.set(
        idx.name,
        cols.sort((a, b) => a.seqno - b.seqno).map((c) => c.name ?? "(expression)")
      );
    }
    const singleUniqueColumns = new Set(
      indexes
        .filter((i) => i.unique === 1 && indexColumns.get(i.name)?.length === 1)
        .map((i) => indexColumns.get(i.name)![0])
    );

    out.push(`Table ${quote(table.name)} {`);
    for (const col of columns) {
      const settings: string[] = [];
      if (col.name === singlePk) settings.push("pk");
      if (col.notnull === 1 && col.name !== singlePk) settings.push("not null");
      if (singleUniqueColumns.has(col.name) && col.name !== singlePk) settings.push("unique");
      if (col.dflt_value !== null) settings.push(`default: \`${col.dflt_value}\``);

      const fk = fkByColumn.get(col.name);
      if (fk) {
        const target = fk.to ?? "id";
        settings.push(`ref: > ${quote(fk.table)}.${quote(target)}`);
        refs.push(
          `// ${table.name}.${col.name} -> ${fk.table}.${target} (on delete: ${fk.on_delete}, on update: ${fk.on_update})`
        );
      }

      const suffix = settings.length ? ` [${settings.join(", ")}]` : "";
      out.push(`  ${quote(col.name)} ${col.type || "unknown"}${suffix}`);
    }

    // index ที่ต้องประกาศแยก: composite PK, composite index, unique หลาย column
    const indexLines: string[] = [];
    if (pkColumns.length > 1) {
      indexLines.push(`    (${pkColumns.map((c) => quote(c.name)).join(", ")}) [pk]`);
    }
    for (const idx of indexes) {
      const cols = indexColumns.get(idx.name) ?? [];
      if (cols.length === 0) continue;
      if (cols.length === 1 && idx.unique === 1) continue; // ประกาศเป็น [unique] ราย column แล้ว
      const settings = [`name: '${idx.name}'`];
      if (idx.unique === 1) settings.unshift("unique");
      const target = cols.length === 1 ? quote(cols[0]) : `(${cols.map(quote).join(", ")})`;
      indexLines.push(`    ${target} [${settings.join(", ")}]`);
    }
    if (indexLines.length) {
      out.push("");
      out.push("  indexes {");
      out.push(...indexLines);
      out.push("  }");
    }

    out.push("}");
    out.push("");
  }

  if (refs.length) {
    out.push("// --- Foreign key actions (อ้างอิง, DBML ไม่เก็บ on delete/update ใน inline ref) ---");
    out.push(...refs);
    out.push("");
  }

  writeFileSync(OUTPUT_PATH, out.join("\n"), "utf8");
  console.log(`เขียน ${OUTPUT_PATH} แล้ว (${tables.length} ตาราง)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
