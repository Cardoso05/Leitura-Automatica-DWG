export type PlanType = "free" | "pro" | "business";

export type ProjectStatus =
  | "uploaded"
  | "waiting_layers"
  | "processing"
  | "completed"
  | "failed";

export type Discipline =
  | "electrical"
  | "plumbing"
  | "networking"
  | "fire"
  | "hvac"
  | "generic";

export interface User {
  id: number;
  email: string;
  full_name?: string;
  company?: string;
  plan: PlanType;
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  original_filename: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  result_summary?: Record<string, unknown> | null;
}

export interface LayerInfo {
  name: string;
  entity_count: number;
  suggested_discipline?: Discipline | null;
}

export interface TakeoffItem {
  discipline?: string | null;
  category: string;
  description: string;
  unit: string;
  quantity: number;
  layer?: string | null;
  block_name?: string | null;
}

export interface TakeoffResult {
  project_id: number;
  summary: Record<string, number>;
  items: TakeoffItem[];
  metadata: Record<string, string | number>;
}

export type CheckoutType = "pay_per_use" | "pro" | "business";
