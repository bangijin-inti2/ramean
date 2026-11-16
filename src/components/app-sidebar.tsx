"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FocusEvent, type ReactNode } from "react";
import { signOut } from "@/app/(app)/actions";

type Context = {
  id: string;
  name: string;
  context_type: string;
  space_kind: string | null;
};

type IconName =
  | "dashboard"
  | "wallet"
  | "transactions"
  | "posts"
  | "budgets"
  | "reports"
  | "space"
  | "profile"
  | "room"
  | "sun"
  | "moon"
  | "logout";

const contextStorageKey = "ramean.active-context";
const themeStorageKey = "ramean.theme-mode";
const contextChangeEvent = "ramean:context-change";
const themeChangeEvent = "ramean:theme-change";
const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Ringkasan", icon: "dashboard" },
  { href: "/wallets", label: "Dompet", icon: "wallet" },
  { href: "/transactions", label: "Transaksi", icon: "transactions" },
  { href: "/posts", label: "Pos dana", icon: "posts" },
  { href: "/budgets", label: "Anggaran", icon: "budgets" },
  { href: "/reports", label: "Laporan", icon: "reports" },
  { href: "/space", label: "Ruang bersama", icon: "space" },
  { href: "/profile", label: "Profil", icon: "profile" },
];

function Icon({ name }: { name: IconName }) {
  let shape: ReactNode;
  switch (name) {
    case "dashboard":
      shape = <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="10" width="8" height="11" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /></>;
      break;
    case "wallet":
      shape = <><path d="M4 6.5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2h14" /><path d="M16 12h5" /><circle cx="16" cy="12" r=".7" /></>;
      break;
    case "transactions":
      shape = <><path d="M4 7h15l-3-3" /><path d="M20 17H5l3 3" /><path d="M19 7v4M5 17v-4" /></>;
      break;
    case "posts":
      shape = <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><path d="M12 12 19 5" /></>;
      break;
    case "budgets":
      shape = <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>;
      break;
    case "reports":
      shape = <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 5-6" /><path d="M16 7h3v3" /></>;
      break;
    case "space":
      shape = <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.5A5.5 5.5 0 0 1 9 13h1a5 5 0 0 1 3.4 1.3" /><path d="M16 11a3 3 0 1 0-2.2-5" /><path d="M15 16h6M18 13v6" /></>;
      break;
    case "profile":
      shape = <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>;
      break;
    case "room":
      shape = <><path d="M4 20V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v15" /><path d="M2 20h20M12 11h.01" /></>;
      break;
    case "sun":
      shape = <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>;
      break;
    case "moon":
      shape = <path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" />;
      break;
    case "logout":
      shape = <><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5" /><path d="M14 8l4 4-4 4M8 12h10" /></>;
      break;
  }

  return (
    <svg aria-hidden="true" fill="none" focusable="false" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">
      {shape}
    </svg>
  );
}

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
  const [desktopExpanded, setDesktopExpanded] = useState(false);
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

  function handleBlur(event: FocusEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    if (!event.currentTarget.matches(":hover")) setDesktopExpanded(false);
  }

  return (
    <aside
      className={`app-sidebar${desktopExpanded ? " is-expanded" : ""}${menuOpen ? " is-open" : ""}`}
      onBlurCapture={handleBlur}
      onFocusCapture={() => setDesktopExpanded(true)}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setDesktopExpanded(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse" && !event.currentTarget.contains(document.activeElement)) {
          setDesktopExpanded(false);
        }
      }}
    >
      <button
        aria-expanded={menuOpen}
        aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
        className="sidebar-menu-toggle secondary-button"
        onClick={() => setMenuOpen((open) => !open)}
        type="button"
      >
        {menuOpen ? "Tutup menu" : "Menu"}
      </button>
      <div className="sidebar-body">
        <div className="sidebar-brand">
          <Link aria-label="Ramean, ringkasan" className="sidebar-brand-link" href="/dashboard">
            <span aria-hidden="true" className="sidebar-mark">R</span>
            <Image
              alt="Ramean"
              className="sidebar-wordmark"
              height={44}
              priority
              src={theme === "dark" ? "/ramean-logo-dark.svg" : "/ramean-logo-light.svg"}
              width={142}
            />
          </Link>
          <p>Uangmu. Ruangmu. Rencanamu.</p>
        </div>

        <div className="sidebar-context">
          <label className="sidebar-label" htmlFor="active-context">Ruang keuangan</label>
          <div className="sidebar-context-select">
            <span aria-hidden="true" className="sidebar-context-icon"><Icon name="room" /></span>
            <select
              aria-label="Pilih ruang keuangan"
              id="active-context"
              onChange={(event) => selectContext(event.target.value)}
              value={selectedContextId}
            >
              {contexts.map((context) => (
                <option key={context.id} value={context.id}>{context.name}</option>
              ))}
            </select>
          </div>
          {selectedContext && <p className="sidebar-label">{contextKind(selectedContext)} · Laporan mengikuti ruang aktif</p>}
        </div>

        <nav aria-label="Navigasi utama" className="app-nav">
          {navigation.map(({ href, label, icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={active ? "is-active" : undefined}
                href={href}
                key={href}
                onClick={() => setMenuOpen(false)}
                title={label}
              >
                <Icon name={icon} />
                <span className="sidebar-label">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-account">
          <p className="sidebar-user sidebar-label" title={userLabel}>{userLabel}</p>
          <button
            aria-label={`Ganti ke mode ${theme === "dark" ? "terang" : "gelap"}`}
            className="secondary-button icon-button theme-toggle"
            onClick={toggleTheme}
            title={`Mode ${theme === "dark" ? "terang" : "gelap"}`}
            type="button"
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
          <form action={signOut}>
            <button aria-label="Keluar akun" className="secondary-button icon-button signout-button" title="Keluar akun" type="submit">
              <Icon name="logout" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
