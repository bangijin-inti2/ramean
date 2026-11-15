import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ContextSelector } from "./context-selector";
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
  const userId = claimData?.claims?.sub;
  if (!userId) return null;

  const [{ data: profile, error: profileError }, { data: contexts, error: contextsError }] =
    await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
      supabase
        .from("financial_contexts")
        .select("id,name,context_type,space_kind,group_purpose")
        .order("created_at")
        .order("id"),
    ]);

  if (profileError) throw new Error("Profil belum dapat dimuat.");
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

  const [{ data: rawWallets, error: walletsError }, { data: rawTransactions, error: transactionsError }] =
    await Promise.all([
      supabase
        .from("wallets")
        .select("id,name,wallet_type,opening_balance_minor")
        .eq("context_id", selectedContext.id)
        .order("created_at")
        .order("id"),
      supabase
        .from("transactions")
        .select("id,transaction_type,amount_minor,description,occurred_on,status")
        .eq("context_id", selectedContext.id)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  if (walletsError) throw new Error("Dompet belum dapat dimuat.");
  if (transactionsError) throw new Error("Transaksi belum dapat dimuat.");

  const wallets = (rawWallets ?? []) as Wallet[];
  const transactions = (rawTransactions ?? []) as Transaction[];
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
  const userName = profile?.display_name || "Teman Ramean";

  return (
    <div className="dashboard">
      <section className="dashboard-heading">
        <div>
          <p className="eyebrow">Ringkasan</p>
          <h1>Halo, {userName}</h1>
          <p className="muted">Pantau uangmu dalam satu ruang.</p>
        </div>
        <ContextSelector contexts={availableContexts} selectedContextId={selectedContext.id} />
      </section>

      <section aria-label="Saldo" className="balance-card surface">
        <div>
          <p className="muted">Saldo seluruh dompet</p>
          <strong>{formatMoney(totalBalance)}</strong>
        </div>
        <span className="balance-context">{selectedContext.name}</span>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Saldo tersedia</p>
            <h2>Dompet</h2>
          </div>
        </div>
        {wallets.length === 0 ? (
          <div className="empty-card surface">
            <h3>Belum ada dompet</h3>
            <p className="muted">Dompet akan muncul di sini setelah ditambahkan.</p>
          </div>
        ) : (
          <div className="wallet-grid">
            {wallets.map((wallet) => (
              <article className="wallet-card surface" key={wallet.id}>
                <span className="wallet-type">{wallet.wallet_type.replaceAll("_", " ")}</span>
                <h3>{wallet.name}</h3>
                <strong>{formatMoney(balances.get(wallet.id) ?? BigInt(0))}</strong>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Aktivitas terkini</p>
            <h2>Transaksi</h2>
          </div>
        </div>
        {transactions.length === 0 ? (
          <div className="empty-card surface">
            <h3>Belum ada transaksi</h3>
            <p className="muted">Transaksi yang dicatat akan muncul di sini.</p>
          </div>
        ) : (
          <div className="transaction-list surface">
            {transactions.map((transaction) => (
              <article className="transaction-row" key={transaction.id}>
                <div>
                  <strong>{transaction.description || labelTransaction(transaction.transaction_type)}</strong>
                  <span className="muted">{transaction.occurred_on}</span>
                </div>
                <strong className={`transaction-amount ${transaction.transaction_type}`}>
                  {transaction.transaction_type === "expense" ? "−" : transaction.transaction_type === "income" ? "+" : ""}
                  {formatMoney(BigInt(String(transaction.amount_minor)))}
                </strong>
              </article>
            ))}
          </div>
        )}
      </section>
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
