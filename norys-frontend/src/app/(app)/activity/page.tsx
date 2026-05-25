"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { AgentPortraitCard } from "@/components/norys-avatar";
import {
  Hash, Send, Pin, CheckCircle, AlertTriangle,
  RefreshCw, ChevronDown, Zap, Filter, Bell,
  CornerDownRight, ThumbsUp, RotateCcw,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ActivityMessage {
  id: string;
  agentId: string;
  agentName: string;
  category: string;
  action: string;
  detail?: string;
  ts: Date;
  status: "running" | "done" | "error" | "warning";
  pinned?: boolean;
  userReply?: string;
  correction?: string;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const AGENTS = [
  { id:"it-1",  name:"Helpdesk IA",    category:"helpdesk",  model:"GPT-4o"     },
  { id:"it-2",  name:"Patch Manager",  category:"helpdesk",  model:"Claude 3.5" },
  { id:"it-3",  name:"Asset Tracker",  category:"helpdesk",  model:"GPT-4o"     },
  { id:"hr-1",  name:"Onboarding RH",  category:"hr",        model:"Claude 3.5" },
  { id:"hr-2",  name:"FAQ Employés",   category:"hr",        model:"GPT-4o"     },
  { id:"doc-1", name:"Analyste Docs",  category:"documents", model:"Claude 3.5" },
  { id:"doc-2", name:"Rédacteur IA",   category:"documents", model:"GPT-4o"     },
  { id:"doc-3", name:"Traducteur",     category:"documents", model:"GPT-4o"     },
  { id:"sales-1",name:"Pipeline Coach",category:"sales",     model:"Claude 3.5" },
  { id:"sales-2",name:"Séquenceur",    category:"sales",     model:"GPT-4o"     },
  { id:"sup-1", name:"Support Client", category:"support",   model:"GPT-4o"     },
  { id:"dev-1", name:"Ops Monitor",    category:"devops",    model:"Claude 3.5" },
];

const ACTIONS: Record<string, { actions: string[]; details: string[] }> = {
  helpdesk: {
    actions: ["Incident résolu", "Ticket créé", "Accès réinitialisé", "Escalade N2", "Base KB consultée", "Patch déployé", "Alerte détectée"],
    details:  ["Incident #4821 — PC bloqué après MAJ Windows","Ticket JIRA #2201 créé et assigné","Réinitialisation MDP → jean.dupont@corp.fr","Problème VPN non résolu, transmis à N2","KB article #312 consulté pour résolution","Patch CVE-2025-1234 déployé sur 45 postes","CPU > 95% sur serveur PROD-04"],
  },
  hr: {
    actions: ["Onboarding lancé", "Contrat envoyé", "FAQ répondu", "Congés validés", "Entretien planifié", "Fiche mise à jour"],
    details:  ["Nouveau employé: Marie Laurent — Développeur Senior","Contrat CDI signé électroniquement","Question: modalités télétravail — réponse envoyée","3 jours de congés approuvés pour P. Martin","Entretien annuel J. Bernard — 14h30 vendredi","Fiche RH mise à jour: promotion -> Lead"],
  },
  documents: {
    actions: ["Document analysé", "Résumé généré", "Traduction terminée", "Données extraites", "Rapport archivé", "Contrat scanné"],
    details:  ["Contrat fournisseur 48 pages — 12 clauses clés extraites","Résumé exécutif Q3 2025 généré (3 pages → 1 slide)","Doc technique EN→FR : 8 200 mots, délai 12s","Données financières extraites: CA, marges, KPIs","Rapport audit archivé dans /docs/audit-2025","Contrat NDA signé détecté et classifié automatiquement"],
  },
  sales: {
    actions: ["Pipeline analysé", "Séquence créée", "Lead scoré", "Démo planifiée", "Devis généré", "CRM mis à jour"],
    details:  ["12 opportunités stagnantes > 30j identifiées","Séquence 5 emails créée pour segment SaaS PME","Lead TechCorp: score 92/100 — priorité haute","Démo produit planifiée: DataFlow Inc — mardi 10h","Devis #Q2025-047: 48 000€ / an (3 licences Enterprise)","CRM Salesforce: 8 contacts mis à jour après appels"],
  },
  support: {
    actions: ["Ticket résolu", "Client notifié", "FAQ mise à jour", "SLA respecté", "Escalade fermée", "Satisfaction: ⭐⭐⭐⭐⭐"],
    details:  ["Ticket #2241 — Problème facturation résolu en 4min","Email de confirmation envoyé à client@example.com","FAQ article mis à jour: procédure remboursement","SLA 4h respecté: résolution en 2h47","Escalade fermée après résolution complète","NPS 9/10 reçu — client très satisfait"],
  },
  devops: {
    actions: ["Pipeline CI vert", "Log analysé", "Alerte résolue", "Auto-scale déclenché", "Rollback annulé", "Déploiement OK", "Anomalie détectée"],
    details:  ["Pipeline main → prod: 247 tests ✓, coverage 94%","4 500 lignes de logs analysées — 2 erreurs critiques","Alerte mémoire résolue: fuite corrigée pod api-worker","Scale-out: 3→6 instances suite pic trafic +340%","Rollback annulé après fix hotfix-2025-05-25","Deploy v2.4.1 en prod → 0 erreur, latence -8ms","Trafic suspect détecté: 12k req/s depuis 45.66.x.x"],
  },
};

const CAT_INFO: Record<string, { color: string; label: string; icon: string }> = {
  helpdesk:  { color:"#6366f1", label:"Helpdesk IT", icon:"🖥️" },
  hr:        { color:"#ec4899", label:"RH",          icon:"👥" },
  documents: { color:"#f59e0b", label:"Documents",   icon:"📄" },
  sales:     { color:"#10b981", label:"Ventes",      icon:"📈" },
  support:   { color:"#0ea5e9", label:"Support",     icon:"💬" },
  devops:    { color:"#ef4444", label:"DevOps",      icon:"⚙️" },
};

const STATUS_CONFIG = {
  running: { color:"#f59e0b", label:"En cours",  dot:"animate-pulse" },
  done:    { color:"#10b981", label:"Terminé",   dot:"" },
  error:   { color:"#ef4444", label:"Erreur",    dot:"" },
  warning: { color:"#f97316", label:"Attention", dot:"animate-pulse" },
};

const CHANNELS = [
  { id:"all",       label:"all-agents",  icon:"📡" },
  { id:"helpdesk",  label:"helpdesk-it", icon:"🖥️" },
  { id:"hr",        label:"ressources-h",icon:"👥" },
  { id:"documents", label:"documents",   icon:"📄" },
  { id:"sales",     label:"ventes",      icon:"📈" },
  { id:"support",   label:"support",     icon:"💬" },
  { id:"devops",    label:"devops",      icon:"⚙️" },
  { id:"alerts",    label:"🚨 alertes",  icon:"🚨" },
];

function makeId() { return Math.random().toString(36).slice(2,9); }

function generateMessage(forCat?: string): ActivityMessage {
  const pool = forCat && forCat!=="all" && forCat!=="alerts"
    ? AGENTS.filter(a=>a.category===forCat)
    : AGENTS;
  const agent = pool[Math.floor(Math.random()*pool.length)];
  const cat = agent.category;
  const src = ACTIONS[cat];
  const actionIdx = Math.floor(Math.random()*src.actions.length);
  const detailIdx = Math.floor(Math.random()*src.details.length);
  const rand = Math.random();
  const status: ActivityMessage["status"] = rand<0.07?"error":rand<0.12?"warning":rand<0.3?"running":"done";
  return {
    id: makeId(),
    agentId: agent.id,
    agentName: agent.name,
    category: cat,
    action: src.actions[actionIdx],
    detail: src.details[detailIdx],
    ts: new Date(),
    status,
    pinned: false,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ActivityPage() {
  const [channel, setChannel] = useState("all");
  const [messages, setMessages] = useState<ActivityMessage[]>([]);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<string|null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [live, setLive] = useState(true);
  const [unread, setUnread] = useState<Record<string,number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout|null>(null);

  // Seed initial messages
  useEffect(()=>{
    const seed: ActivityMessage[] = [];
    for(let i=0;i<18;i++){
      const msg=generateMessage();
      msg.ts=new Date(Date.now()-(18-i)*14000);
      seed.push(msg);
    }
    setMessages(seed);
  },[]);

  // Live message feed
  useEffect(()=>{
    if(!live){ if(intervalRef.current) clearInterval(intervalRef.current); return; }
    intervalRef.current=setInterval(()=>{
      const msg=generateMessage(channel==="all"||channel==="alerts"?undefined:channel);
      setMessages(prev=>[...prev.slice(-80),msg]);
      setUnread(prev=>{
        const u={...prev};
        u[msg.category]=(u[msg.category]||0)+1;
        return u;
      });
    },3500);
    return ()=>{ if(intervalRef.current) clearInterval(intervalRef.current); };
  },[live, channel]);

  // Auto-scroll
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

  // Clear unread on channel switch
  useEffect(()=>{
    setUnread(prev=>{ const u={...prev}; delete u[channel]; return u; });
  },[channel]);

  const filteredMsgs = messages.filter(m=>{
    const matchChan = channel==="all" || m.category===channel ||
      (channel==="alerts" && (m.status==="error"||m.status==="warning"));
    const matchStatus = filterStatus==="all" || m.status===filterStatus;
    return matchChan && matchStatus;
  });

  const handleSend = useCallback(()=>{
    if(!input.trim()) return;
    if(replyTo){
      setMessages(prev=>prev.map(m=>m.id===replyTo
        ? {...m, userReply:input.trim()}
        : m
      ));
    } else {
      // Orchestrator command — inject as system message
      const cmdMsg: ActivityMessage = {
        id:makeId(), agentId:"orchestrateur", agentName:"Orchestrateur IA",
        category:"all", action:"Commande reçue", detail:input.trim(),
        ts:new Date(), status:"running", pinned:false,
      };
      setMessages(prev=>[...prev, cmdMsg]);
      // Simulate agent response
      setTimeout(()=>{
        const resp: ActivityMessage = {
          id:makeId(), agentId:"orchestrateur", agentName:"Orchestrateur IA",
          category:"all", action:"Commande exécutée", detail:`✓ Instruction transmise aux agents: "${input.trim()}"`,
          ts:new Date(), status:"done",
        };
        setMessages(prev=>[...prev, resp]);
      },1800);
    }
    setInput(""); setReplyTo(null);
  },[input, replyTo]);

  const handlePin = (id:string) => setMessages(prev=>prev.map(m=>m.id===id?{...m,pinned:!m.pinned}:m));
  const handleCorrect = (id:string, correction:string) => setMessages(prev=>prev.map(m=>m.id===id?{...m,correction,status:"done"}:m));

  const pinnedMsgs = filteredMsgs.filter(m=>m.pinned);
  const activeChanInfo = CHANNELS.find(c=>c.id===channel);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left sidebar — channels ── */}
      <aside className="w-56 shrink-0 border-r border-border bg-bg-subtle flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border">
          <p className="text-[11px] font-bold uppercase tracking-widest text-content-subtle">Canaux</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {CHANNELS.map(ch=>{
            const count = ch.id==="alerts"
              ? messages.filter(m=>m.status==="error"||m.status==="warning").length
              : unread[ch.id]||0;
            return (
              <button
                key={ch.id}
                onClick={()=>setChannel(ch.id)}
                className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  channel===ch.id
                    ? "bg-brand/15 text-brand font-semibold"
                    : "text-content-muted hover:bg-bg-elevated hover:text-content"
                }`}
              >
                <span className="text-base leading-none">{ch.icon}</span>
                <span className="flex-1 truncate text-xs font-medium">#{ch.label}</span>
                {count>0 && (
                  <span className="shrink-0 rounded-full bg-brand text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">
                    {count>99?"99+":count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Live toggle */}
        <div className="border-t border-border p-3">
          <button
            onClick={()=>setLive(v=>!v)}
            className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              live ? "bg-success/10 text-success border border-success/30" : "text-content-muted border border-border"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${live?"bg-success animate-pulse":"bg-content-muted"}`}/>
            {live ? "Live" : "Pausé"}
            <RefreshCw className="ml-auto h-3 w-3"/>
          </button>
        </div>
      </aside>

      {/* ── Main feed ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Channel header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-3 flex-shrink-0">
          <Hash className="h-4 w-4 text-content-muted"/>
          <span className="font-semibold text-content text-sm">{activeChanInfo?.label ?? channel}</span>
          <span className="text-xs text-content-muted">{filteredMsgs.length} messages</span>
          <div className="ml-auto flex items-center gap-2">
            {/* Status filter */}
            <div className="relative flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-content-muted"/>
              <select
                value={filterStatus}
                onChange={e=>setFilterStatus(e.target.value)}
                className="appearance-none bg-transparent text-xs text-content-muted pr-4 focus:outline-none cursor-pointer"
              >
                <option value="all">Tous statuts</option>
                <option value="running">En cours</option>
                <option value="done">Terminés</option>
                <option value="error">Erreurs</option>
                <option value="warning">Alertes</option>
              </select>
              <ChevronDown className="h-3 w-3 text-content-muted pointer-events-none absolute right-0"/>
            </div>
          </div>
        </div>

        {/* Pinned banner */}
        {pinnedMsgs.length>0 && (
          <div className="border-b border-amber-500/20 bg-amber-500/5 px-5 py-2 flex items-center gap-2 flex-shrink-0">
            <Pin className="h-3.5 w-3.5 text-amber-400"/>
            <span className="text-xs text-amber-400 font-medium">{pinnedMsgs.length} message{pinnedMsgs.length>1?"s":""} épinglé{pinnedMsgs.length>1?"s":""}</span>
            <div className="flex gap-2 ml-2 overflow-x-auto">
              {pinnedMsgs.map(m=>(
                <span key={m.id} className="text-xs text-content-muted whitespace-nowrap">
                  <strong className="text-amber-400">{m.agentName}</strong>: {m.action}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          {filteredMsgs.length===0 && (
            <div className="flex flex-col items-center justify-center h-full text-content-muted">
              <Bell className="h-8 w-8 mb-3 opacity-30"/>
              <p className="text-sm">Aucune activité dans ce canal</p>
            </div>
          )}
          {filteredMsgs.map((msg, idx)=>{
            const prev = filteredMsgs[idx-1];
            const sameAgent = prev?.agentId===msg.agentId
              && (msg.ts.getTime()-prev.ts.getTime())<60000;
            return (
              <MessageRow
                key={msg.id}
                msg={msg}
                compact={sameAgent}
                onPin={()=>handlePin(msg.id)}
                onReply={()=>setReplyTo(msg.id)}
                onCorrect={handleCorrect}
              />
            );
          })}
          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        <div className="border-t border-border p-4 flex-shrink-0">
          {replyTo && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-brand/10 border border-brand/20 px-3 py-1.5">
              <CornerDownRight className="h-3.5 w-3.5 text-brand"/>
              <span className="text-xs text-brand">
                Correction pour <strong>{messages.find(m=>m.id===replyTo)?.agentName}</strong>
              </span>
              <button onClick={()=>setReplyTo(null)} className="ml-auto text-brand text-xs hover:opacity-70">✕</button>
            </div>
          )}
          <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-elevated px-4 py-2.5">
            <span className="text-sm text-content-muted">
              {replyTo ? "💬" : "🎯"}
            </span>
            <input
              type="text"
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); handleSend(); }}}
              placeholder={replyTo
                ? "Envoyer une correction à l'agent…"
                : "Envoyer une commande à l'Orchestrateur IA…"
              }
              className="flex-1 bg-transparent text-sm text-content placeholder:text-content-muted focus:outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="rounded-lg bg-brand p-1.5 text-white disabled:opacity-30 hover:opacity-90 transition-opacity"
            >
              <Send className="h-4 w-4"/>
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-content-muted">
            Envoyez des commandes à l&apos;Orchestrateur · Répondez aux agents pour corriger leurs actions
          </p>
        </div>
      </div>

      {/* ── Right panel — agent stats ── */}
      <aside className="w-52 shrink-0 border-l border-border bg-bg-subtle flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-border">
          <p className="text-[11px] font-bold uppercase tracking-widest text-content-subtle">Agents actifs</p>
        </div>
        <div className="p-3 space-y-2">
          {AGENTS.map(agent=>{
            const lastMsg = [...messages].reverse().find(m=>m.agentId===agent.id);
            const status = lastMsg?.status ?? "done";
            const sc = STATUS_CONFIG[status];
            const cat = CAT_INFO[agent.category];
            return (
              <div key={agent.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-bg-elevated p-2">
                <AgentPortraitCard agentId={agent.id} category={agent.category} size="sm"/>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-content truncate">{agent.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${sc.dot}`} style={{background:sc.color}}/>
                    <span className="text-[10px] text-content-muted truncate">{sc.label}</span>
                  </div>
                </div>
                <span className="text-sm shrink-0">{cat.icon}</span>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

// ── Message Row ───────────────────────────────────────────────────────────────
function MessageRow({ msg, compact, onPin, onReply, onCorrect }: {
  msg: ActivityMessage;
  compact: boolean;
  onPin: ()=>void;
  onReply: ()=>void;
  onCorrect: (id:string, text:string)=>void;
}) {
  const [hovering, setHovering] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [corrText, setCorrText] = useState("");
  const sc = STATUS_CONFIG[msg.status];
  const cat = CAT_INFO[msg.category] ?? { color:"#8b5cf6", label:"Général", icon:"🤖" };
  const isOrch = msg.agentId==="orchestrateur";

  const timeStr = msg.ts.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});

  return (
    <div
      className={`group relative rounded-lg transition-colors px-3 py-1.5 ${hovering?"bg-bg-elevated/60":""} ${msg.pinned?"border-l-2 border-amber-400 pl-3":""}`}
      onMouseEnter={()=>setHovering(true)}
      onMouseLeave={()=>setHovering(false)}
    >
      <div className="flex gap-3">
        {/* Avatar */}
        {!compact ? (
          <div className="shrink-0 mt-0.5">
            {isOrch ? (
              <div className="h-8 w-8 rounded-full flex items-center justify-center text-base"
                style={{background:"linear-gradient(135deg,#ffd060,#3355ff)",boxShadow:"0 0 10px #ffd06066"}}>
                👑
              </div>
            ) : (
              <AgentPortraitCard agentId={msg.agentId} category={msg.category} size="sm"/>
            )}
          </div>
        ) : (
          <div className="w-8 shrink-0 flex items-center justify-end">
            {hovering && <span className="text-[9px] text-content-muted">{timeStr.slice(0,5)}</span>}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {!compact && (
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold text-content">{msg.agentName}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{background:`${cat.color}18`,color:cat.color}}>
                {cat.icon} {cat.label}
              </span>
              <span className="text-[10px] text-content-muted">{timeStr}</span>
              <span className={`flex items-center gap-1 text-[10px] font-medium`} style={{color:sc.color}}>
                <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} style={{background:sc.color}}/>
                {sc.label}
              </span>
            </div>
          )}

          {/* Action + detail */}
          <div className="flex items-start gap-2">
            {msg.status==="error" && <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5"/>}
            {msg.status==="done" && <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5"/>}
            {msg.status==="running" && <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5"/>}
            <div>
              <span className="text-sm font-medium text-content">{msg.action}</span>
              {msg.detail && <p className="text-xs text-content-muted mt-0.5 leading-relaxed">{msg.detail}</p>}
            </div>
          </div>

          {/* User reply */}
          {msg.userReply && (
            <div className="mt-1.5 flex items-start gap-2 rounded-lg bg-brand/8 border border-brand/15 px-3 py-1.5">
              <CornerDownRight className="h-3 w-3 text-brand shrink-0 mt-0.5"/>
              <p className="text-xs text-brand">{msg.userReply}</p>
            </div>
          )}

          {/* Correction applied */}
          {msg.correction && (
            <div className="mt-1.5 flex items-start gap-2 rounded-lg bg-success/8 border border-success/15 px-3 py-1.5">
              <CheckCircle className="h-3 w-3 text-success shrink-0 mt-0.5"/>
              <p className="text-xs text-success">Correction appliquée : {msg.correction}</p>
            </div>
          )}

          {/* Correction input */}
          {correcting && (
            <div className="mt-2 flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={corrText}
                onChange={e=>setCorrText(e.target.value)}
                onKeyDown={e=>{
                  if(e.key==="Enter"&&corrText.trim()){
                    onCorrect(msg.id, corrText.trim());
                    setCorrecting(false); setCorrText("");
                  } else if(e.key==="Escape"){ setCorrecting(false); setCorrText(""); }
                }}
                placeholder="Entrez la correction…"
                className="flex-1 rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-xs text-content placeholder:text-content-muted focus:outline-none focus:ring-1 focus:ring-brand"
              />
              <button
                onClick={()=>{ if(corrText.trim()) onCorrect(msg.id, corrText.trim()); setCorrecting(false); setCorrText(""); }}
                className="rounded-lg bg-brand px-2 py-1.5 text-xs text-white hover:opacity-90"
              >Envoyer</button>
              <button onClick={()=>{setCorrecting(false);setCorrText("");}} className="text-xs text-content-muted hover:text-content">Annuler</button>
            </div>
          )}
        </div>

        {/* Action toolbar (hover) */}
        {hovering && !correcting && (
          <div className="shrink-0 flex items-center gap-1 rounded-lg border border-border bg-bg-elevated px-2 py-1">
            <ActionBtn title={msg.pinned?"Désépingler":"Épingler"} onClick={onPin}>
              <Pin className={`h-3 w-3 ${msg.pinned?"text-amber-400":"text-content-muted"}`}/>
            </ActionBtn>
            <ActionBtn title="Corriger" onClick={()=>setCorrecting(true)}>
              <RotateCcw className="h-3 w-3 text-content-muted"/>
            </ActionBtn>
            <ActionBtn title="Répondre" onClick={onReply}>
              <CornerDownRight className="h-3 w-3 text-content-muted"/>
            </ActionBtn>
            <ActionBtn title="Approuver" onClick={()=>onCorrect(msg.id,"✓ Approuvé")}>
              <ThumbsUp className="h-3 w-3 text-content-muted"/>
            </ActionBtn>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick:()=>void }) {
  return (
    <button title={title} onClick={onClick} className="rounded p-1 hover:bg-bg-subtle transition-colors">
      {children}
    </button>
  );
}
