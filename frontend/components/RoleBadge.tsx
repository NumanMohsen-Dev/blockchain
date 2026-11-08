import React from "react";
import { UserRole } from "@/types";
import { cn } from "@/lib/utils";

interface RoleBadgeProps {
  role?: UserRole | string;
  className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, className }) => {
  let badgeStyles = "bg-slate-100 text-slate-800 border-slate-300";
  let label = role || "UNKNOWN";

  switch (role) {
    case "ADMIN":
      badgeStyles = "bg-purple-100 text-purple-800 border-purple-200";
      label = "Administrator";
      break;
    case "EVIDENCE_COLLECTOR":
      badgeStyles = "bg-blue-100 text-blue-800 border-blue-200";
      label = "Evidence Collector";
      break;
    case "INVESTIGATOR":
      badgeStyles = "bg-amber-100 text-amber-800 border-amber-200";
      label = "Investigator";
      break;
    case "FORENSIC_ANALYST":
      badgeStyles = "bg-cyan-100 text-cyan-800 border-cyan-200";
      label = "Forensic Analyst";
      break;
    case "COURT_REVIEWER":
      badgeStyles = "bg-emerald-100 text-emerald-800 border-emerald-200";
      label = "Court Reviewer";
      break;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border",
        badgeStyles,
        className
      )}
    >
      {label}
    </span>
  );
};

