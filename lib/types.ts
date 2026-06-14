export type TransactionType = "income" | "expense" | "transfer" | "debt_payment" | "card_payment" | "reimbursement";
export type PaymentMethod = "promptpay" | "cash" | "wallet" | "auto_debit" | "credit_card";
export type ClaimStatus = "none" | "review" | "work" | "personal" | "mixed" | "submitted" | "paid";
export type PaidStatus = "unpaid" | "planned" | "paid" | "matched";
export type LinkedType = "bill" | "card_item" | "company_expense" | "ot_claim" | "claim" | "manual";
export type CashDirection = "in" | "out";
export type ClearedStatus = "pending" | "cleared" | "matched";

export type Transaction = {
  id: string;
  date: string;
  amount: number;
  type: TransactionType;
  category: string;
  wallet?: string;
  from_wallet?: string;
  to_wallet?: string;
  payment_method?: PaymentMethod;
  card?: string;
  note?: string;
  tags?: string;
  budget_month?: string;
  linked_type?: LinkedType;
  linked_id?: string;
  direction?: CashDirection;
  cleared_status?: ClearedStatus;
};

export type WalletSnapshot = {
  wallet: string;
  snapshot_date: string;
  balance: number;
};

export type Card = {
  card_name: string;
  statement_cycle: string;
  statement_cut_day?: number;
  due_day: number;
  current_balance: number;
};

export type CardItem = {
  id: string;
  date: string;
  card: string;
  amount: number;
  merchant_note: string;
  category: string;
  claim_status: ClaimStatus;
  paid_status: PaidStatus;
  statement_month: string;
};

export type Claim = {
  claim_month: string;
  submit_by: string;
  expected_paid_date: string;
  status: "draft" | "submitted" | "paid";
  paid_amount: number;
};

export type ClaimItem = {
  source_type: "transaction" | "card_item";
  source_id: string;
  amount: number;
  work_personal_mixed: "work" | "personal" | "mixed" | "review";
  status: "review" | "claimable" | "submitted" | "paid" | "excluded";
  note?: string;
};

export type CompanyExpenseItem = {
  id: string;
  claim_month: string;
  date: string;
  site: string;
  project: string;
  place: string;
  sale_name: string;
  sr: string;
  detail: string;
  expense_type: "Travel" | "Toll" | "Parking" | "Perdiem" | "Entertain" | "Training" | "Accessories" | "Other";
  amount: number;
  status: "draft" | "review" | "submitted" | "paid" | "excluded";
  note?: string;
};

export type OtClaimItem = {
  id: string;
  claim_month: string;
  pay_month: string;
  date: string;
  start_time: string;
  end_time: string;
  ot_1x_hours: number;
  ot_1_5x_hours: number;
  ot_3x_hours: number;
  site: string;
  project: string;
  detail: string;
  sale_name: string;
  billable: string;
  so: string;
  status: "draft" | "review" | "submitted" | "paid" | "matched" | "excluded";
  base_rate: number;
  expected_amount: number;
  actual_paid_amount?: number;
  note?: string;
};

export type CompanyOption = {
  name: string;
  kind: "site" | "project" | "place" | "sale";
  active: boolean;
};

export type Bill = {
  id?: string;
  name: string;
  amount: number;
  due_date: string;
  planned_pay_date?: string;
  status: "unpaid" | "planned" | "paid";
  source: string;
};

export type FinanceData = {
  transactions: Transaction[];
  wallet_snapshots: WalletSnapshot[];
  cards: Card[];
  card_items: CardItem[];
  claims: Claim[];
  claim_items: ClaimItem[];
  company_expense_items: CompanyExpenseItem[];
  company_options: CompanyOption[];
  ot_claim_items: OtClaimItem[];
  bills: Bill[];
};

export type ViewKey = "dashboard" | "add" | "wallets" | "cards" | "claims" | "company-expense" | "ot";
