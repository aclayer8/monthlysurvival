import { AuthGate } from "../../components/AuthGate";
import { FinanceApp } from "../../components/FinanceApp";

export default function CardsPage() {
  return (
    <AuthGate>
      <FinanceApp initialView="cards" />
    </AuthGate>
  );
}
