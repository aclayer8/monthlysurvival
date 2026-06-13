"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { budgetMonthForDate } from "../lib/budget";
import { cardOutstanding, cardSummaries, categoryBreakdown, claimCommandCenter, companyExpenseSummary, dashboardSummary, formatMoney, monthlyCashflow, otClaimSummary, otExpectedAmount, reconciliationItems, unpaidBills, validationSignals, walletBalances } from "../lib/calculations";
import { ensureHousehold, getCurrentCloudUser, loadLatestCloudSnapshot, loginOrCreateCloudUser, logoutCloudUser, saveCloudSnapshot, type CloudUser } from "../lib/cloud-sync";
import { downloadCsvBundle, importCsvBundle } from "../lib/csv";
import { defaultFinanceData, loadFinanceData, resetFinanceData, saveFinanceData } from "../lib/storage";
import type { CompanyExpenseItem, CompanyOption, FinanceData, OtClaimItem, Transaction, TransactionType, ViewKey } from "../lib/types";

const navItems: Array<{ key: ViewKey; href: string; label: string }> = [
  { key: "dashboard", href: "/", label: "🏠 สรุป" },
  { key: "add", href: "/add", label: "➕ จดรายการ" },
  { key: "wallets", href: "/wallets", label: "👛 กระเป๋า" },
  { key: "cards", href: "/cards", label: "💳 บัตร" },
  { key: "company-expense", href: "/company-expense", label: "🚗 เคลมงาน" },
  { key: "ot", href: "/ot", label: "⏱️ OT" },
  { key: "claims", href: "/claims", label: "🧾 รอรับเงิน" },
];

const categoryLabels: Record<string, string> = {
  salary: "เงินเดือน",
  ot_income: "ค่า OT",
  family_support: "เงินสมทบครอบครัว",
  debt_loan: "จ่ายหนี้ / ค่างวด",
  statement_total: "ยอดสรุปบัตร",
  installment_note: "รายละเอียดผ่อน",
  interest_note: "ดอกเบี้ย / ค่าธรรมเนียม",
  insurance_installment: "ผ่อนประกัน",
  personal: "ใช้ส่วนตัว",
  transport: "เดินทาง / รถ",
  food: "อาหาร",
  groceries: "ของเข้าบ้าน",
  utilities: "ค่าน้ำไฟเน็ตมือถือ",
  shopping: "ซื้อของ",
  work_claim: "รอเบิกบริษัท",
};

const typeLabels: Record<string, string> = {
  income: "รายรับ",
  expense: "รายจ่าย",
  transfer: "โอนเงิน",
  debt_payment: "จ่ายหนี้ / ค่างวด",
  card_payment: "จ่ายบัตร",
  reimbursement: "เงินเบิกคืน",
};

const statusLabels: Record<string, string> = {
  unpaid: "ยังไม่จ่าย",
  planned: "วางแผนไว้",
  paid: "จ่ายแล้ว",
  none: "ไม่เบิก",
  review: "รอตรวจ",
  mixed: "รอแยกงาน/ส่วนตัว",
  work: "เบิกบริษัท",
  personal: "ส่วนตัว",
  submitted: "ส่งแล้ว",
  claimable: "เบิกได้",
  excluded: "ไม่นับ",
  draft: "ร่าง",
};

const companyExpenseTypeLabels: Record<string, string> = {
  Travel: "ค่าเดินทาง / ค่ารถ",
  Perdiem: "เบี้ยเลี้ยง",
  Entertain: "รับรองลูกค้า",
  Training: "อบรม",
  Toll: "ค่าทางด่วน",
  Parking: "ค่าจอดรถ",
  Accessories: "อุปกรณ์",
  Other: "อื่น ๆ",
};

const billNameLabels: Record<string, string> = {
  "KKP current car installment": "KKP ค่างวดรถรอบนี้",
  "KTC statement": "บัตร KTC",
  "Firstchoice statement": "บัตร Firstchoice",
  Shopee: "Shopee",
  "BBL car insurance next installment": "BBL ผ่อนประกันรถรอบหน้า",
  Internet: "ค่า Internet",
  "Mobile package": "ค่าแพ็กเกจมือถือ",
  "Electricity estimate high": "ค่าไฟ ประมาณการสูง",
  "True PayNextExtra iPhone": "True PayNextExtra iPhone",
  "The1 Central Garmin": "The1 Central Garmin",
  "KBANK card installments": "บัตร KBANK / รายการผ่อน",
  "KKP next round reserve": "กันเงิน KKP รอบหน้า",
};

function labelCategory(value: string): string {
  return categoryLabels[value] ?? value.replaceAll("_", " ");
}

function labelType(value: string): string {
  return typeLabels[value] ?? value.replaceAll("_", " ");
}

function labelStatus(value: string): string {
  return statusLabels[value] ?? value.replaceAll("_", " ");
}

function labelBillName(value: string): string {
  return billNameLabels[value] ?? value;
}

function labelCompanyExpenseType(value: string): string {
  return companyExpenseTypeLabels[value] ?? value;
}

