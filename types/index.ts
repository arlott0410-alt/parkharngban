// ======================================
// Core Domain Types — ປ້າຂ້າງບ້ານ
// ======================================

export type TransactionType = "income" | "expense";
export type SubscriptionStatus = "active" | "inactive" | "expired" | "pending";
export type CategoryType = "income" | "expense" | "both";
export type GeminiModel =
  | "gemini-2.0-flash"
  | "gemini-2.0-flash-lite-preview-02-05"
  | "gemini-1.5-flash"
  | "gemini-1.5-pro";

// ======================================
// Database Types (mirrors Supabase tables)
// ======================================

export interface User {
  id: number; // Telegram user ID (BIGINT)
  username?: string;
  first_name: string;
  last_name?: string;
  language_code?: string;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: number;
  status: SubscriptionStatus;
  started_at?: string;
  expiry_date?: string;
  payment_ref?: string;
  amount_lak: number;
  payment_details?: unknown;
  created_at: string;
  updated_at: string;
  // Joined
  user?: User;
}

export interface Category {
  id: string;
  name: string;
  name_lao?: string;
  type: CategoryType;
  icon: string;
  color: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: number;
  type: TransactionType;
  amount: number; // in LAK (Lao Kip)
  category_id?: string;
  description?: string;
  raw_text?: string;
  ai_parsed: boolean;
  note?: string;
  transaction_date: string; // DATE
  created_at: string;
  updated_at: string;
  // Joined
  category?: Category;
  user?: User;
}

export interface Budget {
  id: string;
  user_id: number;
  category_id: string;
  amount: number; // monthly budget in LAK
  month: number; // 1-12
  year: number;
  created_at: string;
  // Joined
  category?: Category;
  spent?: number; // calculated
  percentage?: number; // calculated
}

// ======================================
// Telegram Types
// ======================================

export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  voice?: {
    file_id: string;
    duration: number;
    mime_type?: string;
    file_size?: number;
  };
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: TelegramUser;
    message?: TelegramMessage;
    data?: string;
  };
}

// Mini App init data
export interface TelegramInitData {
  query_id?: string;
  user?: TelegramUser;
  auth_date: number;
  hash: string;
  start_param?: string;
}

// ======================================
// AI / Gemini Types
// ======================================

export interface ParsedTransaction {
  type: TransactionType;
  amount: number;
  description: string;
  category_hint?: string;
  confidence: number; // 0-1
  raw_input: string;
}

export interface GeminiParseRequest {
  text: string;
  user_id?: number;
}

export interface GeminiParseResponse {
  success: boolean;
  transaction?: ParsedTransaction;
  error?: string;
  raw_response?: string;
}

export interface AdminAISettings {
  prompt: string;
  welcomeMessage: string;
  selectedModel: GeminiModel;
}

// ======================================
// Phajay Payment Types
// ======================================

export interface PhajayWebhookPayload {
  payment_id?: string;
  transaction_id?: string;
  reference: string;
  amount: number;
  status: "success" | "completed" | "failed" | "pending";
  currency?: "LAK";
  paid_at?: string;
  [key: string]: unknown;
}

// ======================================
// Admin Dashboard Types
// ======================================

export interface KpiData {
  label: string;
  value: string | number;
  change?: number; // percentage change
  trend?: "up" | "down" | "neutral";
  icon?: string;
}

export interface DashboardStats {
  total_users: number;
  active_subscriptions: number;
  total_revenue_lak: number;
  total_transactions: number;
  new_users_this_month: number;
  revenue_this_month: number;
}

export interface MonthlyRevenueData {
  month: string;
  revenue: number;
  subscriptions: number;
}

// ======================================
// Mini App Types
// ======================================

export interface BalanceSummary {
  total_income: number;
  total_expense: number;
  balance: number;
  month: number;
  year: number;
}

export interface CategorySpending {
  category_id: string;
  category_name: string;
  category_name_lao?: string;
  icon: string;
  color: string;
  amount: number;
  percentage: number;
  type: TransactionType;
}

export interface MonthlyData {
  month: string;
  income: number;
  expense: number;
}

// ======================================
// API Response Types
// ======================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ======================================
// Form Types
// ======================================

export interface TransactionFormData {
  type: TransactionType;
  amount: string;
  category_id: string;
  description: string;
  note?: string;
  transaction_date: string;
}

export interface CategoryFormData {
  name: string;
  name_lao?: string;
  type: CategoryType;
  icon: string;
  color: string;
  sort_order?: number;
}

export interface BudgetFormData {
  category_id: string;
  amount: string;
  month: number;
  year: number;
}
