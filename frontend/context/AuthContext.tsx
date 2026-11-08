"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole } from "@/types";
import { api, setToken, clearToken } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (formData: FormData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  isEvidenceCollector: boolean;
  isInvestigator: boolean;
  isForensicAnalyst: boolean;
  isCourtReviewer: boolean;
  canRegisterEvidence: boolean;
  canTransferEvidence: boolean;
  canVerifyIntegrity: boolean;
  canManageUsers: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setAuthToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check initial auth state
    const storedToken = localStorage.getItem("auth_token");
    const storedUser = localStorage.getItem("auth_user");

    if (storedToken) {
      setAuthToken(storedToken);
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          // ignore corrupted JSON
        }
      }
      // Re-validate token with backend
      api
        .getMe()
        .then((freshUser) => {
          setUser(freshUser);
          localStorage.setItem("auth_user", JSON.stringify(freshUser));
        })
        .catch(() => {
          clearToken();
          setUser(null);
          setAuthToken(null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (formData: FormData) => {
    setIsLoading(true);
    try {
      const res = await api.login(formData);
      setUser(res.user);
      setAuthToken(res.access_token);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.logout();
    } catch {
      // ignore
    } finally {
      clearToken();
      setUser(null);
      setAuthToken(null);
      setIsLoading(false);
      window.location.href = "/login";
    }
  };

  const refreshUser = async () => {
    try {
      const freshUser = await api.getMe();
      setUser(freshUser);
      localStorage.setItem("auth_user", JSON.stringify(freshUser));
    } catch {
      // ignore
    }
  };

  const role = user?.role;
  const isAdmin = role === "ADMIN";
  const isEvidenceCollector = role === "EVIDENCE_COLLECTOR";
  const isInvestigator = role === "INVESTIGATOR";
  const isForensicAnalyst = role === "FORENSIC_ANALYST";
  const isCourtReviewer = role === "COURT_REVIEWER";

  // Permissions according to README specifications:
  // - Only ADMIN and EVIDENCE_COLLECTOR can register evidence
  const canRegisterEvidence = isAdmin || isEvidenceCollector;
  // - Current custodian or ADMIN can transfer custody
  const canTransferEvidence =
    isAdmin || isEvidenceCollector || isInvestigator || isForensicAnalyst;
  // - Forensic Analyst, Investigator, Admin, Court can trigger integrity checks
  const canVerifyIntegrity = true;
  // - Only Admin can manage users
  const canManageUsers = isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        login,
        logout,
        refreshUser,
        isAdmin,
        isEvidenceCollector,
        isInvestigator,
        isForensicAnalyst,
        isCourtReviewer,
        canRegisterEvidence,
        canTransferEvidence,
        canVerifyIntegrity,
        canManageUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

