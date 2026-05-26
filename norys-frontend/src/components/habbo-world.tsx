"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";

// ─── WORLD CONSTANTS ─────────────────────────────────────────────────────────
const TW = 56;       // tile diamond width
const TH = 28;       // tile diamond height
const WALL_H = 54;   // wall pixel height
const OX = 820;      // world origin X (canvas space, before pan/zoom)
const OY = 160;      // world origin Y

// ─── PALETTES ────────────────────────────────────────────────────────────────
export const SKIN_TONES = [
  "#FDBCB4","#F1C27D","#E0AC69","#C68642","#8D5524","#4A2912",
];
export const HAIR_COLORS = [
  "#1a0a00","#3b1f0a","#6b3a1f","#c8a000","#e8c840","#ff6b35",
  "#c0392b","#8e44ad","#2980b9","#ecf0f1","#7f8c8d","#2c3e50",
  "#ff1493","#00ced1",
];
export const EYE_COLORS = [
  "#2c3e50","#1a6b3c","#1a3a6b","#6b3a1a","#8e44ad","#c0392b","#27ae60","#e67e22",
];
export const TOP_COLORS = [
  "#2c3e50","#c0392b","#27ae60","#2980b9","#8e44ad","#e67e22","#f39c12",
  "#ecf0f1","#7f8c8d","#1abc9c","#e74c3c","#3498db","#9b59b6","#f1c40f",
  "#34495e","#e91e63",
];
export const BOTTOM_COLORS = [
  "#2c3e50","#34495e","#7f8c8d","#1a3a5c","#4a1a2c","#1a4a2c","#5c4a1a","#2c1a4a",
  "#ecf0f1","#bdc3c7","#95a5a6","#1abc9c",
];
export const SHOE_COLORS = [
  "#1a0a00","#2c3e50","#7f8c8d","#ecf0f1","#c0392b","#2980b9","#27ae60","#8e44ad",
  "#e67e22","#f39c12",
];
export const ACC_COLORS = [
  "#f1c40f","#e74c3c","#3498db","#9b59b6","#1abc9c","#e67e22","#ecf0f1","#2c3e50",
];

export const CATEGORY_BADGE_COLORS: Record<string, string> = {
  helpdesk: "#e74c3c", hr: "#3498db", documents: "#f39c12",
  sales: "#9b59b6", support: "#27ae60", devops: "#1abc9c", default: "#7f8c8d",
};
export const CATEGORY_ICONS: Record<string, string> = {
  helpdesk: "🎧", hr: "👥", documents: "📄",
  sales: "💰", support: "🛠", devops: "⚙️", default: "🤖",
};
export const STATE_GLOW: Record<string, string> = {
  idle: "#7f8c8d", working: "#f39c12", thinking: "#9b59b6",
  talking: "#3498db", error: "#e74c3c", complete: "#27ae60",
};

// ─── INTERFACES ───────────────────────────────────────────────────────────────
export interface AvatarConfig {
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  eyeStyle: string;
  eyeColor: string;
  topStyle: string;
  topColor: string;
  bottomStyle: string;
  bottomColor: string;
  shoeStyle: string;
  shoeColor: string;
  accessory: string;
  badge: string;
}

export interface WorldAgent {
  id: string;
  name: string;
  category: string;
  state: string;
  avatar: AvatarConfig;
  tileX: number;
  tileY: number;
  targetTileX?: number;
  targetTileY?: number;
  chatBubble?: string;
  taskProgress?: number;
}

// ─── INTERNAL TYPES ───────────────────────────────────────────────────────────
interface FurnitureObj {
  gx: number;
  gy: number;
  type: string;
  color?: string;
  variant?: number;
}

interface ZoneDef {
  id: number;
  name: string;
  label: string;
  gx: number;
  gy: number;
  w: number;
  h: number;
  floorColor: string;
  floorDark: string;
  wallColor: string;
  wallColorL: string;
  badgeColor: string;
  objects: FurnitureObj[];
}

interface RenderItem {
  sortKey: number;
  render: (ctx: CanvasRenderingContext2D) => void;
}

