"use client";

import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  idr,
  parseRupiah,
  transactionLabel,
  transactionPostTotals,
  walletBalances,
  type Transaction,
} from "@/lib/finance";
import { useWorkspace } from "@/lib/use-workspace";
import { createClient } from "@/lib/supabase/client";
import { SharedSpace } from "./shared-space";

type Section = "wallets" | "transactions" | "posts" | "budgets" | "reports" | "space";
type Operation = "income" | "expense" | "transfer" | "post_transfer" | "share_allocation";
type RpcResult = { error: { message: string } | null };
type RpcOperation = () => PromiseLike<RpcResult>;

const sectionTitles: Record<Section, string> = {
  wallets: "Dompet",
  transactions: "Transaksi",
  posts: "Post",
  budgets: "Anggaran",
  reports: "Laporan",
  space: "Ruang bersama",
};

function localDate() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function amountValue(value: string) {
  if (!value.trim()) return null;
  return parseRupiah(value);
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return <label className="finance-field"><span>{label}</span>{children}</label>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="finance-empty muted">{children}</p>;
}

export function FinanceWorkspace({ section }: { section: Section }) {
  const workspace = useWorkspace();
  const canWrite = workspace.role === "owner" || workspace.role === "admin";
  const balances = useMemo(
    () => walletBalances(workspace.wallets, workspace.ledgerEntries),
    [workspace.wallets, workspace.ledgerEntries],
  );
  const postTotals = useMemo(
    () => transactionPostTotals(workspace.postAllocations, workspace.transactions),
    [workspace.postAllocations, workspace.transactions],
  );

  async function mutate(
    operation: RpcOperation,
    successMessage: string,
  ) {
    workspace.setSaving(true);
    workspace.setError("");
    setNotice("");
    try {
      const result = await operation();
      if (result.error) {
        workspace.setError(result.error.message);
        return false;
      }
      setNotice(successMessage);
      workspace.refresh();
      return true;
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      workspace.setError(error.message);
      return false;
    } finally {
      workspace.setSaving(false);
    }
  }

  const [notice, setNotice] = useState("");

  if (workspace.loading) return <p className="muted">Memuat ruang keuangan...</p>;
  if (workspace.error && !workspace.context) {
    return <section className="finance-panel surface"><p className="error-message">{workspace.error}</p></section>;
  }
  if (!workspace.context) {
    return <section className="finance-panel surface"><h1>Ruang belum tersedia</h1><p className="muted">Akunmu belum memiliki ruang keuangan.</p></section>;
  }

  return (
    <div className="finance-page">
      <header className="finance-heading">
        <div>
          <p className="eyebrow">{sectionTitles[section]}</p>
          <h1>{section === "space" ? workspace.context.name : sectionTitles[section]}</h1>
          <p className="muted">{workspace.context.context_type === "shared" ? "Ruang bersama" : "Ruang pribadi"} · {workspace.context.name}</p>
        </div>
        <Field label="Pilih ruang">
          <select
            aria-label="Pilih ruang keuangan"
            onChange={(event) => workspace.setContextId(event.target.value)}
            value={workspace.context.id}
          >
            {workspace.contexts.map((context) => (
              <option key={context.id} value={context.id}>{context.name}</option>
            ))}
          </select>
        </Field>
      </header>

      {workspace.error && <p className="error-message">{workspace.error}</p>}
      {notice && <p className="success-message">{notice}</p>}
      {!canWrite && <p className="finance-readonly muted">Akun anggota hanya dapat melihat data keuangan.</p>}

      {section === "wallets" && (
        <WalletsSection {...{ workspace, balances, canWrite, mutate }} />
      )}
      {section === "transactions" && (
        <TransactionsSection {...{ workspace, canWrite, mutate }} />
      )}
      {section === "posts" && (
        <PostsSection {...{ workspace, canWrite, postTotals, mutate }} />
      )}
      {section === "budgets" && (
        <BudgetsSection {...{ workspace, canWrite, mutate }} />
      )}
      {section === "reports" && <ReportsSection {...{ workspace }} />}
      {section === "space" && (
        <>
          <SpaceSection {...{ workspace, canWrite, mutate }} />
          <SharedSpace workspace={workspace} />
        </>
      )}
    </div>
  );
}

type CommonProps = {
  workspace: ReturnType<typeof useWorkspace>;
  canWrite: boolean;
  mutate: (
    operation: RpcOperation,
    successMessage: string,
  ) => Promise<boolean>;
};

