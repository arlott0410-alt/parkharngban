# Phajay — ຄວາມເຂົ້າໃຈ ແລະ ການເຊື່ອມກັບລະບົບປ້າຂ້າງບ້ານ

## Phajay ໃຊ້ເຮັດຫຍັງໄດ້ (ໃນໂປຣເຈັກນີ້)

**Phajay** ແມ່ນ **payment gateway ສຳລັບເງິນກີບ (LAK)** ຂອງລາວ — ບໍ່ແມ່ນລະບົບສະມາຊິກຂອງແອັບເຮົາໂດຍກົງ

ສິ່ງທີ່ໂຄ້ດເຮົາໃຊ້ຈາກ Phajay ມີຫຼັກໆ:

| ຄວາມສາມາດ | API ໃນໂຄ້ດ | ໃຊ້ເຮັດຫຍັງ |
|-----------|------------|-------------|
| **BCEL Subscription QR** | `POST .../subscription/generate-bcel-qr` | ສ້າງ **QR / ລິ້ງ** ໃຫ້ລູກຄ້າສະແກນຈ່າຍ — ຈຳນວນເງິນຕາມແຜນທີ່ເລືອກ (1/5/10 ເດືອນຂອງລາຄາ) |
| **Payment link** (ທາງເລືອກ) | `POST .../link/payment-link` | ສ້າງລິ້ງຊຳລະຄັ້ງດຽວ (ມີ success/cancel/webhook) — ຕອນນີ້ສາຍຫຼັກຂອງສະມາຊິກແມ່ນ **QR subscription** |
| **Webhook** | ຮັບ POST ຈາກ Phajay | ແຈ້ງວ່າຊຳລະສຳເລັດ — ເຮົາໃຊ້ເປີດສະມາຊິກໃນ **Supabase** |

ສິ່ງທີ່ **ບໍ່** ແມ່ນຫນ້າທີ່ຂອງ Phajay:

- ກຳນົດວ່າຜູ້ໃຊ້ໃຊ້ແອັບໄດ້ກີ່ວັນ / ກີ່ເດືອນ → **ກຳນົດຢູ່ລະບົບເຮົາ** (`payment_details.duration_days` + `expiry_date`)
- ທົດລອງ 7 ວັນ, ສິດເຂົ້າ Mini App → **Telegram + DB ຂອງເຮົາ**

---

## ກະແສການເຊື່ອມຕໍ່ (ຫຼັກການ)

```
ຜູ້ໃຊ້ເລືອກແຜນ (1m / 6m / 12m)
        │
        ▼
POST /api/phajay/create-subscription
        │  ──► Phajay: generate-bcel-qr (maxAmount = ຍອດຕາມແຜນ)
        │  ──► ບັນທຶກ subscriptions: payment_ref = transactionId,
        │                    payment_details = { duration_days, plan, ... }
        ▼
ລູກຄ້າສະແກນ / ຈ່າຍສຳເລັດ
        │
        ▼
Phajay POST → /api/phajay/webhook  (status ປະມານ SUBSCRIPTION_SUCCESS)
        │  ──► ອັບເດດ subscription: active, started_at, expiry_date = started_at + duration_days
        ▼
ຜູ້ໃຊ້ໃຊ້ງານແອັບຕາມວັນໝົດອາຍຸທີ່ເຮົາຄິດໄລ່
```

ເສັ້ນທາງເສີມ (ຖ້າ Phajay ສົ່ງ):

- `POST /api/phajay/subscription-setup` — ເຫດ `SUBSCRIPTION_CONNECTED` (ເຊື່ອມຕໍ່ບັນຊີ subscription) — ໂຄ້ດແຄ່ acknowledge / ອັບເດດ `updated_at`

---

## ສິ່ງທີ່ຕ້ອງຕັ້ງຄ່ານອກຈາກໂຄ້ດ

1. **Environment** — ເບິ່ງ `.env.example` (ຫຼື Cloudflare Pages):
   - `PHAJAY_SECRET_KEY`, `PHAJAY_API_URL`, `PHAJAY_WEBHOOK_SECRET`, `PHAJAY_MODE`, `PHAJAY_MERCHANT_ID` (ຖ້າຕ້ອງໃຊ້ກັບ payment-link)
   - **`APP_URL`** ຫຼື **`NEXT_PUBLIC_APP_URL`** = URL ຈຣິງຂອງແອັບ (ໃຊ້ສ້າງ URL webhook ທີ່ຖືກຕ້ອງ)

2. **ໃນແຜງຄວບຄຸມ Phajay (merchant)** — ລົງທະບຽນ **Webhook URL** ໃຫ້ກົງກັບໂດເມນເຮົາ ຕົວຢ່າງ:
   - `https://<ໂດເມນຂອງເຈົ້າ>/api/phajay/webhook`
   - ຖ້າເອກະສານ Phajay ແຍກ URL ສຳລັບ “subscription setup” ໃຫ້ໃຊ້:  
     `https://<ໂດເມນຂອງເຈົ້າ>/api/phajay/subscription-setup`

3. **ລາຍເຊັນ webhook** — ຕັ້ງ `PHAJAY_WEBHOOK_SECRET` ໃຫ້ກົງກັບທີ່ຕັ້ງໃນ Phajay (ໂຄ້ດກວດ `x-phajay-signature` / `x-signature`)

---

## ອ້າງອີງໂຄ້ດ

| ໄຟລ໌ | ໜ້າທີ່ |
|------|--------|
| `lib/phajay.ts` | ເອີ້ນ API Phajay, ກວດລາຍເຊັນ webhook, ຄິດລາຄາແຜນ |
| `lib/subscription-plans.ts` | ນິຍາມແຜນ 1m / 6m / 12m ແລະ `duration_days` ຝັ່ງເຮົາ |
| `app/api/phajay/create-subscription/route.ts` | ສ້າງ QR + ບັນທຶກ pending subscription |
| `app/api/phajay/webhook/route.ts` | ຮັບຊຳລະສຳເລັດ → ເປີດສະມາຊິກຕາມ `duration_days` |
| `app/api/phajay/subscription-setup/route.ts` | ຮັບເຫດເຊື່ອມຕໍ່ subscription (ຖ້າມີ) |

---

## ສະຫຼຸບສັ້ນ

- **Phajay** = ຮັບເງິນ + ແຈ້ງເຕືອນຜ່ານ webhook  
- **ລະບົບເຮົາ** = ແຜນລາຄາ, ຈຳນວນວັນໃຊ້ງານ, ສະຖານະ active/expired ໃນ **Supabase**

ຖ້າປ່ຽນໂດເມນ ຫຼື deploy ໃໝ່ — ກວດ `APP_URL` ແລະ **ອັບເດດ webhook URL ໃນ Phajay** ທຸກຄັ້ງ.
