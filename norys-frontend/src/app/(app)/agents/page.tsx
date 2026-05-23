"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bot, Database, Plus, ShieldAlert, Zap, Search, Cpu } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Agent } from "@/lib/types";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { AgentEditor } from "@/components/agent-editor";

const CAT: Record<string, { color: string; bg: string; glyph: string; label: string; desc: string }> = {
  helpdesk:  { color: "#818cf8", bg: "rgba(99,102,241,0.12)",  glyph: "🖥️", label: "IT / Helpdesk",       desc: "Support technique et incidents" },
  hr:        { color: "#f472b6", bg: "rgba(236,72,153,0.12)",  glyph: "👥", label: "Ressources Humaines",  desc: "RH, recrutement, politique interne" },
  documents: { color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  glyph: "📄", label: "Documents & RAG",      desc: "Analyse et recherche documentaire" },
  sales:     { color: "#34d399", bg: "rgba(52,211,153,0.12)",  glyph: "📈", label: "Commercial",           desc: "Ventes, CRM, prospection" },
  support:   { color: "#38bdf8", bg: "rgba(56,189,248,0.12)",  glyph: "🎧", label: "Support Client",       desc: "Relation client et tickets" },
  devops:    { color: "#fb7185", bg: "rgba(251,113,133,0.12)", glyph: "⚙️", label: "DevOps & Infra",       desc: "Infrastructure, CI/CD, monitoring" },
  general:   { color: "#94a3b8", bg: "rgba(148,163,184,0.09)", glyph: "✨", label: "Général",              desc: "Assistants polyvalents" },
};
const getCat = (c: string) => CAT[c?.toLowerCase()] ?? CAT.general;

