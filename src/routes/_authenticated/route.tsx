import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  // ssr: false is required — getUser() calls Supabase Auth which needs a
  // browser session; running on the server would always fail.
  ssr: false,
  beforeLoad: async () => {
    // getUser() makes a live round-trip to Supabase Auth to validate the JWT.
    // This is intentional: it catches expired or revoked tokens that
    // getSession() (which only reads localStorage) would silently accept.
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Secondary gate: confirm the authenticated user holds at least one
    // privileged role before rendering any protected UI.  Without this, a
    // freshly signed-up user (who has a valid JWT but no row in user_roles)
    // reaches the admin page and sees the "Access pending" screen — which is
    // correct UX, but it means the page component still mounts and fires a
    // full DB query.  Checking here prevents that entirely.
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);

    const hasPrivilegedRole = (roles ?? []).some(
      (r) => r.role === "admin" || r.role === "legal_partner",
    );

    if (!hasPrivilegedRole) {
      // Keep the redirect target as /auth so the URL doesn't leak that /admin
      // exists.  The auth page will show the sign-in form again; users who
      // need access should contact a platform admin to be granted a role.
      throw redirect({ to: "/auth" });
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
