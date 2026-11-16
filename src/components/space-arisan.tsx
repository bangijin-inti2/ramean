"use client";

import { useRef, useState, type FormEvent } from "react";
import { idr, parseRupiah } from "@/lib/finance";
import { createClient } from "@/lib/supabase/client";
import { Field, LoadState, useActions, usePersonalWallets, useRevision, useRpcRows, type Member, type Workspace } from "./workspace-controls";
import { QrCodeImage } from "./space-contributions";

type Cycle = {
  id: string;
  name: string;
  due_amount_minor: string | number;
  cadence: "weekly" | "monthly";
  status: "active" | "completed" | "cancelled";
  participant_count: number;
  start_date: string;
  wallet_name: string;
};

type Round = {
  id: string;
  round_number: number;
  due_date: string;
  recipient_name: string;
  is_recipient: boolean;
  expected_minor: string | number;
  paid_minor: string | number;
  paid_count: number;
  total_count: number;
  payout_status: "not_requested" | "pending" | "confirmed" | "cancelled";
};

type Due = {
  id: string;
  participant_name: string;
  is_payer: boolean;
  status: "unpaid" | "open" | "expired" | "pending" | "confirmed" | "cancelled";
  amount_minor: string | number;
};

const dueLabels: Record<Due["status"], string> = {
  unpaid: "Belum bayar",
  open: "QR siap",
  expired: "QR kedaluwarsa",
  pending: "Menunggu konfirmasi",
  confirmed: "Lunas",
  cancelled: "Dibatalkan",
};

const payoutLabels: Record<Round["payout_status"], string> = {
  not_requested: "Belum diajukan",
  pending: "Menunggu penerima",
  confirmed: "Diterima",
  cancelled: "Dibatalkan",
};

