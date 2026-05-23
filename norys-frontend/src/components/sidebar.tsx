"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  FileText,
  LayoutDashboard,
  PlugZap,
  LogOut,
  MessagesSquare,
  Settings,
  Shield,
  Sparkles,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { cn, initials } from "@/lib/utils";
import { Avatar } from "./ui";

const NAV = [
  { href: "/cockpit", label: "Cockpit", icon: LayoutDashboard },
  { href: "/chat", label: "Assistants", icon: MessagesSquare },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/applications", label: "Applications", icon: PlugZap },
  { href: "/documents", label: "Documents", icon: FileText },
];

const ADMIN_NAV = [
  { href: "/admin", label: "Administration", icon: Shield },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "owner" || user?.role === "admin";

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-bg-subtle">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-content">Norys</p>
          <p className="text-[11px] text-content-subtle">Centre de commande IA</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((item) => (
          <NavLink key={item.href} {...item} active={pathname.startsWith(item.href)} />
        ))}
        {isAdmin && (
          <>
            <div className="px-3 pb-1.5 pt-5 text-[11px] font-medium uppercase tracking-wide text-content-subtle">
              Espace admin
            </div>
            {ADMIN_NAV.map((item) => (
              <NavLink key={item.href} {...item} active={pathname.startsWith(item.href)} />
            ))}
          </>
        )}
      </nav>

      {/* User */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <Avatar label={initials(user?.full_name || user?.email)} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-content">
              {user?.full_name || user?.email}
            </p>
            <p className="truncate text-[11px] capitalize text-content-subtle">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            title="Se déconnecter"
            className="rounded-md p-1.5 text-content-subtle transition-colors hover:bg-bg-elevated hover:text-content"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Bot;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-bg-elevated text-content"
          : "text-content-muted hover:bg-bg-elevated/60 hover:text-content",
      )}
    >
      <Icon className={cn("h-4 w-4", active ? "text-brand-hover" : "")} />
      {label}
    </Link>
  );
}
