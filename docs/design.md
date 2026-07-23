# Premier XI — Design System

เอกสารระบบดีไซน์ทั้งแอป สร้างวันที่ 2026-07-22 (ขั้น 13) — อ้างอิงจาก mockup แอพ Fantasy Football โทนม่วง-ดำที่ผู้ใช้ส่งมา ปรับภาษาดีไซน์ให้เข้ากับ asset และธีมสีที่ Premier XI มีอยู่แล้ว **ไม่ใช่การเปลี่ยนสีใหม่** — ใช้อ่านก่อนแก้/เพิ่มหน้าจอใดๆ ต่อจากนี้ เพื่อให้ทุกหน้าพูดภาษาเดียวกัน

## 0. หลักการ

- **สีเดิมคือของตาย** — เอกสารนี้ไม่เพิ่ม/เปลี่ยน color palette ใน `globals.css` มีแค่ token เสริม (radius/glow/spacing) เท่านั้น
- **ทั้งแอป ไม่ใช่แค่โซนเดียว** — บังคับใช้กับ Home/Store/PvP/Fantasy/My Club/Auth ทุกหน้า
- **Reskin ของที่มีอยู่ ไม่ใช่ฟีเจอร์ใหม่** — งานนี้ทำให้หน้าเดิมสวยขึ้นด้วยภาษาเดียวกัน ไม่เพิ่ม flow/route ใหม่ (ยกเว้นที่ระบุใน §6 ว่า deferred)
- **Mobile-first เสมอ** ([[mobile-first-ux-priority]]) — ทุก pattern ในเอกสารนี้ออกแบบให้จอมือถือเป็น target หลัก

---

## 1. Foundations (tokens)

### 1.1 สี — โทนม่วงเดิม, ปรับเป็น "Dark Card-Based UI" (2026-07-23, ขั้น 14)

อ้างอิงจาก `src/app/globals.css`:

| Token | ค่า | ใช้ทำอะไร |
|---|---|---|
| `--background` | `#0a0810` (was `#0f0720`) | พื้นหลังแอปทั้งหมด — เข้ม/เป็นกลางขึ้น |
| `--surface` / `--surface-2` | `#17102b` / `#221541` (was `#1a0f33` / `#251646`) | พื้นผิวการ์ด/ช่องอินพุต |
| `--border` | `#2c1d4a` (was `#362358`) | เหลือใช้แค่จุด functional (input focus, ปุ่ม outline, ขอบการ์ดสถานะเด่น) — **การ์ดปกติไม่ใช้ border แล้ว** ดู §2 `Card` |
| `--card-grad-hi` / `--card-grad-lo` | `#271948` / `#120b24` (ใหม่) | 3-stop gradient มุม 45° ของ `.surface-card` utility |
| `--card-grad-angle` | `45deg` (ใหม่) | องศาคงที่ ไม่ใช้ `to-top-right` เพราะจะบิดตามสัดส่วนการ์ด |
| `--foreground` | `#f4f1fb` | ข้อความหลัก |
| `--muted` | `#a99bc4` | ข้อความรอง/label |
| `--primary` / `--primary-strong` | `#8b5cf6` / `#7c3aed` | ปุ่ม/ลิงก์/สถานะ active — **ไม่เปลี่ยน** |
| `--accent` | `#c084fc` | ตัวเลขเด่น/ลิงก์รอง — **ไม่เปลี่ยน** |
| `--gold` / `--silver` | `#f5c451` / `#c9d1e0` | currency — **ไม่เปลี่ยน** |

**Body glow**: ย้ายจาก `radial-gradient(120% 60% at 50% -10%, ...)` (กลางบน) → `radial-gradient(85% 60% at 100% 0%, rgba(139,92,246,.30) 0%, rgba(124,58,237,.12) 28%, transparent 55%)` (มุมขวาบนจริง) — การ์ดทุกใบไล่เฉด "สว่างขวาบน เข้มซ้ายล่าง" ให้ตรงกับทิศทางแหล่งแสงนี้ เหมือนมีแหล่งแสงเดียวกันทั้งจอ

