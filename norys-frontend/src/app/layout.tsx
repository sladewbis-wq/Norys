import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Norys — Centre de commande IA privé",
  description:
    "La plateforme IA souveraine et self-hosted pour les entreprises. Le centre de commande IA privé pour PME et équipes internes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
