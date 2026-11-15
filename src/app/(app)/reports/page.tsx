import type { Metadata } from "next";
import { FinanceWorkspace } from "@/components/finance-workspace";

export const metadata: Metadata = { title: "Laporan" };

export default function ReportsPage() {
  return <FinanceWorkspace section="reports" />;
}