// ─── ZONE DEFINITIONS ────────────────────────────────────────────────────────
const ZONES: ZoneDef[] = [
  {
    id: 1, name: "accueil", label: "Accueil",
    gx: 0, gy: 0, w: 9, h: 7,
    floorColor: "#C8A882", floorDark: "#B09870",
    wallColor: "#D4C0A8", wallColorL: "#BEA898",
    badgeColor: "#e67e22",
    objects: [
      { gx: 2, gy: 1, type: "sofa", color: "#7B1212" },
      { gx: 4, gy: 1, type: "sofa", color: "#7B1212" },
      { gx: 2, gy: 4, type: "table_round", color: "#7A5010" },
      { gx: 4, gy: 4, type: "chair", color: "#7B1212" },
      { gx: 6, gy: 2, type: "plant", color: "#1E6B1E" },
      { gx: 6, gy: 5, type: "plant", color: "#1E6B1E" },
      { gx: 1, gy: 5, type: "desk", color: "#8B6030" },
      { gx: 1, gy: 6, type: "computer", color: "#1a2035" },
      { gx: 7, gy: 1, type: "sign", color: "#e67e22" },
    ],
  },
  {
    id: 2, name: "salon", label: "Salon VIP",
    gx: 10, gy: 0, w: 10, h: 7,
    floorColor: "#7A1818", floorDark: "#600808",
    wallColor: "#5A1010", wallColorL: "#4A0808",
    badgeColor: "#9b59b6",
    objects: [
      { gx: 11, gy: 1, type: "sofa_l", color: "#320808" },
      { gx: 14, gy: 1, type: "sofa_l", color: "#320808" },
      { gx: 17, gy: 1, type: "sofa_l", color: "#320808" },
      { gx: 12, gy: 3, type: "table", color: "#4A2008" },
      { gx: 15, gy: 3, type: "table", color: "#4A2008" },
      { gx: 11, gy: 5, type: "counter", color: "#2A1000" },
      { gx: 13, gy: 5, type: "counter", color: "#2A1000" },
      { gx: 15, gy: 5, type: "counter", color: "#2A1000" },
      { gx: 18, gy: 2, type: "plant", color: "#0E380E" },
      { gx: 18, gy: 5, type: "plant", color: "#0E380E" },
    ],
  },
  {
    id: 3, name: "missions", label: "Missions",
    gx: 21, gy: 1, w: 9, h: 8,
    floorColor: "#1A3558", floorDark: "#0E2240",
    wallColor: "#162A48", wallColorL: "#0A1E38",
    badgeColor: "#e74c3c",
    objects: [
      { gx: 22, gy: 2, type: "mission_board", color: "#081830" },
      { gx: 25, gy: 2, type: "desk", color: "#162A50" },
      { gx: 27, gy: 2, type: "desk", color: "#162A50" },
      { gx: 25, gy: 3, type: "computer", color: "#0d1b2a" },
      { gx: 27, gy: 3, type: "computer", color: "#0d1b2a" },
      { gx: 22, gy: 5, type: "desk", color: "#162A50" },
      { gx: 24, gy: 5, type: "desk", color: "#162A50" },
      { gx: 22, gy: 6, type: "computer", color: "#0d1b2a" },
      { gx: 24, gy: 6, type: "computer", color: "#0d1b2a" },
      { gx: 28, gy: 4, type: "shelf", color: "#162A50" },
      { gx: 28, gy: 7, type: "plant", color: "#0E3A1E" },
    ],
  },
  {
    id: 4, name: "boutique", label: "Boutique",
    gx: 0, gy: 8, w: 9, h: 7,
    floorColor: "#D09858", floorDark: "#B07840",
    wallColor: "#B08050", wallColorL: "#907040",
    badgeColor: "#f39c12",
    objects: [
      { gx: 1, gy: 9, type: "shelf", color: "#4A2008" },
      { gx: 1, gy: 11, type: "shelf", color: "#4A2008" },
      { gx: 3, gy: 9, type: "shelf", color: "#4A2008" },
      { gx: 5, gy: 9, type: "counter", color: "#7A3810" },
      { gx: 5, gy: 11, type: "counter", color: "#7A3810" },
      { gx: 7, gy: 10, type: "counter", color: "#7A3810" },
      { gx: 3, gy: 12, type: "plant", color: "#205810" },
      { gx: 7, gy: 13, type: "plant", color: "#205810" },
      { gx: 1, gy: 13, type: "desk", color: "#7A5820" },
    ],
  },
  {
    id: 7, name: "hall", label: "Hall Central",
    gx: 10, gy: 8, w: 10, h: 6,
    floorColor: "#888070", floorDark: "#686050",
    wallColor: "#706858", wallColorL: "#605848",
    badgeColor: "#7f8c8d",
    objects: [
      { gx: 14, gy: 10, type: "fountain", color: "#3A7AAA" },
      { gx: 11, gy: 9, type: "bench", color: "#4A2808" },
      { gx: 17, gy: 9, type: "bench", color: "#4A2808" },
      { gx: 11, gy: 12, type: "plant", color: "#205810" },
      { gx: 18, gy: 12, type: "plant", color: "#205810" },
    ],
  },
  {
    id: 5, name: "jeu", label: "Salle de Jeu",
    gx: 0, gy: 16, w: 10, h: 9,
    floorColor: "#140820", floorDark: "#0A0412",
    wallColor: "#100618", wallColorL: "#0A0412",
    badgeColor: "#8e44ad",
    objects: [
      { gx: 1, gy: 17, type: "arcade", color: "#cc0000", variant: 0 },
      { gx: 3, gy: 17, type: "arcade", color: "#0055cc", variant: 1 },
      { gx: 5, gy: 17, type: "arcade", color: "#7700cc", variant: 2 },
      { gx: 7, gy: 17, type: "arcade", color: "#007700", variant: 3 },
      { gx: 1, gy: 20, type: "arcade", color: "#cc7700", variant: 0 },
      { gx: 3, gy: 20, type: "arcade", color: "#cc0055", variant: 1 },
      { gx: 5, gy: 21, type: "bench", color: "#1a1a3a" },
      { gx: 7, gy: 21, type: "bench", color: "#1a1a3a" },
      { gx: 4, gy: 23, type: "table", color: "#1a1a3a" },
    ],
  },
  {
    id: 6, name: "jardin", label: "Jardin",
    gx: 11, gy: 15, w: 12, h: 10,
    floorColor: "#285018", floorDark: "#1A3A0A",
    wallColor: "#1A3A0A", wallColorL: "#102800",
    badgeColor: "#27ae60",
    objects: [
      { gx: 12, gy: 16, type: "tree", color: "#0E2A08" },
      { gx: 15, gy: 16, type: "tree", color: "#0E2A08" },
      { gx: 20, gy: 16, type: "tree", color: "#0E2A08" },
      { gx: 21, gy: 18, type: "tree", color: "#0E2A08" },
      { gx: 14, gy: 19, type: "pond", color: "#1E5A8A" },
      { gx: 17, gy: 20, type: "bench", color: "#4A2808" },
      { gx: 12, gy: 20, type: "bench", color: "#4A2808" },
      { gx: 13, gy: 22, type: "tree", color: "#0E2A08" },
      { gx: 19, gy: 22, type: "tree", color: "#0E2A08" },
      { gx: 21, gy: 21, type: "plant", color: "#2D5A1B" },
      { gx: 16, gy: 17, type: "plant", color: "#2D5A1B" },
    ],
  },
];

// ─── CATEGORY → ZONE MAPPING ──────────────────────────────────────────────────
const CATEGORY_ZONE: Record<string, string> = {
  helpdesk: "missions",
  hr: "accueil",
  documents: "boutique",
  sales: "salon",
  support: "missions",
  devops: "jeu",
  default: "jardin",
};

// ─── ISO PROJECTION ───────────────────────────────────────────────────────────
function iso(gx: number, gy: number) {
  return {
    x: OX + (gx - gy) * (TW / 2),
    y: OY + (gx + gy) * (TH / 2),
  };
}

// ─── COLOR HELPERS ────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16) || 0,
    parseInt(clean.slice(2, 4), 16) || 0,
    parseInt(clean.slice(4, 6), 16) || 0,
  ];
}

