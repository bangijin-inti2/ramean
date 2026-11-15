import type { Metadata } from "next";
import { FinanceWorkspace } from "@/components/finance-workspace";

export const metadata: Metadata = { title: "Transaksi" };

export default function TransactionsPage() {
  return <FinanceWorkspace section="transactions" />;
}
