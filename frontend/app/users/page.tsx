"use client";

import React, { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { api } from "@/lib/api";
import { User, UserRole } from "@/types";
import { RoleBadge } from "@/components/RoleBadge";
import {
  Users,
  UserPlus,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  X,
  ShieldCheck,
} from "lucide-react";
import { formatDate, shortenAddress } from "@/lib/utils";

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Create User Modal state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [formEmail, setFormEmail] = useState<string>("");
  const [formName, setFormName] = useState<string>("");
  const [formPassword, setFormPassword] = useState<string>("");
  const [formRole, setFormRole] = useState<UserRole>("INVESTIGATOR");
  const [formAddress, setFormAddress] = useState<string>("");
  const [createLoading, setCreateLoading] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load users list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async (user: User) => {
    try {
      await api.updateUserStatus(user.id, !user.is_active);
      fetchUsers();
    } catch (err: any) {
      alert("Failed to update status: " + (err?.message || "Error"));
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);

    try {
      await api.createUser({
        email: formEmail.trim(),
        full_name: formName.trim(),
        password: formPassword,
        role: formRole,
        blockchain_address: formAddress.trim() || undefined,
      });

      setIsCreateOpen(false);
      setFormEmail("");
      setFormName("");
      setFormPassword("");
      setFormAddress("");
      fetchUsers();
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create officer account.");
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <ProtectedRoute
      allowedRoles={["ADMIN"]}
      title="User & Clearance Management"
      subtitle="Administrator governance of forensic personnel, role authorizations, and wallet mappings"
    >
      <div className="space-y-6 max-w-7xl">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Total Authorized Officers:{" "}
            <span className="font-bold text-slate-800">{users.length}</span>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create Officer Account</span>
          </button>
        </div>

        {/* Users Table */}
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
                  <th className="py-3 px-4">Officer Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role Clearance</th>
                  <th className="py-3 px-4">Blockchain Address</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Loading user accounts...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {u.full_name}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {u.email}
                      </td>
                      <td className="py-3.5 px-4">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                        {shortenAddress(u.blockchain_address)}
                      </td>
                      <td className="py-3.5 px-4">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400 font-semibold text-[11px]">
                            <XCircle className="w-3.5 h-3.5 text-slate-400" />
                            Deactivated
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                            u.is_active
                              ? "border-slate-300 text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                              : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          {u.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create User Modal */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                <h3 className="text-base font-bold text-slate-800">
                  Provision New Officer Account
                </h3>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
                {createError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                    <span>{createError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Detective Sarah Connor"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="officer@evidence.org"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Role Clearance *
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="EVIDENCE_COLLECTOR">EVIDENCE_COLLECTOR</option>
                    <option value="INVESTIGATOR">INVESTIGATOR</option>
                    <option value="FORENSIC_ANALYST">FORENSIC_ANALYST</option>
                    <option value="COURT_REVIEWER">COURT_REVIEWER</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ethereum Address (Optional)
                  </label>
                  <input
                    type="text"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="0x... (auto-generated if omitted)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-md text-xs text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-md text-xs font-semibold flex items-center gap-1.5"
                  >
                    {createLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        Create Account
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

