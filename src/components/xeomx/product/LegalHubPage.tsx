import { Link } from "@tanstack/react-router";
import { Header } from "@/components/xeomx/Header";
import { m } from "@/paraglide/messages.js";

export function LegalHubPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10 text-start">
        <h1 className="text-3xl font-semibold">{m.footer_legal()}</h1>
        <nav className="mt-6 grid gap-3">
          <Link className="min-h-11 rounded-lg border p-3" to="/terms">
            {m.terms_title()}
          </Link>
          <Link className="min-h-11 rounded-lg border p-3" to="/privacy">
            {m.privacy_title()}
          </Link>
          <Link className="min-h-11 rounded-lg border p-3" to="/cookies">
            {m.cookies_title()}
          </Link>
          <Link className="min-h-11 rounded-lg border p-3" to="/refund-policy">
            {m.refund_title()}
          </Link>
        </nav>
      </main>
    </div>
  );
}
