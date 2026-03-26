-- =============================================================================
-- ອັບເກຣດຖານຂໍ້ມູນເກົ່າ — ຮັນໄດ້ຫຼາຍຄັ້ງ (idempotent ສ່ວນຫຼາຍ)
-- =============================================================================
-- ໃຊ້ເມື່ອມີຕາຕະລາງຢູ່ແລ້ວຈາກເວີຊັນ README ເກົ່າ ຫຼືຂາດຄອລຳທີ່ແອັບໃຊ້
-- =============================================================================

-- ຄອລຳສຳຄັນສຳລັບ Phajay QR + payment_details.bcel
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS payment_details JSONB;

-- ປັບ default ລາຄາຕໍ່ເດືອນ (ຖ້າຕ້ອງການໃຫ້ກົງ env production — ປ່ຽນເລກໄດ້)
ALTER TABLE subscriptions
  ALTER COLUMN amount_lak SET DEFAULT 42000;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Indexes (ບໍ່ error ຖ້າມີແລ້ວ)
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, year, month);

-- =============================================================================
-- UNIQUE(user_id) ຕໍ່ subscriptions — ໂຄ້ດແອັບສົມມຸດ 1 ແຖວຕໍ່ຜູ້ໃຊ້
-- =============================================================================
-- ຖ້າຕາຕະລາງເກົ່າບໍ່ມີ unique ແລະບໍ່ມີແຖວຊ້ຳ — ເປີດ comment ລຸ່ມແລ້ວຮັນຄັ້ງດຽວ:
-- ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);
-- ຖ້າມີແຖວຊ້ຳ user_id ຕ້ອງລຶບ/ລວງກ່ອນ
