"use client";

import React from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { RoleBadge } from "@/components/RoleBadge";
import {
  UserCheck,
  Mail,
  Shield,
  KeyRound,
  CheckCircle,
  Copy,
  Info,
} from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Address copied to clipboard!");
  };

  return (
    <ProtectedRoute
      title="Officer Security Profile"
      subtitle="Identity verification and cryptographic signature parameters"
    >
      <div className="max-w-3xl space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-6 bg-slate-900 text-white flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-indigo-600/30 border border-indigo-400 flex items-center justify-center text-indigo-300">
              <UserCheck className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{user?.full_name}</h2>
              <p className="text-xs text-slate-400">{user?.email}</p>
              <div className="mt-2">
                <RoleBadge role={user?.role} />
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-6 space-y-6 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  Email Address
                </span>
                <span className="font-semibold text-slate-800 text-sm">{user?.email}</span>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Account Status
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  Active / Authorized
                </span>
              </div>
            </div>

            {/* Blockchain Address */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                  Assigned Blockchain Address (EOA)
                </span>
                <button
                  onClick={() => user?.blockchain_address && copyToClipboard(user.blockchain_address)}
                  className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Address</span>
                </button>
              </div>
              <code className="block p-3 bg-slate-900 text-indigo-300 rounded font-mono text-xs break-all border border-slate-800">
                {user?.blockchain_address}
              </code>
            </div>

            {/* Role Clearance Details */}
            <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-lg text-slate-700 space-y-2">
              <div className="font-bold text-indigo-900 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-indigo-600" />
                Role Permissions Scope
              </div>
              <p className="text-[11px] leading-relaxed">
                As a <span className="font-bold">{user?.role}</span>, your actions in the terminal are cryptographically logged. Custody handoffs require explicit authorization and are signed against the smart contract relay.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

