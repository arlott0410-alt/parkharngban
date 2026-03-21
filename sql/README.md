# SQL scripts — Supabase

| ໄຟລ໌ | ໃຊ້ເມື່ອ |
|------|-----------|
| **`01_initial_schema.sql`** | ຖານຂໍ້ມູນຫວ່າງ / ໂປຣເຈັກໃໝ່ — **ຮັນຄັ້ງດຽວ** |
| **`02_upgrade_existing.sql`** | ມີຕາຕະລາງຢູ່ແລ້ວແຕ່ຂາດຄອລຳ / index — **ຮັນໄດ້ຫຼາຍຄັ້ງ** (ສ່ວນຫຼາຍ idempotent) |

## ຂັ້ນຕອນ

1. ເຂົ້າ Supabase Dashboard → **SQL Editor** → New query  
2. Copy ເນື້ອຫາໄຟລ໌ທີ່ຕ້ອງການ → Run  
3. ຖ້າໃຊ້ `01_initial_schema.sql` ສຳເລັດແລ້ວ — **ຢ່າຮັນ `01` ຊ້ຳ** (ຈະ error ວ່າມີຕາຕະລາງແລ້ວ)

## ຫຼັງຮັນ SQL

- ໃສ່ `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ໃນ Cloudflare / `.env.local`

ລາຍລະອຽດຟີເຈີຕົ້ນສະບັບຢູ່ [`README.md`](../README.md) ຫຼັກ
