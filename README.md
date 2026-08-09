# News Reaction Bot (Node.js version)

เวอร์ชัน JavaScript ของบอทตัวเดียวกัน — ใช้ Vercel Serverless Function (Node.js runtime)
ล้วนๆ ไม่มี Python เลย จึงไม่มีปัญหา Vercel ตรวจ Python runtime ไม่เจอ และไม่ต้องพึ่ง
dependency ภายนอกเลยสักตัว (ใช้ `fetch` ที่มีมากับ Node 18+ ทั้งหมด — ดึงปฏิทินข่าว,
ดึงราคาจาก Yahoo Finance chart API ตรงๆ, เรียก Upstash REST, ส่ง LINE)

## หลักการทำงาน — เหมือนเวอร์ชัน Python ทุกประการ
1. โหลดปฏิทินข่าวจาก Forex Factory (unofficial JSON feed) — cache ใน Redis 1 ชั่วโมง
2. ก่อนข่าวออก ~5 นาที เริ่มจับกรอบราคา (high/low) ของ 45 นาทีก่อนหน้า
3. หลังข่าวออก 3 นาที ถึง 15 นาที เช็คว่าราคา**ปิดแท่ง 5 นาที**เกินกรอบ + buffer 0.05% หรือยัง
4. ยืนยันแล้วส่ง LINE ครั้งเดียวต่อ event (กันยิงซ้ำผ่าน Redis state)

## ✅ ทดสอบแล้ว
- syntax ทุกไฟล์ผ่าน (`node -c`)
- ตรรกะ capture range + breakout confirmation ทดสอบด้วยข้อมูลราคาจำลอง 2 กรณี:
  ยืนยัน breakout ถูกต้อง และไม่ยิงสัญญาณหลอกตอนราคายังไม่ break
- pipeline เต็มรูปแบบทดสอบด้วย mock ทั้งปฏิทินข่าว+ราคา ครบทั้งกรณี "event เก่าเกิน confirm
  window" (ถูกปฏิเสธอย่างถูกต้อง) และกรณี "breakout จริงในช่วงเวลาที่ถูกต้อง" (ส่ง LINE
  message ที่ format ถูกต้องใน DRY_RUN mode)

**ทดสอบไม่ได้จริงจาก sandbox ของผม** (โดเมน `nfs.faireconomy.media` และ
`query1.finance.yahoo.com` ไม่อยู่ใน network allowlist ของผม — เป็นข้อจำกัดฝั่งผม ไม่ใช่ปัญหาโค้ด)
→ ให้รัน `test-local.js` จากเครื่องคุณเอง หรือ deploy ขึ้น Vercel แล้วยิง `/api/scan` ด้วยมือก่อน
ตั้ง cron จริงเสมอ

## Environment Variables (เหมือนเวอร์ชัน Python)
| ตัวแปร | คำอธิบาย |
|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | token ของ LINE OA |
| `LINE_TO_USER_ID` | user/group id ปลายทาง |
| `UPSTASH_REDIS_REST_URL` | ใช้ตัวเดียวกับ fx_pa_bot ได้ (prefix `newsreact:` แยกกันแล้ว) |
| `UPSTASH_REDIS_REST_TOKEN` | token ของ Upstash |
| `CRON_SECRET` | รหัสลับกันคนอื่นยิง endpoint |
| `DRY_RUN` | `true` ตอนทดสอบ (log แทนการยิง LINE จริง) |

## Deploy
1. Push โฟลเดอร์นี้ทั้งหมดขึ้น GitHub repo (ไม่ต้องมี `requirements.txt` แล้ว — Vercel จะ
   detect เป็น Node.js function จาก `api/scan.js` อัตโนมัติ ไม่มีทาง detect ผิดเป็น Python)
2. Import project ใน Vercel ตั้ง env vars (ตั้ง `DRY_RUN=true` ก่อน) แล้ว Deploy
3. ทดสอบยิง `https://<project>.vercel.app/api/scan?secret=...` ด้วยมือ
4. ตั้ง cron-job.org ยิง URL เดียวกันทุก 1 นาที
5. ดู log 2-3 วันตอน DRY_RUN=true แล้วค่อยเปลี่ยนเป็น false

## ทดสอบ local
```bash
DRY_RUN=true node test-local.js
```

## ปรับค่าได้ที่ `config.js` — พารามิเตอร์เดียวกับเวอร์ชัน Python ทุกตัว
