import type { Metadata } from "next";
import { FinanceWorkspace } from "@/components/finance-workspace";

export const metadata: Metadata = { title: "Ruang bersama" };

export default function SpacePage() {
  return <FinanceWorkspace section="space" />;
}
