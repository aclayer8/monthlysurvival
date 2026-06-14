import { daysLeftInPeriod, lastBusinessDay, toDate, toIsoDate } from "./budget";
import { sameCardName } from "./card-cycles";
import type { Bill, Card, CardItem, CompanyExpenseItem, FinanceData, OtClaimItem, Transaction, WalletSnapshot } from "./types";

const TODAY = "2026-06-14";
const ACTIVE_BUDGET = "June Budget";
const NEXT_PAYDAY = "2026-06-30";
const BASE_SALARY_FORECAST = 44000;
const LIVING_DAILY_MIN = 300;
const LIVING_DAILY_MAX = 500;
const FUEL_TOLL_BUFFER_MIN = 3500;
const FUEL_TOLL_BUFFER_MAX = 5600;

function moneyIn(transaction: Transaction): boolean {
  return transaction.type === "income" || transaction.type === "reimbursement" || (transaction.type === "transfer" && transaction.category === "transfer_in");
}

function moneyOut(transaction: Transaction): boolean {
  return (
    transaction.type === "expense" ||
    transaction.type === "debt_payment" ||
    transaction.type === "card_payment" ||
    (transaction.type === "transfer" && transaction.category === "transfer_out")
  );
}

function isCashCleared(transaction: Transaction): boolean {
  return transaction.cleared_status !== "pending";
}

function isMatched(transaction: Transaction, linkedType: string, linkedId?: string): boolean {
  if (transaction.linked_type !== linkedType) return false;
  if (linkedId && transaction.linked_id !== linkedId) return false;
  return isCashCleared(transaction);
}

function plannedPayDate(bill: Bill): string {
  return bill.planned_pay_date || bill.due_date;
}

function billId(bill: Bill): string {
  return bill.id || bill.name;
}

function companyExpensePaid(item: CompanyExpenseItem, transactions: Transaction[]): boolean {
  if (item.status === "paid") return true;
  return transactions.some((transaction) => isMatched(transaction, "company_expense", item.id) || isMatched(transaction, "claim", item.claim_month));
}

function otClaimPaid(item: OtClaimItem, transactions: Transaction[]): boolean {
  if (item.status === "paid" || item.status === "matched") return true;
  return transactions.some((transaction) => isMatched(transaction, "ot_claim", item.id));
}

function nextPaydayAfterCurrent(): string {
  const payday = toDate(NEXT_PAYDAY);
  return toIsoDate(lastBusinessDay(payday.getFullYear(), payday.getMonth() + 1));
}

function addMonths(year: number, monthIndex: number, day: number, offset: number): Date {
  return new Date(year, monthIndex + offset, day);
}

export function cardStatementDueDate(card: Card, chargeDateText: string): string {
  const chargeDate = toDate(chargeDateText);
  const cutDay = card.statement_cut_day || 1;
  const dueDay = card.due_day || 1;
  const cutoffMonthOffset = chargeDate.getDate() <= cutDay ? 0 : 1;
  const dueMonthOffset = cutoffMonthOffset + (dueDay > cutDay ? 0 : 1);
  return toIsoDate(addMonths(chargeDate.getFullYear(), chargeDate.getMonth(), dueDay, dueMonthOffset));
}

function dueInNextPaydayWindow(dueDateText: string): boolean {
  const dueDate = toDate(dueDateText);
  return dueDate > toDate(NEXT_PAYDAY) && dueDate <= toDate(nextPaydayAfterCurrent());
}

export function activeBudgetMonth(): string {
  return ACTIVE_BUDGET;
}

export function todayText(): string {
  return TODAY;
}

export function walletBalance(snapshot: WalletSnapshot, transactions: Transaction[]): number {
  return transactions.reduce((balance, transaction) => {
    const walletMatch = transaction.wallet === snapshot.wallet || transaction.from_wallet === snapshot.wallet || transaction.to_wallet === snapshot.wallet;
    if (!walletMatch) return balance;
    if (toDate(transaction.date) <= toDate(snapshot.snapshot_date)) return balance;
    if (toDate(transaction.date) > toDate(TODAY)) return balance;
    if (!isCashCleared(transaction)) return balance;
    if (transaction.payment_method === "credit_card") return balance;

    if (transaction.type === "transfer") {
      if (transaction.to_wallet === snapshot.wallet || (transaction.wallet === snapshot.wallet && transaction.direction === "in")) return balance + transaction.amount;
      if (transaction.from_wallet === snapshot.wallet || (transaction.wallet === snapshot.wallet && transaction.direction === "out")) return balance - transaction.amount;
      return balance;
    }

    if (moneyIn(transaction)) return balance + transaction.amount;
    if (moneyOut(transaction)) return balance - transaction.amount;
    return balance;
  }, snapshot.balance);
}

