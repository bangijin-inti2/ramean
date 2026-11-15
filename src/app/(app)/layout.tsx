import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "./actions";
import { createClient } from "@/lib/supabase/server";
import "./app.css";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link aria-label="Ramean, ringkasan" className="app-brand" href="/dashboard">
          <Image alt="Ramean" height={44} priority src="/ramean-logo-dark.svg" width={142} />
        </Link>
        <nav aria-label="Navigasi utama" className="app-nav">
          <Link href="/dashboard">Ringkasan</Link>
          <Link href="/wallets">Dompet</Link>
          <Link href="/transactions">Transaksi</Link>
          <Link href="/posts">Post</Link>
          <Link href="/budgets">Anggaran</Link>
          <Link href="/reports">Laporan</Link>
          <Link href="/space">Ruang bersama</Link>
        </nav>
        <form action={signOut}>
          <button className="secondary-button signout-button" type="submit">Keluar</button>
        </form>
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-footer">Uangmu. Ruangmu. Rencanamu.</footer>
    </div>
  );
}
