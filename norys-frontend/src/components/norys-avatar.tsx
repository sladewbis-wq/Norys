"use client";

import { useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PortraitConfig {
  skinTone:    number;  // 0-7
  hairStyle:   number;  // 0-5  (0=Aucun 1=Court 2=Long 3=Quiff 4=Afro 5=Chignon)
  hairColor:   string;  // "#rrggbb"
  eyeColor:    string;  // "#rrggbb"
  accentColor: string;  // "#rrggbb"  drives glow + outfit
  augmentation:number;  // 0=none 1=circuit 2=halo 3=cyber
  expression:  number;  // 0=neutre 1=sourire 2=concentré
  accessory:   number;  // 0=none 1=lunettes 2=écouteur 3=visière
}

// ── Palettes ──────────────────────────────────────────────────────────────────
export const SKIN_TONES = [
  "#FFE8D0","#F5C39E","#E8A87A",
  "#C68642","#A0694E","#7A4030",
  "#5C2E18","#3A1A0A",
];

export const HAIR_COLORS_P = [
  "#080502","#1C1008","#3D2010",
  "#7A3B1E","#B8741A","#E8C547",
  "#F5E6A0","#EEEEEE","#CC2244","#3366DD",
];

export const EYE_COLORS_P = [
  "#2255CC","#44AAFF","#22AA55",
  "#BB7722","#CC2211","#9944DD",
  "#22BBCC","#EEEEFF",
];

export const ACCENT_COLORS_P = [
  "#6366f1","#8b5cf6","#ec4899",
  "#f59e0b","#10b981","#0ea5e9",
  "#ef4444","#14b8a6",
];

const CAT_ACCENTS: Record<string, string> = {
  helpdesk:"#6366f1", hr:"#ec4899", documents:"#f59e0b",
  sales:"#10b981", support:"#0ea5e9", devops:"#ef4444", general:"#8b5cf6",
};

export const PERSONALITY_PRESETS = [
  { id:"professional", label:"Professionnel", desc:"Formel, précis, structuré",   prompt:"Tu es un assistant professionnel. Tu réponds de manière formelle, précise et structurée. Tu vas droit au but et évites les formulations vagues." },
  { id:"friendly",     label:"Amical",        desc:"Chaleureux, accessible",        prompt:"Tu es un assistant chaleureux et accessible. Tu utilises un langage simple et bienveillant, tu fais preuve d'empathie et tu encourages l'utilisateur." },
  { id:"precise",      label:"Précis",        desc:"Concis, orienté données",       prompt:"Tu es un assistant orienté données. Tes réponses sont concises, factuelles et directes. Tu évites les détails superflus et vas à l'essentiel." },
  { id:"creative",     label:"Créatif",       desc:"Innovant, propose des alts",    prompt:"Tu es un assistant créatif et innovant. Tu proposes plusieurs approches, tu suggères des alternatives originales et tu encourages la réflexion hors des sentiers battus." },
  { id:"empathetic",   label:"Empathique",    desc:"Compréhensif, bienveillant",    prompt:"Tu es un assistant empathique. Tu valides les préoccupations de l'utilisateur, tu montres de la compréhension et tu adaptes ton aide à ses besoins émotionnels." },
  { id:"strict",       label:"Strict",        desc:"Rigoureux, applique les règles",prompt:"Tu es un assistant rigoureux. Tu appliques strictement les règles et procédures établies, tu refuses les demandes ambiguës et tu demandes des clarifications avant d'agir." },
];

export const PROVIDERS_LIST = [
  { id:"ollama",      label:"Ollama (local)",  models:["llama3.1","llama3.2","mistral","codellama","phi3","gemma2","qwen2.5"] },
  { id:"anthropic",   label:"Anthropic",        models:["claude-opus-4-5","claude-sonnet-4-5","claude-haiku-4-5-20251001"] },
  { id:"openai",      label:"OpenAI",           models:["gpt-4o","gpt-4o-mini","gpt-4-turbo","o1-mini"] },
  { id:"groq",        label:"Groq",             models:["llama-3.1-70b-versatile","mixtral-8x7b-32768","gemma2-9b-it"] },
  { id:"openrouter",  label:"OpenRouter",       models:[] },
];

// ── Storage ───────────────────────────────────────────────────────────────────
export function getDefaultPortrait(category: string): PortraitConfig {
  return {
    skinTone:1, hairStyle:1, hairColor:"#1C1008",
    eyeColor:"#44AAFF", accentColor: CAT_ACCENTS[category?.toLowerCase()] ?? "#6366f1",
    augmentation:1, expression:0, accessory:0,
  };
}

export function getPortraitConfig(agentId: string, category: string): PortraitConfig {
  if (typeof window === "undefined") return getDefaultPortrait(category);
  try {
    const s = localStorage.getItem(`norys:portrait:${agentId}`);
    if (s) return { ...getDefaultPortrait(category), ...JSON.parse(s) as Partial<PortraitConfig> };
  } catch {}
  return getDefaultPortrait(category);
}

export function savePortraitConfig(agentId: string, cfg: PortraitConfig): void {
  try { localStorage.setItem(`norys:portrait:${agentId}`, JSON.stringify(cfg)); } catch {}
}

// ── SVG helpers ───────────────────────────────────────────────────────────────
function darken(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#",""), 16);
  const r = Math.max(0, (n >> 16) - Math.round(255 * amt));
  const g = Math.max(0, ((n >> 8) & 0xff) - Math.round(255 * amt));
  const b = Math.max(0, (n & 0xff) - Math.round(255 * amt));
  return `#${((r<<16)|(g<<8)|b).toString(16).padStart(6,"0")}`;
}
function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#",""), 16);
  const r = Math.min(255, (n >> 16) + Math.round(255 * amt));
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.round(255 * amt));
  const b = Math.min(255, (n & 0xff) + Math.round(255 * amt));
  return `#${((r<<16)|(g<<8)|b).toString(16).padStart(6,"0")}`;
}

