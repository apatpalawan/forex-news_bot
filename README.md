# forex-news_bot v2 — EMA50x100 → EMA9x20 + RSI (M1 only)

บอทนี้แทนที่ระบบเดิม (ข่าว/H1+M1 sideway) ทั้งหมด ด้วยเงื่อนไขใหม่ ทำงานบนกราฟ **M1 เท่านั้น**:

1. **EMA50 ตัดกับ EMA100** เกิดก่อน (บอกทิศทางเทรนด์หลัก ขึ้นหรือลง)
2. หลังจากนั้น **EMA9 ตัดกับ EMA20** ในทิศทางเดียวกัน (ภายใน `MAX_BARS_BETWEEN_CROSSES` แท่ง = ค่าเริ่มต้น 30 แท่ง) — นี่คือจังหวะยิงสัญญาณ (แท่งล่าสุดที่ปิดแล้วเท่านั้น)
3. **RSI(14)** ต้องยืนยันทิศทางเดียวกัน: ขาขึ้นต้อง RSI > 50 และกำลังขึ้น, ขาลงต้อง RSI < 50 และกำลังลง

ครบทั้ง 3 เงื่อนไข (AND ทั้งหมด) → ส่ง LINE ทันที ข้อความสั้น ประหยัดโควต้า เช่น

```
🟢 BUY XAUUSD (M1)
EMA50x100 → EMA9x20 + RSI ยืนยันทิศทางเดียวกัน
ราคา: 2385.20  RSI: 61.2
```

สแกน **ทองคำ + คู่เงินหลัก 7 คู่** (XAUUSD, EURUSD, GBPUSD, USDJPY, USDCHF, AUDUSD, USDCAD, NZDUSD) — แก้ได้ที่ `config.js` → `SYMBOLS`

สัญญาณเดิม (สัญลักษณ์+ทิศทาง+แท่งเวลาเดียวกัน) จะไม่ส้งซ้ำ (dedup ผ่าน Upstash Redis) แต่ถ้ามีสัญญาณใหม่เกิดขึ้นอีกครั้งภายหลัง จะส่งซ้ำได้ตามปกติ

## ไฟล์ในโปรเจกต์

```
config.js              พารามิเตอร์กลยุทธ์/สัญลักษณ์/env
lib/indicators.js       EMA, RSI (Wilder)
lib/strategy.js          ตรรกะหลัก: หา cross, เช็คหน้าต่างเวลา, เช็ค RSI
lib/dataFetcher.js       ดึงแท่งเทียน M1 จาก Yahoo Finance (ตัดแท่งที่ยังไม่ปิดทิ้งเสมอ)
lib/redisState.js        กันส่งซ้ำผ่าน Upstash Redis REST
lib/lineNotify.js        สร้างข้อความ + ส่ง LINE push
api/scan.js              Vercel Function entry point
test-local.js            ชุดทดสอบ offline (ไม่ต้องต่อเน็ต) — รันก่อนทุกครั้ง
```

## ก่อน deploy: ทดสอบก่อนเสมอ

```bash
npm test
```

ชุดทดสอบนี้ตรวจ EMA/RSI เทียบกับสูตรอ้างอิงอิสระ, ตรวจตรรกะจับจังหวะตัดกัน (cross)
ด้วยข้อมูลจำลอง, ตรวจทุกเงื่อนไขแยก (ไม่ครบเงื่อนไข → ไม่ส่งสัญญาณ, ครบ 3 เงื่อนไข →
ส่งสัญญาณ) และตรวจสถานการณ์จริงทั้งขาขึ้น/ขาลงด้วยราคาจำลองที่คำนวณ EMA/RSI จริง —
**ไม่มีการต่อ Yahoo Finance / Redis / LINE จริงในชุดทดสอบนี้** เพราะทดสอบแบบ offline
ล้วน ๆ ตามที่ต้องการให้ทดลองก่อนรันจริงเสมอ

## ตั้งค่า Environment Variables (Vercel dashboard → Settings → Environment Variables)

| ตัวแปร | คำอธิบาย |
|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | token ของ LINE OA "FX ข่าวเรดาร์" (มีอยู่แล้ว) |
| `LINE_TO_USER_ID` | userId/target ที่จะส่งข้อความหา |
| `UPSTASH_REDIS_REST_URL` | จาก database `forex_news_bot` เดิม |
| `UPSTASH_REDIS_REST_TOKEN` | จาก database `forex_news_bot` เดิม |
| `CRON_SECRET` | ค่าลับกันคนอื่นยิง endpoint ได้ |
| `DRY_RUN` | ตั้งเป็น `true` ตอนทดสอบรอบแรก (ไม่ส่ง LINE จริง แค่ log) |

## ขั้นตอน deploy

1. รัน `npm test` ให้ผ่านทั้งหมดก่อน
2. copy ไฟล์ทั้งหมดในนี้ทับของเดิมใน repo `apatpalawan/forex-news_bot` (ลบไฟล์เก่าที่เป็นระบบข่าว/calendar ทิ้งได้เลย เพราะแทนที่ทั้งหมดแล้ว)
3. commit + push ขึ้น GitHub
4. Vercel จะ deploy อัตโนมัติ (ถ้าเชื่อม repo ไว้แล้ว) — ตรวจ env vars ด้านบนให้ครบ
5. ตั้ง `DRY_RUN=true` ก่อน แล้วยิงทดสอบ:
   `https://<โดเมน-deploy>/api/scan?secret=<CRON_SECRET>`
   ควรได้ JSON `{"status":"ok","checked":[...],"alerts":[...]}` โดยดู log ใน Vercel ว่ามีข้อความ `[DRY_RUN] Would send LINE message` ตอนเจอสัญญาณ
6. เมื่อมั่นใจแล้ว ปิด `DRY_RUN` (ลบตัวแปรหรือใส่ `false`)
7. ตั้ง cron ที่ cron-job.org ให้ยิง URL เดิม **ทุก 1 นาที** (เพราะเป็นสัญญาณ M1 ต้องการความสด) ไปที่ `/api/scan?secret=...`

## หมายเหตุสำคัญ

- ทุกอย่างอิงกราฟ **M1 เท่านั้น** ตามที่ระบุ ไม่มีการดูไทม์เฟรมอื่นเลย
- แท่งสุดท้ายที่ยังไม่ปิด (กำลังก่อตัว) จะถูกตัดทิ้งเสมอก่อนคำนวณ เพื่อไม่ให้สัญญาณเปลี่ยนไปมาระหว่างแท่งยังไม่ปิด
- คู่เงิน forex ส่วนใหญ่บน Yahoo Finance ไม่มีข้อมูล Volume จริง (OTC) — กลยุทธ์นี้ไม่ได้ใช้ Volume เลย จึงไม่กระทบ
- ถ้าอยากปรับความไว เช่น `MAX_BARS_BETWEEN_CROSSES` (ระยะห่างสูงสุดระหว่างสอง cross) หรือ `RSI_SLOPE_LOOKBACK` แก้ได้ที่ `config.js`
