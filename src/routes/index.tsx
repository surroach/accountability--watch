import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Shield,
  Lock,
  Scale,
  FileText,
  MapPin,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title:
          "Accountability Watch — Document alleged police misconduct at protests",
      },
      {
        name: "description",
        content:
          "A civic accountability platform for documenting alleged police misconduct at protests. Private by default. Shared with legal aid. Anonymized publicly.",
      },
      { property: "og:title", content: "Accountability Watch" },
      {
        property: "og:description",
        content:
          "Document alleged police misconduct at protests. Private by default. Shared with legal aid. Anonymized publicly.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-5">
      {/* Hero — single primary action, nothing competing above the fold */}
      <section className="py-8 sm:py-14 md:py-20 text-center" aria-labelledby="hero-heading">
        <p className="mb-3 sm:mb-5 inline-block font-display text-xs uppercase tracking-widest">
          <span className="highlight-lime">Civil-rights accountability</span>
        </p>
        <h1 
          id="hero-heading"
          className="mx-auto max-w-3xl font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.05] break-words"
        >
          Document what happened.
          <br />
          <span className="text-muted-foreground">Protect who reports it.</span>
        </h1>
        <p className="mx-auto mt-4 sm:mt-6 max-w-xl text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed">
          A private, timestamped record of alleged police misconduct at protests
          — for legal aid, civil-rights groups, and journalists working in
          aggregate. Not for public identification.
        </p>

        {/* Single unmistakable primary CTA */}
        <div className="mt-8 sm:mt-10">
          <Link
            to="/report"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 sm:px-8 py-3 sm:py-4 font-display text-sm sm:text-base font-semibold text-ink-foreground transition-all duration-200 hover:bg-ink/90 hover:shadow-md active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            aria-label="File an incident report"
          >
            Report an incident <ArrowRight className="h-4 sm:h-5 w-4 sm:w-5" aria-hidden="true" />
          </Link>
          <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-muted-foreground">
            A guided four-step form. Anonymous by default. No account required.
          </p>
        </div>

        {/* Secondary navigation — below the fold trigger, visually quiet */}
        <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5">
          <Link
            to="/saved-reports"
            className="font-display text-xs sm:text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink rounded px-2 py-1 transition-colors duration-200"
          >
            View your reports
          </Link>
          <span className="hidden sm:inline text-border" aria-hidden="true">
            ·
          </span>
          <Link
            to="/dashboard"
            className="font-display text-xs sm:text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink rounded px-2 py-1 transition-colors duration-200"
          >
            View public data
          </Link>
          <span className="hidden sm:inline text-border" aria-hidden="true">
            ·
          </span>
          <Link
            to="/about"
            className="font-display text-xs sm:text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink rounded px-2 py-1 transition-colors duration-200"
          >
            How this works
          </Link>
        </div>

        {/* Partner strip */}
        <div className="mt-8 sm:mt-12 border-y border-border/60 py-4 sm:py-5">
          <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">
            Working with legal aid & civil-rights partners
          </p>
          <div className="mt-2 sm:mt-3 flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-8 gap-y-2 font-display text-xs sm:text-sm text-muted-foreground/80">
            <span>PUCL</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span>HRLN</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span>Amnesty</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span>CPA</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span>SHRC</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span>Legal Aid Network</span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-8 sm:py-12 md:py-14" aria-labelledby="how-it-works-heading">
        <div className="mb-8 sm:mb-10 text-center">
          <p className="font-display text-xs uppercase tracking-widest">
            <span className="highlight-lime">How it works</span>
          </p>
          <h2 
            id="how-it-works-heading"
            className="mt-2 sm:mt-3 font-display text-2xl sm:text-3xl md:text-4xl font-bold leading-snug"
          >
            Four steps to document and share.
          </h2>
        </div>

        <div className="grid gap-4 sm:gap-5 md:gap-6 md:grid-cols-2">
          <FeatureCard
            variant="white"
            icon={<FileText className="h-5 sm:h-6 w-5 sm:w-6" aria-hidden="true" />}
            step="01"
            title="Submit a report"
            body="Date, place, description, and any photos or video. Anonymously if you choose. No account required."
          />
          <FeatureCard
            variant="ink"
            icon={<Lock className="h-5 sm:h-6 w-5 sm:w-6" aria-hidden="true" />}
            step="02"
            title="Designed to preserve evidence"
            body="Every file gets a SHA-256 hash and a timestamped report ID. This creates a record tamper-evident from submission."
          />
          <FeatureCard
            variant="ink"
            icon={<Scale className="h-5 sm:h-6 w-5 sm:w-6" aria-hidden="true" />}
            step="03"
            title="Accessible to legal partners"
            body="Vetted human-rights lawyers and complaints authorities can request access through a sign-in portal."
          />
          <FeatureCard
            variant="white"
            icon={<Shield className="h-5 sm:h-6 w-5 sm:w-6" aria-hidden="true" />}
            step="04"
            title="Aggregated public view"
            body="Public dashboards show incident counts by city and date. Officer names, photos, and badge numbers are never published."
          />
        </div>
      </section>

      {/* Boundaries */}
      <section className="my-8 sm:my-10 md:my-12 rounded-2xl sm:rounded-3xl md:rounded-4xl border-2 border-ink bg-lime p-5 sm:p-8 md:p-12" aria-labelledby="boundaries-heading">
        <p className="font-display text-xs uppercase tracking-widest">
          <span className="rounded-md bg-ink px-2 py-1 text-ink-foreground">
            Our boundaries
          </span>
        </p>
        <h2 
          id="boundaries-heading"
          className="mt-4 sm:mt-6 font-display text-xl sm:text-2xl md:text-3xl font-bold mb-5 sm:mb-6"
        >
          What this is not
        </h2>
        <div className="grid gap-4 sm:gap-5 md:gap-6 md:grid-cols-3">
          <Boundary title="Not a face database">
            We never match uploads against face or officer registries.
          </Boundary>
          <Boundary title="Not public naming">
            Officer names, badge numbers, and photos are never displayed
            publicly.
          </Boundary>
          <Boundary title="Not vigilante action">
            This is a legal-aid pipeline, not a doxxing tool. We reject any use
            for retaliation.
          </Boundary>
        </div>
      </section>

      {/* Public / private split */}
      <section className="grid gap-5 sm:gap-6 py-8 sm:py-10 md:py-12 md:grid-cols-2" aria-labelledby="access-heading">
        <h2 id="access-heading" className="sr-only">Access options</h2>
        <div className="card-white p-6 sm:p-8">
          <div className="mb-4 inline-flex h-10 sm:h-11 w-10 sm:w-11 items-center justify-center rounded-2xl bg-lime" aria-hidden="true">
            <MapPin className="h-5 w-5" />
          </div>
          <h3 className="font-display text-lg sm:text-xl font-bold">Public dashboard</h3>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Anonymized counts by location and date. Journalists and researchers
            can see patterns without exposing individuals — on either side of an
            incident.
          </p>
          <Link
            to="/dashboard"
            className="mt-4 sm:mt-5 inline-flex items-center gap-1 font-display text-xs sm:text-sm underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink rounded px-2 py-1 transition-colors duration-200"
          >
            View dashboard <ArrowRight className="h-3 sm:h-4 w-3 sm:w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="card-ink p-6 sm:p-8">
          <div className="mb-4 inline-flex h-10 sm:h-11 w-10 sm:w-11 items-center justify-center rounded-2xl bg-lime text-ink" aria-hidden="true">
            <Users className="h-5 w-5" />
          </div>
          <h3 className="font-display text-lg sm:text-xl font-bold">For legal partners</h3>
          <p className="mt-2 text-xs sm:text-sm text-white/70 leading-relaxed">
            Signed-in legal aid organisations can view full case detail, update
            status, and export data for referral. Access is logged.
          </p>
          <Link
            to="/auth"
            className="mt-4 sm:mt-5 inline-flex items-center gap-1 font-display text-xs sm:text-sm text-lime underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime rounded px-2 py-1 transition-colors duration-200"
          >
            Partner sign-in <ArrowRight className="h-3 sm:h-4 w-3 sm:w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* Bottom CTA — reinforces the top without adding noise */}
      <section className="my-8 sm:my-12 md:my-16 text-center" aria-labelledby="cta-heading">
        <h2 
          id="cta-heading"
          className="font-display text-2xl sm:text-3xl md:text-4xl font-bold leading-snug"
        >
          Have something to <span className="highlight-lime">report?</span>
        </h2>
        <p className="mx-auto mt-3 sm:mt-4 max-w-lg text-xs sm:text-sm text-muted-foreground leading-relaxed px-2">
          A four-step guided form. Choose what to share and whether to leave contact info.
        </p>
        <Link
          to="/report"
          className="mt-6 sm:mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 sm:px-8 py-3 sm:py-4 font-display text-sm sm:text-base font-semibold text-ink-foreground transition-all duration-200 hover:bg-ink/90 hover:shadow-md active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          aria-label="File an incident report"
        >
          Report an incident <ArrowRight className="h-4 sm:h-5 w-4 sm:w-5" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}

