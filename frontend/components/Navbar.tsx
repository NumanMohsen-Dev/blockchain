"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { RoleBadge } from "./RoleBadge";
import { api } from "@/lib/api";
import { BlockchainStatus } from "@/types";
import { Activity, ShieldAlert, Cpu } from "lucide-react";

interface NavbarProps {
  title?: string;
  subtitle?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ title, subtitle }) => {
  const { user } = useAuth();
  const [chainStatus, setChainStatus] = useState<BlockchainStatus | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const data = await api.getBlockchainStatus();
        if (isMounted) setChainStatus(data);
      } catch {
        if (isMounted) {
          setChainStatus({
            connected: false,
            chain_id: null,
            contract_address: null,
            contract_accessible: false,
            latest_block_number: null,
            rpc_url: "",
          });
        }
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 15000); // refresh every 15s
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-20 flex items-center justify-between px-8">
      <div>
        {title && (
          <h2 className="text-lg font-bold text-slate-800 leading-tight">
            {title}
          </h2>
        )}
        {subtitle && (
          <p className="text-xs text-slate-500">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Blockchain Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-600">
          <Cpu className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-medium text-slate-700">Hardhat Node:</span>
          {chainStatus?.connected ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Connected (Block #{chainStatus.latest_block_number ?? 0})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-red-500 font-semibold">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Offline
            </span>
          )}
        </div>

        {/* User Mini Profile */}
        {user && (
          <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-800">{user.full_name}</p>
              <p className="text-[10px] text-slate-500">{user.email}</p>
            </div>
            <RoleBadge role={user.role} />
          </div>
        )}
      </div>
    </header>
  );
};

