"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/cockpit" : "/login");
  }, [user, loading, router]);

  return (
    <div className="norys-backdrop flex h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-content-subtle" />
    </div>
  );
}
