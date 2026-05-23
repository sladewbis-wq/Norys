"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Button, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const { login } = useAuth();
  const [tenant, setTenant] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password, tenant);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connexion impossible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="norys-backdrop flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-content">Bienvenue sur Norys</h1>
          <p className="mt-1 text-sm text-content-subtle">
            Connectez-vous à votre espace de travail
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border bg-bg-subtle p-6 shadow-soft">
          <Field label="Espace de travail">
            <Input
              placeholder="acme"
              value={tenant}
              onChange={(e) => setTenant(e.target.value)}
              required
              autoFocus
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
          <Field label="Mot de passe">
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>

          {error && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Se connecter
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-content-subtle">
          Pas encore d&apos;espace ?{" "}
          <Link href="/register" className="text-brand-hover hover:underline">
            Créer une organisation
          </Link>
        </p>
      </div>
    </div>
  );
}
