-- =============================================================================
-- ປ້າຂ້າງບ້ານ — ສະກີມາເລີ່ມຕົ້ນ (ຮັນຄັ້ງດຽວໃນ Supabase SQL Editor ສຳລັບຖານຂໍ້ມູນຫວ່າງ)
-- =============================================================================
-- ກ່ອນຮັນ: ສຳຮອງ DB ຖ້າມີຂໍ້ມູນແລ້ວ
-- ຫຼັງຮັນ: ໃສ່ NEXT_PUBLIC_SUPABASE_* ແລະ SUPABASE_SERVICE_ROLE_KEY ໃນ Cloudflare
-- =============================================================================

-- Extensions (ສ່ວນຫຼາຍໂປຣເຈັກ Supabase ມີແລ້ວ)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Users (sync ຈາກ Telegram)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id BIGINT PRIMARY KEY,
  username TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT,
  language_code TEXT DEFAULT 'lo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Subscriptions (1 ແຖວຕໍ່ user — Phajay + admin grant/revoke)
-- -----------------------------------------------------------------------------
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'inactive',
  started_at TIMESTAMPTZ,
  expiry_date TIMESTAMPTZ,
  payment_ref TEXT,
  amount_lak INTEGER DEFAULT 50000,
  payment_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- -----------------------------------------------------------------------------
-- Categories
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Transactions
-- -----------------------------------------------------------------------------
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount BIGINT NOT NULL,
  category_id UUID REFERENCES categories(id),
  description TEXT,
  raw_text TEXT,
  ai_parsed BOOLEAN DEFAULT FALSE,
  note TEXT,
  transaction_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Budgets
-- -----------------------------------------------------------------------------
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  amount BIGINT NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category_id, month, year)
);

-- -----------------------------------------------------------------------------
-- Indexes (ຄິວລີຫຼັກທີ່ແອັບໃຊ້)
-- -----------------------------------------------------------------------------
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_budgets_user_month ON budgets(user_id, year, month);

-- -----------------------------------------------------------------------------
-- Row Level Security (ຝັ່ງແອັບໃຊ້ service role ສ່ວນຫຼາຍ — ກົດນີ້ສຳລັບອະນາຄົດ / client ກົງກັບ anon)
-- -----------------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- ຕ້ອງມີການຕັ້ງ app.current_user_id ກ່ອນ (ຖ້າໃຊ້ policy ນີ້ກັບ anon key)
CREATE POLICY "users_own_data" ON users
  FOR ALL USING (id = (current_setting('app.current_user_id', true))::BIGINT);

CREATE POLICY "subscriptions_own_data" ON subscriptions
  FOR ALL USING (user_id = (current_setting('app.current_user_id', true))::BIGINT);

CREATE POLICY "transactions_own_data" ON transactions
  FOR ALL USING (user_id = (current_setting('app.current_user_id', true))::BIGINT);

CREATE POLICY "budgets_own_data" ON budgets
  FOR ALL USING (user_id = (current_setting('app.current_user_id', true))::BIGINT);

CREATE POLICY "categories_readable" ON categories
  FOR SELECT USING (TRUE);

-- -----------------------------------------------------------------------------
-- ໝວດເລີ່ມຕົ້ນ
-- -----------------------------------------------------------------------------
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
