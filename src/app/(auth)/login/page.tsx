import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Masuk",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div className="auth-brand">
          <Image
            src="/ramean-logo-dark.svg"
            alt="Ramean"
            width={280}
            height={88}
            className="auth-logo"
            priority
          />
          <p className="eyebrow">Secure access</p>
          <h1>Masuk ke Ramean.</h1>
          <p className="muted">Kelola uang dan rencanamu dalam satu tempat.</p>
        </div>
        <LoginForm callbackError={error === "callback"} />
      </section>
    </main>
  );
}
