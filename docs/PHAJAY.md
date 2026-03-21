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
        │  ──► ບັນທຶກ subscriptions: status = pending, payment_ref = transactionId,
        │                    payment_details = { plan, months_covered, duration_days, bcel, ... }
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
| `PHAJAY_MODE=test` | ໃຊ້ **Test / Sandbox keys** — ຍອດຕໍ່ເດືອນຈາກ **`SUBSCRIPTION_TEST_AMOUNT`** (default **500** ກີບ) |
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

## ລາຄາສະມາຊິກ: Test vs Production

ທັງສອງໂໝດໃຊ້ສູດດຽວກັນ: **`ລາຄາຕໍ່ເດືອນ` × ເດືອນທີ່ຈ່າຍ** (`getSubscriptionAmountLakForPlan`). Test: **`SUBSCRIPTION_TEST_AMOUNT`** (default **500**); Production: **`SUBSCRIPTION_PRICE_LAK`** (default **50000** ກີບ/ເດືອນ).

| `PHAJAY_MODE` | ຄຳອະທິບາຍ |
|---------------|------------|
| `test` | ຍັງໃຊ້ລາຄາຈາກ env (ບໍ່ບັງຄັບ 1 ກີບອີກຕໍ່ໄປ) — log ເຕືອນໃນ server |
| `production` | ຄືກັນ — ຕັ້ງ `SUBSCRIPTION_PRICE_LAK` ໃຫ້ສູງພໍສຳລັບຊີວິດຈຣິງ |

ຕົວຢ່າງ `SUBSCRIPTION_PRICE_LAK=50000`:

| ແຜນ | ເດືອນທີ່ຈ່າຍ | ຍອດ LAK |
|-----|-------------|---------|
| 1m | 1 | 50,000 |
| 6m | 5 | 250,000 |
| 12m | 10 | 500,000 |

## BCEL generate-bcel-qr (ປັບປຸງ 2025)

1. **ລຸ້ນໃໝ່:** `Authorization: Basic base64(secretKey + ':')`, body `{ amount, duration_months, reference, callback_url }` → ຕອບອາດມີ `qr_image_url`, `qr_data`, `transaction_id`.
2. **ລຸ້ນເກົ່າ (fallback):** header `secretKey`, body `maxAmount`, `subscriptionDate`, `resubscriptionDays` — ຖ້າລຸ້ນໃໝ່ບໍ່ຮັບ ຫຼືຂາດ QR ລະບົບລອງ legacy ອັດຕະໂນມັດ.

ປ່ຽນລາຄາຕໍ່ເດືອນ: ຕັ້ງ **`SUBSCRIPTION_PRICE_LAK`** ໃນ env (ຕົວເລກດຽວ — ທັງ UI ຜ່ານ `/api/mini-app/profile` ແລະການຊຳລະຈິງ).

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

## ຖ້າ QR ສຳເລັດ (200) ແຕ່ subscription ຍັງ inactive

**ສາເຫດທົ່ວໄປ:** ການສ້າງ QR ສຳເລັດແມ່ນແຄ່ຂັ້ນຕອນທີ 1 — ການເປີດສະມາຊິກອັດຕະໂນມັດຕ້ອງໄດ້ຮັບ **POST webhook** ຫຼັງລູກຄ້າໂອນຈິງ. ຖ້າບໍ່ມີ webhook ຫຼືກວດບໍ່ຜ່ານ ສະຖານະຈະບໍ່ປ່ຽນ.

| ກວດ | ລາຍລະອຽດ |
|-----|-----------|
| **Webhook URL** | ຕ້ອງກົງກັບ `APP_URL` / ໂດເມນທີ່ deploy — ຕົວຢ່າງ `https://<domain>/api/phajay/webhook` ລົງທະບຽນໃນແຜງ Phajay |
| **ລາຍເຊັນ** | ຖ້າ `x-phajay-signature` ບໍ່ກົງກັບ `PHAJAY_WEBHOOK_SECRET_*` ຈະໄດ້ 401 — ບໍ່ມີການອັບເດດ DB. Test ຊົ່ວຄາວ: `PHAJAY_ALLOW_UNSIGNED_WEBHOOKS=true` (ບໍ່ໃຊ້ production) |
| **ຮູບແບບ payload** | ໂຄ້ດຮອງຮັບ `status` / `message` / `data.*` ແລະຫຼາຍຊ່ອງ `transactionId` — ຖ້າຍັງບໍ່ຂຶ້ນ active ເບິ່ງ log server ບັນທຶກ `webhook: ignored` ຫຼື `no pending subscription` |
| **payment_ref** | ຕ້ອງກົງກັບ `transactionId` ທີ່ Phajay ສົ່ງຕອນໂອນສຳເລັດ (ຫຼືກົງກັບ `payment_details.bcel.transactionId`) |

---

## ອ້າງອີງໂຄ້ດ

| ໄຟລ໌ | ໜ້າທີ່ |
|------|--------|
| `lib/phajay-env.ts` | ແຍກ Test/Production, ເລືອກ API key ແລະ webhook secret |
| `lib/phajay.ts` | ເອີ້ນ API Phajay, ກວດລາຍເຊັນ webhook (HMAC, timing-safe), ຄິດລາຄາແຜນ |
| `lib/subscription-plans.ts` | ນິຍາມແຜນ 1m / 6m / 12m ແລະ `duration_days` ຝັ່ງເຮົາ |
| `app/api/phajay/create-subscription/route.ts` | ສ້າງ QR + ບັນທຶກ pending subscription |
| `app/api/phajay/webhook/route.ts` | ຮັບຊຳລະສຳເລັດ → `active` + `expiry_date` ຕາມເດືອນຂອງແຜນ (calendar months) |
| `lib/phajay-webhook.ts` | ກວດຄວາມສຳເລັດ (ລວມ message ທີ່ມີ SUCCESS) + ລວບລວມ transaction / subscription id |
| `lib/subscription-expiry.ts` | ຄິດ `expiry_date` (ເລີ່ມຕົ້ນ ຫຼືຕໍ່ອາຍຸ recurring) |
| `app/api/mini-app/subscription-status/route.ts` | ກວດສະຖານະ subscription ຈາກ Supabase (ຫຼັງຊຳລະ) |
| `app/api/phajay/subscription-setup/route.ts` | ຮັບເຫດເຊື່ອມຕໍ່ subscription (ຖ້າມີ) |

---

## ສະຫຼຸບສັ້ນ

- **Phajay** = ຮັບເງິນ + ແຈ້ງເຕືອນຜ່ານ webhook  
- **ລະບົບເຮົາ** = ແຜນລາຄາ, ຈຳນວນວັນໃຊ້ງານ, ສະຖານະ active/expired ໃນ **Supabase**

ຖ້າປ່ຽນໂດເມນ ຫຼື deploy ໃໝ່ — ກວດ `APP_URL` ແລະ **ອັບເດດ webhook URL ໃນ Phajay** ທຸກຄັ້ງ.
