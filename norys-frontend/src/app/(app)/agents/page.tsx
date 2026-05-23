"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bot, Database, Plus, ShieldAlert } from "lucide-react";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Agent } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Badge, Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { AgentEditor } from "@/components/agent-editor";

export default function AgentsPage() {
  const { user } = useAuth();
  const canManage = user?.role === "owner" || user?.role === "admin";
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Agent | "new" | null>(null);

  const load = () => {
    setLoading(true);
    api
      .listAgents()
      .then(setAgents)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div>
      <PageHeader
        title="Agents"
        subtitle="Vos assistants IA spécialisés par métier"
        action={
          canManage && (
            <Button onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" /> Nouvel agent
            </Button>
          )
        }
      />

      <div className="p-8">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <EmptyState
            icon={<Bot className="h-8 w-8" />}
            title="Aucun agent"
            description="Créez votre premier agent pour commencer."
            action={canManage && <Button onClick={() => setEditing("new")}>Créer un agent</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <Card key={agent.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-subtle">
                    <Bot className="h-5 w-5 text-brand-hover" />
                  </div>
                  {!agent.is_active && <Badge tone="warning">Inactif</Badge>}
                </div>
                <h3 className="mt-3 font-medium text-content">{agent.name}</h3>
                <p className="mt-1 line-clamp-2 flex-1 text-sm text-content-subtle">
                  {agent.description || "Agent IA spécialisé"}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge>{agent.category}</Badge>
                  {agent.use_rag && (
                    <Badge tone="brand">
                      <Database className="mr-1 h-3 w-3" /> RAG
                    </Badge>
                  )}
                  {agent.requires_human_approval && (
                    <Badge tone="warning">
                      <ShieldAlert className="mr-1 h-3 w-3" /> Validation
                    </Badge>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href={`/chat?agent=${agent.id}`} className="flex-1">
                    <Button variant="secondary" size="sm" className="w-full">
                      Discuter
                    </Button>
                  </Link>
                  {canManage && (
                    <Button variant="ghost" size="sm" onClick={() => setEditing(agent)}>
                      Modifier
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <AgentEditor
          agent={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
