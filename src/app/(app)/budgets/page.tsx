import type { Metadata } from "next";
import { FinanceWorkspace } from "@/components/finance-workspace";

export const metadata: Metadata = { title: "Anggaran" };

export default function BudgetsPage() {
  return <FinanceWorkspace section="budgets" />;
}
