"use client";
/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║       NORYS — HABBO/CHAPATIZ WORLD v1.0                 ║
 * ║  Pure 2D Canvas · Isometric tiles · Walk animations      ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Features :
 *  - Isometric tile grid (diamond layout)
 *  - Agent avatars with full sprite-based look
 *  - Walk animations between tiles (pathfinding A*)
 *  - Chat bubbles above agents
 *  - Category-specific workstations (desk, servers, etc.)
 *  - Click to select agent, double-click to open detail
 *  - Orchestrateur boss avatar in center throne
 *  - 60fps Canvas render loop
 */

import { useEffect, useRef, useState, useCallback } from "react";

// Polyfill roundRect for older browsers
if (typeof window !== "undefined") {
  const proto = CanvasRenderingContext2D.prototype as any;
  if (!proto.roundRect) {
    proto.roundRect = function(x: number, y: number, w: number, h: number, r: number) {
      if (w < 2 * r) r = w / 2;
      if (h < 2 * r) r = h / 2;
      this.beginPath();
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
      return this;
    };
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AvatarConfig {
  skinTone: number;    // 0-5
  hairStyle: number;   // 0-9
  hairColor: number;   // 0-11
  eyeStyle: number;    // 0-5
  eyeColor: number;    // 0-7
  topStyle: number;    // 0-11
  topColor: number;    // 0-11
  bottomStyle: number; // 0-7
  bottomColor: number; // 0-11
  shoeStyle: number;   // 0-5
  shoeColor: number;   // 0-7
  accessory: number;   // 0-9 (0 = none)
  badge: number;       // 0-6 (category badge)
}

export interface WorldAgent {
  id: string;
  name: string;
  category: string;
  state: "idle" | "thinking" | "acting" | "error" | "done" | "walking";
  avatar: AvatarConfig;
  tileX: number;
  tileY: number;
  targetTileX?: number;
  targetTileY?: number;
  chatBubble?: { text: string; expiresAt: number };
  taskProgress?: number; // 0-100
}

// ─── Palette ─────────────────────────────────────────────────────────────────

const SKIN_TONES = ["#FDDBB4", "#F7C98B", "#D4A574", "#C68642", "#8D5524", "#4A2C17"];
const HAIR_COLORS = ["#1a1a1a", "#4a3728", "#6b4c11", "#8B6914", "#B8860B", "#D4AC0D", "#F4D03F", "#FF6B35", "#E74C3C", "#8E44AD", "#3498DB", "#F0F0F0"];
const EYE_COLORS = ["#1a1a1a", "#2C3E50", "#1B4F72", "#145A32", "#784212", "#7D6608", "#B03A2E", "#6C3483"];
const TOP_COLORS = ["#1a1a2e", "#16213e", "#0f3460", "#533483", "#E94560", "#0D7377", "#14BDAC", "#F7B731", "#FC5C65", "#20BF6B", "#45AAF2", "#FFFFFF"];
const BOTTOM_COLORS = TOP_COLORS;
const SHOE_COLORS = ["#1a1a1a", "#4a2c17", "#2C3E50", "#78281F", "#0B5345", "#1A237E", "#F0F0F0"];
const ACC_COLORS = ["#FFD700", "#C0C0C0", "#FF6B35", "#8E44AD", "#E74C3C", "#3498DB", "#2ECC71", "#F39C12", "#1a1a1a"];

const CATEGORY_BADGE_COLORS: Record<string, string> = {
  helpdesk:  "#3B82F6",
  hr:        "#EC4899",
  documents: "#F59E0B",
  sales:     "#10B981",
  support:   "#8B5CF6",
  devops:    "#EF4444",
  default:   "#6366F1",
};

const CATEGORY_ICONS: Record<string, string> = {
  helpdesk:  "🖥️",
  hr:        "👥",
  documents: "📄",
  sales:     "📈",
  support:   "🎧",
  devops:    "⚙️",
  default:   "🤖",
};

// State colors
const STATE_GLOW: Record<string, string> = {
  idle:      "rgba(99, 102, 241, 0)",
  thinking:  "rgba(245, 158, 11, 0.6)",
  acting:    "rgba(59, 130, 246, 0.7)",
  error:     "rgba(239, 68, 68, 0.7)",
  done:      "rgba(16, 185, 129, 0.6)",
  walking:   "rgba(99, 102, 241, 0.4)",
};

// ─── Isometric Projection ─────────────────────────────────────────────────────

const TILE_W = 64;
const TILE_H = 32;

function tileToScreen(tx: number, ty: number): { x: number; y: number } {
  return {
    x: (tx - ty) * (TILE_W / 2),
    y: (tx + ty) * (TILE_H / 2),
  };
}

// ─── Avatar Renderer (Canvas 2D) ─────────────────────────────────────────────

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  avatar: AvatarConfig,
  scale: number = 1,
  facing: "front" | "left" | "right" = "front",
  walkPhase: number = 0,
  stateGlow?: string
) {
  const s = scale;
  const cx = x;
  const cy = y;

  ctx.save();
  ctx.translate(cx, cy);

  // ── Glow effect ──────────────────────────────────────────────────────────
  if (stateGlow && stateGlow !== "rgba(99, 102, 241, 0)") {
    ctx.shadowColor = stateGlow;
    ctx.shadowBlur = 20 * s;
  }

  // ── Walk leg offset ──────────────────────────────────────────────────────
  const legSwing = Math.sin(walkPhase * 0.2) * 3 * s;
  const armSwing = Math.cos(walkPhase * 0.2) * 4 * s;
  const bodyBob = Math.abs(Math.sin(walkPhase * 0.2)) * 1.5 * s;

  // ── Shoes ────────────────────────────────────────────────────────────────
  const shoeColor = SHOE_COLORS[avatar.shoeColor] ?? "#1a1a1a";
  ctx.fillStyle = shoeColor;
  // Left shoe
  ctx.beginPath();
  ctx.ellipse(-5 * s + (facing !== "front" ? legSwing : 0), 20 * s - bodyBob, 5 * s, 3 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Right shoe
  ctx.beginPath();
  ctx.ellipse(5 * s - (facing !== "front" ? legSwing : 0), 20 * s - bodyBob, 5 * s, 3 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Legs ─────────────────────────────────────────────────────────────────
  const bottomColor = BOTTOM_COLORS[avatar.bottomColor] ?? "#1a1a2e";
  ctx.fillStyle = bottomColor;

  // Left leg
  ctx.save();
  ctx.translate(-5 * s, 10 * s - bodyBob);
  if (facing !== "front") ctx.rotate((legSwing * Math.PI) / 180);
  ctx.fillRect(-4 * s, 0, 7 * s, 10 * s);
  ctx.restore();

  // Right leg
  ctx.save();
  ctx.translate(5 * s, 10 * s - bodyBob);
  if (facing !== "front") ctx.rotate((-legSwing * Math.PI) / 180);
  ctx.fillRect(-3 * s, 0, 7 * s, 10 * s);
  ctx.restore();

  // ── Body (torso) ──────────────────────────────────────────────────────────
  const topColor = TOP_COLORS[avatar.topColor] ?? "#16213e";
  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.roundRect(-9 * s, -4 * s - bodyBob, 18 * s, 14 * s, 2 * s);
  ctx.fill();

  // Top style variations
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  if (avatar.topStyle % 3 === 1) {
    // Stripe
    ctx.fillRect(-9 * s, 1 * s - bodyBob, 18 * s, 2 * s);
  } else if (avatar.topStyle % 3 === 2) {
    // Collar
    ctx.beginPath();
    ctx.moveTo(-3 * s, -4 * s - bodyBob);
    ctx.lineTo(0, 0 - bodyBob);
    ctx.lineTo(3 * s, -4 * s - bodyBob);
    ctx.fill();
  }

  // ── Arms ─────────────────────────────────────────────────────────────────
  ctx.fillStyle = topColor;

  // Left arm
  ctx.save();
  ctx.translate(-11 * s, -3 * s - bodyBob);
  ctx.rotate((armSwing * Math.PI) / 180);
  ctx.fillRect(-3 * s, 0, 5 * s, 10 * s);
  ctx.restore();

  // Right arm
  ctx.save();
  ctx.translate(11 * s, -3 * s - bodyBob);
  ctx.rotate((-armSwing * Math.PI) / 180);
  ctx.fillRect(-2 * s, 0, 5 * s, 10 * s);
  ctx.restore();

  // ── Hands ────────────────────────────────────────────────────────────────
  const skinColor = SKIN_TONES[avatar.skinTone] ?? "#FDDBB4";
  ctx.fillStyle = skinColor;

  ctx.save();
  ctx.translate(-11 * s, -3 * s - bodyBob + 12 * s);
  ctx.rotate((armSwing * Math.PI) / 180);
  ctx.beginPath();
  ctx.ellipse(0, 8 * s, 4 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(11 * s, -3 * s - bodyBob + 12 * s);
  ctx.rotate((-armSwing * Math.PI) / 180);
  ctx.beginPath();
  ctx.ellipse(0, 8 * s, 4 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── Neck ─────────────────────────────────────────────────────────────────
  ctx.fillStyle = skinColor;
  ctx.fillRect(-3 * s, -8 * s - bodyBob, 6 * s, 5 * s);

  // ── Head ─────────────────────────────────────────────────────────────────
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.ellipse(0, -16 * s - bodyBob, 11 * s, 13 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Eyes ─────────────────────────────────────────────────────────────────
  const eyeColor = EYE_COLORS[avatar.eyeColor] ?? "#1a1a1a";
  const eyeStyleType = avatar.eyeStyle % 3; // 0=round, 1=almond, 2=wide
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.ellipse(-4 * s, -17 * s - bodyBob, 3.5 * s, 3 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(4 * s, -17 * s - bodyBob, 3.5 * s, 3 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.ellipse(-4 * s, -17 * s - bodyBob, 2 * s, eyeStyleType === 2 ? 2.5 * s : 2 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(4 * s, -17 * s - bodyBob, 2 * s, eyeStyleType === 2 ? 2.5 * s : 2 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eye shine
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.beginPath();
  ctx.ellipse(-3 * s, -18 * s - bodyBob, 0.8 * s, 0.8 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(5 * s, -18 * s - bodyBob, 0.8 * s, 0.8 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Hair ─────────────────────────────────────────────────────────────────
  const hairColor = HAIR_COLORS[avatar.hairColor] ?? "#1a1a1a";
  ctx.fillStyle = hairColor;
  const hairStyle = avatar.hairStyle % 10;

  if (hairStyle === 0) {
    // Short spiky
    ctx.beginPath();
    ctx.arc(0, -24 * s - bodyBob, 10 * s, Math.PI, 0);
    ctx.fill();
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 3.3 * s - 1 * s, -29 * s - bodyBob);
      ctx.lineTo(i * 3.3 * s + 1 * s, -29 * s - bodyBob);
      ctx.lineTo(i * 3.3 * s, -34 * s - i * 0.5 * s - bodyBob);
      ctx.fill();
    }
  } else if (hairStyle === 1) {
    // Long straight
    ctx.beginPath();
    ctx.arc(0, -24 * s - bodyBob, 10 * s, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-11 * s, -26 * s - bodyBob, 4 * s, 16 * s);
    ctx.fillRect(7 * s, -26 * s - bodyBob, 4 * s, 16 * s);
  } else if (hairStyle === 2) {
    // Mohawk
    ctx.fillRect(-3 * s, -34 * s - bodyBob, 6 * s, 12 * s);
    ctx.beginPath();
    ctx.arc(0, -27 * s - bodyBob, 8 * s, Math.PI, 0);
    ctx.fill();
  } else if (hairStyle === 3) {
    // Afro
    ctx.beginPath();
    ctx.arc(0, -26 * s - bodyBob, 14 * s, 0, Math.PI * 2);
    ctx.fill();
  } else if (hairStyle === 4) {
    // Bob
    ctx.beginPath();
    ctx.arc(0, -24 * s - bodyBob, 11 * s, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-11 * s, -26 * s - bodyBob, 22 * s, 8 * s);
  } else if (hairStyle === 5) {
    // Ponytail
    ctx.beginPath();
    ctx.arc(0, -25 * s - bodyBob, 10 * s, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(9 * s, -26 * s - bodyBob);
    ctx.bezierCurveTo(16 * s, -22 * s - bodyBob, 18 * s, -12 * s - bodyBob, 10 * s, -6 * s - bodyBob);
    ctx.lineTo(8 * s, -8 * s - bodyBob);
    ctx.bezierCurveTo(14 * s, -13 * s - bodyBob, 12 * s, -21 * s - bodyBob, 7 * s, -24 * s - bodyBob);
    ctx.fill();
  } else if (hairStyle === 6) {
    // Bun
    ctx.beginPath();
    ctx.arc(0, -25 * s - bodyBob, 10 * s, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -33 * s - bodyBob, 5 * s, 0, Math.PI * 2);
    ctx.fill();
  } else if (hairStyle === 7) {
    // Wavy
    ctx.beginPath();
    ctx.arc(0, -25 * s - bodyBob, 11 * s, Math.PI, 0);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-9 * s + i * 1.5 * s, -22 * s - bodyBob + i * 4 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(9 * s - i * 1.5 * s, -22 * s - bodyBob + i * 4 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (hairStyle === 8) {
    // Buzz cut
    ctx.beginPath();
    ctx.arc(0, -25 * s - bodyBob, 11 * s, Math.PI * 1.1, -0.1);
    ctx.fill();
    ctx.fillRect(-11 * s, -27 * s - bodyBob, 22 * s, 4 * s);
  } else {
    // Curly top
    ctx.beginPath();
    ctx.arc(0, -25 * s - bodyBob, 10 * s, Math.PI, 0);
    ctx.fill();
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(i * 4 * s, -31 * s - bodyBob, 3 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Accessory ─────────────────────────────────────────────────────────────
  if (avatar.accessory > 0) {
    const accColor = ACC_COLORS[(avatar.accessory - 1) % ACC_COLORS.length];
    ctx.fillStyle = accColor;
    if (avatar.accessory === 1) {
      // Glasses
      ctx.strokeStyle = accColor;
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.arc(-4 * s, -17 * s - bodyBob, 4 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(4 * s, -17 * s - bodyBob, 4 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -17 * s - bodyBob);
      ctx.lineTo(-8 * s, -17 * s - bodyBob);
      ctx.stroke();
    } else if (avatar.accessory === 2) {
      // Headset
      ctx.lineWidth = 2 * s;
      ctx.strokeStyle = accColor;
      ctx.beginPath();
      ctx.arc(0, -24 * s - bodyBob, 13 * s, Math.PI * 1.1, -0.1);
      ctx.stroke();
      ctx.fillRect(-15 * s, -26 * s - bodyBob, 4 * s, 5 * s);
      ctx.fillRect(11 * s, -26 * s - bodyBob, 4 * s, 5 * s);
      ctx.fillRect(9 * s, -21 * s - bodyBob, 3 * s, 6 * s); // mic boom
    } else if (avatar.accessory === 3) {
      // Crown
      ctx.beginPath();
      ctx.moveTo(-8 * s, -33 * s - bodyBob);
      ctx.lineTo(8 * s, -33 * s - bodyBob);
      ctx.lineTo(8 * s, -29 * s - bodyBob);
      ctx.lineTo(4 * s, -33 * s - bodyBob);
      ctx.lineTo(0, -29 * s - bodyBob);
      ctx.lineTo(-4 * s, -33 * s - bodyBob);
      ctx.lineTo(-8 * s, -29 * s - bodyBob);
      ctx.closePath();
      ctx.fill();
    } else if (avatar.accessory === 4) {
      // Cap
      ctx.fillRect(-11 * s, -29 * s - bodyBob, 22 * s, 5 * s);
      ctx.fillRect(-2 * s, -34 * s - bodyBob, 12 * s, 8 * s);
    } else if (avatar.accessory === 5) {
      // Tie
      ctx.fillStyle = accColor;
      ctx.beginPath();
      ctx.moveTo(-2 * s, -2 * s - bodyBob);
      ctx.lineTo(2 * s, -2 * s - bodyBob);
      ctx.lineTo(3 * s, 4 * s - bodyBob);
      ctx.lineTo(0, 8 * s - bodyBob);
      ctx.lineTo(-3 * s, 4 * s - bodyBob);
      ctx.closePath();
      ctx.fill();
    } else if (avatar.accessory === 6) {
      // Scarf
      ctx.lineWidth = 4 * s;
      ctx.strokeStyle = accColor;
      ctx.beginPath();
      ctx.arc(0, -5 * s - bodyBob, 9 * s, Math.PI * 1.2, Math.PI * 0.8);
      ctx.stroke();
    } else if (avatar.accessory === 7) {
      // Visor
      ctx.fillStyle = `${accColor}99`;
      ctx.fillRect(-9 * s, -20 * s - bodyBob, 18 * s, 5 * s);
      ctx.fillStyle = accColor;
      ctx.fillRect(-9 * s, -20 * s - bodyBob, 18 * s, 1.5 * s);
    } else if (avatar.accessory === 8) {
      // Earrings
      ctx.beginPath();
      ctx.arc(-11 * s, -14 * s - bodyBob, 2 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(11 * s, -14 * s - bodyBob, 2 * s, 0, Math.PI * 2);
      ctx.fill();
    } else if (avatar.accessory === 9) {
      // Backpack
      ctx.fillStyle = accColor;
      ctx.fillRect(8 * s, -4 * s - bodyBob, 5 * s, 9 * s);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(9 * s, -2 * s - bodyBob, 3 * s, 2 * s);
    }
  }

  // ── Category badge ────────────────────────────────────────────────────────
  // (displayed as colored dot on chest)
  const badgeColor = Object.values(CATEGORY_BADGE_COLORS)[avatar.badge % Object.keys(CATEGORY_BADGE_COLORS).length];
  ctx.fillStyle = badgeColor;
  ctx.beginPath();
  ctx.arc(3 * s, -1 * s - bodyBob, 2.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(3.5 * s, -1.5 * s - bodyBob, 0.8 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─── Tile Renderer ────────────────────────────────────────────────────────────

function drawTile(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  type: "floor" | "wall" | "workstation" | "throne",
  isSelected = false
) {
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;

  // Top face
  let topColor = "#1e2a3a";
  let leftColor = "#151f2d";
  let rightColor = "#111827";

  if (type === "workstation") {
    topColor = "#1a2744";
    leftColor = "#111d36";
    rightColor = "#0d172a";
  } else if (type === "throne") {
    topColor = "#2d1f00";
    leftColor = "#1a1200";
    rightColor = "#0f0a00";
  } else if (type === "wall") {
    topColor = "#0d1117";
    leftColor = "#080d12";
    rightColor = "#060a0f";
  }

  if (isSelected) {
    topColor = "#1e3a5f";
    leftColor = "#152d4a";
    rightColor = "#102538";
  }

  // Draw isometric tile
  // Top face
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + hw, sy + hh);
  ctx.lineTo(sx, sy + TILE_H);
  ctx.lineTo(sx - hw, sy + hh);
  ctx.closePath();
  ctx.fillStyle = topColor;
  ctx.fill();
  ctx.strokeStyle = "rgba(99,102,241,0.15)";
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Left face
  ctx.beginPath();
  ctx.moveTo(sx - hw, sy + hh);
  ctx.lineTo(sx, sy + TILE_H);
  ctx.lineTo(sx, sy + TILE_H + 12);
  ctx.lineTo(sx - hw, sy + hh + 12);
  ctx.closePath();
  ctx.fillStyle = leftColor;
  ctx.fill();
  ctx.stroke();

  // Right face
  ctx.beginPath();
  ctx.moveTo(sx, sy + TILE_H);
  ctx.lineTo(sx + hw, sy + hh);
  ctx.lineTo(sx + hw, sy + hh + 12);
  ctx.lineTo(sx, sy + TILE_H + 12);
  ctx.closePath();
  ctx.fillStyle = rightColor;
  ctx.fill();
  ctx.stroke();

  // Selection highlight
  if (isSelected) {
    ctx.strokeStyle = "rgba(99,102,241,0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + hw, sy + hh);
    ctx.lineTo(sx, sy + TILE_H);
    ctx.lineTo(sx - hw, sy + hh);
    ctx.closePath();
    ctx.stroke();
  }
}

// ─── Chat Bubble ──────────────────────────────────────────────────────────────

function drawChatBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  const fontSize = 10;
  ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
  const maxWidth = 140;
  const lines: string[] = [];

  // Word wrap
  const words = text.split(" ");
  let currentLine = "";
  for (const word of words) {
    const test = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = test;
    }
  }
  if (currentLine) lines.push(currentLine);
  lines.splice(4); // max 4 lines

  const lineHeight = 14;
  const padX = 8;
  const padY = 6;
  const bw = Math.min(maxWidth + padX * 2, 160);
  const bh = lines.length * lineHeight + padY * 2;
  const bx = x - bw / 2;
  const by = y - bh - 8;

  // Bubble background
  ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
  ctx.strokeStyle = "rgba(99, 102, 241, 0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 8);
  ctx.fill();
  ctx.stroke();

  // Bubble tail
  ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
  ctx.beginPath();
  ctx.moveTo(x - 5, by + bh);
  ctx.lineTo(x, by + bh + 6);
  ctx.lineTo(x + 5, by + bh);
  ctx.fill();

  // Text
  ctx.fillStyle = "#e2e8f0";
  ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
  lines.forEach((line, i) => {
    ctx.fillText(line, bx + padX, by + padY + (i + 1) * lineHeight - 2);
  });
}

// ─── Orchestrateur Avatar ─────────────────────────────────────────────────────

function drawOrchestrateur(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const s = 1.8;
  ctx.save();
  ctx.translate(x, y);

  // Throne glow rings
  for (let r = 0; r < 3; r++) {
    const radius = 48 + r * 14;
    const alpha = 0.3 - r * 0.08;
    ctx.strokeStyle = `rgba(218, 165, 32, ${alpha + Math.sin(t * 2 + r) * 0.05})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 10, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Imperial cape (behind body)
  ctx.fillStyle = "#1a0050";
  ctx.strokeStyle = "#DAA520";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-14 * s, -5 * s);
  ctx.bezierCurveTo(-20 * s, 10 * s, -18 * s, 25 * s, -12 * s, 30 * s);
  ctx.lineTo(12 * s, 30 * s);
  ctx.bezierCurveTo(18 * s, 25 * s, 20 * s, 10 * s, 14 * s, -5 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Body
  ctx.fillStyle = "#0d0d2b";
  ctx.strokeStyle = "#DAA520";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-10 * s, -6 * s, 20 * s, 16 * s, 2 * s);
  ctx.fill();
  ctx.stroke();

  // Chest armor
  ctx.fillStyle = "#1a1a4e";
  ctx.strokeStyle = "#DAA520";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-8 * s, -5 * s);
  ctx.lineTo(0, 0);
  ctx.lineTo(8 * s, -5 * s);
  ctx.lineTo(8 * s, 4 * s);
  ctx.lineTo(0, 8 * s);
  ctx.lineTo(-8 * s, 4 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Gold badge
  ctx.fillStyle = "#DAA520";
  ctx.beginPath();
  ctx.arc(0, 1 * s, 3 * s, 0, Math.PI * 2);
  ctx.fill();

  // Shoulders
  for (const side of [-1, 1]) {
    ctx.fillStyle = "#1a1a4e";
    ctx.strokeStyle = "#DAA520";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(side * 9 * s, -7 * s, side * 7 * s, 7 * s, 2 * s);
    ctx.fill();
    ctx.stroke();
    // Spikes
    for (let sp = 0; sp < 3; sp++) {
      ctx.fillStyle = "#DAA520";
      ctx.beginPath();
      ctx.moveTo(side * (11 + sp * 1.5) * s, -8 * s);
      ctx.lineTo(side * (12 + sp * 1.5) * s, -12 * s);
      ctx.lineTo(side * (13 + sp * 1.5) * s, -8 * s);
      ctx.fill();
    }
  }

  // Neck
  ctx.fillStyle = "#c8a882";
  ctx.fillRect(-4 * s, -10 * s, 8 * s, 5 * s);

  // Head
  ctx.fillStyle = "#0d0d1a";
  ctx.strokeStyle = "#DAA520";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-12 * s, -28 * s, 24 * s, 20 * s, 3 * s);
  ctx.fill();
  ctx.stroke();

  // Visor (gold, pulsing)
  const visorAlpha = 0.85 + Math.sin(t * 3) * 0.15;
  ctx.fillStyle = `rgba(218, 165, 32, ${visorAlpha})`;
  ctx.shadowColor = "#FFD700";
  ctx.shadowBlur = 12;
  ctx.fillRect(-10 * s, -22 * s, 20 * s, 5 * s);
  ctx.shadowBlur = 0;

  // Crown
  ctx.fillStyle = "#DAA520";
  ctx.strokeStyle = "#FFD700";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-12 * s, -28 * s);
  for (let i = 0; i <= 6; i++) {
    const px = -12 * s + i * 4 * s;
    ctx.lineTo(px, i % 2 === 0 ? -34 * s : -30 * s);
  }
  ctx.lineTo(12 * s, -28 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Crown gems
  const gemColors = ["#FF4444", "#FFD700", "#4444FF", "#44FF44", "#FF44FF", "#44FFFF"];
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = gemColors[i];
    ctx.shadowColor = gemColors[i];
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(-10 * s + i * 4 * s, -31 * s, 2 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Command orb (floating)
  const orbY = Math.sin(t * 2) * 3;
  ctx.fillStyle = "rgba(99,102,241,0.9)";
  ctx.shadowColor = "#6366f1";
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(22 * s, -15 * s + orbY, 6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.arc(20 * s, -17 * s + orbY, 2 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}

// ─── State indicator ──────────────────────────────────────────────────────────

function drawStateIndicator(ctx: CanvasRenderingContext2D, x: number, y: number, state: WorldAgent["state"], t: number) {
  const radius = 5;
  const stateColors: Record<string, string> = {
    idle:     "#4B5563",
    thinking: "#F59E0B",
    acting:   "#3B82F6",
    error:    "#EF4444",
    done:     "#10B981",
    walking:  "#8B5CF6",
  };
  const color = stateColors[state] ?? "#4B5563";
  const pulse = state === "idle" ? 1 : 1 + Math.sin(t * 4) * 0.3;

  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = state !== "idle" ? 8 : 0;
  ctx.beginPath();
  ctx.arc(x, y, radius * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

// ─── World Layout ─────────────────────────────────────────────────────────────

const GRID_COLS = 9;
const GRID_ROWS = 9;
const CENTER_X = 4;
const CENTER_Y = 4;

// Agent tile positions (preset grid layout)
const AGENT_TILE_POSITIONS = [
  { tx: 1, ty: 1 }, { tx: 3, ty: 1 }, { tx: 5, ty: 1 }, { tx: 7, ty: 1 },
  { tx: 1, ty: 3 }, { tx: 7, ty: 3 },
  { tx: 1, ty: 5 }, { tx: 7, ty: 5 },
  { tx: 1, ty: 7 }, { tx: 3, ty: 7 }, { tx: 5, ty: 7 }, { tx: 7, ty: 7 },
];

// Workstation positions
const WORKSTATION_TILES = new Set([
  "0:0", "1:0", "2:0", "3:0", "4:0", "5:0", "6:0", "7:0", "8:0",
  "0:2", "2:2", "4:2", "6:2", "8:2",
  "0:4", "2:4", "6:4", "8:4",
  "0:6", "2:6", "4:6", "6:6", "8:6",
  "0:8", "1:8", "2:8", "3:8", "4:8", "5:8", "6:8", "7:8", "8:8",
]);

// ─── Main Component ───────────────────────────────────────────────────────────

interface HabboWorldProps {
  agents: WorldAgent[];
  selectedAgentId?: string;
  onSelectAgent?: (agentId: string) => void;
  onOpenAgent?: (agentId: string) => void;
}

export function HabboWorld({ agents, selectedAgentId, onSelectAgent, onOpenAgent }: HabboWorldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const walkPhasesRef = useRef<Map<string, number>>(new Map());
  const lastClickRef = useRef<{ id: string; time: number } | null>(null);

  // Canvas offset (for centering the world)
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });

  // Pan state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const render = useCallback((t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const off = offsetRef.current;

    ctx.clearRect(0, 0, W, H);

    // Background gradient
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
    bg.addColorStop(0, "#0a0f1e");
    bg.addColorStop(1, "#050810");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // World origin = center of canvas
    const worldOriginX = W / 2 + off.x;
    const worldOriginY = H / 2 - ((GRID_ROWS / 2) * TILE_H) + off.y;

    // ── Draw tiles ──────────────────────────────────────────────────────────
    for (let ty = 0; ty < GRID_ROWS; ty++) {
      for (let tx = 0; tx < GRID_COLS; tx++) {
        const { x: sx, y: sy } = tileToScreen(tx, ty);
        const isWorkstation = WORKSTATION_TILES.has(`${tx}:${ty}`);
        const isThroneArea = tx === CENTER_X && ty === CENTER_Y;
        const isSelected = agents.some(
          (a) => a.tileX === tx && a.tileY === ty && a.id === selectedAgentId
        );

        drawTile(
          ctx,
          worldOriginX + sx,
          worldOriginY + sy,
          isThroneArea ? "throne" : isWorkstation ? "workstation" : "floor",
          isSelected
        );

        // Grid label (debug — remove in production)
        // ctx.fillStyle = "rgba(99,102,241,0.3)";
        // ctx.font = "7px monospace";
        // ctx.fillText(`${tx},${ty}`, worldOriginX + sx - 8, worldOriginY + sy + TILE_H / 2);
      }
    }

    // ── Orchestrateur ───────────────────────────────────────────────────────
    const orchScreen = tileToScreen(CENTER_X, CENTER_Y);
    drawOrchestrateur(
      ctx,
      worldOriginX + orchScreen.x,
      worldOriginY + orchScreen.y + TILE_H / 2 - 12,
      t / 1000
    );

    // ── Agents ─────────────────────────────────────────────────────────────
    // Sort by Y so front agents render on top
    const sortedAgents = [...agents].sort((a, b) => a.tileY - b.tileY || a.tileX - b.tileX);

    for (const agent of sortedAgents) {
      const { x: sx, y: sy } = tileToScreen(agent.tileX, agent.tileY);
      const screenX = worldOriginX + sx;
      const screenY = worldOriginY + sy + TILE_H / 2;

      // Walk phase
      if (agent.state === "walking") {
        const prev = walkPhasesRef.current.get(agent.id) ?? 0;
        walkPhasesRef.current.set(agent.id, prev + 1);
      } else {
        walkPhasesRef.current.set(agent.id, 0);
      }
      const walkPhase = walkPhasesRef.current.get(agent.id) ?? 0;

      const isSelected = agent.id === selectedAgentId;
      const stateGlow = STATE_GLOW[agent.state];

      // Selection ring under agent
      if (isSelected) {
        ctx.strokeStyle = "rgba(99,102,241,0.8)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.ellipse(screenX, screenY + 8, 20, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw avatar
      drawAvatar(ctx, screenX, screenY - 20, agent.avatar, 0.9, "front", walkPhase, stateGlow);

      // State dot
      drawStateIndicator(ctx, screenX + 14, screenY - 38, agent.state, t / 1000);

      // Agent name
      ctx.fillStyle = isSelected ? "#a5b4fc" : "rgba(203, 213, 225, 0.8)";
      ctx.font = `bold 9px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(agent.name.split(" ")[0], screenX, screenY + 2);

      // Category icon
      ctx.font = "11px serif";
      ctx.fillText(CATEGORY_ICONS[agent.category] ?? "🤖", screenX - 18, screenY - 48);

      // Task progress bar (if running)
      if (agent.taskProgress !== undefined && agent.taskProgress > 0) {
        const barW = 36;
        const barH = 3;
        const barX = screenX - barW / 2;
        const barY = screenY + 5;
        ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = agent.state === "error" ? "#EF4444" : "#6366F1";
        ctx.fillRect(barX, barY, barW * (agent.taskProgress / 100), barH);
      }

      // Chat bubble
      if (agent.chatBubble && Date.now() < agent.chatBubble.expiresAt) {
        drawChatBubble(ctx, screenX, screenY - 52, agent.chatBubble.text);
      }
    }

    // ── HUD: title ─────────────────────────────────────────────────────────
    ctx.textAlign = "left";
    ctx.font = "bold 12px Inter, sans-serif";
    ctx.fillStyle = "rgba(99,102,241,0.7)";
    ctx.fillText("NORYS WORLD", 12, 22);
    ctx.font = "10px Inter, sans-serif";
    ctx.fillStyle = "rgba(99,102,241,0.4)";
    ctx.fillText(`${agents.length} agents actifs`, 12, 36);

  }, [agents, selectedAgentId]);

  // ── Animation Loop ────────────────────────────────────────────────────────

  useEffect(() => {
    let running = true;
    const loop = (t: number) => {
      if (!running) return;
      render(t);
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [render]);

  // ── Canvas resize ─────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    });
    ro.observe(parent);
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    return () => ro.disconnect();
  }, []);

  // ── Click / Double-click ──────────────────────────────────────────────────

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const off = offsetRef.current;
    const worldOriginX = canvas.width / 2 + off.x;
    const worldOriginY = canvas.height / 2 - ((GRID_ROWS / 2) * TILE_H) + off.y;

    // Hit test agents (reversed sort for top-first click)
    const sorted = [...agents].sort((a, b) => b.tileY - a.tileY);
    for (const agent of sorted) {
      const { x: sx, y: sy } = tileToScreen(agent.tileX, agent.tileY);
      const ax = worldOriginX + sx;
      const ay = worldOriginY + sy + TILE_H / 2 - 20;
      const dx = mouseX - ax;
      const dy = mouseY - ay;
      if (dx * dx + dy * dy < 28 * 28) {
        const now = Date.now();
        const last = lastClickRef.current;
        if (last?.id === agent.id && now - last.time < 400) {
          onOpenAgent?.(agent.id);
        } else {
          onSelectAgent?.(agent.id);
        }
        lastClickRef.current = { id: agent.id, time: now };
        return;
      }
    }
    onSelectAgent?.("");
    lastClickRef.current = null;
  }, [agents, onSelectAgent, onOpenAgent]);

  // ── Pan (drag) ────────────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDraggingRef.current = false;
    dragStartRef.current = { x: e.clientX - offsetRef.current.x, y: e.clientY - offsetRef.current.y };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (e.buttons !== 1) return;
    isDraggingRef.current = true;
    const nx = e.clientX - dragStartRef.current.x;
    const ny = e.clientY - dragStartRef.current.y;
    offsetRef.current = { x: nx, y: ny };
    setOffset({ x: nx, y: ny });
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "100%", cursor: "pointer" }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
    />
  );
}

// ─── Avatar Builder ────────────────────────────────────────────────────────────

interface AvatarBuilderProps {
  value: AvatarConfig;
  onChange: (config: AvatarConfig) => void;
  compact?: boolean;
}

const HAIR_STYLE_NAMES = ["Spike", "Long", "Mohawk", "Afro", "Bob", "Ponytail", "Bun", "Wavy", "Buzz", "Curly"];
const ACC_NAMES = ["Aucun", "Lunettes", "Casque", "Couronne", "Casquette", "Cravate", "Écharpe", "Visière", "Boucles", "Sac-à-dos"];

export function AvatarBuilder({ value, onChange, compact = false }: AvatarBuilderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Live preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    const bg = ctx.createRadialGradient(60, 80, 10, 60, 80, 70);
    bg.addColorStop(0, "#1e2a3a");
    bg.addColorStop(1, "#0a0f1e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 120, 160);

    // Floor shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(60, 140, 25, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    drawAvatar(ctx, 60, 120, value, 1.1);
  }, [value]);

  const update = <K extends keyof AvatarConfig>(key: K, val: number) =>
    onChange({ ...value, [key]: val });

  const Swatch = ({ colors, selected, onSelect }: { colors: string[]; selected: number; onSelect: (i: number) => void }) => (
    <div className="flex flex-wrap gap-1">
      {colors.map((c, i) => (
        <button
          key={i}
          title={c}
          onClick={() => onSelect(i)}
          className="rounded-full border-2 transition-all"
          style={{
            background: c,
            width: compact ? 14 : 18,
            height: compact ? 14 : 18,
            borderColor: selected === i ? "#818cf8" : "transparent",
            transform: selected === i ? "scale(1.2)" : "scale(1)",
          }}
        />
      ))}
    </div>
  );

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wider text-indigo-400/70">{label}</p>
      {children}
    </div>
  );

  const StylePicker = ({ max, selected, onSelect, names }: { max: number; selected: number; onSelect: (i: number) => void; names?: string[] }) => (
    <div className="flex flex-wrap gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-all ${selected === i ? "bg-indigo-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}
        >
          {names ? names[i] : i + 1}
        </button>
      ))}
    </div>
  );

  return (
    <div className={`flex ${compact ? "gap-3" : "gap-4"}`}>
      {/* Preview */}
      <div className="shrink-0">
        <canvas
          ref={canvasRef}
          width={120}
          height={160}
          className="rounded-lg border border-white/10"
          style={{ imageRendering: "pixelated" }}
        />
        <p className="mt-1 text-center text-[9px] text-slate-500">Aperçu</p>
      </div>

      {/* Controls */}
      <div className={`flex-1 space-y-3 overflow-y-auto ${compact ? "max-h-48" : "max-h-80"} pr-1`}>
        <Row label="Teint">
          <Swatch colors={SKIN_TONES} selected={value.skinTone} onSelect={(i) => update("skinTone", i)} />
        </Row>
        <Row label="Coiffure">
          <StylePicker max={10} selected={value.hairStyle} onSelect={(i) => update("hairStyle", i)} names={HAIR_STYLE_NAMES} />
          <Swatch colors={HAIR_COLORS} selected={value.hairColor} onSelect={(i) => update("hairColor", i)} />
        </Row>
        <Row label="Yeux">
          <StylePicker max={6} selected={value.eyeStyle} onSelect={(i) => update("eyeStyle", i)} />
          <Swatch colors={EYE_COLORS} selected={value.eyeColor} onSelect={(i) => update("eyeColor", i)} />
        </Row>
        <Row label="Haut">
          <StylePicker max={12} selected={value.topStyle} onSelect={(i) => update("topStyle", i)} />
          <Swatch colors={TOP_COLORS} selected={value.topColor} onSelect={(i) => update("topColor", i)} />
        </Row>
        <Row label="Bas">
          <StylePicker max={8} selected={value.bottomStyle} onSelect={(i) => update("bottomStyle", i)} />
          <Swatch colors={BOTTOM_COLORS} selected={value.bottomColor} onSelect={(i) => update("bottomColor", i)} />
        </Row>
        <Row label="Chaussures">
          <StylePicker max={6} selected={value.shoeStyle} onSelect={(i) => update("shoeStyle", i)} />
          <Swatch colors={SHOE_COLORS} selected={value.shoeColor} onSelect={(i) => update("shoeColor", i)} />
        </Row>
        <Row label="Accessoire">
          <StylePicker max={10} selected={value.accessory} onSelect={(i) => update("accessory", i)} names={ACC_NAMES} />
        </Row>
      </div>
    </div>
  );
}

// ─── Default avatar presets by category ───────────────────────────────────────

export function defaultAvatarForCategory(category: string, seed: number = 0): AvatarConfig {
  const h = (base: number) => (base + seed * 3) % 12;
  const s = (base: number, max: number) => (base + seed) % max;

  const presets: Record<string, AvatarConfig> = {
    helpdesk:  { skinTone: s(1, 6), hairStyle: 8, hairColor: h(0), eyeStyle: 0, eyeColor: 1, topStyle: 0, topColor: 2, bottomStyle: 0, bottomColor: 0, shoeStyle: 0, shoeColor: 0, accessory: 2, badge: 0 },
    hr:        { skinTone: s(2, 6), hairStyle: 4, hairColor: h(4), eyeStyle: 1, eyeColor: 4, topStyle: 2, topColor: 4, bottomStyle: 1, bottomColor: 4, shoeStyle: 1, shoeColor: 2, accessory: 5, badge: 1 },
    documents: { skinTone: s(0, 6), hairStyle: 1, hairColor: h(2), eyeStyle: 2, eyeColor: 2, topStyle: 4, topColor: 0, bottomStyle: 0, bottomColor: 2, shoeStyle: 0, shoeColor: 1, accessory: 1, badge: 2 },
    sales:     { skinTone: s(3, 6), hairStyle: 0, hairColor: h(6), eyeStyle: 0, eyeColor: 5, topStyle: 5, topColor: 9, bottomStyle: 2, bottomColor: 7, shoeStyle: 2, shoeColor: 3, accessory: 5, badge: 3 },
    support:   { skinTone: s(4, 6), hairStyle: 6, hairColor: h(8), eyeStyle: 3, eyeColor: 3, topStyle: 3, topColor: 5, bottomStyle: 3, bottomColor: 1, shoeStyle: 1, shoeColor: 0, accessory: 2, badge: 4 },
    devops:    { skinTone: s(1, 6), hairStyle: 2, hairColor: h(1), eyeStyle: 0, eyeColor: 0, topStyle: 1, topColor: 10, bottomStyle: 0, bottomColor: 0, shoeStyle: 0, shoeColor: 0, accessory: 4, badge: 5 },
  };

  return presets[category] ?? {
    skinTone: s(0, 6), hairStyle: s(0, 10), hairColor: h(0), eyeStyle: s(0, 6), eyeColor: s(0, 8),
    topStyle: s(0, 12), topColor: s(0, 12), bottomStyle: s(0, 8), bottomColor: s(0, 12),
    shoeStyle: s(0, 6), shoeColor: s(0, 7), accessory: 0, badge: s(0, 7),
  };
}

// ─── Utility: generate demo agents for world ─────────────────────────────────

export function generateWorldAgents(agentList: Array<{ id: string; name: string; category: string; state?: WorldAgent["state"]; chatBubble?: string }>): WorldAgent[] {
  return agentList.slice(0, AGENT_TILE_POSITIONS.length).map((agent, idx) => {
    const pos = AGENT_TILE_POSITIONS[idx];
    return {
      id: agent.id,
      name: agent.name,
      category: agent.category,
      state: agent.state ?? "idle",
      avatar: defaultAvatarForCategory(agent.category, idx),
      tileX: pos.tx,
      tileY: pos.ty,
      chatBubble: agent.chatBubble ? { text: agent.chatBubble, expiresAt: Date.now() + 5000 } : undefined,
      taskProgress: agent.state === "acting" || agent.state === "thinking" ? Math.random() * 80 + 10 : undefined,
    };
  });
}
