import { createAdminClient } from "@/lib/supabase";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/ai-defaults";
import {
  DEFAULT_GEMINI_MODEL,
  isValidGeminiModel,
  normalizeSelectedModel,
} from "@/lib/gemini-models";
import { DEFAULT_WELCOME_TEMPLATE } from "@/lib/telegram";
import type { AdminAISettings } from "@/types";

function defaults(): AdminAISettings {
  return {
    prompt: DEFAULT_SYSTEM_PROMPT,
    welcomeMessage: DEFAULT_WELCOME_TEMPLATE,
    selectedModel: DEFAULT_GEMINI_MODEL,
  };
}

export async function getAdminSettings(): Promise<AdminAISettings> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("ai_settings")
      .select("prompt, welcome_message, selected_model")
      .limit(1)
      .maybeSingle();

    const base = defaults();
    return {
      prompt: data?.prompt ?? base.prompt,
      welcomeMessage: data?.welcome_message ?? base.welcomeMessage,
      selectedModel: isValidGeminiModel(data?.selected_model) ? data.selected_model : base.selectedModel,
    };
  } catch {
    return defaults();
  }
}

export async function setAdminSettings(settings: Partial<AdminAISettings>): Promise<void> {
  const current = await getAdminSettings();
  const selectedModel =
    settings.selectedModel && isValidGeminiModel(settings.selectedModel)
      ? settings.selectedModel
      : current.selectedModel;

  const supabase = createAdminClient();
  await supabase.from("ai_settings").upsert(
    {
      id: 1,
      prompt: settings.prompt ?? current.prompt,
      welcome_message: settings.welcomeMessage ?? current.welcomeMessage,
      selected_model: selectedModel,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
}

export { DEFAULT_GEMINI_MODEL, normalizeSelectedModel };