function WalletsSection({
  workspace,
  balances,
  canWrite,
  mutate,
}: CommonProps & { balances: Map<string, bigint> }) {
  const [name, setName] = useState("");
  const [walletType, setWalletType] = useState("cash");
  const [openingBalance, setOpeningBalance] = useState("0");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const opening = openingBalance.trim() ? openingBalance.replace(/[.\s]/g, "") : "0";
    if (!name.trim() || !/^\d+$/.test(opening)) {
      workspace.setError("Isi nama dompet dan saldo awal dengan benar.");
      return;
    }
    const success = await mutate(
      () => createClient().rpc("create_wallet", {
        p_context_id: workspace.context!.id,
        p_name: name.trim(),
        p_wallet_type: walletType,
        p_opening_balance_minor: opening,
      }),
      "Dompet berhasil ditambahkan.",
    );
    if (success) {
      setName("");
      setOpeningBalance("0");
    }
  }

  return (
    <div className="finance-columns">
      <section className="finance-panel surface">
        <h2>Dompetmu</h2>
        {workspace.wallets.length ? (
          <div className="finance-list">
            {workspace.wallets.map((wallet) => (
              <article className="finance-list-row" key={wallet.id}>
                <div><strong>{wallet.name}</strong><span className="muted">{wallet.wallet_type.replaceAll("_", " ")}</span></div>
                <strong>{idr(balances.get(wallet.id) ?? BigInt(0))}</strong>
              </article>
            ))}
          </div>
        ) : <Empty>Belum ada dompet.</Empty>}
      </section>
      {canWrite && (
        <form className="finance-panel surface finance-form" onSubmit={submit}>
          <h2>Tambah dompet</h2>
          <Field label="Nama dompet"><input maxLength={80} onChange={(event) => setName(event.target.value)} required value={name} /></Field>
          <Field label="Jenis dompet">
            <select onChange={(event) => setWalletType(event.target.value)} value={walletType}>
              <option value="cash">Tunai</option><option value="virtual">Virtual</option>
              <option value="bank_manual">Bank</option><option value="shared">Bersama</option>
            </select>
          </Field>
          <Field label="Saldo awal (rupiah)"><input inputMode="numeric" onChange={(event) => setOpeningBalance(event.target.value)} value={openingBalance} /></Field>
          <button className="primary-button" disabled={workspace.saving} type="submit">Simpan dompet</button>
        </form>
      )}
    </div>
  );
}

