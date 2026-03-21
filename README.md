# ປ້າຂ້າງບ້ານ (Pah-Khaang-Baan)

> AI-powered income/expense tracker for Lao people via Telegram Mini App.  
> ຕິດຕາມລາຍຮັບ-ລາຍຈ່າຍດ້ວຍ AI ພາສາລາວ | ຄ່າບໍລິການ 30,000 ກີບ/ເດືອນ

---

## Stack

- **Frontend**: Next.js 15 App Router + TypeScript + Tailwind CSS + shadcn/ui
- **Database**: Supabase (PostgreSQL + Row Level Security)
- **AI**: Google Gemini API (Lao language NLP)
- **Bot Platform**: Telegram Bot API + Mini App
- **Payment**: Phajay (LAK payment gateway) — ລາຍລະອຽດການເຊື່ອມຕໍ່: [`docs/PHAJAY.md`](docs/PHAJAY.md)
- **Deployment**: Cloudflare Pages (GitHub integration)

---

## Deployment Steps

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/pah-khaang-baan.git
git push -u origin main
```

### 2. Cloudflare Pages Setup

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Pages** → **Create a project**
2. Connect your GitHub repository
3. Configure build settings:
   - **Framework preset**: Next.js
   - **Build command**: `npm run pages:build`
   - **Build output directory**: `.vercel/output/static`
   - **Root directory**: `/` (or `pah-khaang-baan/` if nested)
4. Click **Save and Deploy**

> Notes:
> - This project uses `@cloudflare/next-on-pages` to generate the runtime worker for SSR/API routes.
> - If your previous deploy was using `.next` as output, update it to `.vercel/output/static` or you'll get 404 / missing functions.
> - Production secrets are managed in Cloudflare Dashboard. Do **not** commit `[vars]` or `[[secret_store_secrets]]` into `wrangler.toml` (build is guarded to fail if found).

### 3. Environment Variables (Cloudflare Dashboard)

Go to **Pages** → your project → **Settings** → **Environment variables** and add all variables from `.env.example`:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `PHAJAY_MODE` | **`test`** (default) ຫຼື **`production`** — ເລືອກຊຸດ key; ບໍ່ເດົາເອງຈາກຮູບແບບ key |
| `PHAJAY_SECRET_KEY_TEST` | Test / Sandbox API key (generate-bcel-qr, payment-link) |
| `PHAJAY_SECRET_KEY_PRODUCTION` | Production API key (ຫຼັງ KYC) |
| `PHAJAY_SECRET_KEY` | Fallback ຖ້າບໍ່ແຍກ test/prod |
| `PHAJAY_WEBHOOK_SECRET_TEST` | ຄວາມລັບກວດ `x-phajay-signature` (test) |
| `PHAJAY_WEBHOOK_SECRET_PRODUCTION` | Webhook secret (production) |
| `PHAJAY_WEBHOOK_SECRET` | Fallback ສຳລັບ webhook HMAC |
| `PHAJAY_API_URL` | `https://payment-gateway.phajay.co/v1/api` (default) |
| `PHAJAY_API_URL_TEST` / `PHAJAY_API_URL_PRODUCTION` | ຖ້າ Phajay ໃຫ້ endpoint ຄນລະ URL |
| `PHAJAY_MERCHANT_ID` | ສຳລັບ payment-link (ຖ້າໃຊ້) |
| `PHAJAY_ALLOW_UNSIGNED_WEBHOOKS` | `true` = ຍອມຮັບ webhook ບໍ່ມີ signature **ສະເພາະ test** (ບໍ່ແນະນຳ) |
| `APP_URL` | URL ຈຣິງຂອງແອັບ (ໃຊ້ສ້າງ webhook URL ໃຫ້ກົງກັບ Phajay) |
| `NEXT_PUBLIC_APP_URL` | Your Cloudflare Pages URL (fallback ຂອງ APP_URL) |
| `ADMIN_TELEGRAM_ID` | Your personal Telegram user ID |
| `WEBHOOK_SECRET` | Random secret for webhook validation |
| `SUBSCRIPTION_PRICE_LAK` | ລາຄາຕໍ່ເດືອນ (ກີບ) — ຕົວຢ່າງ `50000`; ແຜນ 6m = ×5, 12m = ×10 |
| `SUBSCRIPTION_DURATION_DAYS` | `30` (ຮອບຊຳລະຕາມພາລາມິເຕີ Phajay; ອາຍຸໃຊ້ງານໃນແອັບຄິດຈາກ `payment_details`) |

> ຫຼັງ deploy: ລົງທະບຽນ **Webhook URL** ໃນແຜງ Phajay ໃຫ້ຊີ້ມາ `https://<YOUR_DOMAIN>/api/phajay/webhook` (ເບິ່ງ [`docs/PHAJAY.md`](docs/PHAJAY.md)).

**ທົດສອບມື້ນີ້ (Test):** ຕັ້ງ `PHAJAY_MODE=test`, ໃສ່ `PHAJAY_SECRET_KEY_TEST` + `PHAJAY_WEBHOOK_SECRET_TEST` ຈາກ Phajay dashboard, ກວດ `APP_URL` ໃຫ້ກົງກັບ URL ທີ່ລົງທະບຽນ webhook.

**ຫຼັງ KYC (Production):** ປ່ຽນເປັນ `PHAJAY_MODE=production`, ໃສ່ `PHAJAY_SECRET_KEY_PRODUCTION` ແລະ `PHAJAY_WEBHOOK_SECRET_PRODUCTION`, ລົບ ຫຼືປິດ `PHAJAY_ALLOW_UNSIGNED_WEBHOOKS`. ບໍ່ commit key ຈຣິງລົງ Git.

