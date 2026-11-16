import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";
import "./app.css";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");

  const [{ data: contextRows, error: contextsError }, { data: profile, error: profileError }] =
    await Promise.all([
      supabase
        .from("financial_contexts")
        .select("id,name,context_type,space_kind")
        .order("created_at")
        .order("id"),
      supabase.from("profiles").select("display_name").eq("id", data.claims.sub).maybeSingle(),
    ]);

  if (contextsError) throw new Error("Ruang keuangan belum dapat dimuat.");
  if (profileError) throw new Error("Profil belum dapat dimuat.");

  const contexts = contextRows ?? [];
  const userLabel = profile?.display_name ||
    (typeof data.claims.email === "string" ? data.claims.email : "Pengguna");

  return (
    <div className="app-shell">
      <AppSidebar contexts={contexts} userLabel={userLabel} />
      <div className="app-content">
        <main className="app-main">{children}</main>
        <footer className="app-footer">Uangmu. Ruangmu. Rencanamu.</footer>
      </div>
    </div>
  );
}
