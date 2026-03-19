import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import type { ParsedTransaction, GeminiParseResponse } from "@/types";

// ======================================
// Gemini Client
// ======================================

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

// ======================================
// Default Lao-optimized prompt
// ======================================

export const DEFAULT_SYSTEM_PROMPT = `ທ່ານເປັນ AI ຊ່ວຍຈັດການລາຍຮັບ-ລາຍຈ່າຍ ສຳລັບຄົນລາວ.
ໜ້າທີ່ຂອງທ່ານຄື: ອ່ານຂໍ້ຄວາມທີ່ຜູ້ໃຊ້ສົ່ງ ແລ້ວດຶງຂໍ້ມູນທຸລະກຳອອກມາ.

ຮູບແບບ output (JSON only, ບໍ່ຕ້ອງມີ markdown code blocks):
{
  "type": "income" หรือ "expense",
  "amount": ตัวเลข (ในหน่วย LAK),
  "description": "คำอธิบายสั้นๆ ภาษาลาว",
  "category_hint": "ชื่อหมวดหมู่ที่เหมาะสม",
  "confidence": ตัวเลข 0-1
}

กฎการแปล:
- "ได้เงิน", "รับเงิน", "เงินเดือน", "ຮັບ", "ໄດ້ຮັບ" = income
- "จ่าย", "ซื้อ", "ใช้เงิน", "ຈ່າຍ", "ຊື້", "ໃຊ້ເງິນ" = expense
- สกุลเงิน: "กีบ", "ກີບ", "LAK", "K" หลังตัวเลข = LAK, "บาท", "฿" = คูณด้วย 40, "ดอลลาร์", "$", "USD" = คูณด้วย 22000
- ตัวเลขที่มี "ล้าน", "ລ້ານ" = คูณด้วย 1,000,000
- ตัวเลขที่มี "พัน", "ພັນ" = คูณด้วย 1,000

ตัวอย่าง:
- "ได้เงินเดือน 1,500,000" → income, 1500000, "เงินเดือน", "Salary"
- "จ่าย 50,000 ซื้อของกิน" → expense, 50000, "ซื้ออาหาร", "Food"
- "ຈ່າຍຄ່ານ້ຳ 30ກີບ" → expense, 30000, "ຄ່ານ້ຳ", "Utilities"  
- "ຮັບເງິນຈາກລູກຄ້າ 500ພັນ" → income, 500000, "ຮັບເງິນຈາກລູກຄ້າ", "Business"
- "ซื้อข้าว 15000" → expense, 15000, "ซื้ออาหาร", "Food"

หาก input ไม่ใช่ข้อมูลทางการเงิน ให้ตอบว่า:
{"type": null, "amount": 0, "description": "ไม่พบข้อมูลทางการเงิน", "category_hint": null, "confidence": 0}`;

// ======================================
// Main Parse Function
// ======================================

export async function parseTransaction(
  text: string,
  customPrompt?: string
): Promise<GeminiParseResponse> {
  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({
      model: "gemini-1.5-flash",
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });

    const systemPrompt = customPrompt || DEFAULT_SYSTEM_PROMPT;
    const fullPrompt = `${systemPrompt}\n\nInput: "${text}"\n\nOutput (JSON only):`;

    const result = await model.generateContent(fullPrompt);
    const rawResponse = result.response.text().trim();

    // Clean up response (remove markdown code fences if present)
    const cleaned = rawResponse
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = JSON.parse(cleaned) as {
      type: "income" | "expense" | null;
      amount: number;
      description: string;
      category_hint: string | null;
      confidence: number;
    };

    if (!parsed.type || parsed.amount <= 0 || parsed.confidence < 0.3) {
      return {
        success: false,
        error: "ບໍ່ສາມາດດຶງຂໍ້ມູນທຸລະກຳໄດ້ — ກະລຸນາສົ່ງຂໍ້ຄວາມໃໝ່ 🙏",
        raw_response: rawResponse,
      };
    }

    const transaction: ParsedTransaction = {
      type: parsed.type,
      amount: Math.round(parsed.amount),
      description: parsed.description,
      category_hint: parsed.category_hint ?? undefined,
      confidence: parsed.confidence,
      raw_input: text,
    };

    return {
      success: true,
      transaction,
      raw_response: rawResponse,
    };
  } catch (error) {
    console.error("Gemini parse error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "AI error",
      raw_response: undefined,
    };
  }
}

// ======================================
// Match category_hint to actual category ID
// ======================================

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
    Food: ["food", "อาหาร", "ອາຫານ", "ข้าว", "กิน", "ຂ້າວ", "ກິນ"],
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
