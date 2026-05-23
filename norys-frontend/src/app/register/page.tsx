"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Button, Field, Input } from "@/components/ui";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function RegisterPage() {
  const { register } = useAuth();
  const [tenantName, setTenantName] = useState("");
  const [slug, setSlug] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({
        tenant_name: tenantName,
        tenant_slug: slug || slugify(tenantName),
        email,
        password,
        full_name: fullName || undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Inscription impossible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="norys-backdrop flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-content">Créer votre organisation</h1>
          <p className="mt-1 text-sm text-content-subtle">
            Votre plateforme IA privée en quelques secondes
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border bg-bg-subtle p-6 shadow-soft">
          <Field label="Nom de l'organisation">
            <Input
              placeholder="Acme Inc."
              value={tenantName}
              onChange={(e) => {
                setTenantName(e.target.value);
                setSlug(slugify(e.target.value));
              }}
              required
              autoFocus
            />
          </Field>
          <Field label="Identifiant d'espace" hint="Utilisé pour la connexion (a-z, 0-9, tirets)">
            <Input
              placeholder="acme"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              required
            />
          </Field>
          <Field label="Votre nom">
            <Input
              placeholder="Jean Dupont"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              placeholder="vous@entreprise.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Mot de passe" hint="8 caractères minimum">
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </Field>

          {error && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Créer mon espace
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-content-subtle">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-brand-hover hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
