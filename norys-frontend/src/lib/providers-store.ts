/**
 * providers-store.ts
 * LocalStorage-based AI provider configuration for OpenClaw Enterprise.
 * Key: "norys:providers"
 */

export interface ProviderModel {
  id: string;
  label: string;
  contextK?: number;   // context window in K tokens
  type?: "text" | "vision" | "tts" | "code";
}

export interface ProviderDef {
  id: string;
  label: string;
  logo: string;        // emoji or short text logo
  color: string;       // accent hex
  description: string;
  website: string;
  requiresKey: boolean;
  free: boolean;       // true for free-tier tools
  category: "llm" | "tts" | "code" | "multimodal";
  models: ProviderModel[];
  keyPlaceholder?: string;
}

export interface ProviderConfig {
  providerId: string;
  apiKey: string;
  baseUrl?: string;   // for Azure / self-hosted
  enabled: boolean;
  lastTested?: string;
  testStatus?: "ok" | "error" | "untested";
  detectedModels?: string[]; // populated after test
}

// ── Full catalog ──────────────────────────────────────────────────────────────

export const PROVIDERS_CATALOG: ProviderDef[] = [
  // ── LLMs ──
  {
    id: "anthropic",
    label: "Anthropic",
    logo: "◆",
    color: "#d97706",
    description: "Claude — modèles frontier Anthropic pour raisonnement avancé.",
    website: "https://console.anthropic.com",
    requiresKey: true,
    free: false,
    category: "llm",
    keyPlaceholder: "sk-ant-…",
    models: [
      { id: "claude-opus-4-5",           label: "Claude Opus 4.5",     contextK: 200, type: "vision" },
      { id: "claude-sonnet-4-5",         label: "Claude Sonnet 4.5",   contextK: 200, type: "vision" },
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5",    contextK: 200, type: "vision" },
      { id: "claude-opus-4-6",           label: "Claude Opus 4.6",     contextK: 200, type: "vision" },
      { id: "claude-sonnet-4-6",         label: "Claude Sonnet 4.6",   contextK: 200, type: "vision" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    logo: "⬡",
    color: "#10b981",
    description: "GPT-4o, o1 et embeddings — la référence de l'IA générative.",
    website: "https://platform.openai.com",
    requiresKey: true,
    free: false,
    category: "llm",
    keyPlaceholder: "sk-…",
    models: [
      { id: "gpt-4o",           label: "GPT-4o",         contextK: 128, type: "vision" },
      { id: "gpt-4o-mini",      label: "GPT-4o Mini",    contextK: 128, type: "vision" },
      { id: "gpt-4-turbo",      label: "GPT-4 Turbo",    contextK: 128, type: "vision" },
      { id: "o1",               label: "o1",              contextK: 200, type: "text" },
      { id: "o1-mini",          label: "o1-mini",         contextK: 128, type: "text" },
      { id: "o3-mini",          label: "o3-mini",         contextK: 200, type: "text" },
    ],
  },
  {
    id: "google",
    label: "Google Gemini",
    logo: "✦",
    color: "#4285f4",
    description: "Gemini 2.0 Flash & Pro — multimodal ultra-rapide de Google.",
    website: "https://aistudio.google.com",
    requiresKey: true,
    free: false,
    category: "multimodal",
    keyPlaceholder: "AIza…",
    models: [
      { id: "gemini-2.0-flash",          label: "Gemini 2.0 Flash",         contextK: 1000, type: "vision" },
      { id: "gemini-2.0-flash-thinking", label: "Gemini 2.0 Flash Thinking", contextK: 1000, type: "vision" },
      { id: "gemini-1.5-pro",            label: "Gemini 1.5 Pro",            contextK: 2000, type: "vision" },
      { id: "gemini-1.5-flash",          label: "Gemini 1.5 Flash",          contextK: 1000, type: "vision" },
    ],
  },
  {
    id: "azure",
    label: "Azure OpenAI",
    logo: "☁",
    color: "#0078d4",
    description: "Déploiement privé des modèles OpenAI sur votre infrastructure Azure.",
    website: "https://portal.azure.com",
    requiresKey: true,
    free: false,
    category: "llm",
    keyPlaceholder: "Clé de ressource Azure",
    models: [
      { id: "gpt-4o",       label: "GPT-4o (Azure)",       contextK: 128, type: "vision" },
      { id: "gpt-4-turbo",  label: "GPT-4 Turbo (Azure)",  contextK: 128, type: "text" },
      { id: "gpt-35-turbo", label: "GPT-3.5 Turbo (Azure)", contextK: 16,  type: "text" },
    ],
  },
  {
    id: "xai",
    label: "xAI / Grok",
    logo: "𝕏",
    color: "#ffffff",
    description: "Grok 2 — modèle temps réel avec accès à X (Twitter).",
    website: "https://x.ai",
    requiresKey: true,
    free: false,
    category: "llm",
    keyPlaceholder: "xai-…",
    models: [
      { id: "grok-2",       label: "Grok 2",       contextK: 131, type: "text" },
      { id: "grok-2-mini",  label: "Grok 2 Mini",  contextK: 131, type: "text" },
      { id: "grok-beta",    label: "Grok Beta",     contextK: 131, type: "text" },
    ],
  },
  {
    id: "mistral",
    label: "Mistral AI",
    logo: "M",
    color: "#ff7000",
    description: "Mistral Large & Codestral — excellence européenne en IA.",
    website: "https://console.mistral.ai",
    requiresKey: true,
    free: false,
    category: "llm",
    keyPlaceholder: "…",
    models: [
      { id: "mistral-large-2407",   label: "Mistral Large 2",  contextK: 128, type: "text" },
      { id: "mistral-small-2409",   label: "Mistral Small 3",  contextK: 128, type: "text" },
      { id: "codestral-2405",       label: "Codestral",        contextK: 32,  type: "code" },
      { id: "open-mixtral-8x22b",   label: "Mixtral 8×22B",   contextK: 64,  type: "text" },
    ],
  },
  {
    id: "groq",
    label: "Groq",
    logo: "⚡",
    color: "#f43f5e",
    description: "Inférence ultra-rapide sur LPU pour des latences sub-seconde.",
    website: "https://console.groq.com",
    requiresKey: true,
    free: false,
    category: "llm",
    keyPlaceholder: "gsk_…",
    models: [
      { id: "llama-3.3-70b-versatile",   label: "Llama 3.3 70B",       contextK: 128, type: "text" },
      { id: "llama-3.1-8b-instant",      label: "Llama 3.1 8B (fast)", contextK: 128, type: "text" },
      { id: "mixtral-8x7b-32768",        label: "Mixtral 8×7B",        contextK: 32,  type: "text" },
      { id: "gemma2-9b-it",              label: "Gemma 2 9B",           contextK: 8,   type: "text" },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    logo: "⇄",
    color: "#8b5cf6",
    description: "Accès unifié à 200+ modèles via une seule API.",
    website: "https://openrouter.ai",
    requiresKey: true,
    free: false,
    category: "llm",
    keyPlaceholder: "sk-or-…",
    models: [
      { id: "openai/gpt-4o",                 label: "GPT-4o (OR)",          contextK: 128, type: "vision" },
      { id: "anthropic/claude-sonnet-4-5",   label: "Claude Sonnet 4.5 (OR)", contextK: 200, type: "vision" },
      { id: "google/gemini-2.0-flash",       label: "Gemini 2.0 Flash (OR)", contextK: 1000, type: "vision" },
      { id: "meta-llama/llama-3.3-70b",      label: "Llama 3.3 70B (OR)",   contextK: 128, type: "text" },
      { id: "deepseek/deepseek-r1",          label: "DeepSeek R1 (OR)",      contextK: 64,  type: "text" },
    ],
  },
  {
    id: "cohere",
    label: "Cohere",
    logo: "Co",
    color: "#39d353",
    description: "Command R+ pour RAG enterprise et analyse documentaire.",
    website: "https://dashboard.cohere.com",
    requiresKey: true,
    free: false,
    category: "llm",
    keyPlaceholder: "…",
    models: [
      { id: "command-r-plus-08-2024", label: "Command R+",      contextK: 128, type: "text" },
      { id: "command-r-08-2024",      label: "Command R",       contextK: 128, type: "text" },
      { id: "command-light",          label: "Command Light",   contextK: 4,   type: "text" },
    ],
  },
  {
    id: "perplexity",
    label: "Perplexity",
    logo: "P",
    color: "#20b2aa",
    description: "Sonar — modèles avec accès internet en temps réel.",
    website: "https://www.perplexity.ai/settings/api",
    requiresKey: true,
    free: false,
    category: "llm",
    keyPlaceholder: "pplx-…",
    models: [
      { id: "sonar-pro",                    label: "Sonar Pro",           contextK: 200, type: "text" },
      { id: "sonar",                        label: "Sonar",               contextK: 127, type: "text" },
      { id: "sonar-reasoning-pro",          label: "Sonar Reasoning Pro", contextK: 128, type: "text" },
    ],
  },
  {
    id: "together",
    label: "Together AI",
    logo: "T",
    color: "#6366f1",
    description: "Hébergement et fine-tuning de modèles open-source.",
    website: "https://api.together.xyz",
    requiresKey: true,
    free: false,
    category: "llm",
    keyPlaceholder: "…",
    models: [
      { id: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", label: "Llama 3.1 70B Turbo", contextK: 131, type: "text" },
      { id: "mistralai/Mixtral-8x22B-Instruct-v0.1",        label: "Mixtral 8×22B",        contextK: 65,  type: "text" },
      { id: "Qwen/Qwen2.5-72B-Instruct-Turbo",              label: "Qwen 2.5 72B",         contextK: 32,  type: "text" },
    ],
  },
  // ── Local ──
  {
    id: "ollama",
    label: "Ollama (local)",
    logo: "🦙",
    color: "#7c3aed",
    description: "Exécutez n'importe quel modèle LLM localement, zéro fuite de données.",
    website: "https://ollama.ai",
    requiresKey: false,
    free: true,
    category: "llm",
    keyPlaceholder: "http://localhost:11434",
    models: [
      { id: "llama3.3",   label: "Llama 3.3",   contextK: 128, type: "text" },
      { id: "llama3.2",   label: "Llama 3.2",   contextK: 128, type: "text" },
      { id: "mistral",    label: "Mistral 7B",  contextK: 32,  type: "text" },
      { id: "codellama",  label: "CodeLlama",   contextK: 16,  type: "code" },
      { id: "phi4",       label: "Phi-4",       contextK: 16,  type: "text" },
      { id: "gemma3",     label: "Gemma 3",     contextK: 128, type: "text" },
      { id: "qwen2.5",    label: "Qwen 2.5",   contextK: 128, type: "text" },
      { id: "deepseek-r1",label: "DeepSeek R1",contextK: 64,  type: "text" },
    ],
  },
  // ── TTS ──
  {
    id: "elevenlabs",
    label: "ElevenLabs",
    logo: "🎙",
    color: "#fbbf24",
    description: "Synthèse vocale ultra-réaliste pour vos agents conversationnels.",
    website: "https://elevenlabs.io",
    requiresKey: true,
    free: false,
    category: "tts",
    keyPlaceholder: "…",
    models: [
      { id: "eleven_turbo_v2_5",  label: "Turbo v2.5",     type: "tts" },
      { id: "eleven_multilingual_v2", label: "Multilingual v2", type: "tts" },
      { id: "eleven_flash_v2_5",  label: "Flash v2.5",     type: "tts" },
    ],
  },
  // ── Free tiers / Code assistants ──
  {
    id: "cursor",
    label: "Cursor (free)",
    logo: "↗",
    color: "#06b6d4",
    description: "Accès gratuit à Claude et GPT-4 via Cursor IDE.",
    website: "https://cursor.sh",
    requiresKey: false,
    free: true,
    category: "code",
    models: [
      { id: "cursor/claude-sonnet", label: "Claude Sonnet (Cursor)", contextK: 200, type: "code" },
      { id: "cursor/gpt-4o",       label: "GPT-4o (Cursor)",         contextK: 128, type: "code" },
    ],
  },
  {
    id: "windsurf",
    label: "Windsurf (free)",
    logo: "🏄",
    color: "#3b82f6",
    description: "Assistant code IA avec 25 requêtes gratuites/jour.",
    website: "https://codeium.com/windsurf",
    requiresKey: false,
    free: true,
    category: "code",
    models: [
      { id: "windsurf/cascade", label: "Cascade (Windsurf)", contextK: 128, type: "code" },
    ],
  },
  {
    id: "codeium",
    label: "Codeium (free)",
    logo: "⌨",
    color: "#22c55e",
    description: "Autocomplétion et chat code gratuits et illimités.",
    website: "https://codeium.com",
    requiresKey: false,
    free: true,
    category: "code",
    models: [
      { id: "codeium/chat",   label: "Codeium Chat",   contextK: 16, type: "code" },
      { id: "codeium/inline", label: "Codeium Inline", contextK: 8,  type: "code" },
    ],
  },
];

// ── Storage helpers ───────────────────────────────────────────────────────────

const STORAGE_KEY = "norys:providers";

export function loadProviderConfigs(): Record<string, ProviderConfig> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveProviderConfig(config: ProviderConfig) {
  if (typeof window === "undefined") return;
  const all = loadProviderConfigs();
  all[config.providerId] = config;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function getProviderConfig(providerId: string): ProviderConfig {
  const all = loadProviderConfigs();
  return all[providerId] ?? {
    providerId,
    apiKey: "",
    enabled: false,
    testStatus: "untested",
  };
}

/** Returns list of {providerId, modelId, label} for all enabled providers */
export function getAvailableModels(): Array<{
  providerId: string;
  providerLabel: string;
  modelId: string;
  modelLabel: string;
  contextK?: number;
  type?: string;
}> {
  const configs = loadProviderConfigs();
  const result: Array<{
    providerId: string;
    providerLabel: string;
    modelId: string;
    modelLabel: string;
    contextK?: number;
    type?: string;
  }> = [];

  for (const def of PROVIDERS_CATALOG) {
    const cfg = configs[def.id];
    const isEnabled = def.free
      ? (cfg?.enabled !== false)  // free providers enabled by default
      : (cfg?.enabled && cfg.apiKey);

    if (!isEnabled) continue;

    const models = def.models;
    for (const m of models) {
      result.push({
        providerId: def.id,
        providerLabel: def.label,
        modelId: m.id,
        modelLabel: m.label,
        contextK: m.contextK,
        type: m.type,
      });
    }
  }

  return result;
}