function TransactionsSection({ workspace, canWrite, mutate }: CommonProps) {
  const [operationType, setOperationType] = useState<Operation>("expense");
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState("");
  const [destinationWalletId, setDestinationWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [postId, setPostId] = useState("");
  const [description, setDescription] = useState("");
  const [occurredOn, setOccurredOn] = useState(localDate);
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const supabase = createClient();
  const relevantCategories = workspace.categories.filter(
    (category) => category.kind === (operationType === "income" ? "income" : "expense") || category.kind === "both",
  );
  const usesShareWallet = workspace.context?.context_type === "shared";
  const sourceWallets = operationType === "share_allocation"
    ? workspace.wallets.filter((wallet) => wallet.wallet_type === "shared")
    : workspace.wallets;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountMinor = amountValue(amount);
    if (!amountMinor || !walletId) {
      workspace.setError("Pilih dompet dan masukkan jumlah rupiah yang valid.");
      return;
    }
    if ((operationType === "transfer" || operationType === "post_transfer") && !destinationWalletId) {
      workspace.setError("Pilih dompet tujuan.");
      return;
    }
    if ((operationType === "post_transfer" || operationType === "share_allocation") && !postId) {
      workspace.setError("Pilih Post tujuan.");
      return;
    }
    const payload = JSON.stringify([operationType, amountMinor, walletId, destinationWalletId, categoryId, postId, description, occurredOn]);
    if (!attempt.current || attempt.current.payload !== payload) {
      attempt.current = { payload, key: crypto.randomUUID() };
    }
    const idempotencyKey = attempt.current.key;
    let success = false;
    if (operationType === "post_transfer") {
      success = await mutate(
        () => supabase.rpc("record_post_transfer", {
          p_context_id: workspace.context!.id,
          p_amount_minor: amountMinor,
          p_source_wallet_id: walletId,
          p_destination_wallet_id: destinationWalletId,
          p_post_id: postId,
          p_description: description.trim() || null,
          p_occurred_on: occurredOn,
          p_idempotency_key: idempotencyKey,
        }),
        "Transfer ke Post berhasil dicatat.",
      );
    } else if (operationType === "share_allocation") {
      success = await mutate(
        () => supabase.rpc("allocate_shared_funds_to_post", {
          p_wallet_id: walletId,
          p_post_id: postId,
          p_amount_minor: amountMinor,
          p_idempotency_key: idempotencyKey,
        }),
        "Dana share berhasil dialokasikan ke Post.",
      );
    } else {
      success = await mutate(
        () => supabase.rpc("record_transaction", {
          p_context_id: workspace.context!.id,
          p_transaction_type: operationType,
          p_amount_minor: amountMinor,
          p_wallet_id: walletId,
          p_destination_wallet_id: operationType === "transfer" ? destinationWalletId : null,
          p_category_id: operationType === "income" || operationType === "expense" ? categoryId || null : null,
          p_description: description.trim() || null,
          p_occurred_on: occurredOn,
          p_idempotency_key: idempotencyKey,
        }),
        "Transaksi berhasil dicatat.",
      );
    }
    if (success) {
      attempt.current = null;
      setAmount("");
      setDescription("");
    }
  }

  async function voidTransaction(transaction: Transaction) {
    if (!window.confirm("Batalkan transaksi ini? Saldo akan dikoreksi melalui catatan ledger.")) return;
    await mutate(
      () => supabase.rpc("void_transaction", { p_transaction_id: transaction.id }),
      "Transaksi berhasil dibatalkan.",
    );
  }

  return (
    <div className="finance-columns">
      <section className="finance-panel surface">
        <h2>Riwayat transaksi</h2>
        {workspace.transactions.length ? (
          <div className="finance-list">
            {workspace.transactions.slice(0, 60).map((transaction) => (
              <article className="finance-list-row" key={transaction.id}>
                <div>
                  <strong>{transaction.description || transactionLabel(transaction.transaction_type)}</strong>
                  <span className="muted">{transaction.occurred_on} · {transactionLabel(transaction.transaction_type)}{transaction.status === "voided" ? " · dibatalkan" : ""}</span>
                </div>
                <strong className={transaction.transaction_type}>
                  {transaction.transaction_type === "expense" ? "− " : transaction.transaction_type === "income" ? "+ " : ""}
                  {idr(transaction.amount_minor)}
                </strong>
                {canWrite && transaction.status === "posted" && (
                  <button className="text-button" disabled={workspace.saving} onClick={() => voidTransaction(transaction)} type="button">Batalkan</button>
                )}
              </article>
            ))}
          </div>
        ) : <Empty>Belum ada transaksi.</Empty>}
      </section>
      {canWrite && (
        <form className="finance-panel surface finance-form" onSubmit={submit}>
          <h2>Catat keuangan</h2>
          <Field label="Jenis transaksi">
            <select onChange={(event) => { setOperationType(event.target.value as Operation); setWalletId(""); }} value={operationType}>
              <option value="income">Pemasukan</option><option value="expense">Pengeluaran</option>
              <option value="transfer">Transfer antar dompet</option>
              <option value="post_transfer">Pindahkan dana ke Post</option>
              {usesShareWallet && <option value="share_allocation">Alokasikan dana share ke Post</option>}
            </select>
          </Field>
          <Field label="Jumlah (rupiah)"><input inputMode="numeric" onChange={(event) => setAmount(event.target.value)} required value={amount} /></Field>
          <Field label={operationType === "share_allocation" ? "Dompet dana share" : "Dompet sumber"}>
            <select onChange={(event) => setWalletId(event.target.value)} required value={walletId}>
              <option value="">Pilih dompet</option>
              {sourceWallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
            </select>
          </Field>
          {operationType === "share_allocation" && sourceWallets.length === 0 && (
            <p className="muted">Buat dompet berjenis Bersama terlebih dahulu sebelum mengalokasikan dana share.</p>
          )}
          {(operationType === "transfer" || operationType === "post_transfer") && (
            <Field label="Dompet tujuan">
              <select onChange={(event) => setDestinationWalletId(event.target.value)} required value={destinationWalletId}>
                <option value="">Pilih dompet tujuan</option>
                {workspace.wallets.filter((wallet) => wallet.id !== walletId).map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
              </select>
            </Field>
          )}
          {(operationType === "post_transfer" || operationType === "share_allocation") && (
            <Field label="Post tujuan">
              <select onChange={(event) => setPostId(event.target.value)} required value={postId}>
                <option value="">Pilih Post</option>
                {workspace.posts.map((post) => <option key={post.id} value={post.id}>{post.name}</option>)}
              </select>
            </Field>
          )}
          {(operationType === "income" || operationType === "expense") && (
            <Field label="Kategori">
              <select onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
                <option value="">Tanpa kategori</option>
                {relevantCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Tanggal"><input onChange={(event) => setOccurredOn(event.target.value)} required type="date" value={occurredOn} /></Field>
          <Field label="Catatan"><input maxLength={500} onChange={(event) => setDescription(event.target.value)} value={description} /></Field>
          <button className="primary-button" disabled={workspace.saving} type="submit">Simpan transaksi</button>
        </form>
      )}
    </div>
  );
}

function PostsSection({
  workspace,
  canWrite,
  postTotals,
  mutate,
}: CommonProps & { postTotals: Map<string, bigint> }) {
  const [editingPost, setEditingPost] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState("");

  function editPost(postId: string) {
    const post = workspace.posts.find((item) => item.id === postId);
    if (!post) return;
    setEditingPost(post.id);
    setName(post.name);
    setDescription(post.description ?? "");
    setTarget(post.target_amount_minor === null ? "" : String(post.target_amount_minor));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetMinor = amountValue(target);
    if (!name.trim()) {
      workspace.setError("Masukkan nama Post.");
      return;
    }
    const rpc = editingPost ? "update_financial_post_target" : "create_financial_post_with_target";
    const params = editingPost
      ? { p_post_id: editingPost, p_name: name.trim(), p_description: description.trim() || null, p_target_amount_minor: targetMinor }
      : { p_context_id: workspace.context!.id, p_name: name.trim(), p_description: description.trim() || null, p_target_amount_minor: targetMinor };
    const success = await mutate(() => createClient().rpc(rpc, params), editingPost ? "Post berhasil diperbarui." : "Post berhasil dibuat.");
    if (success) {
      setEditingPost("");
      setName("");
      setDescription("");
      setTarget("");
    }
  }

  return (
    <div className="finance-columns">
      <section className="finance-panel surface">
        <h2>Daftar Post</h2>
        {workspace.posts.length ? (
          <div className="finance-list">
            {workspace.posts.map((post) => {
              const shareTotal = workspace.shareAllocations
                .filter((allocation) => allocation.post_id === post.id)
                .reduce((sum, allocation) => sum + BigInt(String(allocation.amount_minor)), BigInt(0));
              const collected = (postTotals.get(post.id) ?? BigInt(0)) + shareTotal;
              return (
                <article className="finance-list-row" key={post.id}>
                  <div>
                    <strong>{post.name}</strong>
                    <span className="muted">{post.description || "Belum ada deskripsi"}</span>
                    <span className="muted">Terkumpul: {idr(collected)}{post.target_amount_minor ? ` / ${idr(post.target_amount_minor)}` : ""}</span>
                  </div>
                  {canWrite && <button className="text-button" onClick={() => editPost(post.id)} type="button">Ubah</button>}
                </article>
              );
            })}
          </div>
        ) : <Empty>Belum ada Post.</Empty>}
      </section>
      {canWrite && (
        <form className="finance-panel surface finance-form" onSubmit={submit}>
          <h2>{editingPost ? "Ubah Post" : "Buat Post"}</h2>
          <Field label="Nama Post"><input maxLength={100} onChange={(event) => setName(event.target.value)} required value={name} /></Field>
          <Field label="Deskripsi"><input maxLength={500} onChange={(event) => setDescription(event.target.value)} value={description} /></Field>
          <Field label="Target dana (opsional)"><input inputMode="numeric" onChange={(event) => setTarget(event.target.value)} value={target} /></Field>
          <button className="primary-button" disabled={workspace.saving} type="submit">{editingPost ? "Simpan perubahan" : "Buat Post"}</button>
          {editingPost && <button className="secondary-button" onClick={() => { setEditingPost(""); setName(""); setDescription(""); setTarget(""); }} type="button">Batal mengubah</button>}
        </form>
      )}
    </div>
  );
}

function BudgetsSection({ workspace, canWrite, mutate }: CommonProps) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [postId, setPostId] = useState("");
  const [periodStart, setPeriodStart] = useState(localDate().slice(0, 8) + "01");
  const [periodEnd, setPeriodEnd] = useState(localDate());
  const allocationsByTransaction = useMemo(() => {
    const result = new Map<string, Map<string, bigint>>();
    for (const allocation of workspace.postAllocations) {
      const postMap = result.get(allocation.transaction_id) ?? new Map<string, bigint>();
      postMap.set(allocation.post_id, (postMap.get(allocation.post_id) ?? BigInt(0)) + BigInt(String(allocation.amount_minor)));
      result.set(allocation.transaction_id, postMap);
    }
    return result;
  }, [workspace.postAllocations]);

  function spent(budget: (typeof workspace.budgets)[number]) {
    return workspace.transactions.reduce((sum, transaction) => {
      if (transaction.status !== "posted" || transaction.transaction_type !== "expense") return sum;
      if (transaction.occurred_on < budget.period_start || transaction.occurred_on > budget.period_end) return sum;
      if (budget.category_id && transaction.category_id !== budget.category_id) return sum;
      if (!budget.post_id) return sum + BigInt(String(transaction.amount_minor));
      return sum + (allocationsByTransaction.get(transaction.id)?.get(budget.post_id) ?? BigInt(0));
    }, BigInt(0));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountMinor = amountValue(amount);
    if (!name.trim() || !amountMinor || periodStart > periodEnd) {
      workspace.setError("Periksa nama, jumlah, dan periode anggaran.");
      return;
    }
    const success = await mutate(
      () => createClient().rpc("create_budget", {
        p_context_id: workspace.context!.id,
        p_name: name.trim(),
        p_amount_minor: amountMinor,
        p_period_start: periodStart,
        p_period_end: periodEnd,
        p_category_id: categoryId || null,
        p_post_id: postId || null,
      }),
      "Anggaran berhasil dibuat.",
    );
    if (success) { setName(""); setAmount(""); }
  }

  return (
    <div className="finance-columns">
      <section className="finance-panel surface">
        <h2>Anggaran berjalan</h2>
        {workspace.budgets.length ? (
          <div className="finance-list">
            {workspace.budgets.map((budget) => {
              const totalSpent = spent(budget);
              const limit = BigInt(String(budget.amount_minor));
              const percent = Number(totalSpent * BigInt(100) / limit);
              return (
                <article className="finance-budget" key={budget.id}>
                  <div className="finance-list-row">
                    <div><strong>{budget.name}</strong><span className="muted">{budget.period_start} – {budget.period_end}</span></div>
                    <strong>{idr(totalSpent)} / {idr(limit)}</strong>
                  </div>
                  <progress aria-label={`Penggunaan anggaran ${budget.name}`} max={100} value={Math.min(percent, 100)} />
                  {canWrite && <button className="text-button" disabled={workspace.saving} onClick={() => mutate(() => createClient().rpc("delete_budget", { p_budget_id: budget.id }), "Anggaran berhasil dihapus.")} type="button">Hapus anggaran</button>}
                </article>
              );
            })}
          </div>
        ) : <Empty>Belum ada anggaran.</Empty>}
      </section>
      {canWrite && (
        <form className="finance-panel surface finance-form" onSubmit={submit}>
          <h2>Buat anggaran</h2>
          <Field label="Nama anggaran"><input maxLength={100} onChange={(event) => setName(event.target.value)} required value={name} /></Field>
          <Field label="Batas anggaran (rupiah)"><input inputMode="numeric" onChange={(event) => setAmount(event.target.value)} required value={amount} /></Field>
          <Field label="Kategori">
            <select onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
              <option value="">Semua kategori</option>
              {workspace.categories.filter((category) => category.kind !== "income").map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </Field>
          <Field label="Post (opsional)">
            <select onChange={(event) => setPostId(event.target.value)} value={postId}>
              <option value="">Semua Post</option>
              {workspace.posts.map((post) => <option key={post.id} value={post.id}>{post.name}</option>)}
            </select>
          </Field>
          <Field label="Mulai"><input onChange={(event) => setPeriodStart(event.target.value)} required type="date" value={periodStart} /></Field>
          <Field label="Berakhir"><input onChange={(event) => setPeriodEnd(event.target.value)} required type="date" value={periodEnd} /></Field>
          <button className="primary-button" disabled={workspace.saving} type="submit">Simpan anggaran</button>
        </form>
      )}
    </div>
  );
}

function ReportsSection({ workspace }: { workspace: ReturnType<typeof useWorkspace> }) {
  const today = localDate();
  const [dateFrom, setDateFrom] = useState(today.slice(0, 8) + "01");
  const [dateTo, setDateTo] = useState(today);
  const visible = workspace.transactions.filter(
    (transaction) => transaction.status === "posted" && transaction.occurred_on >= dateFrom && transaction.occurred_on <= dateTo,
  );
  const income = visible.filter((transaction) => transaction.transaction_type === "income")
    .reduce((sum, transaction) => sum + BigInt(String(transaction.amount_minor)), BigInt(0));
  const expenses = visible.filter((transaction) => transaction.transaction_type === "expense")
    .reduce((sum, transaction) => sum + BigInt(String(transaction.amount_minor)), BigInt(0));
  const categoryTotals = new Map<string, bigint>();
  for (const transaction of visible) {
    if (transaction.transaction_type !== "expense") continue;
    const key = transaction.category_id ?? "uncategorized";
    categoryTotals.set(key, (categoryTotals.get(key) ?? BigInt(0)) + BigInt(String(transaction.amount_minor)));
  }
  const categoryName = new Map(workspace.categories.map((category) => [category.id, category.name]));
  return (
    <section className="finance-panel surface">
      <div className="finance-filter">
        <Field label="Dari"><input onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} /></Field>
        <Field label="Sampai"><input onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} /></Field>
      </div>
      {dateFrom > dateTo && <p className="error-message">Tanggal awal harus sebelum tanggal akhir.</p>}
      <div className="report-summary">
        <article><span className="muted">Pemasukan</span><strong>{idr(income)}</strong></article>
        <article><span className="muted">Pengeluaran</span><strong>{idr(expenses)}</strong></article>
        <article><span className="muted">Selisih</span><strong>{idr(income - expenses)}</strong></article>
      </div>
      <h2>Pengeluaran per kategori</h2>
      {categoryTotals.size ? (
        <div className="finance-list">
          {[...categoryTotals.entries()].sort((a, b) => a[1] > b[1] ? -1 : a[1] < b[1] ? 1 : 0).map(([categoryId, total]) => (
            <article className="finance-list-row" key={categoryId}>
              <strong>{categoryName.get(categoryId) ?? "Tanpa kategori"}</strong><strong>{idr(total)}</strong>
            </article>
          ))}
        </div>
      ) : <Empty>Tidak ada pengeluaran di periode ini.</Empty>}
    </section>
  );
}

function SpaceSection({ workspace, canWrite, mutate }: CommonProps) {
  const allocations = workspace.shareAllocations;
  const totalAllocated = allocations.reduce((sum, allocation) => sum + BigInt(String(allocation.amount_minor)), BigInt(0));
  return (
    <div className="finance-columns">
      <section className="finance-panel surface">
        <p className="eyebrow">Kelola dana bersama</p>
        <h2>Dana share ke Post</h2>
        <p className="muted">Alokasi hanya menandai tujuan dana; saldo dompet tidak berpindah. Gunakan menu Transaksi untuk memilih dompet share dan Post tujuan.</p>
        <div className="report-summary"><article><span className="muted">Total dana yang dialokasikan</span><strong>{idr(totalAllocated)}</strong></article></div>
        {allocations.length ? (
          <div className="finance-list">
            {allocations.map((allocation) => {
              const wallet = workspace.wallets.find((item) => item.id === allocation.wallet_id);
              const post = workspace.posts.find((item) => item.id === allocation.post_id);
              return (
                <article className="finance-list-row" key={allocation.id}>
                  <div><strong>{post?.name ?? "Post tidak aktif"}</strong><span className="muted">Dari {wallet?.name ?? "dompet"} · alokasi aktif</span></div>
                  <strong>{idr(allocation.amount_minor)}</strong>
                  {canWrite && <button className="text-button" disabled={workspace.saving} onClick={() => mutate(() => createClient().rpc("cancel_shared_post_allocation", { p_allocation_id: allocation.id }), "Alokasi dana berhasil dibatalkan.")} type="button">Batalkan</button>}
                </article>
              );
            })}
          </div>
        ) : <Empty>Belum ada alokasi dana share.</Empty>}
      </section>
      <section className="finance-panel surface">
        <h2>Anggota dan pengaturan ruang</h2>
        <p className="muted">Pilihan akun dan peran anggota dapat dikelola dari pengaturan ruang bersama.</p>
        {workspace.context?.context_type === "shared" ? (
          <p className="muted">Jenis ruang: {workspace.context.space_kind === "couple" ? "Pasangan" : workspace.context.group_purpose || "Grup"}</p>
        ) : <p className="muted">Ruang ini bersifat pribadi.</p>}
      </section>
    </div>
  );
}
