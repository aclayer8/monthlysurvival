import { AuthGate } from "../../components/AuthGate";
import { FinanceApp } from "../../components/FinanceApp";

export default function WalletsPage() {
  return (
    <AuthGate>
      <FinanceApp initialView="wallets" />
    </AuthGate>
  );
}
