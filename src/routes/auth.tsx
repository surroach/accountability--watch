import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Partner sign in — Accountability Watch" },
      {
        name: "description",
        content: "Sign in for verified legal aid partners and platform admins.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // getUser() validates the JWT against Supabase Auth rather than just
    // reading from localStorage.  This prevents a tampered or expired token
    // stored in localStorage from silently bypassing the login screen.
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/admin" });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/admin" },
        });
        if (error) throw error;
        toast.success(
          "Account created. Check your email if confirmation is required.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate({ to: "/admin" });
      }
    } catch (err: any) {
      const errorMsg = err?.message ?? "Authentication failed";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        const errorMsg = result.error.message ?? "Google sign-in failed";
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/admin" });
    } catch (err: any) {
      const errorMsg = err?.message ?? "Google sign-in failed";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-5 py-12">
      <div className="card-white w-full p-8">
        <p className="font-display text-xs uppercase tracking-widest">
          <span className="highlight-lime">Partner access</span>
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          For vetted legal aid partners and platform administrators only.
        </p>

        {/* I7: Note about authentication context */}
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-900">
            <strong>Note:</strong> This is a prototype platform. Staff access is controlled by authentication, but production security depends on proper backend configuration.
          </p>
        </div>

        <button
          onClick={signInWithGoogle}
          disabled={busy}
          type="button"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink py-2.5 font-display text-sm font-semibold transition-colors duration-200 hover:bg-lime disabled:opacity-50 disabled:cursor-not-allowed"
          aria-busy={busy}
        >
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        {/* I4: Accessible error display */}
        {error && (
          <div
            className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-3"
            role="alert"
            aria-live="polite"
            aria-atomic="true"
          >
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-destructive">
                {error}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            {/* I1: Label associated with input via htmlFor */}
            <Label htmlFor="email" className="font-display text-xs">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              aria-describedby={error ? "error-message" : undefined}
              autoComplete={mode === "signin" ? "email" : "email"}
            />
          </div>
          <div>
            {/* I1: Label associated with input via htmlFor */}
            <Label htmlFor="password" className="font-display text-xs">
              Password
            </Label>
            {/* I3: Password visibility toggle */}
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                aria-describedby={error ? "error-message" : undefined}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={busy}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <Button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-ink py-6 font-display font-semibold text-ink-foreground transition-all duration-200 hover:bg-ink/90 hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-busy={busy}
          >
            {busy
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New here?" : "Have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            className="underline"
          >
            {mode === "signin" ? "Create account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
