import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Accountability Watch" },
      {
        name: "description",
        content:
          "What Accountability Watch is, what it isn't, and why we handle reports the way we do.",
      },
      { property: "og:title", content: "About — Accountability Watch" },
      {
        property: "og:description",
        content:
          "A civic-tech accountability platform for legal aid partners, journalists, and researchers.",
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
          Accountability Watch is a documentation platform for allegations of
          police misconduct during protests. We built it for a narrow purpose:
          to help lawyers, complaint authorities, and civil-rights researchers
          do their work — nothing more.
        </p>

        <h2 className="pt-4 font-display text-2xl font-bold">
          How reports move
        </h2>
        <p>
          A report enters the system with a timestamp and a SHA-256 hash of
          every uploaded file. It is stored privately. Vetted legal aid partners
          with sign-in access can review, update status, and export cases for
          referral. The public sees only aggregate counts — never names, badges,
          photos, or case detail.
        </p>

        <h2 className="pt-4 font-display text-2xl font-bold">
          What this is not
        </h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>Not a face-matching or officer-identification tool.</li>
          <li>Not a public database of officer names or badge numbers.</li>
          <li>Not a mechanism for retaliation or public shaming.</li>
          <li>Not a substitute for filing a formal complaint or FIR.</li>
        </ul>

        <h2 className="pt-4 font-display text-2xl font-bold">Data & consent</h2>
        <p>
          Reports are submitted with an explicit consent statement. Reporter
          contact information is used only for legal follow-up — never public.
          Reports may be shared, in aggregate/anonymized form, with journalists
          and civil-rights groups researching patterns.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/report"
            className="rounded-full bg-ink px-6 py-3 font-display text-sm font-semibold text-ink-foreground"
          >
            File a report
          </Link>
          <Link
            to="/resources"
            className="rounded-full border-2 border-ink px-6 py-3 font-display text-sm font-semibold"
          >
            Get help
          </Link>
        </div>
      </div>
    </div>
  );
}
