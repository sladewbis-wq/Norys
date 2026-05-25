"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Mic, Zap, RotateCcw, Copy, ChevronRight, AlertTriangle } from "lucide-react";
import { getAvailableModels, loadProviderConfigs, PROVIDERS_CATALOG } from "@/lib/providers-store";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  role: "user" | "assistant";
  content: string;
  ts: Date;
  streaming?: boolean;
}

// ── Quick commands ────────────────────────────────────────────────────────────
const QUICK_CMDS = [
  { label: "📊 Rapport global",      cmd: "Donne-moi un rapport complet sur l'état de tous les agents et leurs performances du jour." },
  { label: "🚨 Alertes actives",     cmd: "Quelles sont les alertes et anomalies actives en ce moment sur la plateforme ?" },
  { label: "🖥️ Statut Helpdesk",     cmd: "Quel est le statut du Helpdesk IT ? Tickets ouverts, temps de résolution, SLA ?" },
  { label: "⚙️ Santé DevOps",        cmd: "Rapport DevOps : état des pipelines CI/CD, logs d'erreurs, métriques infra." },
  { label: "📈 Pipeline Ventes",     cmd: "Analyse le pipeline commercial. Opportunités chaudes, deals en attente, prévisions." },
  { label: "👥 RH — Onboardings",    cmd: "Combien d'onboardings en cours ? Y a-t-il des problèmes ou retards à signaler ?" },
  { label: "🔧 Lancer une mission",  cmd: "Je veux lancer une mission urgente. Coordonne les agents nécessaires." },
  { label: "💡 Optimisations",       cmd: "Quelles optimisations recommandes-tu pour améliorer les performances de l'équipe d'agents ?" },
];

// ── Agent status simulation ───────────────────────────────────────────────────
const AGENT_STATUS = [
  { name:"Helpdesk IA",   cat:"helpdesk",  status:"active",  load:87 },
  { name:"Patch Manager", cat:"helpdesk",  status:"idle",    load:12 },
  { name:"Asset Tracker", cat:"helpdesk",  status:"active",  load:45 },
  { name:"Onboarding RH", cat:"hr",        status:"active",  load:73 },
  { name:"FAQ Employés",  cat:"hr",        status:"idle",    load:20 },
  { name:"Analyste Docs", cat:"documents", status:"active",  load:91 },
  { name:"Rédacteur IA",  cat:"documents", status:"active",  load:68 },
  { name:"Traducteur",    cat:"documents", status:"idle",    load:8  },
  { name:"Pipeline Coach",cat:"sales",     status:"active",  load:55 },
  { name:"Séquenceur",    cat:"sales",     status:"active",  load:62 },
  { name:"Support Client",cat:"support",   status:"active",  load:78 },
  { name:"Ops Monitor",   cat:"devops",    status:"alert",   load:96 },
];

const CAT_COLOR: Record<string,string> = {
  helpdesk:"#6366f1",hr:"#ec4899",documents:"#f59e0b",
  sales:"#10b981",support:"#0ea5e9",devops:"#ef4444",
};

