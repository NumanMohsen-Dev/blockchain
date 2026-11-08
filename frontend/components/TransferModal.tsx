"use client";

import React, { useState, useEffect } from "react";
import { User, EvidenceDetail } from "@/types";
import { api } from "@/lib/api";
import { RoleBadge } from "./RoleBadge";
import { X, Send, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { shortenAddress, shortenHash } from "@/lib/utils";

interface TransferModalProps {
  evidence: EvidenceDetail;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  evidence,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");
  const [reason, setReason] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<{
    transaction_hash: string;
    block_number: number;
    new_custodian: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setTxResult(null);
      setReason("");
      setSelectedUserId("");
      // Fetch available recipients
      api
        .getUsers({ is_active: true })
        .then((data) => {
          // Filter out current custodian
          const eligible = data.filter(
            (u) => u.id !== evidence.current_custodian?.id
          );
          setUsers(eligible);
        })
        .catch(() => {
          setError("Failed to load potential recipients.");
        });
    }
  }, [isOpen, evidence]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError("Please select an authorized recipient.");
      return;
    }
    if (!reason.trim()) {
      setError("A documented reason for custody transfer is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.transferCustody(evidence.evidence_id, {
        new_custodian_id: Number(selectedUserId),
        reason: reason.trim(),
      });

      setTxResult({
        transaction_hash: res.transaction_hash,
        block_number: res.block_number,
        new_custodian: res.new_custodian,
      });

      // Notify parent to refresh
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || "Failed to transfer custody.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Transfer Evidence Custody
            </h3>
            <p className="text-xs text-slate-500">
              Case Item ID: <span className="font-mono font-semibold">{evidence.evidence_id}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {txResult ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-800">
                Custody Successfully Transferred
              </h4>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                The smart contract has recorded this custody transfer on the blockchain.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-left space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">New Custodian:</span>
                  <span className="font-semibold text-slate-800">{txResult.new_custodian}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Block Number:</span>
                  <span className="font-mono text-slate-700">#{txResult.block_number}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Tx Hash:</span>
                  <span className="font-mono text-[11px] text-indigo-600 truncate max-w-[200px]" title={txResult.transaction_hash}>
                    {shortenHash(txResult.transaction_hash)}
                  </span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full mt-4 py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Current Custodian Read-only info */}
              <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                <div className="text-xs text-slate-500 mb-1">Current Custodian:</div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-slate-800">
                      {evidence.current_custodian?.full_name}
                    </span>
                    <span className="text-xs text-slate-500 ml-2">
                      ({shortenAddress(evidence.current_custodian?.blockchain_address)})
                    </span>
                  </div>
                  <RoleBadge role={evidence.current_custodian?.role} />
                </div>
              </div>

              {/* Recipient Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Transfer To (New Custodian) *
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : "")}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">-- Select Authorized Personnel --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role}) - {u.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Transfer Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Transfer *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  rows={3}
                  placeholder="e.g., Transferring physical drive to Ballistics & Digital Forensics Lab for write-block image extraction..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                />
              </div>

              <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-md text-[11px] text-indigo-900 leading-relaxed">
                <strong>Chain of Custody Protocol:</strong> This transfer generates an immutable, timestamped event on the blockchain smart contract and updates legal accountability.
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 border border-slate-300 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Executing On-Chain...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Confirm & Sign Transfer
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

