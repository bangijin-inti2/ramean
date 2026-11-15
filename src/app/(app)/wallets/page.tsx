import type { Metadata } from "next";
import { FinanceWorkspace } from "@/components/finance-workspace";

export const metadata: Metadata = { title: "Dompet" };

export default function WalletsPage() {
  return <FinanceWorkspace section="wallets" />;
}