**ทำไมเปลี่ยน**: ผู้ใช้ขอ "Dark Mode Minimal / Glassmorphism" → คุยผ่าน brainstorming skill สรุปว่ารูปตัวอย่าง (EA Sports FC Companion App) จริงๆ คือ **"Dark Card-Based UI" แบบ Flat + Tonal Surface** ไม่ใช่ glassmorphism (ไม่มี `backdrop-blur`/โปร่งแสง) — เลือกทำแบบทึบตามรูปเป๊ะ (ไม่ใส่ blur ทับ) เพราะ performance มือถือ (การ์ดเยอะ+blur จะกระตุกตอน scroll) และการ์ด hub เป็น UI ข้อความล้วนไม่มีอะไรให้ blur ทะลุเห็น

### 1.2 Radius scale (ใหม่ — normalize ให้สม่ำเสมอ)

ปัจจุบันปนกันระหว่าง `rounded-xl` (ปุ่ม/ช่องอินพุต) กับ `rounded-2xl` (การ์ด) — ให้เป็นกฎตายตัว:

| ระดับ | ค่า | ใช้กับ |
|---|---|---|
| `radius-pill` | `rounded-full` | ปุ่ม CTA, badge, tab underline container |
| `radius-card` | `rounded-2xl` | การ์ดทุกชนิด (bento, stat, list row container) |
| `radius-field` | `rounded-xl` | ช่องกรอกข้อมูล (input เดิมคงไว้) |

### 1.3 Glow utilities (ใหม่ — เพิ่มใน `globals.css`)

```css
.glow-primary {
  box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.3), 0 0 24px rgba(139, 92, 246, 0.25);
}
```

ใช้กับ `Card` primitive (prop `glow`) เท่านั้นตอนนี้ — `.glow-hero`/`.glow-tier-gold` ที่เคยมีถูกถอดออกแล้ว (ดู §3.1 เรื่อง hero ที่ revert)

### 1.4 Typography scale

| ชื่อ | style | ใช้กับ |
|---|---|---|
| `display` | `text-3xl font-extrabold tracking-tight` + gradient clip-text (`from-accent to-primary`) | หัวเรื่องแบรนด์ (มีอยู่แล้วที่ `AuthForm.tsx`, Home) |
| **`stat-hero`** | `text-2xl sm:text-3xl font-extrabold tabular-nums` | ตัวเลขเด่น (rating, currency, GW number) — องค์ประกอบหลักจากรูปตัวอย่าง |
| `stat-label` | `text-[11px] text-muted uppercase tracking-wide` | label ใต้ stat-hero |
| `title` | `text-xl font-bold` | หัวข้อหน้า (h1) |
| `body` | `text-sm` | เนื้อหาทั่วไป |
| `muted` | `text-xs text-muted` | รายละเอียดรอง |

### 1.5 Spacing

Page shell มาตรฐาน: `px-4 pt-6 pb-4` — บาง page ใช้ `px-3`/`pt-3` ให้ normalize เป็นค่านี้ตอน migrate

### 1.6 Motion

คงของเดิมทั้งหมด ไม่คิดใหม่:
- `pack-shake` (0.9s) — ก่อนเปิดซอง
- `card-reveal` (0.6s, `cubic-bezier(0.2, 0.8, 0.2, 1)`) — เผยการ์ด
- ใช้ easing เดียวกันนี้เป็นค่ามาตรฐานสำหรับ transition ใหม่ๆ (hover, tab switch)

---

## 2. Primitives ใหม่ (`src/components/ui/`)

