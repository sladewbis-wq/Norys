"use client";

import { useEffect, useState } from "react";
import { Plus, ScrollText, Users } from "lucide-react";

import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { AuditLog, RoleName, User } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Badge, Button, Card, Field, Input, Skeleton } from "@/components/ui";
import { Modal } from "@/components/modal";
import { cn, formatDate, initials } from "@/lib/utils";
import { Avatar } from "@/components/ui";

type Tab = "users" | "audit";

const ROLES: RoleName[] = ["owner", "admin", "member", "viewer"];

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("users");

  if (user && user.role !== "owner" && user.role !== "admin") {
    return (
      <div>
        <PageHeader title="Administration" />
        <div className="p-8 text-sm text-content-subtle">
          Vous n&apos;avez pas accès à cet espace.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Administration" subtitle="Utilisateurs, rôles et journal d'audit" />
      <div className="px-8 pt-4">
        <div className="flex gap-1 border-b border-border">
          <TabButton active={tab === "users"} onClick={() => setTab("users")} icon={<Users className="h-4 w-4" />}>
            Utilisateurs
          </TabButton>
          <TabButton active={tab === "audit"} onClick={() => setTab("audit")} icon={<ScrollText className="h-4 w-4" />}>
            Journal d&apos;audit
          </TabButton>
        </div>
      </div>
      <div className="p-8 pt-6">{tab === "users" ? <UsersTab /> : <AuditTab />}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 border-b-2 px-3 pb-2.5 text-sm font-medium transition-colors",
        active
          ? "border-brand text-content"
          : "border-transparent text-content-muted hover:text-content",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .listUsers()
      .then(setUsers)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  async function changeRole(u: User, role: RoleName) {
    await api.updateUser(u.id, { role });
    load();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Inviter un utilisateur
        </Button>
      </div>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : (
        <Card className="divide-y divide-border">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar label={initials(u.full_name || u.email)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-content">
                  {u.full_name || u.email}
                </p>
                <p className="truncate text-xs text-content-subtle">{u.email}</p>
              </div>
              {!u.is_active && <Badge tone="warning">Désactivé</Badge>}
              <select
                value={u.role}
                onChange={(e) => changeRole(u, e.target.value as RoleName)}
                className="h-8 rounded-lg border border-border bg-bg-inset px-2 text-xs capitalize text-content focus:border-brand focus:outline-none"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </Card>
      )}
      {creating && <CreateUserModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
    </div>
  );
}

function CreateUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleName>("member");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.createUser({ email, password, full_name: fullName || undefined, role });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Inviter un utilisateur"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" onClick={save} loading={saving}>
            Créer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Nom complet">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Mot de passe temporaire" hint="8 caractères minimum">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Rôle">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as RoleName)}
            className="h-10 w-full rounded-lg border border-border bg-bg-inset px-3 text-sm capitalize text-content focus:border-brand focus:outline-none"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        {error && (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listAuditLogs(200)
      .then(setLogs)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }

  return (
    <Card className="divide-y divide-border">
      {logs.map((log) => (
        <div key={log.id} className="flex items-center gap-3 px-4 py-3 text-sm">
          <Badge>{log.action}</Badge>
          <span className="flex-1 truncate text-content-muted">
            {log.resource_type ? `${log.resource_type} ${log.resource_id ?? ""}` : ""}
            {log.ip_address ? ` · ${log.ip_address}` : ""}
          </span>
          <span className="shrink-0 text-xs text-content-subtle">{formatDate(log.created_at)}</span>
        </div>
      ))}
      {logs.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-content-subtle">
          Aucun événement enregistré.
        </div>
      )}
    </Card>
  );
}
