# Deploy Guide

## 1. รันเอง (Local)

**แบบ Docker** (แนะนำ)

```bash
# สร้าง .env
cp .env.docker.example .env
# แก้ APIFY_API_TOKEN=<token จริง>

docker compose up --build
```

- Frontend → http://localhost:3000
- Backend → http://localhost:8001
- Database อยู่ที่ `backend/data/snapshots.db` บน host ตรงๆ ไม่หายเมื่อ restart

**แบบ Dev** (แก้ code แล้วเห็นทันที)

```bash
# Terminal 1
cd backend && uvicorn main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

> ⚠️ ไม่มี auto-scheduler — เสียเงิน Apify เฉพาะตอนกดปุ่มบนหน้าเว็บเท่านั้น

---

## 2. ส่งให้คนอื่น Deploy (ห้ามให้ Token หลุด)

Database แนบมาในตัว repo แล้ว — เป็น **seed บีบอัด** ที่ `backend/seed/snapshots.db.gz`
(มีแต่ทวีตสาธารณะ ไม่มี token/secret). ส่งแค่ลิงก์ repo อย่างเดียว ไม่ต้องส่งไฟล์แยก ไม่ต้องส่ง `.env`

**คนรับทำ:**

```bash
git clone https://github.com/Sirapakit/social-listening-bkk-election.git
cd social-listening-bkk-election

# คลาย seed → backend/data/snapshots.db
python3 scripts/restore_snapshot.py
# (ถ้าไม่มี python: gunzip -c backend/seed/snapshots.db.gz > backend/data/snapshots.db)

# readonly mode — ไม่ต้องมี API token เลย
echo "READONLY_MODE=true" > .env

docker compose up --build
```

เปิด http://localhost:3000 → ดูข้อมูลได้ ปุ่ม scrape ทุกปุ่มหายหมด

> 🔄 **อัปเดตข้อมูล (เจ้าของ repo):** หลัง scrape เสร็จ ทำ 3 ขั้น
> ```bash
> .venv/bin/python scripts/export_snapshot.py     # บีบ DB → backend/seed/snapshots.db.gz
> git add backend/seed/snapshots.db.gz
> git commit -m "data: refresh snapshot" && git push
> ```
> ฝั่งคนรับแค่ `git pull` แล้ว `python3 scripts/restore_snapshot.py --force` ก็ได้ข้อมูลใหม่

---

## 3. แก้ Frontend ต่อ

**Tech stack:** Next.js 16 · TypeScript · Tailwind CSS · Recharts · Lucide icons · React Context i18n

**ไฟล์สำคัญ:**

```
frontend/src/
├── app/
│   ├── page.tsx          ← หน้าหลัก (ประกอบร่างทุก component)
│   └── globals.css       ← สี / dark mode / animation tokens
├── components/           ← ทุก card/chart/widget แยกไฟล์
│   ├── ControlsBar.tsx   ← keyword + date + scrape buttons
│   ├── CoverageBar.tsx   ← calendar grid
│   ├── BuzzTimeline.tsx  ← timeline chart
│   ├── ShareOfVoice.tsx
│   ├── KeywordPanel.tsx  ← per-candidate detail
│   └── ...
└── lib/
    ├── i18n.tsx    ← ✏️ ข้อความ TH/EN ทั้งหมดอยู่ที่นี่ไฟล์เดียว
    ├── types.ts    ← TypeScript types (mirror จาก backend)
    └── api.ts      ← ฟังก์ชันเรียก backend
```

**Workflow:**

```bash
cd frontend
npm install
npm run dev          # hot reload ที่ localhost:3000
npm run build        # ตรวจ TypeScript errors ก่อน push
```

**Pattern ที่ใช้ทุก component:**

```tsx
"use client";
import { useT } from "@/lib/i18n";

export function MyComponent() {
  const { t } = useT();   // ได้ทั้ง TH และ EN อัตโนมัติ
  return <div>{t.someKey}</div>;
}
```

**เพิ่มข้อความ TH/EN:** แก้ไฟล์เดียวที่ `src/lib/i18n.tsx` — object `th` และ `en` ต้องมี key ตรงกัน TypeScript จะฟ้องถ้า miss
