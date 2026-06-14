import { AuthGate } from "../../components/AuthGate";
import { FinanceApp } from "../../components/FinanceApp";

export default function AddPage() {
  return (
    <AuthGate>
      <FinanceApp initialView="add" />
    </AuthGate>
  );
}
