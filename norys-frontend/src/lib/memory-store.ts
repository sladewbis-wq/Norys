/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║         NORYS — 4-TIER MEMORY SYSTEM v2.0               ║
 * ║  Working · Episodic · Semantic · Procedural              ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Tier 1 — Working Memory    : Map en RAM, TTL 30min, accès <1ms
 * Tier 2 — Episodic Memory   : IndexedDB, conversations complètes, queryable
 * Tier 3 — Semantic Memory   : BM25 + TF-IDF, recherche par similarité
 * Tier 4 — Procedural Memory : Templates de workflows, patterns réutilisables
 *
 * Capacités :
 *  - Auto-compression des souvenirs anciens
 *  - Recherche cross-tier avec scoring et ranking
 *  - TTL automatique sur working memory
 *  - Import/Export JSON pour backup
 *  - Limite par agent (évite la saturation)
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WorkingMemoryEntry {
  key: string;
  value: unknown;
  agentId: string;
  createdAt: number;
  expiresAt: number;
  accessCount: number;
}

export interface EpisodicMemoryEntry {
  id: string;
  agentId: string;
  prompt: string;
  answer: string;
  tokensUsed: number;
  timestamp: number;
  tags: string[];
  importance: number; // 0-1, computed automatically
  compressed?: boolean;
  summary?: string;
}

export interface SemanticMemoryEntry {
  id: string;
  agentId: string;
  content: string;
  source: "episodic" | "document" | "user" | "web";
  embedding?: number[]; // For future Qdrant integration
  keywords: string[];
  timestamp: number;
  score?: number; // Set during search results
}

export interface ProceduralMemoryEntry {
  id: string;
  agentId: string | "global"; // global = shared across all agents
  name: string;
  description: string;
  trigger: string; // Pattern that triggers this procedure
  steps: string[];
  successCount: number;
  failureCount: number;
  lastUsed: number;
  category: string;
}

export interface MemorySearchResult {
  id: string;
  content: string;
  score: number;
  tier: "working" | "episodic" | "semantic" | "procedural";
  timestamp: number;
  agentId: string;
}

// ─── IndexedDB helpers (browser-safe) ────────────────────────────────────────

const DB_NAME = "norys-memory";
const DB_VERSION = 1;

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available (SSR context)"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      // Episodic store
      if (!db.objectStoreNames.contains("episodic")) {
        const store = db.createObjectStore("episodic", { keyPath: "id" });
        store.createIndex("agentId", "agentId");
        store.createIndex("timestamp", "timestamp");
        store.createIndex("tags", "tags", { multiEntry: true });
      }
      // Semantic store
      if (!db.objectStoreNames.contains("semantic")) {
        const store = db.createObjectStore("semantic", { keyPath: "id" });
        store.createIndex("agentId", "agentId");
        store.createIndex("timestamp", "timestamp");
      }
      // Procedural store
      if (!db.objectStoreNames.contains("procedural")) {
        const store = db.createObjectStore("procedural", { keyPath: "id" });
        store.createIndex("agentId", "agentId");
        store.createIndex("trigger", "trigger");
      }
    };
  });
}

async function dbGet<T>(storeName: string, agentId: string, limit = 100): Promise<T[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const index = store.index("agentId");
      const req = index.getAll(agentId, limit);
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function dbPut(storeName: string, entry: unknown): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch { /* ignore on SSR */ }
}

async function dbDelete(storeName: string, id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch { /* ignore on SSR */ }
}

// ─── BM25-like scoring ────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\sàâäéèêëïîôùûüç]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function computeTF(tokens: string[], term: string): number {
  const count = tokens.filter((t) => t === term).length;
  return count / tokens.length;
}

function bm25Score(query: string, document: string, avgDocLength = 50): number {
  const k1 = 1.5;
  const b = 0.75;

  const queryTokens = tokenize(query);
  const docTokens = tokenize(document);
  const docLength = docTokens.length;

  let score = 0;
  for (const term of queryTokens) {
    const tf = computeTF(docTokens, term);
    const idf = Math.log(1 + (100 - 1 + 0.5) / (1 + tf * 100 + 0.5)); // simplified
    const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLength / avgDocLength)));
    score += idf * tfNorm;
  }
  return score;
}

