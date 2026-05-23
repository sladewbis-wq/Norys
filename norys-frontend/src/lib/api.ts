// Typed client for the Norys Core API.
// Requests go to /api/v1/* and are proxied to the backend by next.config rewrites.

import type {
  Agent,
  AgentInput,
  AuditLog,
  ChatMessage,
  Conversation,
  DocumentMeta,
  LLMProviders,
  PlatformSettings,
  SettingsPatch,
  Tokens,
  User,
} from "./types";

const API_PREFIX = "/api/v1";

const ACCESS_KEY = "norys.access";
const REFRESH_KEY = "norys.refresh";

export const tokenStore = {
  get access() {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  set(tokens: Tokens) {
    window.localStorage.setItem(ACCESS_KEY, tokens.access_token);
    window.localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
  },
  clear() {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail)) {
      return data.detail.map((d: { msg?: string }) => d.msg).join(", ");
    }
    return res.statusText;
  } catch {
    return res.statusText;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean;
  retry?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, auth = true, retry = true, headers, ...rest } = opts;
  const finalHeaders = new Headers(headers);
  let payload: BodyInit | undefined;

  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    finalHeaders.set("Content-Type", "application/json");
    payload = JSON.stringify(body);
  }

  if (auth && tokenStore.access) {
    finalHeaders.set("Authorization", `Bearer ${tokenStore.access}`);
  }

  const res = await fetch(`${API_PREFIX}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: payload,
  });

  // Transparent refresh on 401, once.
  if (res.status === 401 && auth && retry && tokenStore.refresh) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, { ...opts, retry: false });
    tokenStore.clear();
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_PREFIX}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: tokenStore.refresh }),
    });
    if (!res.ok) return false;
    tokenStore.set((await res.json()) as Tokens);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  // --- Auth ---
  async register(input: {
    tenant_name: string;
    tenant_slug: string;
    email: string;
    password: string;
    full_name?: string;
  }): Promise<Tokens> {
    const tokens = await request<Tokens>("/auth/register", {
      method: "POST",
      body: input,
      auth: false,
    });
    tokenStore.set(tokens);
    return tokens;
  },

  async login(input: {
    email: string;
    password: string;
    tenant_slug: string;
  }): Promise<Tokens> {
    const tokens = await request<Tokens>("/auth/login", {
      method: "POST",
      body: input,
      auth: false,
    });
    tokenStore.set(tokens);
    return tokens;
  },

  logout() {
    tokenStore.clear();
  },

  me: () => request<User>("/auth/me"),

  // --- System ---
  providers: () => request<LLMProviders>("/llm/providers"),

  // --- Agents ---
  listAgents: () => request<Agent[]>("/agents"),
  getAgent: (id: string) => request<Agent>(`/agents/${id}`),
  createAgent: (input: AgentInput) =>
    request<Agent>("/agents", { method: "POST", body: input }),
  updateAgent: (id: string, input: Partial<AgentInput> & { is_active?: boolean }) =>
    request<Agent>(`/agents/${id}`, { method: "PATCH", body: input }),
  deleteAgent: (id: string) =>
    request<void>(`/agents/${id}`, { method: "DELETE" }),

  // --- Chat ---
  listConversations: () => request<Conversation[]>("/chat/conversations"),
  createConversation: (input: { agent_id?: string | null; title?: string }) =>
    request<Conversation>("/chat/conversations", { method: "POST", body: input }),
  listMessages: (conversationId: string) =>
    request<ChatMessage[]>(`/chat/conversations/${conversationId}/messages`),
  sendMessage: (conversationId: string, content: string) =>
    request<{ conversation_id: string; message: ChatMessage }>(
      `/chat/conversations/${conversationId}/messages`,
      { method: "POST", body: { content, stream: false } },
    ),

  // --- Documents ---
  listDocuments: () => request<DocumentMeta[]>("/documents"),
  uploadDocument: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<DocumentMeta>("/documents", { method: "POST", body: form });
  },
  deleteDocument: (id: string) =>
    request<void>(`/documents/${id}`, { method: "DELETE" }),

  // --- Admin ---
  listUsers: () => request<User[]>("/admin/users"),
  createUser: (input: {
    email: string;
    password: string;
    full_name?: string;
    role?: string;
  }) => request<User>("/admin/users", { method: "POST", body: input }),
  updateUser: (
    id: string,
    input: { full_name?: string; role?: string; is_active?: boolean },
  ) => request<User>(`/admin/users/${id}`, { method: "PATCH", body: input }),
  deleteUser: (id: string) =>
    request<void>(`/admin/users/${id}`, { method: "DELETE" }),
  listAuditLogs: (limit = 100) =>
    request<AuditLog[]>(`/admin/audit-logs?limit=${limit}`),

  // --- Settings ---
  getSettings: () => request<PlatformSettings>("/settings"),
  patchSettings: (input: SettingsPatch) =>
    request<PlatformSettings>("/settings", { method: "PATCH", body: input }),
};

// --- Streaming chat (SSE) ---
export async function streamMessage(
  conversationId: string,
  content: string,
  onDelta: (delta: string) => void,
): Promise<void> {
  const res = await fetch(
    `${API_PREFIX}/chat/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenStore.access}`,
      },
      body: JSON.stringify({ content, stream: true }),
    },
  );
  if (!res.ok || !res.body) {
    throw new ApiError(res.status, await parseError(res));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const evt of events) {
      const line = evt.trim();
      if (!line.startsWith("data:")) continue;
      try {
        const data = JSON.parse(line.slice(5).trim());
        if (data.delta) onDelta(data.delta as string);
      } catch {
        // ignore malformed chunks
      }
    }
  }
}
