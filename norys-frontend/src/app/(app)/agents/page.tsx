"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Search, Zap, Star,
  CheckCircle, Clock, BookOpen, Brain, Cpu, Save,
  Thermometer, ToggleLeft, ToggleRight, ChevronDown,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AgentPortraitCard } from "@/components/norys-avatar";
import { HabboWorld, AvatarBuilder, defaultAvatarForCategory, generateWorldAgents } from "@/components/habbo-world";
import type { AvatarConfig } from "@/components/habbo-world";
import { getAvailableModels, PROVIDERS_CATALOG } from "@/lib/providers-store";
import { getSkillsRegistry, SKILLS_CATALOG, SKILL_CATEGORIES } from "@/lib/skills-registry";

// ── Types ─────────────────────────────────────────────────────────────────────
interface StaticAgent {
  id: string;
  name: string;
  category: string;
  description: string;
  model: string;
  rag: boolean;
  validation: boolean;
  featured?: boolean;
  avatar?: AvatarConfig;
}

interface AgentConfig {
  personality: string;
  tone: "formal" | "casual" | "technical";
  proactive: boolean;
  memoryEnabled: boolean;
  model: string;
  temperature: number;
  maxTokens: number;
  rag: boolean;
  validation: boolean;
}

// ── Personality presets ───────────────────────────────────────────────────────
const PERSONALITY_PRESETS = [
  {
    id: "pro",
    label: "Professionnel",
    emoji: "💼",
    desc: "Réponses formelles, précises et orientées résultats. Idéal pour les contextes B2B.",
  },
  {
    id: "friendly",
    label: "Sympathique",
    emoji: "😊",
    desc: "Ton chaleureux et accessible. Réduit la friction et améliore l'expérience utilisateur.",
  },
  {
    id: "technical",
    label: "Technique",
    emoji: "⚙️",
    desc: "Langage précis, détails techniques, documentation exhaustive. Pour les équipes DevOps/IT.",
  },
  {
    id: "direct",
    label: "Direct",
    emoji: "⚡",
    desc: "Réponses courtes et sans détours. Efficacité maximale, zéro remplissage.",
  },
  {
    id: "creative",
    label: "Créatif",
    emoji: "✨",
    desc: "Suggestions innovantes et reformulations originales. Pour le marketing et la rédaction.",
  },
];

const DEFAULT_CONFIG = (agent: StaticAgent): AgentConfig => ({
  personality: "pro",
  tone: "formal",
  proactive: false,
  memoryEnabled: true,
  model: agent.model,
  temperature: 0.7,
  maxTokens: 2048,
  rag: agent.rag,
  validation: agent.validation,
});

function loadConfig(agentId: string, agent: StaticAgent): AgentConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG(agent);
  try {
    const raw = localStorage.getItem(`norys:agent-config:${agentId}`);
    if (!raw) return DEFAULT_CONFIG(agent);
    return { ...DEFAULT_CONFIG(agent), ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG(agent);
  }
}

function saveConfig(agentId: string, cfg: AgentConfig) {
  try {
    localStorage.setItem(`norys:agent-config:${agentId}`, JSON.stringify(cfg));
  } catch { /* ignore */ }
}

