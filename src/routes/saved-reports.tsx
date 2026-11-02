import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/saved-reports")({
  head: () => ({
    meta: [
      { title: "Saved reports — Accountability Watch" },
      {
        name: "description",
        content: "View reports you have submitted locally.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SavedReportsLayout,
});

export function SavedReportsLayout() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 sm:px-5 py-8 sm:py-10">
        <button
          onClick={() => navigate({ to: "/" })}
          className="mb-6 inline-flex items-center justify-center gap-2 rounded-full border-2 border-ink px-4 py-2 font-display text-sm font-semibold transition-colors duration-200 hover:bg-lime focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          aria-label="Go back to home"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>

        <Outlet />
      </div>
    </div>
  );
}
