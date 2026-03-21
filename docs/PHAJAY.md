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

## Test vs Production (`PHAJAY_MODE`)

| ຄ່າ | ຄວາມໝາຍ |
|-----|---------|
| `PHAJAY_MODE=test` | ໃຊ້ **Test / Sandbox keys** — ຊຳລະທົດລອງ (ຍອດ 1 ກີບໃນໂຄ້ດ) |
| `PHAJAY_MODE=production` | ໃຊ້ **Production keys** — ຫຼັງ KYC; ຕ້ອງມີ webhook secret |

ລຳດັບການເລືອກ API key (ເບິ່ງ `lib/phajay-env.ts`):

- Test: `PHAJAY_SECRET_KEY_TEST` → ຫຼື `PHAJAY_SECRET_KEY`
- Production: `PHAJAY_SECRET_KEY_PRODUCTION` → ຫຼື `PHAJAY_SECRET_KEY`

Webhook HMAC (`x-phajay-signature`):

- Test: `PHAJAY_WEBHOOK_SECRET_TEST` → ຫຼື `PHAJAY_WEBHOOK_SECRET`
- Production: `PHAJAY_WEBHOOK_SECRET_PRODUCTION` → ຫຼື `PHAJAY_WEBHOOK_SECRET`

ທົດສອບໃນ test ໂດຍບໍ່ມີ webhook secret (ບໍ່ແນະນຳ): ຕັ້ງ `PHAJAY_ALLOW_UNSIGNED_WEBHOOKS=true` **ສະເພາະຊົ່ວຄາວ**. Production ຕ້ອງມີ secret ຫຼືຈະໄດ້ HTTP 503.

**ບໍ່ commit key ຈຣິງລົງ Git** — ໃສ່ໃນ Cloudflare / `.env.local` ຢ່າງດຽວ.

---

## ສິ່ງທີ່ຕ້ອງຕັ້ງຄ່ານອກຈາກໂຄ້ດ

1. **Environment** — ເບິ່ງ `.env.example` (ຫຼື Cloudflare Pages):
   - `PHAJAY_MODE`, `PHAJAY_SECRET_KEY_TEST`, `PHAJAY_SECRET_KEY_PRODUCTION`, `PHAJAY_SECRET_KEY` (fallback)
   - `PHAJAY_WEBHOOK_SECRET_TEST`, `PHAJAY_WEBHOOK_SECRET_PRODUCTION`, `PHAJAY_WEBHOOK_SECRET`
   - `PHAJAY_API_URL` ຫຼື `PHAJAY_API_URL_TEST` / `PHAJAY_API_URL_PRODUCTION` (ຖ້າ endpoint ຕ່າງກັນ)
   - `PHAJAY_MERCHANT_ID` (ຖ້າຕ້ອງໃຊ້ກັບ payment-link)
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
| `lib/phajay-env.ts` | ແຍກ Test/Production, ເລືອກ API key ແລະ webhook secret |
| `lib/phajay.ts` | ເອີ້ນ API Phajay, ກວດລາຍເຊັນ webhook (HMAC, timing-safe), ຄິດລາຄາແຜນ |
| `lib/subscription-plans.ts` | ນິຍາມແຜນ 1m / 6m / 12m ແລະ `duration_days` ຝັ່ງເຮົາ |
| `app/api/phajay/create-subscription/route.ts` | ສ້າງ QR + ບັນທຶກ pending subscription |
| `app/api/phajay/webhook/route.ts` | ຮັບຊຳລະສຳເລັດ → ເປີດສະມາຊິກຕາມ `duration_days` |
| `app/api/phajay/subscription-setup/route.ts` | ຮັບເຫດເຊື່ອມຕໍ່ subscription (ຖ້າມີ) |

---

## ສະຫຼຸບສັ້ນ

- **Phajay** = ຮັບເງິນ + ແຈ້ງເຕືອນຜ່ານ webhook  
- **ລະບົບເຮົາ** = ແຜນລາຄາ, ຈຳນວນວັນໃຊ້ງານ, ສະຖານະ active/expired ໃນ **Supabase**

ຖ້າປ່ຽນໂດເມນ ຫຼື deploy ໃໝ່ — ກວດ `APP_URL` ແລະ **ອັບເດດ webhook URL ໃນ Phajay** ທຸກຄັ້ງ.
