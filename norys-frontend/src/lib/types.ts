// Types mirroring the Norys Core API (app/schemas/*).

export type RoleName = "owner" | "admin" | "member" | "viewer";

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string | null;
  role: RoleName;
  is_active: boolean;
}

export interface Tokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Agent {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  category: string;
  system_prompt: string;
  provider: string | null;
  model: string | null;
  temperature: number;
  max_tokens: number | null;
  use_rag: boolean;
  requires_human_approval: boolean;
  is_active: boolean;
}

export interface AgentInput {
  name: string;
  description?: string | null;
  category?: string;
  system_prompt?: string;
  provider?: string | null;
  model?: string | null;
  temperature?: number;
  max_tokens?: number | null;
  use_rag?: boolean;
  requires_human_approval?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  agent_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  tokens: number | null;
  created_at: string;
}

export interface DocumentMeta {
  id: string;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  status: "uploaded" | "processing" | "indexed" | "failed";
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface LLMProviders {
  available: string[];
  default_provider: string;
  default_model: string;
}

export type LLMProvider = "openai" | "openrouter" | "ollama";

export interface LLMSettings {
  default_llm_provider: LLMProvider;
  default_llm_model: string;
  openai_base_url: string;
  openrouter_base_url: string;
  ollama_base_url: string;
  openai_api_key_set: boolean;
  openrouter_api_key_set: boolean;
}

export interface RAGSettings {
  qdrant_url: string;
  embedding_provider: LLMProvider;
  embedding_model: string;
  embedding_dim: number;
  chunk_size: number;
  chunk_overlap: number;
}

export interface PlatformSettings {
  llm: LLMSettings;
  rag: RAGSettings;
}

export interface SettingsPatch {
  default_llm_provider?: LLMProvider;
  default_llm_model?: string;
  ollama_base_url?: string;
  embedding_provider?: LLMProvider;
  embedding_model?: string;
  embedding_dim?: number;
  chunk_size?: number;
  chunk_overlap?: number;
}
