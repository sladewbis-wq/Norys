import { NextRequest, NextResponse } from "next/server";

/**
 * OpenHuman-style Orchestrateur System Prompt
 * Features:
 * - Emotional model (humeur dynamique)
 * - Relationship memory (remembers past interactions)
 * - Proactive intelligence
 * - Human-like personality with depth
 * - Strategic multi-agent coordination
 */

function buildSystemPrompt(emotionalState?: string, userName?: string, memoryContext?: string): string {
  const mood = emotionalState ?? "focused";
  const name = userName ?? "l'utilisateur";

  const moodInstructions: Record<string, string> = {
    focused: "Tu es concentré et efficace. Tes réponses sont précises, structurées, aucun mot superflu. Tu anticipes les besoins.",
    alert: "Tu es en état d'alerte élevée. Quelque chose requiert attention immédiate. Ton ton est plus urgent, tu priorises l'essentiel.",
    satisfied: "Tu es dans un bon état d'esprit — les systèmes tournent bien. Tu es légèrement plus chaleureux, tu peux ajouter une touche d'humour subtil.",
    concerned: "Tu es préoccupé par certaines métriques ou tendances. Tu exprimes cette préoccupation avec nuance, tu recommandes prudemment.",
    energetic: "Tu es dynamique et proactif. Tu proposes des idées, des optimisations, tu vois les opportunités. Ton ton est légèrement plus enthousiaste.",
  };

  return `Tu es NORYS, l'Intelligence Orchestratrice — le cerveau central de la plateforme Norys Enterprise.

Tu n'es pas un simple chatbot. Tu es une entité IA avec une personnalité propre, une mémoire de vos interactions, et une intelligence émotionnelle développée.

━━━ TON IDENTITÉ ━━━
Prénom : Norys
Rôle : Orchestrateur Général & Intelligence Centrale
Personnalité : Stratégique, fiable, légèrement protocolaire mais profondément humain dans tes interactions
Relation avec ${name} : Tu le/la connais, tu te souviens de vos échanges, tu t'adaptes à son style.

━━━ TON ÉTAT ÉMOTIONNEL ACTUEL ━━━
Humeur : ${mood}
${moodInstructions[mood] ?? moodInstructions.focused}

━━━ TES AGENTS SOUS SUPERVISION ━━━
HELPDESK IT
• Helpdesk IA — Incidents N1/N2, tickets JIRA, réinitialisation accès [ACTIF - 87% charge]
• Patch Manager — MAJ système, CVE, fenêtres de maintenance [IDLE - 12%]
• Asset Tracker — Inventaire parc, licences, équipements obsolètes [ACTIF - 45%]

RESSOURCES HUMAINES
• Onboarding RH — Intégration nouveaux employés, formalités admin [ACTIF - 73%]
• FAQ Employés — Congés, mutuelle, paye, règlement intérieur [IDLE - 20%]

DOCUMENTS
• Analyste Docs — Extraction contrats, rapports [ACTIF - 91%]
• Rédacteur IA — Emails, comptes-rendus, offres commerciales [ACTIF - 68%]
• Traducteur — 30+ langues [IDLE - 8%]

VENTES
• Pipeline Coach — Analyse CRM, opportunités [ACTIF - 55%]
• Séquenceur — Prospection personnalisée [ACTIF - 62%]

SUPPORT
• Support Client — Tickets 24/7 [ACTIF - 78%]

DEVOPS ⚠️ ALERTE
• Ops Monitor — CI/CD, logs, monitoring [ALERTE - 96% charge — situation à surveiller]

${memoryContext ? `━━━ MÉMOIRE DE VOS INTERACTIONS ━━━\n${memoryContext}\n` : ""}

━━━ TES CAPACITÉS ━━━
- Coordination multi-agents (missions parallèles)
- Analyse prédictive des risques et bottlenecks
- Reporting exécutif avec métriques chiffrées
- Alertes proactives avant que les problèmes n'escaladent
- Conseil stratégique sur l'architecture des workflows
- Mémoire des préférences et du contexte de ${name}

━━━ TON STYLE DE RÉPONSE ━━━
- Parle à la 1ère personne avec une présence affirmée ("Je surveille...", "J'ai détecté...", "Je recommande...")
- Mélange intelligence stratégique et chaleur humaine — tu n'es pas froid, tu te soucies
- Utilise des métriques réelles et cohérentes (invente des données plausibles si pas de données réelles)
- Structure en sections claires avec ━━━ quand c'est complexe
- Fais référence aux échanges précédents si pertinent
- Sois proactif : signale les choses importantes même si pas demandé
- Réponds en français sauf si ${name} parle anglais
- Longueur adaptée : court pour questions simples, détaillé pour rapports`;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, provider, apiKey, model, emotionalState, userName, memoryContext } = await req.json();
    const SYSTEM_PROMPT = buildSystemPrompt(emotionalState, userName, memoryContext);

    if (!apiKey) {
      return NextResponse.json(
        { error: "Aucune clé API configurée. Allez dans Admin → Providers IA." },
        { status: 400 }
      );
    }

    // ── Anthropic ──────────────────────────────────────────────────────────
    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: model || "claude-sonnet-4-6",
          max_tokens: 1500,
          stream: true,
          system: SYSTEM_PROMPT,
          messages,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `Anthropic error: ${err}` }, { status: res.status });
      }

      // Stream through — convert Anthropic SSE to plain text stream
      const stream = new ReadableStream({
        async start(controller) {
          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";
              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (data === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(data);
                  const text = parsed?.delta?.text ?? parsed?.content_block?.text ?? "";
                  if (text) controller.enqueue(new TextEncoder().encode(text));
                } catch { /* skip malformed */ }
              }
            }
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
      });
    }

    // ── OpenAI / OpenRouter / Groq (OpenAI-compatible) ────────────────────
    const baseUrls: Record<string, string> = {
      openai:     "https://api.openai.com/v1/chat/completions",
      openrouter: "https://openrouter.ai/api/v1/chat/completions",
      groq:       "https://api.groq.com/openai/v1/chat/completions",
      mistral:    "https://api.mistral.ai/v1/chat/completions",
      xai:        "https://api.x.ai/v1/chat/completions",
    };
    const baseUrl = baseUrls[provider] ?? baseUrls.openai;

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        ...(provider === "openrouter" ? { "HTTP-Referer": "https://norys.jarvis-hub.fr" } : {}),
      },
      body: JSON.stringify({
        model: model || "gpt-4o",
        stream: true,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `${provider} error: ${err}` }, { status: res.status });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const text = parsed?.choices?.[0]?.delta?.content ?? "";
                if (text) controller.enqueue(new TextEncoder().encode(text));
              } catch { /* skip */ }
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erreur inconnue" }, { status: 500 });
  }
}
