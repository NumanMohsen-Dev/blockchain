"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, Lock, Mail, AlertCircle, ArrowRight, UserCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login({ email: email.trim(), password });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Invalid credentials or inactive account.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("EvidencePass123!");
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex p-3 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400 mb-3">
          <ShieldCheck className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">
          Evidence Chain of Custody
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Cryptographic Forensic Evidence & Custody Verification System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 border border-slate-800 py-8 px-6 shadow-2xl rounded-xl sm:px-10">
          {error && (
            <div className="mb-5 p-3 bg-red-950/50 border border-red-800 rounded-lg text-xs text-red-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Forensic Officer Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="officer@evidence.org"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-500 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-600/30"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Terminal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Demonstration Quick Fill Accounts */}
          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
              Demo Role Accounts (Password: EvidencePass123!)
            </p>
            <div className="grid grid-cols-1 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => handleQuickLogin("admin@evidence.org")}
                className="text-left px-2.5 py-1.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center justify-between transition-colors"
              >
                <span>admin@evidence.org</span>
                <span className="text-[10px] text-purple-400 font-semibold">ADMIN</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin("collector@evidence.org")}
                className="text-left px-2.5 py-1.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center justify-between transition-colors"
              >
                <span>collector@evidence.org</span>
                <span className="text-[10px] text-blue-400 font-semibold">COLLECTOR</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin("investigator@evidence.org")}
                className="text-left px-2.5 py-1.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center justify-between transition-colors"
              >
                <span>investigator@evidence.org</span>
                <span className="text-[10px] text-amber-400 font-semibold">INVESTIGATOR</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin("analyst@evidence.org")}
                className="text-left px-2.5 py-1.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center justify-between transition-colors"
              >
                <span>analyst@evidence.org</span>
                <span className="text-[10px] text-cyan-400 font-semibold">ANALYST</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin("court@evidence.org")}
                className="text-left px-2.5 py-1.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center justify-between transition-colors"
              >
                <span>court@evidence.org</span>
                <span className="text-[10px] text-emerald-400 font-semibold">COURT</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

