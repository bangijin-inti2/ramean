"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { useWorkspace } from "@/lib/use-workspace";

export type Workspace = ReturnType<typeof useWorkspace>;
export type Member = { user_id: string; display_name: string; role: string };
export type PersonalWallet = { id: string; name: string };

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="finance-field"><span>{label}</span>{children}</label>;
}

export function useActions(onChange?: () => void) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function run<T>(operation: () => PromiseLike<{ data: T; error: { message: string } | null }>, success = "Perubahan disimpan.") {
    if (lock.current) return undefined;
    lock.current = true;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await operation();
      if (result.error) throw new Error(result.error.message);
      setMessage(success); onChange?.();
      return { value: result.data };
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Permintaan gagal. Coba lagi.");
      return undefined;
    } finally { lock.current = false; setBusy(false); }
  }
  return { busy, run, setError, feedback: <><p role="alert" className="error-message">{error}</p><p role="status" className="success-message">{message}</p></> };
}

export function useRpcRows<T>(rpc: string, parameter: string, id: string, revision = 0) {
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError(""); setRows([]);
      try {
        if (!id) return;
        const { data, error } = await createClient().rpc(rpc, { [parameter]: id });
        if (error) throw error;
        if (active) setRows((data ?? []) as T[]);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : String((cause as { message?: string }).message ?? "Data gagal dimuat.")); }
      finally { if (active) setLoading(false); }
    }
    void load(); return () => { active = false; };
  }, [rpc, parameter, id, revision]);
  return { rows, error, loading };
}

export function useRevision() {
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  return { revision, refresh };
}

export function usePersonalWallets(userId: string) {
  const [wallets, setWallets] = useState<PersonalWallet[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      const client = createClient();
      const context = await client.from("financial_contexts").select("id").eq("context_type", "personal").eq("owner_user_id", userId).single();
      if (context.error) { if (active) setError(context.error.message); return; }
      const result = await client.from("wallets").select("id,name").eq("context_id", context.data.id).order("name");
      if (!active) return;
      if (result.error) setError(result.error.message);
      else setWallets(result.data ?? []);
    }
    if (userId) void load(); return () => { active = false; };
  }, [userId]);
  return { wallets, error };
}

export function LoadState({ loading, error }: { loading: boolean; error: string }) {
  return <>{loading && <p className="muted">Memuat...</p>}{error && <p role="alert" className="error-message">{error}</p>}</>;
}
