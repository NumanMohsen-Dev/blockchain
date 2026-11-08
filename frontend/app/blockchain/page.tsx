"use client";

import React, { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { api } from "@/lib/api";
import { BlockchainStatus } from "@/types";
import {
  Blocks,
  Cpu,
  Layers,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { formatDate, shortenHash } from "@/lib/utils";
import Link from "next/link";

export default function BlockchainActivityPage() {
  const [status, setStatus] = useState<BlockchainStatus | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [skip, setSkip] = useState<number>(0);
  const limit = 10;
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      api.getBlockchainStatus(),
      api.getBlockchainTransactions({ skip, limit }),
    ])
      .then(([statusData, txData]) => {
        if (isMounted) {
          setStatus(statusData);
          setTransactions(txData.items || []);
          setTotal(txData.total || 0);
        }
      })
      .catch((err) => {
        console.error("Blockchain fetch error:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [skip]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(skip / limit) + 1;

  return (
    <ProtectedRoute
      title="Blockchain Activity & Node Monitor"
      subtitle="Application-specific smart contract transactions and Hardhat ledger status"
    >
      <div className="space-y-6 max-w-7xl">
        {/* Node & Contract Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          {/* Node Connection */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-500 font-medium">
              <span>Node Connection</span>
              <Cpu className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex items-center gap-2">
              {status?.connected ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="text-base font-bold text-slate-800">Operational</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-500" />
                  <span className="text-base font-bold text-red-600">Disconnected</span>
                </>
              )}
            </div>
            <div className="text-[11px] text-slate-400 font-mono truncate">
              {status?.rpc_url || "http://blockchain:8545"}
            </div>
          </div>

          {/* Chain ID */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-500 font-medium">
              <span>Network Chain ID</span>
              <Layers className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-base font-bold font-mono text-slate-800">
              {status?.chain_id ?? 31337}
            </div>
            <div className="text-[11px] text-slate-400">Hardhat Local Private Network</div>
          </div>

          {/* Latest Block */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-500 font-medium">
              <span>Block Height</span>
              <Blocks className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-base font-bold font-mono text-indigo-600">
              #{status?.latest_block_number ?? 0}
            </div>
            <div className="text-[11px] text-slate-400">Total ledger blocks mined</div>
          </div>

          {/* Contract Address */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-500 font-medium">
              <span>Evidence Contract</span>
              <ShieldCheck className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-xs font-mono font-bold text-slate-800 truncate" title={status?.contract_address || ""}>
              {status?.contract_address || "0x..."}
            </div>
            <div className="text-[11px] text-emerald-600 font-medium">
              {status?.contract_accessible ? "Smart Contract Verified" : "Connecting..."}
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Application Blockchain Transactions
              </h3>
              <p className="text-xs text-slate-500">
                All confirmed ledger mutations emitted by the chain-of-custody smart contract
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full">
              {total} Total Transactions
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
                  <th className="py-3 px-4">Transaction Hash</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Evidence ID</th>
                  <th className="py-3 px-4">Block #</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Querying transaction ledger...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No blockchain transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-indigo-600 font-medium">
                        {tx.transaction_hash}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium">
                        {tx.evidence?.evidence_id ? (
                          <Link
                            href={`/evidence/${tx.evidence.evidence_id}`}
                            className="text-slate-800 hover:text-indigo-600 hover:underline"
                          >
                            {tx.evidence.evidence_id}
                          </Link>
                        ) : (
                          "N/A"
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        #{tx.block_number ?? "Confirmed"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          CONFIRMED
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-500">
                        {formatDate(tx.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing {transactions.length} of {total} transactions
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSkip(Math.max(0, skip - limit))}
                disabled={skip === 0}
                className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>
                Page {currentPage} of {totalPages || 1}
              </span>
              <button
                onClick={() => setSkip(skip + limit)}
                disabled={skip + limit >= total}
                className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