function lighten(hex: string, a: number): string {
  if (!hex.startsWith("#")) return hex;
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255, Math.round(r + a * 255))},${Math.min(255, Math.round(g + a * 255))},${Math.min(255, Math.round(b + a * 255))})`;
}

function darken(hex: string, a: number): string {
  if (!hex.startsWith("#")) return hex;
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.max(0, Math.round(r - a * 255))},${Math.max(0, Math.round(g - a * 255))},${Math.max(0, Math.round(b - a * 255))})`;
}

// ─── TILE ─────────────────────────────────────────────────────────────────────
function drawTile(ctx: CanvasRenderingContext2D, gx: number, gy: number, color: string) {
  const p = iso(gx, gy);
  const hw = TW / 2, hh = TH / 2;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + hw, p.y + hh);
  ctx.lineTo(p.x, p.y + TH);
  ctx.lineTo(p.x - hw, p.y + hh);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

// ─── WALLS ────────────────────────────────────────────────────────────────────
function drawBackWall(
  ctx: CanvasRenderingContext2D,
  zx: number, zy: number, zw: number,
  color: string, colorTop: string,
) {
  for (let i = 0; i < zw; i++) {
    const p1 = iso(zx + i, zy);
    const p2 = iso(zx + i + 1, zy);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p2.x, p2.y - WALL_H);
    ctx.lineTo(p1.x, p1.y - WALL_H);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y - WALL_H);
    ctx.lineTo(p2.x, p2.y - WALL_H);
    ctx.lineTo(p2.x, p2.y - WALL_H + 5);
    ctx.lineTo(p1.x, p1.y - WALL_H + 5);
    ctx.closePath();
    ctx.fillStyle = colorTop;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}

function drawLeftWall(
  ctx: CanvasRenderingContext2D,
  zx: number, zy: number, zh: number,
  color: string, colorTop: string,
) {
  for (let i = 0; i < zh; i++) {
    const p1 = iso(zx, zy + i);
    const p2 = iso(zx, zy + i + 1);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p2.x, p2.y - WALL_H);
    ctx.lineTo(p1.x, p1.y - WALL_H);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y - WALL_H);
    ctx.lineTo(p2.x, p2.y - WALL_H);
    ctx.lineTo(p2.x, p2.y - WALL_H + 5);
    ctx.lineTo(p1.x, p1.y - WALL_H + 5);
    ctx.closePath();
    ctx.fillStyle = colorTop;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}

// ─── ISO BOX ──────────────────────────────────────────────────────────────────
function drawBox(
  ctx: CanvasRenderingContext2D,
  gx: number, gy: number, bh: number,
  topC: string, leftC: string, rightC: string,
) {
  const p = iso(gx, gy);
  const hw = TW / 2, hh = TH / 2;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - bh);
  ctx.lineTo(p.x + hw, p.y + hh - bh);
  ctx.lineTo(p.x, p.y + TH - bh);
  ctx.lineTo(p.x - hw, p.y + hh - bh);
  ctx.closePath();
  ctx.fillStyle = topC;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(p.x - hw, p.y + hh - bh);
  ctx.lineTo(p.x, p.y + TH - bh);
  ctx.lineTo(p.x, p.y + TH);
  ctx.lineTo(p.x - hw, p.y + hh);
  ctx.closePath();
  ctx.fillStyle = leftC;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(p.x + hw, p.y + hh - bh);
  ctx.lineTo(p.x, p.y + TH - bh);
  ctx.lineTo(p.x, p.y + TH);
  ctx.lineTo(p.x + hw, p.y + hh);
  ctx.closePath();
  ctx.fillStyle = rightC;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

// ─── FURNITURE ────────────────────────────────────────────────────────────────
function drawChair(ctx: CanvasRenderingContext2D, gx: number, gy: number, color: string) {
  const p = iso(gx, gy);
  drawBox(ctx, gx, gy, 10, lighten(color, 0.08), darken(color, 0.25), darken(color, 0.1));
  ctx.beginPath();
  ctx.moveTo(p.x - TW / 2 + 3, p.y + TH / 2 - 10);
  ctx.lineTo(p.x, p.y + TH - 10);
  ctx.lineTo(p.x, p.y + TH - 26);
  ctx.lineTo(p.x - TW / 2 + 3, p.y + TH / 2 - 26);
  ctx.closePath();
  ctx.fillStyle = darken(color, 0.15);
  ctx.fill();
}

function drawSofa(ctx: CanvasRenderingContext2D, gx: number, gy: number, color: string) {
  const p = iso(gx, gy);
  const hw = TW / 2, hh = TH / 2;
  drawBox(ctx, gx, gy, 13, lighten(color, 0.06), darken(color, 0.28), darken(color, 0.12));
  ctx.beginPath();
  ctx.moveTo(p.x - hw + 2, p.y + hh - 13);
  ctx.lineTo(p.x + hw - 2, p.y + hh - 13);
  ctx.lineTo(p.x + hw - 2, p.y + hh - 27);
  ctx.lineTo(p.x - hw + 2, p.y + hh - 27);
  ctx.closePath();
  ctx.fillStyle = lighten(color, 0.12);
  ctx.fill();
}

function drawSofaL(ctx: CanvasRenderingContext2D, gx: number, gy: number, color: string) {
  const p = iso(gx, gy);
  const hw = TW / 2, hh = TH / 2;
  drawBox(ctx, gx, gy, 15, lighten(color, 0.1), darken(color, 0.3), darken(color, 0.15));
  ctx.beginPath();
  ctx.moveTo(p.x - hw, p.y + hh - 15);
  ctx.lineTo(p.x + hw, p.y + hh - 15);
  ctx.lineTo(p.x + hw, p.y + hh - 30);
  ctx.lineTo(p.x - hw, p.y + hh - 30);
  ctx.closePath();
  ctx.fillStyle = lighten(color, 0.06);
  ctx.fill();
  ctx.strokeStyle = "#b8960a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(p.x - hw, p.y + hh - 30);
  ctx.lineTo(p.x + hw, p.y + hh - 30);
  ctx.stroke();
}

function drawTable(ctx: CanvasRenderingContext2D, gx: number, gy: number, color: string) {
  drawBox(ctx, gx, gy, 9, lighten(color, 0.22), darken(color, 0.05), darken(color, 0.18));
}

