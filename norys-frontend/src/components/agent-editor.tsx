"use client";

import { useState } from "react";

import { api, ApiError } from "@/lib/api";
import type { Agent, AgentInput } from "@/lib/types";
import { Button, Field, Input, Textarea } from "./ui";
import { Modal } from "./modal";

const CATEGORIES = ["general", "helpdesk", "hr", "support", "documents", "devops"];

export function AgentEditor({
  agent,
  onClose,
  onSaved,
}: {
  agent: Agent | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<AgentInput & { is_active?: boolean }>({
    name: agent?.name ?? "",
    description: agent?.description ?? "",
    category: agent?.category ?? "general",
    system_prompt: agent?.system_prompt ?? "",
    provider: agent?.provider ?? null,
    model: agent?.model ?? null,
    temperature: agent?.temperature ?? 0.7,
    use_rag: agent?.use_rag ?? false,
    requires_human_approval: agent?.requires_human_approval ?? false,
    is_active: agent?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (agent) {
        await api.updateAgent(agent.id, form);
      } else {
        await api.createAgent(form);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de l'enregistrement");
      setSaving(false);
    }
  }

  async function remove() {
    if (!agent) return;
    if (!confirm(`Supprimer l'agent « ${agent.name} » ?`)) return;
    setSaving(true);
    try {
      await api.deleteAgent(agent.id);
      onSaved();
    } catch {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={agent ? "Modifier l'agent" : "Nouvel agent"}
      onClose={onClose}
      footer={
        <>
          {agent && (
            <Button variant="danger" size="sm" onClick={remove} disabled={saving} className="mr-auto">
              Supprimer
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" onClick={save} loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nom">
          <Input value={form.name} onChange={(e) => update("name", e.target.value)} />
        </Field>
        <Field label="Description">
          <Input
            value={form.description ?? ""}
            onChange={(e) => update("description", e.target.value)}
          />
        </Field>
        <Field label="Catégorie">
          <select
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-bg-inset px-3 text-sm text-content focus:border-brand focus:outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Instructions système" hint="Le rôle et le comportement de l'agent">
          <Textarea
            rows={5}
            value={form.system_prompt ?? ""}
            onChange={(e) => update("system_prompt", e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Provider" hint="Vide = défaut">
            <Input
              value={form.provider ?? ""}
              placeholder="ollama"
              onChange={(e) => update("provider", e.target.value || null)}
            />
          </Field>
          <Field label="Modèle" hint="Vide = défaut">
            <Input
              value={form.model ?? ""}
              placeholder="llama3.1"
              onChange={(e) => update("model", e.target.value || null)}
            />
          </Field>
        </div>
        <Field label={`Température : ${form.temperature?.toFixed(1)}`}>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={form.temperature}
            onChange={(e) => update("temperature", parseFloat(e.target.value))}
            className="w-full accent-brand"
          />
        </Field>
        <div className="space-y-2">
          <Toggle
            label="Mémoire documentaire (RAG)"
            checked={!!form.use_rag}
            onChange={(v) => update("use_rag", v)}
          />
          <Toggle
            label="Validation humaine avant actions sensibles"
            checked={!!form.requires_human_approval}
            onChange={(v) => update("requires_human_approval", v)}
          />
          {agent && (
            <Toggle
              label="Agent actif"
              checked={!!form.is_active}
              onChange={(v) => update("is_active", v)}
            />
          )}
        </div>

        {error && (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-lg border border-border bg-bg-inset px-3 py-2.5 text-left text-sm text-content"
    >
      {label}
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-brand" : "bg-border-strong"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  );
}
