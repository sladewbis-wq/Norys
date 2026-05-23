"use client";
import { useState } from "react";
import { CheckCircle2, ChevronRight, PlugZap, Search, Zap } from "lucide-react";
import { PageHeader } from "@/components/page-header";

type Status = "connected" | "disconnected" | "soon";
interface App { id: string; name: string; logo: string; color: string; bg: string; category: string; description: string; agents: string[]; status: Status; }

const APPS: App[] = [
  { id: "gmail", name: "Gmail", logo: "G", color: "#EA4335", bg: "rgba(234,67,53,0.12)", category: "Communication", description: "Trie ta boîte, résume les fils et rédige des réponses automatiques.", agents: ["Agent tri emails", "Agent réponses", "Agent résumé fil"], status: "disconnected" },
  { id: "outlook", name: "Outlook", logo: "O", color: "#0078D4", bg: "rgba(0,120,212,0.12)", category: "Communication", description: "Synchronise ta boîte Microsoft, gère les priorités et les relances.", agents: ["Agent tri emails", "Agent agenda", "Agent relances"], status: "disconnected" },
  { id: "teams", name: "Microsoft Teams", logo: "T", color: "#5558AF", bg: "rgba(85,88,175,0.12)", category: "Communication", description: "Transcrit les réunions, extrait les actions et rédige les comptes-rendus.", agents: ["Agent réunion", "Agent actions", "Agent compte-rendu"], status: "disconnected" },
  { id: "slack", name: "Slack", logo: "S", color: "#E01E5A", bg: "rgba(224,30,90,0.12)", category: "Communication", description: "Résume les canaux, détecte les urgences et envoie des notifications IA.", agents: ["Agent canal", "Agent alertes"], status: "disconnected" },
  { id: "gsheets", name: "Google Sheets", logo: "Σ", color: "#34A853", bg: "rgba(52,168,83,0.12)", category: "Productivité", description: "Analyse tes données, génère des rapports et détecte les anomalies.", agents: ["Agent analyse", "Agent rapport", "Agent anomalies"], status: "disconnected" },
  { id: "gdocs", name: "Google Docs", logo: "D", color: "#4285F4", bg: "rgba(66,133,244,0.12)", category: "Productivité", description: "Rédige, résume et améliore tes documents en un clic.", agents: ["Agent rédaction", "Agent résumé", "Agent révision"], status: "disconnected" },
  { id: "notion", name: "Notion", logo: "N", color: "#aaaaaa", bg: "rgba(255,255,255,0.06)", category: "Productivité", description: "Enrichit ta base de connaissances et synchronise les notes d'équipe.", agents: ["Agent notes", "Agent base de connaissance"], status: "soon" },
  { id: "gdrive", name: "Google Drive", logo: "▲", color: "#FBBC04", bg: "rgba(251,188,4,0.12)", category: "Productivité", description: "Indexe et analyse tous tes fichiers pour les rendre interrogeables.", agents: ["Agent indexation", "Agent recherche"], status: "disconnected" },
  { id: "gcalendar", name: "Google Calendar", logo: "C", color: "#4285F4", bg: "rgba(66,133,244,0.12)", category: "Réunions & Agenda", description: "Prépare tes réunions, envoie des rappels intelligents et gère l'agenda.", agents: ["Agent agenda", "Agent préparation réunion"], status: "disconnected" },
  { id: "zoom", name: "Zoom", logo: "Z", color: "#2D8CFF", bg: "rgba(45,140,255,0.12)", category: "Réunions & Agenda", description: "Transcrit et résume tes calls Zoom avec extraction d'actions.", agents: ["Agent transcription", "Agent résumé call"], status: "soon" },
  { id: "meet", name: "Google Meet", logo: "M", color: "#00897B", bg: "rgba(0,137,123,0.12)", category: "Réunions & Agenda", description: "Notes automatiques en temps réel pendant tes réunions Meet.", agents: ["Agent notes temps réel"], status: "soon" },
  { id: "hubspot", name: "HubSpot", logo: "H", color: "#FF7A59", bg: "rgba(255,122,89,0.12)", category: "CRM & Ventes", description: "Enregistre les contacts, suit le pipeline et rédige des séquences.", agents: ["Agent CRM", "Agent séquences", "Agent pipeline"], status: "soon" },
  { id: "linkedin", name: "LinkedIn", logo: "in", color: "#0A66C2", bg: "rgba(10,102,194,0.12)", category: "CRM & Ventes", description: "Rédige des posts, analyse l'audience et gère la prospection.", agents: ["Agent contenu", "Agent prospection"], status: "soon" },
];

