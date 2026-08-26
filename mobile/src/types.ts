export type Profile = {
  user_id: string;
  full_name: string | null;
  mobile: string | null;
  pan_last4: string | null;
  kyc_status: 'pending' | 'verified' | 'rejected';
  assigned_advisor: string | null;
};

export type CreditReport = {
  id: string;
  score: number | null;
  total_accounts: number;
  open_accounts: number;
  closed_accounts: number;
  enquiries: number;
  utilization_percent: number;
  factors: Array<{ label: string; impact: 'low' | 'medium' | 'high' }>;
  report_date: string | null;
};

export type ResolutionRequest = {
  id: string;
  request_number: string;
  issue_type: string;
  lender_name: string | null;
  account_last4: string | null;
  description: string | null;
  status: string;
  priority: string;
  assigned_advisor: string | null;
  impact_points: number;
  created_at: string;
};

export type Message = {
  id: string;
  user_id: string;
  case_id: string | null;
  sender_id: string | null;
  receiver_id: string | null;
  message: string;
  created_at: string;
};

export type Payment = {
  id: string;
  payment_type: string | null;
  provider_payment_id: string | null;
  amount: number;
  currency: string;
  status: string | null;
  paid_at: string | null;
  created_at: string;
};
