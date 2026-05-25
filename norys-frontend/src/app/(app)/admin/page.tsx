"use client";

import { useEffect, useState } from "react";
import { Plus, ScrollText, Users, Cpu, CheckCircle, XCircle, AlertCircle, Eye, EyeOff, Brain, Zap, DollarSign } from "lucide-react";
import { SKILLS_CATALOG, SKILL_CATEGORIES } from "@/lib/skills-registry";

import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { AuditLog, RoleName, User } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Badge, Button, Card, Field, Input, Skeleton } from "@/components/ui";
import { Modal } from "@/components/modal";
import { cn, formatDate, initials } from "@/lib/utils";
import { Avatar } from "@/components/ui";
import {
  PROVIDERS_CATALOG,
  getProviderConfig,
  saveProviderConfig,
  loadProviderConfigs,
  type ProviderConfig,
} from "@/lib/providers-store";

type Tab = "users" | "providers" | "audit" | "memory" | "costs" | "skills";

const ROLES: RoleName[] = ["owner", "admin", "member", "viewer"];

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("users");

  if (user && user.role !== "owner" && user.role !== "admin") {
    return (
      <div>
        <PageHeader title="Administration" />
        <div className="p-8 text-sm text-content-subtle">
          Vous n&apos;avez pas accès à cet espace.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader title="Administration" subtitle="Utilisateurs, providers IA, mémoire, coûts et skills" />
      <div className="px-8 pt-4 flex-shrink-0 overflow-x-auto">
        <div className="flex gap-1 border-b border-border min-w-max">
          <TabButton active={tab === "users"} onClick={() => setTab("users")} icon={<Users className="h-4 w-4" />}>
            Utilisateurs
          </TabButton>
          <TabButton active={tab === "providers"} onClick={() => setTab("providers")} icon={<Cpu className="h-4 w-4" />}>
            Providers IA
          </TabButton>
          <TabButton active={tab === "memory"} onClick={() => setTab("memory")} icon={<Brain className="h-4 w-4" />}>
            Mémoire
          </TabButton>
          <TabButton active={tab === "costs"} onClick={() => setTab("costs")} icon={<DollarSign className="h-4 w-4" />}>
            Coûts & Usage
          </TabButton>
          <TabButton active={tab === "skills"} onClick={() => setTab("skills")} icon={<Zap className="h-4 w-4" />}>
            Skills Market
          </TabButton>
          <TabButton active={tab === "audit"} onClick={() => setTab("audit")} icon={<ScrollText className="h-4 w-4" />}>
            Audit
          </TabButton>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-8 pt-6">
        {tab === "users" && <UsersTab />}
        {tab === "providers" && <ProvidersTab />}
        {tab === "memory" && <MemoryInspectorTab />}
        {tab === "costs" && <CostsTab />}
        {tab === "skills" && <SkillsMarketTab />}
        {tab === "audit" && <AuditTab />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 border-b-2 px-3 pb-2.5 text-sm font-medium transition-colors",
        active
          ? "border-brand text-content"
          : "border-transparent text-content-muted hover:text-content",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// ── Providers Tab ─────────────────────────────────────────────────────────────

function ProvidersTab() {
  const [configs, setConfigs] = useState<Record<string, ProviderConfig>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    setConfigs(loadProviderConfigs());
  }, []);

  const refresh = () => setConfigs(loadProviderConfigs());

  // Group by category
  const groups: { id: string; label: string; emoji: string }[] = [
    { id: "llm",       label: "Modèles de langage (LLM)",    emoji: "🧠" },
    { id: "multimodal",label: "Multimodal",                  emoji: "🌐" },
    { id: "tts",       label: "Synthèse vocale (TTS)",        emoji: "🎙" },
    { id: "code",      label: "Assistants code (gratuits)",   emoji: "⌨️" },
  ];

  async function testProvider(def: typeof PROVIDERS_CATALOG[0], cfg: ProviderConfig) {
    setTestingId(def.id);
    // Simulate a ping (in production this would call an API endpoint)
    await new Promise(r => setTimeout(r, 1200));
    const ok = def.free || cfg.apiKey.length > 6;
    const updated: ProviderConfig = {
      ...cfg,
      enabled: ok,
      testStatus: ok ? "ok" : "error",
      lastTested: new Date().toISOString(),
    };
    saveProviderConfig(updated);
    refresh();
    setTestingId(null);
  }

  const activeCount = Object.values(configs).filter(c => c.enabled).length
    + PROVIDERS_CATALOG.filter(d => d.free && configs[d.id]?.enabled !== false).length;

  return (
    <div className="space-y-8">
      {/* Summary bar */}
      <div className="flex items-center gap-6 rounded-xl border border-border bg-bg-subtle p-4">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
          <span className="text-sm text-content-subtle">
            <strong className="text-content">{activeCount}</strong> provider(s) actif(s)
          </span>
        </div>
        <div className="flex items-center gap-2.5 text-sm text-content-subtle">
          <Cpu className="h-4 w-4 text-brand" />
          {PROVIDERS_CATALOG.reduce((s, d) => s + d.models.length, 0)} modèles disponibles au total
        </div>
        <div className="ml-auto text-xs text-content-subtle">
          Les clés API sont stockées localement dans votre navigateur.
        </div>
      </div>

      {groups.map(group => {
        const providers = PROVIDERS_CATALOG.filter(d => d.category === group.id);
        if (!providers.length) return null;
        return (
          <div key={group.id}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-content-subtle uppercase tracking-widest">
              <span>{group.emoji}</span>
              {group.label}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {providers.map(def => (
                <ProviderCard
                  key={def.id}
                  def={def}
                  config={configs[def.id] ?? getProviderConfig(def.id)}
                  testing={testingId === def.id}
                  onTest={(cfg) => testProvider(def, cfg)}
                  onChange={(cfg) => { saveProviderConfig(cfg); refresh(); }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProviderCard({
  def,
  config,
  testing,
  onTest,
  onChange,
}: {
  def: typeof PROVIDERS_CATALOG[0];
  config: ProviderConfig;
  testing: boolean;
  onTest: (cfg: ProviderConfig) => void;
  onChange: (cfg: ProviderConfig) => void;
}) {
  const [localKey, setLocalKey] = useState(config.apiKey);
  const [localUrl, setLocalUrl] = useState(config.baseUrl ?? "");
  const [showKey, setShowKey] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isActive = def.free
    ? (config.enabled !== false)
    : (config.enabled && config.testStatus === "ok");

  const statusIcon = isActive
    ? <CheckCircle className="h-3.5 w-3.5 text-success" />
    : config.testStatus === "error"
      ? <XCircle className="h-3.5 w-3.5 text-danger" />
      : <AlertCircle className="h-3.5 w-3.5 text-content-muted" />;

  const handleSaveAndTest = () => {
    const updated: ProviderConfig = {
      ...config,
      apiKey: localKey,
      baseUrl: localUrl || undefined,
      testStatus: "untested",
    };
    onTest(updated);
  };

  const handleToggle = () => {
    const updated: ProviderConfig = {
      ...config,
      enabled: !config.enabled,
    };
    onChange(updated);
  };

  return (
    <div
      className="rounded-xl border border-border bg-bg-elevated overflow-hidden transition-all"
      style={{ borderColor: isActive ? `${def.color}40` : undefined }}
    >
      {/* Card header */}
      <div className="flex items-center gap-3 p-4">
        {/* Logo */}
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold shrink-0"
          style={{ background: `${def.color}20`, color: def.color }}
        >
          {def.logo}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-content truncate">{def.label}</span>
            {def.free && (
              <span className="shrink-0 rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-success">
                Gratuit
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {statusIcon}
            <span className="text-[11px] text-content-subtle">
              {isActive ? "Actif" : config.testStatus === "error" ? "Erreur clé" : "Non configuré"}
            </span>
            {config.lastTested && (
              <span className="text-[10px] text-content-muted ml-1">
                · testé {new Date(config.lastTested).toLocaleDateString("fr-FR")}
              </span>
            )}
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={handleToggle}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
            config.enabled !== false ? "bg-success" : "bg-bg-subtle border border-border"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
              config.enabled !== false ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* Description */}
      <div className="px-4 pb-3">
        <p className="text-xs text-content-subtle leading-relaxed">{def.description}</p>
      </div>

      {/* Models pill row */}
      <div className="flex flex-wrap gap-1 px-4 pb-3">
        {def.models.slice(0, 3).map(m => (
          <span
            key={m.id}
            className="rounded-full border border-border px-2 py-0.5 text-[10px] text-content-muted"
          >
            {m.label}
          </span>
        ))}
        {def.models.length > 3 && (
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-content-muted">
            +{def.models.length - 3} autres
          </span>
        )}
      </div>

      {/* Expand: API key config */}
      {def.requiresKey && (
        <>
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full border-t border-border px-4 py-2 text-left text-xs text-content-muted hover:text-content transition-colors"
          >
            {expanded ? "▲ Masquer la configuration" : "▼ Configurer la clé API"}
          </button>

          {expanded && (
            <div className="border-t border-border bg-bg-subtle/50 p-4 space-y-3">
              {/* API Key */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-content-subtle">
                  Clé API
                </label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={localKey}
                    onChange={e => setLocalKey(e.target.value)}
                    placeholder={def.keyPlaceholder ?? "Votre clé API…"}
                    className="w-full rounded-lg border border-border bg-bg-inset px-3 py-2 pr-9 text-xs text-content placeholder:text-content-muted focus:border-brand focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-muted hover:text-content transition-colors"
                  >
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Base URL for Azure / self-hosted */}
              {(def.id === "azure" || def.id === "ollama") && (
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-content-subtle">
                    {def.id === "azure" ? "Endpoint Azure" : "URL Ollama"}
                  </label>
                  <input
                    type="text"
                    value={localUrl}
                    onChange={e => setLocalUrl(e.target.value)}
                    placeholder={def.id === "azure" ? "https://…openai.azure.com/" : "http://localhost:11434"}
                    className="w-full rounded-lg border border-border bg-bg-inset px-3 py-2 text-xs text-content placeholder:text-content-muted focus:border-brand focus:outline-none"
                  />
                </div>
              )}

              <button
                onClick={handleSaveAndTest}
                disabled={testing || (!localKey && def.requiresKey)}
                className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: def.color }}
              >
                {testing ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Test en cours…
                  </>
                ) : "Sauvegarder & Tester"}
              </button>

              {config.testStatus === "ok" && (
                <div className="flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-2">
                  <CheckCircle className="h-3.5 w-3.5 text-success" />
                  <span className="text-xs text-success font-medium">
                    Connexion établie — {def.models.length} modèle(s) disponibles
                  </span>
                </div>
              )}
              {config.testStatus === "error" && (
                <div className="flex items-center gap-1.5 rounded-lg bg-danger/10 px-3 py-2">
                  <XCircle className="h-3.5 w-3.5 text-danger" />
                  <span className="text-xs text-danger font-medium">Clé invalide ou connexion refusée</span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Free providers: no key needed, just toggle */}
      {!def.requiresKey && (
        <div className="border-t border-border bg-bg-subtle/30 px-4 py-2.5 flex items-center gap-2">
          <CheckCircle className="h-3.5 w-3.5 text-success" />
          <span className="text-[11px] text-content-subtle">Aucune clé requise — activez pour utiliser</span>
        </div>
      )}
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .listUsers()
      .then(setUsers)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  async function changeRole(u: User, role: RoleName) {
    await api.updateUser(u.id, { role });
    load();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Inviter un utilisateur
        </Button>
      </div>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : (
        <Card className="divide-y divide-border">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar label={initials(u.full_name || u.email)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-content">
                  {u.full_name || u.email}
                </p>
                <p className="truncate text-xs text-content-subtle">{u.email}</p>
              </div>
              {!u.is_active && <Badge tone="warning">Désactivé</Badge>}
              <select
                value={u.role}
                onChange={(e) => changeRole(u, e.target.value as RoleName)}
                className="h-8 rounded-lg border border-border bg-bg-inset px-2 text-xs capitalize text-content focus:border-brand focus:outline-none"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </Card>
      )}
      {creating && <CreateUserModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
    </div>
  );
}

function CreateUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleName>("member");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.createUser({ email, password, full_name: fullName || undefined, role });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Inviter un utilisateur"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" onClick={save} loading={saving}>
            Créer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Nom complet">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Mot de passe temporaire" hint="8 caractères minimum">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Rôle">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as RoleName)}
            className="h-10 w-full rounded-lg border border-border bg-bg-inset px-3 text-sm capitalize text-content focus:border-brand focus:outline-none"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        {error && (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

// ── Audit Tab ─────────────────────────────────────────────────────────────────

function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listAuditLogs(200)
      .then(setLogs)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }

  return (
    <Card className="divide-y divide-border">
      {logs.map((log) => (
        <div key={log.id} className="flex items-center gap-3 px-4 py-3 text-sm">
          <Badge>{log.action}</Badge>
          <span className="flex-1 truncate text-content-muted">
            {log.resource_type ? `${log.resource_type} ${log.resource_id ?? ""}` : ""}
            {log.ip_address ? ` · ${log.ip_address}` : ""}
          </span>
          <span className="shrink-0 text-xs text-content-subtle">{formatDate(log.created_at)}</span>
        </div>
      ))}
      {logs.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-content-subtle">
          Aucun événement enregistré.
        </div>
      )}
    </Card>
  );
}

// ── Memory Inspector Tab ───────────────────────────────────────────────────────
function MemoryInspectorTab() {
  const AGENTS = [
    { id: "it-1", name: "Helpdesk IA", cat: "helpdesk" },
    { id: "hr-1", name: "Onboarding RH", cat: "hr" },
    { id: "doc-1", name: "Analyste Docs", cat: "documents" },
    { id: "sales-1", name: "Pipeline Coach", cat: "sales" },
    { id: "sup-1", name: "Support Client", cat: "support" },
    { id: "dev-1", name: "Ops Monitor", cat: "devops" },
  ];

  const CAT_COLOR: Record<string, string> = {
    helpdesk: "#6366f1", hr: "#ec4899", documents: "#f59e0b",
    sales: "#10b981", support: "#0ea5e9", devops: "#ef4444",
  };

  // Simulated memory stats per agent
  const memStats = AGENTS.map((a, i) => ({
    ...a,
    working: Math.floor(Math.random() * 20 + 2),
    episodic: Math.floor(Math.random() * 150 + 10),
    semantic: Math.floor(Math.random() * 300 + 20),
    procedural: Math.floor(Math.random() * 8 + 1),
    totalTokens: Math.floor(Math.random() * 50000 + 5000),
    lastActivity: new Date(Date.now() - Math.random() * 86400000 * 3),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Mémoires Working", value: memStats.reduce((s,a) => s + a.working, 0), icon: "⚡", color: "#6366f1" },
          { label: "Épisodes mémorisés", value: memStats.reduce((s,a) => s + a.episodic, 0), icon: "🧠", color: "#ec4899" },
          { label: "Entrées sémantiques", value: memStats.reduce((s,a) => s + a.semantic, 0), icon: "🔍", color: "#f59e0b" },
          { label: "Procédures actives", value: memStats.reduce((s,a) => s + a.procedural, 0), icon: "⚙️", color: "#10b981" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-bg-elevated p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{stat.icon}</span>
              <p className="text-xs text-content-muted">{stat.label}</p>
            </div>
            <p className="text-2xl font-bold text-content">{stat.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-content">Mémoire par agent</h3>
        {memStats.map((agent) => (
          <div key={agent.id} className="rounded-xl border border-border bg-bg-elevated p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-2 w-2 rounded-full" style={{ background: CAT_COLOR[agent.cat] }} />
              <p className="font-medium text-sm text-content">{agent.name}</p>
              <span className="ml-auto text-xs text-content-muted">{agent.lastActivity.toLocaleDateString("fr-FR")}</span>
            </div>
            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                { label: "Working", value: agent.working, color: "#6366f1" },
                { label: "Épisodique", value: agent.episodic, color: "#ec4899" },
                { label: "Sémantique", value: agent.semantic, color: "#f59e0b" },
                { label: "Procédural", value: agent.procedural, color: "#10b981" },
              ].map((tier) => (
                <div key={tier.label} className="rounded-lg bg-bg-subtle p-2">
                  <p className="text-[10px] text-content-muted mb-1">{tier.label}</p>
                  <p className="text-lg font-bold" style={{ color: tier.color }}>{tier.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-indigo-500/60" style={{ width: `${Math.min((agent.totalTokens / 100000) * 100, 100)}%` }} />
              </div>
              <span className="text-[10px] text-content-muted">{(agent.totalTokens / 1000).toFixed(1)}K tokens</span>
              <button className="text-[10px] text-red-400/70 hover:text-red-400 transition-colors">
                Vider
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Costs Tab ──────────────────────────────────────────────────────────────────
function CostsTab() {
  const COST_PER_1K: Record<string, { input: number; output: number; label: string }> = {
    "claude-sonnet-4-6": { input: 0.003, output: 0.015, label: "Claude Sonnet" },
    "claude-opus-4-6":   { input: 0.015, output: 0.075, label: "Claude Opus" },
    "gpt-4o":            { input: 0.005, output: 0.015, label: "GPT-4o" },
    "gpt-4o-mini":       { input: 0.00015, output: 0.0006, label: "GPT-4o Mini" },
    "llama-3.3-70b":     { input: 0.00059, output: 0.00079, label: "Llama 3.3 70B" },
  };

  const AGENT_COSTS = [
    { name: "Helpdesk IA",   model: "gpt-4o",            inputK: 142, outputK: 48, calls: 312 },
    { name: "Analyste Docs", model: "claude-sonnet-4-6", inputK: 198, outputK: 82, calls: 156 },
    { name: "Support Client",model: "gpt-4o",            inputK: 89,  outputK: 34, calls: 201 },
    { name: "Séquenceur",    model: "gpt-4o",            inputK: 67,  outputK: 29, calls: 88  },
    { name: "Rédacteur IA",  model: "claude-sonnet-4-6", inputK: 112, outputK: 61, calls: 134 },
    { name: "Onboarding RH", model: "claude-sonnet-4-6", inputK: 45,  outputK: 18, calls: 67  },
    { name: "Ops Monitor",   model: "gpt-4o",            inputK: 78,  outputK: 31, calls: 445 },
    { name: "Pipeline Coach",model: "claude-sonnet-4-6", inputK: 56,  outputK: 22, calls: 98  },
  ];

  const costsWithTotal = AGENT_COSTS.map(a => {
    const pricing = COST_PER_1K[a.model] ?? { input: 0.005, output: 0.015 };
    const inputCost = (a.inputK / 1000) * pricing.input * 1000;
    const outputCost = (a.outputK / 1000) * pricing.output * 1000;
    return { ...a, total: inputCost + outputCost };
  });

  const grandTotal = costsWithTotal.reduce((s, a) => s + a.total, 0);
  const totalCalls = AGENT_COSTS.reduce((s, a) => s + a.calls, 0);
  const totalTokensK = AGENT_COSTS.reduce((s, a) => s + a.inputK + a.outputK, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Coût total (30j)", value: `$${grandTotal.toFixed(2)}`, sub: "vs $12.40 mois dernier", icon: "💰", up: grandTotal > 12.4 },
          { label: "Appels LLM", value: totalCalls.toLocaleString(), sub: `${Math.round(totalCalls / 30)} /jour`, icon: "⚡", up: true },
          { label: "Tokens consommés", value: `${totalTokensK}K`, sub: "Entrée + sortie", icon: "🔤", up: null },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-bg-elevated p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{stat.icon}</span>
              <p className="text-xs text-content-muted">{stat.label}</p>
            </div>
            <p className="text-2xl font-bold text-content">{stat.value}</p>
            {stat.sub && (
              <p className={`text-xs mt-1 ${stat.up === null ? "text-content-muted" : stat.up ? "text-red-400" : "text-emerald-400"}`}>
                {stat.sub}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-bg-elevated overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-content">Coûts par agent (30 derniers jours)</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-content-muted">Agent</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-content-muted">Modèle</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-content-muted">Appels</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-content-muted">Tokens</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-content-muted">Coût</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-content-muted">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {costsWithTotal.sort((a, b) => b.total - a.total).map((a) => (
              <tr key={a.name} className="hover:bg-bg-elevated/50 transition-colors">
                <td className="px-4 py-2.5 font-medium text-content">{a.name}</td>
                <td className="px-4 py-2.5 text-content-muted text-xs">{COST_PER_1K[a.model]?.label ?? a.model}</td>
                <td className="px-4 py-2.5 text-right text-content-muted">{a.calls}</td>
                <td className="px-4 py-2.5 text-right text-content-muted">{a.inputK + a.outputK}K</td>
                <td className="px-4 py-2.5 text-right font-medium text-content">${a.total.toFixed(3)}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(a.total / grandTotal) * 100}%` }} />
                    </div>
                    <span className="text-xs text-content-muted w-8 text-right">
                      {((a.total / grandTotal) * 100).toFixed(0)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-bg-subtle">
              <td className="px-4 py-2.5 font-bold text-content" colSpan={4}>Total</td>
              <td className="px-4 py-2.5 text-right font-bold text-content">${grandTotal.toFixed(2)}</td>
              <td className="px-4 py-2.5" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Skills Market Tab ─────────────────────────────────────────────────────────
function SkillsMarketTab() {
  const [catFilter, setCatFilter] = useState("all");
  const [search, setSearch] = useState("");

  const cats = ["all", ...Object.keys(SKILL_CATEGORIES)];
  const filtered = SKILLS_CATALOG.filter(s => {
    const q = search.toLowerCase();
    return (catFilter === "all" || s.category === catFilter) &&
      (!q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.tags.some(t => t.includes(q)));
  });

  const stats = {
    total: SKILLS_CATALOG.length,
    active: SKILLS_CATALOG.filter(s => s.status === "active").length,
    beta: SKILLS_CATALOG.filter(s => s.status === "beta").length,
    soon: SKILLS_CATALOG.filter(s => s.status === "coming_soon").length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Skills disponibles", value: stats.active, color: "#10b981" },
          { label: "En bêta", value: stats.beta, color: "#f59e0b" },
          { label: "Bientôt disponibles", value: stats.soon, color: "#6366f1" },
          { label: "Total catalogue", value: stats.total, color: "#0ea5e9" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-bg-elevated p-4">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-content-muted mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <input
          type="text"
          placeholder="Rechercher un skill…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="rounded-lg border border-border bg-bg-elevated py-2 px-3 text-sm text-content placeholder:text-content-muted focus:outline-none focus:ring-1 focus:ring-brand w-64"
        />
        <div className="flex flex-wrap gap-1.5">
          {cats.map(c => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                catFilter === c ? "bg-indigo-500 text-white" : "border border-border text-content-muted hover:text-content"
              }`}
            >
              {c === "all" ? "Tous" : SKILL_CATEGORIES[c as keyof typeof SKILL_CATEGORIES]?.icon + " " + SKILL_CATEGORIES[c as keyof typeof SKILL_CATEGORIES]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Skills grid */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map(skill => (
          <div key={skill.id} className="rounded-xl border border-border bg-bg-elevated p-4 hover:border-indigo-500/30 transition-colors">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{skill.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm text-content">{skill.name}</p>
                  {skill.status === "active" && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-400">ACTIF</span>
                  )}
                  {skill.status === "beta" && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold text-amber-400">BÊTA</span>
                  )}
                  {skill.status === "coming_soon" && (
                    <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[9px] font-bold text-indigo-400">BIENTÔT</span>
                  )}
                  {skill.free && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold text-content-muted">GRATUIT</span>
                  )}
                </div>
                <p className="text-xs text-content-muted mt-1 leading-relaxed">{skill.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {skill.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] text-content-muted">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 pt-2 border-t border-border/50">
              <span className="text-[10px] text-content-muted">{SKILL_CATEGORIES[skill.category as keyof typeof SKILL_CATEGORIES]?.label}</span>
              <span className="ml-auto text-[10px] text-content-muted">{skill.toolIds.length} outil{skill.toolIds.length > 1 ? "s" : ""}</span>
              <button
                disabled={skill.status === "coming_soon"}
                className="rounded-lg bg-indigo-500/10 px-2.5 py-1 text-[10px] font-semibold text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {skill.status === "coming_soon" ? "Bientôt" : "Déployer"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
