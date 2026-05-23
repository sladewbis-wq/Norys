"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bot,
  FileText,
  Headset,
  MessagesSquare,
  ShieldCheck,
} from "lucide-react";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Agent, Conversation, DocumentMeta } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, Skeleton } from "@/components/ui";

export default function CockpitPage() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.listAgents(), api.listConversations(), api.listDocuments()])
      .then(([a, c, d]) => {
        setAgents(a);
        setConversations(c);
        setDocuments(d);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const helpdesk = agents.find((a) => a.category === "helpdesk");

  return (
    <div>
      <PageHeader
        title={`Bonjour ${user?.full_name?.split(" ")[0] || ""}`.trim()}
        subtitle="Votre centre de commande IA privé"
      />

      <div className="space-y-8 p-8">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Agents disponibles" value={agents.length} icon={<Bot className="h-4 w-4" />} loading={loading} />
          <Stat label="Conversations" value={conversations.length} icon={<MessagesSquare className="h-4 w-4" />} loading={loading} />
          <Stat label="Documents privés" value={documents.length} icon={<FileText className="h-4 w-4" />} loading={loading} />
        </div>

        {/* Helpdesk spotlight */}
        {helpdesk && (
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-subtle">
                  <Headset className="h-5 w-5 text-brand-hover" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-content">{helpdesk.name}</h3>
                    <Badge tone="brand">Helpdesk IT</Badge>
                  </div>
                  <p className="mt-1 max-w-md text-sm text-content-subtle">
                    {helpdesk.description}
                  </p>
                </div>
              </div>
              <Link
                href={`/chat?agent=${helpdesk.id}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
              >
                Démarrer <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Card>
        )}

        {/* Agent library */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-content">Bibliothèque d&apos;agents</h2>
            <Link href="/agents" className="text-xs text-brand-hover hover:underline">
              Voir tout
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {agents.slice(0, 6).map((agent) => (
                <Link key={agent.id} href={`/chat?agent=${agent.id}`}>
                  <Card className="h-full p-4 transition-colors hover:border-border-strong">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-brand-hover" />
                      <p className="font-medium text-content">{agent.name}</p>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-content-subtle">
                      {agent.description || "Agent IA spécialisé"}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Trust footer */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-subtle px-4 py-3 text-sm text-content-subtle">
          <ShieldCheck className="h-4 w-4 text-success" />
          Vos données restent sur votre infrastructure. Souveraineté et confidentialité par défaut.
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-content-subtle">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-12" />
      ) : (
        <p className="mt-2 text-2xl font-semibold text-content">{value}</p>
      )}
    </Card>
  );
}
