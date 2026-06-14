import { AuthGate } from "../../components/AuthGate";
import { FinanceApp } from "../../components/FinanceApp";

export default function ClaimsPage() {
  return (
    <AuthGate>
      <FinanceApp initialView="claims" />
    </AuthGate>
  );
}
