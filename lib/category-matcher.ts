export function matchCategoryByHint(
  hint: string | undefined,
  categories: Array<{ id: string; name: string; name_lao?: string | null; type: string }>
): string | null {
  if (!hint) return null;
  const lowerHint = hint.toLowerCase();

  // Try exact match first
  const exact = categories.find(
    (c) =>
      c.name.toLowerCase() === lowerHint ||
      (c.name_lao && c.name_lao.toLowerCase() === lowerHint)
  );
  if (exact) return exact.id;

  // Keyword mapping
  const keywordMap: Record<string, string[]> = {
    Food: ["food", "อาหาร", "ອາຫານ", "ຂ້າວ", "ກິນ", "ຂ້າວ", "ກິນ"],
    Salary: ["salary", "เงินเดือน", "ເງິນເດືອນ"],
    Transport: ["transport", "การเดินทาง", "ການເດີນທາງ", "รถ", "ລົດ"],
    Shopping: ["shopping", "ซื้อของ", "ຊື້ເຄື່ອງ"],
    Health: ["health", "สุขภาพ", "ສຸຂະພາບ", "ยา", "ຢາ", "หมอ", "ໝໍ"],
    Education: ["education", "การศึกษา", "ການສຶກສາ"],
    Entertainment: ["entertainment", "บันเทิง", "ຄວາມບັນເທີງ"],
    Utilities: ["utilities", "ค่าน้ำ", "ຄ່ານ້ຳ", "ไฟ", "ໄຟ"],
    Business: ["business", "ธุรกิจ", "ທຸລະກິດ", "ลูกค้า", "ລູກຄ້າ"],
    Investment: ["investment", "ลงทุน", "ລົງທຶນ"],
  };

  for (const [catName, keywords] of Object.entries(keywordMap)) {
    if (keywords.some((kw) => lowerHint.includes(kw) || hint.includes(kw))) {
      const cat = categories.find((c) => c.name === catName);
      if (cat) return cat.id;
    }
  }

  // Partial name match
  const partial = categories.find(
    (c) =>
      c.name.toLowerCase().includes(lowerHint) ||
      lowerHint.includes(c.name.toLowerCase())
  );
  return partial?.id ?? null;
}