ปัจจุบัน**ไม่มี shared UI primitive เลย** — ทุกหน้า hand-roll class string ซ้ำๆ กัน (เช่น `rounded-2xl border border-border bg-surface/60 p-4 hover:border-primary` ซ้ำอยู่ใน `club/page.tsx`, `fantasy/page.tsx`, Home) จุดนี้คือช่องว่างที่ทำให้ enforce ภาษาดีไซน์ไม่ได้ในจุดเดียว — Phase 2 จะเพิ่ม primitive ต่อไปนี้:

**อัพเดต 2026-07-23 (ขั้น 14, Dark Card-Based UI)**: การ์ดปกติทุกใบ**ตัด `border border-border` ออก** เปลี่ยนไปใช้ utility class `.surface-card` แทน (gradient 3-stop มุม 45° + `box-shadow: inset 0 1px 0 rgba(255,255,255,.04)` แยกจากพื้นหลังด้วย tonal contrast ไม่ใช่เส้นขอบ) และ hover เปลี่ยนจาก `hover:border-primary` → `hover:brightness-110` (การ์ดที่มี prop `glow` ยังคง `hover:glow-primary` เดิมไว้) — ตัดสินใจ 3 จุดที่ยังคง border ไว้ (ตามคำแนะนำ Opus, ผู้ใช้ยืนยันแล้ว):
- **Avatar chip** (`ListRow`/`Avatar.tsx`) — เก็บ `border border-border` ไว้ (รูปเล็กมีขอบช่วยแยกชิ้นชัดกว่า)
- **การ์ดสถานะเด่น** (Starter Pack promo `border-accent`, แจ้งเตือนใหม่ `border-primary/50`/`border-accent/40`) — เก็บขอบไว้เพราะสื่อสถานะ ไม่ใช่ขอบการ์ดทั่วไป
- **หน้า Admin** — container ปรับเป็น `.surface-card` แล้ว แต่ `<input>`/`<select>`/`<textarea>` ทุกจุดเก็บ `border border-border` ไว้เป็น focus affordance (`focus:border-primary`)

### `Button`
```ts
variant: "gradient" | "outline" | "solid" | "ghost"
size: "md" | "lg"
```
- `gradient` = pill CTA หลัก (`rounded-full bg-gradient-to-r from-primary to-primary-strong`) — แทน `bg-primary` ตรงๆ ที่ `AuthForm.tsx`, `PackShop.tsx`, `PvpMatch.tsx` ใช้อยู่
- `outline` = pill ขอบ (สำหรับ CTA รอง เช่น "Log In" ในรูปตัวอย่าง)
- `solid`/`ghost` = คงพฤติกรรมปุ่มรองแบบเดิมไว้เผื่อจุดที่ไม่ต้องการ pill (เช่นปุ่มในฟอร์ม admin)

### `Card` / `Surface`
Canonicalize bento pattern ที่มีอยู่แล้ว: `.surface-card rounded-2xl p-4 hover:brightness-110` (ไม่มี border — ดูเหตุผลใน §1.1/§2 หัวข้อ "อัพเดต 2026-07-23") + prop `glow?: boolean` (ใส่ `.glow-primary` ตอน hover/active) + prop `href?` (เป็นลิงก์ได้)

### `Stat`
```ts
{ value: string | number; label: string; divider?: boolean }
```
แถวสถิติแบบรูปตัวอย่าง Screen 2 (ตัวเลขใหญ่ + label เล็กใต้ + เส้นคั่นบางๆ ระหว่างแต่ละ stat) — ใช้ `stat-hero`/`stat-label` จาก §1.4

### `Tabs` / `SegmentedControl`
Underline active-state, รองรับ horizontal scroll (สำหรับ filter แบบ "All/QBs/RBs..." ในรูปตัวอย่าง) — ปัจจุบันไม่มี pattern นี้ในแอปเลย ใช้แทน `← กลับ` ล้วนๆ ที่ subpage ของ Fantasy

