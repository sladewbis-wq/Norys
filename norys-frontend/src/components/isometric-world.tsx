"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface WorldAgent {
  id: string; name: string; category: string; model?: string; featured?: boolean;
}

interface ZoneDef {
  id: string; label: string;
  floorColor: number; trim: number; light: number;
  cx: number; cz: number; w: number; d: number;
  slots: [number, number][];
}

const ZONES: ZoneDef[] = [
  { id:"helpdesk",  label:"Helpdesk IT", floorColor:0x0f1040, trim:0x6366f1, light:0x6366f1, cx:-8, cz:-7, w:4.5, d:3.5, slots:[[-2,0],[0,0],[2,0]]  },
  { id:"hr",        label:"RH",          floorColor:0x300a1a, trim:0xec4899, light:0xec4899, cx: 8, cz:-7, w:4.5, d:3.5, slots:[[-1.2,0],[1.2,0]]     },
  { id:"documents", label:"Documents",   floorColor:0x281800, trim:0xf59e0b, light:0xf59e0b, cx:-8, cz: 0, w:4.5, d:3.5, slots:[[-2,0],[0,0],[2,0]]  },
  { id:"sales",     label:"Ventes",      floorColor:0x00260f, trim:0x10b981, light:0x10b981, cx: 8, cz: 0, w:4.5, d:3.5, slots:[[-1.2,0],[1.2,0]]     },
  { id:"support",   label:"Support",     floorColor:0x001c30, trim:0x0ea5e9, light:0x0ea5e9, cx:-8, cz: 7, w:4.5, d:3.5, slots:[[0,0]]               },
  { id:"devops",    label:"DevOps",      floorColor:0x260505, trim:0xef4444, light:0xef4444, cx: 8, cz: 7, w:4.5, d:3.5, slots:[[0,0]]               },
];

const CAT_HEX: Record<string, string> = {
  helpdesk:"#6366f1", hr:"#ec4899", documents:"#f59e0b",
  sales:"#10b981", support:"#0ea5e9", devops:"#ef4444", general:"#8b5cf6",
};

const ACTIVITY_MSGS: Record<string, string[]> = {
  helpdesk: ["Analyse incident #4821","Réinitialisation accès AD","Ticket JIRA créé","Escalade N2 initiée","Base KB consultée","Patch déployé"],
  hr:       ["Onboarding J+1 lancé","Contrat envoyé pour signature","Entretien planifié","Fiche RH mise à jour","Congés validés"],
  documents:["Extraction PDF…","Résumé généré","Traduction EN→FR","Données structurées","Rapport archivé"],
  sales:    ["CRM analysé","Séquence email créée","Score lead: 87%","Démo planifiée","Devis généré"],
  support:  ["Ticket #2241 résolu","FAQ mise à jour","Client notifié","SLA: ✓ 98%","Escalade fermée"],
  devops:   ["Pipeline CI vert","Log analysé","Alerte résolue","Auto-scale déclenché","Rollback annulé"],
  general:  ["Traitement…","Analyse données","Génération réponse","Envoi résultat"],
};

