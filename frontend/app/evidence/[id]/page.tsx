"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { EvidenceDetail } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { RoleBadge } from "@/components/RoleBadge";
import { VerificationCard } from "@/components/VerificationCard";
import { TransferModal } from "@/components/TransferModal";
import { HistoryTimeline } from "@/components/HistoryTimeline";
import {
  FileBox,
  Download,
  ArrowRightLeft,
  Blocks,
  MapPin,
  Calendar,
  UserCheck,
  ShieldAlert,
  ArrowLeft,
  Hash,
  AlertCircle,
  FileText,
} from "lucide-react";
import { formatDate, formatBytes, shortenAddress, shortenHash } from "@/lib/utils";

export default function EvidenceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const evidenceId = params.id as string;
  const { user, isAdmin } = useAuth();

  const [evidence, setEvidence] = useState<EvidenceDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);

  const fetchEvidence = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getEvidenceById(evidenceId);
      setEvidence(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load evidence detail.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (evidenceId) {
      fetchEvidence();
    }
  }, [evidenceId]);

  const handleDownload = async () => {
    if (!evidence) return;
    setDownloading(true);
    try {
      await api.downloadEvidenceFile(evidence.evidence_id, evidence.original_filename);
    } catch (err: any) {
      alert("File download failed: " + (err?.message || "File unavailable"));
    } finally {
      setDownloading(false);
    }
  };

  const isCurrentCustodian =
    user && evidence?.current_custodian && user.id === evidence.current_custodian.id;
  const canInitiateTransfer = isCurrentCustodian || isAdmin;

  if (loading) {
    return (
      <ProtectedRoute title="Evidence Dossier">
        <div className="py-24 text-center text-xs text-slate-400">
          Loading forensic evidence dossier and querying smart contract...
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !evidence) {
    return (
      <ProtectedRoute title="Evidence Dossier">
        <div className="max-w-xl mx-auto py-12 text-center space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span>{error || "Evidence item not found"}</span>
          </div>
          <Link
            href="/evidence"
            className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Evidence Vault</span>
          </Link>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute
      title={`Evidence Record: ${evidence.evidence_id}`}
      subtitle={`Case #${evidence.case_number} &bull; ${evidence.category}`}
    >
      <div className="space-y-6 max-w-7xl">
        {/* Navigation Breadcrumb and Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Link
            href="/evidence"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Evidence Catalog</span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloading ? "Downloading..." : "Download Original File"}</span>
            </button>

            {canInitiateTransfer && (
              <button
                onClick={() => setIsTransferModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Transfer Custody</span>
              </button>
            )}
          </div>
        </div>

        {/* Top Summary Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded">
                  {evidence.evidence_id}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  {evidence.category}
                </span>
                <StatusBadge status={evidence.registration_status} />
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1">{evidence.title}</h1>
              <p className="text-xs text-slate-600 mt-2 max-w-3xl leading-relaxed">
                {evidence.description}
              </p>
            </div>

            <div className="text-right flex-shrink-0">
              <div className="text-[11px] text-slate-400">Current Custody Status</div>
              <div className="text-sm font-bold text-slate-800 mt-0.5">
                {evidence.current_custodian?.full_name}
              </div>
              <RoleBadge role={evidence.current_custodian?.role} className="mt-1" />
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-slate-500 block mb-1 flex items-center gap-1 font-medium">
                <FileText className="w-3.5 h-3.5" />
                Case Reference
              </span>
              <span className="font-mono font-bold text-slate-800 text-sm">
                {evidence.case_number}
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-slate-500 block mb-1 flex items-center gap-1 font-medium">
                <MapPin className="w-3.5 h-3.5" />
                Collection Location
              </span>
              <span className="font-semibold text-slate-800">
                {evidence.collection_location}
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-slate-500 block mb-1 flex items-center gap-1 font-medium">
                <Calendar className="w-3.5 h-3.5" />
                Collection Date/Time
              </span>
              <span className="font-semibold text-slate-800">
                {formatDate(evidence.collection_datetime)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-slate-500 block mb-1 flex items-center gap-1 font-medium">
                <Blocks className="w-3.5 h-3.5" />
                Original File Size
              </span>
              <span className="font-semibold text-slate-800">
                {formatBytes(evidence.file_size)} &bull; {evidence.mime_type}
              </span>
            </div>
          </div>

          {/* Blockchain Footprint Row */}
          <div className="p-4 bg-slate-900 text-slate-200 rounded-lg border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
              <span className="font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Blocks className="w-4 h-4" />
                Ethereum Smart Contract Anchor
              </span>
              <span className="text-[11px] text-slate-400">
                Block #{evidence.blockchain_block_number ?? "Confirmed"}
              </span>
            </div>

            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                <span className="text-slate-400">Transaction Hash:</span>
                <span className="text-indigo-300 break-all select-all">
                  {evidence.blockchain_transaction_hash || "Pending on-chain"}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                <span className="text-slate-400">Immutable Original SHA-256:</span>
                <span className="text-emerald-400 break-all select-all font-bold">
                  {evidence.original_sha256}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cryptographic Verification Card */}
        <VerificationCard
          evidence={evidence}
          onVerificationComplete={fetchEvidence}
        />

        {/* Chronological Custody History Timeline */}
        <HistoryTimeline
          evidenceId={evidence.evidence_id}
          registrationDate={evidence.created_at}
          initialCustodianName={evidence.initial_custodian?.full_name}
          initialCustodianAddress={evidence.initial_custodian?.blockchain_address}
          initialCustodianRole={evidence.initial_custodian?.role}
          initialTxHash={evidence.blockchain_transaction_hash}
          initialBlockNumber={evidence.blockchain_block_number}
        />

        {/* Custody Transfer Modal */}
        <TransferModal
          evidence={evidence}
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          onSuccess={() => {
            setIsTransferModalOpen(false);
            fetchEvidence();
          }}
        />
      </div>
    </ProtectedRoute>
  );
}

