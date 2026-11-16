"use client";

import jsQR from "jsqr";
import Image from "next/image";
import QRCode from "qrcode";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { idr, parseRupiah } from "@/lib/finance";
import { createClient } from "@/lib/supabase/client";
import { Field, LoadState, useActions, usePersonalWallets, useRevision, useRpcRows, type Workspace } from "./workspace-controls";

const QR_PREFIX = "ramean:setoran:";

type Contribution = {
  id: string;
  post_name: string;
  payer_name: string;
  amount_minor: string | number;
  status: "open" | "pending" | "confirmed" | "cancelled" | "expired";
  created_at: string;
  is_payer: boolean;
};

type ContributionPreview = {
  request_id: string;
  space_name: string;
  post_name: string;
  wallet_name: string;
  amount_minor: string | number;
  status: string;
  expires_at: string;
};

function parseToken(value: string) {
  const trimmed = value.trim();
  const token = trimmed.startsWith(QR_PREFIX) ? trimmed.slice(QR_PREFIX.length) : trimmed;
  if (!/^[0-9a-f]{64}$/.test(token)) throw new Error("Kode QR setoran tidak valid.");
  return token;
}

async function decodeQrImage(file: File) {
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1800 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Gambar QR tidak dapat diproses di browser ini.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(pixels.data, pixels.width, pixels.height);
    if (!result) throw new Error("QR tidak terbaca. Gunakan gambar yang lebih jelas.");
    return parseToken(result.data);
  } finally {
    image.close();
  }
}

export function QrCodeImage({ value, alt }: { value: string; alt: string }) {
  const [result, setResult] = useState<{ value: string; image: string; error: string }>({ value: "", image: "", error: "" });

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(value, { margin: 2, width: 240 }).then(
      (dataUrl) => { if (active) setResult({ value, image: dataUrl, error: "" }); },
      (cause: unknown) => { if (active) setResult({ value, image: "", error: cause instanceof Error ? cause.message : "QR tidak dapat dibuat." }); },
    );
    return () => { active = false; };
  }, [value]);

  if (result.value === value && result.error) return <p role="alert" className="error-message">{result.error}</p>;
  return result.value === value && result.image
    ? <Image src={result.image} alt={alt} width={240} height={240} unoptimized />
    : <p className="muted">Membuat QR...</p>;
}

function statusLabel(status: Contribution["status"]) {
  const labels: Record<Contribution["status"], string> = {
    open: "QR siap",
    pending: "Menunggu konfirmasi",
    confirmed: "Terkonfirmasi",
    cancelled: "Dibatalkan",
    expired: "Kedaluwarsa",
  };
  return labels[status];
}

