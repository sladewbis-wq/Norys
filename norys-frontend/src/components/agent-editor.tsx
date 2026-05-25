"use client";

import { useState, useEffect } from "react";
import {
  Bot, Headset, Users, FileText, TrendingUp, Settings,
  Zap, BrainCircuit, Code2, Search, Shield, Star,
  BarChart2, Megaphone, BookOpen, Wrench, Cpu, AlertTriangle,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Agent, AgentInput } from "@/lib/types";
import { Button, Field, Input, Textarea } from "./ui";
import { Modal } from "./modal";
import { AgentPortraitCard, AgentPortraitEditor, getPortraitConfig, savePortraitConfig, PERSONALITY_PRESETS } from "./norys-avatar";
import { getAvailableModels, PROVIDERS_CATALOG } from "@/lib/providers-store";

// ── Legacy avatar compat exports (used by other files) ────────────────────────
export const AVATAR_ICONS = [
  { id:"Bot",          Icon:Bot,          label:"Assistant"  },
  { id:"Headset",      Icon:Headset,      label:"Support"    },
  { id:"Users",        Icon:Users,        label:"Équipe"     },
  { id:"FileText",     Icon:FileText,     label:"Documents"  },
  { id:"TrendingUp",   Icon:TrendingUp,   label:"Analytics"  },
  { id:"Settings",     Icon:Settings,     label:"DevOps"     },
  { id:"Zap",          Icon:Zap,          label:"Rapide"     },
  { id:"BrainCircuit", Icon:BrainCircuit, label:"IA"         },
  { id:"Code2",        Icon:Code2,        label:"Dev"        },
  { id:"Search",       Icon:Search,       label:"Recherche"  },
  { id:"Shield",       Icon:Shield,       label:"Sécurité"   },
  { id:"Star",         Icon:Star,         label:"Premium"    },
  { id:"BarChart2",    Icon:BarChart2,    label:"Business"   },
  { id:"Megaphone",    Icon:Megaphone,    label:"Marketing"  },
  { id:"BookOpen",     Icon:BookOpen,     label:"Formation"  },
  { id:"Wrench",       Icon:Wrench,       label:"Technique"  },
];
export const AVATAR_COLORS = [
  { id:"indigo",  value:"#6366f1", label:"Indigo"   },
  { id:"violet",  value:"#8b5cf6", label:"Violet"   },
  { id:"pink",    value:"#ec4899", label:"Rose"     },
  { id:"amber",   value:"#f59e0b", label:"Ambre"    },
  { id:"emerald", value:"#10b981", label:"Émeraude" },
  { id:"sky",     value:"#0ea5e9", label:"Ciel"     },
  { id:"red",     value:"#ef4444", label:"Rouge"    },
  { id:"slate",   value:"#64748b", label:"Ardoise"  },
];
export const CAT_DEFAULTS: Record<string,{ icon:string; color:string }> = {
  helpdesk:  { icon:"Headset",      color:"#6366f1" },
  hr:        { icon:"Users",        color:"#ec4899" },
  documents: { icon:"FileText",     color:"#f59e0b" },
  sales:     { icon:"TrendingUp",   color:"#10b981" },
  support:   { icon:"Headset",      color:"#0ea5e9" },
  devops:    { icon:"Settings",     color:"#ef4444" },
  general:   { icon:"BrainCircuit", color:"#8b5cf6" },
};
export function getAgentAvatar(agentId:string, category:string) {
  return CAT_DEFAULTS[category?.toLowerCase()] ?? CAT_DEFAULTS.general;
}
export function saveAgentAvatar(_agentId:string, _avatar:{ icon:string; color:string }) {}

// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES = ["general","helpdesk","hr","support","documents","devops","sales","marketing"];

// ── Personality helpers ───────────────────────────────────────────────────────
const TONE_OPTIONS   = ["Formel","Conversationnel","Technique","Simple"];
const PROACT_OPTIONS = ["Passif — répond aux questions","Actif — suggère des actions"];

function buildSystemPrompt(preset:string, tone:string, proact:string, custom:string) {
  const p = PERSONALITY_PRESETS.find(x=>x.id===preset);
  const base   = p ? p.prompt : "";
  const toneTx = tone   ? `\nTon de communication : ${tone.toLowerCase()}.` : "";
  const proTx  = proact ? `\nMode : ${proact.toLowerCase()}.` : "";
  const extra  = custom ? `\n\n${custom}` : "";
  return `${base}${toneTx}${proTx}${extra}`.trim();
}

