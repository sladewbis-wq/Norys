/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║         NORYS — SKILLS REGISTRY v2.0                    ║
 * ║  Skills catalog · Agent assignment · Tool linking        ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Un "skill" = capacité ou outil qu'on assigne à un agent
 * Différent d'un "tool" (exécution bas niveau) :
 *   Tool     = fonction appelable pendant ReAct loop
 *   Skill    = bundle de tools + config + instructions spécifiques
 *
 * Catégories :
 *   search    — Accès à internet, moteurs de recherche
 *   code      — Exécution de code, analyse, débogage
 *   data      — Manipulation de données, SQL, CSV
 *   comms     — Email, Slack, Teams, SMS
 *   calendar  — Google Cal, Outlook, planning
 *   files     — Lecture, écriture, conversion de fichiers
 *   crm       — Salesforce, HubSpot, Pipedrive
 *   devops    — CI/CD, monitoring, logs, Git
 *   rag       — Recherche documentaire privée (Qdrant)
 *   custom    — Skills personnalisés (MCP servers)
 */

import { toolRegistry } from "./agent-engine";

// ─── Types ──────────────────────────────────────────────────────────────────

export type SkillCategory =
  | "search"
  | "code"
  | "data"
  | "comms"
  | "calendar"
  | "files"
  | "crm"
  | "devops"
  | "rag"
  | "memory"
  | "custom";

export type SkillStatus = "active" | "beta" | "coming_soon" | "error";

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  icon: string; // emoji or icon name
  status: SkillStatus;
  toolIds: string[]; // tool IDs this skill enables
  instructions?: string; // extra system prompt instructions when skill is active
  config?: Record<string, { type: string; label: string; placeholder?: string; required?: boolean }>;
  tags: string[];
  free: boolean; // free vs premium
  author: string;
}

export interface AgentSkillAssignment {
  agentId: string;
  skillId: string;
  assignedAt: number;
  config: Record<string, unknown>; // user-configured values for this skill
  enabled: boolean;
}

// ─── Skills Catalog ───────────────────────────────────────────────────────────

