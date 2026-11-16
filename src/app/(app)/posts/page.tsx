import type { Metadata } from "next";
import { FinanceWorkspace } from "@/components/finance-workspace";

export const metadata: Metadata = { title: "Pos dana" };

export default function PostsPage() {
  return <FinanceWorkspace section="posts" />;
}
