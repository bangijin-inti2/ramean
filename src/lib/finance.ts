export type FinancialContext = {
  id: string;
  name: string;
  context_type: "personal" | "shared";
  space_kind: "personal" | "couple" | "group";
  group_purpose: string;
};

export type Wallet = {
  id: string;
  name: string;
  wallet_type: "cash" | "virtual" | "bank_manual" | "shared";
  currency: string;
  opening_balance_minor: string | number;
};

export type Category = {
  id: string;
  name: string;
  kind: "income" | "expense" | "both";
};

export type Transaction = {
  id: string;
  transaction_type: "income" | "expense" | "transfer";
  amount_minor: string | number;
  wallet_id: string;
  destination_wallet_id: string | null;
  category_id: string | null;
  description: string | null;
  occurred_on: string;
  status: "posted" | "voided";
  created_at: string;
};

export type FinancialPost = {
  id: string;
  name: string;
  description: string | null;
  target_amount_minor: string | number | null;
};

export type PostAllocation = {
  transaction_id: string;
  post_id: string;
  amount_minor: string | number;
};

export type ShareAllocation = {
  id: string;
  context_id: string;
  wallet_id: string;
  post_id: string;
  amount_minor: string | number;
  status: "active" | "cancelled";
};

export type Budget = {
  id: string;
  name: string;
  amount_minor: string | number;
  period_start: string;
  period_end: string;
  category_id: string | null;
  post_id: string | null;
};

export type LedgerEntry = {
  wallet_id: string;
  delta_minor: string | number;
};

export function idr(amount: bigint | string | number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(typeof amount === "bigint" ? amount : BigInt(String(amount)));
}

export function parseRupiah(value: string) {
  const normalized = value.replace(/[.\s]/g, "");
  if (!/^\d+$/.test(normalized)) return null;
  const amount = BigInt(normalized);
  return amount > BigInt(0) ? amount.toString() : null;
}

export function transactionLabel(type: Transaction["transaction_type"]) {
  return type === "income" ? "Pemasukan" : type === "expense" ? "Pengeluaran" : "Transfer";
}

export function walletBalances(wallets: Wallet[], entries: LedgerEntry[]) {
  const balances = new Map(
    wallets.map((wallet) => [wallet.id, BigInt(String(wallet.opening_balance_minor))]),
  );
  for (const entry of entries) {
    balances.set(
      entry.wallet_id,
      (balances.get(entry.wallet_id) ?? BigInt(0)) + BigInt(String(entry.delta_minor)),
    );
  }
  return balances;
}

export function transactionPostTotals(
  allocations: PostAllocation[],
  transactions: Transaction[],
) {
  const postedIds = new Set(
    transactions.filter((transaction) => transaction.status === "posted").map((transaction) => transaction.id),
  );
  const totals = new Map<string, bigint>();
  for (const allocation of allocations) {
    if (!postedIds.has(allocation.transaction_id)) continue;
    totals.set(
      allocation.post_id,
      (totals.get(allocation.post_id) ?? BigInt(0)) + BigInt(String(allocation.amount_minor)),
    );
  }
  return totals;
}
