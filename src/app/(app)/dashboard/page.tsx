import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import "./dashboard.css";

export const metadata: Metadata = {
  title: "Ringkasan",
};

type Context = {
  id: string;
  name: string;
  context_type: string;
  space_kind: string;
  group_purpose: string;
};

type Wallet = {
  id: string;
  name: string;
  wallet_type: string;
  opening_balance_minor: string | number;
};

type LedgerEntry = {
  wallet_id: string;
  delta_minor: string | number;
};

type Transaction = {
  id: string;
  transaction_type: string;
  amount_minor: string | number;
  wallet_id: string;
  destination_wallet_id: string | null;
  description: string | null;
  occurred_on: string;
  status: string;
};

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatMoney(value: bigint) {
  return money.format(value);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ context?: string }>;
}) {
  const supabase = await createClient();
  const { data: claimData } = await supabase.auth.getClaims();
  if (!claimData?.claims?.sub) return null;

  const { data: contexts, error: contextsError } = await supabase
    .from("financial_contexts")
    .select("id,name,context_type,space_kind,group_purpose")
    .order("created_at")
    .order("id");

  if (contextsError) throw new Error("Ruang keuangan belum dapat dimuat.");

  const availableContexts = (contexts ?? []) as Context[];
  const params = await searchParams;
  const selectedContext =
    availableContexts.find((context) => context.id === params.context) ??
    availableContexts.find((context) => context.context_type === "personal") ??
    availableContexts[0];

  if (!selectedContext) {
    return (
      <section className="dashboard-empty surface">
        <p className="eyebrow">Ruang keuangan</p>
        <h1>Ruang belum tersedia</h1>
        <p className="muted">Akunmu belum memiliki ruang keuangan. Muat ulang atau hubungi pengelola.</p>
      </section>
    );
  }

  const { data: rawWallets, error: walletsError } = await supabase
    .from("wallets")
    .select("id,name,wallet_type,opening_balance_minor")
    .eq("context_id", selectedContext.id)
    .order("created_at")
    .order("id");

  if (walletsError) throw new Error("Dompet belum dapat dimuat.");

  const wallets = (rawWallets ?? []) as Wallet[];
  const transactions: Transaction[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id,transaction_type,amount_minor,wallet_id,destination_wallet_id,description,occurred_on,status")
      .eq("context_id", selectedContext.id)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + 499);

    if (error) throw new Error("Transaksi belum dapat dimuat.");
    const page = (data ?? []) as Transaction[];
    transactions.push(...page);
    if (page.length < 500) break;
  }

  const walletIds = wallets.map((wallet) => wallet.id);
  let ledgerEntries: LedgerEntry[] = [];

  if (walletIds.length > 0) {
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("wallet_id,delta_minor")
        .in("wallet_id", walletIds)
        .order("id")
        .range(offset, offset + 499);

      if (error) throw new Error("Saldo dompet belum dapat dihitung.");
      const page = (data ?? []) as LedgerEntry[];
      ledgerEntries = ledgerEntries.concat(page);
      if (page.length < 500) break;
    }
  }

  const balances = new Map(
    wallets.map((wallet) => [wallet.id, BigInt(String(wallet.opening_balance_minor))]),
  );
  for (const entry of ledgerEntries) {
    balances.set(
      entry.wallet_id,
      (balances.get(entry.wallet_id) ?? BigInt(0)) + BigInt(String(entry.delta_minor)),
    );
  }
  const totalBalance = [...balances.values()].reduce((sum, amount) => sum + amount, BigInt(0));
  const income = transactions
    .filter((transaction) => transaction.transaction_type === "income" && transaction.status === "posted")
    .reduce((sum, transaction) => sum + BigInt(String(transaction.amount_minor)), BigInt(0));
  const expense = transactions
    .filter((transaction) => transaction.transaction_type === "expense" && transaction.status === "posted")
    .reduce((sum, transaction) => sum + BigInt(String(transaction.amount_minor)), BigInt(0));
  const walletNames = new Map(wallets.map((wallet) => [wallet.id, wallet.name]));

  return (
    <div className="dashboard">
      <section className="dashboard-heading">
        <div>
          <p className="eyebrow">Ramean</p>
          <h1>Ringkasan</h1>
          <p className="muted">Ruang aktif: {selectedContext.name}</p>
        </div>
      </section>

      <details className="guide-card surface" open={wallets.length === 0}>
        <summary>Panduan singkat</summary>
        <div className="guide-content">
          <h2>Mulai dari sini</h2>
          <p className="muted">Urutan paling sederhana: buat dompet → catat transaksi → pindahkan dana ke target bila diperlukan.</p>
          <div className="guide-steps">
            <article><strong>1. Dompet</strong><p>Tempat saldo berada: tunai, dompet virtual, atau rekening bank.</p></article>
            <article><strong>2. Transaksi</strong><p>Catat uang masuk, uang keluar, atau perpindahan antar-dompet.</p></article>
            <article><strong>3. Target dana</strong><p>Pindahkan dana dari dompet sumber ke tujuan dan kaitkan ke pos dana.</p></article>
          </div>
        </div>
      </details>

      <section aria-label="Ringkasan keuangan" className="metric-grid">
        <article className="metric-card surface">
          <span>Total balance</span>
          <strong>{formatMoney(totalBalance)}</strong>
        </article>
        <article className="metric-card surface">
          <span>Income recorded</span>
          <strong>{formatMoney(income)}</strong>
        </article>
        <article className="metric-card surface">
          <span>Expense recorded</span>
          <strong>{formatMoney(expense)}</strong>
        </article>
      </section>

      <div className="dashboard-columns">
        <section className="dashboard-panel surface">
          <h2>Wallet snapshot</h2>
          {wallets.length === 0 ? (
            <p className="empty-card muted">Belum ada dompet. Buat dompet pertama dari menu Dompet.</p>
          ) : (
            <div className="table-scroll">
              <table className="overview-table">
                <thead><tr><th>Wallet</th><th>Type</th><th>Balance</th></tr></thead>
                <tbody>
                  {wallets.map((wallet) => (
                    <tr key={wallet.id}>
                      <td>{wallet.name}</td>
                      <td>{wallet.wallet_type.replaceAll("_", " ")}</td>
                      <td>{formatMoney(balances.get(wallet.id) ?? BigInt(0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="dashboard-panel surface">
          <h2>Recent activity</h2>
          {transactions.length === 0 ? (
            <p className="empty-card muted">Belum ada transaksi. Catat pemasukan atau pengeluaran pertamamu.</p>
          ) : (
            <div className="table-scroll">
              <table className="overview-table activity-table">
                <thead>
                  <tr><th>Date</th><th>Type</th><th>Amount</th><th>From</th><th>To</th><th>Description</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 5).map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{transaction.occurred_on}</td>
                      <td>{labelTransaction(transaction.transaction_type)}</td>
                      <td>{formatMoney(BigInt(String(transaction.amount_minor)))}</td>
                      <td>{walletNames.get(transaction.wallet_id) ?? "-"}</td>
                      <td>{transaction.destination_wallet_id ? walletNames.get(transaction.destination_wallet_id) ?? "-" : "-"}</td>
                      <td>{transaction.description || "-"}</td>
                      <td>{transaction.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <p className="dashboard-note muted">Saldo mengikuti seluruh ledger. Transfer antar-dompet tidak menambah pemasukan atau pengeluaran.</p>
    </div>
  );
}

function labelTransaction(type: string) {
  switch (type) {
    case "income":
      return "Pemasukan";
    case "expense":
      return "Pengeluaran";
    case "transfer":
      return "Transfer";
    default:
      return "Transaksi";
  }
}