// ── Hair layers ───────────────────────────────────────────────────────────────
function HairBack({ style, color }: { style:number; color:string }) {
  if (style === 0) return null;
  if (style === 2) return <path d="M 34 240 Q 36 130 50 96 Q 60 60 100 54 Q 140 60 150 96 Q 164 130 166 240 Z" fill={color}/>;
  if (style === 5) return (
    <>
      <path d="M 34 240 Q 36 130 50 96 Q 60 60 100 54 Q 140 60 150 96 Q 164 130 166 240 Z" fill={color}/>
      <circle cx="100" cy="34" r="22" fill={color}/>
    </>
  );
  return null;
}

function HairCap({ style, color, acc }: { style:number; color:string; acc:string }) {
  if (style === 0) return null;
  const hi = lighten(color, 0.12);
  switch (style) {
    case 1:
      return (
        <>
          <path d="M 52 120 Q 56 60 100 54 Q 144 60 148 120 Q 144 68 100 64 Q 56 68 52 120 Z" fill={color}/>
          <path d="M 68 90 Q 100 78 132 90" stroke={hi} strokeWidth="1" fill="none" opacity="0.5"/>
        </>
      );
    case 2:
      return <path d="M 52 118 Q 56 60 100 54 Q 144 60 148 118 Q 144 68 100 64 Q 56 68 52 118 Z" fill={color}/>;
    case 3:
      return (
        <>
          <path d="M 52 120 Q 56 64 100 58 Q 144 64 148 120 Q 144 72 100 68 Q 56 72 52 120 Z" fill={color}/>
          <path d="M 78 68 Q 88 40 118 52 Q 106 58 92 68 Z" fill={color}/>
          <path d="M 88 55 Q 100 42 112 50" stroke={hi} strokeWidth="1.2" fill="none" opacity="0.6"/>
        </>
      );
    case 4:
      return (
        <>
          <ellipse cx="100" cy="68" rx="62" ry="52" fill={color}/>
          <ellipse cx="100" cy="58" rx="42" ry="30" fill={hi} opacity="0.2"/>
        </>
      );
    case 5:
      return (
        <>
          <path d="M 52 120 Q 56 60 100 54 Q 144 60 148 120 Q 144 70 100 66 Q 56 70 52 120 Z" fill={color}/>
          <circle cx="100" cy="36" r="18" fill={color}/>
          {/* bun wrap lines */}
          <circle cx="100" cy="36" r="14" fill="none" stroke={acc} strokeWidth="0.7" opacity="0.5"/>
        </>
      );
    default: return null;
  }
}