function extractKeywords(text: string, topN = 10): string[] {
  const tokens = tokenize(text);
  const freq = new Map<string, number>();
  const stopWords = new Set(["les", "des", "une", "est", "que", "qui", "dans", "pour", "par", "sur", "avec", "the", "and", "for", "that", "this", "from"]);

  for (const t of tokens) {
    if (!stopWords.has(t)) freq.set(t, (freq.get(t) ?? 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([w]) => w);
}

function computeImportance(entry: EpisodicMemoryEntry): number {
  let score = 0;
  // Long answers → more important
  score += Math.min(entry.answer.length / 2000, 0.3);
  // Tags boost importance
  score += Math.min(entry.tags.length * 0.05, 0.2);
  // Recency boost (last 24h)
  const age = Date.now() - entry.timestamp;
  if (age < 86400000) score += 0.3;
  else if (age < 604800000) score += 0.15;
  // Token usage as proxy for complexity
  score += Math.min(entry.tokensUsed / 5000, 0.2);
  return Math.min(score, 1);
}

// ─── MemoryStore class ───────────────────────────────────────────────────────

export class MemoryStore {
  // Tier 1 — Working Memory (RAM)
  private working = new Map<string, WorkingMemoryEntry>();
  private workingTTL = 30 * 60 * 1000; // 30 minutes
  private maxWorkingPerAgent = 50;

  // ─── Tier 1: Working Memory ────────────────────────────────────────────────

  setWorking(key: string, value: unknown, agentId: string, ttlMs?: number) {
    const agentKeys = [...this.working.values()].filter((e) => e.agentId === agentId);

    // Evict oldest if over limit
    if (agentKeys.length >= this.maxWorkingPerAgent) {
      const oldest = agentKeys.sort((a, b) => a.createdAt - b.createdAt)[0];
      this.working.delete(oldest.key);
    }

    this.working.set(`${agentId}:${key}`, {
      key,
      value,
      agentId,
      createdAt: Date.now(),
      expiresAt: Date.now() + (ttlMs ?? this.workingTTL),
      accessCount: 0,
    });
  }

  getWorking(key: string, agentId: string): unknown | null {
    const entry = this.working.get(`${agentId}:${key}`);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.working.delete(`${agentId}:${key}`);
      return null;
    }
    entry.accessCount++;
    return entry.value;
  }

  clearWorking(agentId: string) {
    for (const [k, v] of this.working) {
      if (v.agentId === agentId) this.working.delete(k);
    }
  }

  getWorkingAll(agentId: string): WorkingMemoryEntry[] {
    const now = Date.now();
    return [...this.working.values()].filter((e) => e.agentId === agentId && e.expiresAt > now);
  }

  // ─── Tier 2: Episodic Memory ────────────────────────────────────────────────

  async saveEpisodic(entry: Omit<EpisodicMemoryEntry, "id" | "importance">): Promise<string> {
    const id = `ep-${entry.agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const full: EpisodicMemoryEntry = {
      ...entry,
      id,
      importance: computeImportance({ ...entry, id, importance: 0 }),
    };
    await dbPut("episodic", full);

    // Also index key phrases into semantic memory
    await this.saveSemanticFromEpisodic(full);

    return id;
  }

  async getEpisodic(agentId: string, limit = 50): Promise<EpisodicMemoryEntry[]> {
    const all = await dbGet<EpisodicMemoryEntry>("episodic", agentId, limit);
    return all.sort((a, b) => b.timestamp - a.timestamp);
  }

  async deleteEpisodic(id: string) {
    await dbDelete("episodic", id);
  }

  async compressOldEpisodic(agentId: string, olderThanDays = 7) {
    const all = await this.getEpisodic(agentId, 1000);
    const cutoff = Date.now() - olderThanDays * 86400000;
    const old = all.filter((e) => e.timestamp < cutoff && !e.compressed);

    for (const entry of old) {
      // Compress: keep summary only
      const compressed: EpisodicMemoryEntry = {
        ...entry,
        compressed: true,
        answer: "",
        summary: `[Résumé] ${entry.answer.slice(0, 200)}…`,
      };
      await dbPut("episodic", compressed);
    }
  }

  // ─── Tier 3: Semantic Memory ────────────────────────────────────────────────

  async saveSemanticFromEpisodic(ep: EpisodicMemoryEntry) {
    const content = `Q: ${ep.prompt}\nR: ${ep.answer}`;
    await this.saveSemantic({
      agentId: ep.agentId,
      content,
      source: "episodic",
      keywords: extractKeywords(content),
    });
  }

  async saveSemantic(entry: Omit<SemanticMemoryEntry, "id" | "timestamp">): Promise<string> {
    const id = `sem-${entry.agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const full: SemanticMemoryEntry = { ...entry, id, timestamp: Date.now() };
    await dbPut("semantic", full);
    return id;
  }

  async searchSemantic(query: string, agentId: string, limit = 5): Promise<SemanticMemoryEntry[]> {
    const all = await dbGet<SemanticMemoryEntry>("semantic", agentId, 500);
    const scored = all
      .map((entry) => ({ ...entry, score: bm25Score(query, entry.content) }))
      .filter((e) => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return scored;
  }

  // ─── Tier 4: Procedural Memory ─────────────────────────────────────────────

  async saveProcedural(entry: Omit<ProceduralMemoryEntry, "id">): Promise<string> {
    const id = `proc-${entry.agentId}-${Date.now()}`;
    const full: ProceduralMemoryEntry = { ...entry, id };
    await dbPut("procedural", full);
    return id;
  }

  async getProcedural(agentId: string): Promise<ProceduralMemoryEntry[]> {
    const own = await dbGet<ProceduralMemoryEntry>("procedural", agentId, 100);
    const global = await dbGet<ProceduralMemoryEntry>("procedural", "global", 100);
    return [...global, ...own];
  }

  async matchProcedural(trigger: string, agentId: string): Promise<ProceduralMemoryEntry[]> {
    const all = await this.getProcedural(agentId);
    return all
      .filter((p) => trigger.toLowerCase().includes(p.trigger.toLowerCase()) || bm25Score(trigger, p.trigger) > 0.5)
      .sort((a, b) => b.successCount - a.successCount);
  }

  async updateProceduralSuccess(id: string, success: boolean) {
    try {
      const db = await openDB();
      const tx = db.transaction("procedural", "readwrite");
      const store = tx.objectStore(db.transaction("procedural", "readonly").objectStore("procedural").name);
      const req = store.get(id);
      req.onsuccess = () => {
        if (!req.result) return;
        const entry: ProceduralMemoryEntry = req.result;
        if (success) entry.successCount++;
        else entry.failureCount++;
        entry.lastUsed = Date.now();
        store.put(entry);
      };
    } catch { /* ignore */ }
  }

  // ─── Cross-tier Search ──────────────────────────────────────────────────────

  async search(query: string, agentId: string, limit = 5): Promise<MemorySearchResult[]> {
    const results: MemorySearchResult[] = [];

    // Tier 1 — Working
    const working = this.getWorkingAll(agentId);
    for (const w of working) {
      const content = `${w.key}: ${JSON.stringify(w.value)}`;
      const score = bm25Score(query, content);
      if (score > 0.1) {
        results.push({ id: w.key, content, score: score + 0.5, tier: "working", timestamp: w.createdAt, agentId });
      }
    }

    // Tier 3 — Semantic (best BM25 hits)
    const semantic = await this.searchSemantic(query, agentId, 10);
    for (const s of semantic) {
      results.push({ id: s.id, content: s.content, score: s.score ?? 0, tier: "semantic", timestamp: s.timestamp, agentId });
    }

    // Tier 4 — Procedural patterns
    const procedures = await this.matchProcedural(query, agentId);
    for (const p of procedures.slice(0, 3)) {
      results.push({
        id: p.id,
        content: `[Procédure: ${p.name}] ${p.description}\nÉtapes: ${p.steps.join(" → ")}`,
        score: 0.6 + p.successCount * 0.05,
        tier: "procedural",
        timestamp: p.lastUsed,
        agentId,
      });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // ─── Stats ──────────────────────────────────────────────────────────────────

  getWorkingStats(agentId: string) {
    const entries = this.getWorkingAll(agentId);
    return { count: entries.length, maxCapacity: this.maxWorkingPerAgent };
  }

  async getStats(agentId: string) {
    const episodic = await this.getEpisodic(agentId, 10000);
    const semantic = await dbGet<SemanticMemoryEntry>("semantic", agentId, 10000);
    const procedural = await this.getProcedural(agentId);
    const working = this.getWorkingStats(agentId);

    return {
      working: working.count,
      episodic: episodic.length,
      semantic: semantic.length,
      procedural: procedural.length,
      totalTokens: episodic.reduce((s, e) => s + e.tokensUsed, 0),
      oldestEpisodic: episodic.length > 0 ? Math.min(...episodic.map((e) => e.timestamp)) : null,
    };
  }

  // ─── Import / Export ─────────────────────────────────────────────────────────

  async exportAgent(agentId: string): Promise<string> {
    const [episodic, semantic, procedural] = await Promise.all([
      this.getEpisodic(agentId, 10000),
      dbGet<SemanticMemoryEntry>("semantic", agentId, 10000),
      this.getProcedural(agentId),
    ]);
    return JSON.stringify({ agentId, episodic, semantic, procedural, exportedAt: Date.now() }, null, 2);
  }

  async importAgent(json: string) {
    const data = JSON.parse(json);
    for (const e of data.episodic ?? []) await dbPut("episodic", e);
    for (const s of data.semantic ?? []) await dbPut("semantic", s);
    for (const p of data.procedural ?? []) await dbPut("procedural", p);
  }

  // ─── Seeded procedures ────────────────────────────────────────────────────────

  async seedDefaultProcedures() {
    const procedures: Omit<ProceduralMemoryEntry, "id">[] = [
      {
        agentId: "global",
        name: "Diagnostic incident réseau",
        description: "Procédure de diagnostic réseau standard",
        trigger: "réseau connexion internet ping",
        steps: ["Vérifier le câble/wifi", "Ping 8.8.8.8", "Vérifier DNS", "Redémarrer box", "Contacter FAI"],
        successCount: 12,
        failureCount: 1,
        lastUsed: Date.now(),
        category: "helpdesk",
      },
      {
        agentId: "global",
        name: "Reset mot de passe AD",
        description: "Réinitialisation de mot de passe Active Directory",
        trigger: "mot de passe oublié reset accès bloqué",
        steps: ["Vérifier identité utilisateur", "Ouvrir ADUC", "Reset password", "Notifier utilisateur", "Logger ticket"],
        successCount: 45,
        failureCount: 0,
        lastUsed: Date.now(),
        category: "helpdesk",
      },
      {
        agentId: "global",
        name: "Onboarding standard",
        description: "Checklist onboarding nouvel employé",
        trigger: "nouvel employé onboarding arrivée intégration",
        steps: ["Créer compte AD", "Configurer email", "Installer poste", "Envoyer accès Norys", "Planifier formation"],
        successCount: 8,
        failureCount: 0,
        lastUsed: Date.now(),
        category: "hr",
      },
    ];

    for (const p of procedures) {
      const existing = await this.getProcedural("global");
      if (!existing.some((e) => e.name === p.name)) {
        await this.saveProcedural(p);
      }
    }
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let _store: MemoryStore | null = null;

export function getMemoryStore(): MemoryStore {
  if (!_store) {
    _store = new MemoryStore();
    // Seed default procedures asynchronously
    if (typeof window !== "undefined") {
      _store.seedDefaultProcedures().catch(() => {});
    }
  }
  return _store;
}
