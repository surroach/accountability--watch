import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page couldn't be found.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Please try again or head back home.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
          >Try again</button>
          <a href="/" className="rounded-full border border-border px-4 py-2 text-sm">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Accountability Watch — Document alleged police misconduct" },
      { name: "description", content: "A civic-tech platform to document alleged police misconduct during protests. Reports are shared privately with legal aid; public data is aggregated and anonymized." },
      { property: "og:title", content: "Accountability Watch" },
      { property: "og:description", content: "Document alleged police misconduct during protests. Private by default, shared with legal aid, anonymized publicly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Accountability Watch" },
      { name: "twitter:description", content: "Document alleged police misconduct during protests. Private by default, shared with legal aid, anonymized publicly." },
      { property: "og:url", content: "https://accountability.watch" },
      { property: "og:image", content: "https://accountability.watch/og-image.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Header() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setIsAdmin(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (mounted) setIsAdmin(!!session);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  return (
    <header className="w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-xl bg-ink text-ink-foreground">
            <span className="font-display text-sm font-bold">AW</span>
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-lime" />
          </span>
          <span className="font-display text-base font-bold tracking-tight">
            accountability<span className="text-muted-foreground">/</span>watch
          </span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          <Link to="/dashboard" className="font-display text-sm text-foreground/80 hover:text-foreground">Dashboard</Link>
          <Link to="/resources" className="font-display text-sm text-foreground/80 hover:text-foreground">Resources</Link>
          <Link to="/about" className="font-display text-sm text-foreground/80 hover:text-foreground">About</Link>
          {isAdmin ? (
            <Link to="/admin" className="font-display text-sm text-foreground/80 hover:text-foreground">Admin</Link>
          ) : (
            <Link to="/auth" className="font-display text-sm text-foreground/80 hover:text-foreground">Sign in</Link>
          )}
        </nav>
        <Link
          to="/report"
          className="inline-flex items-center rounded-full border-2 border-ink px-4 py-2 font-display text-sm font-semibold hover:bg-lime"
        >
          Report now →
        </Link>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 mt-24">
      <div className="mx-auto max-w-6xl px-5 py-10 text-sm text-muted-foreground">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Accountability Watch. Reports handled in confidence.</p>
          <p className="max-w-md text-xs">
            This platform does not publish officer names, photos, or badge numbers. Individual case details are shared only with vetted legal aid partners.
          </p>
        </div>
      </div>
    </footer>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}
