"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { DashboardStats, DashboardRecentActivity } from "@/types";
import {
  FileBox,
  UserCheck,
  ArrowRightLeft,
  AlertTriangle,
  Users,
  FilePlus2,
  ShieldCheck,
  Blocks,
  ArrowRight,
  Clock,
} from "lucide-react";
import { formatDate, shortenHash } from "@/lib/utils";

export default function DashboardPage() {
  const { user, canRegisterEvidence, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<DashboardRecentActivity | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([api.getDashboardStats(), api.getDashboardActivity()])
      .then(([statsData, actData]) => {
        if (isMounted) {
          setStats(statsData);
          setActivity(actData);
        }
      })
      .catch((err) => {
        console.error("Dashboard data load error:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <ProtectedRoute
      title="Forensic Operations Dashboard"
      subtitle="Chain-of-custody oversight and cryptographic evidence metrics"
    >
      <div className="space-y-8 max-w-7xl">
        {/* Welcome Banner */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              Welcome, {user?.full_name}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Active Role: <span className="font-semibold text-slate-700">{user?.role}</span> &bull; Blockchain Wallet:{" "}
              <span className="font-mono text-indigo-600">{user?.blockchain_address}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {canRegisterEvidence && (
              <Link
                href="/evidence/register"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                <FilePlus2 className="w-4 h-4" />
                <span>Register Evidence</span>
              </Link>
            )}
            <Link
              href="/evidence"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition-colors"
            >
              <FileBox className="w-4 h-4" />
              <span>Browse Vault</span>
            </Link>
          </div>
        </div>

        {/* Statistical Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Total Evidence */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Evidence
              </span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <FileBox className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-800 mt-2">
              {stats?.total_evidence ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Registered in vault</div>
          </div>

          {/* My Custody */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                In My Custody
              </span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-indigo-600 mt-2">
              {stats?.my_custody_count ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Under your legal care</div>
          </div>

          {/* Custody Transfers */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Custody Transfers
              </span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-800 mt-2">
              {stats?.total_transfers ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Smart contract handoffs</div>
          </div>

          {/* Integrity Warnings */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Tamper Warnings
              </span>
              <div
                className={`p-2 rounded-lg ${
                  (stats?.integrity_warnings ?? 0) > 0
                    ? "bg-red-100 text-red-600 animate-pulse"
                    : "bg-emerald-50 text-emerald-600"
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div
              className={`text-2xl font-extrabold mt-2 ${
                (stats?.integrity_warnings ?? 0) > 0 ? "text-red-600" : "text-emerald-600"
              }`}
            >
              {stats?.integrity_warnings ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Cryptographic mismatches</div>
          </div>

          {/* Active Users */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active Officers
              </span>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-800 mt-2">
              {stats?.active_users ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Authorized personnel</div>
          </div>
        </div>

        {/* Quick Operations & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Quick Actions & Chain Summary */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">
                Quick Actions
              </h3>
              <div className="space-y-2.5">
                {canRegisterEvidence && (
                  <Link
                    href="/evidence/register"
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors text-xs font-semibold text-slate-700 group"
                  >
                    <div className="flex items-center gap-2.5">
                      <FilePlus2 className="w-4 h-4 text-indigo-600" />
                      <span>Register New Digital Evidence</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                  </Link>
                )}
                <Link
                  href="/evidence"
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors text-xs font-semibold text-slate-700 group"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Verify Evidence & Check Custody</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                </Link>
                <Link
                  href="/blockchain"
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors text-xs font-semibold text-slate-700 group"
                >
                  <div className="flex items-center gap-2.5">
                    <Blocks className="w-4 h-4 text-amber-600" />
                    <span>View Blockchain Transactions</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                </Link>
                {isAdmin && (
                  <Link
                    href="/users"
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors text-xs font-semibold text-slate-700 group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Users className="w-4 h-4 text-purple-600" />
                      <span>Manage Officer Clearances</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                  </Link>
                )}
              </div>
            </div>

            {/* Architecture Explanatory Notice */}
            <div className="bg-slate-900 text-slate-300 rounded-xl p-5 border border-slate-800 text-xs space-y-2">
              <div className="font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                Immutable Trust Protocol
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Raw files remain encrypted in secure persistent storage. Only the cryptographic SHA-256 fingerprint, custody transitions, and forensic event logs are committed to the blockchain.
              </p>
            </div>
          </div>

          {/* Right Column: Recent Activity Logs */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Recent Activity & Transactions</span>
              <span className="text-xs text-slate-400 font-normal">Real-Time Audit Stream</span>
            </h3>

            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Loading audit trail...
              </div>
            ) : !activity?.recent_transactions?.length && !activity?.recent_audits?.length ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No system activity recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
                {/* Recent Blockchain Transactions */}
                {activity?.recent_transactions?.map((tx: any) => (
                  <div key={tx.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded mt-0.5">
                        <Blocks className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">
                          {tx.transaction_type.replace(/_/g, " ")}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                          Tx: {shortenHash(tx.transaction_hash)} &bull; Block #{tx.block_number ?? "Pending"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(tx.created_at)}</span>
                    </div>
                  </div>
                ))}

                {/* Recent Audits */}
                {activity?.recent_audits?.map((audit: any) => (
                  <div key={audit.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-slate-100 text-slate-600 rounded mt-0.5">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-medium text-slate-700">
                          {audit.action}: {audit.description}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          User: {audit.user_email || "System"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-slate-400">
                      {formatDate(audit.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