// ── Editor ────────────────────────────────────────────────────────────────────
export function AgentEditor({ agent, onClose, onSaved }:{ agent:Agent|null; onClose:()=>void; onSaved:()=>void }) {
  const miiId = agent?.id ?? "__editor_new__";

  const [form, setForm] = useState<AgentInput & { is_active?:boolean }>({
    name:                    agent?.name ?? "",
    description:             agent?.description ?? "",
    category:                agent?.category ?? "general",
    system_prompt:           agent?.system_prompt ?? "",
    provider:                agent?.provider ?? null,
    model:                   agent?.model ?? null,
    temperature:             agent?.temperature ?? 0.7,
    use_rag:                 agent?.use_rag ?? false,
    requires_human_approval: agent?.requires_human_approval ?? false,
    is_active:               agent?.is_active ?? true,
  });

  const [personality, setPersonality] = useState({
    preset: "professional",
    tone:   "Formel",
    proact: PROACT_OPTIONS[0],
    custom: agent?.system_prompt ?? "",
  });

  const [availableModels, setAvailableModels] = useState<ReturnType<typeof getAvailableModels>>([]);

  useEffect(() => {
    setAvailableModels(getAvailableModels());
  }, []);

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string|null>(null);
  const [tab, setTab]       = useState<"config"|"personality"|"llm"|"avatar">("config");

  function update<K extends keyof typeof form>(key:K, value:(typeof form)[K]) {
    setForm(f=>({ ...f, [key]:value }));
  }

  async function save() {
    setSaving(true); setError(null);
    const finalPrompt = buildSystemPrompt(personality.preset, personality.tone, personality.proact, personality.custom);
    const payload = { ...form, system_prompt: finalPrompt };
    try {
      let saved:Agent;
      if (agent) {
        saved = await api.updateAgent(agent.id, payload);
        const portrait = getPortraitConfig("__editor_new__", form.category ?? "general");
        savePortraitConfig(agent.id, portrait);
      } else {
        saved = await api.createAgent(payload);
        const portrait = getPortraitConfig("__editor_new__", form.category ?? "general");
        savePortraitConfig(saved.id, portrait);
        window.dispatchEvent(new StorageEvent("storage",{ key:`norys:portrait:${saved.id}` }));
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de l'enregistrement");
      setSaving(false);
    }
  }

  async function remove() {
    if (!agent) return;
    if (!confirm(`Supprimer l'agent « ${agent.name} » ?`)) return;
    setSaving(true);
    try { await api.deleteAgent(agent.id); onSaved(); }
    catch { setSaving(false); }
  }

  return (
    <Modal
      title={agent ? "Modifier l'agent" : "Nouvel agent"}
      onClose={onClose}
      footer={
        <>
          {agent && <Button variant="danger" size="sm" onClick={remove} disabled={saving} className="mr-auto">Supprimer</Button>}
          <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={save} loading={saving}>Enregistrer</Button>
        </>
      }
    >
      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-border bg-bg-inset p-1">
        {(["config","personality","llm","avatar"] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`flex-1 rounded-lg py-1.5 text-[10px] font-semibold transition-all ${tab===t?"bg-brand text-white":"text-content-muted hover:text-content"}`}>
            {t==="config"?"Config":t==="personality"?"Perso.":t==="llm"?"LLM":"Avatar"}
          </button>
        ))}
      </div>

      {/* ── CONFIG ── */}
      {tab==="config" && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-xl border border-border bg-bg-inset p-4">
            <AgentPortraitCard agentId={miiId} category={form.category ?? "general"} size="md"/>
            <div className="min-w-0">
              <p className="font-semibold text-content truncate">{form.name||"Nom de l'agent"}</p>
              <p className="text-xs text-content-subtle">{form.category}</p>
            </div>
            <button onClick={()=>setTab("avatar")}
              className="ml-auto shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-content-muted hover:text-content transition-colors">
              Changer
            </button>
          </div>
          <Field label="Nom"><Input value={form.name} onChange={e=>update("name",e.target.value)} placeholder="Ex: Assistant RH"/></Field>
          <Field label="Description"><Input value={form.description??""} onChange={e=>update("description",e.target.value)} placeholder="Courte description"/></Field>
          <Field label="Catégorie">
            <select value={form.category} onChange={e=>update("category",e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-bg-inset px-3 text-sm text-content focus:border-brand focus:outline-none">
              {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <div className="space-y-2">
            <Toggle label="Mémoire documentaire (RAG)" checked={!!form.use_rag} onChange={v=>update("use_rag",v)}/>
            <Toggle label="Validation humaine avant actions sensibles" checked={!!form.requires_human_approval} onChange={v=>update("requires_human_approval",v)}/>
            {agent && <Toggle label="Agent actif" checked={!!form.is_active} onChange={v=>update("is_active",v)}/>}
          </div>
        </div>
      )}

      {/* ── PERSONALITY ── */}
      {tab==="personality" && (
        <div className="space-y-5">
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-content-subtle">Preset</p>
            <div className="grid grid-cols-2 gap-2">
              {PERSONALITY_PRESETS.map(p=>(
                <button key={p.id} onClick={()=>setPersonality(prev=>({ ...prev, preset:p.id }))}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    personality.preset===p.id ? "border-brand bg-brand-subtle" : "border-border bg-bg-inset hover:border-border-strong"
                  }`}>
                  <p className={`text-sm font-semibold ${personality.preset===p.id?"text-brand":"text-content"}`}>{p.label}</p>
                  <p className="mt-0.5 text-[10px] text-content-subtle">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-content-subtle">Ton</p>
            <div className="grid grid-cols-2 gap-2">
              {TONE_OPTIONS.map(t=>(
                <button key={t} onClick={()=>setPersonality(prev=>({ ...prev, tone:t }))}
                  className={`rounded-lg border py-2 text-xs font-medium transition-all ${
                    personality.tone===t ? "border-brand bg-brand-subtle text-brand" : "border-border bg-bg-inset text-content-muted hover:text-content"
                  }`}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-content-subtle">Mode</p>
            <div className="space-y-2">
              {PROACT_OPTIONS.map(o=>(
                <button key={o} onClick={()=>setPersonality(prev=>({ ...prev, proact:o }))}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition-all ${
                    personality.proact===o ? "border-brand bg-brand-subtle text-brand" : "border-border bg-bg-inset text-content-muted hover:text-content"
                  }`}>{o}</button>
              ))}
            </div>
          </div>
          <Field label="Instructions supplémentaires" hint="Ajouté après le preset">
            <Textarea rows={4} value={personality.custom}
              onChange={e=>setPersonality(prev=>({ ...prev, custom:e.target.value }))}
              placeholder="Règles spécifiques à cet agent…"/>
          </Field>
          <div className="rounded-xl border border-border bg-bg-inset p-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-content-subtle">Aperçu system prompt</p>
            <p className="text-[11px] leading-relaxed text-content-subtle whitespace-pre-wrap line-clamp-5">
              {buildSystemPrompt(personality.preset,personality.tone,personality.proact,personality.custom)||"(vide)"}
            </p>
          </div>
        </div>
      )}

      {/* ── LLM ── */}
      {tab==="llm" && (
        <LlmTab
          form={form}
          availableModels={availableModels}
          update={update}
        />
      )}

      {/* ── AVATAR ── */}
      {tab==="avatar" && (
        <div style={{ height:520 }}>
          <AgentPortraitEditor agentId={miiId} category={form.category ?? "general"} onSave={()=>setTab("config")}/>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
      )}
    </Modal>
  );
}

