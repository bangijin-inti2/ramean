"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Budget,
  Category,
  FinancialContext,
  FinancialPost,
  LedgerEntry,
  PostAllocation,
  ShareAllocation,
  Transaction,
  Wallet,
} from "./finance";

const CONTEXT_STORAGE_KEY = "ramean.active-context";

type WorkspaceData = {
  loading: boolean;
  saving: boolean;
  error: string;
  contexts: FinancialContext[];
  context: FinancialContext | null;
  userId: string;
  role: string;
  wallets: Wallet[];
  categories: Category[];
  transactions: Transaction[];
  posts: FinancialPost[];
  budgets: Budget[];
  ledgerEntries: LedgerEntry[];
  postAllocations: PostAllocation[];
  shareAllocations: ShareAllocation[];
  setContextId: (contextId: string) => void;
  refresh: () => void;
  setSaving: (saving: boolean) => void;
  setError: (error: string) => void;
};

export function useWorkspace(): WorkspaceData {
  const [contexts, setContexts] = useState<FinancialContext[]>([]);
  const [contextId, setContextIdState] = useState("");
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [posts, setPosts] = useState<FinancialPost[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [postAllocations, setPostAllocations] = useState<PostAllocation[]>([]);
  const [shareAllocations, setShareAllocations] = useState<ShareAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setErrorState] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  const setError = useCallback((message: string) => setErrorState(message), []);
  const refresh = useCallback(() => setRefreshVersion((version) => version + 1), []);
  const setContextId = useCallback((id: string) => {
    setContextIdState(id);
    if (typeof window !== "undefined") window.localStorage.setItem(CONTEXT_STORAGE_KEY, id);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadContexts() {
      setLoading(true);
      setErrorState("");
      const supabase = createClient();
      try {
        const [{ data: userResult, error: userError }, { data: contextRows, error: contextError }] =
          await Promise.all([
            supabase.auth.getUser(),
            supabase
              .from("financial_contexts")
              .select("id,name,context_type,space_kind,group_purpose")
              .order("created_at")
              .order("id"),
          ]);
        if (!active) return;
        if (userError) throw new Error(userError.message);
        if (!userResult.user) throw new Error("Sesi akun tidak tersedia. Silakan login kembali.");
        if (contextError) throw new Error(contextError.message);
        const available = (contextRows ?? []) as FinancialContext[];
        setUserId(userResult.user.id);
        setContexts(available);
        const savedId = window.localStorage.getItem(CONTEXT_STORAGE_KEY);
        const selected =
          available.find((context) => context.id === savedId) ??
          available.find((context) => context.context_type === "personal") ??
          available[0];
        setContextIdState(selected?.id ?? "");
      } catch (error) {
        if (!active) return;
        if (!(error instanceof Error)) throw error;
        setErrorState(`Ruang keuangan belum dapat dimuat: ${error.message}`);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadContexts();
    return () => { active = false; };
  }, [refreshVersion]);

  useEffect(() => {
    if (!contextId || !userId) return;
    let active = true;
    async function loadContext() {
      setLoading(true);
      setErrorState("");
      const supabase = createClient();
      try {
        const [
          walletResult,
          categoryResult,
          postResult,
          budgetResult,
          allocationResult,
          shareResult,
          roleResult,
        ] = await Promise.all([
          supabase.from("wallets").select("id,name,wallet_type,currency,opening_balance_minor").eq("context_id", contextId).order("created_at").order("id"),
          supabase.from("categories").select("id,name,kind").eq("context_id", contextId).order("name").order("id"),
          supabase.from("financial_posts").select("id,name,description,target_amount_minor").eq("context_id", contextId).eq("status", "active").order("created_at").order("id"),
          supabase.from("budgets").select("id,name,amount_minor,period_start,period_end,category_id,post_id").eq("context_id", contextId).order("period_start", { ascending: false }).order("id"),
          supabase.from("post_allocations").select("transaction_id,post_id,amount_minor"),
          supabase.from("wallet_post_allocations").select("id,context_id,wallet_id,post_id,amount_minor,status").eq("context_id", contextId).eq("status", "active").order("created_at").order("id"),
          supabase.from("financial_context_members").select("role").eq("context_id", contextId).eq("user_id", userId).maybeSingle(),
        ]);
        for (const result of [walletResult, categoryResult, postResult, budgetResult, allocationResult, shareResult, roleResult]) {
          if (result.error) throw new Error(result.error.message);
        }

        const allTransactions: Transaction[] = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error: queryError } = await supabase
            .from("transactions")
            .select("id,transaction_type,amount_minor,wallet_id,destination_wallet_id,category_id,description,occurred_on,status,created_at")
            .eq("context_id", contextId)
            .order("occurred_on", { ascending: false })
            .order("created_at", { ascending: false })
            .range(offset, offset + 499);
          if (queryError) throw new Error(queryError.message);
          const page = (data ?? []) as Transaction[];
          allTransactions.push(...page);
          if (page.length < 500) break;
        }

        const allEntries: LedgerEntry[] = [];
        const walletIds = ((walletResult.data ?? []) as Wallet[]).map((wallet) => wallet.id);
        for (const batchStart of Array.from({ length: Math.ceil(walletIds.length / 100) }, (_, index) => index * 100)) {
          const walletBatch = walletIds.slice(batchStart, batchStart + 100);
          for (let offset = 0; ; offset += 500) {
            const { data, error: queryError } = await supabase
              .from("ledger_entries")
              .select("wallet_id,delta_minor")
              .in("wallet_id", walletBatch)
              .order("id")
              .range(offset, offset + 499);
            if (queryError) throw new Error(queryError.message);
            const page = (data ?? []) as LedgerEntry[];
            allEntries.push(...page);
            if (page.length < 500) break;
          }
        }

        if (!active) return;
        setWallets((walletResult.data ?? []) as Wallet[]);
        setCategories((categoryResult.data ?? []) as Category[]);
        setPosts((postResult.data ?? []) as FinancialPost[]);
        setBudgets((budgetResult.data ?? []) as Budget[]);
        setPostAllocations((allocationResult.data ?? []) as PostAllocation[]);
        setShareAllocations((shareResult.data ?? []) as ShareAllocation[]);
        setTransactions(allTransactions);
        setLedgerEntries(allEntries);
        setRole(roleResult.data?.role ?? "");
        setLoading(false);
      } catch (error) {
        if (!active) return;
        if (!(error instanceof Error)) throw error;
        setErrorState(`Data ruang belum dapat dimuat: ${error.message}`);
        setLoading(false);
      }
    }
    void loadContext();
    return () => { active = false; };
  }, [contextId, refreshVersion, userId]);

  return {
    loading,
    saving,
    error,
    contexts,
    context: contexts.find((context) => context.id === contextId) ?? null,
    userId,
    role,
    wallets,
    categories,
    transactions,
    posts,
    budgets,
    ledgerEntries,
    postAllocations,
    shareAllocations,
    setContextId,
    refresh,
    setSaving,
    setError,
  };
}
