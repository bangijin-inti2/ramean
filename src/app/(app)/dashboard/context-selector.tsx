"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Context = { id: string; name: string };

const CONTEXT_STORAGE_KEY = "ramean.active-context";

export function ContextSelector({
  contexts,
  selectedContextId,
}: {
  contexts: Context[];
  selectedContextId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const savedId = window.localStorage.getItem(CONTEXT_STORAGE_KEY);
    if (savedId && contexts.some((context) => context.id === savedId) && savedId !== selectedContextId) {
      router.replace(`/dashboard?context=${encodeURIComponent(savedId)}`);
      return;
    }
    window.localStorage.setItem(CONTEXT_STORAGE_KEY, selectedContextId);
  }, [contexts, router, selectedContextId]);

  return (
    <div className="context-form">
      <label htmlFor="context">Ruang keuangan</label>
      <select
        id="context"
        onChange={(event) => {
          window.localStorage.setItem(CONTEXT_STORAGE_KEY, event.target.value);
          router.push(`/dashboard?context=${encodeURIComponent(event.target.value)}`);
        }}
        value={selectedContextId}
      >
        {contexts.map((context) => <option key={context.id} value={context.id}>{context.name}</option>)}
      </select>
    </div>
  );
}