### `Avatar`
**Mini-card chip** สี่เหลี่ยมมุมโค้ง (`rounded-lg`, ไม่ใช่วงกลม) ครอปด้วย `object-cover object-top` จากภาพการ์ดจริง — ตัดสินใจแล้วว่าไม่ใช้วงกลมเพราะการ์ด asset เรามีกรอบ/สถิติวาดในตัว ครอปวงกลมจะเห็นกรอบเพี้ยน ไม่มีไฟล์ headshot แยกให้ครอป

### `ListRow`
Avatar (mini-card chip) + title + muted subtitle + trailing chevron — แทน list แบบ plain ที่ `fantasy/leaderboard`, `fantasy/fixtures` ใช้อยู่

### `PageHeader`
Back arrow + title (+ optional trailing slot สำหรับ search/action icon) — แทน `← กลับ` link เปล่าๆ ที่ subpage ทุกหน้าใช้อยู่ตอนนี้

---

## 3. Patterns

### 3.1 Hero / Splash — **ลองแล้ว revert แล้ว (2026-07-23)**

รูปตัวอย่างใช้รูปถ่ายแอ็คชั่นนักกีฬาจริงเป็น hero — เราไม่มี asset แบบนั้น เคยลองใช้การ์งนักเตะ (Ronaldo, royalprime) ลอยตรงกลาง + `.glow-hero` + neon streak เฉียง (SVG 3 ชั้น) แทน ใส่ไว้ที่ `AuthForm.tsx` (`/login`, `/register`) และ `GuestHome` (`/` ตอนยังไม่ล็อกอิน) แต่ **ผู้ใช้ให้เอาออกทั้งหมดหลังเห็น preview จริง** — กลับไปเป็นแค่ headline gradient text + ฟอร์ม/ปุ่มเปล่าๆ แบบเดิมก่อนงานนี้ (ไม่มีรูปการ์ด/glow/streak ที่หน้า auth หรือ Home guest อีก)

สิ่งที่ยังอยู่จากความพยายามนี้: `Button variant="gradient"/"outline"` (ปุ่มคู่ pill CTA จากรูปตัวอย่าง Screen 1) — ใช้ต่อได้ปกติ ไม่เกี่ยวกับ hero image เอาแค่การ์ด/glow/streak ออกไป

**ถ้าจะลองใหม่ในอนาคต**: ไฟล์ที่เคยมี (`src/components/ui/HeroGlow.tsx`, `.glow-hero` utility) ถูกลบออกจากโค้ดแล้ว (ไม่มีใครเรียกใช้) ต้องสร้างใหม่ถ้าต้องการ ไม่ต้องพยายามกู้ของเดิม

### 3.2 Bento hub grid

Pattern ที่มีอยู่แล้วใน `club/page.tsx` และ `fantasy/page.tsx` (grid 2 คอลัมน์, การ์ด border+glow เบาๆ, stat ตัวใหญ่ข้างในทำหน้าที่ preview) — **ใกล้ภาษาเป้าหมายอยู่แล้วมากที่สุด** ให้ canonicalize เป็น pattern ทางการ (migrate ไปใช้ `Card`+`Stat` primitive) ไม่ต้อง redesign layout ใหม่

### 3.3 Segmented tabs

