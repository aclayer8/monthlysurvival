import { AuthGate } from "../../components/AuthGate";
import { FinanceApp } from "../../components/FinanceApp";

export default function OtPage() {
  return (
    <AuthGate>
      <FinanceApp initialView="ot" />
    </AuthGate>
  );
}
