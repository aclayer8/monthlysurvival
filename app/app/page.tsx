import { AuthGate } from "../../components/AuthGate";
import { FinanceApp } from "../../components/FinanceApp";

export default function AppDashboardPage() {
  return (
    <AuthGate>
      <FinanceApp initialView="dashboard" />
    </AuthGate>
  );
}
