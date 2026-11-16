"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const timezones = [
  { value: "Asia/Jakarta", label: "WIB — Asia/Jakarta" },
  { value: "Asia/Makassar", label: "WITA — Asia/Makassar" },
  { value: "Asia/Jayapura", label: "WIT — Asia/Jayapura" },
];

export function ProfileForm({
  defaultCurrency,
  displayName,
  email,
  timezone,
}: {
  defaultCurrency: string;
  displayName: string;
  email: string;
  timezone: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [selectedTimezone, setSelectedTimezone] = useState(timezone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName || normalizedName.length > 80) {
      setError("Nama tampilan harus berisi 1–80 karakter.");
      setNotice("");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { error: updateError } = await createClient().rpc("update_own_profile", {
        p_display_name: normalizedName,
        p_timezone: selectedTimezone,
      });
      if (updateError) throw new Error(updateError.message);
      setName(normalizedName);
      setNotice("Profil berhasil disimpan.");
      router.refresh();
    } catch (cause) {
      if (!(cause instanceof Error)) throw cause;
      setError(`Profil gagal disimpan: ${cause.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="profile-panel surface" onSubmit={submit}>
      <div className="profile-readonly">
        <span>Email akun</span>
        <strong>{email || "Tidak tersedia"}</strong>
        <small>Email dikelola melalui metode masuk akun.</small>
      </div>

      <label className="finance-field">
        <span>Nama tampilan</span>
        <input
          autoComplete="name"
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
      </label>

      <label className="finance-field">
        <span>Zona waktu</span>
        <select
          onChange={(event) => setSelectedTimezone(event.target.value)}
          value={selectedTimezone}
        >
          {timezones.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      <div className="profile-readonly">
        <span>Mata uang utama</span>
        <strong>{defaultCurrency}</strong>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}
      <button className="primary-button profile-save" disabled={saving} type="submit">
        {saving ? "Menyimpan..." : "Simpan profil"}
      </button>
    </form>
  );
}
