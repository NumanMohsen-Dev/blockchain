"use client";

import React, { useEffect, useState } from "react";
import { CustodyHistoryItem } from "@/types";
import { api } from "@/lib/api";
import { RoleBadge } from "./RoleBadge";
import { GitCommit, ArrowRight, ShieldCheck, Blocks, Clock, AlertCircle } from "lucide-react";
import { formatDate, shortenAddress, shortenHash } from "@/lib/utils";

interface HistoryTimelineProps {
  evidenceId: string;
  registrationDate?: string;
  initialCustodianName?: string;
  initialCustodianAddress?: string;
  initialCustodianRole?: string;
  initialTxHash?: string | null;
  initialBlockNumber?: number | null;
}

export const HistoryTimeline: React.FC<HistoryTimelineProps> = ({
  evidenceId,
  registrationDate,
  initialCustodianName,
  initialCustodianAddress,
  initialCustodianRole,
  initialTxHash,
  initialBlockNumber,
}) => {
  const [history, setHistory] = useState<CustodyHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    api
      .getCustodyHistory(evidenceId)
      .then((res) => {
        if (isMounted) setHistory(res.history || []);
      })
      .catch((err) => {
        if (isMounted) setError(err?.message || "Failed to load custody timeline");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [evidenceId]);

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            Authoritative Chain-of-Custody Timeline
          </h3>
          <p className="text-xs text-slate-500">
            Immutable custody sequence verified from smart contract event logs
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-full text-slate-700">
          {history.length + 1} Custody Events
        </span>
      </div>

      {loading && (
        <div className="py-8 text-center text-xs text-slate-400">
          Querying blockchain event logs...
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && (
        <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {/* Event 0: Initial Registration */}
          <div className="relative group">
            {/* Timeline Node */}
            <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center ring-4 ring-white shadow-sm">
              <span className="text-[10px] font-bold">1</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                    Evidence Registered & Secured
                  </span>
                  <span className="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded font-semibold">
                    Origin
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatDate(registrationDate)}</span>
                </div>
              </div>

              <div className="text-xs text-slate-700">
                <span className="text-slate-500">Initial Custodian: </span>
                <span className="font-semibold text-slate-900">
                  {initialCustodianName || "Evidence Collector"}
                </span>
                {initialCustodianRole && (
                  <RoleBadge role={initialCustodianRole} className="ml-2 text-[10px] py-0 px-1.5" />
                )}
                <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                  Address: {initialCustodianAddress || "0x..."}
                </div>
              </div>

              {initialTxHash && (
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1">
                    <Blocks className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Block #{initialBlockNumber ?? "Confirmed"}</span>
                  </div>
                  <div className="font-mono text-[10px] text-indigo-600">
                    Tx: {shortenHash(initialTxHash)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Subsequent Transfers */}
          {history.map((item, index) => (
            <div key={index} className="relative group">
              {/* Timeline Node */}
              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center ring-4 ring-white shadow-sm">
                <span className="text-[10px] font-bold">{index + 2}</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                    Custody Transfer Handover #{item.transfer_number}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatDate(item.block_timestamp)}</span>
                  </div>
                </div>

                {/* Handover Flow */}
                <div className="p-2.5 bg-white border border-slate-200 rounded flex flex-wrap items-center gap-3 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400">Previous Custodian</div>
                    <div className="font-semibold text-slate-800">{item.from_name}</div>
                    <div className="font-mono text-[10px] text-slate-400">
                      {shortenAddress(item.from_address)}
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-400 mx-auto sm:mx-2" />

                  <div>
                    <div className="text-[10px] text-slate-400">New Custodian</div>
                    <div className="font-semibold text-indigo-700">{item.to_name}</div>
                    <div className="font-mono text-[10px] text-slate-400">
                      {shortenAddress(item.to_address)}
                    </div>
                  </div>
                </div>

                {/* Transfer Reason */}
                <div className="text-xs bg-slate-100/70 p-2 rounded border border-slate-200/60">
                  <span className="font-semibold text-slate-600">Transfer Reason: </span>
                  <span className="text-slate-800 italic">"{item.reason}"</span>
                </div>

                {/* Blockchain Proof Reference */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1">
                    <Blocks className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Block #{item.block_number}</span>
                  </div>
                  <div className="font-mono text-[10px] text-indigo-600" title={item.transaction_hash}>
                    Tx: {shortenHash(item.transaction_hash)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

