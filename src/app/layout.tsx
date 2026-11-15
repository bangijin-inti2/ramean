import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Ramean",
    template: "%s | Ramean",
  },
  description: "Kelola uang dan rencanamu dalam satu tempat.",
  icons: {
    icon: "/ramean-icon.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
