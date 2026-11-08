"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { EvidenceListItem, EvidenceCategory } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { RoleBadge } from "@/components/RoleBadge";
import {
  FileBox,
  Search,
  Filter,
  FilePlus2,
  ChevronLeft,
  ChevronRight,
  Eye,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { formatDate, formatBytes, shortenAddress } from "@/lib/utils";

export default function EvidenceListPage() {
  const { canRegisterEvidence } = useAuth();
  const [evidenceList, setEvidenceList] = useState<EvidenceListItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [skip, setSkip] = useState<number>(0);
  const limit = 10;

  const [search, setSearch] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvidence = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getEvidenceList({
        search: search.trim() || undefined,
        category: category || undefined,
        status: status || undefined,
        skip,
        limit,
      });
      setEvidenceList(res.items);
      setTotal(res.total);
    } catch (err: any) {
      setError(err?.message || "Failed to load evidence catalog.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvidence();
  }, [skip, category, status]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSkip(0);
    fetchEvidence();
  };

  const handleResetFilters = () => {
    setSearch("");
    setCategory("");
    setStatus("");
    setSkip(0);
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(skip / limit) + 1;

  return (
    <ProtectedRoute
      title="Digital Evidence Vault"
      subtitle="Chain-of-custody registered forensic records and state proofs"
    >
      <div className="space-y-6 max-w-7xl">
        {/* Controls Bar: Search & Filters */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-3 w-full">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by Evidence ID, Title, or Case Number..."
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Category Filter */}
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSkip(0);
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Categories</option>
              <option value="IMAGE">Image</option>
              <option value="VIDEO">Video</option>
              <option value="DOCUMENT">Document</option>
              <option value="OTHER">Other</option>
            </select>

            {/* Registration Status Filter */}
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setSkip(0);
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="CONFIRMED">On-Chain Confirmed</option>
              <option value="PENDING">Pending Chain</option>
              <option value="FAILED">Failed</option>
            </select>

            {(search || category || status) && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-slate-500 hover:text-slate-800 underline px-2"
              >
                Reset
              </button>
            )}

            {canRegisterEvidence && (
              <Link
                href="/evidence/register"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm whitespace-nowrap ml-auto"
              >
                <FilePlus2 className="w-4 h-4" />
                <span>Register</span>
              </Link>
            )}
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {error && (
            <div className="p-4 bg-red-50 border-b border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
                  <th className="py-3.5 px-4">Evidence ID</th>
                  <th className="py-3.5 px-4">Title & Details</th>
                  <th className="py-3.5 px-4">Case #</th>
                  <th className="py-3.5 px-4">Current Custodian</th>
                  <th className="py-3.5 px-4">Registration</th>
                  <th className="py-3.5 px-4">Integrity Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Loading digital evidence records...
                    </td>
                  </tr>
                ) : evidenceList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No evidence records match the search criteria.
                    </td>
                  </tr>
                ) : (
                  evidenceList.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Evidence ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <Link
                          href={`/evidence/${item.evidence_id}`}
                          className="hover:text-indigo-600 hover:underline"
                        >
                          {item.evidence_id}
                        </Link>
                      </td>

                      {/* Title & Metadata */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 truncate max-w-xs">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 font-medium">
                            {item.category}
                          </span>
                          <span>{formatBytes(item.file_size)}</span>
                        </div>
                      </td>

                      {/* Case Number */}
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {item.case_number}
                      </td>

                      {/* Custodian */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">
                          {item.current_custodian?.full_name || "Unassigned"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {shortenAddress(item.current_custodian?.blockchain_address)}
                        </div>
                      </td>

                      {/* Registration & Chain */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={item.registration_status} />
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {formatDate(item.created_at)}
                        </div>
                      </td>

                      {/* Integrity Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge
                          status={item.latest_integrity_status || "NOT_VERIFIED"}
                          type="integrity"
                        />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/evidence/${item.evidence_id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 font-medium text-xs transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold">{evidenceList.length}</span> of{" "}
              <span className="font-semibold">{total}</span> records
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

