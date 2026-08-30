# Gold Sideway-Breakout Bot (H1 + M1)

บอทเช็คราคาทองคำ (GC=F บน Yahoo Finance, ใช้แทน XAUUSD) แล้วแจ้งเตือนผ่าน LINE OA
เมื่อทั้ง H1 และ M1 อยู่ในสภาวะ sideway พร้อมกัน แล้วราคาเบรคเอาท์ไปทางเดียวกัน

## ตรรกะการทำงาน (ต่อ 1 รอบ scan)

1. **เช็ค H1 sideway** — ดูกรอบราคา (high-low) ของ 20 แท่ง H1 ล่าสุด (ไม่รวมแท่งที่กำลังฟอร์มตัว)
   เทียบกับ ATR(14) ของ H1 ถ้ากรอบแคบกว่า ATR×2.5 ถือว่า sideway
   - ถ้า H1 ไม่ sideway → จบรอบ ไม่แจ้งเตือน
2. **เช็ค M1 sideway** — ทำแบบเดียวกันกับ H1 แต่ใช้ 30 แท่ง M1 ล่าสุด
   - ถ้า M1 ไม่ sideway → จบรอบ ไม่แจ้งเตือน
3. **เช็คทิศทางเบรคเอาท์** — เทียบราคาปิดของแท่งล่าสุด (H1 และ M1 แยกกัน) กับกรอบ sideway ของตัวเอง
   ถ้าเบรคเกินกรอบ (+buffer 0.05%) ทั้ง H1 และ M1 และเบรค**ทางเดียวกัน** (ขึ้นทั้งคู่ หรือ ลงทั้งคู่)
   → ส่งข้อความแจ้งเตือนเข้า LINE ทันที
4. **กันแจ้งซ้ำ** — จำเฉพาะแท่ง M1 ล่าสุด + ทิศทางที่เพิ่งแจ้งไป (เก็บใน Upstash Redis)
   ถ้ารอบถัดไปยังเป็นแท่งเดิม+ทิศทางเดิม จะไม่แจ้งซ้ำ แต่ถ้าเจอ sideway+breakout ใหม่อีกครั้ง
   (แท่งใหม่ หรือทิศทางเปลี่ยน) จะแจ้งเตือนซ้ำได้ตามปกติ

ข้อความแจ้งเตือนสั้น เช่น:

```
🥇 GOLD BREAKOUT 🔼 ขึ้น
H1 + M1 sideway แล้วเบรคทางเดียวกัน
ราคา: 2350.00
```

## โครงสร้างไฟล์

- `config.js` — ค่าคงที่ทั้งหมด (symbol, lookback, ATR period/multiplier, buffer, TTL ฯลฯ)
- `lib/priceData.js` — ดึงแท่งเทียนจาก Yahoo Finance chart API ตรงๆ (ไม่ต้องพึ่ง library)
- `lib/indicators.js` — คำนวณ ATR, เช็ค sideway, เช็คทิศทางเบรคเอาท์
- `lib/priceAction.js` — ผูก config เข้ากับ indicators สำหรับ H1 และ M1
- `lib/scanRunner.js` — orchestration หลักของ 1 รอบ scan (H1 → M1 → breakout → กันแจ้งซ้ำ → LINE)
- `lib/redisState.js` — เก็บ state (แท่ง/ทิศทางล่าสุดที่แจ้งไปแล้ว) ผ่าน Upstash Redis REST API
- `lib/lineNotify.js` — ส่งข้อความ LINE Messaging API (push)
- `api/scan.js` — endpoint ที่ cron-job.org เรียก (`GET /api/scan?secret=CRON_SECRET`)
- `test-local.js` — ทดสอบ H1/M1/runScan ด้วยข้อมูลจริงแบบ DRY_RUN (ไม่ยิง LINE จริง)

## รันทดสอบก่อนใช้จริง (ทดลองก่อนรันจริงเสมอ)

```bash
DRY_RUN=true node test-local.js
```

จะพิมพ์ผลวิเคราะห์ H1/M1 (sideway หรือไม่, กรอบราคา, ATR) และผล `runScan()` แบบเต็ม
โดยไม่ส่งข้อความ LINE จริง (แค่ log ข้อความที่ *จะ* ส่ง)

หมายเหตุ: ถ้ารันจากเครื่อง/สภาพแวดล้อมที่เข้าถึง Yahoo Finance ไม่ได้ (เช่นถูกบล็อก)
จะเจอ error `HTTP 403` หรือ fetch ล้มเหลว — ต้องรันจากเครื่อง/serverless ที่เข้าถึงอินเทอร์เน็ตทั่วไปได้ปกติ

## Environment variables (ตั้งใน Vercel)

- `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_TO_USER_ID` — ส่ง LINE
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — เก็บ state กันแจ้งซ้ำ
- `CRON_SECRET` — ป้องกัน endpoint ถูกยิงมั่ว
- `DRY_RUN` — ตั้ง `true` เพื่อทดสอบโดยไม่ส่ง LINE จริง (ปกติปล่อยว่าง/false บน production)

## การปรับความไว (tuning)

ถ้าบอทแจ้งเตือนถี่/น้อยเกินไป ปรับใน `config.js`:

- `H1_SIDEWAY_ATR_MULT` / `M1_SIDEWAY_ATR_MULT` — ค่ายิ่งน้อย ยิ่งเข้มงวด (ต้อง sideway แคบจริงๆ ถึงจะนับ)
- `H1_LOOKBACK` / `M1_LOOKBACK` — จำนวนแท่งที่ใช้หากรอบ sideway
- `BREAKOUT_BUFFER_PCT` — ต้องเบรคเกินกรอบกี่% ถึงนับว่าเบรคจริง (กันสัญญาณหลอกจากการแกว่งเล็กน้อย)
