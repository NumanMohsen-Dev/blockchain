"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  FilePlus2,
  UploadCloud,
  FileCheck2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { formatBytes } from "@/lib/utils";

export default function RegisterEvidencePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("DOCUMENT");
  const [caseNumber, setCaseNumber] = useState("");
  const [location, setLocation] = useState("");
  const [datetime, setDatetime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [statusStep, setStatusStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.size === 0) {
        setError("Empty files cannot be registered as evidence.");
        return;
      }
      setFile(selected);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select an evidence file to upload and cryptographically register.");
      return;
    }

    setLoading(true);
    setError(null);
    setStatusStep("Streaming file and computing SHA-256 hash...");

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("category", category);
      formData.append("case_number", caseNumber.trim());
      formData.append("collection_location", location.trim());
      formData.append("collection_datetime", new Date(datetime).toISOString());
      formData.append("file", file);

      setStatusStep("Submitting transaction to Hardhat blockchain smart contract...");
      const result = await api.registerEvidence(formData);

      setStatusStep("Receipt confirmed! Redirecting to evidence dossier...");
      setTimeout(() => {
        router.push(`/evidence/${result.evidence_id}`);
      }, 1000);
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to register evidence. Ensure blockchain node is available and inputs are valid."
      );
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute
      allowedRoles={["ADMIN", "EVIDENCE_COLLECTOR"]}
      title="Secure Evidence Registration"
      subtitle="Ingest digital artifacts, generate cryptographic fingerprint, and anchor on-chain"
    >
      <div className="max-w-4xl space-y-6">
        <Link
          href="/evidence"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Evidence Vault</span>
        </Link>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                Register New Digital Evidence
              </h2>
              <p className="text-xs text-slate-500">
                Initial Custodian:{" "}
                <span className="font-semibold text-slate-700">
                  {user?.full_name} ({user?.role})
                </span>
              </p>
            </div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Case Details Group */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Case / Reference Number *
                </label>
                <input
                  type="text"
                  required
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  placeholder="e.g., CR-2026-9042"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Evidence Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="DOCUMENT">Document (PDF, TXT, DOCX)</option>
                  <option value="IMAGE">Image (JPG, PNG, TIFF, RAW)</option>
                  <option value="VIDEO">Video (MP4, MKV, AVI)</option>
                  <option value="OTHER">Other Binary / Archive</option>
                </select>
              </div>
            </div>

            {/* Evidence Title & Description */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Evidence Item Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Forensic Disk Clone Image - Suspect Workstation"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Detailed Description & Context *
                </label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe collection method, hardware serial numbers, forensic write blocker used, sealing tamper tape ID..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Location & Datetime */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Collection Location *
                </label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Room 402, Headquarters Building, Sector 4"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Collection Date & Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={datetime}
                  onChange={(e) => setDatetime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* File Upload Dropzone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Artifact File (Server will calculate original SHA-256) *
              </label>
              <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-lg p-6 text-center cursor-pointer bg-slate-50/50 transition-colors relative">
                <input
                  type="file"
                  required
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {file ? (
                  <div className="flex flex-col items-center gap-2 text-indigo-700">
                    <FileCheck2 className="w-10 h-10 text-indigo-600" />
                    <span className="text-xs font-semibold">{file.name}</span>
                    <span className="text-[11px] text-slate-500">
                      {formatBytes(file.size)} &bull; {file.type || "binary/octet-stream"}
                    </span>
                    <span className="text-[10px] text-indigo-600 underline mt-1">
                      Click or drag another file to replace
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <UploadCloud className="w-10 h-10 text-slate-400" />
                    <span className="text-xs font-medium">
                      Select or drag & drop digital evidence artifact
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Images, Videos, Forensic Archives, Documents (up to 500 MB)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Security Explanation */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 leading-relaxed">
              <strong>Cryptographic Protocol Notice:</strong> The raw file will be stored in the isolated forensic storage directory. The server computes a SHA-256 checksum in memory and registers it immutably on the Ethereum smart contract alongside your custodian address.
            </div>

            {/* Submit Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <Link
                href="/evidence"
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-2 transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{statusStep || "Processing..."}</span>
                  </>
                ) : (
                  <>
                    <FilePlus2 className="w-4 h-4" />
                    <span>Register On-Chain</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
}

