import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AlloReserve — Inventory Reservation System",
  description:
    "Temporary stock reservation system for multi-warehouse e-commerce. Prevents overselling under concurrent checkout with database-level pessimistic locking.",
  keywords: [
    "inventory",
    "reservation",
    "stock management",
    "e-commerce",
    "concurrency",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <nav className="navbar">
          <div className="navbar-inner">
            <Link href="/" className="navbar-brand">
              <span className="navbar-logo">◈</span>
              <span className="navbar-title">AlloReserve</span>
            </Link>
            <span className="navbar-tagline">
              Inventory Reservation System
            </span>
          </div>
        </nav>
        <main className="main-content">{children}</main>
        <style>{`
          .navbar {
            position: sticky;
            top: 0;
            z-index: 50;
            background: rgba(10, 10, 15, 0.8);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          }
          .navbar-inner {
            max-width: 1200px;
            margin: 0 auto;
            padding: 16px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .navbar-brand {
            display: flex;
            align-items: center;
            gap: 10px;
            text-decoration: none;
            color: var(--color-text-primary);
          }
          .navbar-logo {
            font-size: 1.5rem;
            color: var(--color-accent);
            filter: drop-shadow(0 0 8px var(--color-accent-glow));
          }
          .navbar-title {
            font-family: var(--font-display);
            font-size: 1.25rem;
            font-weight: 700;
            letter-spacing: -0.025em;
          }
          .navbar-tagline {
            font-size: 0.8rem;
            color: var(--color-text-muted);
            display: none;
          }
          @media (min-width: 640px) {
            .navbar-tagline {
              display: block;
            }
          }
          .main-content {
            position: relative;
            z-index: 1;
            max-width: 1200px;
            margin: 0 auto;
            padding: 32px 24px 64px;
          }
        `}</style>
      </body>
    </html>
  );
}