export const SKILLS_CATALOG: Skill[] = [
  // ── SEARCH ──────────────────────────────────────────────────────────────────
  {
    id: "web_search_brave",
    name: "Recherche Web (Brave)",
    description: "Recherche sur internet via Brave Search API. Résultats sans tracking.",
    category: "search",
    icon: "🔍",
    status: "active",
    toolIds: ["web_search"],
    instructions: "Tu peux effectuer des recherches sur internet via Brave Search pour obtenir des informations récentes.",
    config: { apiKey: { type: "password", label: "Brave Search API Key", placeholder: "BSA...", required: true } },
    tags: ["web", "recherche", "internet"],
    free: false,
    author: "Norys",
  },
  {
    id: "web_search_serp",
    name: "Recherche Google (SerpAPI)",
    description: "Accès aux résultats Google via SerpAPI pour des recherches précises.",
    category: "search",
    icon: "🌐",
    status: "active",
    toolIds: ["web_search"],
    config: { apiKey: { type: "password", label: "SerpAPI Key", placeholder: "serp_...", required: true } },
    tags: ["google", "recherche", "serpapi"],
    free: false,
    author: "Norys",
  },
  {
    id: "wikipedia",
    name: "Wikipédia",
    description: "Recherche et extraction d'informations depuis Wikipédia.",
    category: "search",
    icon: "📖",
    status: "active",
    toolIds: ["web_search"],
    tags: ["wikipedia", "encyclopédie", "gratuit"],
    free: true,
    author: "Norys",
  },

  // ── CODE ─────────────────────────────────────────────────────────────────────
  {
    id: "python_exec",
    name: "Python Sandbox",
    description: "Exécute du code Python dans un environnement sécurisé (Pyodide). Calculs, analyses, scripts.",
    category: "code",
    icon: "🐍",
    status: "active",
    toolIds: ["code_exec"],
    instructions: "Tu peux écrire et exécuter du code Python pour résoudre des problèmes analytiques ou techniques.",
    tags: ["python", "code", "calcul"],
    free: true,
    author: "Norys",
  },
  {
    id: "js_exec",
    name: "JavaScript Sandbox",
    description: "Exécute du JavaScript — manipulation de données, transformations JSON, logique métier.",
    category: "code",
    icon: "⚡",
    status: "active",
    toolIds: ["code_exec"],
    tags: ["javascript", "js", "code"],
    free: true,
    author: "Norys",
  },
  {
    id: "sql_query",
    name: "SQL Query Engine",
    description: "Exécute des requêtes SQL sur vos bases de données connectées.",
    category: "data",
    icon: "🗄️",
    status: "coming_soon",
    toolIds: ["api_call"],
    config: {
      connectionString: { type: "password", label: "Connection String", placeholder: "postgresql://...", required: true },
      readOnly: { type: "checkbox", label: "Mode lecture seule" },
    },
    tags: ["sql", "base de données", "query"],
    free: false,
    author: "Norys",
  },

  // ── COMMS ─────────────────────────────────────────────────────────────────────
  {
    id: "email_gmail",
    name: "Gmail",
    description: "Lecture, envoi et gestion des emails Gmail. Recherche, labels, brouillons.",
    category: "comms",
    icon: "📧",
    status: "active",
    toolIds: ["api_call"],
    instructions: "Tu peux lire et envoyer des emails via Gmail. Demande toujours confirmation avant d'envoyer.",
    config: {
      clientId: { type: "text", label: "Google Client ID", required: true },
      clientSecret: { type: "password", label: "Google Client Secret", required: true },
    },
    tags: ["email", "gmail", "google"],
    free: true,
    author: "Norys",
  },
  {
    id: "slack_integration",
    name: "Slack",
    description: "Envoi de messages, lecture de canaux, recherche dans Slack.",
    category: "comms",
    icon: "💬",
    status: "active",
    toolIds: ["api_call"],
    config: { botToken: { type: "password", label: "Slack Bot Token", placeholder: "xoxb-...", required: true } },
    tags: ["slack", "messagerie", "équipe"],
    free: false,
    author: "Norys",
  },
  {
    id: "teams_integration",
    name: "Microsoft Teams",
    description: "Envoi de messages et notifications via Teams.",
    category: "comms",
    icon: "🟣",
    status: "coming_soon",
    toolIds: ["api_call"],
    tags: ["teams", "microsoft", "messagerie"],
    free: false,
    author: "Norys",
  },

  // ── CALENDAR ──────────────────────────────────────────────────────────────────
  {
    id: "google_calendar",
    name: "Google Calendar",
    description: "Création, lecture et gestion d'événements Google Calendar.",
    category: "calendar",
    icon: "📅",
    status: "active",
    toolIds: ["api_call"],
    instructions: "Tu peux créer et consulter des événements Google Calendar. Confirme toujours avant de créer ou supprimer.",
    config: {
      clientId: { type: "text", label: "Google Client ID", required: true },
      clientSecret: { type: "password", label: "Google Client Secret", required: true },
    },
    tags: ["calendrier", "agenda", "google"],
    free: true,
    author: "Norys",
  },
  {
    id: "outlook_calendar",
    name: "Outlook Calendar",
    description: "Gestion des événements Outlook via Microsoft Graph API.",
    category: "calendar",
    icon: "📆",
    status: "coming_soon",
    toolIds: ["api_call"],
    tags: ["outlook", "microsoft", "calendrier"],
    free: false,
    author: "Norys",
  },

  // ── FILES ─────────────────────────────────────────────────────────────────────
  {
    id: "file_reader",
    name: "Lecteur de Fichiers",
    description: "Lecture de PDF, Word, Excel, CSV, TXT depuis la base documentaire.",
    category: "files",
    icon: "📁",
    status: "active",
    toolIds: ["file_read"],
    instructions: "Tu peux lire et analyser des fichiers de la base documentaire.",
    tags: ["fichiers", "pdf", "documents"],
    free: true,
    author: "Norys",
  },
  {
    id: "gdrive",
    name: "Google Drive",
    description: "Accès aux fichiers Google Drive — lecture, écriture, partage.",
    category: "files",
    icon: "🟡",
    status: "coming_soon",
    toolIds: ["api_call", "file_read"],
    config: { clientId: { type: "text", label: "Google Client ID", required: true } },
    tags: ["google drive", "fichiers", "cloud"],
    free: false,
    author: "Norys",
  },

  // ── CRM ───────────────────────────────────────────────────────────────────────
  {
    id: "hubspot",
    name: "HubSpot CRM",
    description: "Accès aux contacts, deals, tickets et activités HubSpot.",
    category: "crm",
    icon: "🧡",
    status: "active",
    toolIds: ["api_call"],
    instructions: "Tu peux consulter et mettre à jour le CRM HubSpot. Confirme avant toute modification.",
    config: { apiKey: { type: "password", label: "HubSpot Private App Token", required: true } },
    tags: ["crm", "hubspot", "sales", "deals"],
    free: false,
    author: "Norys",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Intégration Salesforce — contacts, opportunités, comptes.",
    category: "crm",
    icon: "☁️",
    status: "coming_soon",
    toolIds: ["api_call"],
    tags: ["salesforce", "crm", "enterprise"],
    free: false,
    author: "Norys",
  },

  // ── DEVOPS ────────────────────────────────────────────────────────────────────
  {
    id: "github_integration",
    name: "GitHub",
    description: "Accès aux repos, issues, PRs, actions et logs GitHub.",
    category: "devops",
    icon: "🐙",
    status: "active",
    toolIds: ["api_call"],
    instructions: "Tu peux interagir avec GitHub pour lire le code, créer des issues et consulter les actions.",
    config: { token: { type: "password", label: "GitHub Personal Access Token", placeholder: "ghp_...", required: true } },
    tags: ["github", "git", "code", "devops"],
    free: true,
    author: "Norys",
  },
  {
    id: "jira_integration",
    name: "Jira",
    description: "Gestion des tickets, sprints et backlogs Jira.",
    category: "devops",
    icon: "🔵",
    status: "active",
    toolIds: ["api_call"],
    config: {
      domain: { type: "text", label: "Domaine Jira (ex: mycompany.atlassian.net)", required: true },
      email: { type: "text", label: "Email Jira", required: true },
      apiToken: { type: "password", label: "Jira API Token", required: true },
    },
    tags: ["jira", "tickets", "agile", "devops"],
    free: false,
    author: "Norys",
  },
  {
    id: "datadog",
    name: "Datadog Monitoring",
    description: "Métriques, logs, alertes et dashboards Datadog.",
    category: "devops",
    icon: "🐕",
    status: "coming_soon",
    toolIds: ["api_call"],
    tags: ["monitoring", "logs", "datadog", "observabilité"],
    free: false,
    author: "Norys",
  },

  // ── RAG ───────────────────────────────────────────────────────────────────────
  {
    id: "rag_qdrant",
    name: "Base de Connaissances Privée",
    description: "Recherche vectorielle dans vos documents privés via Qdrant. Zéro données sortantes.",
    category: "rag",
    icon: "🧠",
    status: "active",
    toolIds: ["file_read", "memory_recall"],
    instructions: "Tu peux rechercher dans la base de connaissances privée pour répondre avec des informations internes.",
    config: {
      qdrantUrl: { type: "text", label: "URL Qdrant", placeholder: "http://localhost:6333" },
      collection: { type: "text", label: "Collection Qdrant", placeholder: "norys-docs" },
    },
    tags: ["rag", "vectoriel", "qdrant", "documents privés"],
    free: true,
    author: "Norys",
  },

  // ── MEMORY ────────────────────────────────────────────────────────────────────
  {
    id: "agent_memory",
    name: "Mémoire Agent",
    description: "Active la mémoire épisodique et sémantique. L'agent se souvient des interactions passées.",
    category: "memory",
    icon: "💾",
    status: "active",
    toolIds: ["memory_recall"],
    instructions: "Tu as accès à ta mémoire. Utilise memory_recall pour retrouver des informations des conversations précédentes.",
    tags: ["mémoire", "persistance", "contexte"],
    free: true,
    author: "Norys",
  },

  // ── CUSTOM ────────────────────────────────────────────────────────────────────
  {
    id: "custom_api",
    name: "API Personnalisée",
    description: "Connectez n'importe quelle API REST externe. Configurez vos endpoints sur mesure.",
    category: "custom",
    icon: "🔧",
    status: "active",
    toolIds: ["api_call"],
    instructions: "Tu peux appeler des APIs externes configurées par l'administrateur.",
    config: {
      baseUrl: { type: "text", label: "URL de base de l'API", placeholder: "https://api.example.com", required: true },
      apiKey: { type: "password", label: "Clé API (optionnel)" },
      headers: { type: "text", label: "Headers supplémentaires (JSON)" },
    },
    tags: ["api", "custom", "webhook", "rest"],
    free: true,
    author: "Norys",
  },
  {
    id: "mcp_server",
    name: "MCP Server",
    description: "Connectez un serveur MCP (Model Context Protocol) externe pour des capacités avancées.",
    category: "custom",
    icon: "🔌",
    status: "beta",
    toolIds: [],
    config: {
      serverUrl: { type: "text", label: "URL du serveur MCP", placeholder: "http://localhost:3001", required: true },
      authToken: { type: "password", label: "Token d'authentification" },
    },
    tags: ["mcp", "protocol", "custom", "avancé"],
    free: true,
    author: "Norys",
  },
];

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const ASSIGNMENTS_KEY = "norys:skill-assignments";

