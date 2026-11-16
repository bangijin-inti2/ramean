import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile-form";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;
  if (authError || !userId) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name,timezone,default_currency")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw new Error("Profil belum dapat dimuat.");
  if (!profile) throw new Error("Data profil akun tidak tersedia.");

  return (
    <div className="profile-page">
      <header className="profile-heading">
        <p className="eyebrow">Akun</p>
        <h1>Profil</h1>
        <p className="muted">Kelola nama tampilan dan zona waktu akunmu.</p>
      </header>
      <ProfileForm
        defaultCurrency={profile.default_currency}
        displayName={profile.display_name ?? ""}
        email={typeof authData.claims.email === "string" ? authData.claims.email : ""}
        timezone={profile.timezone}
      />
    </div>
  );
}