// ── Cyberpunk Eye ─────────────────────────────────────────────────────────────
function CyberEye({ cx, cy, eyeColor, acc }: { cx:number; cy:number; eyeColor:string; acc:string }) {
  const g1 = { filter:`drop-shadow(0 0 6px ${eyeColor}) drop-shadow(0 0 14px ${eyeColor}88)` };
  const g2 = { filter:`drop-shadow(0 0 3px ${acc})` };
  return (
    <g>
      {/* Outer ambient glow */}
      <ellipse cx={cx} cy={cy} rx="20" ry="14" fill={eyeColor} opacity="0.06"/>
      <ellipse cx={cx} cy={cy} rx="16" ry="11" fill={eyeColor} opacity="0.1"/>
      {/* Eyelid shadow top/bottom */}
      <ellipse cx={cx} cy={cy-5} rx="14" ry="6" fill="#050510" opacity="0.4"/>
      <ellipse cx={cx} cy={cy+5} rx="14" ry="6" fill="#050510" opacity="0.3"/>
      {/* White sclera */}
      <ellipse cx={cx} cy={cy} rx="14" ry="9.5" fill="#e8eeff" opacity="0.92"/>
      {/* Iris — colored + large */}
      <circle cx={cx} cy={cy} r="7.5" fill={darken(eyeColor,0.25)}/>
      {/* Iris ring segments */}
      {[0,60,120,180,240,300].map(deg=>{
        const rad=deg*Math.PI/180;
        const x1=cx+Math.cos(rad)*4.8, y1=cy+Math.sin(rad)*4.8;
        const x2=cx+Math.cos(rad)*7.2, y2=cy+Math.sin(rad)*7.2;
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={eyeColor} strokeWidth="0.5" opacity="0.6"/>;
      })}
      {/* Iris bright ring */}
      <circle cx={cx} cy={cy} r="7.4" fill="none" stroke={eyeColor} strokeWidth="1.2" opacity="0.8" style={g1}/>
      {/* Pupil */}
      <circle cx={cx} cy={cy} r="3.8" fill="#020208"/>
      {/* Pupil inner hex hint */}
      <circle cx={cx} cy={cy} r="2.2" fill={eyeColor} opacity="0.25"/>
      {/* Eye glow ring outer */}
      <ellipse cx={cx} cy={cy} rx="14" ry="9.5" fill="none" stroke={eyeColor} strokeWidth="0.6" opacity="0.7" style={g1}/>
      {/* Tech scan line */}
      <line x1={cx-14} y1={cy} x2={cx+14} y2={cy} stroke={acc} strokeWidth="0.35" opacity="0.45" style={g2}/>
      {/* Reflections */}
      <ellipse cx={cx-3} cy={cy-3} rx="2.5" ry="1.4" fill="white" opacity="0.75" transform={`rotate(-20,${cx-3},${cy-3})`}/>
      <circle cx={cx+4} cy={cy+2} r="0.9" fill="white" opacity="0.45"/>
    </g>
  );
}

// ── Mouth ─────────────────────────────────────────────────────────────────────
function MouthSVG({ expression, skin }: { expression:number; skin:string }) {
  const lip = darken(skin, 0.22);
  switch (expression) {
    case 1:
      return (
        <>
          <path d="M 84 148 Q 100 163 116 148" stroke={lip} strokeWidth="2.4" fill="none" strokeLinecap="round"/>
          <path d="M 88 149 Q 100 160 112 149 L 112 154 Q 100 163 88 154 Z" fill="rgba(255,255,255,0.75)"/>
          <path d="M 84 148 Q 100 152 116 148" stroke={darken(lip,0.1)} strokeWidth="1" fill="none" opacity="0.5"/>
        </>
      );
    case 2:
      return (
        <>
          <path d="M 85 152 Q 100 147 115 152" stroke={lip} strokeWidth="2.2" fill="none" strokeLinecap="round"/>
          <line x1="92" y1="150" x2="108" y2="150" stroke={darken(lip,0.12)} strokeWidth="0.7" opacity="0.5"/>
        </>
      );
    default:
      return (
        <>
          <path d="M 86 149 Q 100 153 114 149" stroke={lip} strokeWidth="2.2" fill="none" strokeLinecap="round"/>
          <path d="M 86 149 Q 100 147 114 149" stroke="rgba(255,255,255,0.12)" strokeWidth="1" fill="none"/>
        </>
      );
  }
}

