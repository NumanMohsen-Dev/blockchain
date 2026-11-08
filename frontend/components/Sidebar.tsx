"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { RoleBadge } from "./RoleBadge";
import {
  ShieldCheck,
  LayoutDashboard,
  FileBox,
  FilePlus2,
  Blocks,
  Users,
  UserCheck,
  LogOut,
} from "lucide-react";
import { cn, shortenAddress } from "@/lib/utils";

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { user, logout, canRegisterEvidence, isAdmin } = useAuth();

  const navItems = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      show: true,
    },
    {
      label: "Evidence Vault",
      href: "/evidence",
      icon: FileBox,
      show: true,
    },
    {
      label: "Register Evidence",
      href: "/evidence/register",
      icon: FilePlus2,
      show: canRegisterEvidence,
    },
    {
      label: "Blockchain Activity",
      href: "/blockchain",
      icon: Blocks,
      show: true,
    },
    {
      label: "User Management",
      href: "/users",
      icon: Users,
      show: isAdmin,
    },
    {
      label: "Profile",
      href: "/profile",
      icon: UserCheck,
      show: true,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen fixed left-0 top-0 text-slate-300 z-30 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3 bg-slate-950/60">
        <div className="p-2 bg-indigo-600/20 rounded-lg border border-indigo-500/30 text-indigo-400">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-white uppercase">
            Evidence Chain
          </h1>
          <p className="text-[11px] text-slate-400 font-mono tracking-wider">
            CUSTODY PROTOCOL
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
        <div className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Main Menu
        </div>
        {navItems
          .filter((item) => item.show)
          .map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive ? "text-white" : "text-slate-400")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
      </nav>

      {/* User Footer Profile */}
      {user && (
        <div className="p-4 border-t border-slate-800 bg-slate-950/80">
          <div className="mb-3">
            <div className="text-xs font-semibold text-white truncate">
              {user.full_name}
            </div>
            <div className="text-[11px] text-slate-400 truncate mb-1.5">
              {user.email}
            </div>
            <RoleBadge role={user.role} className="text-[10px] py-0 px-2" />
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="font-mono text-[10px] text-slate-500">
              {shortenAddress(user.blockchain_address)}
            </span>
            <button
              onClick={() => logout()}
              className="flex items-center gap-1 text-slate-400 hover:text-red-400 text-xs transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

