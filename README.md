# forex-news_bot v2 — EMA100x300 + RSI (M5 only)

บอทนี้แทนที่ระบบเดิมทั้งหมด ด้วยเงื่อนไขใหม่ ทำงานบนกราฟ **M5 เท่านั้น**:

1. **EMA100 ตัดกับ EMA300** ที่แท่งล่าสุดที่ปิดแล้วเท่านั้น (ไม่ว่าจะขึ้นหรือลง)
2. **RSI(14)** ต้องยืนยันทิศทางเดียวกัน: ขาขึ้นต้อง RSI > 50 และกำลังขึ้น, ขาลงต้อง RSI < 50 และกำลังลง

ครบทั้ง 2 เงื่อนไข (AND) → ส่ง LINE ทันที ข้อความสั้นมาก ประหยัดโควต้า เช่น

```
🔴 Sell USDCHF
```
หรือ
```
🟢 Buy XAUUSD
```

สแกน **ทองคำ + คู่เงินหลัก 7 คู่** (XAUUSD, EURUSD, GBPUSD, USDJPY, USDCHF, AUDUSD, USDCAD, NZDUSD) — แก้ได้ที่ `config.js` → `SYMBOLS`

สัญญาณเดิม (สัญลักษณ์+ทิศทาง+แท่งเวลาเดียวกัน) จะไม่ส้งซ้ำ (dedup ผ่าน Upstash Redis) แต่ถ้ามีสัญญาณใหม่เกิดขึ้นอีกครั้งภายหลัง จะส่งซ้ำได้ตามปกติ

## ไฟล์ในโปรเจกต์

```
config.js              พารามิเตอร์กลยุทธ์/สัญลักษณ์/env
lib/indicators.js       EMA, RSI (Wilder)
lib/strategy.js          ตรรกะหลัก: หา EMA100x300 cross ที่แท่งล่าสุด แล้วเช็ค RSI
lib/dataFetcher.js       ดึงแท่งเทียน M5 จาก Yahoo Finance (ตัดแท่งที่ยังไม่ปิดทิ้งเสมอ)
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
ด้วยข้อมูลจำลอง, ตรวจทุกเงื่อนไขแยก (ไม่ครบเงื่อนไข → ไม่ส่งสัญญาณ, ครบ 2 เงื่อนไข →
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
7. ตั้ง cron ที่ cron-job.org ให้ยิง URL เดิม ไปที่ `/api/scan?secret=...` **ทุก 5 นาที** (แท่ง M5 ใหม่จะปิดทุก 5 นาทีพอดี ยิงถี่กว่านั้นไม่ได้ประโยชน์เพิ่ม)

## หมายเหตุสำคัญ

- ทุกอย่างอิงกราฟ **M5 เท่านั้น** ตามที่ระบุ ไม่มีการดูไทม์เฟรมอื่นเลย
- แท่งสุดท้ายที่ยังไม่ปิด (กำลังก่อตัว) จะถูกตัดทิ้งเสมอก่อนคำนวณ เพื่อไม่ให้สัญญาณเปลี่ยนไปมาระหว่างแท่งยังไม่ปิด
- คู่เงิน forex ส่วนใหญ่บน Yahoo Finance ไม่มีข้อมูล Volume จริง (OTC) — กลยุทธ์นี้ไม่ได้ใช้ Volume เลย จึงไม่กระทบ
- ถ้าอยากปรับความไว เช่น `RSI_SLOPE_LOOKBACK` (จำนวนแท่งย้อนหลังที่เช็คว่า RSI ยังเอียงทิศทางเดิม) แก้ได้ที่ `config.js`