// ── Static data ───────────────────────────────────────────────────────────────
const STATIC_AGENTS: StaticAgent[] = [
  // Helpdesk IT
  {
    id: "it-1", name: "Helpdesk IA", category: "helpdesk", model: "GPT-4o", rag: true, validation: false, featured: true,
    description: "Résout les incidents IT de niveau 1 & 2, réinitialise les accès et génère les tickets automatiquement.",
  },
  {
    id: "it-2", name: "Patch Manager", category: "helpdesk", model: "Claude 3.5", rag: false, validation: true,
    description: "Planifie et documente les mises à jour système en minimisant les fenêtres de maintenance.",
  },
  {
    id: "it-3", name: "Asset Tracker", category: "helpdesk", model: "GPT-4o", rag: true, validation: false,
    description: "Inventorie le parc informatique et alerte sur les licences expirées ou les équipements obsolètes.",
  },
  // RH
  {
    id: "hr-1", name: "Onboarding RH", category: "hr", model: "Claude 3.5", rag: true, validation: true,
    description: "Guide les nouveaux employés dans les formalités administratives et l'accès aux outils.",
  },
  {
    id: "hr-2", name: "FAQ Employés", category: "hr", model: "GPT-4o", rag: true, validation: false,
    description: "Répond aux questions sur les congés, la mutuelle, la paye et le règlement intérieur.",
  },
  // Documents
  {
    id: "doc-1", name: "Analyste Docs", category: "documents", model: "Claude 3.5", rag: true, validation: false,
    description: "Extrait les informations clés de vos contrats, rapports et présentations en quelques secondes.",
  },
  {
    id: "doc-2", name: "Rédacteur IA", category: "documents", model: "GPT-4o", rag: false, validation: true,
    description: "Génère des emails, comptes-rendus, offres commerciales et rapports sur mesure.",
  },
  {
    id: "doc-3", name: "Traducteur", category: "documents", model: "GPT-4o", rag: false, validation: false,
    description: "Traduit vos documents professionnels vers 30+ langues avec préservation du formatage.",
  },
  // Sales
  {
    id: "sales-1", name: "Pipeline Coach", category: "sales", model: "Claude 3.5", rag: true, validation: false,
    description: "Analyse le CRM et suggère les prochaines actions pour faire avancer chaque opportunité.",
  },
  {
    id: "sales-2", name: "Séquenceur", category: "sales", model: "GPT-4o", rag: false, validation: true,
    description: "Écrit des séquences de prospection personnalisées par secteur et persona cible.",
  },
  // Support
  {
    id: "sup-1", name: "Support Client", category: "support", model: "GPT-4o", rag: true, validation: false,
    description: "Répond aux demandes clients 24/7 en s'appuyant sur votre base de connaissances privée.",
  },
  // DevOps
  {
    id: "dev-1", name: "Ops Monitor", category: "devops", model: "Claude 3.5", rag: false, validation: true,
    description: "Surveille les pipelines CI/CD, analyse les logs et propose des correctifs automatisés.",
  },
];

const CATEGORIES: { id: string; label: string }[] = [
  { id: "all",       label: "Tous" },
  { id: "helpdesk",  label: "Helpdesk IT" },
  { id: "hr",        label: "RH" },
  { id: "documents", label: "Documents" },
  { id: "sales",     label: "Ventes" },
  { id: "support",   label: "Support" },
  { id: "devops",    label: "DevOps" },
];

const CAT_STYLE: Record<string, { color: string; bg: string }> = {
  helpdesk:  { color: "#6366f1", bg: "rgba(99,102,241,0.12)"  },
  hr:        { color: "#ec4899", bg: "rgba(236,72,153,0.12)"  },
  documents: { color: "#f59e0b", bg: "rgba(251,191,36,0.12)"  },
  sales:     { color: "#10b981", bg: "rgba(52,211,153,0.12)"  },
  support:   { color: "#0ea5e9", bg: "rgba(14,165,233,0.12)"  },
  devops:    { color: "#ef4444", bg: "rgba(239,68,68,0.12)"   },
  general:   { color: "#8b5cf6", bg: "rgba(139,92,246,0.12)"  },
};

const CAT_LABELS: Record<string, string> = {
  helpdesk: "Helpdesk IT", hr: "RH", documents: "Documents",
  sales: "Ventes", support: "Support", devops: "DevOps", general: "Général",
};

