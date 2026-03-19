import type { GeminiModel } from "@/types";

export const DEFAULT_GEMINI_MODEL: GeminiModel = "gemini-2.0-flash";

export const GEMINI_MODEL_OPTIONS: readonly GeminiModel[] = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite-preview-02-05",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
] as const;

export function isValidGeminiModel(value: string | null | undefined): value is GeminiModel {
  return !!value && GEMINI_MODEL_OPTIONS.includes(value as GeminiModel);
}

export function normalizeSelectedModel(value: string | null | undefined): GeminiModel {
  return isValidGeminiModel(value) ? value : DEFAULT_GEMINI_MODEL;
}