ใช้ `Tabs` primitive สำหรับ: filter ตำแหน่งใน `/collection` (ถ้าจะเพิ่ม), subpage navigation ของ Fantasy (ถ้าต้องการรวม tab แทนการแยก route — **หมายเหตุ: subpage ของ Fantasy เป็นคนละ route กันจริงๆ (`/fantasy/team`, `/fantasy/fixtures` ฯลฯ) เอกสารนี้แนะนำแค่ปรับ `PageHeader` ให้เป็น pattern เดียวกัน ไม่บังคับรวม route**

### 3.4 Bottom nav

`BottomNav.tsx` ปัจจุบัน active state = เปลี่ยนสีตัวอักษร/ไอคอนเฉยๆ (`text-primary`) — เพิ่ม:
- Active pill/indicator เบาๆ ด้านหลังไอคอน active
- Notification-dot convention (ใช้ badge pattern เดียวกับที่ `AppHeader.tsx` มีอยู่แล้วสำหรับกระดิ่ง) — เผื่อ nav item ไหนอยากมี unread indicator ในอนาคต ไม่บังคับต้องมีทุกแท็บตอนนี้

### 3.5 Pack reveal motion

`PackShop.tsx` ทำ pattern นี้ไว้ดีอยู่แล้ว (shake → staggered reveal → tier glow) — งานนี้แค่ tokenize glow เป็น `.glow-tier-*` utility (§1.3) และเปลี่ยนปุ่ม CTA เป็น `Button variant="gradient"` ไม่ต้องแตะ motion logic

---

## 4. Audit ต่อหน้าจอ

| โซน | ไฟล์ | ความใกล้ภาษาเป้าหมาย | สิ่งที่เปลี่ยน |
|---|---|---|---|
| Splash/Auth | `AuthForm.tsx`, `login/page.tsx`, `register/page.tsx` | ไกลสุด | ปุ่ม→pill gradient/outline (ทำแล้ว); **เคยลองเพิ่ม hero การ์ด+glow แล้ว revert ตามที่ผู้ใช้ขอ — ดู §3.1** |
| Home | `page.tsx` | กลาง | มี display title + bento แล้ว, ปุ่ม/การ์ด→primitive (ทำแล้ว); guest hero เคยลองแล้ว revert เช่นกัน |
| Store | `PackShop.tsx`, `pack/page.tsx` | กลาง | ปุ่ม→pill, คง reveal motion เดิม |
| PvP | `pvp/page.tsx`, `PvpMatch.tsx` | กลาง | CTA→pill, สกอร์→`Stat` |
| Fantasy hub | `fantasy/page.tsx` | ใกล้ | migrate ไปใช้ `Card`/`Stat` |
| Fantasy subpages | `fixtures`/`news`/`leaderboard`/`totw`/`team` | กลาง | `PageHeader` แทน `← กลับ`, `ListRow`+avatar chip |
| My Club hub | `club/page.tsx` | ใกล้ | migrate ไปใช้ `Card`/`Stat` |
| My Club subpages | `team/page.tsx`, `collection/page.tsx` | กลาง | `PageHeader`, คง grid การ์ดเดิม |
| Pack opening | `PackShop.tsx` overlay | ใกล้ | tokenize glow, ปุ่ม→pill |
| Bottom nav | `BottomNav.tsx` | กลาง | active indicator + badge convention |
| Header | `AppHeader.tsx` | ใกล้ | align token เท่านั้น |

---

## 5. แผน implementation (phased — ดู `docs/TASKS.md` ขั้น 13 สำหรับ checklist)

1. **Foundation** — `globals.css` (radius/glow/typography tokens)
2. **Primitives** — สร้าง `src/components/ui/` (`Button`/`Card`/`Stat`/`Tabs`/`Avatar`/`ListRow`/`PageHeader`) ยังไม่ wire เข้าหน้าไหน
3. **Global chrome** — `BottomNav.tsx`, `AppHeader.tsx`
4. **Hero/Splash** — `AuthForm.tsx`, Home hero block
5. **Hubs** — `fantasy/page.tsx`, `club/page.tsx`, Home shortcuts
6. **Store/PvP/Pack** — `PackShop.tsx`, `PvpMatch.tsx`
7. **Subpages & lists** — Fantasy subpages, `collection`, `team`

แต่ละ phase ที่แตะโค้ด: `npx tsx --test`, `npx tsc --noEmit`, `npm run build` ต้องผ่านสะอาดก่อนไป phase ถัดไป

---

## 6. Design System Reference Page — Hub Theme (2026-07-23)

หน้า `/design-system` เป็น living reference ของธีมปัจจุบัน โดยมีลักษณะเป็น **Club/Hub screen** ตามรูปตัวอย่าง EA Sports FC Companion App ที่ผู้ใช้ส่งมา:

### 6.1 Tokens เพิ่มเติม

| Token | ค่า | ใช้ทำอะไร |
|---|---|---|
| `--bg-deep` | `#05040a` | พื้นหลังจุดที่ต้องการความเข้มกว่า `--background` (หน้า hub / design-system page) |
| `--hub-grad-hi` | `#2f374c` | สีสว่างสุดของ gradient การ์ด (มุมขวาบน) |
| `--hub-grad-mid` | `#252b3a` | สีกลาง gradient การ์ด |
| `--hub-grad-lo` | `#151821` | สีเข้มสุดของ gradient การ์ด (มุมซ้ายล่าง) |
| `--hub-radius` | `28px` | ความมนของ hub card (ใหญ่กว่า `--radius-card`) |
| `--hub-border` | `rgba(255,255,255,0.06)` | ขอบจางของ hub card |
| `--badge-cyan` | `#0ea5e9` | badge สีฟ้า-เขียวมะนาวของ hub card |
| `--currency-gem` | `#34d399` | ไอคอน currency สีเขียว |
| `--currency-token` | `#f87171` | ไอคอน currency สีแดง |

### 6.2 Utility `.surface-hub`

```css
.surface-hub {
  position: relative;
  overflow: hidden;
  border-radius: var(--hub-radius);
  border: 1px solid var(--hub-border);
  background-image: linear-gradient(
    to bottom right,
    var(--hub-grad-hi) 0%,
    var(--hub-grad-mid) 50%,
    var(--hub-grad-lo) 100%
  );
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
  transition: filter 150ms ease;
}
.surface-hub:hover {
  filter: brightness(1.1);
}
```

สามารถซ้อน gradient overlay `from-white/[0.07]` ด้านบนซ้ายเพื่อเพิ่ม sheen ได้ตามต้องการ

### 6.3 Hub Card pattern

- การ์ดเป็นลิงก์ได้ (`href`) หรือ static container
- โครงสร้าง: `title` มุมซ้ายบน · ไอคอนสีขาวใหญ่กลางการ์ด · badge สี cyan มุมซ้ายล่าง (ถ้ามีจำนวน items)
- ไม่ใช้ border หนา — แยกการ์ดออกจากพื้นหลังด้วย gradient + shadow + hairline border จาง

### 6.4 Header / Currency Row

- Header แบบ app: ไอคอน settings ซ้าย · ชื่อหน้ากลาง · ไอคอน collection/bag ขวา
- Currency row ชิดขวา: ไอคอนกลมเล็ก + ตัวเลข เรียงกัน 3 สกุล (gold / gem / token)

## 7. Deferred / นอกสโคปตอนนี้

- **หน้า player detail (Overview/Stats tab ตามรูปตัวอย่าง Screen 2)** — ฟีเจอร์ใหม่ทั้งหน้า ไม่ใช่ reskin (route+query ใหม่) ตัดสินใจแยกออกไปทำหลัง primitive เสร็จ (จะเร็วกว่าเพราะมี `Stat`/`Tabs` ให้ประกอบแล้ว) หมายเหตุสำคัญ: ค่า PAC/SHO/PAS/DRI/DEF/PHY ที่จะโชว์เป็นเลข **derive จาก OVR** (`src/lib/cardgen.ts::generateStats`) ไม่ใช่ scouting data จริงต่อนักเตะแต่ละคน — ต้องสื่อสารตรงนี้ให้ชัดถ้าทำหน้านี้ในอนาคต
- **รูปถ่ายแอ็คชั่นนักเตะจริง** สำหรับ hero — ไม่มีตอนนี้ เตรียม slot ไว้ตาม §3.1 เฉยๆ
