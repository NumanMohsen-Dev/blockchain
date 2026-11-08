export type UserRole =
  | 'ADMIN'
  | 'EVIDENCE_COLLECTOR'
  | 'INVESTIGATOR'
  | 'FORENSIC_ANALYST'
  | 'COURT_REVIEWER';

export type EvidenceCategory = 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'OTHER';

export type RegistrationStatus = 'PENDING' | 'CONFIRMED' | 'FAILED';

export type IntegrityStatus =
  | 'VERIFIED'
  | 'MISMATCH'
  | 'NOT_VERIFIED'
  | 'FILE_UNAVAILABLE';

export interface User {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  blockchain_address: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CustodianSummary {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  blockchain_address: string;
}

export interface EvidenceTransaction {
  id: number;
  evidence_id: number;
  transaction_hash: string;
  transaction_type: string;
  block_number: number | null;
  transaction_status: string;
  created_at: string;
}

export interface IntegrityCheck {
  id: number;
  evidence_id: number;
  performed_by_id: number | null;
  performed_by_name?: string | null;
  calculated_hash: string;
  blockchain_hash: string;
  result: IntegrityStatus;
  checked_at: string;
}

export interface EvidenceListItem {
  id: number;
  evidence_id: string;
  title: string;
  category: EvidenceCategory;
  case_number: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  original_sha256: string;
  current_custodian: CustodianSummary;
  registration_status: RegistrationStatus;
  blockchain_transaction_hash: string | null;
  blockchain_block_number: number | null;
  created_at: string;
  latest_integrity_status: IntegrityStatus;
}

export interface EvidenceDetail extends EvidenceListItem {
  description: string;
  collection_location: string;
  collection_datetime: string;
  initial_custodian: CustodianSummary;
  created_by_user?: CustodianSummary | null;
  transactions: EvidenceTransaction[];
  latest_integrity_check: IntegrityCheck | null;
}

export interface EvidenceListResponse {
  items: EvidenceListItem[];
  total: number;
  skip: number;
  limit: number;
}

export interface CustodyHistoryItem {
  transfer_number: number;
  from_address: string;
  from_name: string;
  from_role?: string;
  to_address: string;
  to_name: string;
  to_role?: string;
  reason: string;
  block_timestamp: string;
  block_number: number;
  transaction_hash: string;
}

export interface CustodyHistoryResponse {
  evidence_id: string;
  total_transfers: number;
  history: CustodyHistoryItem[];
}

export interface IntegrityVerificationResult {
  evidence_id: string;
  verified: boolean;
  result: IntegrityStatus;
  calculated_hash: string;
  blockchain_hash: string;
  checked_at: string;
  message: string;
}

export interface DashboardStats {
  total_evidence: number;
  my_custody_count: number;
  total_transfers: number;
  integrity_warnings: number;
  active_users: number;
}

export interface BlockchainStatus {
  connected: boolean;
  chain_id: number | null;
  contract_address: string | null;
  contract_accessible: boolean;
  latest_block_number: number | null;
  rpc_url: string;
}

export interface RecentActivityItem {
  type: 'TRANSACTION' | 'AUDIT';
  action: string;
  description: string;
  timestamp: string;
  user_email?: string;
  transaction_hash?: string;
  evidence_id?: string;
}

export interface DashboardRecentActivity {
  recent_transactions: any[];
  recent_audits: any[];
}