export function Contributions({ workspace }: { workspace: Workspace }) {
  const { revision, refresh } = useRevision();
  const action = useActions(() => { refresh(); workspace.refresh(); });
  const context = workspace.context;
  const isShared = context?.context_type === "shared";
  const canManage = workspace.role === "owner" || workspace.role === "admin";
  const receipts = useRpcRows<Contribution>(
    "list_contributions",
    "p_context_id",
    isShared ? context.id : "",
    revision,
  );
  const personal = usePersonalWallets(workspace.userId);
  const [postId, setPostId] = useState("");
  const [walletId, setWalletId] = useState("");
  const [amount, setAmount] = useState("10000");
  const [issuedToken, setIssuedToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [token, setToken] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [sourceWalletId, setSourceWalletId] = useState("");
  const [consent, setConsent] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [cancelChecked, setCancelChecked] = useState(false);
  const preview = useRpcRows<ContributionPreview>("preview_contribution_qr", "p_token", token, revision);
  const request = preview.rows[0];

  async function issueQr(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountMinor = parseRupiah(amount);
    const selectedPost = workspace.posts.find((post) => post.id === postId) ?? workspace.posts[0];
    const selectedWallet = workspace.wallets.find((wallet) => wallet.id === walletId) ?? workspace.wallets[0];
    if (!context || !selectedPost || !selectedWallet || !amountMinor) {
      action.setError("Pilih Post, wallet tujuan, dan nominal yang valid.");
      return;
    }
    const result = await action.run(
      () => createClient().rpc("issue_contribution_qr", {
        p_context_id: context.id,
        p_post_id: selectedPost.id,
        p_wallet_id: selectedWallet.id,
        p_amount_minor: amountMinor,
      }),
      "QR setoran dibuat. Bagikan secara privat kepada satu penyetor.",
    );
    if (result?.value) setIssuedToken(String(result.value));
  }

  async function submitToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setToken(parseToken(tokenInput));
      setConsent(false);
      action.setError("");
    } catch (cause) {
      setToken("");
      action.setError(cause instanceof Error ? cause.message : "Kode QR tidak valid.");
    }
  }

  async function readImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setToken("");
    setTokenInput("");
    setConsent(false);
    try {
      setToken(await decodeQrImage(file));
      action.setError("");
    } catch (cause) {
      action.setError(cause instanceof Error ? cause.message : "QR tidak dapat dibaca.");
    } finally {
      event.target.value = "";
    }
  }

  const selectableReceipts = receipts.rows.filter(
    (receipt) => (canManage || receipt.is_payer) && ["open", "pending"].includes(receipt.status),
  );
  const selectedReceipt = selectableReceipts.find((receipt) => receipt.id === selectedId) ?? selectableReceipts[0];

  return (
    <section className="finance-panel surface">
      {action.feedback}
      <p className="eyebrow">Ruang bersama</p>
      <h2>Setoran QR sekali pakai</h2>
      <p className="muted">QR berlaku 24 jam untuk diajukan. Saldo berubah setelah pengelola lain mengonfirmasi penerimaan dana; ini pencatatan, bukan pembayaran otomatis.</p>
      <div className="finance-columns">
        <div className="finance-panel surface">
          <h2>Terbitkan QR</h2>
          {!isShared || !canManage ? (
            <p className="muted">Minta QR setoran kepada pengelola ruang ini.</p>
          ) : !workspace.posts.length || !workspace.wallets.length ? (
            <p className="muted">Buat Post dan wallet tujuan di ruang ini sebelum menerbitkan QR.</p>
          ) : (
            <form className="finance-form" onSubmit={issueQr}>
              <Field label="Post tujuan">
                <select value={workspace.posts.some((post) => post.id === postId) ? postId : workspace.posts[0].id} onChange={(event) => setPostId(event.target.value)}>
                  {workspace.posts.map((post) => <option key={post.id} value={post.id}>{post.name}</option>)}
                </select>
              </Field>
              <Field label="Wallet penerima">
                <select value={workspace.wallets.some((wallet) => wallet.id === walletId) ? walletId : workspace.wallets[0].id} onChange={(event) => setWalletId(event.target.value)}>
                  {workspace.wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
                </select>
              </Field>
              <Field label="Nominal setoran (IDR)">
                <input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} required />
              </Field>
              <button className="primary-button" disabled={action.busy} type="submit">Terbitkan QR sekali pakai</button>
            </form>
          )}
          {issuedToken && <div className="finance-form">
            <QrCodeImage value={QR_PREFIX + issuedToken} alt="QR setoran Ramean" />
            <label className="finance-field"><span>Kode untuk penyetor</span><textarea readOnly value={QR_PREFIX + issuedToken} onFocus={(event) => event.target.select()} /></label>
          </div>}
        </div>
        <div className="finance-panel surface">
          <h2>Ajukan setoran</h2>
          <form className="finance-form" onSubmit={submitToken}>
            <Field label="Tempel kode QR">
              <input autoComplete="off" value={tokenInput} onChange={(event) => { setTokenInput(event.target.value); setToken(""); setConsent(false); }} placeholder="ramean:setoran:..." />
            </Field>
            <button className="secondary-button" type="submit">Periksa kode</button>
          </form>
          <Field label="Atau baca gambar QR (kamera di ponsel / unggah gambar)">
            <input accept="image/*" capture="environment" onChange={readImage} type="file" />
          </Field>
          <LoadState loading={preview.loading} error={preview.error} />
          {token && !preview.loading && !preview.error && !request && <p role="status" className="muted">QR sudah dipakai, kedaluwarsa, atau bukan untuk ruang yang kamu ikuti.</p>}
          {request && <div className="finance-form">
            <p>{request.space_name} / {request.post_name}</p>
            <p><strong>{idr(request.amount_minor)}</strong> · Wallet tujuan: {request.wallet_name}</p>
            <p className="muted">Berlaku sampai {new Date(request.expires_at).toLocaleString("id-ID")}</p>
            {personal.error && <p role="alert" className="error-message">{personal.error}</p>}
            {!personal.wallets.length ? <p className="muted">Buat wallet personal sebelum mengajukan setoran.</p> : <>
              <Field label="Wallet personal sumber">
                <select value={personal.wallets.some((wallet) => wallet.id === sourceWalletId) ? sourceWalletId : personal.wallets[0].id} onChange={(event) => setSourceWalletId(event.target.value)}>
                  {personal.wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
                </select>
              </Field>
              <label className="finance-field">
                <span><input checked={consent} onChange={(event) => setConsent(event.target.checked)} type="checkbox" /> Saya sudah menyerahkan dana dan setuju saldo dicatat setelah penerima mengonfirmasi.</span>
              </label>
              <button className="primary-button" disabled={!consent || action.busy} onClick={() => action.run(
                () => createClient().rpc("submit_contribution", { p_token: token, p_source_wallet_id: sourceWalletId || personal.wallets[0].id }),
                "Setoran diajukan. Saldo belum berubah; menunggu konfirmasi penerima.",
              ).then((result) => { if (result) { setToken(""); setTokenInput(""); setConsent(false); } })} type="button">Ajukan setoran</button>
            </>}
          </div>}
        </div>
      </div>
      <div className="finance-panel surface">
        <h2>Status setoran</h2>
        <LoadState loading={receipts.loading} error={receipts.error} />
        {receipts.rows.length ? <div className="finance-list">
          {receipts.rows.map((receipt) => <article className="finance-list-row" key={receipt.id}>
            <div><strong>{receipt.payer_name}</strong><span className="muted">{receipt.post_name} · {statusLabel(receipt.status)}</span></div>
            <strong>{idr(receipt.amount_minor)}</strong>
          </article>)}
        </div> : !receipts.loading && !receipts.error ? <p className="finance-empty muted">Belum ada setoran atau QR.</p> : null}
        {selectableReceipts.length > 0 && <div className="finance-form">
          <Field label="Pilih QR atau pengajuan">
            <select value={selectedReceipt?.id ?? ""} onChange={(event) => { setSelectedId(event.target.value); setConfirmChecked(false); setCancelChecked(false); }}>
              {selectableReceipts.map((receipt) => <option key={receipt.id} value={receipt.id}>{receipt.payer_name} · {receipt.post_name} · {idr(receipt.amount_minor)} · {statusLabel(receipt.status)}</option>)}
            </select>
          </Field>
          {canManage && selectedReceipt?.status === "pending" && !selectedReceipt.is_payer && <>
            <label className="finance-field"><span><input checked={confirmChecked} onChange={(event) => setConfirmChecked(event.target.checked)} type="checkbox" /> Saya sudah memeriksa dana diterima.</span></label>
            <button className="primary-button" disabled={!confirmChecked || action.busy} onClick={() => action.run(
              () => createClient().rpc("confirm_contribution", { p_request_id: selectedReceipt.id }),
              "Setoran terkonfirmasi; kedua ledger dan Post sudah dicatat.",
            ).then((result) => { if (result) setConfirmChecked(false); })} type="button">Konfirmasi dana diterima</button>
          </>}
          <label className="finance-field"><span><input checked={cancelChecked} onChange={(event) => setCancelChecked(event.target.checked)} type="checkbox" /> Saya ingin membatalkan QR atau menolak pengajuan ini.</span></label>
          <button className="secondary-button" disabled={!cancelChecked || action.busy} onClick={() => action.run(
            () => createClient().rpc("cancel_contribution", { p_request_id: selectedReceipt.id }),
            "QR/pengajuan dibatalkan. Saldo tidak berubah.",
          ).then((result) => { if (result) setCancelChecked(false); })} type="button">Batalkan QR / tolak pengajuan</button>
        </div>}
      </div>
    </section>
  );
}