type DetailTab = "info" | "perso" | "llm" | "avatar" | "skills";

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AgentsPage() {
  const [search, setSearch]       = useState("");
  const [cat, setCat]             = useState("all");
  const [selected, setSelected]   = useState<StaticAgent | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("info");

  const visibleAgents = STATIC_AGENTS.filter(a => {
    const matchCat    = cat === "all" || a.category === cat;
    const matchSearch = !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase()) ||
      a.category.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleSelectAgent = (id: string) => {
    if (!id) { setSelected(null); return; }
    const agent = STATIC_AGENTS.find(a => a.id === id);
    if (agent) {
      setSelected(prev => prev?.id === id ? null : agent);
      setDetailTab("info");
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <PageHeader
        title="Agents IA"
        subtitle="Votre équipe d'assistants dans leur espace de travail"
        action={
          <button className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90">
            <Plus className="h-4 w-4" />
            Créer un agent
          </button>
        }
      />

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-3 flex-shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
          <input
            type="text"
            placeholder="Rechercher un agent…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-subtle py-2 pl-9 pr-4 text-sm text-content placeholder:text-content-muted focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={cat === c.id
                ? { backgroundColor: CAT_STYLE[c.id]?.color ?? "#6366f1", color: "#fff" }
                : { border: "1px solid #2e2e38", background: "transparent", color: "#9898a8" }
              }
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs text-content-subtle flex-shrink-0">
          <span>
            <strong className="text-content">{STATIC_AGENTS.length}</strong> agents
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse-dot" />
            Tous opérationnels
          </span>
        </div>
      </div>

      {/* Main area: world + panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Habbo/Chapatiz World */}
        <div className="flex-1 overflow-hidden relative">
          <HabboWorld
            agents={generateWorldAgents(visibleAgents.map(a => ({
              id: a.id,
              name: a.name,
              category: a.category,
              state: "idle" as const,
            })))}
            selectedAgentId={selected?.id}
            onSelectAgent={handleSelectAgent}
            onOpenAgent={(id) => { handleSelectAgent(id); setDetailTab("info"); }}
          />
          {/* Legend */}
          <div className="absolute bottom-3 right-3 flex gap-2 text-[9px] text-slate-500">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Thinking</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-400" />Acting</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Done</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-400" />Error</span>
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <DetailPanel
            agent={selected}
            style={CAT_STYLE[selected.category] ?? CAT_STYLE.general}
            tab={detailTab}
            setTab={setDetailTab}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function DetailPanel({ agent, style, tab, setTab, onClose }: {
  agent: StaticAgent;
  style: { color: string; bg: string };
  tab: DetailTab;
  setTab: (t: DetailTab) => void;
  onClose: () => void;
}) {
  const [config, setConfig] = useState<AgentConfig>(() => loadConfig(agent.id, agent));
  const [saved, setSaved]   = useState(false);

  // Reload config when agent changes
  useEffect(() => {
    setConfig(loadConfig(agent.id, agent));
    setSaved(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

  const update = useCallback((patch: Partial<AgentConfig>) => {
    setConfig(prev => ({ ...prev, ...patch }));
    setSaved(false);
  }, []);

  const handleSave = () => {
    saveConfig(agent.id, config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const TABS: { id: DetailTab; label: string }[] = [
    { id: "info",   label: "Info" },
    { id: "perso",  label: "🧠 Perso" },
    { id: "llm",    label: "⚡ LLM" },
    { id: "skills", label: "🔧 Skills" },
    { id: "avatar", label: "✏️ Avatar" },
  ];

  return (
    <aside className="w-80 shrink-0 border-l border-border bg-bg-subtle flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-start justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <AgentPortraitCard agentId={agent.id} category={agent.category} size="lg" />
          <div>
            <p className="font-semibold text-content text-sm">{agent.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {agent.featured && (
                <span className="flex items-center gap-0.5 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                  <Star className="h-2 w-2" />
                  Top
                </span>
              )}
              <p className="text-xs font-medium" style={{ color: style.color }}>
                {CAT_LABELS[agent.category] ?? agent.category}
              </p>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-content-muted hover:text-content transition-colors">
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border flex-shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 text-[11px] font-medium transition-colors ${
              tab === t.id
                ? "border-b-2 border-brand text-content"
                : "text-content-muted hover:text-content"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === "info" && (
          <InfoTab agent={agent} style={style} setTab={setTab} config={config} />
        )}
        {tab === "perso" && (
          <PersonalityTab config={config} update={update} onSave={handleSave} saved={saved} />
        )}
        {tab === "llm" && (
          <LlmTab config={config} update={update} onSave={handleSave} saved={saved} />
        )}
        {tab === "skills" && (
          <SkillsTab agentId={agent.id} />
        )}
        {tab === "avatar" && (
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-content-subtle">Apparence dans le monde</p>
            <AvatarBuilderTab agentId={agent.id} category={agent.category} />
          </div>
        )}
      </div>
    </aside>
  );
}

// ── Info Tab ──────────────────────────────────────────────────────────────────
function InfoTab({ agent, style, setTab, config }: {
  agent: StaticAgent;
  style: { color: string; bg: string };
  setTab: (t: DetailTab) => void;
  config: AgentConfig;
}) {
  const preset = PERSONALITY_PRESETS.find(p => p.id === config.personality);
  return (
    <>
      <p className="text-sm text-content-subtle leading-relaxed">{agent.description}</p>

      {/* Model */}
      <div className="rounded-lg border border-border bg-bg-elevated p-3 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-content-subtle">Modèle actif</p>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-success" />
          <span className="text-sm font-medium text-content">{config.model}</span>
        </div>
        {preset && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
            <span className="text-base">{preset.emoji}</span>
            <span className="text-xs text-content-muted">{preset.label}</span>
            <span className="ml-auto text-[10px] rounded-full px-2 py-0.5 font-medium" style={{ background: style.bg, color: style.color }}>
              Temp {config.temperature}
            </span>
          </div>
        )}
      </div>

      {/* Features */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-content-subtle">Capacités</p>
        <FeatureRow icon={<Zap className="h-3.5 w-3.5 text-amber-400" />} label="Réponses temps réel" active />
        <FeatureRow icon={<BookOpen className="h-3.5 w-3.5 text-sky-400" />} label="RAG documentaire" active={config.rag} />
        <FeatureRow icon={<CheckCircle className="h-3.5 w-3.5 text-emerald-400" />} label="Validation humaine" active={config.validation} />
        <FeatureRow icon={<Clock className="h-3.5 w-3.5 text-purple-400" />} label="Historique 90 jours" active />
        <FeatureRow icon={<Brain className="h-3.5 w-3.5 text-pink-400" />} label="Mémoire projet" active={config.memoryEnabled} />
      </div>

      {/* CTA */}
      <button
        className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-all hover:opacity-90 hover:shadow-lg"
        style={{
          background: `linear-gradient(135deg, ${style.color} 0%, ${style.color}cc 100%)`,
          boxShadow: `0 4px 20px ${style.color}40`,
        }}
      >
        Démarrer une session →
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setTab("perso")}
          className="rounded-xl border border-border py-2.5 text-xs font-medium text-content-muted hover:text-content transition-colors"
        >
          🧠 Personnalité
        </button>
        <button
          onClick={() => setTab("avatar")}
          className="rounded-xl border border-border py-2.5 text-xs font-medium text-content-muted hover:text-content transition-colors"
        >
          ✏️ Avatar
        </button>
      </div>
    </>
  );
}

// ── Personality Tab ───────────────────────────────────────────────────────────
function PersonalityTab({ config, update, onSave, saved }: {
  config: AgentConfig;
  update: (p: Partial<AgentConfig>) => void;
  onSave: () => void;
  saved: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* Preset cards */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-content-subtle mb-3">
          Personnalité de base
        </p>
        <div className="space-y-2">
          {PERSONALITY_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => update({ personality: p.id })}
              className={`w-full rounded-xl border p-3 text-left transition-all ${
                config.personality === p.id
                  ? "border-brand bg-brand/10"
                  : "border-border bg-bg-elevated hover:border-border/80"
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-lg">{p.emoji}</span>
                <span className="text-xs font-semibold text-content">{p.label}</span>
                {config.personality === p.id && (
                  <CheckCircle className="ml-auto h-3.5 w-3.5 text-brand" />
                )}
              </div>
              <p className="text-[11px] text-content-muted leading-snug pl-7">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Tone */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-content-subtle mb-2">
          Registre de langage
        </p>
        <div className="flex gap-2">
          {(["formal", "casual", "technical"] as const).map(t => (
            <button
              key={t}
              onClick={() => update({ tone: t })}
              className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-all ${
                config.tone === t
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border text-content-muted hover:text-content"
              }`}
            >
              {t === "formal" ? "Formel" : t === "casual" ? "Casual" : "Technique"}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-content-subtle mb-2">Options</p>
        <ToggleRow
          label="Mode proactif"
          desc="L'agent suggère des actions sans être sollicité"
          value={config.proactive}
          onChange={v => update({ proactive: v })}
        />
        <ToggleRow
          label="Mémoire projet"
          desc="Retient le contexte entre les sessions"
          value={config.memoryEnabled}
          onChange={v => update({ memoryEnabled: v })}
        />
      </div>

      <SaveButton onSave={onSave} saved={saved} />
    </div>
  );
}

// ── LLM Tab ───────────────────────────────────────────────────────────────────
function LlmTab({ config, update, onSave, saved }: {
  config: AgentConfig;
  update: (p: Partial<AgentConfig>) => void;
  onSave: () => void;
  saved: boolean;
}) {
  const [availableModels, setAvailableModels] = useState<ReturnType<typeof getAvailableModels>>([]);

  useEffect(() => {
    setAvailableModels(getAvailableModels());
  }, []);

  // Group models by provider
  const grouped = availableModels.reduce<Record<string, typeof availableModels>>((acc, m) => {
    if (!acc[m.providerId]) acc[m.providerId] = [];
    acc[m.providerId].push(m);
    return acc;
  }, {});

  const selectedModel = availableModels.find(m => m.modelId === config.model);
  const providerDef = selectedModel ? PROVIDERS_CATALOG.find(p => p.id === selectedModel.providerId) : null;

  return (
    <div className="space-y-5">

      {/* Model selector */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-content-subtle mb-2">
          Modèle de langage
        </p>

        {availableModels.length === 0 ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-400 space-y-2">
            <p className="font-semibold">Aucun provider configuré</p>
            <p className="text-amber-300/70">Ajoutez vos clés API dans Admin → Providers IA pour activer les modèles.</p>
          </div>
        ) : (
          <div className="relative">
            <select
              value={config.model}
              onChange={e => update({ model: e.target.value })}
              className="w-full appearance-none rounded-xl border border-border bg-bg-elevated px-3 py-2.5 pr-8 text-sm text-content focus:outline-none focus:ring-1 focus:ring-brand"
            >
              {Object.entries(grouped).map(([pid, models]) => {
                const def = PROVIDERS_CATALOG.find(p => p.id === pid);
                return (
                  <optgroup key={pid} label={`${def?.logo ?? ""} ${def?.label ?? pid}`}>
                    {models.map(m => (
                      <option key={m.modelId} value={m.modelId}>
                        {m.modelLabel}
                        {m.contextK ? ` (${m.contextK}k ctx)` : ""}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
          </div>
        )}

        {/* Selected model badge */}
        {selectedModel && providerDef && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/50 bg-bg-elevated/50 px-3 py-2">
            <span className="text-base">{providerDef.logo}</span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-content truncate">{selectedModel.modelLabel}</p>
              <p className="text-[10px] text-content-muted">{providerDef.label}</p>
            </div>
            {selectedModel.contextK && (
              <span className="ml-auto shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                {selectedModel.contextK}k tokens
              </span>
            )}
          </div>
        )}

        {/* Manual model name when no providers */}
        {availableModels.length === 0 && (
          <input
            type="text"
            value={config.model}
            onChange={e => update({ model: e.target.value })}
            placeholder="Ex: gpt-4o, claude-3-5-sonnet…"
            className="mt-2 w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm text-content placeholder:text-content-muted focus:outline-none focus:ring-1 focus:ring-brand"
          />
        )}
      </div>

      {/* Temperature */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-content-subtle flex items-center gap-1">
            <Thermometer className="h-3 w-3" />
            Température
          </p>
          <span className="text-xs font-bold text-brand">{config.temperature.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={config.temperature}
          onChange={e => update({ temperature: parseFloat(e.target.value) })}
          className="w-full accent-brand"
        />
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-content-muted">Précis (0.0)</span>
          <span className="text-[10px] text-content-muted">Créatif (1.0)</span>
        </div>
      </div>

      {/* Max tokens */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-content-subtle flex items-center gap-1">
            <Cpu className="h-3 w-3" />
            Max tokens
          </p>
          <span className="text-xs font-bold text-content">{config.maxTokens.toLocaleString()}</span>
        </div>
        <input
          type="range"
          min="256"
          max="8192"
          step="256"
          value={config.maxTokens}
          onChange={e => update({ maxTokens: parseInt(e.target.value) })}
          className="w-full accent-brand"
        />
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-content-muted">256</span>
          <span className="text-[10px] text-content-muted">8 192</span>
        </div>
      </div>

      {/* RAG + Validation toggles */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-content-subtle mb-2">Comportement</p>
        <ToggleRow
          label="RAG documentaire"
          desc="Accès à la base de connaissances privée"
          value={config.rag}
          onChange={v => update({ rag: v })}
        />
        <ToggleRow
          label="Validation humaine"
          desc="Demande confirmation avant actions sensibles"
          value={config.validation}
          onChange={v => update({ validation: v })}
        />
      </div>

      <SaveButton onSave={onSave} saved={saved} />
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────
function FeatureRow({ icon, label, active }: { icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${active ? "border-border bg-bg-elevated" : "border-border/50 bg-bg-elevated/30 opacity-50"}`}>
      {icon}
      <span className="text-xs text-content">{label}</span>
      {active ? (
        <CheckCircle className="ml-auto h-3.5 w-3.5 text-success" />
      ) : (
        <span className="ml-auto text-[10px] text-content-muted">Inactif</span>
      )}
    </div>
  );
}

function ToggleRow({ label, desc, value, onChange }: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex w-full items-start gap-3 rounded-xl border border-border bg-bg-elevated p-3 text-left transition-colors hover:border-brand/30"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-content">{label}</p>
        <p className="text-[11px] text-content-muted leading-snug mt-0.5">{desc}</p>
      </div>
      {value
        ? <ToggleRight className="h-5 w-5 shrink-0 text-brand" />
        : <ToggleLeft className="h-5 w-5 shrink-0 text-content-muted" />
      }
    </button>
  );
}

function SaveButton({ onSave, saved }: { onSave: () => void; saved: boolean }) {
  return (
    <button
      onClick={onSave}
      className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${
        saved
          ? "bg-success/20 text-success border border-success/30"
          : "bg-brand text-white hover:opacity-90"
      }`}
    >
      <Save className="h-4 w-4" />
      {saved ? "✓ Sauvegardé !" : "Sauvegarder les modifications"}
    </button>
  );
}

// ── Skills Tab ────────────────────────────────────────────────────────────────
function SkillsTab({ agentId }: { agentId: string }) {
  const [registry] = useState(() => {
    if (typeof window === "undefined") return null;
    return getSkillsRegistry();
  });
  const [, forceUpdate] = useState(0);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");

  const assignedSkills = registry?.getAgentSkills(agentId) ?? [];
  const allSkills = SKILLS_CATALOG.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.name.toLowerCase().includes(q) || s.tags.some(t => t.includes(q));
    const matchCat = catFilter === "all" || s.category === catFilter;
    return matchSearch && matchCat;
  });
  const availableSkills = allSkills.filter(s => !assignedSkills.some(a => a.skill.id === s.id));

  const toggle = (skillId: string, assigned: boolean) => {
    if (!registry) return;
    if (assigned) registry.removeSkill(agentId, skillId);
    else registry.assignSkill(agentId, skillId);
    forceUpdate(n => n + 1);
  };

  const cats = ["all", ...Array.from(new Set(SKILLS_CATALOG.map(s => s.category)))];

  return (
    <div className="space-y-4">
      {/* Assigned skills */}
      {assignedSkills.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-content-subtle">
            Skills actifs ({assignedSkills.length})
          </p>
          {assignedSkills.map(({ skill, assignment }) => (
            <div key={skill.id} className="flex items-center gap-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-2.5">
              <span className="text-lg">{skill.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-content truncate">{skill.name}</p>
                <p className="text-[10px] text-content-muted truncate">{skill.description.slice(0, 50)}…</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { registry?.toggleSkill(agentId, skill.id); forceUpdate(n => n + 1); }}
                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold transition-colors ${
                    assignment.enabled ? "bg-indigo-500 text-white" : "bg-white/5 text-slate-400"
                  }`}
                >
                  {assignment.enabled ? "ON" : "OFF"}
                </button>
                <button
                  onClick={() => toggle(skill.id, true)}
                  className="rounded-md p-1 text-content-muted hover:text-red-400 transition-colors"
                  title="Retirer"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-content-subtle">
          Bibliothèque de skills
        </p>
        <input
          type="text"
          placeholder="Rechercher un skill…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg-elevated py-1.5 px-3 text-xs text-content placeholder:text-content-muted focus:outline-none focus:ring-1 focus:ring-brand"
        />
        {/* Category chips */}
        <div className="flex flex-wrap gap-1">
          {cats.map(c => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={`rounded-full px-2 py-0.5 text-[9px] font-medium transition-colors ${
                catFilter === c ? "bg-indigo-500 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              {c === "all" ? "Tous" : SKILL_CATEGORIES[c as keyof typeof SKILL_CATEGORIES]?.label ?? c}
            </button>
          ))}
        </div>
      </div>

      {/* Skill cards */}
      <div className="space-y-1.5">
        {availableSkills.slice(0, 12).map(skill => (
          <div key={skill.id} className="flex items-center gap-2.5 rounded-xl border border-border bg-bg-elevated p-2.5 hover:border-indigo-500/30 transition-colors">
            <span className="text-base">{skill.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-content truncate">{skill.name}</p>
                {skill.status === "beta" && (
                  <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-bold text-amber-400">BETA</span>
                )}
                {skill.status === "coming_soon" && (
                  <span className="rounded-full bg-slate-500/20 px-1.5 py-0.5 text-[8px] font-bold text-slate-400">BIENTÔT</span>
                )}
              </div>
              <p className="text-[10px] text-content-muted truncate">{skill.description.slice(0, 55)}…</p>
            </div>
            <button
              disabled={skill.status === "coming_soon"}
              onClick={() => toggle(skill.id, false)}
              className="shrink-0 rounded-lg bg-indigo-500/10 px-2.5 py-1 text-[9px] font-semibold text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Ajouter
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Avatar Builder Tab ─────────────────────────────────────────────────────────
function AvatarBuilderTab({ agentId, category }: { agentId: string; category: string }) {
  const AVATAR_KEY = `norys:habbo-avatar:${agentId}`;
  const [avatar, setAvatar] = useState<AvatarConfig>(() => {
    if (typeof window === "undefined") return defaultAvatarForCategory(category, 0);
    try {
      const raw = localStorage.getItem(AVATAR_KEY);
      return raw ? JSON.parse(raw) : defaultAvatarForCategory(category, 0);
    } catch {
      return defaultAvatarForCategory(category, 0);
    }
  });
  const [saved, setSaved] = useState(false);

  const handleChange = (cfg: AvatarConfig) => {
    setAvatar(cfg);
    setSaved(false);
  };

  const handleSave = () => {
    try {
      localStorage.setItem(AVATAR_KEY, JSON.stringify(avatar));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
  };

  const handleRandom = () => {
    const seed = Math.floor(Math.random() * 100);
    setAvatar(defaultAvatarForCategory(category, seed));
    setSaved(false);
  };

  return (
    <div className="space-y-3">
      <AvatarBuilder value={avatar} onChange={handleChange} compact />
      <div className="flex gap-2">
        <button
          onClick={handleRandom}
          className="flex-1 rounded-xl border border-border py-2 text-xs font-medium text-content-muted hover:text-content transition-colors"
        >
          🎲 Aléatoire
        </button>
        <button
          onClick={handleSave}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all ${
            saved ? "bg-success/20 text-success border border-success/30" : "bg-brand text-white hover:opacity-90"
          }`}
        >
          <Save className="h-3.5 w-3.5" />
          {saved ? "Sauvegardé !" : "Sauvegarder"}
        </button>
      </div>
    </div>
  );
}
