"use client";

import React, { useState } from "react";
import { EvidenceDetail, IntegrityVerificationResult, IntegrityCheck } from "@/types";
import { api } from "@/lib/api";
import { StatusBadge } from "./StatusBadge";
import { ShieldCheck, ShieldAlert, RefreshCw, AlertTriangle, Check, History } from "lucide-react";
import { formatDate, shortenAddress } from "@/lib/utils";

interface VerificationCardProps {
  evidence: EvidenceDetail;
  onVerificationComplete?: () => void;
}

export const VerificationCard: React.FC<VerificationCardProps> = ({
  evidence,
  onVerificationComplete,
}) => {
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] =
    useState<IntegrityVerificationResult | null>(null);
  const [historyChecks, setHistoryChecks] = useState<IntegrityCheck[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);
    try {
      const res = await api.verifyEvidenceIntegrity(evidence.evidence_id);
      setVerificationResult(res);
      if (onVerificationComplete) {
        onVerificationComplete();
      }
    } catch (err: any) {
      setError(err?.message || "Verification request failed.");
    } finally {
      setVerifying(false);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await api.getIntegrityChecks(evidence.evidence_id);
      setHistoryChecks(data);
      setShowHistory(true);
    } catch {
      // ignore
    }
  };

  const isMismatch =
    verificationResult?.result === "MISMATCH" ||
    (!verificationResult && evidence.latest_integrity_status === "MISMATCH");

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-200">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Cryptographic Integrity Verification
            </h3>
            <p className="text-xs text-slate-500">
              Live server-side SHA-256 compared against immutable smart contract record
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadHistory}
            className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-100 rounded text-xs font-medium text-slate-600 flex items-center gap-1 transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            Audit Logs
          </button>
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${verifying ? "animate-spin" : ""}`} />
            {verifying ? "Hashing & Verifying..." : "Verify Integrity Now"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-md flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Tamper Warning Banner if Mismatch */}
        {isMismatch && (
          <div className="p-4 bg-red-50 border-2 border-red-500 rounded-lg text-xs text-red-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-red-700">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              CRITICAL FORENSIC ALERT: CRYPTOGRAPHIC HASH MISMATCH
            </div>
            <p>
              The digital evidence stored on disk does not match the immutable hash registered on the blockchain! 
              The evidence file may have been altered, corrupted, or replaced. Chain-of-custody validity is compromised.
            </p>
          </div>
        )}

        {/* Verification Result Card or Current Status */}
        {verificationResult ? (
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Verification Outcome:</span>
              <StatusBadge status={verificationResult.result} type="integrity" />
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5 font-medium">Authoritative Blockchain Hash:</span>
                <code className="block p-2 bg-slate-900 text-indigo-300 rounded font-mono text-[11px] break-all border border-slate-800">
                  {verificationResult.blockchain_hash}
                </code>
              </div>

              <div>
                <span className="text-slate-500 block mb-0.5 font-medium">Calculated File Hash (Server Disk):</span>
                <code
                  className={`block p-2 rounded font-mono text-[11px] break-all border ${
                    verificationResult.verified
                      ? "bg-slate-900 text-emerald-300 border-slate-800"
                      : "bg-red-950 text-red-300 border-red-800"
                  }`}
                >
                  {verificationResult.calculated_hash}
                </code>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200">
              <span>Timestamp: {formatDate(verificationResult.checked_at)}</span>
              <span className="font-medium text-slate-700">{verificationResult.message}</span>
            </div>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Current Status:</span>
              <StatusBadge
                status={evidence.latest_integrity_status || "NOT_VERIFIED"}
                type="integrity"
              />
            </div>

            <div>
              <span className="text-xs text-slate-500 block mb-0.5 font-medium">
                Registered Blockchain SHA-256 Hash:
              </span>
              <code className="block p-2 bg-slate-900 text-indigo-300 rounded font-mono text-[11px] break-all border border-slate-800">
                {evidence.original_sha256}
              </code>
            </div>

            {evidence.latest_integrity_check && (
              <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200 flex justify-between">
                <span>Last verified: {formatDate(evidence.latest_integrity_check.checked_at)}</span>
                <span>By: {evidence.latest_integrity_check.performed_by_name || "Investigator"}</span>
              </div>
            )}
          </div>
        )}

        {/* Audit History Drawer / Section */}
        {showHistory && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Integrity Verification Log History ({historyChecks.length})
              </h4>
              <button
                onClick={() => setShowHistory(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Hide
              </button>
            </div>

            {historyChecks.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No previous integrity checks found.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100 text-xs">
                {historyChecks.map((check) => (
                  <div key={check.id} className="p-2.5 flex items-center justify-between bg-white hover:bg-slate-50">
                    <div>
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <StatusBadge status={check.result} type="integrity" className="py-0 text-[10px]" />
                        <span className="text-[11px] text-slate-500">
                          {formatDate(check.checked_at)}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate max-w-xs mt-0.5">
                        calc: {check.calculated_hash}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {check.performed_by_name || "Personnel"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