function localDate() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function Arisan({ workspace, members }: { workspace: Workspace; members: Member[] }) {
  const contextId = workspace.context?.id ?? "";
  const manager = workspace.role === "owner" || workspace.role === "admin";
  const { revision, refresh } = useRevision();
  const action = useActions(() => { refresh(); workspace.refresh(); });
  const cycles = useRpcRows<Cycle>("list_arisan_cycles", "p_context_id", contextId, revision);
  const [cycleId, setCycleId] = useState("");
  const cycle = cycles.rows.find((row) => row.id === cycleId) ?? cycles.rows[0];
  const rounds = useRpcRows<Round>("list_arisan_rounds", "p_cycle_id", cycle?.id ?? "", revision);
  const [roundId, setRoundId] = useState("");
  const round = rounds.rows.find((row) => row.id === roundId) ?? rounds.rows[0];
  const dues = useRpcRows<Due>("list_arisan_dues", "p_round_id", round?.id ?? "", revision);
  const personal = usePersonalWallets(workspace.userId);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("100000");
  const [startDate, setStartDate] = useState(localDate);
  const [cadence, setCadence] = useState<"weekly" | "monthly">("monthly");
  const [cycleWalletId, setCycleWalletId] = useState("");
  const [payoutWalletId, setPayoutWalletId] = useState("");
  const [memberToAdd, setMemberToAdd] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [agreement, setAgreement] = useState(false);
  const requestRef = useRef<{ signature: string; key: string } | null>(null);
  const [issuedQr, setIssuedQr] = useState<{ dueId: string; token: string } | null>(null);
  const [dueToIssue, setDueToIssue] = useState("");
  const [acceptPayout, setAcceptPayout] = useState(false);
  const [payoutSent, setPayoutSent] = useState(false);
  const [cancelCycle, setCancelCycle] = useState(false);

  async function createCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountMinor = parseRupiah(amount);
    const selectedWallet = workspace.wallets.find((wallet) => wallet.id === cycleWalletId) ?? workspace.wallets[0];
    if (!contextId || !name.trim() || !amountMinor || !startDate || !selectedWallet || participants.length < 2 || !agreement) {
      action.setError("Isi konfigurasi, pilih minimal dua peserta berurutan, dan setujui aturan siklus.");
      return;
    }
    const payload = JSON.stringify([name.trim(), selectedWallet.id, amountMinor, startDate, cadence, participants]);
    if (!requestRef.current || requestRef.current.signature !== payload) {
      requestRef.current = { signature: payload, key: crypto.randomUUID() };
    }
    const result = await action.run(
      () => createClient().rpc("create_arisan_cycle", {
        p_context_id: contextId,
        p_name: name.trim(),
        p_wallet_id: selectedWallet.id,
        p_amount_minor: amountMinor,
        p_start_date: startDate,
        p_cadence: cadence,
        p_participants: participants,
        p_idempotency_key: requestRef.current?.key,
      }),
      "Siklus dibuat. Jadwal penerima dan tagihan setiap periode sudah siap.",
    );
    if (result?.value) {
      const newId = String(result.value);
      requestRef.current = null;
      setCycleId(newId);
      setName("");
      setParticipants([]);
      setAgreement(false);
    }
  }

  async function issueDue(dueId: string) {
    const result = await action.run(
      () => createClient().rpc("issue_arisan_due_qr", { p_due_id: dueId }),
      "QR iuran dibuat untuk peserta terpilih.",
    );
    if (result?.value) setIssuedQr({ dueId, token: String(result.value) });
  }

  const activeParticipants = members.filter((member) => !participants.includes(member.user_id));
  const allDuesPaid = Boolean(round && round.total_count > 0 && round.paid_count === round.total_count);
  const earlierRoundsPaid = Boolean(round && rounds.rows.filter((item) => item.round_number < round.round_number).every((item) => item.payout_status === "confirmed"));
  const pendingDues = dues.rows.filter((due) => due.status === "pending");
  const cancellableDues = dues.rows.filter((due) => ["open", "pending"].includes(due.status) && (manager || due.is_payer));

  return (
    <section className="finance-panel surface">
      {action.feedback}
      <p className="eyebrow">Ruang arisan</p>
      <h2>Arisan berperiode</h2>
      <p className="muted">Peserta tetap, iuran sama per periode, dan setiap peserta mendapat satu giliran. Saldo berubah setelah penerimaan iuran dan pencairan dikonfirmasi.</p>
      <LoadState loading={cycles.loading} error={cycles.error} />

      {manager && <details className="finance-panel surface" open={!cycles.rows.length}>
        <summary>Buat siklus arisan</summary>
        {members.length < 2 || !workspace.wallets.length ? <p className="muted">Undang minimal dua peserta aktif dan buat wallet kas grup sebelum memulai.</p> : <form className="finance-form" onSubmit={createCycle}>
          <Field label="Nama siklus"><input maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Arisan keluarga" required value={name} /></Field>
          <Field label="Iuran per orang (IDR)"><input inputMode="numeric" onChange={(event) => setAmount(event.target.value)} required value={amount} /></Field>
          <Field label="Jatuh tempo periode pertama"><input onChange={(event) => setStartDate(event.target.value)} required type="date" value={startDate} /></Field>
          <Field label="Jarak antarperiode"><select onChange={(event) => setCadence(event.target.value as "weekly" | "monthly")} value={cadence}><option value="monthly">Bulanan</option><option value="weekly">Mingguan</option></select></Field>
          <Field label="Wallet kas arisan"><select onChange={(event) => setCycleWalletId(event.target.value)} value={workspace.wallets.some((wallet) => wallet.id === cycleWalletId) ? cycleWalletId : workspace.wallets[0].id}>{workspace.wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select></Field>
          <Field label="Tambahkan peserta sesuai urutan penerima">
            <select onChange={(event) => setMemberToAdd(event.target.value)} value={memberToAdd}><option value="">Pilih anggota</option>{activeParticipants.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}</select>
          </Field>
          <button className="secondary-button" disabled={!memberToAdd || participants.length >= 100} onClick={() => { setParticipants((current) => [...current, memberToAdd]); setMemberToAdd(""); }} type="button">Tambahkan ke urutan</button>
          {participants.length > 0 && <ol className="finance-list">
            {participants.map((participantId, index) => {
              const participant = members.find((member) => member.user_id === participantId);
              return <li className="finance-list-row" key={participantId}>
                <div><strong>Giliran {index + 1}</strong><span className="muted">{participant?.display_name ?? "Anggota"}</span></div>
                <div className="inline-actions">
                  <button aria-label={`Pindahkan ${participant?.display_name ?? "anggota"} ke atas`} className="text-button" disabled={index === 0} onClick={() => setParticipants((current) => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })} type="button">Naik</button>
                  <button aria-label={`Pindahkan ${participant?.display_name ?? "anggota"} ke bawah`} className="text-button" disabled={index === participants.length - 1} onClick={() => setParticipants((current) => { const next = [...current]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; })} type="button">Turun</button>
                  <button className="text-button" onClick={() => setParticipants((current) => current.filter((id) => id !== participantId))} type="button">Hapus</button>
                </div>
              </li>;
            })}
          </ol>}
          <p className="muted">Tanggal bulanan menyesuaikan jumlah hari tiap bulan. Peserta tidak dapat keluar selama siklus aktif.</p>
          <label className="finance-field"><span><input checked={agreement} onChange={(event) => setAgreement(event.target.checked)} type="checkbox" /> Saya sudah menyepakati iuran dan urutan ini dengan peserta.</span></label>
          <button className="primary-button" disabled={action.busy || !agreement || participants.length < 2} type="submit">Mulai siklus</button>
        </form>}
      </details>}

      {cycle && <>
        <Field label="Siklus arisan">
          <select onChange={(event) => { setCycleId(event.target.value); setRoundId(""); setDueToIssue(""); setIssuedQr(null); }} value={cycle.id}>
            {cycles.rows.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.status}</option>)}
          </select>
        </Field>
        <p className="muted">{cycle.participant_count} peserta · {idr(cycle.due_amount_minor)} per orang · kas: {cycle.wallet_name} · {cycle.cadence === "monthly" ? "bulanan" : "mingguan"}</p>
        <LoadState loading={rounds.loading} error={rounds.error} />
        {rounds.rows.length > 0 && <div className="finance-list">
          {rounds.rows.map((item) => <article className="finance-list-row" key={item.id}>
            <div><strong>Periode {item.round_number} · {item.recipient_name}</strong><span className="muted">{item.due_date} · iuran {item.paid_count}/{item.total_count} · pencairan: {payoutLabels[item.payout_status]}</span></div>
            <strong>{idr(item.paid_minor)} / {idr(item.expected_minor)}</strong>
          </article>)}
        </div>}
        {round && <>
          <Field label="Detail periode"><select onChange={(event) => { setRoundId(event.target.value); setDueToIssue(""); setIssuedQr(null); setAcceptPayout(false); setPayoutSent(false); }} value={round.id}>{rounds.rows.map((item) => <option key={item.id} value={item.id}>Periode {item.round_number} · {item.recipient_name}</option>)}</select></Field>
          <LoadState loading={dues.loading} error={dues.error} />
          <div className="finance-columns">
            <div className="finance-panel surface">
              <h3>Iuran peserta</h3>
              {dues.rows.map((due) => <article className="finance-list-row" key={due.id}>
                <div><strong>{due.participant_name}</strong><span className="muted">{dueLabels[due.status]}</span></div><strong>{idr(due.amount_minor)}</strong>
              </article>)}
              {manager && cycle.status === "active" && dues.rows.some((due) => !["pending", "confirmed"].includes(due.status)) && <>
                <Field label="QR iuran untuk">
                  <select value={dueToIssue} onChange={(event) => { setDueToIssue(event.target.value); setIssuedQr(null); }}>
                    <option value="">Pilih peserta</option>
                    {dues.rows.filter((due) => !["pending", "confirmed"].includes(due.status)).map((due) => <option key={due.id} value={due.id}>{due.participant_name}</option>)}
                  </select>
                </Field>
                <button className="secondary-button" disabled={action.busy || !dueToIssue} onClick={() => { if (dueToIssue) void issueDue(dueToIssue); }} type="button">Buat QR iuran</button>
              </>}
              {issuedQr && <div className="finance-form">
                <QrCodeImage value={`ramean:setoran:${issuedQr.token}`} alt="QR iuran arisan Ramean" />
                <p className="muted">Kirim QR ini hanya kepada peserta terpilih. Peserta mengajukan dari tab Setoran QR.</p>
              </div>}
              {manager && pendingDues.length > 0 && <div className="finance-form">
                <p className="muted">Ada iuran menunggu konfirmasi. Penyetor tidak dapat mengonfirmasi iurannya sendiri.</p>
                {pendingDues.map((due) => <article className="finance-list-row" key={due.id}>
                  <div><strong>{due.participant_name}</strong><span className="muted">{due.is_payer ? "Menunggu pengelola lain" : "Menunggu konfirmasi penerimaan"}</span></div>
                  {!due.is_payer && <button className="secondary-button" disabled={action.busy} onClick={() => { if (window.confirm(`Konfirmasi dana iuran dari ${due.participant_name} sudah diterima?`)) void action.run(
                    () => createClient().rpc("confirm_arisan_due", { p_due_id: due.id }),
                    "Iuran dikonfirmasi. Saldo kas dan status tagihan diperbarui.",
                  ); }} type="button">Konfirmasi diterima</button>}
                </article>)}
              </div>}
              {cancellableDues.length > 0 && <details className="finance-form">
                <summary>Batalkan pengajuan / QR iuran</summary>
                {cancellableDues.map((due) => <article className="finance-list-row" key={due.id}>
                  <div><strong>{due.participant_name}</strong><span className="muted">{dueLabels[due.status]}</span></div>
                  <button className="text-button" disabled={action.busy} onClick={() => { if (window.confirm(`Batalkan pengajuan atau QR untuk ${due.participant_name}?`)) void action.run(
                    () => createClient().rpc("cancel_arisan_due", { p_due_id: due.id }),
                    "Pengajuan dibatalkan. Tagihan tetap ada dan dapat diterbitkan QR baru.",
                  ); }} type="button">Batalkan</button>
                </article>)}
              </details>}
            </div>
            <div className="finance-panel surface">
              <h3>Giliran penerima</h3>
              <p><strong>{round.recipient_name}</strong></p>
              <p className="muted">{round.payout_status === "confirmed" ? "Penerima sudah mengonfirmasi pencairan." : `${idr(round.expected_minor)} · ${payoutLabels[round.payout_status]}`}</p>
              {round.payout_status === "pending" && round.is_recipient && <>
                {personal.error && <p role="alert" className="error-message">{personal.error}</p>}
                {personal.wallets.length ? <>
                  <Field label="Wallet personal penerima"><select value={personal.wallets.some((wallet) => wallet.id === payoutWalletId) ? payoutWalletId : personal.wallets[0].id} onChange={(event) => setPayoutWalletId(event.target.value)}>{personal.wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select></Field>
                  <label className="finance-field"><span><input checked={acceptPayout} onChange={(event) => setAcceptPayout(event.target.checked)} type="checkbox" /> Saya sudah menerima dana pencairan ini.</span></label>
                  <button className="primary-button" disabled={!acceptPayout || action.busy} onClick={() => void action.run(
                    () => createClient().rpc("confirm_arisan_payout", { p_round_id: round.id, p_personal_wallet_id: payoutWalletId || personal.wallets[0].id }),
                    "Pencairan diterima. Kas grup berkurang dan saldo personal bertambah.",
                  )} type="button">Konfirmasi pencairan diterima</button>
                </> : <p className="muted">Buat wallet personal terlebih dahulu untuk mencatat penerimaan.</p>}
              </>}
              {manager && cycle.status === "active" && round.payout_status !== "pending" && round.payout_status !== "confirmed" && <>
                {!allDuesPaid && <p className="muted">Semua iuran periode ini harus lunas sebelum pencairan.</p>}
                {!earlierRoundsPaid && <p className="muted">Pencairan periode sebelumnya harus selesai terlebih dahulu.</p>}
                <label className="finance-field"><span><input checked={payoutSent} onChange={(event) => setPayoutSent(event.target.checked)} type="checkbox" /> Dana periode ini sudah diserahkan kepada penerima.</span></label>
                <button className="primary-button" disabled={!allDuesPaid || !earlierRoundsPaid || !payoutSent || action.busy} onClick={() => void action.run(
                  () => createClient().rpc("request_arisan_payout", { p_round_id: round.id }),
                  "Pencairan diajukan. Penerima perlu login dan mengonfirmasi dana diterima.",
                )} type="button">Ajukan pencairan ke penerima</button>
              </>}
              {!manager && round.payout_status === "pending" && !round.is_recipient && <p className="muted">Menunggu penerima mengonfirmasi dana pencairan.</p>}
              <p className="muted">Saldo berubah setelah penerima mengonfirmasi; ini pencatatan dana yang sudah diserahkan, bukan transfer bank otomatis.</p>
            </div>
          </div>
        </>}
        {manager && cycle.status === "active" && <details className="finance-form">
          <summary>Batalkan siklus sebelum ada iuran lunas</summary>
          <p className="muted">Siklus yang sudah menerima iuran lunas tidak dapat dibatalkan.</p>
          <label className="finance-field"><span><input checked={cancelCycle} onChange={(event) => setCancelCycle(event.target.checked)} type="checkbox" /> Saya ingin membatalkan siklus ini.</span></label>
          <button className="secondary-button" disabled={!cancelCycle || action.busy} onClick={() => void action.run(
            () => createClient().rpc("cancel_arisan_cycle", { p_cycle_id: cycle.id }),
            "Siklus dibatalkan; QR dan pengajuan yang belum lunas ikut dibatalkan.",
          )} type="button">Batalkan siklus</button>
        </details>}
      </>}
      {!cycles.loading && !cycles.error && !cycles.rows.length && <p className="muted">Belum ada siklus. Pengelola dapat membuat jadwal setelah peserta bergabung.</p>}
    </section>
  );
}