export default function AgentsPage() {
  const { user } = useAuth();
  const canManage = user?.role === "owner" || user?.role === "admin";
  const [agents, setAgents]       = useState<Agent[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState<Agent | "new" | null>(null);
  const [search, setSearch]       = useState("");
  const [activecat, setActivecat] = useState("all");

  const load = () => { setLoading(true); api.listAgents().then(setAgents).finally(() => setLoading(false)); };
  useEffect(load, []);

  const categories = [...new Set(agents.map((a) => a.category?.toLowerCase()).filter(Boolean))];
  const filtered = agents.filter((a) => {
    const matchCat    = activecat === "all" || a.category?.toLowerCase() === activecat;
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || (a.description||"").toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });
  const grouped = categories.reduce<Record<string,Agent[]>>((acc,cat) => {
    const list = filtered.filter((a) => a.category?.toLowerCase() === cat);
    if (list.length) acc[cat] = list;
    return acc;
  }, {});

  return (
    <div className="cockpit-bg min-h-full">
      <div className="mx-auto max-w-7xl p-8 space-y-8">
        <div className="animate-fade-in-up flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gradient">Agents IA</h1>
            <p className="mt-1 text-sm text-content-subtle">{agents.length} agent{agents.length>1?"s":""} déployé{agents.length>1?"s":""} — spécialisés par métier</p>
          </div>
          {canManage && (
            <button onClick={() => setEditing("new")}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow:"0 4px 20px rgba(99,102,241,0.3)" }}>
              <Plus className="h-4 w-4" /> Nouvel agent
            </button>
          )}
        </div>

        <div className="animate-fade-in-up delay-75 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
            <input type="text" placeholder="Rechercher un agent…" value={search} onChange={(e)=>setSearch(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg-subtle py-2.5 pl-9 pr-4 text-sm text-content placeholder:text-content-muted focus:outline-none focus:ring-1 focus:ring-brand"/>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={()=>setActivecat("all")}
              className="rounded-xl px-3 py-2 text-xs font-semibold transition-all"
              style={activecat==="all"?{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff"}:{border:"1px solid rgba(255,255,255,0.06)",color:"#6c6c78"}}>
              Tous
            </button>
            {categories.map((cat)=>{
              const c=getCat(cat);
              return (
                <button key={cat} onClick={()=>setActivecat(cat)} className="rounded-xl px-3 py-2 text-xs font-semibold transition-all border"
                  style={activecat===cat?{background:`${c.color}20`,color:c.color,borderColor:`${c.color}50`}:{borderColor:"rgba(255,255,255,0.06)",color:"#6c6c78"}}>
                  {c.glyph} {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0,1,2,3,4,5].map((i)=><Skeleton key={i} className="h-52 rounded-2xl"/>)}
          </div>
        ) : agents.length===0 ? (
          <EmptyState icon={<Bot className="h-8 w-8"/>} title="Aucun agent" description="Créez votre premier agent pour commencer."
            action={canManage&&<Button onClick={()=>setEditing("new")}>Créer un agent</Button>}/>
        ) : (
          <div className="space-y-10">
            {Object.entries(grouped).map(([catKey,list])=>{
              const c=getCat(catKey);
              return (
                <section key={catKey} className="animate-fade-in-up">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg text-base" style={{background:c.bg,border:`1px solid ${c.color}30`}}>{c.glyph}</div>
                    <div>
                      <h2 className="text-sm font-bold text-content">{c.label}</h2>
                      <p className="text-xs text-content-subtle">{c.desc} · {list.length} agent{list.length>1?"s":""}</p>
                    </div>
                    <div className="ml-auto h-px flex-1 opacity-20 rounded" style={{background:`linear-gradient(to right,${c.color},transparent)`}}/>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {list.map((agent,i)=><AgentCard key={agent.id} agent={agent} delay={i*60} onEdit={()=>setEditing(agent)} canManage={canManage}/>)}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
      {editing&&<AgentEditor agent={editing==="new"?null:editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);load();}}/>}
    </div>
  );
}

function AgentCard({agent,delay,onEdit,canManage}:{agent:Agent;delay:number;onEdit:()=>void;canManage:boolean}) {
  const c=getCat(agent.category);
  return (
    <div className="card-hover gradient-border group relative overflow-hidden rounded-2xl p-5 flex flex-col gap-4" style={{animationDelay:`${delay}ms`}}>
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20" style={{background:c.color}}/>
      <div className="relative flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{background:c.bg,border:`1px solid ${c.color}35`}}>{c.glyph}</div>
        <div className="min-w-0">
          <h3 className="font-semibold text-content leading-tight">{agent.name}</h3>
          <span className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{background:`${c.color}18`,color:c.color}}>{c.label}</span>
        </div>
      </div>
      <p className="relative line-clamp-3 text-xs leading-relaxed text-content-subtle flex-1">{agent.description||"Agent IA spécialisé pour votre équipe."}</p>
      <div className="relative flex flex-wrap gap-1.5">
        {agent.use_rag&&<span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{background:"rgba(251,191,36,0.15)",color:"#fbbf24"}}><Database className="h-2.5 w-2.5"/>RAG</span>}
        {agent.requires_human_approval&&<span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{background:"rgba(251,191,36,0.12)",color:"#f59e0b"}}><ShieldAlert className="h-2.5 w-2.5"/>Validation</span>}
        {agent.model&&<span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{background:"rgba(148,163,184,0.1)",color:"#94a3b8"}}><Cpu className="h-2.5 w-2.5"/>{agent.model}</span>}
        {!agent.is_active&&<span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{background:"rgba(251,191,36,0.1)",color:"#fbbf24"}}>Inactif</span>}
      </div>
      <div className="relative flex gap-2">
        <Link href={`/chat?agent=${agent.id}`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold text-white transition-all hover:opacity-90"
          style={{background:`linear-gradient(135deg,${c.color},${c.color}bb)`,boxShadow:`0 2px 16px ${c.color}30`}}>
          <Zap className="h-3.5 w-3.5"/> Démarrer
        </Link>
        {canManage&&<button onClick={onEdit} className="rounded-xl border border-border px-3 py-2 text-xs font-medium text-content-muted transition-all hover:border-border-strong hover:text-content">Modifier</button>}
      </div>
    </div>
  );
}
