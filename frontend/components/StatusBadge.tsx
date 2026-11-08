import React from "react";
import { RegistrationStatus, IntegrityStatus } from "@/types";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, Clock, XCircle, HelpCircle } from "lucide-react";

interface StatusBadgeProps {
  status: RegistrationStatus | IntegrityStatus | string;
  type?: "registration" | "integrity";
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type = "registration",
  className,
}) => {
  if (type === "integrity" || status === "VERIFIED" || status === "MISMATCH" || status === "NOT_VERIFIED" || status === "FILE_UNAVAILABLE") {
    switch (status) {
      case "VERIFIED":
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200",
              className
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Integrity Verified
          </span>
        );
      case "MISMATCH":
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300 animate-pulse",
              className
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            Tamper Detected (Mismatch)
          </span>
        );
      case "FILE_UNAVAILABLE":
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200",
              className
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            File Missing
          </span>
        );
      case "NOT_VERIFIED":
      default:
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300",
              className
            )}
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            Not Verified
          </span>
        );
    }
  }

  // Registration Status
  switch (status) {
    case "CONFIRMED":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200",
            className
          )}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
          On-Chain Confirmed
        </span>
      );
    case "PENDING":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200",
            className
          )}
        >
          <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
          Pending Chain Tx
        </span>
      );
    case "FAILED":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200",
            className
          )}
        >
          <XCircle className="w-3.5 h-3.5 text-red-600" />
          Failed
        </span>
      );
    default:
      return (
        <span
          className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200",
            className
          )}
        >
          {status}
        </span>
      );
  }
};

