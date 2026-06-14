import type { FinanceData } from "./types";
import { canonicalCardName, normalizeCard } from "./card-cycles";

type Row = Record<string, string | number | undefined>;

const tableMap: Record<keyof FinanceData, string[]> = {
  transactions: ["id", "date", "amount", "type", "category", "wallet", "from_wallet", "to_wallet", "payment_method", "card", "note", "tags", "budget_month", "linked_type", "linked_id", "direction", "cleared_status"],
  wallet_snapshots: ["wallet", "snapshot_date", "balance"],
  cards: ["card_name", "statement_cycle", "statement_cut_day", "due_day", "current_balance"],
  card_items: ["id", "date", "card", "amount", "merchant_note", "category", "claim_status", "paid_status", "statement_month"],
  claims: ["claim_month", "submit_by", "expected_paid_date", "status", "paid_amount"],
  claim_items: ["source_type", "source_id", "amount", "work_personal_mixed", "status", "note"],
  company_expense_items: ["id", "claim_month", "date", "site", "project", "place", "sale_name", "sr", "detail", "expense_type", "amount", "status", "note"],
  company_options: ["name", "kind", "active"],
  ot_claim_items: ["id", "claim_month", "pay_month", "date", "start_time", "end_time", "ot_1x_hours", "ot_1_5x_hours", "ot_3x_hours", "site", "project", "detail", "sale_name", "billable", "so", "status", "base_rate", "expected_amount", "actual_paid_amount", "note"],
  bills: ["id", "name", "amount", "due_date", "planned_pay_date", "status", "source"],
};

function escapeCsv(value: string | number | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function toCsv(rows: Row[], columns: string[]): string {
  return [columns.join(","), ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(","))].join("\n");
}

export function exportCsvBundle(data: FinanceData): Record<string, string> {
  return Object.fromEntries(
    (Object.keys(tableMap) as Array<keyof FinanceData>).map((key) => [`${key}.csv`, toCsv(data[key] as Row[], tableMap[key])]),
  );
}

export function downloadCsvBundle(data: FinanceData): void {
  const bundle = exportCsvBundle(data);
  for (const [filename, content] of Object.entries(bundle)) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function parseCsv(content: string): Row[] {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((line) => line.trim() !== "");
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function normalizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\\/g, "/")
    .split("/")
    .at(-1)!
    .replace(/\s+\(\d+\)(?=\.csv$)/, "");
}

function hasColumns(row: Row | undefined, columns: string[]): boolean {
  if (!row) return false;
  const keys = new Set(Object.keys(row).map((key) => key.trim().toLowerCase()));
  return columns.every((column) => keys.has(column.toLowerCase()));
}

function inferTableKey(filename: string, rows: Row[], knownNames: Map<string, keyof FinanceData>): keyof FinanceData | undefined {
  const keyByFilename = knownNames.get(normalizeFilename(filename));
  if (keyByFilename) return keyByFilename;

  const first = rows[0];
  if (hasColumns(first, tableMap.company_expense_items)) return "company_expense_items";
  if (hasColumns(first, tableMap.ot_claim_items)) return "ot_claim_items";
  if (hasColumns(first, tableMap.company_options)) return "company_options";
  if (hasColumns(first, tableMap.transactions)) return "transactions";
  if (hasColumns(first, tableMap.card_items)) return "card_items";
  if (hasColumns(first, tableMap.wallet_snapshots)) return "wallet_snapshots";
  if (hasColumns(first, tableMap.cards)) return "cards";
  if (hasColumns(first, tableMap.claim_items)) return "claim_items";
  if (hasColumns(first, tableMap.claims)) return "claims";
  if (hasColumns(first, tableMap.bills)) return "bills";
  return undefined;
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowsToTable(key: keyof FinanceData, rows: Row[]): FinanceData[keyof FinanceData] {
  if (key === "transactions") {
    return rows.map((row) => ({
      ...row,
      amount: numberValue(row.amount),
      card: canonicalCardName(String(row.card ?? "")),
      linked_type: row.linked_type || "manual",
      direction: row.direction || (row.type === "income" || row.type === "reimbursement" ? "in" : "out"),
      cleared_status: row.cleared_status || "cleared",
    })) as FinanceData[keyof FinanceData];
  }
  if (key === "wallet_snapshots") {
    return rows.map((row) => ({ ...row, balance: numberValue(row.balance) })) as FinanceData[keyof FinanceData];
  }
  if (key === "cards") {
    return rows.map((row) => normalizeCard({
      ...row,
      card_name: String(row.card_name ?? ""),
      statement_cycle: String(row.statement_cycle ?? ""),
      statement_cut_day: numberValue(row.statement_cut_day),
      due_day: numberValue(row.due_day),
      current_balance: numberValue(row.current_balance),
    })) as FinanceData[keyof FinanceData];
  }
  if (key === "card_items") {
    return rows.map((row) => ({ ...row, card: canonicalCardName(String(row.card ?? "")), amount: numberValue(row.amount) })) as FinanceData[keyof FinanceData];
  }
  if (key === "claims") {
    return rows.map((row) => ({ ...row, paid_amount: numberValue(row.paid_amount) })) as FinanceData[keyof FinanceData];
  }
  if (key === "claim_items") {
    return rows.map((row) => ({ ...row, amount: numberValue(row.amount) })) as FinanceData[keyof FinanceData];
  }
  if (key === "company_expense_items") {
    return rows.map((row) => ({ ...row, amount: numberValue(row.amount) })) as FinanceData[keyof FinanceData];
  }
  if (key === "company_options") {
    return rows.map((row) => ({ ...row, active: String(row.active).toLowerCase() !== "false" })) as FinanceData[keyof FinanceData];
  }
  if (key === "ot_claim_items") {
    return rows.map((row) => ({
      ...row,
      ot_1x_hours: numberValue(row.ot_1x_hours),
      ot_1_5x_hours: numberValue(row.ot_1_5x_hours),
      ot_3x_hours: numberValue(row.ot_3x_hours),
      base_rate: numberValue(row.base_rate),
      expected_amount: numberValue(row.expected_amount),
      actual_paid_amount: numberValue(row.actual_paid_amount),
    })) as FinanceData[keyof FinanceData];
  }
  if (key === "bills") {
    return rows.map((row) => ({ ...row, amount: numberValue(row.amount) })) as FinanceData[keyof FinanceData];
  }
  return rows as FinanceData[keyof FinanceData];
}

export async function importCsvBundle(files: FileList, current: FinanceData): Promise<{ data: FinanceData; imported: string[] }> {
  const next: FinanceData = { ...current };
  const imported: string[] = [];
  const knownNames = new Map((Object.keys(tableMap) as Array<keyof FinanceData>).map((key) => [`${key}.csv`, key]));

  for (const file of Array.from(files)) {
    const content = await file.text();
    const rows = parseCsv(content);
    const key = inferTableKey(file.name, rows, knownNames);
    if (!key) continue;
    next[key] = rowsToTable(key, rows) as never;
    imported.push(`${key}.csv (${rows.length} rows)`);
  }

  return { data: next, imported };
}
