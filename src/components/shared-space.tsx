"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field, LoadState, useActions, useRevision, useRpcRows, type Member, type Workspace } from "./workspace-controls";
import { Contributions } from "./space-contributions";
import { Arisan } from "./space-arisan";

export function SharedSpace({ workspace }: { workspace: Workspace }) {
  const { revision, refresh } = useRevision();
  const action = useActions(() => { refresh(); workspace.refresh(); });
  const [kind, setKind] = useState("group");
  const [invitation, setInvitation] = useState("");
  const context = workspace.context!;
  const shared = context.context_type === "shared";
  const canManage = workspace.role === "owner" || workspace.role === "admin";
  const members = useRpcRows<Member>("list_space_members", "p_context_id", shared ? context.id : "", revision);
  const labels = useRpcRows<{ user_id: string; relationship_label: string | null }>("list_couple_labels", "p_context_id", context.space_kind === "couple" ? context.id : "", revision);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const result = await action.run(() => createClient().rpc("create_shared_space", {
      p_name: String(form.get("name")).trim(), p_kind: kind,
      p_purpose: kind === "couple" ? "general" : form.get("purpose"),
    }), "Ruang dibuat. Pilih ruang tersebut dari pilihan ruang.");
    if (result?.value?.id) {
      workspace.setContextId(result.value.id);
      window.location.reload();
    }
  }
  async function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const result = await action.run(() => createClient().rpc("accept_household_invitation", { p_token: String(form.get("token")).trim() }), "Berhasil bergabung.");
    if (result?.value) {
      workspace.setContextId(String(result.value));
      window.location.reload();
    }
  }
  return <div className="extended-workspace">
    {action.feedback}
    <div className="finance-columns">
      <form onSubmit={create} className="finance-panel surface finance-form">
        <h2>Buat ruang bersama</h2>
        <Field label="Nama ruang"><input name="name" maxLength={80} required /></Field>
        <Field label="Jenis"><select value={kind} onChange={e => setKind(e.target.value)}><option value="group">Grup</option><option value="couple">Pasangan (2 akun)</option></select></Field>
        {kind === "group" && <Field label="Kebutuhan"><select name="purpose"><option value="general">Umum</option><option value="class_fund">Kas kelas</option><option value="arisan">Arisan</option></select></Field>}
        <button className="primary-button" disabled={action.busy}>Buat ruang</button>
      </form>
      <form onSubmit={join} className="finance-panel surface finance-form">
        <h2>Gabung lewat undangan</h2><p className="muted">Ruang pribadi tetap privat setelah bergabung.</p>
        <Field label="Kode undangan"><input name="token" required autoComplete="off" /></Field>
        <button className="primary-button" disabled={action.busy}>Gabung</button>
      </form>
    </div>
    {shared && <section className="finance-panel surface">
      <h2>Anggota & undangan</h2><LoadState {...members} />
      {labels.error && <p className="error-message">{labels.error}</p>}
      <div className="finance-list">{members.rows.map(member => <article key={member.user_id} className="finance-list-row">
        <div><strong>{member.display_name}</strong><span className="muted">{member.role}{labels.rows.find(label => label.user_id === member.user_id)?.relationship_label ? ` · ${labels.rows.find(label => label.user_id === member.user_id)?.relationship_label}` : ""}</span></div>
        {workspace.role === "owner" && member.user_id !== workspace.userId && <div className="inline-actions">
          <button className="text-button" disabled={action.busy} onClick={() => action.run(() => createClient().rpc("set_space_member", { p_context_id: context.id, p_user_id: member.user_id, p_role: member.role === "admin" ? "member" : "admin" }))}>{member.role === "admin" ? "Jadikan anggota" : "Jadikan admin"}</button>
          <button className="text-button" disabled={action.busy} onClick={() => { if (window.confirm(`Keluarkan ${member.display_name} dari ruang ini?`)) void action.run(() => createClient().rpc("set_space_member", { p_context_id: context.id, p_user_id: member.user_id, p_role: "removed" })); }}>Keluarkan</button>
        </div>}
        {context.space_kind === "couple" && (canManage || member.user_id === workspace.userId) && <form className="inline-actions" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void action.run(() => createClient().rpc("set_couple_label", { p_context_id: context.id, p_user_id: member.user_id, p_label: form.get("label") })); }}>
          <input aria-label={`Panggilan ${member.display_name}`} name="label" maxLength={30} defaultValue={labels.rows.find(label => label.user_id === member.user_id)?.relationship_label ?? ""} placeholder="Panggilan" key={labels.rows.find(label => label.user_id === member.user_id)?.relationship_label ?? ""} /><button className="secondary-button" disabled={action.busy}>Simpan panggilan</button>
        </form>}
      </article>)}</div>
      {canManage && <form className="finance-form" onSubmit={async e => { e.preventDefault(); const days = Number(new FormData(e.currentTarget).get("days")); const result = await action.run(() => createClient().rpc("create_household_invitation", { p_context_id: context.id, p_days_valid: days }), "Undangan dibuat. Bagikan kode secara privat."); if (result) setInvitation(String(result.value)); }}>
        <Field label="Berlaku (hari)"><input name="days" type="number" min={1} max={30} defaultValue={7} required /></Field>
        <button className="secondary-button" disabled={action.busy}>Buat kode undangan</button>
        {invitation && <Field label="Kode undangan sekali pakai"><textarea readOnly value={invitation} onFocus={e => e.target.select()} /></Field>}
      </form>}
      {workspace.role !== "owner" && <button className="text-button" disabled={action.busy} onClick={() => { if (window.confirm("Keluar dari ruang ini? Akses ruang akan berakhir.")) void action.run(() => createClient().rpc("leave_household", { p_context_id: context.id }), "Berhasil keluar dari ruang."); }}>Keluar dari ruang</button>}
    </section>}
    {shared && <Contributions workspace={workspace} />}
    {context.group_purpose === "arisan" && <Arisan workspace={workspace} members={members.rows} />}
  </div>;
}
