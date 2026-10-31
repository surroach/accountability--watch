import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useLocation,
} from "@tanstack/react-router";
import { useEffect, useState, useRef, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { Menu, X } from "lucide-react";

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
          className="mt-6 inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  
  useEffect(() => {
    // Focus on the error message for screen readers
    const elem = document.getElementById('error-heading');
    if (elem) {
      elem.focus();
    }
  }, [error]);
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 
          id="error-heading"
          className="text-xl font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink rounded px-2 py-1"
          tabIndex={-1}
          role="alert"
        >
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Please try again or head back home.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-full border border-border px-4 py-2 text-sm transition-colors duration-200 hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "Accountability Watch — Prototype documentation platform" },
        {
          name: "description",
          content:
            "Accountability Watch is a prototype platform exploring how technology can document alleged police misconduct. This is a design and research tool, not a formal complaint system or emergency service.",
        },
        { property: "og:title", content: "Accountability Watch" },
        {
          property: "og:description",
          content:
            "A prototype platform for documenting allegations. Not a formal complaint system, emergency response, or a substitute for contacting authorities directly.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Accountability Watch" },
        {
          name: "twitter:description",
          content:
            "Prototype platform for documenting allegations. See the Resources page for legal aid and support.",
        },
        { property: "og:url", content: "https://accountability.watch" },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
        { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossOrigin: "anonymous",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap",
        },
      ],
    }),
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: NotFoundComponent,
    errorComponent: ErrorComponent,
  },
);

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Handle authentication state safely
  useEffect(() => {
    let mounted = true;
    
    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setIsAdmin(!!data.session);
    });
    
    // Listen for auth changes
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (mounted) setIsAdmin(!!session);
    });
    
    // Cleanup: only unsubscribe if subscription exists and has the method
    return () => {
      mounted = false;
      if (sub?.subscription && typeof sub.subscription.unsubscribe === 'function') {
        sub.subscription.unsubscribe();
      }
    };
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close menu when Escape key is pressed
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    
    if (mobileMenuOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [mobileMenuOpen]);

  const isActive = (path: string) => location.pathname === path;
  
  const navLinks = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/resources", label: "Resources" },
    { to: "/about", label: "About" },
    ...(isAdmin ? [{ to: "/admin", label: "Staff area" }] : [{ to: "/auth", label: "Sign in" }]),
  ];

  const handleMenuClose = () => {
    setMobileMenuOpen(false);
    menuButtonRef.current?.focus();
  };

  return (
    <header className="w-full border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-40" role="banner" aria-label="Site header">
      {/* Skip to main content link */}
      <a 
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-5 focus:rounded-lg focus:bg-ink focus:text-ink-foreground focus:px-4 focus:py-2.5 focus:z-50 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-ink"
      >
        Skip to main content
      </a>

      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-5 py-4 gap-2 sm:gap-0">
        {/* Logo */}
        <Link 
          to="/" 
          className="flex items-center gap-2 flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink rounded-lg"
          aria-label="Accountability Watch home"
        >
          <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-xl bg-ink text-ink-foreground" aria-hidden="true">
            <span className="font-display text-sm font-bold">AW</span>
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-lime" />
          </span>
          <span className="font-display text-sm sm:text-base font-bold tracking-tight hidden sm:inline">
            accountability<span className="text-muted-foreground">/</span>watch
          </span>
        </Link>
        
        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-5 md:flex flex-1" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`font-display text-sm transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink rounded px-2 py-1 ${
                isActive(link.to)
                  ? "text-foreground font-semibold border-b-2 border-ink"
                  : "text-foreground/80 hover:text-foreground"
              }`}
              aria-current={isActive(link.to) ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Mobile Menu Button */}
        <button
          ref={menuButtonRef}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden rounded-lg p-2 hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink transition-colors duration-200 flex-shrink-0"
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" aria-hidden="true" />
          )}
        </button>

        {/* Desktop Report Button */}
        <Link
          to="/report"
          className="hidden md:inline-flex items-center rounded-full border-2 border-ink px-4 py-2 font-display text-sm font-semibold transition-colors duration-200 hover:bg-lime focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink flex-shrink-0"
          aria-label="File an incident report"
        >
          Report now →
        </Link>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <nav 
          ref={menuRef}
          id="mobile-menu"
          className="md:hidden border-t border-border/60 bg-card"
          aria-label="Mobile navigation"
          role="navigation"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-5 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => handleMenuClose()}
                className={`block rounded-lg px-4 py-2.5 font-display text-sm transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink ${
                  isActive(link.to)
                    ? "bg-muted text-foreground font-semibold border-l-2 border-ink"
                    : "text-foreground/80 hover:bg-muted/50"
                }`}
                aria-current={isActive(link.to) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/report"
              onClick={() => handleMenuClose()}
              className="block w-full mt-4 rounded-full bg-ink px-4 py-2.5 text-center font-display text-sm font-semibold text-ink-foreground transition-all duration-200 hover:bg-ink/90 hover:shadow-md active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              File an incident report
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="border-t border-border/60 mt-20 sm:mt-24" role="contentinfo" aria-label="Site footer">
      <div className="mx-auto max-w-6xl px-4 sm:px-5 py-8 sm:py-12 text-sm text-muted-foreground">
        <div className="grid gap-6 sm:gap-8 md:grid-cols-4 mb-6 sm:mb-8">
          {/* About */}
          <div>
            <h3 className="font-display font-bold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">About</h3>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <Link 
                  to="/about" 
                  className="text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink rounded px-1 py-0.5 inline-block transition-colors duration-200"
                >
                  How it works
                </Link>
              </li>
              <li>
                <Link 
                  to="/dashboard" 
                  className="text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink rounded px-1 py-0.5 inline-block transition-colors duration-200"
                >
                  Public data
                </Link>
              </li>
              <li>
                <Link 
                  to="/transparency" 
                  className="text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink rounded px-1 py-0.5 inline-block transition-colors duration-200"
                >
                  Transparency
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-display font-bold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">Resources</h3>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <Link 
                  to="/resources" 
                  className="text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink rounded px-1 py-0.5 inline-block transition-colors duration-200"
                >
                  Get support
                </Link>
              </li>
              <li>
                <a 
                  href="https://en.wikipedia.org/wiki/Police_brutality" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink rounded px-1 py-0.5 inline-block transition-colors duration-200"
                >
                  Learn more
                </a>
              </li>
              <li>
                <a 
                  href="https://github.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink rounded px-1 py-0.5 inline-block transition-colors duration-200"
                >
                  Source code
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-display font-bold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">Legal</h3>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <Link 
                  to="/terms" 
                  className="text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink rounded px-1 py-0.5 inline-block transition-colors duration-200"
                >
                  Terms of service
                </Link>
              </li>
              <li>
                <a 
                  href="#"
                  className="text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink rounded px-1 py-0.5 inline-block transition-colors duration-200"
                >
                  Privacy policy
                </a>
              </li>
              <li>
                <a 
                  href="#"
                  className="text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink rounded px-1 py-0.5 inline-block transition-colors duration-200"
                >
                  Security
                </a>
              </li>
            </ul>
          </div>

          {/* Partners */}
          <div>
            <h3 className="font-display font-bold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">Project note</h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              This is a prototype platform for documenting incidents. Reports are handled with care and shared only with authenticated legal partners.
            </p>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="border-t border-border/60 pt-6 sm:pt-8 flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-xs">
            © {currentYear} Accountability Watch.
          </p>
          <p className="text-xs max-w-sm leading-relaxed">
            Officer names, photos, and badge numbers are not published. Individual case details are shared only with verified legal aid partners.
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
        <main id="main-content" className="flex-1" role="main" aria-label="Main content">
          <Outlet />
        </main>
        <Footer />
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}