export function walletBalances(data: FinanceData): Array<WalletSnapshot & { current: number }> {
  return data.wallet_snapshots.map((snapshot) => ({
    ...snapshot,
    current: walletBalance(snapshot, data.transactions),
  }));
}

export function billIsPaid(bill: Bill, transactions: Transaction[]): boolean {
  return bill.status === "paid" || transactions.some((transaction) => isMatched(transaction, "bill", billId(bill)) && moneyOut(transaction));
}

export function unpaidBills(bills: Bill[], transactions: Transaction[] = []): Bill[] {
  return bills.filter((bill) => !billIsPaid(bill, transactions)).sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export function currentCycleBills(bills: Bill[]): Bill[] {
  return unpaidBills(bills).filter((bill) => plannedPayDate(bill) < NEXT_PAYDAY);
}

export function nextPaydayBills(bills: Bill[]): Bill[] {
  return unpaidBills(bills).filter((bill) => plannedPayDate(bill) >= NEXT_PAYDAY);
}

export function currentCycleBillsForData(data: FinanceData): Bill[] {
  return unpaidBills(data.bills, data.transactions).filter((bill) => plannedPayDate(bill) < NEXT_PAYDAY);
}

export function nextPaydayBillsForData(data: FinanceData): Bill[] {
  return unpaidBills(data.bills, data.transactions).filter((bill) => plannedPayDate(bill) >= NEXT_PAYDAY);
}

export function cardOutstanding(cardName: string, cardItems: CardItem[], transactions: Transaction[]): number {
  const cardItemCharges = cardItems.filter((item) => sameCardName(item.card, cardName) && item.paid_status === "unpaid").reduce((sum, item) => sum + item.amount, 0);
  const dailyCreditCharges = transactions
    .filter((transaction) =>
      sameCardName(transaction.card, cardName) &&
      transaction.payment_method === "credit_card" &&
      moneyOut(transaction) &&
      transaction.linked_type !== "card_item" &&
      transaction.budget_month === ACTIVE_BUDGET
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const payments = transactions
    .filter((transaction) => transaction.type === "card_payment" && sameCardName(transaction.card, cardName) && transaction.budget_month === ACTIVE_BUDGET && isCashCleared(transaction))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  return Math.max(0, cardItemCharges + dailyCreditCharges - payments);
}

export function cardTransportAmount(cardName: string, cardItems: CardItem[], transactions: Transaction[]): { amount: number; count: number } {
  const cardItemTransport = cardItems.filter((item) =>
    sameCardName(item.card, cardName) &&
    item.statement_month === ACTIVE_BUDGET &&
    item.paid_status === "unpaid" &&
    item.category === "transport"
  );
  const transactionTransport = transactions.filter((transaction) =>
    sameCardName(transaction.card, cardName) &&
    transaction.payment_method === "credit_card" &&
    moneyOut(transaction) &&
    transaction.linked_type !== "card_item" &&
    transaction.budget_month === ACTIVE_BUDGET &&
    transaction.category === "transport"
  );

  return {
    amount: [...cardItemTransport, ...transactionTransport].reduce((sum, item) => sum + item.amount, 0),
    count: cardItemTransport.length + transactionTransport.length,
  };
}

export function cardCycleSummary(card: Card, data: FinanceData) {
  const cardItemCharges = data.card_items
    .filter((item) => sameCardName(item.card, card.card_name) && item.statement_month === ACTIVE_BUDGET && item.paid_status === "unpaid")
    .map((item) => ({ amount: item.amount, category: item.category, dueDate: cardStatementDueDate(card, item.date) }));
  const transactionCharges = data.transactions
    .filter((transaction) =>
      sameCardName(transaction.card, card.card_name) &&
      transaction.payment_method === "credit_card" &&
      moneyOut(transaction) &&
      transaction.linked_type !== "card_item" &&
      transaction.budget_month === ACTIVE_BUDGET
    )
    .map((transaction) => ({ amount: transaction.amount, category: transaction.category, dueDate: cardStatementDueDate(card, transaction.date) }));
  const charges = [...cardItemCharges, ...transactionCharges];
  const dueThisPayday = charges.filter((charge) => dueInNextPaydayWindow(charge.dueDate));
  const laterCycle = charges.filter((charge) => toDate(charge.dueDate) > toDate(nextPaydayAfterCurrent()));
  const transportThisPayday = dueThisPayday.filter((charge) => charge.category === "transport");
  const transportLater = laterCycle.filter((charge) => charge.category === "transport");

  return {
    dueThisPaydayAmount: dueThisPayday.reduce((sum, charge) => sum + charge.amount, 0),
    dueThisPaydayCount: dueThisPayday.length,
    laterCycleAmount: laterCycle.reduce((sum, charge) => sum + charge.amount, 0),
    laterCycleCount: laterCycle.length,
    transportThisPaydayAmount: transportThisPayday.reduce((sum, charge) => sum + charge.amount, 0),
    transportThisPaydayCount: transportThisPayday.length,
    transportLaterAmount: transportLater.reduce((sum, charge) => sum + charge.amount, 0),
    transportLaterCount: transportLater.length,
    nextDueWindowEnd: nextPaydayAfterCurrent(),
  };
}

export function categoryBreakdown(data: FinanceData): Array<{ category: string; amount: number; share: number }> {
  const totals = new Map<string, number>();
  for (const transaction of data.transactions) {
    if (transaction.budget_month !== ACTIVE_BUDGET) continue;
    if (!isCashCleared(transaction)) continue;
    if (transaction.type !== "expense" && transaction.type !== "debt_payment" && transaction.type !== "card_payment") continue;
    totals.set(transaction.category, (totals.get(transaction.category) ?? 0) + transaction.amount);
  }
  for (const item of data.card_items) {
    if (item.statement_month !== ACTIVE_BUDGET) continue;
    if (item.paid_status !== "unpaid") continue;
    totals.set(item.category, (totals.get(item.category) ?? 0) + item.amount);
  }
  const total = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);
  return Array.from(totals.entries())
    .map(([category, amount]) => ({ category, amount, share: total ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

export function monthlyCashflow(data: FinanceData): { income: number; expenses: number; balance: number } {
  const income = data.transactions
    .filter((transaction) => transaction.budget_month === ACTIVE_BUDGET && moneyIn(transaction) && isCashCleared(transaction))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expenses = categoryBreakdown(data).reduce((sum, item) => sum + item.amount, 0);

  return {
    income,
    expenses,
    balance: income - expenses,
  };
}

export function otExpectedAmount(item: OtClaimItem): number {
  if (item.expected_amount > 0) return item.expected_amount;
  return item.base_rate * (item.ot_1x_hours + item.ot_1_5x_hours * 1.5 + item.ot_3x_hours * 3);
}

export function companyExpenseSummary(items: CompanyExpenseItem[], transactions: Transaction[] = []) {
  const activeItems = items.filter((item) => item.claim_month === ACTIVE_BUDGET);
  const claimable = activeItems.filter((item) => item.status !== "excluded");
  const draftTotal = activeItems.filter((item) => (item.status === "draft" || item.status === "review") && !companyExpensePaid(item, transactions)).reduce((sum, item) => sum + item.amount, 0);
  const submittedTotal = activeItems.filter((item) => item.status === "submitted" && !companyExpensePaid(item, transactions)).reduce((sum, item) => sum + item.amount, 0);
  const paidTotal = activeItems.filter((item) => companyExpensePaid(item, transactions)).reduce((sum, item) => sum + item.amount, 0);
  const byType = new Map<string, number>();
  const uniqueWorkDates = new Set(activeItems.filter((item) => item.status !== "excluded").map((item) => item.date));

  for (const item of claimable) {
    byType.set(item.expense_type, (byType.get(item.expense_type) ?? 0) + item.amount);
  }

  const amountByType = (type: string) => byType.get(type) ?? 0;
  return {
    activeItems,
    itemCount: activeItems.length,
    workDays: uniqueWorkDates.size,
    claimableTotal: claimable.reduce((sum, item) => sum + item.amount, 0),
    draftTotal,
    submittedTotal,
    paidTotal,
    travelTotal: amountByType("Travel"),
    tollParkingTotal: amountByType("Toll") + amountByType("Parking"),
    perdiemTotal: amountByType("Perdiem"),
    byType: Array.from(byType.entries()).map(([type, amount]) => ({ type, amount })).sort((a, b) => b.amount - a.amount),
  };
}

export function otClaimSummary(items: OtClaimItem[], transactions: Transaction[] = []) {
  const activeItems = items.filter((item) => item.pay_month === ACTIVE_BUDGET);
  const claimable = activeItems.filter((item) => item.status !== "excluded");
  const paidItems = claimable.filter((item) => otClaimPaid(item, transactions));
  const forecastItems = claimable.filter((item) => !otClaimPaid(item, transactions));
  const expectedTotal = forecastItems.reduce((sum, item) => sum + otExpectedAmount(item), 0);
  const fullExpectedTotal = claimable.reduce((sum, item) => sum + otExpectedAmount(item), 0);
  const actualPaidTotal = paidItems.reduce((sum, item) => {
    const linkedPaid = transactions.filter((transaction) => isMatched(transaction, "ot_claim", item.id)).reduce((txSum, transaction) => txSum + transaction.amount, 0);
    return sum + (linkedPaid || item.actual_paid_amount || otExpectedAmount(item));
  }, 0);

  return {
    activeItems,
    itemCount: activeItems.length,
    ot1xHours: claimable.reduce((sum, item) => sum + item.ot_1x_hours, 0),
    ot15xHours: claimable.reduce((sum, item) => sum + item.ot_1_5x_hours, 0),
    ot3xHours: claimable.reduce((sum, item) => sum + item.ot_3x_hours, 0),
    expectedTotal,
    fullExpectedTotal,
    actualPaidTotal,
    variance: actualPaidTotal ? actualPaidTotal - fullExpectedTotal : 0,
  };
}

export function claimReviewTotal(data: FinanceData): number {
  const manualReview = data.claim_items.filter((item) => item.status === "review" || item.status === "claimable").reduce((sum, item) => sum + item.amount, 0);
  const companyExpense = companyExpenseSummary(data.company_expense_items, data.transactions);
  const ot = otClaimSummary(data.ot_claim_items, data.transactions);
  return manualReview + companyExpense.draftTotal + companyExpense.submittedTotal + ot.expectedTotal;
}

export function cardSummaries(data: FinanceData) {
  return data.cards.map((card) => {
    const items = data.card_items.filter((item) => sameCardName(item.card, card.card_name));
    const reviewAmount = items.filter((item) => item.claim_status === "review" || item.claim_status === "mixed").reduce((sum, item) => sum + item.amount, 0);
    const unpaidCount = items.filter((item) => item.paid_status === "unpaid").length;
    const transport = cardTransportAmount(card.card_name, data.card_items, data.transactions);
    const cycle = cardCycleSummary(card, data);
    return {
      card: card.card_name,
      statementCycle: card.statement_cycle,
      statementCutDay: card.statement_cut_day ?? 1,
      dueDay: card.due_day,
      outstanding: cardOutstanding(card.card_name, data.card_items, data.transactions),
      transportAmount: transport.amount,
      transportCount: transport.count,
      ...cycle,
      reviewAmount,
      unpaidCount,
    };
  });
}

export function claimCommandCenter(data: FinanceData) {
  const reviewItems = data.claim_items.filter((item) => item.status === "review" || item.status === "claimable");
  const companyExpense = companyExpenseSummary(data.company_expense_items, data.transactions);
  const ot = otClaimSummary(data.ot_claim_items, data.transactions);
  const draftClaim = data.claims.find((claim) => claim.claim_month === ACTIVE_BUDGET || claim.status === "draft");
  const reviewTotal = reviewItems.reduce((sum, item) => sum + item.amount, 0);
  const dueSoon = draftClaim ? Math.max(0, Math.ceil((toDate(draftClaim.submit_by).getTime() - toDate(TODAY).getTime()) / 86400000)) : 0;

  return {
    draftClaim,
    reviewItems,
    reviewTotal: reviewTotal + companyExpense.draftTotal + companyExpense.submittedTotal + ot.expectedTotal,
    companyExpense,
    ot,
    dueSoon,
    checklist: [
      { item: "Separate work / personal / mixed", done: reviewItems.length === 0 },
      { item: "Attach fuel / toll / onsite evidence", done: false },
      { item: "Submit to accounting before day 5", done: Boolean(draftClaim && toDate(TODAY) <= toDate(draftClaim.submit_by)) },
      { item: "Check reimbursement and OT on paid date", done: false },
    ],
  };
}

export function reconciliationItems(data: FinanceData): Array<{ source: string; id: string; title: string; amount: number; status: string }> {
  const items: Array<{ source: string; id: string; title: string; amount: number; status: string }> = [];
  for (const bill of data.bills) {
    if (!billIsPaid(bill, data.transactions)) items.push({ source: "Bill", id: billId(bill), title: bill.name, amount: bill.amount, status: bill.status });
  }
  for (const item of data.company_expense_items) {
    if (item.status !== "excluded" && !companyExpensePaid(item, data.transactions)) {
      items.push({ source: "Company Expense", id: item.id, title: `${item.date} ${item.expense_type} ${item.detail}`, amount: item.amount, status: item.status });
    }
  }
  for (const item of data.ot_claim_items) {
    if (item.status !== "excluded" && !otClaimPaid(item, data.transactions)) {
      items.push({ source: "OT Claim", id: item.id, title: `${item.date} ${item.detail}`, amount: otExpectedAmount(item), status: item.status });
    }
  }
  for (const item of data.card_items) {
    if (item.paid_status === "unpaid") items.push({ source: "Card", id: item.id, title: `${item.card} ${item.merchant_note}`, amount: item.amount, status: item.paid_status });
  }
  return items;
}

export function validationSignals(data: FinanceData): Array<{ level: "ok" | "warn" | "danger"; title: string; detail: string }> {
  const signals: Array<{ level: "ok" | "warn" | "danger"; title: string; detail: string }> = [];
  const missingRequired = data.transactions.filter((item) => !item.date || !item.amount || !item.type || !item.category).length;
  const walletMissing = data.transactions.filter((item) => item.payment_method !== "credit_card" && moneyOut(item) && !item.wallet && !item.from_wallet).length;
  const cardMissing = data.transactions.filter((item) => item.payment_method === "credit_card" && !item.card).length;
  const claimReview = data.claim_items.filter((item) => item.status === "review").length;
  const negativeWallets = walletBalances(data).filter((wallet) => wallet.current < 0);
  const summary = dashboardSummary(data);
  const billTotal = currentCycleBillsForData(data).reduce((sum, bill) => sum + bill.amount, 0);
  const spendable = summary.spendable;
  const unmatched = reconciliationItems(data).length;

  if (missingRequired) signals.push({ level: "danger", title: "Daily missing required fields", detail: `${missingRequired} transactions need date/amount/type/category` });
  if (walletMissing) signals.push({ level: "warn", title: "Wallet missing", detail: `${walletMissing} cash-out transactions need a wallet` });
  if (cardMissing) signals.push({ level: "warn", title: "Card missing", detail: `${cardMissing} credit card transactions need a card` });
  if (claimReview) signals.push({ level: "warn", title: "Claim review pending", detail: `${claimReview} items need work/personal split before claim` });
  if (unmatched) signals.push({ level: "warn", title: "Reconciliation pending", detail: `${unmatched} planned/forecast items still need Daily matching` });
  if (negativeWallets.length) signals.push({ level: "danger", title: "Negative wallet", detail: negativeWallets.map((wallet) => wallet.wallet).join(", ") });
  if (spendable < billTotal) signals.push({ level: "danger", title: "Current cycle cash gap", detail: `Spendable ${formatMoney(spendable)} vs bills before payday ${formatMoney(billTotal)}` });
  if (summary.nextPaydayGap < 0) {
    signals.push({ level: "danger", title: "Next payday allocation gap", detail: `Expected short by ${formatMoney(Math.abs(summary.nextPaydayGap))} on 30/06` });
  } else {
    signals.push({ level: "ok", title: "Next payday allocation", detail: `After bill allocation about ${formatMoney(summary.nextPaydayGap)} remains before fuel/toll changes` });
  }
  if (summary.survivalGap < 0 && summary.survivalGapAfterExpectedIncome >= 0) {
    signals.push({ level: "warn", title: "Waiting for expected support", detail: `Gap ${formatMoney(summary.survivalGap)} now, after expected money ${formatMoney(summary.survivalGapAfterExpectedIncome)}` });
  }
  if (summary.nextPaydayAfterFuelTollMin < 0) {
    signals.push({ level: "warn", title: "Fuel/toll pressure", detail: `After bill allocation and onsite buffer, range is ${formatMoney(summary.nextPaydayAfterFuelTollMax)} to ${formatMoney(summary.nextPaydayAfterFuelTollMin)}` });
  }
  if (!signals.length) signals.push({ level: "ok", title: "Looks controlled", detail: "No major risk signal found" });

  return signals;
}

export function dashboardSummary(data: FinanceData) {
  const wallets = walletBalances(data);
  const cashAvailable = wallets.reduce((sum, wallet) => sum + wallet.current, 0);
  const reserved = wallets.filter((wallet) => wallet.wallet === "MAKE").reduce((sum, wallet) => sum + wallet.current, 0);
  const spendable = cashAvailable - reserved;
  const bills = currentCycleBillsForData(data);
  const nextBills = nextPaydayBillsForData(data);
  const unpaidBillTotal = bills.reduce((sum, bill) => sum + bill.amount, 0);
  const nextPaydayAllocation = nextBills.reduce((sum, bill) => sum + bill.amount, 0);
  const futureDailyIncome = data.transactions
    .filter((transaction) => moneyIn(transaction) && toDate(transaction.date) > toDate(TODAY) && toDate(transaction.date) < toDate(NEXT_PAYDAY))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const companyExpense = companyExpenseSummary(data.company_expense_items, data.transactions);
  const ot = otClaimSummary(data.ot_claim_items, data.transactions);
  const companyExpenseForecast = companyExpense.draftTotal + companyExpense.submittedTotal;
  const otForecast = ot.expectedTotal;
  const waitingForecast = companyExpenseForecast + otForecast + futureDailyIncome;
  const cardLiability = data.cards.reduce((sum, card) => sum + cardOutstanding(card.card_name, data.card_items, data.transactions), 0);
  const daysLeft = daysLeftInPeriod(ACTIVE_BUDGET, TODAY);
  const dailySafe = spendable / daysLeft;
  const livingMin = daysLeft * LIVING_DAILY_MIN;
  const livingMax = daysLeft * LIVING_DAILY_MAX;
  const claimReview = claimReviewTotal(data);
  const heavyCategory = categoryBreakdown(data)[0]?.category ?? "none";
  const survivalGap = spendable - unpaidBillTotal;
  const survivalGapAfterExpectedIncome = spendable + futureDailyIncome - unpaidBillTotal;
  const nextPaydayIncomeForecast = BASE_SALARY_FORECAST + otForecast;
  const nextPaydayGap = nextPaydayIncomeForecast - nextPaydayAllocation;
  const nextPaydayAfterFuelTollMin = nextPaydayGap - FUEL_TOLL_BUFFER_MIN;
  const nextPaydayAfterFuelTollMax = nextPaydayGap - FUEL_TOLL_BUFFER_MAX;

  return {
    activeBudget: ACTIVE_BUDGET,
    today: TODAY,
    wallets,
    cashAvailable,
    reserved,
    spendable,
    unpaidBillTotal,
    currentCycleExpectedIncome: futureDailyIncome,
    waitingForecast,
    companyExpenseForecast,
    otForecast,
    survivalGapAfterExpectedIncome,
    nextPayday: NEXT_PAYDAY,
    nextPaydayIncomeForecast,
    nextPaydayAllocation,
    nextPaydayGap,
    cardLiability,
    daysLeft,
    dailySafe,
    livingMin,
    livingMax,
    afterLivingMin: spendable - livingMin,
    afterLivingMax: spendable - livingMax,
    fuelTollBufferMin: FUEL_TOLL_BUFFER_MIN,
    fuelTollBufferMax: FUEL_TOLL_BUFFER_MAX,
    nextPaydayAfterFuelTollMin,
    nextPaydayAfterFuelTollMax,
    claimReview,
    heavyCategory,
    survivalGap,
    status: survivalGap < 0 ? "Red: cash gap" : dailySafe < 300 ? "Very tight" : dailySafe < 600 ? "Control spending" : "Looks ok",
    action: survivalGap < 0 ? "Protect required bills first, then find top-up cash" : claimReview > 0 ? "Match claim/OT forecast with Daily when money arrives" : "Record Daily today",
  };
}

export function formatMoney(value: number): string {
  const hasSatang = Math.abs(value % 1) > 0.004;
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: hasSatang ? 2 : 0,
    maximumFractionDigits: hasSatang ? 2 : 0,
  }).format(value);
}