// ── LLM Tab ───────────────────────────────────────────────────────────────────

type FormState = AgentInput & { is_active?: boolean };

function LlmTab({
  form,
  availableModels,
  update,
}: {
  form: FormState;
  availableModels: ReturnType<typeof getAvailableModels>;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  // Group models by provider
  const grouped = availableModels.reduce<Record<string, typeof availableModels>>((acc, m) => {
    if (!acc[m.providerId]) acc[m.providerId] = [];
    acc[m.providerId].push(m);
    return acc;
  }, {});

  const providerDefs = PROVIDERS_CATALOG.reduce<Record<string, typeof PROVIDERS_CATALOG[0]>>((acc, d) => {
    acc[d.id] = d;
    return acc;
  }, {});

  // Find label for currently selected model
  const currentModelEntry = availableModels.find(m => m.modelId === form.model);
  const selectedDisplay = currentModelEntry
    ? `${currentModelEntry.providerLabel} — ${currentModelEntry.modelLabel}`
    : form.model ?? "";

  const handleSelectChange = (value: string) => {
    if (!value) { update("model", null); update("provider", null); return; }
    const entry = availableModels.find(m => m.modelId === value);
    update("model", value);
    update("provider", entry?.providerId ?? null);
  };

  return (
    <div className="space-y-5">
      {/* No models configured */}
      {availableModels.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-content">Aucun provider configuré</p>
            <p className="mt-1 text-xs text-content-subtle">
              Activez au moins un provider dans{" "}
              <strong className="text-amber-400">Admin → Providers IA</strong>{" "}
              pour pouvoir choisir un modèle.
            </p>
          </div>
        </div>
      )}

      {/* Model selector */}
      {availableModels.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-content-subtle">Modèle</p>

          {/* Pretty select */}
          <div className="relative">
            <select
              value={form.model ?? ""}
              onChange={e => handleSelectChange(e.target.value)}
              className="w-full appearance-none rounded-xl border border-border bg-bg-inset px-4 py-3 pr-10 text-sm text-content focus:border-brand focus:outline-none"
            >
              <option value="">— Choisir un modèle —</option>
              {Object.entries(grouped).map(([providerId, models]) => {
                const def = providerDefs[providerId];
                return (
                  <optgroup key={providerId} label={def ? `${def.logo} ${def.label}` : providerId}>
                    {models.map(m => (
                      <option key={m.modelId} value={m.modelId}>
                        {m.modelLabel}{m.contextK ? ` (${m.contextK}K ctx)` : ""}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <Cpu className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
          </div>

          {/* Selected model badge */}
          {form.model && currentModelEntry && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 py-2">
              <div
                className="flex h-6 w-6 items-center justify-center rounded text-xs font-bold shrink-0"
                style={{
                  background: `${providerDefs[currentModelEntry.providerId]?.color ?? "#6366f1"}20`,
                  color: providerDefs[currentModelEntry.providerId]?.color ?? "#6366f1",
                }}
              >
                {providerDefs[currentModelEntry.providerId]?.logo ?? "?"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-content truncate">{currentModelEntry.modelLabel}</p>
                <p className="text-[10px] text-content-subtle">{currentModelEntry.providerLabel}</p>
              </div>
              {currentModelEntry.contextK && (
                <span className="ml-auto shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-content-muted">
                  {currentModelEntry.contextK}K ctx
                </span>
              )}
            </div>
          )}

          {/* Free-text fallback */}
          {form.model && !currentModelEntry && (
            <div className="mt-2">
              <p className="mb-1 text-[10px] text-content-subtle">Modèle personnalisé (non détecté dans les providers)</p>
              <Input
                value={form.model}
                placeholder="model-string"
                onChange={e => update("model", e.target.value || null)}
              />
            </div>
          )}
        </div>
      )}

      {/* Custom model input when no providers */}
      {availableModels.length === 0 && (
        <Field label="Modèle (identifiant)" hint="Ex: gpt-4o · claude-sonnet-4-5 · llama3.3">
          <Input
            value={form.model ?? ""}
            placeholder="model-string"
            onChange={e => update("model", e.target.value || null)}
          />
        </Field>
      )}

      {/* Temperature */}
      <Field
        label={`Température : ${(form.temperature ?? 0.7).toFixed(1)}`}
        hint="0 = déterministe · 2 = très créatif"
      >
        <input
          type="range" min={0} max={2} step={0.1}
          value={form.temperature}
          onChange={e => update("temperature", parseFloat(e.target.value))}
          className="w-full accent-brand"
        />
        <div className="flex justify-between text-[10px] text-content-muted mt-1">
          <span>Déterministe</span>
          <span>Créatif</span>
        </div>
      </Field>

      {/* Active providers summary */}
      {availableModels.length > 0 && (
        <div className="rounded-xl border border-border bg-bg-inset p-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-content-subtle">
            Providers actifs ({Object.keys(grouped).length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(grouped).map(pid => {
              const def = providerDefs[pid];
              return (
                <span
                  key={pid}
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    background: `${def?.color ?? "#6366f1"}18`,
                    color: def?.color ?? "#6366f1",
                  }}
                >
                  {def?.logo} {def?.label ?? pid}
                </span>
              );
            })}
          </div>
          <p className="text-[10px] text-content-muted">
            Gérez les providers dans <strong>Admin → Providers IA</strong>
          </p>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }:{ label:string; checked:boolean; onChange:(v:boolean)=>void }) {
  return (
    <button type="button" onClick={()=>onChange(!checked)}
      className="flex w-full items-center justify-between rounded-lg border border-border bg-bg-inset px-3 py-2.5 text-left text-sm text-content">
      {label}
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked?"bg-brand":"bg-border-strong"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked?"translate-x-4":"translate-x-0.5"}`}/>
      </span>
    </button>
  );
}