// ── Augmentation ─────────────────────────────────────────────────────────────
function AugmentSVG({ style, color }: { style:number; color:string }) {
  const glo = { filter:`drop-shadow(0 0 5px ${color}) drop-shadow(0 0 10px ${color}60)` };
  if (style === 0) return null;
  if (style === 1) return (
    // Neural circuit traces on temples
    <g opacity="0.9">
      {/* Left temple circuits */}
      <path d="M 54 104 L 44 104 L 40 110 L 32 110 L 32 118 L 26 118 L 24 124"
            stroke={color} strokeWidth="0.9" fill="none" style={glo}/>
      <circle cx="24" cy="124" r="2" fill={color} style={glo}/>
      <circle cx="32" cy="110" r="1.4" fill={color} opacity="0.8"/>
      <path d="M 38 110 L 38 104 L 44 100" stroke={color} strokeWidth="0.65" fill="none" opacity="0.6"/>
      {/* Right temple circuits */}
      <path d="M 146 104 L 156 104 L 160 110 L 168 110 L 168 118 L 174 118 L 176 124"
            stroke={color} strokeWidth="0.9" fill="none" style={glo}/>
      <circle cx="176" cy="124" r="2" fill={color} style={glo}/>
      <circle cx="168" cy="110" r="1.4" fill={color} opacity="0.8"/>
      {/* Forehead node */}
      <circle cx="100" cy="80" r="2.2" fill={color} style={glo}/>
      <path d="M 100 82 L 100 90" stroke={color} strokeWidth="0.7" opacity="0.55"/>
      <path d="M 96 80 L 88 78" stroke={color} strokeWidth="0.6" opacity="0.45"/>
      <path d="M 104 80 L 112 78" stroke={color} strokeWidth="0.6" opacity="0.45"/>
    </g>
  );
  if (style === 2) return (
    // Glowing halo ring
    <g>
      <ellipse cx="100" cy="78" rx="56" ry="14" fill="none"
               stroke={color} strokeWidth="2.5" opacity="0.7" style={glo}/>
      <ellipse cx="100" cy="78" rx="56" ry="14" fill="none"
               stroke={color} strokeWidth="0.5" opacity="0.4"/>
      {/* Halo nodes */}
      {[0,45,90,135,180,225,270,315].map(a=>{
        const r=a*Math.PI/180; const x=100+Math.cos(r)*56, y=78+Math.sin(r)*14;
        return <circle key={a} cx={x} cy={y} r="1.5" fill={color} opacity="0.8" style={glo}/>;
      })}
    </g>
  );
  if (style === 3) return (
    // Cyber visor / tactical overlay
    <g>
      <rect x="56" y="96" width="88" height="24" rx="5"
            fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1" opacity="0.85" style={glo}/>
      {/* Corner bolts */}
      {([[56,96],[144,96],[56,120],[144,120]] as [number,number][]).map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r="2" fill={color} opacity="0.9"/>
      ))}
      {/* Scan bar */}
      <rect x="58" y="107" width="84" height="2" rx="1" fill={color} opacity="0.45"/>
      {/* Left data readout */}
      <path d="M 50 104 L 42 104 L 40 108" stroke={color} strokeWidth="0.8" fill="none" opacity="0.7"/>
      <path d="M 50 116 L 42 116 L 40 112" stroke={color} strokeWidth="0.8" fill="none" opacity="0.7"/>
      {/* Right data readout */}
      <path d="M 150 104 L 158 104 L 160 108" stroke={color} strokeWidth="0.8" fill="none" opacity="0.7"/>
      <path d="M 150 116 L 158 116 L 160 112" stroke={color} strokeWidth="0.8" fill="none" opacity="0.7"/>
    </g>
  );
  return null;
}

// ── Accessory ─────────────────────────────────────────────────────────────────
function AccessorySVG({ style, color, ey }: { style:number; color:string; ey:number }) {
  const glo = { filter:`drop-shadow(0 0 4px ${color})` };
  if (style === 0) return null;
  if (style === 1) return (
    // Tech glasses
    <g>
      <rect x="63" y={ey-10} width="28" height="20" rx="5"
            fill={color} fillOpacity="0.1" stroke={color} strokeWidth="1.2" style={glo}/>
      <rect x="109" y={ey-10} width="28" height="20" rx="5"
            fill={color} fillOpacity="0.1" stroke={color} strokeWidth="1.2" style={glo}/>
      {/* Bridge */}
      <path d={`M 91 ${ey} L 109 ${ey}`}
            stroke={color} strokeWidth="1.4" fill="none"/>
      {/* Temple arms */}
      <line x1="63" y1={ey} x2="52" y2={ey+3} stroke={color} strokeWidth="1.2"/>
      <line x1="137" y1={ey} x2="148" y2={ey+3} stroke={color} strokeWidth="1.2"/>
    </g>
  );
  if (style === 2) return (
    // Ear comm device
    <g>
      <circle cx="155" cy={ey+4} r="6" fill="#0a0a1e" stroke={color} strokeWidth="1.1"/>
      <circle cx="155" cy={ey+4} r="2.5" fill={color} opacity="0.9" style={glo}/>
      <path d={`M 150 ${ey+2} L 147 ${ey+4} L 150 ${ey+6}`}
            stroke={color} strokeWidth="0.9" fill="none" opacity="0.7"/>
      <path d={`M 155 ${ey-2} L 155 ${ey-7}`}
            stroke={color} strokeWidth="0.7" opacity="0.55"/>
    </g>
  );
  if (style === 3) return (
    // Full visor
    <path d={`M 54 ${ey-14} Q 100 ${ey-20} 146 ${ey-14} L 144 ${ey+12} Q 100 ${ey+8} 56 ${ey+12} Z`}
          fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1" style={glo}/>
  );
  return null;
}

