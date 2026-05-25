"use client";

import { useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface MiiConfig {
  // Teint
  skin: number;         // hex, 20 options
  // Visage
  faceShape: number;    // 0=rond, 1=ovale, 2=carré
  eyeShape: number;     // 0=normal, 1=amande, 2=grand
  browStyle: number;    // 0=arqué, 1=droit, 2=épais
  noseStyle: number;    // 0=petit, 1=normal, 2=large
  mouthStyle: number;   // 0=sourire, 1=grand sourire, 2=neutre
  blush: number;        // 0=aucun, 1=rose, 2=chaud
  // Cheveux
  hairStyle: number;    // 0-9
  hairColor: number;    // hex, 12 options
  // Yeux
  eyeColor: number;     // hex, 8 options
  // Tenue
  outfit: number;       // hex
  // Extras
  facialHair: number;   // 0=aucun, 1=moustache, 2=bouc, 3=barbe
  glasses: number;      // 0=aucun, 1=rondes, 2=carrées, 3=aviateur
  hat: number;          // 0=aucun, 1=casquette, 2=bonnet, 3=fedora
  badge: boolean;
  scarf: boolean;
}

// ── Palettes ──────────────────────────────────────────────────────────────────
export const MII_SKINS = [
  // Très clair
  0xFFEDD0, 0xFFDFC4, 0xFED1A8,
  // Clair
  0xF5C39E, 0xEFB888, 0xE8A87A,
  // Clair-moyen
  0xDC9460, 0xCF7F4A, 0xC16B38,
  // Moyen
  0xB05D30, 0xA05025, 0x8D4420,
  // Moyen-foncé
  0x7A3718, 0x6A2D12, 0x5A240D,
  // Foncé
  0x4A1D09, 0x3C1506, 0x2E0F03,
  // Très foncé
  0x210B02, 0x150701,
];

export const MII_HAIR_COLORS = [
  0x0A0603, 0x1C1008, 0x3D1C02,
  0x6B3A2A, 0x8B4513, 0xB8741A,
  0xCC8833, 0xE8C547, 0xF5E6A0,
  0xC8B4A0, 0xE8DDD0, 0xFF6B6B,
];

export const MII_EYE_COLORS = [
  0x1A3A8F, 0x2255CC, 0x0F7A3C,
  0x228B22, 0x663300, 0x8B4513,
  0x708090, 0x9370DB,
];

export const MII_OUTFITS = [
  0x6366f1, 0x8b5cf6, 0xec4899,
  0xf59e0b, 0x10b981, 0x0ea5e9,
  0xef4444, 0x334155,
];

export const MII_HAIR_NAMES = [
  "Aucun", "Court", "Mèche", "Long", "Chignon",
  "Bouclés", "Tresses", "Punk", "Banane", "Rasé",
];

const CAT_OUTFITS: Record<string, number> = {
  helpdesk: 0x6366f1, hr: 0xec4899, documents: 0xf59e0b,
  sales: 0x10b981, support: 0x0ea5e9, devops: 0xef4444, general: 0x8b5cf6,
};

// ── Config helpers ─────────────────────────────────────────────────────────────
export function getDefaultMii(category: string): MiiConfig {
  return {
    skin: 0xFFDFC4, faceShape: 0, eyeShape: 0, browStyle: 0,
    noseStyle: 1, mouthStyle: 0, blush: 0,
    hairStyle: 1, hairColor: 0x1C1008,
    eyeColor: 0x2255CC,
    outfit: CAT_OUTFITS[category?.toLowerCase()] ?? 0x6366f1,
    facialHair: 0, glasses: 0, hat: 0,
    badge: false, scarf: false,
  };
}

export function getMiiConfig(agentId: string, category: string): MiiConfig {
  if (typeof window === "undefined") return getDefaultMii(category);
  try {
    const s = localStorage.getItem(`norys:mii:${agentId}`);
    if (s) return { ...getDefaultMii(category), ...(JSON.parse(s) as Partial<MiiConfig>) };
  } catch {}
  return getDefaultMii(category);
}

export function saveMiiConfig(agentId: string, config: MiiConfig): void {
  try { localStorage.setItem(`norys:mii:${agentId}`, JSON.stringify(config)); } catch {}
}

// ── Three.js character builder (exported for isometric world) ─────────────────
export function buildCharacter(T: any, char: any, cfg: MiiConfig, scale = 1) {
  while (char.children.length) char.remove(char.children[0]);

  const s = scale;

  const mat = (c: number, opacity?: number) =>
    new T.MeshPhongMaterial({ color: c, shininess: opacity ? 60 : 30, transparent: !!opacity, opacity: opacity ?? 1 });
  const add = (geo: any, m: any, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const mesh = new T.Mesh(geo, m);
    mesh.position.set(x * s, y * s, z * s);
    mesh.rotation.set(rx, ry, rz);
    mesh.scale.set(sx * s, sy * s, sz * s);
    char.add(mesh);
    return mesh;
  };

  const sm  = mat(cfg.skin);
  const hm  = new T.MeshPhongMaterial({ color: cfg.hairColor, shininess: 60 });
  const om  = new T.MeshPhongMaterial({ color: cfg.outfit, shininess: 40 });
  const pm  = mat(0x1e293b);
  const shm = new T.MeshPhongMaterial({ color: 0x0f172a, shininess: 60 });

  // Face shape factors
  const fsx = cfg.faceShape === 2 ? 1.08 : 1.0;
  const fsy = cfg.faceShape === 1 ? 1.2 : cfg.faceShape === 2 ? 0.9 : 1.0;
  const fsz = cfg.faceShape === 2 ? 0.92 : 1.0;

  // Head
  const headGeo = new T.SphereGeometry(0.78, 32, 32);
  const head = new T.Mesh(headGeo, sm);
  head.position.set(0, 1.52 * s, 0);
  head.scale.set(fsx * s, fsy * s, fsz * s);
  char.add(head);

  // Ears
  [-1, 1].forEach(side => {
    const ear = new T.Mesh(new T.SphereGeometry(0.19, 16, 16), sm);
    ear.position.set(side * 0.75 * s, 1.52 * s, 0);
    ear.scale.set(s, s, 0.55 * s);
    char.add(ear);
  });

  // Eyes
  const eyeScaleX = cfg.eyeShape === 1 ? 1.4 : cfg.eyeShape === 2 ? 1.2 : 1.0;
  const eyeScaleY = cfg.eyeShape === 1 ? 0.65 : cfg.eyeShape === 2 ? 1.3 : 1.0;

  [-1, 1].forEach(side => {
    const ex = side * 0.29, ey = 1.57, ez = 0.71;
    // White
    const wh = new T.Mesh(new T.SphereGeometry(0.17, 16, 16), mat(0xFFFFFF));
    wh.position.set(ex * s, ey * s, ez * s);
    wh.scale.set(eyeScaleX * s, eyeScaleY * s, 0.6 * s);
    char.add(wh);
    // Iris
    const ir = new T.Mesh(new T.SphereGeometry(0.11, 16, 16), mat(cfg.eyeColor));
    ir.position.set(ex * s, ey * s, (ez + 0.04) * s);
    ir.scale.set(eyeScaleX * s, eyeScaleY * s, 0.45 * s);
    char.add(ir);
    // Pupil
    const pu = new T.Mesh(new T.SphereGeometry(0.06, 12, 12), mat(0x080808));
    pu.position.set(ex * s, ey * s, (ez + 0.06) * s);
    pu.scale.set(eyeScaleX * s, eyeScaleY * s, 0.4 * s);
    char.add(pu);
    // Highlight
    add(new T.SphereGeometry(0.025, 8, 8), mat(0xFFFFFF), ex + side * 0.02, 1.595, ez + 0.07);

    // Brows
    const browW = cfg.browStyle === 2 ? 0.28 : 0.24;
    const browH = cfg.browStyle === 2 ? 0.07 : 0.055;
    const browAngle = cfg.browStyle === 0 ? side * -0.18 : cfg.browStyle === 2 ? side * -0.08 : 0;
    add(new T.BoxGeometry(browW, browH, 0.04), hm, ex, 1.8, 0.69, 0, 0, browAngle);
  });

  // Nose
  const noseW = cfg.noseStyle === 0 ? 0.065 : cfg.noseStyle === 2 ? 0.09 : 0.075;
  const noseTone = Math.max(0, cfg.skin - 0x0D0907);
  add(new T.SphereGeometry(noseW, 12, 12), mat(noseTone), 0, 1.45, 0.76, 0, 0, 0, 1, 0.8, 0.65);

  // Blush
  if (cfg.blush > 0) {
    const blushColor = cfg.blush === 1 ? 0xFF9999 : 0xFFAA88;
    [-1, 1].forEach(side =>
      add(new T.SphereGeometry(0.14, 12, 12), mat(blushColor, 0.32), side * 0.44, 1.38, 0.63, 0, 0, 0, 1, 0.8, 0.28)
    );
  }

  // Mouth
  if (cfg.mouthStyle === 2) {
    // Neutral
    add(new T.BoxGeometry(0.26, 0.04, 0.04), mat(0xAA5555), 0, 1.28, 0.73);
  } else {
    const mouthR = cfg.mouthStyle === 1 ? 0.17 : 0.13;
    add(new T.TorusGeometry(mouthR, 0.032, 8, 20, Math.PI), mat(0xBB5555), 0, 1.28, 0.73, Math.PI, 0, 0);
  }

  // Neck + body
  add(new T.CylinderGeometry(0.19, 0.22, 0.28, 16), sm, 0, 0.9, 0);
  add(new T.CylinderGeometry(0.57, 0.52, 1.22, 16), om, 0, 0.18, 0);
  add(new T.CylinderGeometry(0.24, 0.24, 0.14, 16), om, 0, 0.8, 0);

  // Arms + hands
  [-1, 1].forEach(side => {
    add(new T.CylinderGeometry(0.17, 0.14, 0.94, 12), om, side * 0.77, 0.22, 0, 0, 0, side * -0.28);
    add(new T.SphereGeometry(0.17, 12, 12), sm, side * 0.9, -0.28, 0);
  });

  // Badge
  if (cfg.badge) {
    add(new T.BoxGeometry(0.22, 0.16, 0.06), mat(0xFFFFFF), 0.22, 0.5, 0.52);
    add(new T.BoxGeometry(0.18, 0.012, 0.07), mat(cfg.outfit), 0.22, 0.53, 0.52);
    add(new T.BoxGeometry(0.18, 0.012, 0.07), mat(0xAAAAAA), 0.22, 0.5, 0.52);
  }

  // Legs + shoes
  [-1, 1].forEach(side => {
    add(new T.CylinderGeometry(0.21, 0.19, 0.95, 12), pm, side * 0.23, -0.96, 0);
    add(new T.BoxGeometry(0.3, 0.19, 0.48), shm, side * 0.23, -1.47, 0.09);
  });

  // Ground shadow
  const sd = new T.Mesh(new T.CircleGeometry(0.85, 32), mat(0x000000, 0.18));
  sd.position.set(0, -1.58 * s, 0);
  sd.rotation.x = -Math.PI / 2;
  char.add(sd);

  // Hair
  if (cfg.hairStyle > 0) {
    // Base hair cap
    add(new T.SphereGeometry(0.8, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.48), hm, 0, 1.52, 0);

    if (cfg.hairStyle === 2) {
      // Mèche / quiff
      add(new T.ConeGeometry(0.22, 0.55, 12), hm, -0.08, 2.42, 0.28, -0.45, 0, 0.22);
    } else if (cfg.hairStyle === 3) {
      // Long
      ([ [-0.52, 1.0, -0.1, 0.12], [0, 0.88, -0.32, -0.15], [0.52, 1.0, -0.1, 0.12] ] as number[][])
        .forEach(([x, y, z, rx]) => add(new T.CylinderGeometry(0.13, 0.09, 0.78, 10), hm, x, y, z, rx, 0, 0));
    } else if (cfg.hairStyle === 4) {
      // Chignon
      add(new T.SphereGeometry(0.24, 16, 16), hm, 0, 2.38, -0.42);
    } else if (cfg.hairStyle === 5) {
      // Bouclés
      ([ [0, 2.3, 0], [-.38, 2.18, .22], [.38, 2.18, .22], [-.52, 1.88, .3],
         [.52, 1.88, .3], [0, 2.12, -.46], [-.42, 2.0, -.3], [.42, 2.0, -.3] ] as number[][])
        .forEach(([x, y, z]) => add(new T.SphereGeometry(0.21, 12, 12), hm, x, y, z));
    } else if (cfg.hairStyle === 6) {
      // Tresses
      ([ [-0.28, 0.95, -0.25], [0.28, 0.95, -0.25] ] as number[][]).forEach(([x, y, z]) => {
        for (let i = 0; i < 4; i++) {
          add(new T.SphereGeometry(0.12 - i * 0.01, 10, 10), hm, x, y - i * 0.28, z);
        }
      });
    } else if (cfg.hairStyle === 7) {
      // Punk / Mohawk
      for (let i = 0; i < 5; i++) {
        add(new T.ConeGeometry(0.1 - i * 0.005, 0.5, 8), hm, 0, 2.3 + i * 0.08, 0.05 * (i % 2 === 0 ? 1 : -1));
      }
    } else if (cfg.hairStyle === 8) {
      // Banane / Pompadour
      add(new T.SphereGeometry(0.45, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hm, 0, 2.1, 0.22);
      add(new T.BoxGeometry(0.7, 0.2, 0.5), hm, 0, 2.05, 0.2);
    } else if (cfg.hairStyle === 9) {
      // Rasé — just the thin cap, already done above (SphereGeometry hemisphere at 0.48)
    }
  }

  // Facial hair
  if (cfg.facialHair === 1) {
    // Moustache
    [-1, 1].forEach(side =>
      add(new T.SphereGeometry(0.1, 10, 8), hm, side * 0.13, 1.33, 0.74, 0, 0, 0, 1.5, 0.65, 0.5)
    );
  } else if (cfg.facialHair === 2) {
    // Bouc / goatee
    add(new T.SphereGeometry(0.13, 12, 10), hm, 0, 1.19, 0.68, 0, 0, 0, 1, 1.1, 0.7);
    [-1, 1].forEach(side =>
      add(new T.SphereGeometry(0.09, 10, 8), hm, side * 0.13, 1.33, 0.74, 0, 0, 0, 1.5, 0.65, 0.5)
    );
  } else if (cfg.facialHair === 3) {
    // Barbe complète
    add(new T.SphereGeometry(0.37, 16, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), hm, 0, 1.13, 0.56, 0, 0, 0, 1, 1, 0.65);
    [-1, 1].forEach(side =>
      add(new T.SphereGeometry(0.105, 10, 8), hm, side * 0.14, 1.3, 0.73, 0, 0, 0, 1.4, 0.7, 0.55)
    );
  }

  // Glasses
  if (cfg.glasses > 0) {
    const fm = mat(cfg.glasses === 3 ? 0xC0A000 : 0x222222);
    const lm = cfg.glasses === 3
      ? mat(0x2244AA, 0.55)
      : mat(0x99CCFF, 0.28);
    const lensR = cfg.glasses === 2 ? 0 : 0.16; // 0 = square lens
    [-1, 1].forEach(side => {
      if (cfg.glasses === 2) {
        add(new T.BoxGeometry(0.32, 0.24, 0.03), fm, side * 0.31, 1.57, 0.73);
        add(new T.BoxGeometry(0.29, 0.21, 0.03), lm, side * 0.31, 1.57, 0.74);
      } else {
        add(new T.TorusGeometry(0.16, 0.026, 8, 22), fm, side * 0.31, 1.57, 0.73);
        add(new T.CircleGeometry(0.135, 22), lm, side * 0.31, 1.57, 0.74);
      }
    });
    add(new T.BoxGeometry(0.17, 0.026, 0.026), fm, 0, 1.59, 0.73);
    [-1, 1].forEach(side =>
      add(new T.BoxGeometry(0.36, 0.026, 0.026), fm, side * 0.64, 1.57, 0.56, 0, side * 0.42, 0)
    );
    // Aviator extra lower rim
    if (cfg.glasses === 3) {
      [-1, 1].forEach(side =>
        add(new T.TorusGeometry(0.12, 0.02, 8, 18, Math.PI), fm, side * 0.31, 1.42, 0.73, 0, 0, 0)
      );
    }
  }

  // Hat
  if (cfg.hat > 0) {
    const hm2 = new T.MeshPhongMaterial({ color: cfg.outfit, shininess: 20 });
    if (cfg.hat === 1) {
      // Casquette
      add(new T.CylinderGeometry(0.88, 0.88, 0.07, 28), hm2, 0, 2.26, 0);
      add(new T.CylinderGeometry(0.72, 0.82, 0.52, 28), hm2, 0, 2.56, 0);
      add(new T.BoxGeometry(1.12, 0.07, 0.46), hm2, 0, 2.26, 0.52);
    } else if (cfg.hat === 2) {
      // Bonnet
      add(new T.SphereGeometry(0.84, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hm2, 0, 2.0, 0);
      add(new T.TorusGeometry(0.83, 0.1, 12, 28), hm2, 0, 2.0, 0, Math.PI / 2, 0, 0);
    } else if (cfg.hat === 3) {
      // Fedora
      add(new T.CylinderGeometry(1.02, 1.02, 0.09, 28), hm2, 0, 2.28, 0);
      add(new T.CylinderGeometry(0.63, 0.74, 0.62, 28), hm2, 0, 2.62, 0);
      add(new T.CylinderGeometry(0.75, 0.75, 0.11, 28), mat(0xf8f8f8), 0, 2.36, 0);
    }
  }

  // Scarf
  if (cfg.scarf) {
    add(new T.TorusGeometry(0.32, 0.11, 12, 26), mat(0xE74C3C), 0, 0.75, 0, Math.PI / 2, 0, 0);
    [-0.08, 0.08].forEach(z =>
      add(new T.CylinderGeometry(0.115, 0.115, 0.25, 14), mat(0xE74C3C), 0.26, 0.56, z)
    );
  }
}

// ── Card avatar (lightweight CSS, no Three.js) ────────────────────────────────
export function MiiCardAvatar({
  agentId, category, size = "md",
}: {
  agentId: string; category: string; size?: "sm" | "md" | "lg" | "xl";
}) {
  const [cfg, setCfg] = useState<MiiConfig>(() => getDefaultMii(category));

  useEffect(() => {
    setCfg(getMiiConfig(agentId, category));
    const handler = (e: StorageEvent) => {
      if (e.key === `norys:mii:${agentId}`) setCfg(getMiiConfig(agentId, category));
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [agentId, category]);

  const dim       = { sm: 32, md: 48, lg: 64, xl: 80 }[size];
  const skinHex   = "#" + cfg.skin.toString(16).padStart(6, "0");
  const hairHex   = "#" + cfg.hairColor.toString(16).padStart(6, "0");
  const outfitHex = "#" + cfg.outfit.toString(16).padStart(6, "0");
  const eyeHex    = "#" + cfg.eyeColor.toString(16).padStart(6, "0");

  // Face shape
  const faceW = cfg.faceShape === 2 ? dim * 0.66 : dim * 0.62;
  const faceH = cfg.faceShape === 1 ? dim * 0.68 : cfg.faceShape === 2 ? dim * 0.54 : dim * 0.60;
  const faceRadius = cfg.faceShape === 2 ? "24%" : "50%";

  // Eye shape
  const eyeW  = { sm: 4.2, md: 6.6, lg: 8.8, xl: 11 }[size];
  const eyeH  = cfg.eyeShape === 1 ? eyeW * 0.6 : cfg.eyeShape === 2 ? eyeW * 1.3 : eyeW;
  const eyeBR = cfg.eyeShape === 1 ? "50% 50% 50% 50% / 60% 60% 40% 40%" : "50%";
  const hairH = cfg.hairStyle === 0 ? 0 : dim * 0.34;
  const r     = dim * 0.26;

  // Blush color
  const blushColor = cfg.blush === 1 ? "#FF9999" : "#FFB88A";
  const blushOpacity = cfg.blush > 0 ? 0.55 : 0;

  return (
    <div style={{
      width: dim, height: dim, borderRadius: r, flexShrink: 0,
      background: outfitHex + "1A", border: `1.5px solid ${outfitHex}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
    }}>
      {/* Hair back */}
      {cfg.hairStyle > 0 && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: hairH,
          background: hairHex, borderRadius: `${r}px ${r}px 0 0`,
        }} />
      )}
      {/* Hat */}
      {cfg.hat > 0 && (
        <div style={{
          position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
          width: cfg.hat === 2 ? dim * 0.72 : dim * 0.58,
          height: cfg.hat === 2 ? dim * 0.36 : dim * 0.28,
          background: outfitHex,
          borderRadius: cfg.hat === 2 ? "50% 50% 0 0" : `${r * 0.4}px ${r * 0.4}px 0 0`,
          zIndex: 3,
        }} />
      )}
      {/* Face */}
      <div style={{
        width: faceW, height: faceH, borderRadius: faceRadius, background: skinHex,
        zIndex: 1, position: "relative",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: dim * 0.03,
      }}>
        {/* Blush */}
        {cfg.blush > 0 && (
          <div style={{
            position: "absolute", top: "55%", left: 0, right: 0,
            display: "flex", justifyContent: "space-between", padding: `0 ${dim * 0.03}px`,
            pointerEvents: "none",
          }}>
            {[0, 1].map(i => (
              <div key={i} style={{
                width: dim * 0.17, height: dim * 0.09, borderRadius: "50%",
                background: blushColor, opacity: blushOpacity,
              }} />
            ))}
          </div>
        )}
        {/* Eyes */}
        <div style={{ display: "flex", gap: dim * 0.12, marginTop: dim * 0.06 }}>
          {[0, 1].map(i => (
            <div key={i} style={{ width: eyeW, height: eyeH, borderRadius: eyeBR, background: eyeHex }} />
          ))}
        </div>
        {/* Mouth */}
        <div style={{
          width: cfg.mouthStyle === 1 ? dim * 0.24 : dim * 0.2,
          height: dim * 0.045,
          borderRadius: cfg.mouthStyle === 2 ? "2px" : "0 0 50% 50%",
          background: "#cc6666",
        }} />
      </div>
      {/* Glasses overlay */}
      {cfg.glasses > 0 && (
        <div style={{
          position: "absolute", zIndex: 2,
          top: "40%", left: "50%", transform: "translate(-50%, -50%)",
          display: "flex", gap: dim * 0.03, pointerEvents: "none",
        }}>
          {[0, 1].map(i => (
            <div key={i} style={{
              width: dim * 0.24, height: dim * 0.17,
              border: `${Math.max(1, dim * 0.025)}px solid ${cfg.glasses === 3 ? "#AA8800" : "#333"}`,
              borderRadius: cfg.glasses === 2 ? "3px" : dim * 0.06,
              background: cfg.glasses === 3 ? "rgba(30,60,160,0.25)" : "rgba(200,230,255,0.12)",
            }} />
          ))}
        </div>
      )}
      {/* Facial hair */}
      {cfg.facialHair > 0 && (
        <div style={{
          position: "absolute", zIndex: 2, bottom: "22%",
          left: "50%", transform: "translateX(-50%)",
          width: cfg.facialHair === 3 ? dim * 0.5 : dim * 0.35,
          height: cfg.facialHair === 3 ? dim * 0.18 : cfg.facialHair === 1 ? dim * 0.07 : dim * 0.12,
          background: hairHex, borderRadius: cfg.facialHair === 1 ? `${dim * 0.04}px ${dim * 0.04}px 0 0` : "50%",
          opacity: 0.85,
        }} />
      )}
      {/* Badge */}
      {cfg.badge && (
        <div style={{
          position: "absolute", zIndex: 4, bottom: "28%", right: "8%",
          width: dim * 0.2, height: dim * 0.14, background: "#fff",
          borderRadius: 2, border: `1px solid ${outfitHex}`,
        }} />
      )}
    </div>
  );
}

// ── MiiCanvas — Three.js 3D canvas ────────────────────────────────────────────
export function MiiCanvas({
  config, interactive = false,
}: {
  config: MiiConfig; interactive?: boolean;
}) {
  const mountRef  = useRef<HTMLDivElement>(null);
  const configRef = useRef(config);
  configRef.current = config;

  const rendererRef  = useRef<any>(null);
  const characterRef = useRef<any>(null);
  const TRef         = useRef<any>(null);
  const frameRef     = useRef(0);
  const cancelRef    = useRef(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    cancelRef.current = false;

    import("three").then((T) => {
      if (cancelRef.current || !mountRef.current) return;
      TRef.current = T;
      const w = mount.clientWidth || 400;
      const h = mount.clientHeight || 300;

      const renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h);
      renderer.setClearColor(0x12121e, 1);
      mount.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const scene  = new T.Scene();
      const camera = new T.PerspectiveCamera(42, w / h, 0.1, 100);
      camera.position.set(0, 0.4, 5.2);

      scene.add(new T.AmbientLight(0xffffff, 0.55));
      const dl = new T.DirectionalLight(0xffffff, 0.9); dl.position.set(3, 5, 4); scene.add(dl);
      const fl = new T.DirectionalLight(0x7788ff, 0.25); fl.position.set(-3, 1, -3); scene.add(fl);

      const character = new T.Group();
      scene.add(character);
      characterRef.current = character;
      buildCharacter(T, character, configRef.current, 1);

      const rot = { y: 0, x: 0.08, drag: false, lx: 0, ly: 0, lastDrag: 0, auto: true };

      function animate() {
        if (cancelRef.current) return;
        frameRef.current = requestAnimationFrame(animate);
        if (!rot.drag && Date.now() - rot.lastDrag > 4000) rot.auto = true;
        if (rot.auto) rot.y += 0.008;
        character.rotation.y = rot.y;
        character.rotation.x = rot.x;
        renderer.render(scene, camera);
      }
      animate();

      const ro = new ResizeObserver(() => {
        if (!mount || cancelRef.current) return;
        const w2 = mount.clientWidth, h2 = mount.clientHeight;
        if (w2 > 0 && h2 > 0) {
          renderer.setSize(w2, h2, false);
          camera.aspect = w2 / h2;
          camera.updateProjectionMatrix();
        }
      });
      ro.observe(mount);

      if (interactive) {
        const onDown = (e: MouseEvent) => { rot.drag = true; rot.lx = e.clientX; rot.ly = e.clientY; rot.auto = false; rot.lastDrag = Date.now(); };
        const onMove = (e: MouseEvent) => { if (!rot.drag) return; rot.y += (e.clientX - rot.lx) * 0.012; rot.x += (e.clientY - rot.ly) * 0.009; rot.x = Math.max(-0.55, Math.min(0.55, rot.x)); rot.lx = e.clientX; rot.ly = e.clientY; };
        const onUp   = () => { rot.drag = false; rot.lastDrag = Date.now(); };
        const onTouchStart = (e: TouchEvent) => { rot.drag = true; rot.lx = e.touches[0].clientX; rot.ly = e.touches[0].clientY; rot.auto = false; };
        const onTouchMove  = (e: TouchEvent) => { if (!rot.drag) return; rot.y += (e.touches[0].clientX - rot.lx) * 0.012; rot.x += (e.touches[0].clientY - rot.ly) * 0.009; rot.x = Math.max(-0.55, Math.min(0.55, rot.x)); rot.lx = e.touches[0].clientX; rot.ly = e.touches[0].clientY; };
        const onTouchEnd   = () => { rot.drag = false; };

        renderer.domElement.addEventListener("mousedown", onDown);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        renderer.domElement.addEventListener("touchstart", onTouchStart, { passive: true });
        renderer.domElement.addEventListener("touchmove", onTouchMove, { passive: true });
        renderer.domElement.addEventListener("touchend", onTouchEnd);

        (renderer.domElement as any)._miiCleanup = () => {
          renderer.domElement.removeEventListener("mousedown", onDown);
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
      }
      (renderer.domElement as any)._ro = ro;
    });

    return () => {
      cancelRef.current = true;
      cancelAnimationFrame(frameRef.current);
      const r = rendererRef.current;
      if (r) {
        const cleanup = r.domElement?._miiCleanup;
        if (cleanup) cleanup();
        const ro = r.domElement?._ro;
        if (ro) ro.disconnect();
        r.dispose();
        if (r.domElement?.parentNode) r.domElement.parentNode.removeChild(r.domElement);
        rendererRef.current = null;
        characterRef.current = null;
        TRef.current = null;
      }
    };
  }, [interactive]);

  useEffect(() => {
    const T = TRef.current;
    const char = characterRef.current;
    if (!T || !char) return;
    buildCharacter(T, char, config, 1);
  }, [config]);

  return (
    <div
      ref={mountRef}
      style={{ width: "100%", height: "100%", cursor: interactive ? "grab" : "default", position: "relative" }}
    >
      {interactive && (
        <div style={{
          position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
          fontSize: 11, color: "rgba(255,255,255,0.3)", pointerEvents: "none",
          whiteSpace: "nowrap", zIndex: 10,
        }}>
          glisser pour pivoter
        </div>
      )}
    </div>
  );
}

// ── Mii Avatar Editor ─────────────────────────────────────────────────────────
const CTRL_TABS = ["Teint", "Visage", "Cheveux", "Tenue", "Extras"] as const;
type CtrlTab = typeof CTRL_TABS[number];

export function MiiAvatarEditor({
  agentId, category, onSave,
}: {
  agentId: string; category: string; onSave?: (cfg: MiiConfig) => void;
}) {
  const [cfg, setCfg]         = useState<MiiConfig>(() => getMiiConfig(agentId, category));
  const [ctrlTab, setCtrlTab] = useState<CtrlTab>("Teint");

  function update(patch: Partial<MiiConfig>) {
    setCfg(prev => ({ ...prev, ...patch }));
  }

  function save() {
    saveMiiConfig(agentId, cfg);
    window.dispatchEvent(new StorageEvent("storage", { key: `norys:mii:${agentId}` }));
    onSave?.(cfg);
  }

  const swatch = (color: number, selected: boolean, onClick: () => void, size = 26) => (
    <button
      key={color}
      onClick={onClick}
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0, padding: 0,
        background: "#" + color.toString(16).padStart(6, "0"),
        border: selected ? "3px solid white" : "2px solid transparent",
        boxShadow: selected ? "0 0 0 2px #6366f1" : "none",
        cursor: "pointer",
      }}
    />
  );

  const chip = (label: string, selected: boolean, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      style={{
        padding: "5px 4px", borderRadius: 8, cursor: "pointer",
        fontSize: 11, textAlign: "center" as const,
        border: selected ? "1.5px solid #6366f1" : "0.5px solid rgba(255,255,255,0.1)",
        background: selected ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.03)",
        color: selected ? "#6366f1" : "#9898a8", fontWeight: selected ? 500 : 400,
      }}
    >
      {label}
    </button>
  );

  const toggle = (label: string, active: boolean, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      style={{
        padding: "8px 10px", borderRadius: 8, cursor: "pointer",
        fontSize: 12, textAlign: "center" as const,
        border: active ? "1.5px solid #6366f1" : "0.5px solid rgba(255,255,255,0.1)",
        background: active ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.03)",
        color: active ? "#6366f1" : "#9898a8", fontWeight: active ? 500 : 400,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%" }}>
      {/* 3D canvas */}
      <div style={{ height: 230, borderRadius: 12, overflow: "hidden", flexShrink: 0, marginBottom: 10 }}>
        <MiiCanvas config={cfg} interactive />
      </div>

      {/* Tab selector */}
      <div style={{ display: "flex", gap: 3, marginBottom: 8, flexShrink: 0 }}>
        {CTRL_TABS.map(t => (
          <button
            key={t}
            onClick={() => setCtrlTab(t)}
            className={`flex-1 rounded-lg py-1.5 text-[10px] font-medium transition-colors ${
              ctrlTab === t ? "bg-brand text-white" : "text-content-muted border border-border"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div style={{ flex: 1, minHeight: 80, overflowY: "auto" }}>
        {ctrlTab === "Teint" && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {MII_SKINS.map(c => swatch(c, cfg.skin === c, () => update({ skin: c }), 24))}
          </div>
        )}

        {ctrlTab === "Visage" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <p style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>Forme du visage</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
                {["Rond", "Ovale", "Carré"].map((n, i) => chip(n, cfg.faceShape === i, () => update({ faceShape: i })))}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>Forme des yeux</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
                {["Normal", "Amande", "Grand"].map((n, i) => chip(n, cfg.eyeShape === i, () => update({ eyeShape: i })))}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>Sourcils</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
                {["Arqués", "Droits", "Épais"].map((n, i) => chip(n, cfg.browStyle === i, () => update({ browStyle: i })))}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>Nez</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
                {["Petit", "Normal", "Large"].map((n, i) => chip(n, cfg.noseStyle === i, () => update({ noseStyle: i })))}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>Bouche</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
                {["Sourire", "Grand", "Neutre"].map((n, i) => chip(n, cfg.mouthStyle === i, () => update({ mouthStyle: i })))}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>Joues</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
                {["Aucune", "Rose", "Chaude"].map((n, i) => chip(n, cfg.blush === i, () => update({ blush: i })))}
              </div>
            </div>
          </div>
        )}

        {ctrlTab === "Cheveux" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <p style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>Coiffure</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4 }}>
                {MII_HAIR_NAMES.map((n, i) => chip(n, cfg.hairStyle === i, () => update({ hairStyle: i })))}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>Couleur</p>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {MII_HAIR_COLORS.map(c => swatch(c, cfg.hairColor === c, () => update({ hairColor: c }), 24))}
              </div>
            </div>
          </div>
        )}

        {ctrlTab === "Tenue" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <p style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>Couleur des yeux</p>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {MII_EYE_COLORS.map(c => swatch(c, cfg.eyeColor === c, () => update({ eyeColor: c }), 24))}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>Tenue</p>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {MII_OUTFITS.map(c => swatch(c, cfg.outfit === c, () => update({ outfit: c }), 24))}
              </div>
            </div>
          </div>
        )}

        {ctrlTab === "Extras" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <p style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>Pilosité faciale</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
                {["Aucune", "Moustache", "Bouc", "Barbe"].map((n, i) => chip(n, cfg.facialHair === i, () => update({ facialHair: i })))}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>Lunettes</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
                {["Aucune", "Rondes", "Carrées", "Aviateur"].map((n, i) => chip(n, cfg.glasses === i, () => update({ glasses: i })))}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>Chapeau</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
                {["Aucun", "Casquette", "Bonnet", "Fedora"].map((n, i) => chip(n, cfg.hat === i, () => update({ hat: i })))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 6 }}>
              {toggle("Badge pro", cfg.badge, () => update({ badge: !cfg.badge }))}
              {toggle("Écharpe", cfg.scarf, () => update({ scarf: !cfg.scarf }))}
            </div>
          </div>
        )}
      </div>

      {/* Save */}
      <button
        onClick={save}
        className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
        style={{ background: "#6366f1", flexShrink: 0 }}
      >
        Enregistrer l&apos;avatar
      </button>
    </div>
  );
}
