import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Nuru ya Afya", template: "%s · Nuru ya Afya" },
  description: "Le crédit de proximité entre les pharmacies de quartier et leurs prêteurs : suivi des commandes, plafonds et remboursements.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#168063" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