// ─── Skills Registry ──────────────────────────────────────────────────────────

export class SkillsRegistry {
  private assignments: AgentSkillAssignment[] = [];

  constructor() {
    this.load();
  }

  private load() {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(ASSIGNMENTS_KEY);
      this.assignments = raw ? JSON.parse(raw) : [];
    } catch {
      this.assignments = [];
    }
  }

  private save() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(this.assignments));
    } catch { /* storage full */ }
  }

  // ─── Catalog queries ──────────────────────────────────────────────────────────

  getAll(): Skill[] {
    return SKILLS_CATALOG;
  }

  getById(id: string): Skill | undefined {
    return SKILLS_CATALOG.find((s) => s.id === id);
  }

  getByCategory(category: SkillCategory): Skill[] {
    return SKILLS_CATALOG.filter((s) => s.category === category);
  }

  search(query: string): Skill[] {
    const q = query.toLowerCase();
    return SKILLS_CATALOG.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.includes(q))
    );
  }

  getAvailableOnly(): Skill[] {
    return SKILLS_CATALOG.filter((s) => s.status !== "coming_soon");
  }

  // ─── Agent assignments ────────────────────────────────────────────────────────

  assignSkill(agentId: string, skillId: string, config: Record<string, unknown> = {}) {
    // Remove existing if already assigned
    this.assignments = this.assignments.filter(
      (a) => !(a.agentId === agentId && a.skillId === skillId)
    );
    this.assignments.push({
      agentId,
      skillId,
      assignedAt: Date.now(),
      config,
      enabled: true,
    });
    this.save();
  }

  removeSkill(agentId: string, skillId: string) {
    this.assignments = this.assignments.filter(
      (a) => !(a.agentId === agentId && a.skillId === skillId)
    );
    this.save();
  }

  toggleSkill(agentId: string, skillId: string) {
    const assignment = this.assignments.find(
      (a) => a.agentId === agentId && a.skillId === skillId
    );
    if (assignment) {
      assignment.enabled = !assignment.enabled;
      this.save();
    }
  }

  updateSkillConfig(agentId: string, skillId: string, config: Record<string, unknown>) {
    const assignment = this.assignments.find(
      (a) => a.agentId === agentId && a.skillId === skillId
    );
    if (assignment) {
      assignment.config = { ...assignment.config, ...config };
      this.save();
    }
  }

  // ─── Queries ───────────────────────────────────────────────────────────────────

  getAgentSkills(agentId: string): Array<{ skill: Skill; assignment: AgentSkillAssignment }> {
    return this.assignments
      .filter((a) => a.agentId === agentId)
      .map((a) => {
        const skill = this.getById(a.skillId);
        return skill ? { skill, assignment: a } : null;
      })
      .filter(Boolean) as Array<{ skill: Skill; assignment: AgentSkillAssignment }>;
  }

  getEnabledSkills(agentId: string): Skill[] {
    return this.getAgentSkills(agentId)
      .filter(({ assignment }) => assignment.enabled)
      .map(({ skill }) => skill);
  }

  getActiveToolIds(agentId: string): string[] {
    const skills = this.getEnabledSkills(agentId);
    const toolIds = new Set<string>(["memory_recall"]); // always enabled
    for (const skill of skills) {
      skill.toolIds.forEach((id) => toolIds.add(id));
    }
    return [...toolIds];
  }

  getActiveInstructions(agentId: string): string {
    const skills = this.getEnabledSkills(agentId);
    return skills
      .filter((s) => s.instructions)
      .map((s) => `[${s.name}] ${s.instructions}`)
      .join("\n");
  }

  isAssigned(agentId: string, skillId: string): boolean {
    return this.assignments.some((a) => a.agentId === agentId && a.skillId === skillId);
  }

  isEnabled(agentId: string, skillId: string): boolean {
    const a = this.assignments.find((a) => a.agentId === agentId && a.skillId === skillId);
    return a?.enabled ?? false;
  }

  // ─── Stats ────────────────────────────────────────────────────────────────────

  getStats() {
    const byCategory = new Map<string, number>();
    for (const s of SKILLS_CATALOG) {
      byCategory.set(s.category, (byCategory.get(s.category) ?? 0) + 1);
    }
    return {
      total: SKILLS_CATALOG.length,
      active: SKILLS_CATALOG.filter((s) => s.status === "active").length,
      beta: SKILLS_CATALOG.filter((s) => s.status === "beta").length,
      comingSoon: SKILLS_CATALOG.filter((s) => s.status === "coming_soon").length,
      assignments: this.assignments.length,
      byCategory: Object.fromEntries(byCategory),
    };
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let _registry: SkillsRegistry | null = null;

export function getSkillsRegistry(): SkillsRegistry {
  if (!_registry) _registry = new SkillsRegistry();
  return _registry;
}

// ─── Category metadata ────────────────────────────────────────────────────────

export const SKILL_CATEGORIES: Record<SkillCategory, { label: string; icon: string; description: string }> = {
  search:   { label: "Recherche",      icon: "🔍", description: "Accès à internet et moteurs de recherche" },
  code:     { label: "Code",           icon: "💻", description: "Exécution et analyse de code" },
  data:     { label: "Données",        icon: "📊", description: "Manipulation et analyse de données" },
  comms:    { label: "Communications", icon: "💬", description: "Email, Slack, Teams, messagerie" },
  calendar: { label: "Calendrier",     icon: "📅", description: "Gestion d'agenda et d'événements" },
  files:    { label: "Fichiers",       icon: "📁", description: "Lecture et gestion de fichiers" },
  crm:      { label: "CRM",            icon: "🤝", description: "Salesforce, HubSpot, gestion commerciale" },
  devops:   { label: "DevOps",         icon: "⚙️", description: "GitHub, Jira, monitoring, CI/CD" },
  rag:      { label: "Base de docs",   icon: "🧠", description: "Recherche dans vos documents privés" },
  memory:   { label: "Mémoire",        icon: "💾", description: "Mémoire persistante et apprentissage" },
  custom:   { label: "Custom",         icon: "🔧", description: "APIs et serveurs MCP personnalisés" },
};
