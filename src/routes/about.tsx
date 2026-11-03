import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Accountability Watch" },
      {
        name: "description",
        content:
          "Accountability Watch is a prototype platform for documenting police misconduct allegations. This is a design tool, not an emergency service or formal complaint system.",
      },
      { property: "og:title", content: "About — Accountability Watch" },
      {
        property: "og:description",
        content:
          "A prototype platform for documenting allegations. Not a formal complaint system or emergency response.",
      },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="mb-3 font-display text-xs uppercase tracking-widest">
        <span className="highlight-lime">About</span>
      </p>
      <h1 className="font-display text-4xl font-bold md:text-5xl">
        Accountability, not vigilantism.
      </h1>

      <div className="mt-8 space-y-6 text-base leading-relaxed">
        <p>
          Accountability Watch is a prototype platform for documenting allegations of
          police misconduct during protests. This is a design and research tool built to explore
          how technology can assist lawyers, complaint authorities, and civil-rights researchers —
          nothing more.
        </p>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 my-6">
          <p className="text-sm text-amber-900">
            <strong>Important:</strong> This is a prototype. It does not file formal complaints (FIR), replace official
            reporting channels, or provide emergency response. Reports submitted here are not automatically
            filed with authorities or routed to legal aid without your explicit separate action.
          </p>
        </div>

        <h2 className="pt-4 font-display text-2xl font-bold">
          How reports are handled (prototype design)
        </h2>
        <p>
          In this prototype design, a report enters the system with a timestamp and file hashes
          for integrity tracking. The design intends for reports to be viewable by administrators and,
          if enabled, shared with partner organizations. The public dashboard displays only
          anonymized aggregate counts — never names, badges, photos, or individual case details.
        </p>
        <p className="text-sm text-muted-foreground">
          <em>Note: This is a prototype. Actual data handling, partner access, and legal routing depend on backend
          configuration and have not yet been verified in production.</em>
        </p>

        <h2 className="pt-4 font-display text-2xl font-bold">
          What this is not
        </h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>Not a face-matching or officer-identification tool.</li>
          <li>Not a public database of officer names or badge numbers.</li>
          <li>Not a mechanism for retaliation or public shaming.</li>
          <li>Not a formal complaint system or FIR filing tool.</li>
          <li>Not an emergency response service.</li>
          <li>Not a substitute for contacting authorities directly.</li>
        </ul>

        <h2 className="pt-4 font-display text-2xl font-bold">Data & consent</h2>
        <p>
          In this prototype, reports are submitted with a consent statement. The design shows
          an option to submit anonymously or with contact info. The prototype does not automatically
          share reports with legal partners—that integration is planned but not yet implemented.
        </p>
        <p className="text-sm text-muted-foreground">
          Reporters should not assume their report will reach anyone without taking additional steps
          to contact authorities or legal aid organizations directly.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/report"
            className="rounded-full bg-ink px-6 py-3 font-display text-sm font-semibold text-ink-foreground transition-all duration-200 hover:bg-ink/90 hover:shadow-md active:scale-95"
          >
            File a report
          </Link>
          <Link
            to="/resources"
            className="rounded-full border-2 border-ink px-6 py-3 font-display text-sm font-semibold transition-colors duration-200 hover:bg-lime"
          >
            Get help
          </Link>
        </div>
      </div>
    </div>
  );
}
