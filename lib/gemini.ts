import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import type { ParsedTransaction, GeminiParseResponse } from "@/types";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/ai-defaults";
import { getAdminSettings } from "@/lib/admin-settings";
import { DEFAULT_GEMINI_MODEL } from "@/lib/gemini-models";

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
// Main Parse Function
// ======================================

export async function parseTransaction(
  text: string,
  customPrompt?: string
): Promise<GeminiParseResponse> {
  try {
    const settings = await getAdminSettings();
    const selectedModel = settings.selectedModel ?? DEFAULT_GEMINI_MODEL;
    const ai = getGenAI();
    const model = ai.getGenerativeModel({
      model: selectedModel,
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

    const systemPrompt = customPrompt || settings.prompt || DEFAULT_SYSTEM_PROMPT;
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

export { matchCategoryByHint } from "./category-matcher";
