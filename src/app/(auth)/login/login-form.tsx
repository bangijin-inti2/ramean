"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "register";

export function LoginForm({ callbackError }: { callbackError: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    callbackError ? "Login Google belum berhasil. Silakan coba lagi." : "",
  );
  const [notice, setNotice] = useState("");

  function redirectToCallback() {
    return new URL("/auth/callback?next=/dashboard", window.location.origin).toString();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const supabase = createClient();
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
        router.replace("/dashboard");
        return;
      }

      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: displayName.trim() },
          emailRedirectTo: redirectToCallback(),
        },
      });
      if (authError) throw authError;
      if (data.session) {
        router.replace("/dashboard");
        return;
      }
      setNotice("Akun dibuat. Periksa email untuk verifikasi sebelum login.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Permintaan login gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectToCallback(),
          queryParams: { prompt: "select_account" },
        },
      });
      if (authError) throw authError;
      if (!data.url) throw new Error("URL login Google tidak tersedia.");
      window.location.assign(data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google belum dapat dibuka.");
      setBusy(false);
    }
  }

  return (
    <div className="auth-card surface">
      <button
        className="google-button primary-button"
        disabled={busy}
        onClick={signInWithGoogle}
        type="button"
      >
        <GoogleMark />
        Lanjutkan dengan Google
      </button>
      <p className="auth-hint">Cara masuk utama. Email dan password tetap tersedia di bawah.</p>

      <div className="auth-divider"><span>atau dengan email</span></div>
      <div className="auth-tabs" role="tablist" aria-label="Metode email">
        <button
          aria-selected={mode === "login"}
          className={mode === "login" ? "auth-tab active" : "auth-tab"}
          onClick={() => { setMode("login"); setError(""); setNotice(""); }}
          role="tab"
          type="button"
        >
          Masuk
        </button>
        <button
          aria-selected={mode === "register"}
          className={mode === "register" ? "auth-tab active" : "auth-tab"}
          onClick={() => { setMode("register"); setError(""); setNotice(""); }}
          role="tab"
          type="button"
        >
          Daftar
        </button>
      </div>

      <form className="auth-form" onSubmit={submit}>
        {mode === "register" && (
          <label>
            Nama
            <input
              autoComplete="name"
              maxLength={80}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              value={displayName}
            />
          </label>
        )}
        <label>
          Email
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          Password
          <input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={mode === "register" ? 8 : undefined}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        {error && <p className="error-message" role="alert">{error}</p>}
        {notice && <p className="success-message" role="status">{notice}</p>}
        <button className="primary-button submit-button" disabled={busy} type="submit">
          {busy ? "Memproses..." : mode === "login" ? "Login" : "Buat akun"}
        </button>
      </form>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" height="20" viewBox="0 0 48 48" width="20">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.73 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94a11.05 11.05 0 0 1-4.8 7.24l7.74 6c4.51-4.17 7.1-10.31 7.1-17.71Z" />
      <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.95 23.95 0 0 0 0 21.56l7.98-6.19Z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.74-6c-2.15 1.45-4.9 2.3-8.16 2.3-6.27 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
  );
}
