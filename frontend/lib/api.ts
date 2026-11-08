import {
  User,
  EvidenceListItem,
  EvidenceDetail,
  EvidenceListResponse,
  CustodyHistoryResponse,
  IntegrityVerificationResult,
  IntegrityCheck,
  DashboardStats,
  DashboardRecentActivity,
  BlockchainStatus,
} from "@/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

export function setToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("auth_token", token);
  }
}

export function clearToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Clear session on 401 if in browser
    if (typeof window !== "undefined" && !endpoint.includes("/api/auth/login")) {
      clearToken();
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
  }

  let data: any = null;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorMsg =
      data?.detail || data?.message || `Request failed with status ${response.status}`;
    throw new ApiError(errorMsg, response.status, data);
  }

  return data as T;
}

export const api = {
  // Auth
  async login(formData: FormData): Promise<{ access_token: string; token_type: string; user: User }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new ApiError(data?.detail || "Login failed", response.status, data);
    }
    setToken(data.access_token);
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_user", JSON.stringify(data.user));
    }
    return data;
  },

  async getMe(): Promise<User> {
    return request<User>("/api/auth/me");
  },

  async logout(): Promise<void> {
    try {
      await request("/api/auth/logout", { method: "POST" });
    } finally {
      clearToken();
    }
  },

  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    return request<DashboardStats>("/api/dashboard/stats");
  },

  async getDashboardActivity(): Promise<DashboardRecentActivity> {
    return request<DashboardRecentActivity>("/api/dashboard/recent-activity");
  },

  // Evidence
  async getEvidenceList(params?: {
    search?: string;
    category?: string;
    status?: string;
    custodian_id?: number;
    skip?: number;
    limit?: number;
  }): Promise<EvidenceListResponse> {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.category) query.set("category", params.category);
    if (params?.status) query.set("status", params.status);
    if (params?.custodian_id) query.set("custodian_id", params.custodian_id.toString());
    if (params?.skip !== undefined) query.set("skip", params.skip.toString());
    if (params?.limit !== undefined) query.set("limit", params.limit.toString());

    const qs = query.toString() ? `?${query.toString()}` : "";
    return request<EvidenceListResponse>(`/api/evidence${qs}`);
  },

  async getEvidenceById(id: string): Promise<EvidenceDetail> {
    return request<EvidenceDetail>(`/api/evidence/${id}`);
  },

  async registerEvidence(formData: FormData): Promise<EvidenceDetail> {
    return request<EvidenceDetail>("/api/evidence", {
      method: "POST",
      body: formData,
    });
  },

  async downloadEvidenceFile(id: string, filename: string): Promise<void> {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/evidence/${id}/download`, {
      headers,
    });
    if (!res.ok) {
      throw new ApiError("Failed to download evidence file", res.status);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async transferCustody(
    id: string,
    payload: { new_custodian_id: number; reason: string }
  ): Promise<{
    success: boolean;
    evidence_id: string;
    transaction_hash: string;
    block_number: number;
    previous_custodian: string;
    new_custodian: string;
    timestamp: string;
  }> {
    return request(`/api/evidence/${id}/transfer`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getCustodyHistory(id: string): Promise<CustodyHistoryResponse> {
    return request<CustodyHistoryResponse>(`/api/evidence/${id}/history`);
  },

  async verifyEvidenceIntegrity(id: string): Promise<IntegrityVerificationResult> {
    return request<IntegrityVerificationResult>(`/api/evidence/${id}/verify`, {
      method: "POST",
    });
  },

  async getIntegrityChecks(id: string): Promise<IntegrityCheck[]> {
    return request<IntegrityCheck[]>(`/api/evidence/${id}/integrity-checks`);
  },

  // Users (Admin)
  async getUsers(params?: { role?: string; is_active?: boolean }): Promise<User[]> {
    const query = new URLSearchParams();
    if (params?.role) query.set("role", params.role);
    if (params?.is_active !== undefined) query.set("is_active", params.is_active.toString());
    const qs = query.toString() ? `?${query.toString()}` : "";
    return request<User[]>(`/api/users${qs}`);
  },

  async createUser(payload: {
    email: string;
    full_name: string;
    password: string;
    role: string;
    blockchain_address?: string;
  }): Promise<User> {
    return request<User>("/api/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateUser(
    id: number,
    payload: {
      email?: string;
      full_name?: string;
      role?: string;
      blockchain_address?: string;
      is_active?: boolean;
    }
  ): Promise<User> {
    return request<User>(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async updateUserStatus(id: number, isActive: boolean): Promise<User> {
    return request<User>(`/api/users/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
    });
  },

  // Blockchain
  async getBlockchainStatus(): Promise<BlockchainStatus> {
    return request<BlockchainStatus>("/api/blockchain/status");
  },

  async getBlockchainTransactions(params?: { skip?: number; limit?: number }): Promise<any> {
    const query = new URLSearchParams();
    if (params?.skip !== undefined) query.set("skip", params.skip.toString());
    if (params?.limit !== undefined) query.set("limit", params.limit.toString());
    const qs = query.toString() ? `?${query.toString()}` : "";
    return request(`/api/blockchain/transactions${qs}`);
  },

  async getBlockchainEvidence(id: string): Promise<any> {
    return request(`/api/blockchain/evidence/${id}`);
  },
};