function drawTableRound(ctx: CanvasRenderingContext2D, gx: number, gy: number, color: string) {
  const p = iso(gx, gy);
  const hw = TW / 2, hh = TH / 2;
  ctx.fillStyle = darken(color, 0.1);
  ctx.fillRect(p.x - 3, p.y + hh - 5, 6, 14);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + hh - 10, hw - 4, hh - 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = lighten(color, 0.2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawDesk(ctx: CanvasRenderingContext2D, gx: number, gy: number, color: string) {
  drawBox(ctx, gx, gy, 11, lighten(color, 0.15), darken(color, 0.08), darken(color, 0.22));
}

function drawComputer(ctx: CanvasRenderingContext2D, gx: number, gy: number, _color: string) {
  const p = iso(gx, gy);
  const hh = TH / 2;
  ctx.fillStyle = "#2c3e50";
  ctx.fillRect(p.x - 2, p.y + hh - 6, 4, 8);
  ctx.fillStyle = "#34495e";
  ctx.fillRect(p.x - 7, p.y + hh + 1, 14, 3);
  ctx.fillStyle = "#1a2035";
  ctx.fillRect(p.x - 11, p.y + hh - 22, 22, 17);
  ctx.fillStyle = "#0a0f20";
  ctx.fillRect(p.x - 9, p.y + hh - 20, 18, 14);
  ctx.fillStyle = "#00ffaa";
  ctx.fillRect(p.x - 7, p.y + hh - 18, 14, 1);
  ctx.fillStyle = "rgba(0,255,170,0.5)";
  ctx.fillRect(p.x - 7, p.y + hh - 15, 10, 1);
  ctx.fillRect(p.x - 7, p.y + hh - 12, 12, 1);
  ctx.shadowColor = "#00ffaa";
  ctx.shadowBlur = 6;
  ctx.fillStyle = "rgba(0,255,170,0.08)";
  ctx.fillRect(p.x - 9, p.y + hh - 20, 18, 14);
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}

function drawCounter(ctx: CanvasRenderingContext2D, gx: number, gy: number, color: string) {
  drawBox(ctx, gx, gy, 17, lighten(color, 0.12), darken(color, 0.05), darken(color, 0.22));
}

function drawShelf(ctx: CanvasRenderingContext2D, gx: number, gy: number, color: string) {
  const p = iso(gx, gy);
  const hw = TW / 2, hh = TH / 2;
  ctx.beginPath();
  ctx.moveTo(p.x - hw, p.y + hh);
  ctx.lineTo(p.x, p.y + TH);
  ctx.lineTo(p.x, p.y - 32);
  ctx.lineTo(p.x - hw, p.y + hh - 32);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const sy = p.y + TH - 6 - i * 11;
    ctx.fillStyle = lighten(color, 0.18);
    ctx.fillRect(p.x - hw + 1, sy - 2, hw - 2, 2);
    const itemColors = ["#c0392b", "#2980b9", "#f39c12"];
    ctx.fillStyle = itemColors[i];
    ctx.fillRect(p.x - hw + 3, sy - 8, 4, 6);
    ctx.fillRect(p.x - hw + 9, sy - 7, 3, 5);
  }
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

function drawPlant(ctx: CanvasRenderingContext2D, gx: number, gy: number, color: string) {
  const p = iso(gx, gy);
  const hh = TH / 2;
  ctx.fillStyle = "#7B3F00";
  ctx.beginPath();
  ctx.moveTo(p.x - 6, p.y + hh + 3);
  ctx.lineTo(p.x + 6, p.y + hh + 3);
  ctx.lineTo(p.x + 8, p.y + hh + 10);
  ctx.lineTo(p.x - 8, p.y + hh + 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#2D5A0A";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y + hh + 2);
  ctx.lineTo(p.x, p.y + hh - 12);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + hh - 17, 13, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = lighten(color, 0.12);
  ctx.beginPath();
  ctx.ellipse(p.x - 7, p.y + hh - 14, 8, 5, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(p.x + 7, p.y + hh - 14, 8, 5, 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawTree(ctx: CanvasRenderingContext2D, gx: number, gy: number, _color: string) {
  const p = iso(gx, gy);
  const hh = TH / 2;
  ctx.fillStyle = "#4A2808";
  ctx.fillRect(p.x - 5, p.y + hh - 8, 10, 22);
  ctx.fillStyle = "#5C3010";
  ctx.fillRect(p.x - 3, p.y + hh - 8, 3, 22);
  ctx.fillStyle = "#1A4A0A";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + hh - 18, 22, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#205A10";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + hh - 30, 17, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2D7A1A";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + hh - 42, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.ellipse(p.x - 3, p.y + hh - 45, 5, 4, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawArcade(ctx: CanvasRenderingContext2D, gx: number, gy: number, color: string, variant: number) {
  const p = iso(gx, gy);
  const hw = TW / 2, hh = TH / 2;
  drawBox(ctx, gx, gy, 26, "#1a1a2e", darken(color, 0.4), darken(color, 0.28));
  ctx.fillStyle = color;
  ctx.fillRect(p.x - hw + 2, p.y + hh - 32, hw * 2 - 4, 6);
  ctx.fillStyle = "#0a0a1a";
  ctx.fillRect(p.x - hw + 3, p.y + hh - 25, hw * 2 - 6, 14);
  const sc = [["#ff3333","#ffff00"],["#33aaff","#00ffff"],["#aa33ff","#ff00ff"],["#33ff44","#aaff00"]][variant % 4];
  ctx.fillStyle = sc[0];
  ctx.fillRect(p.x - hw + 5, p.y + hh - 23, hw * 2 - 10, 5);
  ctx.fillStyle = sc[1];
  ctx.fillRect(p.x - hw + 5, p.y + hh - 17, hw * 2 - 10, 3);
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = lighten(color, 0.4);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(p.x - hw + 3, p.y + hh - 25, hw * 2 - 6, 14);
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#0d0d1a";
  ctx.fillRect(p.x - hw + 3, p.y + hh - 11, hw * 2 - 6, 9);
  ctx.fillStyle = "#888";
  ctx.beginPath();
  ctx.arc(p.x - 5, p.y + hh - 6, 3, 0, Math.PI * 2);
  ctx.fill();
  const btnC = ["#ff0000", "#00cc00", "#0000ff"];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = btnC[i];
    ctx.beginPath();
    ctx.arc(p.x + 3 + i * 5, p.y + hh - 7, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFountain(ctx: CanvasRenderingContext2D, gx: number, gy: number, color: string) {
  const p = iso(gx, gy);
  const hw = TW / 2, hh = TH / 2;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + hh - 4, hw + 2, hh + 1, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#5A7A90";
  ctx.fill();
  ctx.strokeStyle = "#8AAABB";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + hh - 4, hw - 4, hh - 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = "rgba(160,220,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(p.x - 5, p.y + hh - 7, 8, 3, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#9AACB8";
  ctx.beginPath();
  ctx.arc(p.x, p.y + hh - 12, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#B0C0CC";
  ctx.fillRect(p.x - 2, p.y + hh - 20, 4, 9);
  ctx.strokeStyle = "rgba(100,180,255,0.65)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + hh - 22);
    ctx.quadraticCurveTo(
      p.x + Math.cos(a) * 8, p.y + hh - 28,
      p.x + Math.cos(a) * 13, p.y + hh - 4 + Math.sin(a) * 6,
    );
    ctx.stroke();
  }
}

function drawPond(ctx: CanvasRenderingContext2D, gx: number, gy: number, color: string) {
  const p = iso(gx, gy);
  const hw = TW / 2, hh = TH / 2;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + hh - 2, hw + 6, hh + 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#4A5A3A";
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + hh - 2, hw + 2, hh, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = "#2A6A1A";
  ctx.beginPath();
  ctx.ellipse(p.x - 6, p.y + hh - 5, 5, 3, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(p.x + 7, p.y + hh - 1, 4, 2.5, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(150,220,255,0.3)";
  ctx.beginPath();
  ctx.ellipse(p.x - 2, p.y + hh - 6, 7, 2.5, 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawMissionBoard(ctx: CanvasRenderingContext2D, gx: number, gy: number, _color: string) {
  const p = iso(gx, gy);
  const hw = TW / 2, hh = TH / 2;
  ctx.fillStyle = "#1A2A4A";
  ctx.fillRect(p.x - hw, p.y + hh - 40, hw * 2, 36);
  ctx.fillStyle = "#040C1C";
  ctx.fillRect(p.x - hw + 3, p.y + hh - 37, hw * 2 - 6, 30);
  ctx.shadowColor = "#00ff88";
  ctx.shadowBlur = 6;
  ctx.fillStyle = "#00ff88";
  for (let i = 0; i < 4; i++) {
    const lw = [26, 18, 22, 14][i];
    ctx.fillRect(p.x - lw / 2, p.y + hh - 33 + i * 7, lw, 2);
  }
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#00ccff";
  ctx.font = "bold 5px monospace";
  ctx.textAlign = "center";
  ctx.fillText("● MISSIONS ●", p.x, p.y + hh - 40);
}

function drawSign(ctx: CanvasRenderingContext2D, gx: number, gy: number, color: string) {
  const p = iso(gx, gy);
  const hh = TH / 2;
  ctx.fillStyle = "#555";
  ctx.fillRect(p.x - 1, p.y + hh - 18, 2, 18);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(p.x - 15, p.y + hh - 32, 30, 16, 3);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 5px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("NORYS", p.x, p.y + hh - 22);
}

function drawBench(ctx: CanvasRenderingContext2D, gx: number, gy: number, color: string) {
  const p = iso(gx, gy);
  const hw = TW / 2, hh = TH / 2;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y + hh - 10);
  ctx.lineTo(p.x + hw, p.y + TH - 10);
  ctx.lineTo(p.x + hw, p.y + TH - 7);
  ctx.lineTo(p.x, p.y + hh - 7);
  ctx.closePath();
  ctx.fillStyle = lighten(color, 0.1);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(p.x, p.y + hh - 10);
  ctx.lineTo(p.x - hw, p.y + TH - 10);
  ctx.lineTo(p.x - hw, p.y + TH - 7);
  ctx.lineTo(p.x, p.y + hh - 7);
  ctx.closePath();
  ctx.fillStyle = darken(color, 0.08);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillRect(p.x - hw + 2, p.y + TH - 7, 4, 8);
  ctx.fillRect(p.x + hw - 6, p.y + TH - 7, 4, 8);
}

function drawFurniture(ctx: CanvasRenderingContext2D, obj: FurnitureObj) {
  const { gx, gy, type, color = "#666", variant = 0 } = obj;
  switch (type) {
    case "chair": drawChair(ctx, gx, gy, color); break;
    case "sofa": drawSofa(ctx, gx, gy, color); break;
    case "sofa_l": drawSofaL(ctx, gx, gy, color); break;
    case "table": drawTable(ctx, gx, gy, color); break;
    case "table_round": drawTableRound(ctx, gx, gy, color); break;
    case "desk": drawDesk(ctx, gx, gy, color); break;
    case "computer": drawComputer(ctx, gx, gy, color); break;
    case "counter": drawCounter(ctx, gx, gy, color); break;
    case "shelf": drawShelf(ctx, gx, gy, color); break;
    case "plant": drawPlant(ctx, gx, gy, color); break;
    case "tree": drawTree(ctx, gx, gy, color); break;
    case "arcade": drawArcade(ctx, gx, gy, color, variant); break;
    case "fountain": drawFountain(ctx, gx, gy, color); break;
    case "pond": drawPond(ctx, gx, gy, color); break;
    case "mission_board": drawMissionBoard(ctx, gx, gy, color); break;
    case "sign": drawSign(ctx, gx, gy, color); break;
    case "bench": drawBench(ctx, gx, gy, color); break;
  }
}

// ─── HABBO CHARACTER ──────────────────────────────────────────────────────────
function drawHabboCharacter(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  avatar: AvatarConfig,
  name: string,
  state: string,
  t: number,
  isSelected: boolean,
) {
  const bob = Math.sin(t * 0.04) * 1.5;
  const headH = 20;
  const bodyH = 36;
  const totalH = headH + bodyH;
  const by = cy - totalH + bob;

  // Ground shadow
  ctx.beginPath();
  ctx.ellipse(cx, cy + 3, 12, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fill();

  // State glow
  const glowC = STATE_GLOW[state] || "#7f8c8d";
  ctx.shadowColor = glowC;
  ctx.shadowBlur = isSelected ? 18 : 7;

  // Selection ring
  if (isSelected) {
    ctx.strokeStyle = "#f1c40f";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(cx, by + totalH / 2, 22, 28, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ── LEGS ──
  const legSwing = Math.sin(t * 0.08) * 4;
  ctx.fillStyle = avatar.bottomColor;
  ctx.fillRect(cx - 6, by + headH + bodyH - 10 - legSwing, 5, 12);
  ctx.fillRect(cx + 1, by + headH + bodyH - 10 + legSwing, 5, 12);
  // Shoes
  ctx.fillStyle = avatar.shoeColor;
  ctx.beginPath();
  ctx.roundRect(cx - 8, by + headH + bodyH + 1 - legSwing, 8, 4, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx + 1, by + headH + bodyH + 1 + legSwing, 8, 4, 2);
  ctx.fill();

  // ── BODY ──
  ctx.fillStyle = avatar.topColor;
  ctx.beginPath();
  ctx.roundRect(cx - 8, by + headH - 2, 16, bodyH - 8, [2, 2, 4, 4]);
  ctx.fill();
  ctx.fillStyle = darken(avatar.topColor, 0.15);
  ctx.fillRect(cx + 2, by + headH, 4, bodyH - 10);

  // ── ARMS ──
  const armSwing = Math.sin(t * 0.07) * 4;
  ctx.fillStyle = avatar.topColor;
  ctx.fillRect(cx - 12, by + headH - 1 + armSwing, 4, bodyH - 12);
  ctx.fillRect(cx + 8, by + headH - 1 - armSwing, 4, bodyH - 12);
  ctx.fillStyle = avatar.skinTone;
  ctx.beginPath();
  ctx.arc(cx - 10, by + headH + bodyH - 14 + armSwing, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 10, by + headH + bodyH - 14 - armSwing, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";

  // ── HEAD ──
  ctx.fillStyle = avatar.skinTone;
  ctx.beginPath();
  ctx.roundRect(cx - 10, by, 20, headH + 3, [8, 8, 4, 4]);
  ctx.fill();

  // ── HAIR ──
  ctx.fillStyle = avatar.hairColor;
  ctx.beginPath();
  ctx.roundRect(cx - 11, by - 5, 22, 11, [7, 7, 0, 0]);
  ctx.fill();
  if (avatar.hairStyle === "spiky") {
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 9 + i * 4, by - 5);
      ctx.lineTo(cx - 7 + i * 4, by - 13);
      ctx.lineTo(cx - 5 + i * 4, by - 5);
      ctx.fillStyle = avatar.hairColor;
      ctx.fill();
    }
  } else if (avatar.hairStyle === "long") {
    ctx.fillStyle = avatar.hairColor;
    ctx.fillRect(cx - 11, by - 5, 6, 20);
    ctx.fillRect(cx + 5, by - 5, 6, 18);
  }

  // ── EYES ──
  ctx.fillStyle = "#fff";
  ctx.fillRect(cx - 8, by + 7, 6, 5);
  ctx.fillRect(cx + 2, by + 7, 6, 5);
  ctx.fillStyle = avatar.eyeColor;
  ctx.fillRect(cx - 7, by + 8, 4, 4);
  ctx.fillRect(cx + 3, by + 8, 4, 4);
  ctx.fillStyle = "#000";
  ctx.fillRect(cx - 6, by + 9, 2, 2);
  ctx.fillRect(cx + 4, by + 9, 2, 2);
  ctx.fillStyle = avatar.hairColor;
  ctx.fillRect(cx - 8, by + 5, 6, 1);
  ctx.fillRect(cx + 2, by + 5, 6, 1);
  ctx.fillStyle = darken(avatar.skinTone, 0.25);
  ctx.fillRect(cx - 3, by + 14, 6, 2);

  // ── ACCESSORY ──
  if (avatar.accessory === "glasses") {
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 8, by + 6, 6, 5);
    ctx.strokeRect(cx + 2, by + 6, 6, 5);
    ctx.beginPath();
    ctx.moveTo(cx - 2, by + 8);
    ctx.lineTo(cx + 2, by + 8);
    ctx.stroke();
  } else if (avatar.accessory === "hat") {
    ctx.fillStyle = darken(avatar.hairColor, 0.1);
    ctx.fillRect(cx - 12, by - 4, 24, 5);
    ctx.fillRect(cx - 8, by - 14, 16, 11);
  } else if (avatar.accessory === "headset") {
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, by + 2, 13, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.fillStyle = "#e74c3c";
    ctx.beginPath();
    ctx.arc(cx - 13, by + 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 13, by + 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── BADGE ──
  const badgeC = CATEGORY_BADGE_COLORS[avatar.badge] || CATEGORY_BADGE_COLORS.default;
  ctx.beginPath();
  ctx.arc(cx + 8, by - 4, 5, 0, Math.PI * 2);
  ctx.fillStyle = badgeC;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.stroke();

  // ── NAME TAG ──
  if (name) {
    ctx.font = "bold 7px 'Inter', sans-serif";
    ctx.textAlign = "center";
    const tw = ctx.measureText(name).width;
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.beginPath();
    ctx.roundRect(cx - tw / 2 - 4, by - 20, tw + 8, 11, 4);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(name, cx, by - 11);
  }
}

// ─── ZONE LABEL ───────────────────────────────────────────────────────────────
function drawZoneLabel(ctx: CanvasRenderingContext2D, zone: ZoneDef) {
  const p = iso(zone.gx, zone.gy);
  const bx = p.x - 14;
  const by = p.y - WALL_H - 24;
  ctx.beginPath();
  ctx.arc(bx, by, 13, 0, Math.PI * 2);
  ctx.fillStyle = zone.badgeColor;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 9px 'Inter', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(zone.id), bx, by + 3);
  ctx.font = "700 8px 'Inter', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(zone.label, bx, by + 17);
}

// ─── BUILD ZONE RENDER ITEMS ──────────────────────────────────────────────────
function buildZoneItems(zone: ZoneDef): RenderItem[] {
  const items: RenderItem[] = [];

  items.push({
    sortKey: zone.gx + zone.gy - 0.6,
    render: (ctx) =>
      drawBackWall(ctx, zone.gx, zone.gy, zone.w, zone.wallColor, lighten(zone.wallColor, 0.12)),
  });

  items.push({
    sortKey: zone.gx + zone.gy - 0.5,
    render: (ctx) =>
      drawLeftWall(ctx, zone.gx, zone.gy, zone.h, zone.wallColorL, lighten(zone.wallColorL, 0.1)),
  });

  for (let gx = zone.gx; gx < zone.gx + zone.w; gx++) {
    for (let gy = zone.gy; gy < zone.gy + zone.h; gy++) {
      const col = (gx + gy) % 2 === 0 ? zone.floorColor : zone.floorDark;
      const sk = gx + gy;
      items.push({ sortKey: sk, render: (ctx) => drawTile(ctx, gx, gy, col) });
    }
  }

  for (const obj of zone.objects) {
    items.push({
      sortKey: obj.gx + obj.gy + 0.1,
      render: (ctx) => drawFurniture(ctx, obj),
    });
  }

  return items;
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────
export function defaultAvatarForCategory(category: string, seed: number = 0): AvatarConfig {
  const pick = <T>(arr: T[], mul = 1): T => arr[Math.abs((seed * mul) % arr.length)];
  const hairStyles = ["default", "spiky", "long", "short"];
  const accessories = ["none", "glasses", "headset", "hat", "none", "none"];
  const catColors: Record<string, { top: string; bottom: string }> = {
    helpdesk: { top: "#c0392b", bottom: "#1a2035" },
    hr:       { top: "#2980b9", bottom: "#1a3050" },
    documents:{ top: "#d35400", bottom: "#3a2800" },
    sales:    { top: "#8e44ad", bottom: "#2a1040" },
    support:  { top: "#27ae60", bottom: "#0a2a18" },
    devops:   { top: "#16a085", bottom: "#1a2a30" },
    default:  { top: "#7f8c8d", bottom: "#2c3e50" },
  };
  const colors = catColors[category] || catColors.default;
  return {
    skinTone: pick(SKIN_TONES, 2),
    hairStyle: hairStyles[seed % hairStyles.length],
    hairColor: pick(HAIR_COLORS, 5),
    eyeStyle: "round",
    eyeColor: pick(EYE_COLORS, 3),
    topStyle: "shirt",
    topColor: colors.top,
    bottomStyle: "pants",
    bottomColor: colors.bottom,
    shoeStyle: "sneakers",
    shoeColor: pick(SHOE_COLORS, 4),
    accessory: accessories[(seed * 2) % accessories.length],
    badge: category,
  };
}

export function generateWorldAgents(agentList: any[]): WorldAgent[] {
  return agentList.map((agent, i) => {
    const category = agent.category || "default";
    const zoneName = CATEGORY_ZONE[category] || "jardin";
    const zone = ZONES.find((z) => z.name === zoneName) ?? ZONES[ZONES.length - 1];
    const ox = (i * 3 + 2) % Math.max(1, zone.w - 2);
    const oy = (i * 2 + 2) % Math.max(1, zone.h - 2);
    return {
      id: agent.id ?? `agent-${i}`,
      name: agent.name ?? `Agent ${i + 1}`,
      category,
      state: agent.state ?? "idle",
      avatar: defaultAvatarForCategory(category, i),
      tileX: zone.gx + 1 + ox,
      tileY: zone.gy + 1 + oy,
      chatBubble: agent.chatBubble,
      taskProgress: agent.taskProgress,
    };
  });
}

// ─── HABBO WORLD COMPONENT ────────────────────────────────────────────────────
interface HabboWorldProps {
  agents: WorldAgent[];
  onAgentClick?: (agent: WorldAgent) => void;
  onSelectAgent?: (id: string) => void;
  onOpenAgent?: (id: string) => void;
  selectedAgentId?: string | null;
  className?: string;
}

export function HabboWorld({
  agents,
  onAgentClick,
  onSelectAgent,
  onOpenAgent,
  selectedAgentId,
  className,
}: HabboWorldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tRef = useRef<number>(0);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(0.55);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, px: 0, py: 0 });
  const [size, setSize] = useState({ w: 1200, h: 700 });
  const worldItemsRef = useRef<RenderItem[]>([]);

  // Build static world
  useEffect(() => {
    const items: RenderItem[] = [];
    for (const zone of ZONES) items.push(...buildZoneItems(zone));
    items.sort((a, b) => a.sortKey - b.sortKey);
    worldItemsRef.current = items;
  }, []);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        if (width > 0 && height > 0) setSize({ w: Math.round(width), h: Math.round(height) });
      }
    });
    ro.observe(parent);
    const r = parent.getBoundingClientRect();
    if (r.width > 0) setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    return () => ro.disconnect();
  }, []);

  // Wheel zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomRef.current = Math.max(0.25, Math.min(2.5, zoomRef.current * (e.deltaY > 0 ? 0.9 : 1.1)));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  const hitTest = useCallback((cx: number, cy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const wx = (cx - rect.left - panRef.current.x) / zoomRef.current;
    const wy = (cy - rect.top - panRef.current.y) / zoomRef.current;
    for (const ag of agents) {
      const p = iso(ag.tileX, ag.tileY);
      const dx = wx - p.x, dy = wy - (p.y - 28);
      if (dx * dx + dy * dy < 25 * 25) return ag;
    }
    return null;
  }, [agents]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, px: panRef.current.x, py: panRef.current.y };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.active) return;
    panRef.current = {
      x: dragRef.current.px + e.clientX - dragRef.current.startX,
      y: dragRef.current.py + e.clientY - dragRef.current.startY,
    };
  }, []);

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    const d = dragRef.current;
    const moved = Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY);
    d.active = false;
    if (moved < 5) {
      const ag = hitTest(e.clientX, e.clientY);
      if (ag) {
        onAgentClick?.(ag);
        onSelectAgent?.(ag.id);
      }
    }
  }, [hitTest, onAgentClick, onSelectAgent]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function render() {
      if (!canvas || !ctx) return;
      tRef.current += 1;
      const t = tRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bg.addColorStop(0, "#060c1a");
      bg.addColorStop(0.6, "#0d1528");
      bg.addColorStop(1, "#161f38");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Stars
      for (let i = 0; i < 70; i++) {
        const sx = ((i * 137 + 23) % canvas.width);
        const sy = ((i * 97 + 11) % (canvas.height * 0.4));
        const alpha = 0.15 + (i % 6) * 0.08;
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillRect(sx, sy, 1, 1);
      }

      ctx.save();
      ctx.translate(panRef.current.x, panRef.current.y);
      ctx.scale(zoomRef.current, zoomRef.current);

      // Render world (depth-sorted)
      for (const item of worldItemsRef.current) item.render(ctx);

      // Render agents
      const sorted = [...agents].sort((a, b) => (a.tileX + a.tileY) - (b.tileX + b.tileY));
      for (const ag of sorted) {
        const p = iso(ag.tileX, ag.tileY);
        const apy = p.y + TH / 2;
        drawHabboCharacter(ctx, p.x, apy, ag.avatar, ag.name, ag.state, t, ag.id === selectedAgentId);

        // Chat bubble
        if (ag.chatBubble) {
          ctx.font = "8px 'Inter', sans-serif";
          ctx.textAlign = "center";
          const bw = Math.min(ctx.measureText(ag.chatBubble).width + 10, 90);
          const bx = p.x, by2 = apy - 98;
          ctx.fillStyle = "rgba(255,255,255,0.93)";
          ctx.beginPath();
          ctx.roundRect(bx - bw / 2, by2 - 14, bw, 14, 5);
          ctx.fill();
          ctx.fillStyle = "#1a1a2e";
          const txt = ag.chatBubble.length > 22 ? ag.chatBubble.slice(0, 22) + "…" : ag.chatBubble;
          ctx.fillText(txt, bx, by2 - 3);
          ctx.fillStyle = "rgba(255,255,255,0.93)";
          ctx.beginPath();
          ctx.moveTo(bx - 4, by2);
          ctx.lineTo(bx + 4, by2);
          ctx.lineTo(bx, by2 + 6);
          ctx.fill();
        }

        // Progress bar
        if (ag.state === "working" && ag.taskProgress !== undefined) {
          const bx = p.x - 16, by2 = apy - 78;
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.fillRect(bx, by2, 32, 4);
          ctx.fillStyle = "#f39c12";
          ctx.fillRect(bx, by2, 32 * Math.min(1, ag.taskProgress), 4);
        }
      }

      // Zone labels (always on top)
      for (const zone of ZONES) {
        if (zone.id !== 7) drawZoneLabel(ctx, zone);
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(render);
    }

    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [agents, selectedAgentId, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size.w}
      height={size.h}
      className={className}
      style={{ display: "block", width: "100%", height: "100%", cursor: "grab" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    />
  );
}

// ─── AVATAR BUILDER ───────────────────────────────────────────────────────────
interface AvatarBuilderProps {
  value: AvatarConfig;
  onChange: (config: AvatarConfig) => void;
  compact?: boolean;
}

export function AvatarBuilder({ value, onChange, compact }: AvatarBuilderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 120, 170);
    ctx.fillStyle = "#0d1528";
    ctx.fillRect(0, 0, 120, 170);
    drawHabboCharacter(ctx, 60, 138, value, "", "idle", 0, false);
  }, [value]);

  const set = (key: keyof AvatarConfig, val: string) => onChange({ ...value, [key]: val });

  function Swatch({ palette, field }: { palette: string[]; field: keyof AvatarConfig }) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
        {palette.map((c) => (
          <button
            key={c}
            onClick={() => set(field, c)}
            style={{
              width: 14, height: 14, borderRadius: "50%", background: c, cursor: "pointer",
              border: value[field] === c ? "2px solid #fff" : "1px solid rgba(255,255,255,0.2)",
              padding: 0,
            }}
          />
        ))}
      </div>
    );
  }

  function Tabs({ options, field }: { options: string[]; field: keyof AvatarConfig }) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
        {options.map((o) => (
          <button
            key={o}
            onClick={() => set(field, o)}
            style={{
              padding: "2px 6px", borderRadius: 4, fontSize: 9, cursor: "pointer",
              background: value[field] === o ? "#3498db" : "#1a2535",
              border: "1px solid rgba(255,255,255,0.15)", color: "#fff",
            }}
          >
            {o}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 14, background: "#0d1528", padding: 12, borderRadius: 10, color: "#fff" }}>
      <canvas ref={canvasRef} width={120} height={170} style={{ borderRadius: 8, flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 11, overflowY: "auto", maxHeight: 170 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#7f8c8d", marginBottom: 2 }}>PEAU</div>
        <Swatch palette={SKIN_TONES} field="skinTone" />
        <div style={{ fontSize: 9, fontWeight: 700, color: "#7f8c8d", marginBottom: 2 }}>CHEVEUX</div>
        <Swatch palette={HAIR_COLORS} field="hairColor" />
        <Tabs options={["default","spiky","long","short"]} field="hairStyle" />
        <div style={{ fontSize: 9, fontWeight: 700, color: "#7f8c8d", marginBottom: 2 }}>HAUT</div>
        <Swatch palette={TOP_COLORS} field="topColor" />
        <div style={{ fontSize: 9, fontWeight: 700, color: "#7f8c8d", marginBottom: 2 }}>BAS</div>
        <Swatch palette={BOTTOM_COLORS} field="bottomColor" />
        <div style={{ fontSize: 9, fontWeight: 700, color: "#7f8c8d", marginBottom: 2 }}>YEUX</div>
        <Swatch palette={EYE_COLORS} field="eyeColor" />
        <div style={{ fontSize: 9, fontWeight: 700, color: "#7f8c8d", marginBottom: 2 }}>ACCESSOIRE</div>
        <Tabs options={["none","glasses","hat","headset"]} field="accessory" />
      </div>
    </div>
  );
}
