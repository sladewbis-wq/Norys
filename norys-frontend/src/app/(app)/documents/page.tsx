"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";

import { api, ApiError } from "@/lib/api";
import type { DocumentMeta } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Badge, Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { formatBytes } from "@/lib/utils";

const STATUS_TONE: Record<DocumentMeta["status"], "neutral" | "brand" | "success" | "warning" | "danger"> = {
  uploaded: "neutral",
  processing: "warning",
  indexed: "success",
  failed: "danger",
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    api
      .listDocuments()
      .then(setDocs)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  async function onUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      await api.uploadDocument(file);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec du téléversement");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Supprimer ce document ?")) return;
    await api.deleteDocument(id);
    load();
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Base documentaire privée de votre organisation (RAG)"
        action={
          <>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
            />
            <Button loading={uploading} onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Téléverser
            </Button>
          </>
        }
      />

      <div className="p-8">
        {error && (
          <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="Aucun document"
            description="Téléversez des documents pour enrichir la mémoire de vos agents."
          />
        ) : (
          <Card className="divide-y divide-border">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-elevated">
                  <FileText className="h-4 w-4 text-content-muted" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-content">{doc.filename}</p>
                  <p className="text-xs text-content-subtle">{formatBytes(doc.size_bytes)}</p>
                </div>
                <Badge tone={STATUS_TONE[doc.status]}>{doc.status}</Badge>
                <button
                  onClick={() => onDelete(doc.id)}
                  className="rounded-md p-2 text-content-subtle transition-colors hover:bg-bg-elevated hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