export function FinanceApp({ initialView }: { initialView: ViewKey }) {
  const [data, setData] = useState<FinanceData>(() => defaultFinanceData());
  const [importMessage, setImportMessage] = useState("");
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null);
  const [householdId, setHouseholdId] = useState("");
  const [cloudEmail, setCloudEmail] = useState("");
  const [cloudPassword, setCloudPassword] = useState("");
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudMessage, setCloudMessage] = useState("");
  const summary = useMemo(() => dashboardSummary(data), [data]);

  useEffect(() => {
    setData(loadFinanceData());
  }, []);

  useEffect(() => {
    getCurrentCloudUser()
      .then(async (user) => {
        if (!user) {
          setCloudMessage("Login to save or load cloud data.");
          return;
        }
        setCloudUser(user);
        const nextHouseholdId = await ensureHousehold(user);
        setHouseholdId(nextHouseholdId);
        setCloudMessage("Cloud ready. Use Save Cloud or Load Cloud.");
      })
      .catch((error) => setCloudMessage(`Cloud setup failed: ${error.message}`));
  }, []);

  function updateData(next: FinanceData) {
    setData(next);
    saveFinanceData(next);
  }

  async function loginCloud() {
    if (!cloudEmail || !cloudPassword) {
      setCloudMessage("Enter email and password first.");
      return;
    }
    setCloudBusy(true);
    try {
      const user = await loginOrCreateCloudUser(cloudEmail, cloudPassword);
      const nextHouseholdId = await ensureHousehold(user);
      setCloudUser(user);
      setHouseholdId(nextHouseholdId);
      setCloudMessage("Login ready. Use Save Cloud to upload this browser data.");
    } catch (error) {
      setCloudMessage(error instanceof Error ? error.message : "Cloud login failed.");
    } finally {
      setCloudBusy(false);
    }
  }

  async function logoutCloud() {
    setCloudBusy(true);
    try {
      await logoutCloudUser();
      setCloudUser(null);
      setHouseholdId("");
      setCloudMessage("Logged out.");
    } finally {
      setCloudBusy(false);
    }
  }

  async function saveCloud() {
    if (!householdId) {
      setCloudMessage("Login first.");
      return;
    }
    setCloudBusy(true);
    try {
      await saveCloudSnapshot(householdId, data);
      setCloudMessage("Saved to Supabase cloud.");
    } catch (error) {
      setCloudMessage(error instanceof Error ? error.message : "Cloud save failed.");
    } finally {
      setCloudBusy(false);
    }
  }

  async function loadCloud() {
    if (!householdId) {
      setCloudMessage("Login first.");
      return;
    }
    setCloudBusy(true);
    try {
      const next = await loadLatestCloudSnapshot(householdId);
      if (!next) {
        setCloudMessage("No cloud snapshot yet. Use Save Cloud first.");
        return;
      }
      updateData(next);
      setCloudMessage("Loaded latest Supabase cloud snapshot.");
    } catch (error) {
      setCloudMessage(error instanceof Error ? error.message : "Cloud load failed.");
    } finally {
      setCloudBusy(false);
    }
  }

  async function importFiles(event: ChangeEvent<HTMLInputElement>) {
    if (!event.target.files?.length) return;
    const result = await importCsvBundle(event.target.files, data);
    if (!result.imported.length) {
      setImportMessage("No matching CSV files. Use CSV bundle files such as transactions.csv, wallet_snapshots.csv, cards.csv, card_items.csv, company_expense_items.csv, company_options.csv, claims.csv, claim_items.csv, or bills.csv");
      return;
    }
    updateData(result.data);
    setImportMessage(`Imported ${result.imported.join(", ")}`);
    event.target.value = "";
  }

  function saveJsonBackup() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `monthly-survival-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setImportMessage("Saved JSON backup");
  }

  async function loadJsonBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const next = JSON.parse(await file.text()) as FinanceData;
      updateData(next);
      setImportMessage(`Loaded JSON backup: ${file.name}`);
    } catch {
      setImportMessage("JSON backup load failed. Please choose a Monthly Survival backup file.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">Monthly Survival</p>
          <h1>🏠 เดือนนี้รอดไหม</h1>
          <p className="topbar-subtitle">ดูเงินจริงก่อน รายละเอียดค่อยเปิดทีหลัง</p>
        </div>
        <details className="tools-menu">
          <summary>Tools</summary>
          <div className="top-actions">
            <label className="import-button">
              Import CSV
              <input type="file" accept=".csv" multiple onChange={importFiles} />
            </label>
            <button className="ghost" onClick={saveJsonBackup}>Save JSON</button>
            <label className="import-button">
              Load JSON
              <input type="file" accept=".json" onChange={loadJsonBackup} />
            </label>
            <button className="ghost" onClick={() => downloadCsvBundle(data)}>Export CSV</button>
            <button className="ghost danger" onClick={() => updateData(resetFinanceData())}>Reset Sample</button>
            <div className="cloud-panel">
              <div className="cloud-title">Cloud Sync</div>
              {cloudUser ? (
                <>
                  <div className="cloud-user">{cloudUser.email ?? "Logged in"}</div>
                  <button className="ghost" disabled={cloudBusy} onClick={saveCloud}>Save Cloud</button>
                  <button className="ghost" disabled={cloudBusy} onClick={loadCloud}>Load Cloud</button>
                  <button className="ghost" disabled={cloudBusy} onClick={logoutCloud}>Logout</button>
                </>
              ) : (
                <>
                  <input value={cloudEmail} onChange={(event) => setCloudEmail(event.target.value)} placeholder="email" type="email" />
                  <input value={cloudPassword} onChange={(event) => setCloudPassword(event.target.value)} placeholder="password" type="password" />
                  <button className="ghost" disabled={cloudBusy} onClick={loginCloud}>Login / Create</button>
                </>
              )}
              <div className="cloud-message">{cloudMessage}</div>
            </div>
          </div>
        </details>
      </header>
      {importMessage && <div className="import-message">{importMessage}</div>}

      <nav className="nav">
        {navItems.map((item) => (
          <Link key={item.key} className={initialView === item.key ? "active" : ""} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>

      {initialView === "dashboard" && <CleanDashboard data={data} />}
      {initialView === "add" && <AddTransactionV2 data={data} onChange={updateData} />}
      {initialView === "wallets" && <CleanWallets data={data} />}
      {initialView === "cards" && <Cards data={data} />}
      {initialView === "company-expense" && <CleanCompanyExpense data={data} onChange={updateData} />}
      {initialView === "ot" && <OtClaim data={data} onChange={updateData} />}
      {initialView === "claims" && <Claims data={data} />}

      <footer className="footer">
        Google Sheet remains source of truth. This MVP uses local sample/localStorage plus CSV export; no OAuth or bank API yet.
      </footer>
    </main>
  );
}

function CleanDashboard({ data }: { data: FinanceData }) {
  const summary = dashboardSummary(data);
  const categories = categoryBreakdown(data).slice(0, 6);
  const cashflow = monthlyCashflow(data);
  const urgentBills = unpaidBills(data.bills, data.transactions)
    .filter((bill) => (bill.planned_pay_date ?? bill.due_date) < summary.nextPayday)
    .slice(0, 6);
  const nextPaydayBills = unpaidBills(data.bills, data.transactions)
    .filter((bill) => (bill.planned_pay_date ?? bill.due_date) >= summary.nextPayday)
    .slice(0, 10);
  const signals = validationSignals(data);
  const reconciliation = reconciliationItems(data).slice(0, 10);
  const walletOrder = ["KBANK", "CASH", "BBL", "MAKE", "TTB"];
  const wallets = [...summary.wallets].sort((a, b) => walletOrder.indexOf(a.wallet) - walletOrder.indexOf(b.wallet));
  const survivalTitle = urgentBills.length
    ? summary.survivalGap < 0
      ? "ต้องระวัง กระแสเงินก่อนเงินเดือนติดลบ"
      : "รอดได้ แต่ต้องคุมใช้จนถึงเงินเดือน"
    : "ตอนนี้จ่ายครบแล้ว เหลือแค่รอสิ้นเดือน";
  const survivalDetail = urgentBills.length
    ? `ยังมีรายการก่อนเงินเดือน ${urgentBills.length} รายการ รวม ${formatMoney(summary.unpaidBillTotal)}`
    : "KKP จ่ายแล้ว และ wallet ตั้งต้นใหม่คือ KBANK 19,020.47 + CASH 60";

  return (
    <section className="stack clean-dashboard">
      <section className="survival-hero">
        <div>
          <p className="eyebrow">TODAY SNAPSHOT</p>
          <h2>{survivalTitle}</h2>
          <p>{survivalDetail}</p>
        </div>
        <Link className="hero-action" href="/add">➕ จดรายการใหม่</Link>
      </section>

      <div className="clean-kpi-grid">
        <Kpi title="เดือนนี้รอดไหม" value={summary.survivalGap < 0 ? "ต้องระวัง" : "รอดตอนนี้"} tone={summary.survivalGap < 0 ? "red" : "green"} />
        <Kpi title="เงินเหลือจริง" value={formatMoney(summary.cashAvailable)} tone="blue" />
        <Kpi title="ใช้ได้ต่อวัน" value={formatMoney(summary.dailySafe)} tone={summary.dailySafe < 500 ? "amber" : "green"} />
        <Kpi title="รอเตรียมสิ้นเดือน" value={formatMoney(summary.nextPaydayAllocation)} tone="amber" />
      </div>

      <div className="wallet-chip-row" aria-label="wallet balances">
        {wallets.map((wallet) => (
          <div className={wallet.current <= 0 ? "wallet-chip muted" : "wallet-chip"} key={wallet.wallet}>
            <span>{wallet.wallet}</span>
            <strong>{formatMoney(wallet.current)}</strong>
          </div>
        ))}
      </div>

      <div className="two-col">
        <Panel title={urgentBills.length ? "⚠️ รายการค้างก่อนเงินเดือน" : "✅ สถานะตอนนี้"}>
          {urgentBills.length ? (
            <Table headers={["รายการ", "ยอด", "Plan", "Due"]} rows={urgentBills.map((bill) => [labelBillName(bill.name), formatMoney(bill.amount), bill.planned_pay_date ?? bill.due_date, bill.due_date])} />
          ) : (
            <div className="empty-state">
              <strong>ไม่มีบิลค้างตอนนี้</strong>
              <span>KKP จ่ายแล้ว กระเป๋าล่าสุดคือ KBANK 19,020.47, CASH 60, BBL/MAKE/TTB = 0</span>
            </div>
          )}
        </Panel>

        <Panel title="🗓️ รอจ่ายวันเงินเข้า">
          <Table headers={["รายการ", "ยอด", "Plan", "Due"]} rows={nextPaydayBills.map((bill) => [labelBillName(bill.name), formatMoney(bill.amount), bill.planned_pay_date ?? bill.due_date, bill.due_date])} />
        </Panel>
      </div>

      <div className="two-col">
        <Panel title="🔥 ใช้หนักหมวดไหน">
          <Table
            headers={["หมวด", "ยอด", "%"]}
            rows={categories.map((item) => [labelCategory(item.category), formatMoney(item.amount), `${Math.round(item.share * 100)}%`])}
          />
        </Panel>
        <Panel title="👨‍👩‍👧 สรุปให้ที่บ้านดู">
          <ul className="plain-list compact-list">
            <li>เงินสดจริงตอนนี้ <strong>{formatMoney(summary.cashAvailable)}</strong></li>
            <li>ใช้ได้ประมาณวันละ <strong>{formatMoney(summary.dailySafe)}</strong> ถึงเงินเดือน</li>
            <li>บิลค้างก่อนเงินเดือน <strong>{urgentBills.length ? formatMoney(summary.unpaidBillTotal) : "ไม่มี"}</strong></li>
            <li>รอเตรียมสิ้นเดือนประมาณ <strong>{formatMoney(summary.nextPaydayAllocation)}</strong></li>
          </ul>
        </Panel>
      </div>

      <details className="detail-panel">
        <summary>🔍 รายละเอียดสำหรับตรวจ</summary>
        <div className="detail-grid">
          <Panel title="เงินรอเข้า / Forecast">
            <div className="answer-grid compact">
              <MiniAnswer title="เงินรอเข้า" value={formatMoney(summary.waitingForecast)} detail="OT + claim + expected income" />
              <MiniAnswer title="OT forecast" value={formatMoney(summary.otForecast)} detail="ยังไม่ใช่เงินจริงจนกว่าเงินเข้า" />
              <MiniAnswer title="Company claim" value={formatMoney(summary.companyExpenseForecast)} detail="ยอดเคลมที่ยังไม่ paid" />
              <MiniAnswer title="ยังไม่ match" value={String(reconciliation.length)} detail="forecast/planned ที่ยังไม่โยง Daily" />
            </div>
          </Panel>
          <Panel title="Cashflow เดือนนี้">
            <div className="answer-grid compact">
              <MiniAnswer title="รายรับ" value={formatMoney(cashflow.income)} detail="ตาม Daily/ข้อมูลเดือนนี้" />
              <MiniAnswer title="รายจ่าย" value={formatMoney(cashflow.expenses)} detail="รวม wallet + card charges" />
              <MiniAnswer title="คงเหลือ" value={formatMoney(cashflow.balance)} detail="cashflow ไม่ใช่ wallet snapshot" />
            </div>
          </Panel>
          <Panel title="Reconciliation">
            <Table headers={["Source", "Title", "Amount", "Status"]} rows={reconciliation.map((item) => [item.source, item.title, formatMoney(item.amount), item.status])} />
          </Panel>
          <Panel title="Risk Radar">
            <SignalList signals={signals} />
          </Panel>
        </div>
      </details>
    </section>
  );
}

function Dashboard({ data }: { data: FinanceData }) {
  const summary = dashboardSummary(data);
  const categories = categoryBreakdown(data).slice(0, 6);
  const cashflow = monthlyCashflow(data);
  const bills = unpaidBills(data.bills, data.transactions).slice(0, 6);
  const nextPaydayBills = unpaidBills(data.bills, data.transactions)
    .filter((bill) => (bill.planned_pay_date ?? bill.due_date) >= summary.nextPayday)
    .slice(0, 8);
  const signals = validationSignals(data);
  const reconciliation = reconciliationItems(data).slice(0, 10);

  return (
    <section className="stack">
      <ExpenseOwlShowcase categories={categories} cashflow={cashflow} activeBudget={summary.activeBudget} />

      <div className="hero-grid">
        <Kpi title="เงินสด/กระเป๋ารวม" value={formatMoney(summary.cashAvailable)} tone="blue" />
        <Kpi title="เงินกินใช้ได้จริง" value={formatMoney(summary.spendable)} tone="green" />
        <Kpi title="ใช้ได้ต่อวัน" value={formatMoney(summary.dailySafe)} tone={summary.dailySafe < 600 ? "amber" : "green"} />
        <Kpi title="หนี้บัตรค้าง" value={formatMoney(summary.cardLiability)} tone="red" />
      </div>

      <div className="hero-grid">
        <Kpi title="Waiting Forecast" value={formatMoney(summary.waitingForecast)} tone="amber" />
        <Kpi title="OT Forecast" value={formatMoney(summary.otForecast)} tone="blue" />
        <Kpi title="Company Claim Forecast" value={formatMoney(summary.companyExpenseForecast)} tone="blue" />
        <Kpi title="Not Matched" value={String(reconciliation.length)} tone={reconciliation.length ? "amber" : "green"} />
      </div>

      <div className="status-band">
        <div>
          <p className="label">สถานะ {summary.activeBudget}</p>
          <h2>{summary.status}</h2>
        </div>
        <div>
          <p className="label">Action วันนี้</p>
          <strong>{summary.action}</strong>
        </div>
        <div>
          <p className="label">ต้อง review/เบิก</p>
          <strong>{formatMoney(summary.claimReview)}</strong>
        </div>
      </div>

      <div className="answer-grid">
        <MiniAnswer title="เดือนนี้รอดไหม" value={summary.status} detail={`ช่องว่างหลังบิล: ${formatMoney(summary.survivalGap)}`} />
        <MiniAnswer title="เหลือวันละเท่าไร" value={formatMoney(summary.dailySafe)} detail={`เหลือ ${summary.daysLeft} วันในรอบนี้`} />
        <MiniAnswer title="อะไรยังไม่จ่าย" value={formatMoney(summary.unpaidBillTotal)} detail={`${bills.length} รายการที่ยังไม่ paid`} />
        <MiniAnswer title="ใช้หนักหมวดไหน" value={labelCategory(summary.heavyCategory)} detail="ดู category breakdown ด้านล่าง" />
        <MiniAnswer title="ต้องเบิก/review" value={formatMoney(summary.claimReview)} detail="แยก work/personal ก่อนวันที่ 5" />
      </div>

      <Panel title="15/06 KKP Bridge">
        <div className="answer-grid compact">
          <MiniAnswer title="เงินที่รอเข้า" value={formatMoney(summary.currentCycleExpectedIncome)} detail="พ่อโอนเข้า KBANK เพื่อสมทบ KKP" />
          <MiniAnswer title="บิลก่อนเงินเดือน" value={formatMoney(summary.unpaidBillTotal)} detail="ตอนนี้หลัก ๆ คือ KKP 15/06" />
          <MiniAnswer title="Gap ตอนนี้" value={formatMoney(summary.survivalGap)} detail="ยังไม่รวมเงินพ่อที่ยังไม่เข้าจริง" />
          <MiniAnswer title="หลังเงินพ่อเข้า" value={formatMoney(summary.survivalGapAfterExpectedIncome)} detail="ถ้าเงินเข้าและจ่ายตามแผน" />
          <MiniAnswer title="MAKE ห้ามแตะ" value={formatMoney(summary.reserved)} detail="กันไว้เป็นส่วนหนึ่งของ KKP" />
        </div>
      </Panel>

      <Panel title="30/06 Salary Allocation Plan">
        <div className="answer-grid compact">
          <MiniAnswer title="เงินเดือน + OT คาดการณ์" value={formatMoney(summary.nextPaydayIncomeForecast)} detail={`เข้า ${summary.nextPayday}`} />
          <MiniAnswer title="ต้องกันบิล/บัตร" value={formatMoney(summary.nextPaydayAllocation)} detail="รวม KTC, Firstchoice, Shopee, bill, KKP reserve" />
          <MiniAnswer title="เหลือหลังกันเงิน" value={formatMoney(summary.nextPaydayGap)} detail="ยังไม่รวม fuel/toll ที่อาจเพิ่มก่อนสิ้นเดือน" />
          <MiniAnswer title="กินใช้ขั้นต่ำ" value={`${formatMoney(summary.livingMin)}-${formatMoney(summary.livingMax)}`} detail={`คิด ${summary.daysLeft} วัน x 300-500`} />
          <MiniAnswer title="Fuel/Toll Buffer" value={`${formatMoney(summary.fuelTollBufferMin)}-${formatMoney(summary.fuelTollBufferMax)}`} detail="ใช้บัตร KTC ก่อน แล้วค่อยแยกเบิกบริษัท" />
          <MiniAnswer title="หลัง Fuel/Toll" value={`${formatMoney(summary.nextPaydayAfterFuelTollMax)} ถึง ${formatMoney(summary.nextPaydayAfterFuelTollMin)}`} detail="ถ้า onsite 5-8 วันก่อน reimbursement" />
        </div>
      </Panel>

      <div className="two-col">
        <Panel title="ใช้หนักหมวดไหน">
          <Table
            headers={["หมวด", "ยอด", "%"]}
            rows={categories.map((item) => [labelCategory(item.category), formatMoney(item.amount), `${Math.round(item.share * 100)}%`])}
          />
        </Panel>
        <Panel title="บิล/หนี้/บัตรที่ยังไม่จ่าย">
          <Table headers={["รายการ", "ยอด", "Plan", "Due"]} rows={bills.map((bill) => [labelBillName(bill.name), formatMoney(bill.amount), bill.planned_pay_date ?? bill.due_date, bill.due_date])} />
        </Panel>
      </div>

      <Panel title="บิลที่ต้องกันทันทีตอนเงินเดือนออก">
        <Table headers={["Item", "Amount", "Plan Pay", "Due", "Source"]} rows={nextPaydayBills.map((bill) => [labelBillName(bill.name), formatMoney(bill.amount), bill.planned_pay_date ?? bill.due_date, bill.due_date, bill.source])} />
      </Panel>

      <Panel title="Reconciliation: forecast/planned not matched with Daily">
        <Table headers={["Source", "Title", "Amount", "Status"]} rows={reconciliation.map((item) => [item.source, item.title, formatMoney(item.amount), item.status])} />
      </Panel>

      <div className="two-col">
        <Panel title="Risk Radar">
          <SignalList signals={signals} />
        </Panel>
        <Panel title="Wife Summary + Bills">
          <ul className="plain-list">
            <li>เงินกินใช้ได้จริงตอนนี้: <strong>{formatMoney(summary.spendable)}</strong></li>
            <li>ใช้ได้ต่อวัน: <strong>{formatMoney(summary.dailySafe)}</strong></li>
            <li>บัตรค้างรวม: <strong>{formatMoney(summary.cardLiability)}</strong></li>
            <li>30/06 ต้องกันบิล/บัตร: <strong>{formatMoney(summary.nextPaydayAllocation)}</strong></li>
            <li>คาดว่าเหลือหลังกันเงิน: <strong>{formatMoney(summary.nextPaydayGap)}</strong></li>
            <li>Action วันนี้: <strong>{summary.action}</strong></li>
          </ul>
        </Panel>
      </div>
    </section>
  );
}

function AddTransaction({ data, onChange }: { data: FinanceData; onChange: (data: FinanceData) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get("date"));
    const transaction: Transaction = {
      id: `t-${Date.now()}`,
      date,
      amount: Number(form.get("amount")),
      type: String(form.get("type")) as TransactionType,
      category: String(form.get("category")),
      wallet: String(form.get("wallet") || ""),
      payment_method: String(form.get("payment_method") || "") as Transaction["payment_method"],
      card: String(form.get("card") || ""),
      note: String(form.get("note") || ""),
      tags: String(form.get("tags") || ""),
      budget_month: budgetMonthForDate(date),
    };
    onChange({ ...data, transactions: [transaction, ...data.transactions] });
    event.currentTarget.reset();
  }

  return (
    <section className="two-col">
      <Panel title="Quick Form">
        <form className="form" onSubmit={submit}>
          <label>Date<input name="date" type="date" defaultValue="2026-06-14" required /></label>
          <label>Amount<input name="amount" type="number" min="0" step="0.01" required /></label>
          <label>Type<select name="type" defaultValue="expense"><option value="income">รายรับ</option><option value="expense">รายจ่าย</option><option value="transfer">โอนเงิน</option><option value="debt_payment">จ่ายหนี้ / ค่างวด</option><option value="card_payment">จ่ายบัตร</option><option value="reimbursement">เงินเบิกคืน</option></select></label>
          <label>Category<select name="category" defaultValue="food" required><option value="food">อาหาร</option><option value="groceries">ของเข้าบ้าน</option><option value="transport">เดินทาง / รถ</option><option value="utilities">ค่าน้ำไฟเน็ตมือถือ</option><option value="shopping">ซื้อของ</option><option value="personal">ใช้ส่วนตัว</option><option value="work_claim">รอเบิกบริษัท</option><option value="debt_loan">จ่ายหนี้ / ค่างวด</option><option value="salary">เงินเดือน</option><option value="ot_income">ค่า OT</option><option value="family_support">เงินสมทบครอบครัว</option></select></label>
          <label>Wallet<select name="wallet" defaultValue="KBANK"><option value="">-</option><option>KBANK</option><option>BBL</option><option>MAKE</option><option>TTB</option><option>CASH</option></select></label>
          <label>Method<select name="payment_method" defaultValue="promptpay"><option>promptpay</option><option>cash</option><option>wallet</option><option>auto_debit</option><option>credit_card</option></select></label>
          <label>Card<select name="card" defaultValue=""><option value="">-</option><option>KTC</option><option>Firstchoice</option><option>Shopee</option><option>KBANK Card</option><option>BBL Credit</option></select></label>
          <label>Tags<input name="tags" placeholder="personal, work_claim, debt" /></label>
          <label className="wide">Note<input name="note" placeholder="จดสั้นๆ พอ" /></label>
          <button type="submit">Add Transaction</button>
        </form>
      </Panel>
      <Panel title="รายการล่าสุด">
        <Table
          headers={["Date", "Amount", "Type", "Category", "Wallet/Card"]}
          rows={data.transactions.slice(0, 8).map((item) => [item.date, formatMoney(item.amount), labelType(item.type), labelCategory(item.category), item.card || item.wallet || "-"])}
        />
      </Panel>
    </section>
  );
}

function AddTransactionV2({ data, onChange }: { data: FinanceData; onChange: (data: FinanceData) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get("date"));
    const type = String(form.get("type")) as TransactionType;
    const direction = String(form.get("direction") || (type === "income" || type === "reimbursement" ? "in" : "out")) as Transaction["direction"];
    const transaction: Transaction = {
      id: `t-${Date.now()}`,
      date,
      amount: Number(form.get("amount")),
      type,
      category: String(form.get("category")),
      wallet: String(form.get("wallet") || ""),
      from_wallet: String(form.get("from_wallet") || ""),
      to_wallet: String(form.get("to_wallet") || ""),
      payment_method: String(form.get("payment_method") || "") as Transaction["payment_method"],
      card: String(form.get("card") || ""),
      note: String(form.get("note") || ""),
      tags: String(form.get("tags") || ""),
      budget_month: budgetMonthForDate(date),
      linked_type: String(form.get("linked_type") || "manual") as Transaction["linked_type"],
      linked_id: String(form.get("linked_id") || ""),
      direction,
      cleared_status: String(form.get("cleared_status") || "cleared") as Transaction["cleared_status"],
    };
    onChange({ ...data, transactions: [transaction, ...data.transactions] });
    event.currentTarget.reset();
  }

  const linkOptions = [
    ...data.bills.map((item) => ({ type: "bill", id: item.id || item.name, label: `Bill: ${item.name}` })),
    ...data.card_items.map((item) => ({ type: "card_item", id: item.id, label: `Card: ${item.card} ${item.merchant_note}` })),
    ...data.company_expense_items.map((item) => ({ type: "company_expense", id: item.id, label: `Expense: ${item.date} ${item.expense_type} ${item.detail}` })),
    ...data.ot_claim_items.map((item) => ({ type: "ot_claim", id: item.id, label: `OT: ${item.date} ${item.detail}` })),
    ...data.claims.map((item) => ({ type: "claim", id: item.claim_month, label: `Claim: ${item.claim_month}` })),
  ];

  return (
    <section className="two-col">
      <Panel title="Daily Transaction - Source of Truth">
        <form className="form" onSubmit={submit}>
          <label>Flow<select name="flow" defaultValue="wallet_expense"><option value="wallet_expense">ใช้จ่ายเงินสด/โอนจาก wallet</option><option value="credit_card_charge">รูดบัตรเครดิต</option><option value="bill_payment">จ่ายบิล/หนี้</option><option value="card_payment">จ่ายบัตรเครดิต</option><option value="salary">รับเงินเดือน</option><option value="ot_income">รับ OT</option><option value="reimbursement">รับเงินเบิกบริษัท</option><option value="transfer">โอนเงินระหว่างกระเป๋า</option></select></label>
          <label>Date<input name="date" type="date" defaultValue="2026-06-14" required /></label>
          <label>Amount<input name="amount" type="number" min="0" step="0.01" required /></label>
          <label>Type<select name="type" defaultValue="expense"><option value="income">income</option><option value="expense">expense</option><option value="transfer">transfer</option><option value="debt_payment">debt_payment</option><option value="card_payment">card_payment</option><option value="reimbursement">reimbursement</option></select></label>
          <label>Category<select name="category" defaultValue="food" required><option value="food">food</option><option value="groceries">groceries</option><option value="transport">transport</option><option value="utilities">utilities</option><option value="shopping">shopping</option><option value="personal">personal</option><option value="work_claim">work_claim</option><option value="debt_loan">debt_loan</option><option value="salary">salary</option><option value="ot_income">ot_income</option><option value="family_support">family_support</option></select></label>
          <label>Wallet<select name="wallet" defaultValue="KBANK"><option value="">-</option><option>KBANK</option><option>BBL</option><option>MAKE</option><option>TTB</option><option>CASH</option></select></label>
          <label>From Wallet<select name="from_wallet" defaultValue=""><option value="">-</option><option>KBANK</option><option>BBL</option><option>MAKE</option><option>TTB</option><option>CASH</option></select></label>
          <label>To Wallet<select name="to_wallet" defaultValue=""><option value="">-</option><option>KBANK</option><option>BBL</option><option>MAKE</option><option>TTB</option><option>CASH</option></select></label>
          <label>Method<select name="payment_method" defaultValue="promptpay"><option>promptpay</option><option>cash</option><option>wallet</option><option>auto_debit</option><option>credit_card</option></select></label>
          <label>Card<select name="card" defaultValue=""><option value="">-</option><option>KTC</option><option>Firstchoice</option><option>Shopee</option><option>KBANK Card</option><option>BBL Credit</option></select></label>
          <label>Direction<select name="direction" defaultValue="out"><option value="out">เงินออก</option><option value="in">เงินเข้า</option></select></label>
          <label>Status<select name="cleared_status" defaultValue="cleared"><option value="cleared">cleared</option><option value="pending">pending</option><option value="matched">matched</option></select></label>
          <label>Linked Type<select name="linked_type" defaultValue="manual"><option value="manual">manual</option><option value="bill">bill</option><option value="card_item">card_item</option><option value="company_expense">company_expense</option><option value="ot_claim">ot_claim</option><option value="claim">claim</option></select></label>
          <label className="wide">Linked Item<select name="linked_id" defaultValue=""><option value="">-</option>{linkOptions.map((item) => <option key={`${item.type}-${item.id}`} value={item.id}>{item.label}</option>)}</select></label>
          <label>Tags<input name="tags" placeholder="personal, work_claim, debt" /></label>
          <label className="wide">Note<input name="note" placeholder="short note" /></label>
          <button type="submit">Add Transaction</button>
        </form>
      </Panel>
      <Panel title="Latest Daily Transactions">
        <Table
          headers={["Date", "Amount", "Type", "Category", "Wallet/Card/Link"]}
          rows={data.transactions.slice(0, 8).map((item) => [item.date, formatMoney(item.amount), labelType(item.type), labelCategory(item.category), `${item.card || item.wallet || item.from_wallet || "-"} ${item.linked_type ? `-> ${item.linked_type}` : ""}`])}
        />
      </Panel>
    </section>
  );
}

const chartColors = ["#8be9fd", "#ff5555", "#ffb86c", "#50fa7b", "#bd93f9", "#f1fa8c", "#ff79c6", "#6272a4"];

function ExpenseOwlShowcase({
  categories,
  cashflow,
  activeBudget,
}: {
  categories: Array<{ category: string; amount: number; share: number }>;
  cashflow: { income: number; expenses: number; balance: number };
  activeBudget: string;
}) {
  const total = categories.reduce((sum, item) => sum + item.amount, 0);

  return (
    <section className="expenseowl-showcase">
      <div className="showcase-header">
        <div className="brand-mark">MS</div>
        <div className="month-picker">
          <button className="round-button" aria-label="Previous month">{"<"}</button>
          <h2>{activeBudget}</h2>
          <button className="round-button" aria-label="Next month">{">"}</button>
        </div>
        <Link className="add-pill" href="/add">+ Add Transaction</Link>
      </div>

      <div className="chart-card">
        <DonutChart categories={categories} total={total} />
        <div className="legend-list">
          {categories.length ? (
            categories.map((item, index) => (
              <div className="legend-row" key={item.category}>
                <span className="swatch" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                <span>{labelCategory(item.category)} ({Math.round(item.share * 100)}%)</span>
                <strong>{formatMoney(item.amount)}</strong>
              </div>
            ))
          ) : (
            <p className="hint">ยังไม่มีรายการใช้จ่ายในเดือนนี้</p>
          )}
          <div className="legend-total">
            <span>Total</span>
            <strong>{formatMoney(total)}</strong>
          </div>
        </div>
      </div>

      <div className="cashflow-cards">
        <div className="cash-card income">
          <p>Income</p>
          <strong>{formatMoney(cashflow.income)}</strong>
        </div>
        <div className="cash-card expenses">
          <p>Expenses</p>
          <strong>{formatMoney(cashflow.expenses)}</strong>
        </div>
        <div className={`cash-card balance ${cashflow.balance < 0 ? "negative" : "positive"}`}>
          <p>Balance</p>
          <strong>{formatMoney(cashflow.balance)}</strong>
        </div>
      </div>
    </section>
  );
}

function DonutChart({ categories, total }: { categories: Array<{ category: string; amount: number; share: number }>; total: number }) {
  const radius = 82;
  const stroke = 44;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  if (!total) {
    return (
      <div className="donut-wrap">
        <svg viewBox="0 0 220 220" role="img" aria-label="No expense data">
          <circle cx="110" cy="110" r={radius} fill="none" stroke="#44475a" strokeWidth={stroke} />
          <circle cx="110" cy="110" r="46" fill="#343746" />
        </svg>
      </div>
    );
  }

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 220 220" role="img" aria-label="Expense category breakdown">
        <circle cx="110" cy="110" r={radius} fill="none" stroke="#44475a" strokeWidth={stroke} />
        {categories.map((item, index) => {
          const dash = (item.amount / total) * circumference;
          const segment = (
            <circle
              key={item.category}
              cx="110"
              cy="110"
              r={radius}
              fill="none"
              stroke={chartColors[index % chartColors.length]}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeWidth={stroke}
              transform="rotate(-90 110 110)"
            />
          );
          offset += dash;
          return segment;
        })}
        <circle cx="110" cy="110" r="48" fill="#343746" />
        <text x="110" y="105" textAnchor="middle" className="donut-label">Expenses</text>
        <text x="110" y="128" textAnchor="middle" className="donut-total">{formatMoney(total)}</text>
      </svg>
    </div>
  );
}

function CleanWallets({ data }: { data: FinanceData }) {
  const walletOrder = ["KBANK", "CASH", "BBL", "MAKE", "TTB"];
  const roles: Record<string, string> = {
    KBANK: "ใช้จ่ายประจำวัน / จ่ายบิล",
    CASH: "เงินสดในมือ",
    BBL: "บัญชีย่อย ตอนนี้ไม่มีเงิน",
    MAKE: "เงินกันไว้ ตอนนี้ใช้จ่ายไม่ได้",
    TTB: "รับเงินเดือน / เงินเบิก ก่อนย้ายเข้า KBANK",
  };
  const wallets = [...walletBalances(data)].sort((a, b) => walletOrder.indexOf(a.wallet) - walletOrder.indexOf(b.wallet));

  return (
    <section className="stack">
      <div className="wallet-chip-row large">
        {wallets.map((wallet) => (
          <div className={wallet.current <= 0 ? "wallet-chip muted" : "wallet-chip"} key={wallet.wallet}>
            <span>{wallet.wallet}</span>
            <strong>{formatMoney(wallet.current)}</strong>
            <small>{roles[wallet.wallet] ?? "-"}</small>
          </div>
        ))}
      </div>

      <Panel title="👛 สถานะกระเป๋าเงินจริง">
        <Table
          headers={["กระเป๋า", "หน้าที่", "ยอดตั้งต้น", "วันที่ตั้งต้น", "ยอดตอนนี้"]}
          rows={wallets.map((wallet) => [wallet.wallet, roles[wallet.wallet] ?? "-", formatMoney(wallet.balance), wallet.snapshot_date, formatMoney(wallet.current)])}
        />
        <p className="hint">Snapshot วันนี้หลังจ่าย KKP แล้ว: KBANK 19,020.47, CASH 60, BBL/MAKE/TTB เป็น 0. จากนี้ Daily ที่จ่ายด้วย KBANK/CASH จะลดเงินจริงทันที ส่วนรูดบัตรเครดิตจะไปเพิ่มหนี้บัตรแทน.</p>
      </Panel>

      <Panel title="✅ กฎจำง่าย">
        <ul className="plain-list compact-list">
          <li>จ่ายด้วย KBANK หรือ CASH = เงินในกระเป๋าลดทันที</li>
          <li>รูด KTC/บัตรเครดิต = เงิน KBANK ยังไม่ลด แต่หนี้บัตรเพิ่ม</li>
          <li>จ่ายบัตรจาก KBANK = KBANK ลด และหนี้บัตรลด</li>
          <li>เงินเบิก/OT ยังไม่นับเป็นเงินจริง จนกว่าจะรับเงินจริงใน Daily</li>
        </ul>
      </Panel>
    </section>
  );
}

function Wallets({ data }: { data: FinanceData }) {
  const wallets = walletBalances(data);
  const roles: Record<string, string> = {
    KBANK: "ใช้จ่ายประจำวัน / จ่ายบิล",
    BBL: "บัญชีย่อย / เงินค้างเล็กน้อย",
    MAKE: "กันเงินห้ามใช้ เช่น KKP",
    TTB: "รับเงินเดือน / รับเงินเบิก",
    CASH: "เงินสดในมือ",
  };
  return (
    <section className="stack">
    <Panel title="สถานะกระเป๋าเงินจริงตอนนี้">
      <Table
        headers={["Wallet", "Role", "Snapshot", "Snapshot Date", "Current"]}
        rows={wallets.map((wallet) => [wallet.wallet, roles[wallet.wallet] ?? "-", formatMoney(wallet.balance), wallet.snapshot_date, formatMoney(wallet.current)])}
      />
      <p className="hint">Snapshot วันนี้หลังจ่าย KKP แล้ว: KBANK 19,020.47, CASH 60, BBL/MAKE/TTB เป็น 0. รายจ่ายผ่าน KBANK/CASH หลังจากนี้จะลดกระเป๋าทันที; รายจ่ายผ่าน KTC/บัตรเครดิตจะเพิ่ม card liability แทน.</p>
    </Panel>
    <Panel title="กฎสำคัญของ Wallet">
      <ul className="plain-list">
        <li>ใช้ KBANK/CASH จ่ายจริง เงินต้องลดทันที</li>
        <li>ใช้ KTC/บัตรเครดิต เงิน KBANK ไม่ลด แต่ card liability เพิ่ม</li>
        <li>MAKE คือเงินกันไว้ ห้ามนับเป็นเงินกินใช้</li>
        <li>TTB คือทางผ่านเงินเดือน/เงินเบิก ก่อนย้ายไป KBANK</li>
      </ul>
    </Panel>
    </section>
  );
}

function Cards({ data }: { data: FinanceData }) {
  const summaries = cardSummaries(data);
  return (
    <section className="stack">
      <div className="hero-grid">
        {data.cards.map((card) => (
          <Kpi key={card.card_name} title={card.card_name} value={formatMoney(cardOutstanding(card.card_name, data.card_items, data.transactions))} tone="red" />
        ))}
      </div>
      <Panel title="Card Command Summary">
        <Table
          headers={["Card", "Outstanding", "Review", "Unpaid Items", "Cycle", "Due Day"]}
          rows={summaries.map((card) => [card.card, formatMoney(card.outstanding), formatMoney(card.reviewAmount), card.unpaidCount, card.statementCycle, card.dueDay])}
        />
      </Panel>
      <Panel title="Card Items / Statement Reconcile">
        <Table
          headers={["Date", "Card", "Amount", "Category", "Claim", "Paid", "Note"]}
          rows={data.card_items.map((item) => [item.date, item.card, formatMoney(item.amount), labelCategory(item.category), labelStatus(item.claim_status), labelStatus(item.paid_status), item.merchant_note])}
        />
      </Panel>
    </section>
  );
}

function Claims({ data }: { data: FinanceData }) {
  const review = data.claim_items.filter((item) => item.status === "review" || item.status === "claimable");
  const command = claimCommandCenter(data);
  const reconciliation = reconciliationItems(data).slice(0, 12);
  return (
    <section className="stack">
      <div className="hero-grid">
        <Kpi title="Waiting Claim/OT" value={formatMoney(command.reviewTotal)} tone="amber" />
        <Kpi title="Review Items" value={String(command.reviewItems.length)} tone="blue" />
        <Kpi title="Submit In" value={`${command.dueSoon} days`} tone={command.dueSoon <= 7 ? "amber" : "green"} />
        <Kpi title="Expected Paid" value={command.draftClaim?.expected_paid_date ?? "-"} tone="green" />
      </div>

      <div className="hero-grid">
        <Kpi title="Company Expense" value={formatMoney(command.companyExpense.draftTotal + command.companyExpense.submittedTotal)} tone="blue" />
        <Kpi title="OT Forecast" value={formatMoney(command.ot.expectedTotal)} tone="blue" />
        <Kpi title="OT Hours 1/1.5/3" value={`${command.ot.ot1xHours}/${command.ot.ot15xHours}/${command.ot.ot3xHours}`} tone="green" />
        <Kpi title="Matched/Paid" value={formatMoney(command.companyExpense.paidTotal + command.ot.actualPaidTotal)} tone="green" />
      </div>

      <div className="two-col">
      <Panel title="Claim Cycles">
        <Table headers={["Month", "Submit By", "Expected Paid", "Status", "Paid"]} rows={data.claims.map((claim) => [claim.claim_month, claim.submit_by, claim.expected_paid_date, labelStatus(claim.status), formatMoney(claim.paid_amount)])} />
      </Panel>
      <Panel title="Review Before Day 5">
        <Table headers={["Source", "Amount", "Split", "Status", "Note"]} rows={review.map((item) => [item.source_id, formatMoney(item.amount), labelStatus(item.work_personal_mixed), labelStatus(item.status), item.note ?? ""])} />
      </Panel>
      </div>

      <Panel title="Claim Center: waiting for Daily match">
        <Table headers={["Source", "Title", "Amount", "Status"]} rows={reconciliation.map((item) => [item.source, item.title, formatMoney(item.amount), item.status])} />
      </Panel>

      <div className="two-col">
        <Panel title="Checklist ก่อนส่งบัญชี">
          <ul className="check-list">
            {command.checklist.map((item) => (
              <li key={item.item} className={item.done ? "done" : "todo"}>{item.done ? "Done" : "Todo"} - {item.item}</li>
            ))}
          </ul>
        </Panel>
        <Panel title="วิธีใช้หน้านี้">
          <ul className="plain-list">
            <li>รายการ KTC fuel/toll ยังเป็น review จนกว่าจะแยก onsite/personal</li>
            <li>ยอดเบิกไม่ใช่เงินสด จนกว่าเงินเข้าจริงวันที่ 10</li>
            <li>ถ้าเป็น personal ให้ excluded ไม่ควรเอาไปส่งบัญชี</li>
            <li>ก่อนวันที่ 5 ให้หน้า Claims เหลือ Todo น้อยที่สุด</li>
          </ul>
        </Panel>
      </div>
    </section>
  );
}

function OtClaim({ data, onChange }: { data: FinanceData; onChange: (data: FinanceData) => void }) {
  const summary = otClaimSummary(data.ot_claim_items, data.transactions);

  function addOt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const baseRate = Number(form.get("base_rate") || 189.5);
    const item: OtClaimItem = {
      id: `ot-${Date.now()}`,
      claim_month: String(form.get("claim_month") || "June Budget"),
      pay_month: String(form.get("pay_month") || "June Budget"),
      date: String(form.get("date") || "2026-06-13"),
      start_time: String(form.get("start_time") || ""),
      end_time: String(form.get("end_time") || ""),
      ot_1x_hours: Number(form.get("ot_1x_hours") || 0),
      ot_1_5x_hours: Number(form.get("ot_1_5x_hours") || 0),
      ot_3x_hours: Number(form.get("ot_3x_hours") || 0),
      site: String(form.get("site") || ""),
      project: String(form.get("project") || ""),
      detail: String(form.get("detail") || ""),
      sale_name: String(form.get("sale_name") || ""),
      billable: String(form.get("billable") || ""),
      so: String(form.get("so") || ""),
      status: String(form.get("status") || "draft") as OtClaimItem["status"],
      base_rate: baseRate,
      expected_amount: Number(form.get("expected_amount") || 0),
      actual_paid_amount: Number(form.get("actual_paid_amount") || 0),
      note: String(form.get("note") || ""),
    };
    const expected = item.expected_amount || otExpectedAmount(item);
    onChange({ ...data, ot_claim_items: [...data.ot_claim_items, { ...item, expected_amount: expected }] });
    event.currentTarget.reset();
  }

  function duplicateOt(id: string) {
    const source = data.ot_claim_items.find((item) => item.id === id);
    if (!source) return;
    onChange({ ...data, ot_claim_items: [...data.ot_claim_items, { ...source, id: `ot-${Date.now()}`, status: "draft", note: source.note ? `${source.note} duplicated` : "duplicated" }] });
  }

  function deleteOt(id: string) {
    onChange({ ...data, ot_claim_items: data.ot_claim_items.filter((item) => item.id !== id) });
  }

  return (
    <section className="stack">
      <div className="hero-grid">
        <Kpi title="OT Forecast" value={formatMoney(summary.expectedTotal)} tone="blue" />
        <Kpi title="OT Paid" value={formatMoney(summary.actualPaidTotal)} tone="green" />
        <Kpi title="Hours 1x" value={String(summary.ot1xHours)} tone="green" />
        <Kpi title="Hours 3x" value={String(summary.ot3xHours)} tone="amber" />
      </div>

      <div className="two-col">
        <Panel title="Add OT Claim Row">
          <form className="form" onSubmit={addOt}>
            <label>Claim Month<select name="claim_month" defaultValue="June Budget"><option>May Budget</option><option>June Budget</option><option>July Budget</option></select></label>
            <label>Pay Month<select name="pay_month" defaultValue="June Budget"><option>June Budget</option><option>July Budget</option><option>August Budget</option></select></label>
            <label>Date<input name="date" type="date" defaultValue="2026-06-13" required /></label>
            <label>Start<input name="start_time" type="time" /></label>
            <label>End<input name="end_time" type="time" /></label>
            <label>1x Hours<input name="ot_1x_hours" type="number" min="0" step="0.5" defaultValue="0" /></label>
            <label>1.5x Hours<input name="ot_1_5x_hours" type="number" min="0" step="0.5" defaultValue="0" /></label>
            <label>3x Hours<input name="ot_3x_hours" type="number" min="0" step="0.5" defaultValue="0" /></label>
            <label>Base Rate<input name="base_rate" type="number" min="0" step="0.01" defaultValue="189.5" /></label>
            <label>Expected Amount<input name="expected_amount" type="number" min="0" step="0.01" placeholder="auto if blank" /></label>
            <label>Status<select name="status" defaultValue="draft"><option value="draft">draft</option><option value="review">review</option><option value="submitted">submitted</option><option value="paid">paid</option><option value="matched">matched</option><option value="excluded">excluded</option></select></label>
            <label>Site<input name="site" /></label>
            <label>Project<input name="project" /></label>
            <label>Sale Name<input name="sale_name" /></label>
            <label>Billable<input name="billable" /></label>
            <label>SO<input name="so" /></label>
            <label className="wide">Detail<input name="detail" /></label>
            <label className="wide">Note<input name="note" /></label>
            <button type="submit">Add OT Row</button>
          </form>
        </Panel>

        <Panel title="OT Rules">
          <ul className="plain-list">
            <li>Mon-Fri after 18:00 = 1.5x</li>
            <li>Sat-Sun before 18:00 = 1x</li>
            <li>Sat-Sun after 18:00 = 3x</li>
            <li>Default base rate = 189.50 baht/hour from prior payroll evidence.</li>
            <li>OT forecast is not wallet cash until Daily is matched as OT income.</li>
          </ul>
        </Panel>
      </div>

      <Panel title="OT Claim Rows">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Start</th><th>End</th><th>1x</th><th>1.5x</th><th>3x</th><th>Site</th><th>Project</th><th>Detail</th><th>Status</th><th>Forecast</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {data.ot_claim_items.map((item) => (
                <tr key={item.id}>
                  <td>{item.date}</td><td>{item.start_time}</td><td>{item.end_time}</td><td>{item.ot_1x_hours}</td><td>{item.ot_1_5x_hours}</td><td>{item.ot_3x_hours}</td><td>{item.site}</td><td>{item.project}</td><td>{item.detail}</td><td>{item.status}</td><td>{formatMoney(otExpectedAmount(item))}</td>
                  <td className="action-cell"><button type="button" onClick={() => duplicateOt(item.id)}>Duplicate</button><button className="ghost danger" type="button" onClick={() => deleteOt(item.id)}>Delete</button></td>
                </tr>
              ))}
              {!data.ot_claim_items.length && <tr><td colSpan={12}>No OT rows yet</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </section>
  );
}

function CleanCompanyExpense({ data, onChange }: { data: FinanceData; onChange: (data: FinanceData) => void }) {
  const [editingId, setEditingId] = useState("");
  const summary = companyExpenseSummary(data.company_expense_items, data.transactions);
  const editingItem = data.company_expense_items.find((item) => item.id === editingId);

  function options(kind: CompanyOption["kind"]): CompanyOption[] {
    return data.company_options.filter((item) => item.kind === kind && item.active);
  }

  function itemFromForm(form: FormData, fallbackId?: string): CompanyExpenseItem {
    return {
      id: fallbackId ?? `ce-${Date.now()}`,
      claim_month: String(form.get("claim_month") || "June Budget"),
      date: String(form.get("date") || "2026-06-13"),
      site: String(form.get("site") || ""),
      project: String(form.get("project") || ""),
      place: String(form.get("place") || ""),
      sale_name: String(form.get("sale_name") || ""),
      sr: String(form.get("sr") || ""),
      detail: String(form.get("detail") || ""),
      expense_type: String(form.get("expense_type") || "Travel") as CompanyExpenseItem["expense_type"],
      amount: Number(form.get("amount") || 0),
      status: String(form.get("status") || "draft") as CompanyExpenseItem["status"],
      note: String(form.get("note") || ""),
    };
  }

  function addCompanyExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const item = itemFromForm(new FormData(event.currentTarget));
    onChange({ ...data, company_expense_items: [...data.company_expense_items, item] });
    event.currentTarget.reset();
  }

  function updateCompanyExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingItem) return;
    const nextItem = itemFromForm(new FormData(event.currentTarget), editingItem.id);
    onChange({
      ...data,
      company_expense_items: data.company_expense_items.map((item) => (item.id === nextItem.id ? nextItem : item)),
    });
    setEditingId("");
  }

  function duplicateCompanyExpense(id: string) {
    const source = data.company_expense_items.find((item) => item.id === id);
    if (!source) return;
    const copy = { ...source, id: `ce-${Date.now()}`, status: "draft" as const, note: source.note ? `${source.note} (copy)` : "copy" };
    const index = data.company_expense_items.findIndex((item) => item.id === id);
    const next = [...data.company_expense_items];
    next.splice(index + 1, 0, copy);
    onChange({ ...data, company_expense_items: next });
  }

  function deleteCompanyExpense(id: string) {
    const ok = window.confirm("ลบรายการเคลมงานนี้ใช่ไหม?");
    if (!ok) return;
    onChange({ ...data, company_expense_items: data.company_expense_items.filter((item) => item.id !== id) });
  }

  function addOption(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const option: CompanyOption = {
      kind: String(form.get("kind") || "site") as CompanyOption["kind"],
      name: String(form.get("name") || "").trim(),
      active: true,
    };
    if (!option.name) return;
    onChange({ ...data, company_options: [...data.company_options, option] });
    event.currentTarget.reset();
  }

  function exportCompanyExpenseCsv() {
    const headers = ["Date", "Site", "Project", "Place", "Sale Name", "SR", "Detail", "Type", "Amount", "Status", "Note"];
    const rows = summary.activeItems.map((item) => [
      item.date,
      item.site,
      item.project,
      item.place,
      item.sale_name,
      item.sr,
      item.detail,
      item.expense_type,
      String(item.amount),
      item.status,
      item.note ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "company-expense-june-2026.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function markCompanyExpenseSubmitted() {
    const ok = window.confirm("ยืนยันว่าเดือนนี้ส่งเอกสารให้บัญชีแล้วจริงใช่ไหม? ถ้ายังไม่ได้ส่งให้กด Cancel");
    if (!ok) return;
    onChange({
      ...data,
      company_expense_items: data.company_expense_items.map((item) =>
        item.claim_month === "June Budget" && (item.status === "draft" || item.status === "review")
          ? { ...item, status: "submitted" }
          : item,
      ),
    });
    setEditingId("");
  }

  return (
    <section className="stack clean-company-expense">
      <CompanyExpenseClaimSheet items={summary.activeItems} total={summary.claimableTotal} />

      <div className="sheet-actions primary-actions">
        <a href="#company-expense-form">➕ เพิ่มรายการ</a>
        <button type="button" onClick={exportCompanyExpenseCsv}>📄 Export CSV</button>
        <button type="button" onClick={markCompanyExpenseSubmitted}>✅ ส่งบัญชีแล้ว</button>
      </div>

      <div className="clean-kpi-grid">
        <Kpi title="ร่าง/รอตรวจ" value={formatMoney(summary.draftTotal)} tone="amber" />
        <Kpi title="ยอดเคลมรวม" value={formatMoney(summary.claimableTotal)} tone="green" />
        <Kpi title="วันวิ่งงาน" value={`${summary.workDays}`} tone="blue" />
        <Kpi title="ส่งแล้ว" value={formatMoney(summary.submittedTotal)} tone="blue" />
      </div>

      <Panel title="🚗 กรอกเคลมงาน">
        <div id="company-expense-form" />
        <form className="form" onSubmit={editingItem ? updateCompanyExpense : addCompanyExpense} key={editingItem?.id ?? "new-company-expense"}>
          <label>Claim Month<select name="claim_month" defaultValue={editingItem?.claim_month ?? "June Budget"}><option>June Budget</option><option>July Budget</option><option>May Budget</option></select></label>
          <label>Date<input name="date" type="date" defaultValue={editingItem?.date ?? "2026-06-13"} required /></label>
          <label>Company / Site<input name="site" list="clean-site-options" defaultValue={editingItem?.site ?? ""} placeholder="เลือกจาก dropdown หรือพิมพ์ใหม่" required /></label>
          <label>Project<input name="project" list="clean-project-options" defaultValue={editingItem?.project ?? ""} placeholder="Project / Main project" /></label>
          <label>Place<input name="place" list="clean-place-options" defaultValue={editingItem?.place ?? ""} placeholder="สถานที่" /></label>
          <label>Sale Name<input name="sale_name" list="clean-sale-options" defaultValue={editingItem?.sale_name ?? ""} placeholder="Sale owner" /></label>
          <label>SR<input name="sr" defaultValue={editingItem?.sr ?? ""} placeholder="เช่น 26-0101" /></label>
          <label>Type<select name="expense_type" defaultValue={editingItem?.expense_type ?? "Travel"}><option value="Perdiem">Perdiem</option><option value="Entertain">Entertain</option><option value="Training">Training</option><option value="Travel">Travel</option><option value="Toll">Toll</option><option value="Parking">Parking</option></select></label>
          <label>Amount<input name="amount" type="number" min="0" step="0.01" defaultValue={editingItem?.amount ?? ""} required /></label>
          <label>Status<select name="status" defaultValue={editingItem?.status ?? "draft"}><option value="draft">ร่าง</option><option value="review">รอตรวจ</option><option value="submitted">ส่งแล้ว</option><option value="paid">ได้เงินแล้ว</option><option value="excluded">ไม่นับ</option></select></label>
          <label className="wide">Detail<input name="detail" defaultValue={editingItem?.detail ?? ""} placeholder="เช่น Onsite: Install Switch (75*10)" /></label>
          <label className="wide">Note<input name="note" defaultValue={editingItem?.note ?? ""} placeholder="หมายเหตุ / หลักฐาน / เลข Easy Pass" /></label>
          <button type="submit">{editingItem ? "บันทึกการแก้ไข" : "เพิ่มรายการเคลม"}</button>
          {editingItem && <button className="ghost" type="button" onClick={() => setEditingId("")}>ยกเลิกแก้ไข</button>}
        </form>
        <datalist id="clean-site-options">{options("site").map((item) => <option key={item.name} value={item.name} />)}</datalist>
        <datalist id="clean-project-options">{options("project").map((item) => <option key={item.name} value={item.name} />)}</datalist>
        <datalist id="clean-place-options">{options("place").map((item) => <option key={item.name} value={item.name} />)}</datalist>
        <datalist id="clean-sale-options">{options("sale").map((item) => <option key={item.name} value={item.name} />)}</datalist>
      </Panel>

      <details className="detail-panel">
        <summary>🔍 รายละเอียดเคลม / Dropdown DB</summary>
        <div className="detail-grid">
          <Panel title="แยกตามประเภทเบิก">
            <Table headers={["ประเภท", "ยอด"]} rows={summary.byType.map((item) => [labelCompanyExpenseType(item.type), formatMoney(item.amount)])} />
          </Panel>
          <Panel title="Dropdown DB">
            <form className="form compact-form" onSubmit={addOption}>
              <label>Kind<select name="kind" defaultValue="site"><option value="site">Company / Site</option><option value="project">Project</option><option value="place">Place</option><option value="sale">Sale Name</option></select></label>
              <label>Name<input name="name" placeholder="เพิ่มชื่อสำหรับ dropdown" required /></label>
              <button type="submit">Add Dropdown Option</button>
            </form>
            <Table headers={["Kind", "Name"]} rows={data.company_options.slice(0, 12).map((item) => [item.kind, item.name])} />
          </Panel>
          <Panel title="Company Expense Items">
            <CompanyExpenseEditableTable items={data.company_expense_items} editingId={editingId} onEdit={setEditingId} onDuplicate={duplicateCompanyExpense} onDelete={deleteCompanyExpense} />
          </Panel>
        </div>
      </details>
    </section>
  );
}

function CompanyExpense({ data, onChange }: { data: FinanceData; onChange: (data: FinanceData) => void }) {
  const summary = companyExpenseSummary(data.company_expense_items, data.transactions);
  const [editingId, setEditingId] = useState("");
  const editingItem = data.company_expense_items.find((item) => item.id === editingId);

  function options(kind: CompanyOption["kind"]): CompanyOption[] {
    return data.company_options.filter((item) => item.kind === kind && item.active);
  }

  function addOption(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const kind = String(form.get("kind") || "site") as CompanyOption["kind"];
    if (!name) return;
    const exists = data.company_options.some((item) => item.kind === kind && item.name.toLowerCase() === name.toLowerCase());
    if (!exists) {
      onChange({ ...data, company_options: [...data.company_options, { name, kind, active: true }] });
    }
    event.currentTarget.reset();
  }

  function addCompanyExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const item: CompanyExpenseItem = {
      id: `ce-${Date.now()}`,
      claim_month: String(form.get("claim_month") || "June Budget"),
      date: String(form.get("date")),
      site: String(form.get("site") || ""),
      project: String(form.get("project") || ""),
      place: String(form.get("place") || ""),
      sale_name: String(form.get("sale_name") || ""),
      sr: String(form.get("sr") || ""),
      detail: String(form.get("detail") || ""),
      expense_type: String(form.get("expense_type") || "Travel") as CompanyExpenseItem["expense_type"],
      amount: Number(form.get("amount")),
      status: String(form.get("status") || "draft") as CompanyExpenseItem["status"],
      note: String(form.get("note") || ""),
    };

    onChange({ ...data, company_expense_items: [...data.company_expense_items, item] });
    event.currentTarget.reset();
  }

  function updateCompanyExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingItem) return;
    const form = new FormData(event.currentTarget);
    const nextItem: CompanyExpenseItem = {
      ...editingItem,
      claim_month: String(form.get("claim_month") || editingItem.claim_month),
      date: String(form.get("date") || editingItem.date),
      site: String(form.get("site") || ""),
      project: String(form.get("project") || ""),
      place: String(form.get("place") || ""),
      sale_name: String(form.get("sale_name") || ""),
      sr: String(form.get("sr") || ""),
      detail: String(form.get("detail") || ""),
      expense_type: String(form.get("expense_type") || "Travel") as CompanyExpenseItem["expense_type"],
      amount: Number(form.get("amount")),
      status: String(form.get("status") || "draft") as CompanyExpenseItem["status"],
      note: String(form.get("note") || ""),
    };

    onChange({
      ...data,
      company_expense_items: data.company_expense_items.map((item) => (item.id === nextItem.id ? nextItem : item)),
    });
    setEditingId("");
  }

  function deleteCompanyExpense(id: string) {
    onChange({ ...data, company_expense_items: data.company_expense_items.filter((item) => item.id !== id) });
    if (editingId === id) setEditingId("");
  }

  function duplicateCompanyExpense(id: string) {
    const source = data.company_expense_items.find((item) => item.id === id);
    if (!source) return;
    const copy: CompanyExpenseItem = {
      ...source,
      id: `ce-${Date.now()}`,
      status: "draft",
      note: source.note ? `${source.note} (duplicated)` : "duplicated",
    };
    onChange({ ...data, company_expense_items: [...data.company_expense_items, copy] });
    setEditingId(copy.id);
  }

  function exportCompanyExpenseCsv() {
    const columns = ["Date", "Site", "Project", "Place", "Sale Name", "SR", "Detail", "Type", "Amount"];
    const escapeCsv = (value: string | number) => {
      const text = String(value);
      return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    };
    const rows = summary.activeItems.map((item) => [
      item.date,
      item.site,
      item.project,
      item.place,
      item.sale_name,
      item.sr,
      item.detail,
      item.expense_type,
      item.amount,
    ]);
    const csv = [columns, ...rows, ["", "", "", "", "", "", "", "Total", summary.claimableTotal]]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "company-expense-june-2026.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function markCompanyExpenseSubmitted() {
    onChange({
      ...data,
      company_expense_items: data.company_expense_items.map((item) =>
        item.claim_month === "June Budget" && (item.status === "draft" || item.status === "review")
          ? { ...item, status: "submitted" }
          : item,
      ),
    });
    setEditingId("");
  }

  function clearCompanyExpenseItems() {
    const ok = window.confirm("Clear all Company Expense items? Dropdown DB will be kept.");
    if (!ok) return;
    onChange({ ...data, company_expense_items: [] });
    setEditingId("");
  }

  return (
    <section className="stack">
      <CompanyExpenseClaimSheet items={summary.activeItems} total={summary.claimableTotal} />

      <div className="sheet-actions">
        <a href="#company-expense-form">Add line item</a>
        <a href="#company-dropdown-db">Manage dropdown DB</a>
        <button type="button" onClick={exportCompanyExpenseCsv}>Export CSV</button>
        <button type="button" onClick={markCompanyExpenseSubmitted}>Mark draft/review submitted</button>
        <button className="danger" type="button" onClick={clearCompanyExpenseItems}>Clear Company Expense</button>
      </div>

      <div className="hero-grid">
        <Kpi title="Draft / Review" value={formatMoney(summary.draftTotal)} tone="amber" />
        <Kpi title="Submitted" value={formatMoney(summary.submittedTotal)} tone="blue" />
        <Kpi title="Paid" value={formatMoney(summary.paidTotal)} tone="green" />
        <Kpi title="Claimable Total" value={formatMoney(summary.claimableTotal)} tone="green" />
      </div>

      <Panel title="Company Expense Mapping">
        <div className="answer-grid compact">
          <MiniAnswer title="จำนวนรายการ" value={String(summary.itemCount)} detail="แถวที่กรอกในฟอร์ม Expense Claim เดือนนี้" />
          <MiniAnswer title="วันวิ่งงาน" value={`${summary.workDays} วัน`} detail="นับจากวันที่ไม่ซ้ำ ใช้ประเมินภาระน้ำมัน/ทางด่วน" />
          <MiniAnswer title="Travel" value={formatMoney(summary.travelTotal)} detail="เงินค่ารถ/ระยะทางที่คาดเบิกได้" />
          <MiniAnswer title="Toll / Parking" value={formatMoney(summary.tollParkingTotal)} detail="เอาไว้เทียบกับยอดตัด KTC/Easy Pass" />
          <MiniAnswer title="คาดรับคืน" value={formatMoney(summary.claimableTotal)} detail="ยังไม่ใช่เงินสด จนกว่าจะ paid/reimbursement จริง" />
        </div>
      </Panel>

      <div className="two-col">
        <Panel title="Add Company Expense">
          <div id="company-expense-form" />
          <form className="form" onSubmit={editingItem ? updateCompanyExpense : addCompanyExpense} key={editingItem?.id ?? "new-company-expense"}>
            <label>Claim Month<select name="claim_month" defaultValue={editingItem?.claim_month ?? "June Budget"}><option>June Budget</option><option>July Budget</option><option>May Budget</option></select></label>
            <label>Date<input name="date" type="date" defaultValue={editingItem?.date ?? "2026-06-13"} required /></label>
            <label>Company / Site<input name="site" list="site-options" defaultValue={editingItem?.site ?? ""} placeholder="เลือกจาก dropdown หรือพิมพ์ใหม่" required /></label>
            <label>Project<input name="project" list="project-options" defaultValue={editingItem?.project ?? ""} placeholder="Project / Main project" /></label>
            <label>Place<input name="place" list="place-options" defaultValue={editingItem?.place ?? ""} placeholder="สถานที่" /></label>
            <label>Sale Name<input name="sale_name" list="sale-options" defaultValue={editingItem?.sale_name ?? ""} placeholder="Sale owner" /></label>
            <label>SR<input name="sr" defaultValue={editingItem?.sr ?? ""} placeholder="เช่น 26-0101" /></label>
            <label>Type<select name="expense_type" defaultValue={editingItem?.expense_type ?? "Travel"}><option value="Perdiem">Perdiem</option><option value="Entertain">Entertain</option><option value="Training">Training</option><option value="Travel">Travel</option><option value="Toll">Toll</option><option value="Parking">Parking</option></select></label>
            <label>Amount<input name="amount" type="number" min="0" step="0.01" defaultValue={editingItem?.amount ?? ""} required /></label>
            <label>Status<select name="status" defaultValue={editingItem?.status ?? "draft"}><option value="draft">ร่าง</option><option value="review">รอตรวจ</option><option value="submitted">ส่งแล้ว</option><option value="paid">จ่ายแล้ว</option><option value="excluded">ไม่นับ</option></select></label>
            <label className="wide">Detail<input name="detail" defaultValue={editingItem?.detail ?? ""} placeholder="เช่น Onsite: Install Switch (75*10)" /></label>
            <label className="wide">Note<input name="note" defaultValue={editingItem?.note ?? ""} placeholder="หมายเหตุ / หลักฐาน / เลข Easy Pass" /></label>
            <button type="submit">{editingItem ? "Save Company Expense" : "Add Company Expense"}</button>
            {editingItem && <button className="ghost" type="button" onClick={() => setEditingId("")}>Cancel Edit</button>}
          </form>
          <datalist id="site-options">{options("site").map((item) => <option key={item.name} value={item.name} />)}</datalist>
          <datalist id="project-options">{options("project").map((item) => <option key={item.name} value={item.name} />)}</datalist>
          <datalist id="place-options">{options("place").map((item) => <option key={item.name} value={item.name} />)}</datalist>
          <datalist id="sale-options">{options("sale").map((item) => <option key={item.name} value={item.name} />)}</datalist>
        </Panel>

        <Panel title="Dropdown DB">
          <div id="company-dropdown-db" />
          <form className="form compact-form" onSubmit={addOption}>
            <label>Kind<select name="kind" defaultValue="site"><option value="site">Company / Site</option><option value="project">Project</option><option value="place">Place</option><option value="sale">Sale Name</option></select></label>
            <label>Name<input name="name" placeholder="เพิ่มชื่อสำหรับ dropdown" required /></label>
            <button type="submit">Add Dropdown Option</button>
          </form>
          <Table
            headers={["Kind", "Name"]}
            rows={data.company_options.slice(0, 12).map((item) => [item.kind, item.name])}
          />
        </Panel>
      </div>

      <div className="two-col">
        <Panel title="แยกตามประเภทเบิก">
          <Table headers={["ประเภท", "ยอด"]} rows={summary.byType.map((item) => [labelCompanyExpenseType(item.type), formatMoney(item.amount)])} />
        </Panel>
        <Panel title="วิธีต่อยอดเข้าระบบเรา">
          <ul className="plain-list">
            <li>Travel/Toll/Parking รวมเป็นยอดคาดการณ์เงินเบิกบริษัทที่จะเข้าประมาณวันที่ 10 ของเดือนถัดไป</li>
            <li>Toll/Parking ใช้เทียบกับรายการบัตร KTC/Easy Pass เพื่อดูว่าส่วนไหนเบิกได้ ส่วนไหนเป็นส่วนตัว</li>
            <li>จำนวนวันวิ่งงานช่วยประเมินแรงกดดันน้ำมัน/ทางด่วนก่อนเงินเดือนออก</li>
            <li>draft/review/submitted เป็นเงินคาดการณ์ ยังไม่ใช่เงินสดในกระเป๋า</li>
            <li>เมื่อบริษัทจ่ายจริง ให้บันทึก Daily เป็น type เงินเบิกคืน แล้วค่อยนับเป็นเงินสด</li>
          </ul>
        </Panel>
      </div>

      <Panel title="Company Expense Items">
        <CompanyExpenseEditableTable items={data.company_expense_items} editingId={editingId} onEdit={setEditingId} onDuplicate={duplicateCompanyExpense} onDelete={deleteCompanyExpense} />
      </Panel>
    </section>
  );
}

function CompanyExpenseClaimSheet({ items, total }: { items: CompanyExpenseItem[]; total: number }) {
  const rows = items;
  const blankRows = Array.from({ length: Math.max(4, 18 - rows.length) });

  return (
    <section className="claim-sheet">
      <div className="claim-title">Expense Claim</div>

      <div className="claim-meta">
        <div className="claim-meta-left">
          <div><strong>Company:</strong><span>Company Name</span></div>
          <div><strong>Name:</strong><span>Employee Name</span></div>
        </div>
        <div className="claim-month">June-26</div>
      </div>

      <div className="claim-table-wrap">
        <table className="claim-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Site</th>
              <th>Project</th>
              <th>Place</th>
              <th>Sale Name</th>
              <th>SR</th>
              <th>Detail</th>
              <th>Type</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id}>
                <td>{item.date}</td>
                <td>{item.site}</td>
                <td>{item.project}</td>
                <td>{item.place}</td>
                <td>{item.sale_name}</td>
                <td>{item.sr}</td>
                <td>{item.detail}</td>
                <td>{item.expense_type}</td>
                <td className="amount-cell">{formatMoney(item.amount)}</td>
              </tr>
            ))}
            {blankRows.map((_, index) => (
              <tr className="blank-row" key={`blank-${index}`}>
                <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
              </tr>
            ))}
            <tr className="total-row">
              <td colSpan={7}></td>
              <td>Total</td>
              <td className="amount-cell">{formatMoney(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="claim-signatures">
        <div></div>
        <div className="signature-row"><span>Requestor :</span><strong>Employee Name</strong><span>Date :</span><strong>yyyy-mm-dd</strong></div>
        <div></div>
        <div className="signature-row"><span>Verifier :</span><strong></strong><span>Date :</span><strong></strong></div>
        <div></div>
        <div className="signature-row"><span>Approver :</span><strong></strong><span>Date :</span><strong></strong></div>
      </div>
    </section>
  );
}

function CompanyExpenseEditableTable({
  items,
  editingId,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  items: CompanyExpenseItem[];
  editingId: string;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Company/Site</th>
            <th>Project</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Detail</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={editingId === item.id ? "editing-row" : ""}>
              <td>{item.date}</td>
              <td>{item.site}</td>
              <td>{item.project}</td>
              <td>{labelCompanyExpenseType(item.expense_type)}</td>
              <td>{formatMoney(item.amount)}</td>
              <td>{labelStatus(item.status)}</td>
              <td>{item.detail}</td>
              <td className="action-cell">
                <button type="button" onClick={() => onEdit(item.id)}>{editingId === item.id ? "Editing" : "Edit"}</button>
                <button className="ghost" type="button" onClick={() => onDuplicate(item.id)}>Duplicate</button>
                <button className="ghost danger" type="button" onClick={() => onDelete(item.id)}>Delete</button>
              </td>
            </tr>
          ))}
          {!items.length && (
            <tr>
              <td colSpan={8}>ยังไม่มีรายการ Company Expense</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function MiniAnswer({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="mini-answer">
      <p>{title}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </div>
  );
}

function SignalList({ signals }: { signals: Array<{ level: "ok" | "warn" | "danger"; title: string; detail: string }> }) {
  return (
    <ul className="signal-list">
      {signals.map((signal) => (
        <li key={signal.title} className={signal.level}>
          <strong>{signal.title}</strong>
          <span>{signal.detail}</span>
        </li>
      ))}
    </ul>
  );
}

function Kpi({ title, value, tone }: { title: string; value: string; tone: "green" | "amber" | "red" | "blue" }) {
  return (
    <div className={`kpi ${tone}`}>
      <p>{title}</p>
      <strong>{value}</strong>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