// ── Component ─────────────────────────────────────────────────────────────────
export function IsometricAgentWorld({ agents, selectedId, onSelectAgent, searchTerm="" }:{
  agents: WorldAgent[]; selectedId: string|null;
  onSelectAgent:(id:string)=>void; searchTerm?:string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer:any; scene:any; camera:any; T:any; composer:any;
    frame:number; cancelled:boolean;
    agentHits:{ mesh:any; id:string }[];
    agentGroups:Record<string,any>;
    agentWorldPos:{ id:string; wx:number; wy:number; wz:number }[];
    zoom:number; camTarget:{ x:number; z:number };
    pan:{ active:boolean; lx:number; ly:number; ox:number; oz:number };
    coreRings:any[];
    coreSphere:any;
    coreLight:any;
    zoneLights:{ light:any; base:number }[];
    agentParts:Record<string,{ halo:any; visor:any; light:any; body:any }>;
    dataPackets:{ mesh:any; t:number; speed:number; sx:number;sy:number;sz:number; ex:number;ey:number;ez:number; reverse:boolean }[];
    commBeam:{ line:any; age:number; maxAge:number; aId:string; bId:string } | null;
    nextCommTime:number;
    coreNodes:any[];
    catObjects:{ type:string; mesh:any; phase:number; baseY:number; agentId:string }[];
  }>({} as any);

  const [labels, setLabels] = useState<{ id:string; name:string; cat:string; sx:number; sy:number }[]>([]);
  const [zoneLabels, setZoneLabels] = useState<{ id:string; label:string; cat:string; sx:number; sy:number }[]>([]);
  const [hovered, setHovered] = useState<string|null>(null);
  const [commInfo, setCommInfo] = useState<{ aName:string; bName:string } | null>(null);
  const [selectedPos, setSelectedPos] = useState<{x:number;y:number}|null>(null);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [initError, setInitError] = useState<string|null>(null);
  const activityRef = useRef<NodeJS.Timeout|null>(null);

  const project = useCallback((T:any,cam:any,rend:any,x:number,y:number,z:number)=>{
    const v=new T.Vector3(x,y,z); v.project(cam);
    const c=rend.domElement;
    return { x:(v.x*.5+.5)*c.clientWidth, y:(-v.y*.5+.5)*c.clientHeight };
  },[]);

  // Live activity log for selected agent
  useEffect(()=>{
    if(activityRef.current) clearInterval(activityRef.current);
    setActivityLog([]);
    if(!selectedId) return;
    const agent = agents.find(a=>a.id===selectedId);
    if(!agent) return;
    const msgs = ACTIVITY_MSGS[agent.category] ?? ACTIVITY_MSGS.general;
    let i=0;
    activityRef.current = setInterval(()=>{
      const now=new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
      setActivityLog(prev=>[...prev.slice(-5),`[${now}] ${msgs[i%msgs.length]}`]);
      i++;
    },1300);
    return ()=>{ if(activityRef.current) clearInterval(activityRef.current); };
  },[selectedId, agents]);

  useEffect(()=>{
    const mount=mountRef.current; if(!mount) return;
    const s=stateRef.current;
    s.cancelled=false; s.agentHits=[]; s.agentGroups={}; s.agentWorldPos=[];
    s.coreRings=[]; s.zoneLights=[]; s.zoom=10; s.agentParts={}; s.dataPackets=[];
    s.commBeam=null; s.nextCommTime=8; s.coreNodes=[]; s.composer=null; s.catObjects=[];
    s.camTarget={x:0,z:0};
    s.pan={active:false,lx:0,ly:0,ox:0,oz:0};

    import("three").then(async(T)=>{
      if(s.cancelled||!mountRef.current) return;
      s.T=T;
      try {
      const w=mount.clientWidth||800, h=mount.clientHeight||600, aspect=w/h;

      // ── Renderer ──
      const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
      renderer.setSize(w,h);
      renderer.shadowMap.enabled=true;
      renderer.shadowMap.type=T.PCFSoftShadowMap;
      (renderer as any).toneMapping=(T as any).ACESFilmicToneMapping;
      (renderer as any).toneMappingExposure=1.8;
      renderer.setClearColor(0x01010a,1);
      mount.appendChild(renderer.domElement);
      s.renderer=renderer;

      // ── Camera ──
      const camera=new T.OrthographicCamera(-s.zoom*aspect,s.zoom*aspect,s.zoom,-s.zoom,0.1,600);
      camera.position.set(18,20,18); camera.lookAt(0,0,0);
      s.camera=camera;

      // ── Scene ──
      const scene=new T.Scene();
      scene.fog=new T.FogExp2(0x01010a,0.005);
      s.scene=scene;

      // ── Try bloom post-processing ──
      try {
        const [ecMod,rpMod,ubpMod] = await Promise.all([
          import("three/examples/jsm/postprocessing/EffectComposer.js" as any),
          import("three/examples/jsm/postprocessing/RenderPass.js" as any),
          import("three/examples/jsm/postprocessing/UnrealBloomPass.js" as any),
        ]);
        const comp = new ecMod.EffectComposer(renderer);
        comp.addPass(new rpMod.RenderPass(scene,camera));
        const bloom = new ubpMod.UnrealBloomPass(new T.Vector2(w,h),1.4,0.5,0.1);
        comp.addPass(bloom);
        s.composer=comp;
      } catch(_) { /* Bloom not available — fallback to high emissive */ }

      // ── Lighting ──
      scene.add(new T.AmbientLight(0xffffff,0.9));
      const sun=new T.DirectionalLight(0xc8d8ff,1.8);
      sun.position.set(14,24,12); sun.castShadow=true;
      sun.shadow.mapSize.width=2048; sun.shadow.mapSize.height=2048;
      sun.shadow.camera.near=1; sun.shadow.camera.far=90;
      sun.shadow.camera.left=-35; sun.shadow.camera.right=35;
      sun.shadow.camera.top=35; sun.shadow.camera.bottom=-35;
      scene.add(sun);
      const fill=new T.DirectionalLight(0x3355aa,0.45);
      fill.position.set(-12,8,-10); scene.add(fill);
      const coreLight=new T.PointLight(0x3355ff,14,25,2);
      coreLight.position.set(0,5,0); scene.add(coreLight);
      s.coreLight=coreLight;

      // ── Ground ──
      const groundMat=new T.MeshStandardMaterial({color:0x04040f,roughness:0.9,metalness:0.1});
      const ground=new T.Mesh(new T.PlaneGeometry(100,100),groundMat);
      ground.rotation.x=-Math.PI/2; ground.position.y=-0.3; scene.add(ground);
      const grid=new T.GridHelper(100,50,0x151545,0x0a0a2a);
      grid.position.y=-0.29; scene.add(grid);

      // ── Platform ──
      const platMat=new T.MeshStandardMaterial({color:0x0c0c22,roughness:0.4,metalness:0.6});
      const plat=new T.Mesh(new T.BoxGeometry(34,0.35,26),platMat);
      plat.position.set(0,-0.17,0); plat.receiveShadow=true; scene.add(plat);
      // Platform glow edges
      const egMat=(c:number)=>new T.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:3,roughness:0.2,metalness:0.8});
      [[0,-13,34.2,0.12],[0,13,34.2,0.12],[-17,0,0.12,26.2],[17,0,0.12,26.2]].forEach(([x,z,pw,pd])=>{
        const e=new T.Mesh(new T.BoxGeometry(pw,0.14,pd),egMat(0x1a1a55));
        e.position.set(x,0.03,z); scene.add(e);
      });
      // Roads
      [[0,0,18,0.9],[0,0,0.9,24]].forEach(([x,z,pw,pd])=>{
        const rm=new T.Mesh(new T.BoxGeometry(pw,0.1,pd),new T.MeshStandardMaterial({color:0x080820,roughness:0.8}));
        rm.position.set(x,0.07,z); scene.add(rm);
      });
      const roadGeo=(pw:number,pd:number)=>new T.BoxGeometry(pw,0.11,pd);
      const roadGlowMat=new T.MeshStandardMaterial({color:0x1a33aa,emissive:0x1a33aa,emissiveIntensity:2.5,transparent:true,opacity:0.55});
      [[0,0,18,0.1],[0,0,0.1,24]].forEach(([x,z,pw,pd])=>{
        const r=new T.Mesh(roadGeo(pw,pd),roadGlowMat);
        r.position.set(x,0.11,z); scene.add(r);
      });

      // ── Zones ──
      ZONES.forEach(zone=>{
        const zw=zone.w*2, zd=zone.d*2;
        const stdMat=(c:number,em=0,ei=0)=>new T.MeshStandardMaterial({color:c,roughness:0.5,metalness:0.4,emissive:em||c,emissiveIntensity:ei});

        // Floor
        const floor=new T.Mesh(new T.BoxGeometry(zw,0.16,zd),stdMat(zone.floorColor));
        floor.position.set(zone.cx,0.1,zone.cz); floor.receiveShadow=true; scene.add(floor);

        // Inner glow panels
        [0.9,0.7].forEach((sc,i)=>{
          const gp=new T.Mesh(new T.BoxGeometry(zw*sc,0.02,zd*sc),
            new T.MeshStandardMaterial({color:zone.trim,emissive:zone.trim,emissiveIntensity:0.35*(1-i*0.3),transparent:true,opacity:0.2}));
          gp.position.set(zone.cx,0.19,zone.cz); scene.add(gp);
        });

        // Glowing border
        const bMat=new T.MeshStandardMaterial({color:zone.trim,emissive:zone.trim,emissiveIntensity:4.0,roughness:0.1});
        [[0,-zone.d,zw+0.18,0.1],[0,zone.d,zw+0.18,0.1],[-zone.w,0,0.1,zd],[zone.w,0,0.1,zd]].forEach(([dx,dz,bw,bd])=>{
          const bar=new T.Mesh(new T.BoxGeometry(bw,0.22,bd),bMat);
          bar.position.set(zone.cx+(dx as number),0.24,zone.cz+(dz as number)); scene.add(bar);
        });

        // Corner posts with glowing caps
        [[-1,1],[1,1],[1,-1],[-1,-1]].forEach(([sx,sz])=>{
          const post=new T.Mesh(new T.CylinderGeometry(0.055,0.055,0.5,8),stdMat(0x1a1a38));
          post.position.set(zone.cx+sx*zone.w,0.27,zone.cz+sz*zone.d); scene.add(post);
          const cap=new T.Mesh(new T.SphereGeometry(0.1,10,10),bMat);
          cap.position.set(zone.cx+sx*zone.w,0.56,zone.cz+sz*zone.d); scene.add(cap);
        });

        // Zone light
        const zl=new T.PointLight(zone.light,7,14,2);
        zl.position.set(zone.cx,4,zone.cz); scene.add(zl);
        s.zoneLights.push({light:zl,base:7});

        // Building
        buildZoneTower(T,scene,zone);

        // Workstation per slot
        zone.slots.forEach(([dx,dz])=>{
          const wx=zone.cx+dx, wz=zone.cz+dz;
          const dkMat=new T.MeshStandardMaterial({color:0x14142c,roughness:0.3,metalness:0.7});
          const desk=new T.Mesh(new T.BoxGeometry(1.1,0.07,0.72),dkMat);
          desk.position.set(wx,0.5,wz-0.05); desk.castShadow=true; scene.add(desk);
          [[-0.48,-0.28],[0.48,-0.28],[-0.48,0.28],[0.48,0.28]].forEach(([lx,lz])=>{
            const leg=new T.Mesh(new T.BoxGeometry(0.04,0.38,0.04),new T.MeshStandardMaterial({color:0x0d0d20}));
            leg.position.set(wx+lx,0.31,wz-0.05+lz); scene.add(leg);
          });
          const scMat=new T.MeshStandardMaterial({color:zone.trim,emissive:zone.trim,emissiveIntensity:1.4,roughness:0.1});
          const sc=new T.Mesh(new T.BoxGeometry(0.58,0.4,0.03),scMat);
          sc.position.set(wx,0.78,wz-0.36); scene.add(sc);
          const bz=new T.Mesh(new T.BoxGeometry(0.64,0.46,0.025),new T.MeshStandardMaterial({color:0x111124,roughness:0.4,metalness:0.8}));
          bz.position.set(wx,0.78,wz-0.373); scene.add(bz);
          const scLight=new T.PointLight(zone.light,1.5,2,2);
          scLight.position.set(wx,0.78,wz-0.34); scene.add(scLight);
          const chairMat=new T.MeshStandardMaterial({color:0x161630,roughness:0.6,metalness:0.3});
          const chairSeat0=new T.Mesh(new T.BoxGeometry(0.5,0.04,0.45),chairMat); chairSeat0.position.set(wx,0.35,wz+0.5); scene.add(chairSeat0);
          const ch=new T.Mesh(new T.BoxGeometry(0.5,0.04,0.45),chairMat); ch.position.set(wx,0.35,wz+0.5); scene.add(ch);
          const cb=new T.Mesh(new T.BoxGeometry(0.5,0.44,0.035),chairMat); cb.position.set(wx,0.6,wz+0.73); scene.add(cb);
        });

        // Trees
        [[zone.cx-zone.w+0.7,zone.cz-zone.d+0.7],[zone.cx+zone.w-0.7,zone.cz-zone.d+0.7],
         [zone.cx-zone.w+0.7,zone.cz+zone.d-0.7],[zone.cx+zone.w-0.7,zone.cz+zone.d-0.7]
        ].forEach(([tx,tz])=>addTree(T,scene,tx,0.18,tz,0.62,zone.trim));

        // Zone sign
        const signMat=new T.MeshStandardMaterial({color:zone.trim,emissive:zone.trim,emissiveIntensity:3.5,roughness:0.1});
        const sg=new T.Mesh(new T.BoxGeometry(2.4,0.32,0.07),signMat);
        sg.position.set(zone.cx,0.58,zone.cz+zone.d+0.12); scene.add(sg);
        const sgPost0=new T.Mesh(new T.BoxGeometry(0.04,0.52,0.04),new T.MeshStandardMaterial({color:0x22224a})); sgPost0.position.set(zone.cx,0.28,zone.cz+zone.d+0.12); scene.add(sgPost0);
        const sp=new T.Mesh(new T.BoxGeometry(0.04,0.52,0.04),new T.MeshStandardMaterial({color:0x22224a}));
        sp.position.set(zone.cx,0.28,zone.cz+zone.d+0.12); scene.add(sp);
      });

      // ── Orchestrator core ──
      buildOrchestrator(T,scene,s);

      // ── Cyberpunk agent figures ──
      agents.forEach(agent=>{
        const zone=ZONES.find(z=>z.id===agent.category); if(!zone) return;
        const agentsInZone=agents.filter(a=>a.category===agent.category);
        const idx=agentsInZone.indexOf(agent);
        const slot=zone.slots[idx]??zone.slots[zone.slots.length-1];
        const wx=zone.cx+slot[0], wz=zone.cz+slot[1]+0.7, wy=0.18;

        const group=new T.Group();
        group.position.set(wx,wy,wz);
        scene.add(group);
        s.agentGroups[agent.id]=group;
        s.agentWorldPos.push({id:agent.id,wx,wy:wy+1.1,wz});

        const parts=buildCyberpunkAgent(T,group,zone.trim);
        s.agentParts[agent.id]=parts;

        // Category-specific interaction props
        buildCategoryProps(T,scene,agent.category,zone.trim,wx,wz,agent.id,s.catObjects);

        // Selection ring (scaled for larger agent)
        const selRingMat=new T.MeshStandardMaterial({color:zone.trim,emissive:zone.trim,emissiveIntensity:4,transparent:true,opacity:0});
        const selRing=new T.Mesh(new T.TorusGeometry(0.55,0.055,8,32),selRingMat);
        selRing.rotation.x=Math.PI/2; selRing.position.y=0.01; group.add(selRing);
        (group as any)._ring=selRing; (group as any)._ringMat=selRingMat;

        // Click target (taller for bigger agent)
        const hit=new T.Mesh(new T.CylinderGeometry(0.52,0.52,2.1,10),new T.MeshBasicMaterial({visible:false}));
        hit.position.y=0.9; group.add(hit);
        (hit as any)._agentId=agent.id;
        s.agentHits.push({mesh:hit,id:agent.id});
      });

      // ── Connection rays core → zones ──
      ZONES.forEach(zone=>{
        const len=Math.sqrt(zone.cx**2+zone.cz**2);
        const angle=Math.atan2(zone.cz,zone.cx);
        const ray=new T.Mesh(
          new T.BoxGeometry(0.06,0.06,len-2.5),
          new T.MeshStandardMaterial({color:zone.trim,emissive:zone.trim,emissiveIntensity:2.5,transparent:true,opacity:0.4})
        );
        ray.position.set(zone.cx/2,0.14,zone.cz/2);
        ray.rotation.y=-angle; scene.add(ray);

        // Data packets along path
        for(let p=0;p<4;p++){
          const packMat=new T.MeshStandardMaterial({color:zone.trim,emissive:zone.trim,emissiveIntensity:5});
          const pack=new T.Mesh(new T.SphereGeometry(0.055,8,8),packMat);
          scene.add(pack);
          const startT=p/4;
          const reverse=p%2===0;
          s.dataPackets.push({
            mesh:pack, t:startT, speed:0.006+Math.random()*0.006,
            sx:0,sy:0.5,sz:0, ex:zone.cx,ey:0.5,ez:zone.cz, reverse
          });
        }
      });

      // ── Animation loop ──
      let t=0;
      function animate(){
        if(s.cancelled) return;
        s.frame=requestAnimationFrame(animate);
        t+=0.016;

        // Core
        if(s.coreSphere){ s.coreSphere.rotation.y=t*0.35; s.coreSphere.rotation.x=Math.sin(t*0.2)*0.1; }
        s.coreRings.forEach((r,i)=>{ r.rotation.z=t*(0.28+i*0.09); r.rotation.x=t*(0.18+i*0.07); });
        if(s.coreLight) s.coreLight.intensity=12+Math.sin(t*2.5)*4;
        s.coreNodes.forEach((n,i)=>{
          const a=t*0.4+i*(Math.PI*2/s.coreNodes.length);
          n.position.x=Math.cos(a)*1.8; n.position.z=Math.sin(a)*1.8; n.position.y=2.2+Math.sin(t*1.2+i)*0.3;
        });

        // Zone lights
        s.zoneLights.forEach(({light,base},i)=>{ light.intensity=base+Math.sin(t*1.5+i*1.1)*2; });

        // Agent animations
        agents.forEach((agent,i)=>{
          const parts=s.agentParts[agent.id]; if(!parts) return;
          const isSel=agent.id===selectedId;
          if(parts.halo) { parts.halo.rotation.z=t*1.2+i; parts.halo.position.y=0.96+Math.sin(t*2+i)*0.04; }
          if(parts.visor){ const vi=isSel?3.5:1.5; parts.visor.material.emissiveIntensity=vi+Math.sin(t*3+i)*0.5; }
          if(parts.body) { parts.body.position.y=0.55*1.7+Math.sin(t*1.8+i*0.8)*0.04; }
          if(parts.light){ parts.light.intensity=(isSel?4:2)+Math.sin(t*2+i)*0.8; }
        });

        // Category object animations
        s.catObjects.forEach(obj=>{
          const {type,mesh,phase,baseY}=obj;
          if(!mesh) return;
          const isSel=obj.agentId===selectedId;
          const speedMul=isSel?1.6:1.0;
          if(type==="float"){
            mesh.position.y=baseY+Math.sin(t*1.4*speedMul+phase)*0.08;
          } else if(type==="pulse"){
            const sc=1+Math.sin(t*3*speedMul+phase)*0.15;
            mesh.scale.set(sc,sc,sc);
            mesh.material.emissiveIntensity=(isSel?6:4)+Math.sin(t*4+phase)*2;
          } else if(type==="scan"){
            // Scan beam sweeps up and down across the document
            mesh.position.y=baseY+Math.sin(t*1.8*speedMul+phase)*0.28;
          } else if(type==="ticket"){
            // Tickets drift up then reset
            mesh.position.y=baseY+((t*0.18+phase)%1.0)*0.6;
            mesh.position.x+=Math.sin(t*2+phase)*0.002;
            mesh.material.opacity=0.3+0.7*(1-((t*0.18+phase)%1.0));
          } else if(type==="doc"){
            mesh.position.y=baseY+Math.sin(t*1.1*speedMul+phase)*0.06;
            mesh.rotation.z=Math.sin(t*0.7+phase)*0.08;
          } else if(type==="chart_bar"){
            // Bars grow/shrink dynamically
            const sc=0.6+0.5*Math.abs(Math.sin(t*0.9*speedMul+phase));
            mesh.scale.y=sc;
            mesh.position.y=baseY+sc*(mesh.geometry.parameters?.height??0.3)/2;
          } else if(type==="spin"){
            mesh.rotation.y=t*2*speedMul+phase;
            mesh.rotation.x=t*1.3*speedMul;
          } else if(type==="blink"){
            mesh.material.opacity=(Math.sin(t*4+phase)>0)?1:0;
          } else if(type==="pipeline"){
            // Pipeline fills left-to-right
            const fill=0.1+0.9*((Math.sin(t*0.4+phase)*0.5+0.5));
            mesh.scale.x=fill;
          }
        });

        // Data packets
        s.dataPackets.forEach(p=>{
          p.t+=p.speed;
          if(p.t>1){ p.t-=1; p.reverse=!p.reverse; }
          const progress=p.reverse?1-p.t:p.t;
          // Bezier arc (quadratic: rises in middle)
          const mt=1-progress, qt=progress;
          const midY=2.8;
          p.mesh.position.x=mt*p.sx+qt*p.ex;
          p.mesh.position.y=mt*mt*p.sy+2*mt*qt*midY+qt*qt*p.ey;
          p.mesh.position.z=mt*p.sz+qt*p.ez;
        });

        // Communication beam lifecycle
        s.nextCommTime-=0.016;
        if(s.nextCommTime<=0 && agents.length>=2){
          s.nextCommTime=5+Math.random()*4;
          // Pick two agents from different zones
          const a=agents[Math.floor(Math.random()*agents.length)];
          const pool=agents.filter(ag=>ag.category!==a.category);
          if(pool.length>0){
            const b=pool[Math.floor(Math.random()*pool.length)];
            const posA=s.agentWorldPos.find(p=>p.id===a.id);
            const posB=s.agentWorldPos.find(p=>p.id===b.id);
            if(posA&&posB){
              if(s.commBeam?.line) scene.remove(s.commBeam.line);
              const pts=[new T.Vector3(posA.wx,posA.wy-0.2,posA.wz),new T.Vector3(posB.wx,posB.wy-0.2,posB.wz)];
              const geo=new T.BufferGeometry().setFromPoints(pts);
              const zoneA=ZONES.find(z=>z.id===a.category);
              const mat=new T.LineBasicMaterial({color:zoneA?.trim??0x6366f1,linewidth:2});
              const line=new T.Line(geo,mat);
              scene.add(line);
              s.commBeam={line,age:0,maxAge:3.5,aId:a.id,bId:b.id};
              setCommInfo({aName:a.name,bName:b.name});
            }
          }
        }
        if(s.commBeam){
          s.commBeam.age+=0.016;
          if(s.commBeam.age>s.commBeam.maxAge){
            scene.remove(s.commBeam.line);
            s.commBeam=null;
            setCommInfo(null);
          }
        }

        // Camera
        s.camera.position.x+=(s.camTarget.x+18-s.camera.position.x)*0.07;
        s.camera.position.z+=(s.camTarget.z+18-s.camera.position.z)*0.07;
        s.camera.lookAt(s.camTarget.x,0,s.camTarget.z);

        if(s.composer) { s.composer.render(); } else { renderer.render(scene,camera); }

        // HTML labels
        setLabels(s.agentWorldPos.map(a=>{
          const {x,y}=project(T,camera,renderer,a.wx,a.wy,a.wz);
          const ag=agents.find(ag=>ag.id===a.id);
          return {id:a.id,name:ag?.name??"",cat:ag?.category??"general",sx:x,sy:y};
        }));
        setZoneLabels(ZONES.map(z=>{
          const {x,y}=project(T,camera,renderer,z.cx,0.62,z.cz+z.d+0.15);
          return {id:z.id,label:z.label,cat:z.id,sx:x,sy:y};
        }));
        // Update selected agent screen pos
        if(selectedId){
          const pos=s.agentWorldPos.find(p=>p.id===selectedId);
          if(pos){
            const {x,y}=project(T,camera,renderer,pos.wx,pos.wy,pos.wz);
            setSelectedPos({x,y});
          }
        } else {
          setSelectedPos(null);
        }
      }
      animate();

      // ── Events ──
      const onClick=(e:MouseEvent)=>{
        const rect=mount.getBoundingClientRect();
        const ray=new T.Raycaster();
        ray.setFromCamera(new T.Vector2(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1),camera);
        const hits=ray.intersectObjects(s.agentHits.map(h=>h.mesh));
        if(hits.length>0){ const id=(hits[0].object as any)._agentId; if(id) onSelectAgent(id); }
      };
      const onMove=(e:MouseEvent)=>{
        if(s.pan.active) return;
        const rect=mount.getBoundingClientRect();
        const ray=new T.Raycaster();
        ray.setFromCamera(new T.Vector2(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1),camera);
        const hits=ray.intersectObjects(s.agentHits.map(h=>h.mesh));
        const hov=hits.length>0?(hits[0].object as any)._agentId??null:null;
        setHovered(hov); renderer.domElement.style.cursor=hov?"pointer":"grab";
      };
      const onDown=(e:MouseEvent)=>{
        if(e.button===1||e.button===2){ s.pan.active=true; s.pan.lx=e.clientX; s.pan.ly=e.clientY; s.pan.ox=s.camTarget.x; s.pan.oz=s.camTarget.z; renderer.domElement.style.cursor="grabbing"; }
      };
      const onUp=()=>{ s.pan.active=false; renderer.domElement.style.cursor="grab"; };
      const onPan=(e:MouseEvent)=>{
        if(!s.pan.active) return;
        const dx=(e.clientX-s.pan.lx)*0.045,dz=(e.clientY-s.pan.ly)*0.045;
        s.camTarget.x=Math.max(-10,Math.min(10,s.pan.ox-dx+dz));
        s.camTarget.z=Math.max(-10,Math.min(10,s.pan.oz+dx+dz));
      };
      const onWheel=(e:WheelEvent)=>{
        e.preventDefault();
        s.zoom=Math.max(4.5,Math.min(18,s.zoom*(e.deltaY>0?1.1:0.9)));
        const asp=renderer.domElement.clientWidth/renderer.domElement.clientHeight;
        camera.left=-s.zoom*asp; camera.right=s.zoom*asp; camera.top=s.zoom; camera.bottom=-s.zoom;
        camera.updateProjectionMatrix();
        if(s.composer) s.composer.setSize(renderer.domElement.clientWidth,renderer.domElement.clientHeight);
      };
      renderer.domElement.addEventListener("click",onClick);
      renderer.domElement.addEventListener("mousemove",onMove);
      renderer.domElement.addEventListener("mousedown",onDown);
      renderer.domElement.addEventListener("wheel",onWheel,{passive:false});
      renderer.domElement.addEventListener("contextmenu",e=>e.preventDefault());
      window.addEventListener("mouseup",onUp);
      window.addEventListener("mousemove",onPan);
      (renderer.domElement as any)._cleanup=()=>{
        renderer.domElement.removeEventListener("click",onClick);
        renderer.domElement.removeEventListener("mousemove",onMove);
        renderer.domElement.removeEventListener("mousedown",onDown);
        renderer.domElement.removeEventListener("wheel",onWheel);
        window.removeEventListener("mouseup",onUp);
        window.removeEventListener("mousemove",onPan);
      };
      const ro=new ResizeObserver(()=>{
        if(!mount||s.cancelled) return;
        const w2=mount.clientWidth,h2=mount.clientHeight;
        if(w2>0&&h2>0){
          renderer.setSize(w2,h2,false);
          const asp=w2/h2;
          camera.left=-s.zoom*asp; camera.right=s.zoom*asp; camera.top=s.zoom; camera.bottom=-s.zoom;
          camera.updateProjectionMatrix();
          if(s.composer) s.composer.setSize(w2,h2);
        }
      });
      ro.observe(mount);
      (renderer.domElement as any)._ro=ro;
      } catch(err:any) {
        console.error("[IsometricWorld] init error:", err);
        setInitError(String(err?.message ?? err));
      }
    }).catch((err:any)=>{
      console.error("[IsometricWorld] three.js load error:", err);
      setInitError("Impossible de charger Three.js : " + String(err?.message ?? err));
    });

    return ()=>{
      s.cancelled=true; cancelAnimationFrame(s.frame);
      if(activityRef.current) clearInterval(activityRef.current);
      const r=s.renderer;
      if(r){ (r.domElement as any)?._cleanup?.(); (r.domElement as any)?._ro?.disconnect(); r.dispose(); if(r.domElement?.parentNode) r.domElement.parentNode.removeChild(r.domElement); s.renderer=null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Selection rings
  useEffect(()=>{
    agents.forEach(agent=>{
      const group=stateRef.current.agentGroups?.[agent.id]; if(!group) return;
      const rm=group._ringMat; if(!rm) return;
      const sel=agent.id===selectedId,hov=agent.id===hovered;
      const acc=CAT_HEX[agent.category]??CAT_HEX.general;
      rm.opacity=sel?1:hov?0.55:0;
      rm.color.set(acc); rm.emissive?.set(acc);
    });
  },[selectedId,hovered,agents]);

  const shownLabels=labels.filter(l=>{
    if(!searchTerm) return true;
    const ag=agents.find(a=>a.id===l.id);
    return ag&&(ag.name.toLowerCase().includes(searchTerm.toLowerCase())||ag.category.includes(searchTerm.toLowerCase()));
  });

  const selAgent=selectedId?agents.find(a=>a.id===selectedId):null;

  if(initError) return (
    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#01010a",gap:12}}>
      <div style={{fontSize:13,color:"#ef4444",fontFamily:"monospace",maxWidth:500,textAlign:"center",padding:"0 24px"}}>
        ⚠️ Erreur d&apos;initialisation du monde 3D
      </div>
      <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",fontFamily:"monospace",maxWidth:500,textAlign:"center",padding:"0 24px",wordBreak:"break-all"}}>
        {initError}
      </div>
    </div>
  );

  return (
    <div ref={mountRef} style={{width:"100%",height:"100%",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:10}}>
        {/* Zone signs */}
        {zoneLabels.map(z=>(
          <div key={z.id} style={{
            position:"absolute",left:z.sx,top:z.sy,transform:"translate(-50%,-50%)",
            background:`${CAT_HEX[z.cat]}22`,border:`1px solid ${CAT_HEX[z.cat]}cc`,
            borderRadius:4,padding:"2px 10px",fontSize:9,fontWeight:800,color:CAT_HEX[z.cat],
            textTransform:"uppercase",letterSpacing:"0.08em",whiteSpace:"nowrap",
            backdropFilter:"blur(6px)",textShadow:`0 0 10px ${CAT_HEX[z.cat]}`,
          }}>{z.label}</div>
        ))}
        {/* Agent name labels */}
        {shownLabels.map(l=>{
          const sel=l.id===selectedId,hov=l.id===hovered;
          const col=CAT_HEX[l.cat]??"#8b5cf6";
          return (
            <div key={l.id} style={{
              position:"absolute",left:l.sx,top:l.sy,transform:"translate(-50%,-140%)",
              background:sel?`${col}28`:"rgba(4,4,20,0.88)",
              border:`1px solid ${sel?col:"rgba(255,255,255,0.1)"}`,
              borderRadius:4,padding:"2px 8px",fontSize:9,fontWeight:sel?700:500,
              color:sel?col:"rgba(255,255,255,0.75)",whiteSpace:"nowrap",
              opacity:hov||sel?1:0.6,transition:"opacity .2s",backdropFilter:"blur(4px)",
              textShadow:sel?`0 0 8px ${col}`:"none",
            }}>{l.name}</div>
          );
        })}

        {/* ── Live Activity Window ── */}
        {selAgent&&selectedPos&&(
          <div style={{
            position:"absolute",
            left:Math.max(8,Math.min(selectedPos.x-140,(mountRef.current?.clientWidth??800)-290)),
            top:Math.max(8,selectedPos.y-230),
            width:280,pointerEvents:"auto",
            background:"rgba(4,4,18,0.96)",
            border:`1px solid ${CAT_HEX[selAgent.category]??'#6366f1'}88`,
            borderRadius:8,overflow:"hidden",
            boxShadow:`0 0 24px ${CAT_HEX[selAgent.category]??'#6366f1'}30`,
            backdropFilter:"blur(12px)",
          }}>
            {/* Header */}
            <div style={{
              display:"flex",alignItems:"center",gap:8,padding:"8px 12px",
              borderBottom:`1px solid ${CAT_HEX[selAgent.category]??'#6366f1'}44`,
              background:`${CAT_HEX[selAgent.category]??'#6366f1'}12`,
            }}>
              <span style={{width:7,height:7,borderRadius:"50%",background:CAT_HEX[selAgent.category]??"#6366f1",boxShadow:`0 0 6px ${CAT_HEX[selAgent.category]??'#6366f1'}`,flexShrink:0}} className="animate-pulse"/>
              <span style={{fontSize:11,fontWeight:700,color:"#e8e8f8",flex:1}}>{selAgent.name}</span>
              <span style={{fontSize:9,color:CAT_HEX[selAgent.category]??"#6366f1",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>{selAgent.category}</span>
            </div>
            {/* Status bar */}
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
              <span style={{fontSize:9,color:"rgba(255,255,255,0.4)"}}>Modèle</span>
              <span style={{fontSize:9,color:"rgba(255,255,255,0.7)",fontFamily:"monospace"}}>{selAgent.model??"-"}</span>
              <span style={{marginLeft:"auto",fontSize:9,color:"rgba(52,211,153,0.9)",display:"flex",alignItems:"center",gap:3}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:"#34d399",display:"inline-block"}} className="animate-pulse"/>
                En ligne
              </span>
            </div>
            {/* Activity log */}
            <div style={{padding:"8px 12px",minHeight:90,maxHeight:120,overflowY:"auto"}}>
              {activityLog.length===0?(
                <div style={{display:"flex",alignItems:"center",gap:6,color:"rgba(255,255,255,0.3)",fontSize:10}}>
                  <span style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${CAT_HEX[selAgent.category]??'#6366f1'}`,borderTopColor:"transparent",display:"inline-block"}} className="animate-spin"/>
                  Connexion à l&apos;agent…
                </div>
              ) : activityLog.map((log,i)=>(
                <div key={i} style={{fontSize:9,fontFamily:"monospace",color:i===activityLog.length-1?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.38)",marginBottom:3,lineHeight:1.4}}>
                  {log}
                </div>
              ))}
            </div>
            {/* Action buttons */}
            <div style={{display:"flex",gap:6,padding:"6px 12px 10px",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
              <button style={{flex:1,padding:"5px",borderRadius:5,border:`1px solid ${CAT_HEX[selAgent.category]??'#6366f1'}55`,background:`${CAT_HEX[selAgent.category]??'#6366f1'}18`,color:CAT_HEX[selAgent.category]??"#6366f1",fontSize:10,fontWeight:600,cursor:"pointer"}}>
                Démarrer
              </button>
              <button style={{flex:1,padding:"5px",borderRadius:5,border:"1px solid rgba(255,255,255,0.12)",background:"transparent",color:"rgba(255,255,255,0.5)",fontSize:10,cursor:"pointer"}}>
                Logs
              </button>
            </div>
          </div>
        )}

        {/* ── Communication overlay ── */}
        {commInfo&&(
          <div style={{
            position:"absolute",bottom:44,left:"50%",transform:"translateX(-50%)",
            background:"rgba(4,4,18,0.88)",border:"1px solid rgba(99,102,241,0.45)",
            borderRadius:20,padding:"4px 16px",
            display:"flex",alignItems:"center",gap:8,
            backdropFilter:"blur(8px)",
          }}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#6366f1"}} className="animate-pulse"/>
            <span style={{fontSize:10,color:"rgba(255,255,255,0.65)"}}>
              <strong style={{color:"#a5b4fc"}}>{commInfo.aName}</strong>
              <span style={{margin:"0 6px",opacity:0.5}}>⇄</span>
              <strong style={{color:"#a5b4fc"}}>{commInfo.bName}</strong>
            </span>
            <span style={{fontSize:9,color:"rgba(99,102,241,0.7)"}}>Collaboration</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{position:"absolute",bottom:12,right:14,zIndex:20,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,pointerEvents:"none"}}>
        {["Clic → sélectionner","Molette → zoom","Clic droit → déplacer"].map(h=>(
          <span key={h} style={{fontSize:9,color:"rgba(255,255,255,0.18)"}}>{h}</span>
        ))}
      </div>
    </div>
  );
}

// ── Scene helpers ─────────────────────────────────────────────────────────────

function buildCyberpunkAgent(T:any, group:any, color:number) {
  const S=1.7; // scale multiplier vs previous version
  const std=(c:number,em=0,ei=0,rough=0.4,metal=0.8)=>
    new T.MeshStandardMaterial({color:c,emissive:em||c,emissiveIntensity:ei,roughness:rough,metalness:metal});
  const accent=new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:3.0,roughness:0.05,metalness:1.0});

  // ── Feet ──
  [-0.1,0.1].forEach(fx=>{
    const foot=new T.Mesh(new T.BoxGeometry(0.1*S,0.06*S,0.18*S),std(0x08081a));
    foot.position.set(fx*S,0.03*S,0.02*S); group.add(foot);
  });

  // ── Legs ──
  [-0.1,0.1].forEach(fx=>{
    const leg=new T.Mesh(new T.BoxGeometry(0.11*S,0.28*S,0.13*S),std(0x0c0c24,0,0,0.5,0.7));
    leg.position.set(fx*S,0.2*S,0); group.add(leg);
    // Knee joint glowing ring
    const knee=new T.Mesh(new T.TorusGeometry(0.065*S,0.018*S,6,12),accent);
    knee.position.set(fx*S,0.12*S,0); knee.rotation.x=Math.PI/2; group.add(knee);
  });

  // ── Waist belt ──
  const belt=new T.Mesh(new T.BoxGeometry(0.32*S,0.06*S,0.2*S),std(0x14143a,color,0.4,0.3,0.9));
  belt.position.set(0,0.35*S,0); group.add(belt);

  // ── Torso ──
  const body=new T.Mesh(new T.BoxGeometry(0.34*S,0.38*S,0.22*S),std(0x0e0e2e,0,0,0.3,0.85));
  body.position.set(0,0.55*S,0); body.castShadow=true; group.add(body);

  // ── Chest armor plates ──
  [[0,0.58*S,0.115*S,0.2*S,0.12*S],[0,0.46*S,0.115*S,0.14*S,0.07*S]].forEach(([x,y,z,w,h])=>{
    const pl=new T.Mesh(new T.BoxGeometry(w,h,0.03),std(0x1a1a40,0,0,0.2,0.95));
    pl.position.set(x,y,z); group.add(pl);
  });

  // ── Chest glow panel (core badge) ──
  const chestPanel=new T.Mesh(new T.BoxGeometry(0.12*S,0.08*S,0.025),accent);
  chestPanel.position.set(0,0.55*S,0.13*S); group.add(chestPanel);
  // Secondary sub-light strips
  [-0.1,0.1].forEach(sx=>{
    const strip=new T.Mesh(new T.BoxGeometry(0.025,0.14*S,0.022),accent);
    strip.position.set(sx*S,0.55*S,0.12*S); group.add(strip);
  });

  // ── Shoulder pauldrons (angular) ──
  [-0.22*S,0.22*S].forEach(sx=>{
    // Upper shoulder pad
    const sh=new T.Mesh(new T.BoxGeometry(0.14*S,0.12*S,0.24*S),std(0x0e0e28,0,0,0.25,0.9));
    sh.position.set(sx,0.65*S,0); group.add(sh);
    // Shoulder trim
    const shTrim=new T.Mesh(new T.BoxGeometry(0.15*S,0.03,0.25*S),accent);
    shTrim.position.set(sx,0.72*S,0); group.add(shTrim);
    // Arm upper
    const arm=new T.Mesh(new T.BoxGeometry(0.09*S,0.22*S,0.1*S),std(0x0c0c24,0,0,0.4,0.8));
    arm.position.set(sx,0.5*S,0); group.add(arm);
  });

  // ── Neck ──
  const neck=new T.Mesh(new T.CylinderGeometry(0.055*S,0.065*S,0.1*S,8),std(0x16163a,0,0,0.4,0.8));
  neck.position.set(0,0.77*S,0); group.add(neck);

  // ── Helmet (angular box + chamfer look) ──
  const helmMat=new T.MeshStandardMaterial({color:0x0a0a22,roughness:0.15,metalness:0.95});
  const helm=new T.Mesh(new T.BoxGeometry(0.3*S,0.26*S,0.28*S),helmMat);
  helm.position.set(0,0.9*S,0); helm.castShadow=true; group.add(helm);
  // Top ridge
  const topRidge=new T.Mesh(new T.BoxGeometry(0.08*S,0.06*S,0.28*S),std(0x1c1c40,0,0,0.2,1.0));
  topRidge.position.set(0,1.04*S,0); group.add(topRidge);
  // Side cheek plates
  [-0.17*S,0.17*S].forEach(hx=>{
    const cheek=new T.Mesh(new T.BoxGeometry(0.04,0.14*S,0.22*S),std(0x141432,0,0,0.2,0.95));
    cheek.position.set(hx,0.87*S,0); group.add(cheek);
  });

  // ── Visor (glowing full-width slit) ──
  const visorMat=new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:3.5,roughness:0.0,metalness:1.0});
  const visor=new T.Mesh(new T.BoxGeometry(0.28*S,0.055*S,0.025),visorMat);
  visor.position.set(0,0.9*S,0.152*S); group.add(visor);
  // Visor glow rim
  const visorRim=new T.Mesh(new T.BoxGeometry(0.3*S,0.075*S,0.015),
    new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.5,roughness:0.1,transparent:true,opacity:0.4}));
  visorRim.position.set(0,0.9*S,0.148*S); group.add(visorRim);

  // ── Holographic crown halo ──
  const haloMat=new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:4.0,roughness:0.0,transparent:true,opacity:0.7});
  const halo=new T.Mesh(new T.TorusGeometry(0.28*S,0.018,8,40),haloMat);
  halo.rotation.x=Math.PI/2; halo.position.set(0,1.15*S,0); group.add(halo);
  // Inner halo ring
  const halo2=new T.Mesh(new T.TorusGeometry(0.18*S,0.01,6,32),haloMat);
  halo2.rotation.x=Math.PI/2; halo2.position.set(0,1.18*S,0); group.add(halo2);

  // ── Agent point light ──
  const light=new T.PointLight(color,3.5,3.5,2);
  light.position.set(0,0.9*S,0); group.add(light);

  return {halo,visor,body,light};
}

// ── Category-specific interaction props ──────────────────────────────────────
function buildCategoryProps(
  T:any, scene:any, category:string, trim:number,
  wx:number, wz:number, agentId:string,
  catObjects: { type:string; mesh:any; phase:number; baseY:number; agentId:string }[]
) {
  const accentMat=(c:number,ei=3.5)=>new T.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:ei,roughness:0.05,metalness:1.0});
  const phase=Math.random()*Math.PI*2;

  if(category==="helpdesk") {
    // Floating alert ticket screen
    const screen=new T.Mesh(new T.BoxGeometry(0.5,0.32,0.025),
      new T.MeshStandardMaterial({color:trim,emissive:trim,emissiveIntensity:0.6,roughness:0.1,transparent:true,opacity:0.85}));
    screen.position.set(wx,1.85,wz-0.3); scene.add(screen);
    catObjects.push({type:"float",mesh:screen,phase,baseY:1.85,agentId});
    // Alert beacon on top
    const beacon=new T.Mesh(new T.SphereGeometry(0.07,8,8),accentMat(trim,5));
    beacon.position.set(wx,2.3,wz-0.3); scene.add(beacon);
    catObjects.push({type:"pulse",mesh:beacon,phase,baseY:2.3,agentId});
    // Ticket packets flying
    for(let i=0;i<2;i++){
      const pkt=new T.Mesh(new T.BoxGeometry(0.12,0.08,0.01),accentMat(trim,4));
      pkt.position.set(wx+(i%2===0?0.3:-0.3),1.4+i*0.2,wz); scene.add(pkt);
      catObjects.push({type:"ticket",mesh:pkt,phase:phase+i*1.5,baseY:1.4+i*0.2,agentId});
    }

  } else if(category==="hr") {
    // Document pages floating
    for(let i=0;i<3;i++){
      const doc=new T.Mesh(new T.BoxGeometry(0.32,0.42,0.01),
        new T.MeshStandardMaterial({color:0xfaf0e0,emissive:trim,emissiveIntensity:0.3,roughness:0.6,transparent:true,opacity:0.8}));
      doc.position.set(wx+(i-1)*0.18,1.6+i*0.12,wz);
      doc.rotation.z=(i-1)*0.18; scene.add(doc);
      catObjects.push({type:"doc",mesh:doc,phase:phase+i*0.7,baseY:1.6+i*0.12,agentId});
    }
    // Handshake glowing orb
    const orb=new T.Mesh(new T.SphereGeometry(0.1,12,12),accentMat(trim));
    orb.position.set(wx,2.15,wz); scene.add(orb);
    catObjects.push({type:"pulse",mesh:orb,phase,baseY:2.15,agentId});

  } else if(category==="documents") {
    // Scanner beam (horizontal bar sweeping left-right)
    const beam=new T.Mesh(new T.BoxGeometry(0.8,0.015,0.01),accentMat(trim,5));
    beam.position.set(wx,1.62,wz-0.2); scene.add(beam);
    catObjects.push({type:"scan",mesh:beam,phase,baseY:1.62,agentId});
    // Document being scanned
    const doc=new T.Mesh(new T.BoxGeometry(0.52,0.65,0.01),
      new T.MeshStandardMaterial({color:0xf0f0ff,emissive:trim,emissiveIntensity:0.15,roughness:0.5,transparent:true,opacity:0.75}));
    doc.position.set(wx,1.85,wz-0.22); scene.add(doc);
    catObjects.push({type:"float",mesh:doc,phase:phase+0.5,baseY:1.85,agentId});

  } else if(category==="sales") {
    // Holographic bar chart (3 bars)
    for(let i=0;i<3;i++){
      const h=0.2+i*0.15;
      const bar=new T.Mesh(new T.BoxGeometry(0.12,h,0.08),accentMat(trim,2.5));
      bar.position.set(wx+(i-1)*0.18,1.5+h/2,wz-0.2); scene.add(bar);
      catObjects.push({type:"chart_bar",mesh:bar,phase:phase+i*0.8,baseY:1.5,agentId});
    }
    // Rising trend arrow
    const arrow=new T.Mesh(new T.ConeGeometry(0.07,0.2,6),accentMat(trim,4));
    arrow.position.set(wx+0.3,2.1,wz-0.2); scene.add(arrow);
    catObjects.push({type:"float",mesh:arrow,phase:phase+1,baseY:2.1,agentId});

  } else if(category==="support") {
    // Chat bubble (rounded box + tail)
    const bubble=new T.Mesh(new T.BoxGeometry(0.5,0.28,0.02),
      new T.MeshStandardMaterial({color:trim,emissive:trim,emissiveIntensity:0.5,roughness:0.2,transparent:true,opacity:0.8}));
    bubble.position.set(wx,1.9,wz-0.25); scene.add(bubble);
    catObjects.push({type:"float",mesh:bubble,phase,baseY:1.9,agentId});
    // Satisfaction star
    const star=new T.Mesh(new T.OctahedronGeometry(0.09),accentMat(trim,5));
    star.position.set(wx,2.3,wz-0.2); scene.add(star);
    catObjects.push({type:"spin",mesh:star,phase,baseY:2.3,agentId});

  } else if(category==="devops") {
    // Terminal screen
    const terminal=new T.Mesh(new T.BoxGeometry(0.52,0.36,0.02),
      new T.MeshStandardMaterial({color:0x001100,emissive:trim,emissiveIntensity:0.3,roughness:0.1}));
    terminal.position.set(wx,1.75,wz-0.28); scene.add(terminal);
    catObjects.push({type:"float",mesh:terminal,phase:phase+0.3,baseY:1.75,agentId});
    // Code cursor blink
    const cursor=new T.Mesh(new T.BoxGeometry(0.04,0.06,0.01),accentMat(trim,6));
    cursor.position.set(wx-0.1,1.65,wz-0.27); scene.add(cursor);
    catObjects.push({type:"blink",mesh:cursor,phase,baseY:1.65,agentId});
    // Pipeline progress bar
    const pipe=new T.Mesh(new T.BoxGeometry(0.45,0.04,0.01),
      new T.MeshStandardMaterial({color:trim,emissive:trim,emissiveIntensity:2.0,transparent:true,opacity:0.6}));
    pipe.position.set(wx,1.95,wz-0.27); scene.add(pipe);
    catObjects.push({type:"pipeline",mesh:pipe,phase,baseY:1.95,agentId});
  }
}

function addTree(T:any,scene:any,x:number,y:number,z:number,scale:number,accentColor:number){
  const s=scale;
  const trunk=new T.Mesh(new T.CylinderGeometry(0.055*s,0.085*s,0.52*s,8),new T.MeshStandardMaterial({color:0x2a180a,roughness:0.9}));
  trunk.position.set(x,y+0.26*s,z); trunk.castShadow=true; scene.add(trunk);
  [[0.36,0.44,0.18],[0.28,0.46,0.35],[0.2,0.44,0.52]].forEach(([rx,ht,yOff],i)=>{
    const cone=new T.Mesh(new T.ConeGeometry(rx*s,ht*s,9),
      new T.MeshStandardMaterial({color:[0x0e5c1a,0x1a8030,0x22a040][i],emissive:[0x0e5c1a,0x1a8030,0x22a040][i],emissiveIntensity:0.2,roughness:0.8}));
    cone.position.set(x,y+yOff*s,z); cone.castShadow=true; scene.add(cone);
  });
  const glow=new T.Mesh(new T.SphereGeometry(0.05*s,8,8),new T.MeshStandardMaterial({color:accentColor,emissive:accentColor,emissiveIntensity:3.0}));
  glow.position.set(x,y+0.04,z); scene.add(glow);
}

function buildZoneTower(T:any,scene:any,zone:ZoneDef){
  const bx=zone.cx-zone.w*0.52, bz=zone.cz-zone.d*0.52;
  const std=(c:number,em=0,ei=0)=>new T.MeshStandardMaterial({color:c,emissive:em||c,emissiveIntensity:ei,roughness:0.3,metalness:0.7});
  const trimMat=new T.MeshStandardMaterial({color:zone.trim,emissive:zone.trim,emissiveIntensity:3.5,roughness:0.1,metalness:1.0});

  // Foundation
  const base=new T.Mesh(new T.BoxGeometry(1.1,0.2,1.1),std(0x0e0e2a));
  base.position.set(bx,0.24,bz); scene.add(base);
  // Floors (5 floors)
  const flH=0.5;
  for(let i=0;i<5;i++){
    const w=0.85-i*0.08;
    const fl=new T.Mesh(new T.BoxGeometry(w,flH,w),std(0x101028,0,0));
    fl.position.set(bx,0.34+i*flH,bz); fl.castShadow=true; scene.add(fl);
    // Floor trim ring
    const ring=new T.Mesh(new T.BoxGeometry(w+0.05,0.045,w+0.05),trimMat);
    ring.position.set(bx,0.34+i*flH+flH/2,bz); scene.add(ring);
    // Windows
    if(i<4){
      [[1,0],[0,1],[-1,0],[0,-1]].forEach(([fx,fz])=>{
        const ww=0.3-i*0.03, wh=0.22;
        const wMat=new T.MeshStandardMaterial({color:zone.trim,emissive:zone.trim,emissiveIntensity:0.8+(i*0.2),roughness:0.1,transparent:true,opacity:0.7});
        const win=new T.Mesh(new T.BoxGeometry(ww,wh,0.028),wMat);
        const hw=(w+0.015)/2;
        win.position.set(bx+fx*hw,0.34+i*flH,bz+fz*hw);
        if(fx!==0) win.rotation.y=Math.PI/2;
        scene.add(win);
      });
    }
  }
  // Antenna
  const ant=new T.Mesh(new T.CylinderGeometry(0.018,0.018,1.1,6),std(0x2a2a44));
  ant.position.set(bx,0.34+5*flH+0.55,bz); scene.add(ant);
  const tip=new T.Mesh(new T.SphereGeometry(0.072,8,8),trimMat);
  tip.position.set(bx,0.34+5*flH+1.15,bz); scene.add(tip);
  // Tower light
  const tl=new T.PointLight(zone.light,3.5,5,2);
  tl.position.set(bx,0.34+5*flH+0.5,bz); scene.add(tl);
}

function buildOrchestrator(T:any,scene:any,s:any){
  const G=0xffd060; // gold accent
  const W=0xc8d8ff; // cold white
  const B=0x3355ff; // blue energy
  const std=(c:number,em=0,ei=0,rough=0.2,metal=0.95)=>
    new T.MeshStandardMaterial({color:c,emissive:em||c,emissiveIntensity:ei,roughness:rough,metalness:metal});
  const gold=(ei=4.0)=>std(G,G,ei,0.05,1.0);
  const blue=(ei=3.5)=>std(B,B,ei,0.05,1.0);

  // ── Throne platform (3 concentric octagonal tiers) ──
  [3.2,2.4,1.7].forEach((r,i)=>{
    const plat=new T.Mesh(new T.CylinderGeometry(r,r+0.2,0.32,8),std(0x08081e+i*0x020210));
    plat.position.set(0,0.16+i*0.36,0); plat.castShadow=true; scene.add(plat);
    const rim=new T.Mesh(new T.TorusGeometry(r+0.01,0.055,6,8),gold(3.5+i*0.5));
    rim.position.set(0,0.33+i*0.36,0); rim.rotation.x=Math.PI/2; scene.add(rim);
    // Throne corner pillars
    for(let n=0;n<8;n++){
      const a=n/8*Math.PI*2;
      const col=new T.Mesh(new T.CylinderGeometry(0.055,0.065,0.38+i*0.12,6),std(0x111130));
      col.position.set(Math.cos(a)*r,0.28+i*0.36,Math.sin(a)*r); scene.add(col);
      const cap=new T.Mesh(new T.SphereGeometry(0.07,8,8),gold());
      cap.position.set(Math.cos(a)*r,0.5+i*0.36,Math.sin(a)*r); scene.add(cap);
    }
  });

  // ── Ground halo rings ──
  [3.8,2.9].forEach((r,i)=>{
    const h=new T.Mesh(new T.TorusGeometry(r,0.04,6,64),
      new T.MeshStandardMaterial({color:G,emissive:G,emissiveIntensity:2.0+i,transparent:true,opacity:0.35+i*0.15}));
    h.rotation.x=Math.PI/2; scene.add(h);
  });

  // ── Central pedestal ──
  const ped=new T.Mesh(new T.CylinderGeometry(0.55,0.65,0.5,8),std(0x0d0d28));
  ped.position.set(0,1.24,0); scene.add(ped);
  const pedRim=new T.Mesh(new T.TorusGeometry(0.56,0.06,6,8),gold());
  pedRim.position.set(0,1.5,0); pedRim.rotation.x=Math.PI/2; scene.add(pedRim);

  // ╔══ ORCHESTRATEUR AVATAR (S=2.4) ══╗
  const S=2.4;
  const group=new T.Group(); group.position.set(0,1.5,0); scene.add(group);

  // Feet
  [-0.1,0.1].forEach(fx=>{
    const foot=new T.Mesh(new T.BoxGeometry(0.12*S,0.07*S,0.2*S),std(0x0a0a20));
    foot.position.set(fx*S,0.03*S,0.02*S); group.add(foot);
  });

  // Legs with gold knee joints
  [-0.1,0.1].forEach(fx=>{
    const leg=new T.Mesh(new T.BoxGeometry(0.13*S,0.32*S,0.15*S),std(0x0c0c28,0,0,0.4,0.85));
    leg.position.set(fx*S,0.22*S,0); group.add(leg);
    const knee=new T.Mesh(new T.TorusGeometry(0.075*S,0.02*S,6,12),gold());
    knee.position.set(fx*S,0.1*S,0); knee.rotation.x=Math.PI/2; group.add(knee);
  });

  // Waist / belt
  const belt=new T.Mesh(new T.BoxGeometry(0.38*S,0.08*S,0.24*S),std(0x16163c,G,0.6,0.2,0.95));
  belt.position.set(0,0.4*S,0); group.add(belt);

  // Torso — wider, imposing
  const body=new T.Mesh(new T.BoxGeometry(0.44*S,0.44*S,0.28*S),std(0x0b0b26,0,0,0.25,0.9));
  body.position.set(0,0.65*S,0); body.castShadow=true; group.add(body);
  s.coreSphere=body; // reuse for bob animation

  // Chest armor panels
  const chestMat=std(0x161640,0,0,0.15,0.98);
  [[0,0.7*S,0.155*S,0.28*S,0.16*S],[0,0.56*S,0.155*S,0.2*S,0.1*S]].forEach(([x,y,z,w,h])=>{
    const p=new T.Mesh(new T.BoxGeometry(w,h,0.02),chestMat);
    p.position.set(x,y,z); group.add(p);
  });

  // Gold chest badge — command core
  const badge=new T.Mesh(new T.BoxGeometry(0.15*S,0.1*S,0.022),gold(5));
  badge.position.set(0,0.68*S,0.16*S); group.add(badge);
  // Badge inner glow
  const badgeSub=new T.Mesh(new T.SphereGeometry(0.045*S,8,8),
    new T.MeshStandardMaterial({color:W,emissive:W,emissiveIntensity:6,roughness:0.0}));
  badgeSub.position.set(0,0.68*S,0.175*S); group.add(badgeSub);

  // Gold shoulder pauldrons (large, commanding)
  [-0.28*S,0.28*S].forEach(sx=>{
    // Main pad
    const sh=new T.Mesh(new T.BoxGeometry(0.18*S,0.16*S,0.3*S),std(0x0e0e2c,0,0,0.2,0.95));
    sh.position.set(sx,0.76*S,0); group.add(sh);
    // Gold trim top
    const shRim=new T.Mesh(new T.BoxGeometry(0.19*S,0.035,0.31*S),gold(4));
    shRim.position.set(sx,0.86*S,0); group.add(shRim);
    // Layered spikes (3 stacked ridges going up)
    [0,0.06*S,0.12*S].forEach((dy,si)=>{
      const spike=new T.Mesh(new T.BoxGeometry(0.18*S-si*0.03,0.03,0.06),gold(3+si));
      spike.position.set(sx,0.88*S+dy,0.06*S); group.add(spike);
    });
    // Arm (upper)
    const arm=new T.Mesh(new T.BoxGeometry(0.1*S,0.26*S,0.12*S),std(0x0c0c26,0,0,0.35,0.85));
    arm.position.set(sx,0.58*S,0); group.add(arm);
    // Arm gold band
    const armBand=new T.Mesh(new T.BoxGeometry(0.11*S,0.03,0.13*S),gold(3));
    armBand.position.set(sx,0.5*S,0); group.add(armBand);
    // Forearm angled outward (commanding gesture)
    const forearm=new T.Mesh(new T.BoxGeometry(0.08*S,0.02*S,0.22*S),std(0x0e0e28,0,0,0.3,0.9));
    forearm.position.set(sx+(sx>0?0.12*S:-0.12*S),0.4*S,0.05*S);
    forearm.rotation.z=(sx>0?-0.4:0.4); group.add(forearm);
  });

  // Cape (flat back element, royal)
  const capeMat=new T.MeshStandardMaterial({color:0x080820,emissive:B,emissiveIntensity:0.5,roughness:0.7,metalness:0.2,side:T.DoubleSide});
  const cape=new T.Mesh(new T.PlaneGeometry(0.6*S,0.8*S),capeMat);
  cape.position.set(0,0.5*S,-0.18*S); group.add(cape);
  // Cape gold border
  const capeBorderMat=std(G,G,3.0,0.05,1.0);
  [[-0.31*S,0.5*S,-0.17*S],[0.31*S,0.5*S,-0.17*S]].forEach(([x,y,z])=>{
    const b=new T.Mesh(new T.BoxGeometry(0.025,0.82*S,0.01),capeBorderMat);
    b.position.set(x,y,z); group.add(b);
  });

  // Neck
  const neck=new T.Mesh(new T.CylinderGeometry(0.07*S,0.085*S,0.12*S,8),std(0x14143a,0,0,0.3,0.9));
  neck.position.set(0,0.93*S,0); group.add(neck);
  // Neck collar
  const collar=new T.Mesh(new T.TorusGeometry(0.09*S,0.025*S,6,8),gold());
  collar.position.set(0,0.94*S,0); collar.rotation.x=Math.PI/2; group.add(collar);

  // ── Helmet — angular emperor style ──
  const helmMat=new T.MeshStandardMaterial({color:0x090920,roughness:0.1,metalness:0.98});
  const helm=new T.Mesh(new T.BoxGeometry(0.38*S,0.32*S,0.36*S),helmMat);
  helm.position.set(0,1.08*S,0); helm.castShadow=true; group.add(helm);
  // Helm top crest (tall ridge)
  const crest=new T.Mesh(new T.BoxGeometry(0.1*S,0.18*S,0.36*S),std(0x141440,0,0,0.15,1.0));
  crest.position.set(0,1.3*S,0); group.add(crest);
  // Gold crest tip
  const crestTip=new T.Mesh(new T.CylinderGeometry(0.025*S,0.04*S,0.12*S,6),gold(5));
  crestTip.position.set(0,1.44*S,0); group.add(crestTip);
  // Cheek guards
  [-0.22*S,0.22*S].forEach(hx=>{
    const cheek=new T.Mesh(new T.BoxGeometry(0.05,0.18*S,0.3*S),std(0x0e0e2a,0,0,0.15,0.98));
    cheek.position.set(hx,1.05*S,0); group.add(cheek);
    // Gold cheek line
    const cl=new T.Mesh(new T.BoxGeometry(0.018,0.19*S,0.01),gold(3));
    cl.position.set(hx+(hx>0?-0.015:0.015),1.05*S,0.185*S); group.add(cl);
  });

  // ── VISOR — full-width glowing bar ──
  const visorMat=new T.MeshStandardMaterial({color:G,emissive:G,emissiveIntensity:5,roughness:0.0,metalness:1.0});
  const visor=new T.Mesh(new T.BoxGeometry(0.36*S,0.07*S,0.025),visorMat);
  visor.position.set(0,1.08*S,0.195*S); group.add(visor);
  // Sub-visor glow
  const subVisor=new T.Mesh(new T.BoxGeometry(0.38*S,0.095*S,0.015),
    new T.MeshStandardMaterial({color:G,emissive:G,emissiveIntensity:2,roughness:0.1,transparent:true,opacity:0.4}));
  subVisor.position.set(0,1.08*S,0.19*S); group.add(subVisor);

  // ── Command orb (floating above right hand) ──
  const orbMat=new T.MeshStandardMaterial({color:W,emissive:W,emissiveIntensity:4.0,roughness:0.0,transparent:true,opacity:0.9});
  const orb=new T.Mesh(new T.SphereGeometry(0.12*S,16,16),orbMat);
  orb.position.set(0.38*S,0.38*S,0.15*S); group.add(orb);
  const orbRing=new T.Mesh(new T.TorusGeometry(0.14*S,0.012*S,6,32),gold(4));
  orbRing.position.set(0.38*S,0.38*S,0.15*S); orbRing.rotation.x=Math.PI/4; group.add(orbRing);
  s.coreNodes.push(orb); // orb pulses

  // ── Crown / Neural arc above head ──
  const crownY=1.52*S;
  for(let n=0;n<6;n++){
    const a=n/6*Math.PI*2;
    const spoke=new T.Mesh(new T.CylinderGeometry(0.012*S,0.018*S,0.28*S,6),gold(3));
    spoke.position.set(Math.cos(a)*0.22*S,crownY+0.12*S,Math.sin(a)*0.22*S);
    spoke.rotation.z=Math.cos(a)*0.4; spoke.rotation.x=Math.sin(a)*0.4;
    group.add(spoke);
    const gem=new T.Mesh(new T.OctahedronGeometry(0.04*S),
      n%2===0?gold(6):new T.MeshStandardMaterial({color:W,emissive:W,emissiveIntensity:6}));
    gem.position.set(Math.cos(a)*0.26*S,crownY+0.28*S,Math.sin(a)*0.26*S);
    group.add(gem); s.coreNodes.push(gem);
  }
  // Crown base ring
  const crownRing=new T.Mesh(new T.TorusGeometry(0.24*S,0.025*S,6,32),gold(5));
  crownRing.position.set(0,crownY,0); crownRing.rotation.x=Math.PI/2; group.add(crownRing);
  s.coreRings.push(crownRing);

  // ── Grand orbiting halo rings (3) ──
  [[G,1.6,0.045,0],[W,1.9,0.03,1],[B,1.35,0.055,2]].forEach(([col,r,tube,i])=>{
    const ring=new T.Mesh(
      new T.TorusGeometry(r as number,tube as number,8,64),
      new T.MeshStandardMaterial({color:col as number,emissive:col as number,emissiveIntensity:3.0,roughness:0.05})
    );
    ring.position.set(0,1.5,0);
    ring.rotation.set(
      [Math.PI/2.5,Math.PI/2,Math.PI/3.5][i as number],
      [0,Math.PI/5,Math.PI/2.5][i as number],
      0
    );
    scene.add(ring); s.coreRings.push(ring);
  });

  // ── Lights ──
  const mainLight=new T.PointLight(G,8,12,2); mainLight.position.set(0,3.5,0); scene.add(mainLight);
  s.coreLight=mainLight;
  const blueLight=new T.PointLight(B,4,8,2); blueLight.position.set(0,1.5,0); scene.add(blueLight);
  const groundLight=new T.PointLight(G,2,6,2); groundLight.position.set(0,0.5,0); scene.add(groundLight);
}
