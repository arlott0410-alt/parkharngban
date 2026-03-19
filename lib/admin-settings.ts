import { DEFAULT_SYSTEM_PROMPT } from "@/lib/gemini";
import { DEFAULT_WELCOME_TEMPLATE } from "@/lib/telegram";

let customPrompt: string | null = null;
let customWelcomeMessage: string | null = null;

export function getAdminSettings() {
  return {
    prompt: customPrompt ?? DEFAULT_SYSTEM_PROMPT,
    welcomeMessage: customWelcomeMessage ?? DEFAULT_WELCOME_TEMPLATE,
  };
}

export function setAdminSettings(settings: { prompt?: string; welcomeMessage?: string }) {
  if (settings.prompt !== undefined) {
    customPrompt = settings.prompt;
  }

  if (settings.welcomeMessage !== undefined) {
    customWelcomeMessage = settings.welcomeMessage;
  }
}