### 4. After Deployment

After your Cloudflare Pages URL is live (e.g. `https://pah-khaang-baan.pages.dev`):

#### Set Telegram Webhook
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://pah-khaang-baan.pages.dev/api/telegram/webhook&secret_token=<WEBHOOK_SECRET>
```

#### Set Mini App in @BotFather
1. Message @BotFather
2. `/mybots` → select your bot → **Bot Settings** → **Menu Button**
3. Set URL to `https://pah-khaang-baan.pages.dev`

---

## Supabase Database Schema

Run this SQL in your Supabase SQL editor:

```sql
-- Users table (synced from Telegram)
CREATE TABLE users (
  id BIGINT PRIMARY KEY, -- Telegram user ID
  username TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT,
  language_code TEXT DEFAULT 'lo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'inactive', -- active | inactive | expired
  started_at TIMESTAMPTZ,
  expiry_date TIMESTAMPTZ,
  payment_ref TEXT, -- Phajay transaction reference
  amount_lak INTEGER DEFAULT 30000,
  payment_details JSONB, -- plan, duration_days, months_* (ໃຊ້ກັບ webhook ອັບເດດອາຍຸ)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ຖ້າຕາຕະລາງເກົ່າບໍ່ມີຄອລຳນີ້ — ຮັນໃນ Supabase SQL Editor ກ່ອນໃຊ້ສ້າງ QR:
-- ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_details JSONB;

-- Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_lao TEXT,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'both')),
  icon TEXT DEFAULT '💰',
  color TEXT DEFAULT '#6366F1',
  is_default BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount BIGINT NOT NULL, -- amount in LAK (Lao Kip)
  category_id UUID REFERENCES categories(id),
  description TEXT,
  raw_text TEXT, -- original text sent by user
  ai_parsed BOOLEAN DEFAULT FALSE,
  note TEXT,
  transaction_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budgets table
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id),
  amount BIGINT NOT NULL, -- monthly budget in LAK
  month INTEGER NOT NULL, -- 1-12
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category_id, month, year)
);

-- Row Level Security Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "users_own_data" ON users
  FOR ALL USING (id = (current_setting('app.current_user_id', true))::BIGINT);

CREATE POLICY "subscriptions_own_data" ON subscriptions
  FOR ALL USING (user_id = (current_setting('app.current_user_id', true))::BIGINT);

CREATE POLICY "transactions_own_data" ON transactions
  FOR ALL USING (user_id = (current_setting('app.current_user_id', true))::BIGINT);

CREATE POLICY "budgets_own_data" ON budgets
  FOR ALL USING (user_id = (current_setting('app.current_user_id', true))::BIGINT);

-- Categories are readable by all authenticated users
CREATE POLICY "categories_readable" ON categories
  FOR SELECT USING (TRUE);

-- Insert default categories
INSERT INTO categories (name, name_lao, type, icon, color, is_default, sort_order) VALUES
  ('Salary', 'ເງິນເດືອນ', 'income', '💼', '#10B981', TRUE, 1),
  ('Business', 'ທຸລະກິດ', 'income', '🏢', '#06B6D4', TRUE, 2),
  ('Investment', 'ການລົງທຶນ', 'income', '📈', '#8B5CF6', TRUE, 3),
  ('Other Income', 'ລາຍຮັບອື່ນໆ', 'income', '💰', '#F59E0B', TRUE, 4),
  ('Food', 'ອາຫານ', 'expense', '🍜', '#EF4444', TRUE, 5),
  ('Transport', 'ການເດີນທາງ', 'expense', '🚗', '#F97316', TRUE, 6),
  ('Shopping', 'ຊື້ເຄື່ອງ', 'expense', '🛍️', '#EC4899', TRUE, 7),
  ('Health', 'ສຸຂະພາບ', 'expense', '🏥', '#14B8A6', TRUE, 8),
  ('Education', 'ການສຶກສາ', 'expense', '📚', '#6366F1', TRUE, 9),
  ('Entertainment', 'ຄວາມບັນເທີງ', 'expense', '🎮', '#A855F7', TRUE, 10),
  ('Utilities', 'ຄ່ານ້ຳໄຟ', 'expense', '💡', '#64748B', TRUE, 11),
  ('Other Expense', 'ລາຍຈ່າຍອື່ນໆ', 'expense', '💸', '#94A3B8', TRUE, 12);
```

---

## Project Structure

```
pah-khaang-baan/
├── app/
│   ├── admin/           # Owner-only dashboard
│   ├── (mini-app)/      # Telegram Mini App routes
│   ├── api/             # API routes (webhooks, etc.)
│   └── layout.tsx       # Root layout
├── components/
│   ├── admin/           # Admin-specific components
│   ├── mini-app/        # Mini App components
│   └── ui/              # shadcn/ui components
├── lib/                 # Utilities and clients
├── types/               # TypeScript type definitions
└── middleware.ts        # Route protection
```

---

## Features

### 🤖 AI Bot (Telegram)
- Send text or voice messages in Lao/Thai/English
- AI automatically categorizes income/expense
- Replies in friendly "ป้า" (Auntie) style Lao

### 📊 Mini App Dashboard  
- Balance overview with animated cards
- Recent transactions list
- Monthly reports with pie/bar charts
- Budget tracking with progress bars
- Subscription management

### ⚙️ Admin Dashboard
- User management and subscription overview
- All transactions log
- Category CRUD
- AI prompt editor with live testing

---

*ສ້າງດ້ວຍ ❤️ ສຳລັບຄົນລາວ*