// ── Orchestrateur Avatar SVG ──────────────────────────────────────────────────
function OrchestratorAvatar({ speaking }: { speaking: boolean }) {
  return (
    <div className="relative flex items-center justify-center" style={{width:220,height:220}}>
      {/* Outer glow rings */}
      <div className="absolute inset-0 rounded-full" style={{
        background:"radial-gradient(circle, rgba(255,208,96,0.08) 0%, transparent 70%)",
        animation: speaking ? "pulse 1s ease-in-out infinite" : "pulse 3s ease-in-out infinite",
      }}/>
      {[1,2,3].map(i=>(
        <div key={i} className="absolute rounded-full border border-amber-400/20"
          style={{
            width:`${160+i*28}px`, height:`${160+i*28}px`,
            animation:`spin ${8+i*4}s linear infinite ${i%2===1?"":"reverse"}`,
            borderColor:`rgba(255,208,96,${0.25-i*0.07})`,
            borderStyle: i===1?"solid":"dashed",
          }}
        />
      ))}
      {/* SVG Avatar */}
      <svg width="160" height="160" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="helmetGrad" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#1a1a4a"/>
            <stop offset="100%" stopColor="#06061a"/>
          </radialGradient>
          <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffd060" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#ff8800" stopOpacity="0"/>
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Body / torso */}
        <rect x="50" y="100" width="60" height="50" rx="4" fill="url(#helmetGrad)" stroke="#ffd060" strokeWidth="0.5" strokeOpacity="0.4"/>
        {/* Chest badge */}
        <rect x="67" y="112" width="26" height="16" rx="2" fill="#ffd060" opacity="0.15" stroke="#ffd060" strokeWidth="0.8"/>
        <circle cx="80" cy="120" r="4" fill="#ffd060" filter="url(#glow)" opacity="0.9"/>
        {/* Shoulder pads */}
        <rect x="32" y="100" width="20" height="28" rx="3" fill="#0e0e2a" stroke="#ffd060" strokeWidth="0.6" strokeOpacity="0.5"/>
        <rect x="108" y="100" width="20" height="28" rx="3" fill="#0e0e2a" stroke="#ffd060" strokeWidth="0.6" strokeOpacity="0.5"/>
        {/* Shoulder trim */}
        <rect x="32" y="100" width="20" height="3" rx="1" fill="#ffd060" opacity="0.7"/>
        <rect x="108" y="100" width="20" height="3" rx="1" fill="#ffd060" opacity="0.7"/>
        {/* Neck */}
        <rect x="72" y="91" width="16" height="10" rx="2" fill="#0d0d28"/>
        {/* Neck collar */}
        <ellipse cx="80" cy="91" rx="10" ry="3" fill="none" stroke="#ffd060" strokeWidth="1" opacity="0.6"/>

        {/* Helmet */}
        <rect x="44" y="52" width="72" height="42" rx="6" fill="url(#helmetGrad)" stroke="#ffd060" strokeWidth="0.6" strokeOpacity="0.5"/>
        {/* Helmet top crest */}
        <rect x="70" y="36" width="20" height="18" rx="3" fill="#0c0c24" stroke="#ffd060" strokeWidth="0.5" strokeOpacity="0.4"/>
        <rect x="76" y="28" width="8" height="12" rx="2" fill="#ffd060" opacity="0.6"/>
        {/* Cheek guards */}
        <rect x="44" y="62" width="10" height="26" rx="2" fill="#0a0a20" stroke="#ffd060" strokeWidth="0.4" strokeOpacity="0.4"/>
        <rect x="106" y="62" width="10" height="26" rx="2" fill="#0a0a20" stroke="#ffd060" strokeWidth="0.4" strokeOpacity="0.4"/>

        {/* VISOR — full width golden bar */}
        <rect x="50" y="70" width="60" height="12" rx="2"
          fill={speaking ? "#ffd060" : "#cc9900"}
          filter="url(#glow)"
          opacity={speaking ? "1" : "0.85"}
        >
          {speaking && (
            <animate attributeName="opacity" values="0.7;1;0.7" dur="0.6s" repeatCount="indefinite"/>
          )}
        </rect>
        {/* Visor scanline */}
        <rect x="52" y="74" width="56" height="1" rx="0.5" fill="white" opacity="0.3"/>
        {/* Visor side dots */}
        <circle cx="54" cy="76" r="2" fill="#fff8d0" opacity="0.9"/>
        <circle cx="106" cy="76" r="2" fill="#fff8d0" opacity="0.9"/>

        {/* Crown gems */}
        {[0,1,2,3,4,5].map(i=>{
          const a = (i/6)*Math.PI*2 - Math.PI/2;
          const r=38;
          const cx=80+Math.cos(a)*r, cy=55+Math.sin(a)*r*0.5;
          return (
            <polygon key={i}
              points={`${cx},${cy-5} ${cx+4},${cy} ${cx},${cy+5} ${cx-4},${cy}`}
              fill={i%2===0?"#ffd060":"#c8d8ff"}
              filter="url(#glow)"
              opacity={speaking ? "1" : "0.75"}
            >
              {speaking && <animate attributeName="opacity" values="0.6;1;0.6" dur={`${0.4+i*0.12}s`} repeatCount="indefinite"/>}
            </polygon>
          );
        })}

        {/* Command orb in hand */}
        <circle cx="118" cy="118" r="10" fill="#c8d8ff" opacity="0.15" stroke="#c8d8ff" strokeWidth="0.8"/>
        <circle cx="118" cy="118" r="5" fill="#c8d8ff" filter="url(#glow)" opacity="0.9">
          {speaking && <animate attributeName="r" values="4;6;4" dur="0.8s" repeatCount="indefinite"/>}
        </circle>

        {/* Cape hint */}
        <path d="M 50 105 Q 40 130 48 150 L 52 150 Q 46 132 54 108 Z" fill="#3355ff" opacity="0.25"/>
        <path d="M 110 105 Q 120 130 112 150 L 108 150 Q 114 132 106 108 Z" fill="#3355ff" opacity="0.25"/>
      </svg>

      {/* Speaking indicator */}
      {speaking && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1">
          {[0,1,2,3,4].map(i=>(
            <div key={i} className="w-0.5 rounded-full bg-amber-400"
              style={{
                height:`${6+Math.sin(Date.now()/200+i)*6}px`,
                animation:`soundBar 0.${4+i}s ease-in-out infinite alternate`,
                animationDelay:`${i*0.08}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Emotional Model ───────────────────────────────────────────────────────────
type MoodType = "focused" | "alert" | "satisfied" | "concerned" | "energetic";

const MOODS: Record<MoodType, { label: string; emoji: string; color: string; desc: string }> = {
  focused:   { label: "Concentré",   emoji: "🎯", color: "#6366f1", desc: "Analyse en cours, systèmes nominaux" },
  alert:     { label: "En alerte",   emoji: "⚠️", color: "#ef4444", desc: "Anomalies détectées, surveillance renforcée" },
  satisfied: { label: "Satisfait",   emoji: "✅", color: "#10b981", desc: "Performances optimales, équipe au top" },
  concerned: { label: "Préoccupé",   emoji: "🤔", color: "#f59e0b", desc: "Quelques points à surveiller" },
  energetic: { label: "Dynamique",   emoji: "⚡", color: "#0ea5e9", desc: "Mode proactif, optimisations en cours" },
};

// Auto-determine mood from agent states
function computeMood(): MoodType {
  const alertAgents = AGENT_STATUS.filter(a => a.status === "alert").length;
  const heavyLoad = AGENT_STATUS.filter(a => a.load > 85).length;
  const allActive = AGENT_STATUS.filter(a => a.status === "active").length;

  if (alertAgents > 0) return "alert";
  if (heavyLoad >= 3) return "concerned";
  if (allActive === AGENT_STATUS.length) return "satisfied";
  if (new Date().getHours() < 10) return "energetic";
  return "focused";
}

// ── Relationship Memory ───────────────────────────────────────────────────────
const MEMORY_KEY = "norys:orchestrateur:memory";
const INTERACTION_KEY = "norys:orchestrateur:interactions";

interface RelationMemory {
  userName?: string;
  preferredTopics: string[];
  totalInteractions: number;
  lastSeen: number;
  keyFacts: string[];
  sessionStart: number;
}

function loadMemory(): RelationMemory {
  if (typeof window === "undefined") return { preferredTopics: [], totalInteractions: 0, lastSeen: 0, keyFacts: [], sessionStart: Date.now() };
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    return raw ? { ...JSON.parse(raw), sessionStart: Date.now() } : { preferredTopics: [], totalInteractions: 0, lastSeen: 0, keyFacts: [], sessionStart: Date.now() };
  } catch {
    return { preferredTopics: [], totalInteractions: 0, lastSeen: 0, keyFacts: [], sessionStart: Date.now() };
  }
}

function saveMemory(mem: RelationMemory) {
  try { localStorage.setItem(MEMORY_KEY, JSON.stringify({ ...mem, lastSeen: Date.now() })); } catch { /* ignore */ }
}

function buildMemoryContext(mem: RelationMemory): string {
  const lines: string[] = [];
  if (mem.totalInteractions > 0) lines.push(`• ${mem.totalInteractions} interactions passées avec toi`);
  if (mem.preferredTopics.length > 0) lines.push(`• Sujets favoris : ${mem.preferredTopics.slice(0, 3).join(", ")}`);
  if (mem.keyFacts.length > 0) lines.push(`• Notes : ${mem.keyFacts.slice(0, 3).join(" | ")}`);
  if (mem.lastSeen && Date.now() - mem.lastSeen > 86400000) {
    const days = Math.floor((Date.now() - mem.lastSeen) / 86400000);
    lines.push(`• Absent depuis ${days} jour${days > 1 ? "s" : ""}`);
  }
  return lines.join("\n");
}

// Proactive alerts
const PROACTIVE_ALERTS = [
  { id: "ops-96", text: "⚠️ Ops Monitor à 96% de charge — risque de saturation dans 2h", urgency: "high" },
  { id: "analyste-91", text: "📄 Analyste Docs très sollicité (91%) — considérez un agent supplémentaire", urgency: "medium" },
  { id: "daily-report", text: "📊 Rapport journalier prêt — 8 tickets résolus, 2 en attente", urgency: "low" },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function OrchestratorPage() {
  const mood = computeMood();
  const [memory, setMemory] = useState<RelationMemory>(loadMemory);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);

  const getWelcomeMessage = (mem: RelationMemory): string => {
    const moodDesc = MOODS[mood].desc;
    const isReturning = mem.totalInteractions > 0;
    const daysSince = mem.lastSeen ? Math.floor((Date.now() - mem.lastSeen) / 86400000) : 0;

    if (isReturning && daysSince > 0) {
      return `Bonjour ${mem.userName ?? ""} — content de vous revoir après ${daysSince} jour${daysSince > 1 ? "s" : ""}.\n\n${moodDesc}. **Ops Monitor** est en alerte à 96% de charge — à surveiller en priorité.\n\nJ'ai **12 agents** sous supervision. Que puis-je faire pour vous ?`;
    }
    if (isReturning) {
      return `De retour ${mem.userName ?? ""} — toujours là.\n\n**État actuel :** ${moodDesc}. Un point d'attention : **Ops Monitor** monte à 96%. Le reste tourne bien.\n\nVos habituels : ${mem.preferredTopics.slice(0, 2).join(", ") || "rien de noté encore"}. Comment puis-je vous aider ?`;
    }
    return `Système en ligne. Je suis **Norys**, votre Intelligence Orchestratrice.\n\nJ'ai une vue complète sur vos **12 agents actifs**. En ce moment : ${moodDesc}.\n\n⚠️ Note : **Ops Monitor** est à 96% de charge — je le surveille de près.\n\nComment puis-je vous assister ?`;
  };

  const [messages, setMessages] = useState<Message[]>(() => [{
    role: "assistant",
    content: getWelcomeMessage(loadMemory()),
    ts: new Date(),
  }]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [providerInfo, setProviderInfo] = useState<{provider:string;model:string;apiKey:string;label:string}|null>(null);
  const [noProvider, setNoProvider] = useState(false);
  const [copied, setCopied] = useState<string|null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController|null>(null);

  // Load provider on mount
  useEffect(()=>{
    const models = getAvailableModels();
    const configs = loadProviderConfigs();
    // Priority: anthropic > openai > groq > openrouter > others
    const priority = ["anthropic","openai","groq","openrouter","mistral","xai","together"];
    for(const pid of priority){
      const cfg = configs[pid];
      if(cfg?.enabled && cfg.apiKey){
        const model = models.find(m=>m.providerId===pid);
        const def = PROVIDERS_CATALOG.find(p=>p.id===pid);
        setProviderInfo({
          provider:pid,
          model: model?.modelId ?? (pid==="anthropic"?"claude-sonnet-4-6":"gpt-4o"),
          apiKey: cfg.apiKey,
          label: `${def?.logo??""} ${def?.label??pid} — ${model?.modelLabel??""}`,
        });
        return;
      }
    }
    setNoProvider(true);
  },[]);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

  const sendMessage = useCallback(async(text: string)=>{
    if(!text.trim()||streaming) return;
    if(!providerInfo){
      setMessages(prev=>[...prev,{role:"assistant",content:"⚠️ Aucun provider IA configuré. Allez dans **Admin → Providers IA** pour ajouter une clé API.",ts:new Date()}]);
      return;
    }

    const userMsg: Message = {role:"user",content:text,ts:new Date()};
    setMessages(prev=>[...prev,userMsg]);
    setInput("");

    // History for API (last 10 messages)
    const history = [...messages,userMsg].slice(-10).map(m=>({role:m.role,content:m.content}));

    // Add streaming assistant message
    const assistantMsg: Message = {role:"assistant",content:"",ts:new Date(),streaming:true};
    setMessages(prev=>[...prev,assistantMsg]);
    setStreaming(true);

    try {
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      // Update relationship memory
      const updatedMem: RelationMemory = {
        ...memory,
        totalInteractions: memory.totalInteractions + 1,
        lastSeen: Date.now(),
      };
      // Extract topic hints from message
      const topicHints = [
        { kw: ["helpdesk","ticket","incident"], topic: "Helpdesk IT" },
        { kw: ["rh","onboarding","congé","employé"], topic: "RH" },
        { kw: ["devops","pipeline","ci","log"], topic: "DevOps" },
        { kw: ["vente","crm","prospect","sales"], topic: "Ventes" },
        { kw: ["document","contrat","rapport","pdf"], topic: "Documents" },
      ];
      for (const hint of topicHints) {
        if (hint.kw.some(k => text.toLowerCase().includes(k))) {
          if (!updatedMem.preferredTopics.includes(hint.topic)) {
            updatedMem.preferredTopics = [...updatedMem.preferredTopics, hint.topic].slice(-5);
          }
        }
      }
      setMemory(updatedMem);
      saveMemory(updatedMem);

      const res = await fetch("/api/orchestrateur", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          messages: history,
          provider: providerInfo.provider,
          apiKey: providerInfo.apiKey,
          model: providerInfo.model,
          emotionalState: mood,
          userName: memory.userName,
          memoryContext: buildMemoryContext(updatedMem),
        }),
        signal: ctrl.signal,
      });

      if(!res.ok){
        const err = await res.json();
        setMessages(prev=>prev.map((m,i)=>i===prev.length-1?{...m,content:`⚠️ Erreur: ${err.error}`,streaming:false}:m));
        setStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while(true){
        const {done,value} = await reader.read();
        if(done) break;
        const chunk = decoder.decode(value,{stream:true});
        full += chunk;
        setMessages(prev=>prev.map((m,i)=>i===prev.length-1?{...m,content:full}:m));
      }
      setMessages(prev=>prev.map((m,i)=>i===prev.length-1?{...m,streaming:false}:m));
    } catch(e:any){
      if(e.name!=="AbortError"){
        setMessages(prev=>prev.map((m,i)=>i===prev.length-1?{...m,content:"⚠️ Connexion interrompue.",streaming:false}:m));
      }
    } finally {
      setStreaming(false);
      abortRef.current=null;
    }
  },[messages, providerInfo, streaming, memory, mood]);

  const handleStop = ()=>{ abortRef.current?.abort(); setStreaming(false); };

  const handleCopy = (content:string,id:string)=>{
    navigator.clipboard.writeText(content).then(()=>{
      setCopied(id); setTimeout(()=>setCopied(null),1800);
    });
  };

  return (
    <div className="flex h-full overflow-hidden bg-[#02020e]">
      {/* ── Left: Avatar + agent status ── */}
      <div className="w-72 shrink-0 border-r border-[#ffd060]/10 flex flex-col overflow-hidden">
        {/* Avatar section */}
        <div className="flex flex-col items-center pt-8 pb-6 px-4 border-b border-[#ffd060]/10"
          style={{background:"radial-gradient(ellipse at 50% 0%, rgba(255,208,96,0.05) 0%, transparent 70%)"}}>
          <OrchestratorAvatar speaking={streaming}/>
          <div className="mt-4 text-center w-full">
            <p className="text-base font-bold text-amber-300" style={{textShadow:"0 0 16px rgba(255,208,96,0.6)"}}>
              NORYS
            </p>
            <p className="text-xs text-content-muted mt-0.5">Intelligence Orchestratrice</p>

            {/* Mood indicator */}
            <div className="mt-3 mx-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium"
              style={{ borderColor: `${MOODS[mood].color}40`, background: `${MOODS[mood].color}10`, color: MOODS[mood].color }}>
              <span>{MOODS[mood].emoji}</span>
              <span>{MOODS[mood].label}</span>
            </div>

            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse"/>
              <span className="text-[11px] text-success font-medium">12 agents en ligne</span>
            </div>

            {/* Memory / interactions count */}
            <button
              onClick={() => setShowMemoryPanel(v => !v)}
              className="mt-1.5 text-[10px] text-content-muted hover:text-amber-300 transition-colors"
            >
              💾 {memory.totalInteractions} interactions mémorisées
            </button>

            {providerInfo && (
              <p className="mt-1 text-[10px] text-content-muted/60">{providerInfo.label}</p>
            )}
          </div>

          {/* Memory panel */}
          {showMemoryPanel && (
            <div className="mt-3 w-full rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-left">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-amber-300 uppercase tracking-widest">Mémoire relationnelle</p>
                <button onClick={() => setShowMemoryPanel(false)} className="text-content-muted hover:text-content text-xs">✕</button>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-content-muted">Prénom :</span>
                  <input
                    type="text"
                    placeholder="Votre prénom…"
                    value={memory.userName ?? ""}
                    onChange={e => {
                      const m = { ...memory, userName: e.target.value };
                      setMemory(m); saveMemory(m);
                    }}
                    className="flex-1 bg-transparent text-[10px] text-content border-b border-white/10 focus:outline-none focus:border-amber-400/50 pb-0.5"
                  />
                </div>
                {memory.preferredTopics.length > 0 && (
                  <p className="text-[10px] text-content-muted">
                    Sujets préférés : <span className="text-content">{memory.preferredTopics.join(", ")}</span>
                  </p>
                )}
                <p className="text-[10px] text-content-muted">
                  Interactions : <span className="text-amber-300">{memory.totalInteractions}</span>
                </p>
                {memory.lastSeen > 0 && (
                  <p className="text-[10px] text-content-muted">
                    Dernière visite : <span className="text-content">{new Date(memory.lastSeen).toLocaleDateString("fr-FR")}</span>
                  </p>
                )}
                <button
                  onClick={() => {
                    const m: RelationMemory = { preferredTopics: [], totalInteractions: 0, lastSeen: 0, keyFacts: [], sessionStart: Date.now() };
                    setMemory(m); saveMemory(m);
                  }}
                  className="mt-1 text-[9px] text-red-400/70 hover:text-red-400 transition-colors"
                >
                  Effacer la mémoire
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Agent status panel */}
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#ffd060]/50 mb-2 px-1">
            Statut agents
          </p>
          <div className="space-y-1.5">
            {AGENT_STATUS.map(agent=>(
              <div key={agent.name}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                style={{background:`${CAT_COLOR[agent.cat]}08`, border:`1px solid ${CAT_COLOR[agent.cat]}20`}}>
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  agent.status==="active"?"animate-pulse":"opacity-40"
                }`} style={{background:
                  agent.status==="alert"?"#ef4444":
                  agent.status==="active"?"#10b981":"#555568"
                }}/>
                <span className="text-[11px] font-medium text-content flex-1 truncate">{agent.name}</span>
                <div className="flex items-center gap-1">
                  <div className="w-14 h-1 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{width:`${agent.load}%`,background:
                        agent.load>85?"#ef4444":agent.load>60?"#f59e0b":"#10b981"
                      }}/>
                  </div>
                  <span className="text-[9px] text-content-muted w-6 text-right">{agent.load}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* No provider warning */}
        {noProvider && (
          <div className="m-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5"/>
              <div>
                <p className="text-xs font-semibold text-amber-400">Aucun provider configuré</p>
                <p className="text-[10px] text-amber-300/70 mt-0.5">
                  Allez dans Admin → Providers IA pour activer Anthropic, OpenAI ou un autre modèle.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Chat ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Quick commands */}
        <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-white/5 flex-shrink-0 scrollbar-hide">
          {QUICK_CMDS.map(q=>(
            <button
              key={q.label}
              onClick={()=>sendMessage(q.cmd)}
              disabled={streaming}
              className="shrink-0 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-content-muted hover:border-amber-400/30 hover:text-amber-300 hover:bg-amber-400/5 transition-all disabled:opacity-40"
            >
              {q.label}
              <ChevronRight className="h-3 w-3"/>
            </button>
          ))}
        </div>

        {/* Proactive alerts */}
        {PROACTIVE_ALERTS.filter(a => !dismissedAlerts.has(a.id)).length > 0 && (
          <div className="px-4 py-2 border-b border-white/5 flex-shrink-0 space-y-1.5">
            {PROACTIVE_ALERTS.filter(a => !dismissedAlerts.has(a.id)).map(alert => (
              <div key={alert.id} className="flex items-center gap-2.5 rounded-lg border px-3 py-2 text-[11px]"
                style={{
                  borderColor: alert.urgency === "high" ? "rgba(239,68,68,0.3)" : alert.urgency === "medium" ? "rgba(245,158,11,0.3)" : "rgba(99,102,241,0.3)",
                  background: alert.urgency === "high" ? "rgba(239,68,68,0.06)" : alert.urgency === "medium" ? "rgba(245,158,11,0.06)" : "rgba(99,102,241,0.06)",
                  color: alert.urgency === "high" ? "#fca5a5" : alert.urgency === "medium" ? "#fcd34d" : "#a5b4fc",
                }}>
                <span className="flex-1">{alert.text}</span>
                <button
                  onClick={() => sendMessage(`Dis m'en plus sur : ${alert.text}`)}
                  className="shrink-0 rounded px-2 py-0.5 text-[10px] font-medium opacity-70 hover:opacity-100 transition-opacity bg-white/10"
                >
                  Analyser
                </button>
                <button
                  onClick={() => setDismissedAlerts(prev => new Set([...prev, alert.id]))}
                  className="shrink-0 text-content-muted hover:text-content transition-colors text-xs"
                >✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {messages.map((msg, idx)=>(
            <ChatMessage
              key={idx}
              msg={msg}
              onCopy={()=>handleCopy(msg.content, String(idx))}
              copied={copied===String(idx)}
            />
          ))}
          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        <div className="border-t border-white/5 px-6 py-4 flex-shrink-0"
          style={{background:"linear-gradient(to top, rgba(255,208,96,0.03), transparent)"}}>
          <div className="flex items-end gap-3 rounded-2xl border px-4 py-3 transition-all"
            style={{
              borderColor: streaming ? "rgba(255,208,96,0.4)" : "rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              boxShadow: streaming ? "0 0 20px rgba(255,208,96,0.1)" : "none",
            }}>
            <textarea
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{
                if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendMessage(input); }
              }}
              placeholder="Parlez à l'Orchestrateur… (Entrée pour envoyer)"
              rows={1}
              disabled={streaming}
              className="flex-1 resize-none bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none leading-relaxed"
              style={{maxHeight:120}}
              onInput={e=>{
                const t=e.currentTarget;
                t.style.height="auto";
                t.style.height=Math.min(t.scrollHeight,120)+"px";
              }}
            />
            <div className="flex items-center gap-2 shrink-0">
              {streaming ? (
                <button onClick={handleStop}
                  className="flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-400/20 transition-all">
                  <span className="h-2 w-2 rounded-sm bg-amber-400 animate-pulse"/>
                  Stop
                </button>
              ) : (
                <button
                  onClick={()=>sendMessage(input)}
                  disabled={!input.trim()}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all disabled:opacity-20"
                  style={{background:"linear-gradient(135deg,#ffd060,#ff8c00)",color:"#000"}}>
                  <Send className="h-3.5 w-3.5"/>
                  Envoyer
                </button>
              )}
            </div>
          </div>
          <p className="text-center text-[10px] text-white/15 mt-2">
            Shift+Entrée pour nouvelle ligne · L&apos;Orchestrateur a accès à tout le contexte de vos agents
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes soundBar { from{height:3px} to{height:14px} }
        .scrollbar-hide::-webkit-scrollbar { display:none }
        .scrollbar-hide { -ms-overflow-style:none; scrollbar-width:none }
      `}</style>
    </div>
  );
}

// ── Chat Message Component ────────────────────────────────────────────────────
function ChatMessage({ msg, onCopy, copied }: { msg:Message; onCopy:()=>void; copied:boolean }) {
  const isUser = msg.role==="user";
  const timeStr = msg.ts.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});

  // Simple markdown: **bold**, newlines, ```code```
  const renderContent = (text:string) => {
    const parts = text.split(/(```[\s\S]*?```|\*\*[^*]+\*\*)/g);
    return parts.map((part,i)=>{
      if(part.startsWith("```") && part.endsWith("```")){
        const code = part.slice(3,-3).replace(/^[a-z]+\n/,"");
        return <pre key={i} className="my-2 rounded-lg bg-white/5 border border-white/10 p-3 text-xs font-mono text-green-300 overflow-x-auto">{code}</pre>;
      }
      if(part.startsWith("**") && part.endsWith("**")){
        return <strong key={i} className="text-amber-300 font-semibold">{part.slice(2,-2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  if(isUser){
    return (
      <div className="flex justify-end">
        <div className="max-w-lg">
          <div className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed"
            style={{background:"linear-gradient(135deg,rgba(99,102,241,0.25),rgba(99,102,241,0.12))",border:"1px solid rgba(99,102,241,0.3)",color:"#e8e8f8"}}>
            {msg.content}
          </div>
          <p className="text-right text-[10px] text-white/20 mt-1">{timeStr}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      {/* Orchestrator mini-avatar */}
      <div className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-lg"
        style={{background:"linear-gradient(135deg,#ffd060,#ff8800)",boxShadow:"0 0 14px rgba(255,208,96,0.35)"}}>
        👑
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-bold text-amber-300">Orchestrateur IA</span>
          <span className="text-[10px] text-white/20">{timeStr}</span>
          {msg.streaming && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400">
              <Zap className="h-2.5 w-2.5"/>
              En cours…
            </span>
          )}
        </div>
        <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed text-white/85 group relative"
          style={{background:"rgba(255,208,96,0.04)",border:"1px solid rgba(255,208,96,0.12)"}}>
          {msg.content ? (
            <div className="whitespace-pre-wrap">{renderContent(msg.content)}</div>
          ) : (
            <div className="flex items-center gap-2 text-amber-400/60">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-ping"/>
              <span className="text-xs">Analyse en cours…</span>
            </div>
          )}
          {msg.streaming && (
            <span className="inline-block w-0.5 h-4 bg-amber-400 ml-0.5 animate-pulse align-middle"/>
          )}

          {/* Copy button */}
          {!msg.streaming && msg.content && (
            <button onClick={onCopy}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-1.5 text-white/30 hover:text-white/70 hover:bg-white/5">
              {copied
                ? <span className="text-[10px] text-success">✓</span>
                : <Copy className="h-3 w-3"/>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
