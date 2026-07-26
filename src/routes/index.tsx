import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Shield, Lock, Scale, FileText, MapPin, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Accountability Watch — Document alleged police misconduct at protests" },
      { name: "description", content: "A civic accountability platform for documenting alleged police misconduct at protests. Private by default. Shared with legal aid. Anonymized publicly." },
      { property: "og:title", content: "Accountability Watch" },
      { property: "og:description", content: "Document alleged police misconduct at protests. Private by default. Shared with legal aid. Anonymized publicly." },
    ],
  }),
  component: Home,
});

function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2 2-8z" fill="currentColor" />
    </svg>
  );
}

function Home() {
  return (
    <div className="mx-auto max-w-6xl px-5">
      {/* Hero */}
      <section className="relative py-16 md:py-24 text-center">
        <Sparkle className="absolute left-6 top-10 h-5 w-5 text-lime" />
        <Sparkle className="absolute right-10 top-24 h-4 w-4 text-lime" />
        <span className="absolute right-20 top-8 h-2 w-2 rounded-full bg-ink" />
        <span className="absolute left-16 bottom-8 h-2 w-2 rounded-full bg-ink" />

        <p className="mb-5 inline-block font-display text-xs uppercase tracking-widest">
          <span className="highlight-lime">Civil-rights accountability</span>
        </p>
        <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-[1.05] md:text-6xl">
          Document what happened.<br />
          <span className="text-muted-foreground">Protect who reports it.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
          A private, timestamped record of alleged police misconduct at protests — for legal aid,
          civil-rights groups, and journalists working in aggregate. Not for public identification.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/report"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 font-display text-sm font-semibold text-ink-foreground hover:opacity-90"
          >
            File a report <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border-2 border-ink px-6 py-3 font-display text-sm font-semibold hover:bg-lime"
          >
            See public data
          </Link>
        </div>

        {/* Partner strip */}
        <div className="mt-14 border-y border-border/60 py-6">
          <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">
            Working with legal aid & civil-rights partners
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 font-display text-sm text-muted-foreground/80">
            <span>PUCL</span>
            <span>·</span>
            <span>HRLN</span>
            <span>·</span>
            <span>Amnesty</span>
            <span>·</span>
            <span>CPA</span>
            <span>·</span>
            <span>SHRC</span>
            <span>·</span>
            <span>Legal Aid Network</span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16">
        <div className="mb-10 text-center">
          <p className="font-display text-xs uppercase tracking-widest">
            <span className="highlight-lime">How it works</span>
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold md:text-4xl">
            Three steps. Chain-of-custody by default.
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <FeatureCard
            variant="white"
            icon={<FileText className="h-6 w-6" />}
            step="01"
            title="Submit a report"
            body="Date, place, description, and any photos or video. Anonymously if you choose. No account required."
          />
          <FeatureCard
            variant="ink"
            icon={<Lock className="h-6 w-6" />}
            step="02"
            title="Sealed & hashed"
            body="Every file gets a SHA-256 hash and a timestamped report ID — tamper-evident from the moment you submit."
          />
          <FeatureCard
            variant="ink"
            icon={<Scale className="h-6 w-6" />}
            step="03"
            title="Routed to legal aid"
            body="Vetted human-rights lawyers and complaints authorities can request access. Nothing is published publicly."
          />
          <FeatureCard
            variant="white"
            icon={<Shield className="h-6 w-6" />}
            step="04"
            title="Aggregated for the public"
            body="Public dashboards show counts by city and date — never officer names, photos, or badge numbers."
          />
        </div>
      </section>

      {/* Boundaries */}
      <section className="my-12 rounded-4xl border-2 border-ink bg-lime p-8 md:p-12">
        <p className="font-display text-xs uppercase tracking-widest">
          <span className="rounded-md bg-ink px-2 py-1 text-ink-foreground">Our boundaries</span>
        </p>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <Boundary title="Not a face database">
            We never match uploads against face or officer registries.
          </Boundary>
          <Boundary title="Not public naming">
            Officer names, badge numbers, and photos are never displayed publicly.
          </Boundary>
          <Boundary title="Not vigilante action">
            This is a legal-aid pipeline, not a doxxing tool. We reject any use for retaliation.
          </Boundary>
        </div>
      </section>

      {/* Public / private split */}
      <section className="grid gap-6 py-10 md:grid-cols-2">
        <div className="card-white p-8">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-lime">
            <MapPin className="h-5 w-5" />
          </div>
          <h3 className="font-display text-xl font-bold">Public dashboard</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Anonymized counts by location and date. Journalists and researchers can see patterns
            without exposing individuals — on either side of an incident.
          </p>
          <Link to="/dashboard" className="mt-5 inline-flex items-center gap-1 font-display text-sm underline">
            View dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="card-ink p-8">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-lime text-ink">
            <Users className="h-5 w-5" />
          </div>
          <h3 className="font-display text-xl font-bold">For legal partners</h3>
          <p className="mt-2 text-sm text-white/70">
            Signed-in legal aid organisations can view full case detail, update status, and export
            data for referral. Access is logged and auditable.
          </p>
          <Link to="/auth" className="mt-5 inline-flex items-center gap-1 font-display text-sm text-lime underline">
            Partner sign-in <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="my-16 text-center">
        <h2 className="font-display text-3xl font-bold md:text-4xl">
          Have something to <span className="highlight-lime">report?</span>
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
          Takes about 3 minutes. You choose what to share and whether to leave contact info.
        </p>
        <Link
          to="/report"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3 font-display font-semibold text-ink-foreground hover:opacity-90"
        >
          File a report <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}

function FeatureCard({
  variant, icon, step, title, body,
}: {
  variant: "white" | "ink";
  icon: React.ReactNode;
  step: string;
  title: string;
  body: string;
}) {
  const isInk = variant === "ink";
  return (
    <div className={`${isInk ? "card-ink" : "card-white"} p-8 md:p-10`}>
      <div className="flex items-start justify-between">
        <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${isInk ? "bg-lime text-ink" : "bg-ink text-ink-foreground"}`}>
          {icon}
        </div>
        <span className={`font-display text-xs ${isInk ? "text-white/50" : "text-muted-foreground"}`}>{step}</span>
      </div>
      <h3 className="mt-6 font-display text-xl font-bold">{title}</h3>
      <p className={`mt-2 text-sm ${isInk ? "text-white/70" : "text-muted-foreground"}`}>{body}</p>
    </div>
  );
}

function Boundary({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-ink bg-background p-5">
      <h4 className="font-display text-base font-bold">{title}</h4>
      <p className="mt-2 text-sm">{children}</p>
    </div>
  );
}
