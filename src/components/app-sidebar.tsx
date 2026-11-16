"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { signOut } from "@/app/(app)/actions";

type Context = {
  id: string;
  name: string;
  context_type: string;
  space_kind: string | null;
};

const contextStorageKey = "ramean.active-context";
const themeStorageKey = "ramean.theme-mode";
const contextChangeEvent = "ramean:context-change";
const themeChangeEvent = "ramean:theme-change";
const navigation = [
  { href: "/dashboard", label: "Ringkasan" },
  { href: "/wallets", label: "Dompet" },
  { href: "/transactions", label: "Transaksi" },
  { href: "/posts", label: "Pos dana" },
  { href: "/budgets", label: "Anggaran" },
  { href: "/reports", label: "Laporan" },
  { href: "/space", label: "Ruang bersama" },
];

function subscribeContext(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(contextChangeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(contextChangeEvent, onChange);
  };
}

function subscribeTheme(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(themeChangeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(themeChangeEvent, onChange);
  };
}

function getStoredContext() {
  return window.localStorage.getItem(contextStorageKey) ?? "";
}

function getStoredTheme(): "dark" | "light" {
  return window.localStorage.getItem(themeStorageKey) === "light" ? "light" : "dark";
}

function getEmptySnapshot() {
  return "";
}

function getDarkThemeSnapshot(): "dark" {
  return "dark";
}

function saveContext(contextId: string) {
  window.localStorage.setItem(contextStorageKey, contextId);
  window.dispatchEvent(new Event(contextChangeEvent));
}

function contextKind(context: Context) {
  const kind = context.space_kind ?? (context.context_type === "personal" ? "personal" : "group");
  switch (kind) {
    case "personal":
      return "Pribadi";
    case "couple":
      return "Pasangan";
    default:
      return "Grup";
  }
}

export function AppSidebar({
  contexts,
  userLabel,
}: {
  contexts: Context[];
  userLabel: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const savedContextId = useSyncExternalStore(subscribeContext, getStoredContext, getEmptySnapshot);
  const theme = useSyncExternalStore(subscribeTheme, getStoredTheme, getDarkThemeSnapshot);
  const [menuOpen, setMenuOpen] = useState(false);
  const selectedContext =
    contexts.find((context) => context.id === savedContextId) ??
    contexts.find((context) => context.context_type === "personal") ??
    contexts[0];
  const defaultContext =
    contexts.find((context) => context.context_type === "personal") ??
    contexts[0];
  const selectedContextId = selectedContext?.id ?? "";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const queryContextId = pathname === "/dashboard"
      ? new URLSearchParams(window.location.search).get("context")
      : null;
    const queryContext = contexts.find((context) => context.id === queryContextId);
    if (queryContext && savedContextId !== queryContext.id) {
      saveContext(queryContext.id);
    } else if (
      pathname === "/dashboard" &&
      selectedContext &&
      defaultContext &&
      selectedContext.id !== defaultContext.id
    ) {
      router.replace(`/dashboard?context=${encodeURIComponent(selectedContext.id)}`);
    } else if (selectedContext && savedContextId !== selectedContext.id) {
      saveContext(selectedContext.id);
    }
  }, [contexts, defaultContext, pathname, router, savedContextId, selectedContext, theme]);

  function selectContext(contextId: string) {
    saveContext(contextId);
    if (pathname === "/dashboard") {
      router.replace(`/dashboard?context=${encodeURIComponent(contextId)}`);
    } else {
      window.location.reload();
    }
  }

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(themeStorageKey, nextTheme);
    window.dispatchEvent(new Event(themeChangeEvent));
  }

  return (
    <aside className={`app-sidebar${menuOpen ? " is-open" : ""}`}>
      <button
        aria-expanded={menuOpen}
        className="sidebar-menu-toggle secondary-button"
        onClick={() => setMenuOpen((open) => !open)}
        type="button"
      >
        {menuOpen ? "Tutup menu" : "Menu"}
      </button>
      <div className="sidebar-body">
        <div className="sidebar-brand">
          <Link aria-label="Ramean, ringkasan" href="/dashboard">
            <Image
              alt="Ramean"
              height={44}
              priority
              src={theme === "dark" ? "/ramean-logo-dark.svg" : "/ramean-logo-light.svg"}
              width={142}
            />
          </Link>
          <p>Uangmu. Ruangmu. Rencanamu.</p>
        </div>

        <div className="sidebar-context">
          <label htmlFor="active-context">Ruang keuangan</label>
          <select
            id="active-context"
            onChange={(event) => selectContext(event.target.value)}
            value={selectedContextId}
          >
            {contexts.map((context) => (
              <option key={context.id} value={context.id}>{context.name}</option>
            ))}
          </select>
          {selectedContext && <p>{contextKind(selectedContext)} · Laporan mengikuti ruang aktif</p>}
        </div>

        <nav aria-label="Navigasi utama" className="app-nav">
          {navigation.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={active ? "is-active" : undefined}
                href={href}
                key={href}
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-account">
          <button className="secondary-button theme-toggle" onClick={toggleTheme} type="button">
            Ganti ke mode {theme === "dark" ? "terang" : "gelap"}
          </button>
          <p className="sidebar-user" title={userLabel}>{userLabel}</p>
          <form action={signOut}>
            <button className="secondary-button signout-button" type="submit">Keluar akun</button>
          </form>
          <p className="sidebar-context-note">Ramean / Pribadi | Pasangan | Grup</p>
        </div>
      </div>
    </aside>
  );
}