const CATEGORIES = ["Toutes", "Communication", "Productivité", "Réunions & Agenda", "CRM & Ventes"];

export default function ApplicationsPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Toutes");
  const [selected, setSelected] = useState<App | null>(null);
  const filtered = APPS.filter((app) => {
    const matchCat = activeCategory === "Toutes" || app.category === activeCategory;
    const matchSearch = !search || app.name.toLowerCase().includes(search.toLowerCase()) || app.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });
  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col overflow-hidden">
        <PageHeader title="Applications" subtitle="Connecte tes outils pour activer les agents dédiés" />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center gap-4 rounded-xl border border-border bg-bg-subtle px-5 py-3">
            <PlugZap className="h-4 w-4 text-brand-hover" />
            <span className="text-sm text-content-subtle"><span className="font-semibold text-content">{APPS.reduce((a,b)=>a+b.agents.length,0)}</span> agents disponibles sur {APPS.length} intégrations</span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
              <input type="text" placeholder="Rechercher une application…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-border bg-bg-subtle py-2 pl-9 pr-4 text-sm text-content placeholder:text-content-muted focus:outline-none focus:ring-1 focus:ring-brand" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => setActiveCategory(cat)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${activeCategory === cat ? "bg-brand text-white" : "border border-border bg-bg-subtle text-content-muted hover:text-content"}`}>{cat}</button>
              ))}
            </div>
          </div>
          {CATEGORIES.filter((c) => c !== "Toutes").map((category) => {
            const apps = filtered.filter((a) => a.category === category);
            if (apps.length === 0) return null;
            return (
              <section key={category}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-content-subtle">{category}</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {apps.map((app) => (
                    <button key={app.id} onClick={() => setSelected(selected?.id === app.id ? null : app)} className={`group relative w-full rounded-xl border p-4 text-left transition-all hover:shadow-lg ${selected?.id === app.id ? "border-brand bg-brand-subtle shadow-md" : "border-border bg-bg-subtle hover:border-border-strong"}`}>
                      <div className="mb-3 flex items-start justify-between">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold`} style={{ backgroundColor: app.bg, color: app.color }}>{app.logo}</div>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${app.status === "connected" ? "bg-success/10 text-success" : app.status === "soon" ? "bg-border text-content-muted" : "bg-border text-content-muted"}`}>{app.status === "connected" ? "Connecté" : app.status === "soon" ? "Bientôt" : "Inactif"}</span>
                      </div>
                      <p className="text-sm font-semibold text-content">{app.name}</p>
                      <p className="mt-1 text-xs text-content-subtle line-clamp-2 leading-relaxed">{app.description}</p>
                      <div className="mt-3 flex items-center gap-1.5">
                        <Zap className="h-3 w-3 text-yellow-400" />
                        <span className="text-[11px] text-content-muted">{app.agents.length} agent{app.agents.length > 1 ? "s" : ""}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      {selected && (
        <aside className="hidden w-80 shrink-0 border-l border-border bg-bg-subtle lg:flex lg:flex-col overflow-y-auto">
          <div className="p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold" style={{ backgroundColor: selected.bg, color: selected.color }}>{selected.logo}</div>
                <div><p className="font-semibold text-content">{selected.name}</p><p className="text-xs text-content-subtle">{selected.category}</p></div>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-md p-1 text-content-muted hover:text-content">✕</button>
            </div>
            <p className="text-sm text-content-subtle leading-relaxed">{selected.description}</p>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-content-subtle">Agents inclus</p>
              <div className="space-y-2">
                {selected.agents.map((agent) => (
                  <div key={agent} className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 py-2">
                    <Zap className="h-3.5 w-3.5 shrink-0 text-yellow-400" />
                    <span className="text-sm text-content">{agent}</span>
                  </div>
                ))}
              </div>
            </div>
            {selected.status === "soon" ? (
              <div className="rounded-lg border border-border bg-bg-elevated px-4 py-3 text-center">
                <p className="text-sm font-medium text-content-muted">Bientôt disponible</p>
              </div>
            ) : (
              <button className="w-full rounded-lg py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90" style={{ backgroundColor: selected.color }}>Connecter {selected.name}</button>
            )}
            <p className="text-center text-xs text-content-subtle">Connexion sécurisée via OAuth 2.0</p>
          </div>
        </aside>
      )}
    </div>
  );
}
