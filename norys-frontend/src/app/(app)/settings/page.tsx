"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Database,
  Loader2,
  Save,
  ServerCog,
  XCircle,
} from "lucide-react";

import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { LLMProvider, PlatformSettings, SettingsPatch } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Badge, Button, Card, Field, Input, Skeleton } from "@/components/ui";

const PROVIDERS: { value: LLMProvider; label: string; description: string }[] = [
  {
    value: "ollama",
    label: "Ollama (local)",
    description: "Modèles exécutés en local — données jamais transmises",
  },
  {
    value: "openai",
    label: "OpenAI",
    description: "API OpenAI — GPT-4o, o3, etc.",
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    description: "Accès multi-modèles via OpenRouter",
  },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "owner" || user?.role === "admin";

  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local form state (mirrors settings fields the user can change)
  const [llmProvider, setLlmProvider] = useState<LLMProvider>("ollama");
  const [llmModel, setLlmModel] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [embedProvider, setEmbedProvider] = useState<LLMProvider>("ollama");
  const [embedModel, setEmbedModel] = useState("");
  const [chunkSize, setChunkSize] = useState(800);
  const [chunkOverlap, setChunkOverlap] = useState(100);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        setSettings(s);
        setLlmProvider(s.llm.default_llm_provider);
        setLlmModel(s.llm.default_llm_model);
        setOllamaUrl(s.llm.ollama_base_url);
        setEmbedProvider(s.rag.embedding_provider);
        setEmbedModel(s.rag.embedding_model);
        setChunkSize(s.rag.chunk_size);
        setChunkOverlap(s.rag.chunk_overlap);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const patch: SettingsPatch = {
      default_llm_provider: llmProvider,
      default_llm_model: llmModel,
      ollama_base_url: ollamaUrl,
      embedding_provider: embedProvider,
      embedding_model: embedModel,
      chunk_size: chunkSize,
      chunk_overlap: chunkOverlap,
    };
    try {
      const updated = await api.patchSettings(patch);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Paramètres"
        subtitle="Configuration du provider LLM et du pipeline RAG"
        action={
          canEdit && (
            <Button onClick={handleSave} loading={saving} disabled={loading}>
              {saved ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-success" /> Sauvegardé
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> Sauvegarder
                </>
              )}
            </Button>
          )
        }
      />

      <div className="space-y-8 p-8">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            <XCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ── LLM Provider ─────────────────────────────── */}
        <section>
          <SectionTitle icon={<Bot className="h-4 w-4" />} title="Provider LLM" />
          {loading ? (
            <Skeleton className="h-48" />
          ) : (
            <Card className="divide-y divide-border">
              {/* Provider selector */}
              <div className="p-5">
                <p className="mb-3 text-sm font-medium text-content">Provider par défaut</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {PROVIDERS.map((p) => (
                    <ProviderCard
                      key={p.value}
                      label={p.label}
                      description={p.description}
                      selected={llmProvider === p.value}
                      onSelect={() => setLlmProvider(p.value)}
                      disabled={!canEdit}
                    />
                  ))}
                </div>
              </div>

              {/* Model */}
              <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
                <Field label="Modèle par défaut" hint="Ex: llama3.1, gpt-4o, mixtral-8x7b">
                  <Input
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                    placeholder="llama3.1"
                    disabled={!canEdit}
                  />
                </Field>
                {llmProvider === "ollama" && (
                  <Field label="URL Ollama">
                    <Input
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                      placeholder="http://localhost:11434"
                      disabled={!canEdit}
                    />
                  </Field>
                )}
              </div>

              {/* Key status */}
              {settings && (
                <div className="flex flex-wrap gap-3 p-5">
                  <ApiKeyStatus
                    label="OpenAI API Key"
                    set={settings.llm.openai_api_key_set}
                  />
                  <ApiKeyStatus
                    label="OpenRouter API Key"
                    set={settings.llm.openrouter_api_key_set}
                  />
                  <p className="w-full text-xs text-content-subtle">
                    Les clés API doivent être définies dans les variables d&apos;environnement
                    (<code className="font-mono">NORYS_OPENAI_API_KEY</code>,{" "}
                    <code className="font-mono">NORYS_OPENROUTER_API_KEY</code>).
                  </p>
                </div>
              )}
            </Card>
          )}
        </section>

        {/* ── RAG / Qdrant ──────────────────────────────── */}
        <section>
          <SectionTitle icon={<Database className="h-4 w-4" />} title="Pipeline RAG" />
          {loading ? (
            <Skeleton className="h-48" />
          ) : (
            <Card className="divide-y divide-border">
              {/* Embedding provider */}
              <div className="p-5">
                <p className="mb-3 text-sm font-medium text-content">Provider d&apos;embeddings</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {PROVIDERS.map((p) => (
                    <ProviderCard
                      key={p.value}
                      label={p.label}
                      description={p.description}
                      selected={embedProvider === p.value}
                      onSelect={() => setEmbedProvider(p.value)}
                      disabled={!canEdit}
                    />
                  ))}
                </div>
              </div>

              {/* Embedding model + Qdrant */}
              <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
                <Field
                  label="Modèle d'embedding"
                  hint="Ollama: nomic-embed-text · OpenAI: text-embedding-3-small"
                >
                  <Input
                    value={embedModel}
                    onChange={(e) => setEmbedModel(e.target.value)}
                    placeholder="nomic-embed-text"
                    disabled={!canEdit}
                  />
                </Field>
                {settings && (
                  <Field label="URL Qdrant" hint="Lecture seule — configurer via NORYS_QDRANT_URL">
                    <Input value={settings.rag.qdrant_url} disabled />
                  </Field>
                )}
              </div>

              {/* Chunking */}
              <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
                <Field label="Taille du chunk" hint="Caractères par chunk">
                  <Input
                    type="number"
                    min={100}
                    max={4000}
                    value={chunkSize}
                    onChange={(e) => setChunkSize(Number(e.target.value))}
                    disabled={!canEdit}
                  />
                </Field>
                <Field label="Chevauchement" hint="Overlap entre chunks">
                  <Input
                    type="number"
                    min={0}
                    max={500}
                    value={chunkOverlap}
                    onChange={(e) => setChunkOverlap(Number(e.target.value))}
                    disabled={!canEdit}
                  />
                </Field>
                {settings && (
                  <Field label="Dimension vecteurs" hint="Lecture seule — lié au modèle">
                    <Input value={settings.rag.embedding_dim} disabled />
                  </Field>
                )}
              </div>
            </Card>
          )}
        </section>

        {/* ── System info ───────────────────────────────── */}
        <section>
          <SectionTitle icon={<ServerCog className="h-4 w-4" />} title="Système" />
          {loading ? (
            <Skeleton className="h-20" />
          ) : (
            <Card className="p-5">
              <div className="flex flex-wrap gap-2">
                <Badge>
                  LLM : {settings?.llm.default_llm_provider} / {settings?.llm.default_llm_model}
                </Badge>
                <Badge>
                  Embed : {settings?.rag.embedding_provider} / {settings?.rag.embedding_model}
                </Badge>
                <Badge>Qdrant : {settings?.rag.qdrant_url}</Badge>
              </div>
              <p className="mt-3 text-xs text-content-subtle">
                Certains changements (dimension vecteurs, clés API) nécessitent un redémarrage du service.
              </p>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-brand-hover">{icon}</span>
      <h2 className="text-sm font-semibold text-content">{title}</h2>
    </div>
  );
}

function ProviderCard({
  label,
  description,
  selected,
  onSelect,
  disabled,
}: {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        selected
          ? "border-brand bg-brand-subtle"
          : "border-border hover:border-border-strong"
      } ${disabled ? "cursor-default opacity-60" : "cursor-pointer"}`}
    >
      <p className={`text-sm font-medium ${selected ? "text-brand-hover" : "text-content"}`}>
        {label}
      </p>
      <p className="mt-0.5 text-xs text-content-subtle">{description}</p>
    </button>
  );
}

function ApiKeyStatus({ label, set }: { label: string; set: boolean }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs">
      {set ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-content-muted" />
      )}
      <span className={set ? "text-content" : "text-content-muted"}>{label}</span>
      <Badge tone={set ? "success" : "neutral"} className="ml-1">
        {set ? "Configurée" : "Non définie"}
      </Badge>
    </div>
  );
}
