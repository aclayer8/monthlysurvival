"use client";

import { sampleData } from "./sample-data";
import { canonicalCardName, mergeDefaultCards } from "./card-cycles";
import type { FinanceData } from "./types";

const STORAGE_KEY = "monthly-survival-data-v1";
const STORAGE_PREFIX = "monthly-survival-data";
const BACKUP_KEY = "monthly-survival-data-last-good-backup";

const walletNameMap: Record<string, string> = {
  kbank: "KBANK",
  bbl: "BBL",
  make: "MAKE",
  ttb: "TTB",
  cash: "CASH",
};

function normalizeWallet(wallet?: string): string | undefined {
  if (!wallet) return wallet;
  return walletNameMap[wallet.toLowerCase()] ?? wallet.toUpperCase();
}

function directionForType(type: string): "in" | "out" {
  return type === "income" || type === "reimbursement" ? "in" : "out";
}

function normalizeTransactionWallet(transaction: FinanceData["transactions"][number]): string | undefined {
  const wallet = normalizeWallet(transaction.wallet);
  if (transaction.payment_method === "credit_card") return "";
  if (transaction.payment_method === "cash") return wallet || "CASH";
  if (!wallet && transaction.type !== "transfer" && directionForType(transaction.type) === "out") return "KBANK";
  return wallet;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function requireArray(data: Record<string, unknown>, key: keyof FinanceData): void {
  if (!Array.isArray(data[key])) {
    throw new Error(`JSON backup is missing a valid ${key} array.`);
  }
}

export function normalizeFinanceData(data: FinanceData): FinanceData {
  return {
    ...data,
    wallet_snapshots: (data.wallet_snapshots ?? []).map((snapshot) => ({
      ...snapshot,
      wallet: normalizeWallet(snapshot.wallet) ?? snapshot.wallet,
    })),
    company_expense_items: data.company_expense_items ?? [],
    company_options: data.company_options ?? [],
    ot_claim_items: data.ot_claim_items ?? [],
    cards: mergeDefaultCards(data.cards ?? []),
    card_items: (data.card_items ?? []).map((item) => ({
      ...item,
      card: canonicalCardName(item.card),
    })),
    bills: (data.bills ?? []).map((bill, index) => ({
      ...bill,
      id: bill.id ?? `bill-${String(bill.name || index).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`,
    })),
    transactions: (data.transactions ?? []).map((transaction) => ({
      ...transaction,
      wallet: normalizeTransactionWallet(transaction),
      from_wallet: normalizeWallet(transaction.from_wallet),
      to_wallet: normalizeWallet(transaction.to_wallet),
      card: canonicalCardName(transaction.card),
      direction: transaction.direction ?? directionForType(transaction.type),
      cleared_status: transaction.cleared_status ?? "cleared",
      linked_type: transaction.linked_type ?? "manual",
    })),
  };
}

export function parseFinanceDataBackup(value: unknown): FinanceData {
  if (!isRecord(value)) {
    throw new Error("JSON backup must contain a Monthly Survival data object.");
  }

  requireArray(value, "transactions");
  requireArray(value, "wallet_snapshots");
  requireArray(value, "cards");
  requireArray(value, "card_items");
  requireArray(value, "claims");
  requireArray(value, "claim_items");

  return normalizeFinanceData(value as FinanceData);
}

export function defaultFinanceData(): FinanceData {
  return normalizeFinanceData(sampleData);
}

function scoreFinanceData(data: FinanceData): number {
  return (
    (data.company_expense_items?.length ?? 0) * 1000 +
    (data.ot_claim_items?.length ?? 0) * 700 +
    (data.transactions?.length ?? 0) * 100 +
    (data.bills?.length ?? 0) * 10 +
    (data.company_options?.length ?? 0)
  );
}

function readStoredFinanceData(key: string): FinanceData | null {
  const saved = window.localStorage.getItem(key);
  if (!saved) return null;
  try {
    return normalizeFinanceData(JSON.parse(saved) as FinanceData);
  } catch {
    return null;
  }
}

function bestStoredFinanceData(): FinanceData | null {
  const candidates: FinanceData[] = [];
  const preferred = readStoredFinanceData(STORAGE_KEY);
  if (preferred) candidates.push(preferred);

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(STORAGE_PREFIX) || key === STORAGE_KEY) continue;
    const candidate = readStoredFinanceData(key);
    if (candidate) candidates.push(candidate);
  }

  return candidates.sort((a, b) => scoreFinanceData(b) - scoreFinanceData(a))[0] ?? null;
}

export function loadFinanceData(): FinanceData {
  if (typeof window === "undefined") return defaultFinanceData();
  const data = bestStoredFinanceData() ?? defaultFinanceData();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

export function saveFinanceData(data: FinanceData): void {
  const previous = window.localStorage.getItem(STORAGE_KEY);
  if (previous) window.localStorage.setItem(BACKUP_KEY, previous);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function resetFinanceData(): FinanceData {
  window.localStorage.removeItem(STORAGE_KEY);
  return defaultFinanceData();
}