function FeatureCard({
  variant,
  icon,
  step,
  title,
  body,
}: {
  variant: "white" | "ink";
  icon: React.ReactNode;
  step: string;
  title: string;
  body: string;
}) {
  const isInk = variant === "ink";
  return (
    <div className={`${isInk ? "card-ink" : "card-white"} p-5 sm:p-6 md:p-8`}>
      <div className="flex items-start justify-between gap-3">
        <div
          className={`inline-flex h-10 sm:h-11 md:h-12 w-10 sm:w-11 md:w-12 items-center justify-center rounded-2xl flex-shrink-0 ${isInk ? "bg-lime text-ink" : "bg-ink text-ink-foreground"}`}
        >
          {icon}
        </div>
        <span
          className={`font-display text-xs flex-shrink-0 ${isInk ? "text-white/50" : "text-muted-foreground"}`}
        >
          {step}
        </span>
      </div>
      <h3 className="mt-4 sm:mt-5 md:mt-6 font-display text-base sm:text-lg md:text-xl font-bold">{title}</h3>
      <p
        className={`mt-2 text-xs sm:text-sm leading-relaxed ${isInk ? "text-white/70" : "text-muted-foreground"}`}
      >
        {body}
      </p>
    </div>
  );
}

function Boundary({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border-2 border-ink bg-background p-4 sm:p-5">
      <h4 className="font-display text-sm sm:text-base font-bold">{title}</h4>
      <p className="mt-2 text-xs sm:text-sm leading-relaxed">{children}</p>
    </div>
  );
}