// ── Main Portrait SVG — cyberpunk style ───────────────────────────────────────
export function PortraitSVG({ cfg, uid }: { cfg: PortraitConfig; uid: string }) {
  const skin  = SKIN_TONES[Math.min(cfg.skinTone, SKIN_TONES.length - 1)];
  const acc   = cfg.accentColor;
  const dSkin = darken(skin, 0.18);
  const ringGlow = { filter:`drop-shadow(0 0 10px ${acc}) drop-shadow(0 0 20px ${acc}55)` };
  const accGlow  = { filter:`drop-shadow(0 0 6px ${acc})` };

  return (
    <svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg"
         style={{ display:"block", width:"100%", height:"100%" }}>
      <defs>
        {/* Background gradient — deep dark with accent bloom */}
        <radialGradient id={`bg-${uid}`} cx="50%" cy="32%" r="68%">
          <stop offset="0%"   stopColor={acc} stopOpacity="0.28"/>
          <stop offset="60%"  stopColor="#06060f" stopOpacity="0.95"/>
          <stop offset="100%" stopColor="#020208" stopOpacity="1"/>
        </radialGradient>
        {/* Face gradient — skin with dramatic lighting */}
        <radialGradient id={`face-${uid}`} cx="38%" cy="30%" r="65%">
          <stop offset="0%"   stopColor={lighten(skin,0.12)} stopOpacity="1"/>
          <stop offset="55%"  stopColor={skin}  stopOpacity="1"/>
          <stop offset="100%" stopColor={dSkin} stopOpacity="1"/>
        </radialGradient>
        {/* Neck gradient */}
        <linearGradient id={`neck-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={skin}  stopOpacity="1"/>
          <stop offset="100%" stopColor={dSkin} stopOpacity="0.7"/>
        </linearGradient>
        {/* Outfit gradient */}
        <linearGradient id={`outfit-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#0d0d22"/>
          <stop offset="100%" stopColor="#04040e"/>
        </linearGradient>
        <clipPath id={`clip-${uid}`}>
          <circle cx="100" cy="118" r="97"/>
        </clipPath>
      </defs>

      {/* Base circle */}
      <circle cx="100" cy="118" r="100" fill="#02020a"/>

      <g clipPath={`url(#clip-${uid})`}>
        {/* Background */}
        <rect width="200" height="240" fill={`url(#bg-${uid})`}/>

        {/* Hex grid pattern (subtle) */}
        <g opacity="0.04" stroke="white" strokeWidth="0.3" fill="none">
          {Array.from({length:7},(_,row)=>
            Array.from({length:5},(_,col)=>{
              const cx2=col*40+(row%2)*20, cy2=row*34-10;
              const pts=Array.from({length:6},(_,i)=>{
                const a=i*60*Math.PI/180;
                return `${cx2+14*Math.cos(a)},${cy2+14*Math.sin(a)}`;
              }).join(" ");
              return <polygon key={`${row}-${col}`} points={pts}/>;
            })
          )}
        </g>

        {/* Scanlines */}
        <g opacity="0.045">
          {Array.from({length:30},(_,i)=>(
            <line key={i} x1="0" y1={i*8} x2="200" y2={i*8} stroke="white" strokeWidth="0.5"/>
          ))}
        </g>

        {/* Back hair */}
        <HairBack style={cfg.hairStyle} color={cfg.hairColor}/>

        {/* ── Outfit / body ── */}
        {/* Body silhouette */}
        <path d="M 60 186 Q 32 202 -4 240 L 204 240 Q 168 202 140 186 Q 122 176 100 174 Q 78 176 60 186 Z"
              fill={`url(#outfit-${uid})`}/>
        {/* Armored collar plates */}
        <path d="M 60 186 Q 78 174 100 172 Q 122 174 140 186 L 136 196 Q 118 188 100 186 Q 82 188 64 196 Z"
              fill="#0e0e28"/>
        {/* Collar glow line */}
        <path d="M 64 190 Q 82 182 100 180 Q 118 182 136 190"
              fill="none" stroke={acc} strokeWidth="1.6" opacity="0.85" style={accGlow}/>
        {/* Shoulder glow lines */}
        <path d="M 60 186 Q 32 204 -4 240" fill="none" stroke={acc} strokeWidth="1" opacity="0.4"/>
        <path d="M 140 186 Q 168 204 204 240" fill="none" stroke={acc} strokeWidth="1" opacity="0.4"/>
        {/* Tech badge on chest */}
        <rect x="88" y="206" width="24" height="14" rx="3" fill="#0c0c22" stroke={acc} strokeWidth="0.7" opacity="0.6"/>
        <rect x="91" y="209" width="18" height="2" rx="1" fill={acc} opacity="0.45"/>
        <rect x="91" y="213" width="12" height="2" rx="1" fill={acc} opacity="0.3"/>
        {/* Chest glow */}
        <ellipse cx="100" cy="220" rx="50" ry="22" fill={acc} fillOpacity="0.07"/>

        {/* ── Neck ── */}
        <path d="M 86 188 Q 86 170 88 166 L 112 166 Q 114 170 114 188 Q 106 192 100 192 Q 94 192 86 188 Z"
              fill={`url(#neck-${uid})`}/>
        {/* Neck circuit */}
        <path d="M 96 180 L 96 172 L 100 168 L 104 172 L 104 180"
              stroke={acc} strokeWidth="0.55" fill="none" opacity="0.35"/>

        {/* ── Ears ── */}
        <path d="M 50 106 Q 44 110 43 118 Q 44 126 50 128 Q 55 126 56 118 Q 55 110 50 106 Z"
              fill={skin}/>
        <path d="M 50 110 Q 47 118 50 126 Q 53 118 50 110 Z" fill={dSkin} opacity="0.4"/>
        {/* Ear tech detail */}
        <circle cx="47" cy="118" r="1.4" fill={acc} opacity="0.6" style={accGlow}/>

        <path d="M 150 106 Q 156 110 157 118 Q 156 126 150 128 Q 145 126 144 118 Q 145 110 150 106 Z"
              fill={skin}/>
        <path d="M 150 110 Q 153 118 150 126 Q 147 118 150 110 Z" fill={dSkin} opacity="0.4"/>
        <circle cx="153" cy="118" r="1.4" fill={acc} opacity="0.6" style={accGlow}/>

        {/* ── Face ── */}
        {/* Face shape — slightly angular */}
        <path d={`M 56 105 Q 56 70 100 62 Q 144 70 144 105 Q 146 130 136 148 Q 126 162 100 166 Q 74 162 64 148 Q 54 130 56 105 Z`}
              fill={`url(#face-${uid})`}/>
        {/* Face side shadows (depth) */}
        <path d="M 56 105 Q 56 70 100 62 Q 64 72 60 108 Q 58 128 68 148 Z" fill="rgba(0,0,0,0.12)"/>
        <path d="M 144 105 Q 144 70 100 62 Q 136 72 140 108 Q 142 128 132 148 Z" fill="rgba(0,0,0,0.08)"/>
        {/* Cheek highlights */}
        <ellipse cx="74" cy="126" rx="9" ry="7" fill="rgba(255,255,255,0.055)" transform="rotate(-8,74,126)"/>
        <ellipse cx="126" cy="126" rx="9" ry="7" fill="rgba(255,255,255,0.04)" transform="rotate(8,126,126)"/>
        {/* Forehead accent sheen */}
        <ellipse cx="100" cy="76" rx="26" ry="8" fill="rgba(255,255,255,0.04)"/>

        {/* ── Hair cap ── */}
        <HairCap style={cfg.hairStyle} color={cfg.hairColor} acc={acc}/>

        {/* ── Eyebrows — sharp/angular ── */}
        <path d="M 66 93 Q 74 86 92 93" stroke={cfg.hairColor} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.92"/>
        <path d="M 66 93 Q 74 87 92 93" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
        <path d="M 108 93 Q 126 86 134 93" stroke={cfg.hairColor} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.92"/>
        <path d="M 108 93 Q 126 87 134 93" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>

        {/* ── Eyes — cyberpunk large ── */}
        <CyberEye cx={78} cy={108} eyeColor={cfg.eyeColor} acc={acc}/>
        <CyberEye cx={122} cy={108} eyeColor={cfg.eyeColor} acc={acc}/>

        {/* ── Nose ── */}
        <path d="M 100 125 Q 96 134 94 136 Q 100 138 106 136 Q 104 134 100 125 Z"
              fill={dSkin} opacity="0.4"/>
        <ellipse cx="95" cy="136" rx="3.5" ry="2.2" fill={dSkin} opacity="0.3"/>
        <ellipse cx="105" cy="136" rx="3.5" ry="2.2" fill={dSkin} opacity="0.3"/>

        {/* ── Mouth ── */}
        <MouthSVG expression={cfg.expression} skin={skin}/>

        {/* ── Augmentations ── */}
        <AugmentSVG style={cfg.augmentation} color={acc}/>

        {/* ── Accessory ── */}
        <AccessorySVG style={cfg.accessory} color={acc} ey={108}/>
      </g>

      {/* ── Outer frame — HUD style ── */}
      {/* Main glow ring */}
      <circle cx="100" cy="118" r="96" fill="none"
              stroke={acc} strokeWidth="1.8" opacity="0.8" style={ringGlow}/>
      {/* Secondary thin ring */}
      <circle cx="100" cy="118" r="91" fill="none"
              stroke={acc} strokeWidth="0.4" opacity="0.25"/>
      {/* HUD corner brackets */}
      {([[-1,-1],[1,-1],[1,1],[-1,1]] as [number,number][]).map(([sx,sy],i)=>{
        const bx=100+sx*82, by=118+sy*82;
        return (
          <g key={i} stroke={acc} strokeWidth="1.8" fill="none" opacity="0.9" style={accGlow}>
            <line x1={bx} y1={by} x2={bx-sx*12} y2={by}/>
            <line x1={bx} y1={by} x2={bx} y2={by-sy*12}/>
          </g>
        );
      })}
      {/* Small data dots at 12/3/6/9 o'clock */}
      {[0,90,180,270].map(a=>{
        const r2=a*Math.PI/180;
        return <circle key={a} cx={100+Math.cos(r2)*96} cy={118+Math.sin(r2)*96} r="1.8" fill={acc} opacity="0.7" style={accGlow}/>;
      })}
      {/* Vignette effect */}
      <circle cx="100" cy="118" r="97" fill="none"
              stroke="#02020a" strokeWidth="6" opacity="0.5"/>
    </svg>
  );
}

// ── AgentPortraitCard — circular card variant ─────────────────────────────────
export function AgentPortraitCard({
  agentId, category, size = "md",
}: {
  agentId: string; category: string; size?: "sm"|"md"|"lg"|"xl";
}) {
  const [cfg, setCfg] = useState<PortraitConfig>(() => getDefaultPortrait(category));
  const uid = `pc_${agentId.replace(/[^a-zA-Z0-9]/g,"_")}`;

  useEffect(() => {
    setCfg(getPortraitConfig(agentId, category));
    const handler = (e: StorageEvent) => {
      if (e.key === `norys:portrait:${agentId}`) setCfg(getPortraitConfig(agentId, category));
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [agentId, category]);

  const dim = { sm:32, md:48, lg:64, xl:80 }[size];
  const acc = cfg.accentColor;

  return (
    <div style={{
      width:dim, height:dim, borderRadius:"50%", overflow:"hidden", flexShrink:0,
      border:`1.5px solid ${acc}55`,
      boxShadow:`0 0 12px ${acc}30, 0 0 24px ${acc}15`,
      background:"#04040e",
    }}>
      <PortraitSVG cfg={cfg} uid={uid}/>
    </div>
  );
}

// ── AgentPortraitEditor ───────────────────────────────────────────────────────
const P_TABS = ["Teint","Cheveux","Regard","Style"] as const;
type PTab = typeof P_TABS[number];

export function AgentPortraitEditor({
  agentId, category, onSave,
}: {
  agentId: string; category: string; onSave?: (cfg: PortraitConfig) => void;
}) {
  const [cfg, setCfg]         = useState<PortraitConfig>(() => getPortraitConfig(agentId, category));
  const [tab, setTab]         = useState<PTab>("Teint");
  const uid = `pe_${agentId.replace(/[^a-zA-Z0-9]/g,"_")}`;

  function upd(patch: Partial<PortraitConfig>) { setCfg(p => ({ ...p, ...patch })); }

  function save() {
    savePortraitConfig(agentId, cfg);
    window.dispatchEvent(new StorageEvent("storage", { key:`norys:portrait:${agentId}` }));
    onSave?.(cfg);
  }

  const swatch = (color: string, sel: boolean, onClick: () => void, sz = 24) => (
    <button key={color} onClick={onClick} style={{
      width:sz, height:sz, borderRadius:"50%", padding:0, cursor:"pointer",
      background: color, flexShrink:0,
      border: sel ? "3px solid white" : "2px solid transparent",
      boxShadow: sel ? `0 0 0 2px ${cfg.accentColor}` : "none",
    }}/>
  );

  const chip = (label: string, sel: boolean, onClick: () => void) => (
    <button key={label} onClick={onClick} style={{
      padding:"5px 6px", borderRadius:8, cursor:"pointer", fontSize:11,
      textAlign:"center" as const,
      border: sel ? `1.5px solid ${cfg.accentColor}` : "0.5px solid rgba(255,255,255,0.1)",
      background: sel ? `${cfg.accentColor}18` : "rgba(255,255,255,0.03)",
      color: sel ? cfg.accentColor : "#9898a8", fontWeight: sel ? 600 : 400,
    }}>
      {label}
    </button>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", gap:0 }}>
      {/* Portrait preview */}
      <div style={{ height:200, display:"flex", justifyContent:"center", marginBottom:10, flexShrink:0 }}>
        <div style={{
          width:168, height:200, borderRadius:16, overflow:"hidden",
          border:`1.5px solid ${cfg.accentColor}55`,
          boxShadow:`0 0 20px ${cfg.accentColor}25`,
        }}>
          <PortraitSVG cfg={cfg} uid={uid}/>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:3, marginBottom:8, flexShrink:0 }}>
        {P_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-1.5 text-[10px] font-semibold transition-colors ${
              tab===t ? "bg-brand text-white" : "text-content-muted border border-border"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div style={{ flex:1, overflowY:"auto", minHeight:80 }}>
        {tab === "Teint" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div>
              <p style={{ fontSize:10, color:"#666", marginBottom:5 }}>Teint de peau</p>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                {SKIN_TONES.map((c,i) => swatch(c, cfg.skinTone===i, () => upd({ skinTone:i }), 26))}
              </div>
            </div>
          </div>
        )}

        {tab === "Cheveux" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div>
              <p style={{ fontSize:10, color:"#666", marginBottom:5 }}>Coiffure</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:4 }}>
                {["Aucun","Court","Long","Quiff","Afro","Chignon"].map((n,i) =>
                  chip(n, cfg.hairStyle===i, () => upd({ hairStyle:i }))
                )}
              </div>
            </div>
            <div>
              <p style={{ fontSize:10, color:"#666", marginBottom:5 }}>Couleur</p>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                {HAIR_COLORS_P.map(c => swatch(c, cfg.hairColor===c, () => upd({ hairColor:c }), 24))}
              </div>
            </div>
          </div>
        )}

        {tab === "Regard" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div>
              <p style={{ fontSize:10, color:"#666", marginBottom:5 }}>Couleur des yeux</p>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                {EYE_COLORS_P.map(c => swatch(c, cfg.eyeColor===c, () => upd({ eyeColor:c }), 26))}
              </div>
            </div>
            <div>
              <p style={{ fontSize:10, color:"#666", marginBottom:5 }}>Expression</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:4 }}>
                {["Neutre","Sourire","Concentré"].map((n,i) =>
                  chip(n, cfg.expression===i, () => upd({ expression:i }))
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "Style" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div>
              <p style={{ fontSize:10, color:"#666", marginBottom:5 }}>Couleur d&apos;accent</p>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                {ACCENT_COLORS_P.map(c => swatch(c, cfg.accentColor===c, () => upd({ accentColor:c }), 26))}
              </div>
            </div>
            <div>
              <p style={{ fontSize:10, color:"#666", marginBottom:5 }}>Augmentation</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:4 }}>
                {["Aucune","Circuits","Halo","Cyber"].map((n,i) =>
                  chip(n, cfg.augmentation===i, () => upd({ augmentation:i }))
                )}
              </div>
            </div>
            <div>
              <p style={{ fontSize:10, color:"#666", marginBottom:5 }}>Accessoire</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:4 }}>
                {["Aucun","Lunettes","Écouteur","Visière"].map((n,i) =>
                  chip(n, cfg.accessory===i, () => upd({ accessory:i }))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save */}
      <button onClick={save}
        className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
        style={{ background: cfg.accentColor, flexShrink:0 }}>
        Enregistrer l&apos;avatar
      </button>
    </div>
  );
}
