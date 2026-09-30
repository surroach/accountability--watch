import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle, Shield, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/transparency")({
  head: () => ({
    meta: [
      { title: "Data Policy & Transparency — Accountability Watch" },
      {
        name: "description",
        content:
          "How Accountability Watch handles data, who accesses reports, and our anonymization practices.",
      },
      {
        property: "og:title",
        content: "Data Policy & Transparency — Accountability Watch",
      },
      {
        property: "og:description",
        content: "Data handling, retention, and access policies.",
      },
    ],
  }),
  component: TransparencyPage,
});

function TransparencyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <p className="mb-3 font-display text-xs uppercase tracking-widest">
        <span className="highlight-lime">Transparency</span>
      </p>
      <h1 className="font-display text-4xl font-bold">
        Data policy & anonymization
      </h1>
      <p className="mt-3 text-muted-foreground">
        We're committed to protecting reporter privacy while enabling civil
        rights accountability.
      </p>

      <div className="mt-12 space-y-10">
        <Section
          title="Verified partner organizations"
          content={
            <>
              <p className="mb-6 text-sm text-muted-foreground">
                Accountability Watch partners with established civil rights and
                legal aid organizations to ensure reports reach trained
                advocates and lawyers. These organizations are verified partners
                committed to protecting reporter privacy and supporting civil
                rights.
              </p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <PartnerCard
                  name="National Civil Rights Alliance"
                  description="Civil rights advocacy and legal support"
                  verified
                />
                <PartnerCard
                  name="Center for Constitutional Rights"
                  description="Legal defense and policy advocacy"
                  verified
                />
                <PartnerCard
                  name="International Human Rights Network"
                  description="Documentation and human rights monitoring"
                  verified
                />
                <PartnerCard
                  name="Legal Aid Society"
                  description="Pro bono legal services for low-income communities"
                  verified
                />
                <PartnerCard
                  name="Transparency International"
                  description="Anti-corruption and accountability research"
                  verified
                />
                <PartnerCard
                  name="Human Rights Watch"
                  description="Independent human rights monitoring"
                  verified
                />
              </div>
              <p className="mt-6 text-xs text-muted-foreground">
                All partners are bound by confidentiality agreements and
                committed to responsible data use. Reports are shared only with
                explicit consent and in compliance with local laws.
              </p>
            </>
          }
        />

        <div className="card-white p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-lime/20">
              <Shield className="h-7 w-7 text-lime" />
            </div>
            <div>
              <p className="font-display text-sm font-semibold">
                Accountability Watch is committed to transparency
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                We undergo regular security audits and comply with data
                protection regulations including GDPR, CCPA, and regional
                privacy laws.
              </p>
            </div>
          </div>
        </div>

        <Section
          title="What data we collect"
          content={
            <>
              <p>
                When you submit a report, we collect the details you provide:
              </p>
              <ul className="mt-4 space-y-2 ml-4 text-sm text-muted-foreground">
                <li>
                  • <strong>Event details:</strong> Date, time, location,
                  description of incident
                </li>
                <li>
                  • <strong>Incident type:</strong> Category of alleged
                  misconduct (excessive force, detention, etc.)
                </li>
                <li>
                  • <strong>Evidence:</strong> Photos, videos, or documents you
                  upload
                </li>
                <li>
                  • <strong>Witness info:</strong> Name and contact info if you
                  provide it (optional)
                </li>
                <li>
                  • <strong>Your contact info:</strong> Only if you opt in
                  (anonymous submissions don't require this)
                </li>
                <li>
                  • <strong>Metadata:</strong> GPS coordinates, timestamps, and
                  file information from media
                </li>
              </ul>
            </>
          }
        />

        <Section
          title="How we protect your privacy"
          content={
            <>
              <div className="space-y-4 text-sm text-muted-foreground">
                <div>
                  <strong className="text-foreground">
                    Anonymous vs. Identified Submissions
                  </strong>
                  <p className="mt-1">
                    You can submit completely anonymously (no contact info) or
                    provide your name for legal follow-up. Either way, your
                    identity is never published.
                  </p>
                </div>
                <div>
                  <strong className="text-foreground">Encryption</strong>
                  <p className="mt-1">
                    All data in transit is encrypted (TLS 1.3). Sensitive fields
                    (officer names, badge numbers, reporter contact info) are
                    never public.
                  </p>
                </div>
                <div>
                  <strong className="text-foreground">Access Control</strong>
                  <p className="mt-1">
                    Raw reports are visible only to: (1) legal aid partners and
                    civil rights organizations we've verified, (2) platform
                    admins. No one else.
                  </p>
                </div>
                <div>
                  <strong className="text-foreground">Data Hashing</strong>
                  <p className="mt-1">
                    Evidence files are hashed (SHA-256) on submission, creating
                    a tamper-evident record that proves file integrity.
                  </p>
                </div>
              </div>
            </>
          }
        />

        <Section
          title="What goes public"
          content={
            <>
              <p>
                Only anonymized aggregate data is ever public. You'll see on our
                dashboard:
              </p>
              <ul className="mt-4 space-y-2 ml-4 text-sm text-muted-foreground">
                <li>
                  • <strong>Total reports by city and month</strong> (no
                  individual case detail)
                </li>
                <li>
                  • <strong>Incident type breakdowns</strong> (e.g. "15
                  excessive force reports in July")
                </li>
                <li>
                  • <strong>Trend charts</strong> showing patterns over time
                </li>
                <li>
                  • <strong>Geographic heatmaps</strong> (city-level only, no
                  addresses)
                </li>
              </ul>
              <p className="mt-4">
                <strong className="text-foreground">Never published:</strong>{" "}
                Officer names, badge numbers, specific addresses, photos/videos,
                reporter names, witness details, contact info, incident
                descriptions.
              </p>
            </>
          }
        />

        <Section
          title="Data retention"
          content={
            <>
              <div className="space-y-4 text-sm text-muted-foreground">
                <div>
                  <strong className="text-foreground">
                    Individual reports:
                  </strong>{" "}
                  Stored indefinitely in a secure, access-controlled database.
                  You can request deletion; contact us for details.
                </div>
                <div>
                  <strong className="text-foreground">Evidence files:</strong>{" "}
                  Kept as long as the report may be relevant to ongoing legal
                  matters (typically 5–7 years).
                </div>
                <div>
                  <strong className="text-foreground">
                    Aggregate statistics:
                  </strong>{" "}
                  Published data is kept for historical reference but cannot be
                  traced back to individuals.
                </div>
              </div>
            </>
          }
        />

        <Section
          title="Moderation & verification"
          content={
            <>
              <p>
                Before any report aggregates into public statistics, it goes
                through our moderation process:
              </p>
              <ol className="mt-4 space-y-2 ml-4 text-sm text-muted-foreground">
                <li>1. You submit a report (marked "pending moderation")</li>
                <li>
                  2. Our team reviews it for spam, false reporting, or abuse
                </li>
                <li>
                  3. Approved reports are marked "moderation approved" and
                  included in public stats
                </li>
                <li>
                  4. Rejected reports are flagged but kept in our database for
                  legal partners to review
                </li>
              </ol>
              <p className="mt-4">
                This process protects accuracy while ensuring legitimate reports
                reach civil rights organizations and researchers.
              </p>
            </>
          }
        />

        <Section
          title="Who has access"
          content={
            <>
              <div className="space-y-3 text-sm">
                <div>
                  <strong className="text-foreground block mb-2">
                    Public (anyone visiting our dashboard)
                  </strong>
                  <span className="text-muted-foreground">
                    Anonymized aggregate data only: totals by
                    city/month/incident type.
                  </span>
                </div>
                <div>
                  <strong className="text-foreground block mb-2">
                    Verified legal partners & NGOs
                  </strong>
                  <span className="text-muted-foreground">
                    Full report details to support legal cases and advocacy.
                    Bound by confidentiality agreements.
                  </span>
                </div>
                <div>
                  <strong className="text-foreground block mb-2">
                    Platform admins
                  </strong>
                  <span className="text-muted-foreground">
                    All data, for moderation, security, and operational
                    purposes.
                  </span>
                </div>
              </div>
            </>
          }
        />

        <Section
          title="Your rights"
          content={
            <>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">
                    Right to request deletion:
                  </strong>{" "}
                  Contact us and we can remove your report from our system
                  (though it may remain in legal partner archives).
                </p>
                <p>
                  <strong className="text-foreground">Right to access:</strong>{" "}
                  You can request a copy of your submitted data.
                </p>
                <p>
                  <strong className="text-foreground">Right to correct:</strong>{" "}
                  If your report contains errors, contact us to update it.
                </p>
                <p>
                  For requests, email:{" "}
                  <span className="font-mono">
                    privacy@accountability-watch.org
                  </span>
                </p>
              </div>
            </>
          }
        />

        <Section
          title="Security practices"
          content={
            <>
              <ul className="space-y-2 text-sm text-muted-foreground ml-4">
                <li>• All data encrypted at rest (AES-256)</li>
                <li>• All connections encrypted in transit (TLS 1.3)</li>
                <li>• Regular security audits and penetration testing</li>
                <li>• Zero-knowledge infrastructure where possible</li>
                <li>• Automated backups with encryption</li>
                <li>• Incident response plan in place</li>
              </ul>
            </>
          }
        />

        <Section
          title="Contact & questions"
          content={
            <>
              <p className="text-sm text-muted-foreground">
                If you have questions about how we handle your data:
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <p>
                  <strong className="text-foreground">Email:</strong>{" "}
                  <span className="font-mono">
                    privacy@accountability-watch.org
                  </span>
                </p>
                <p>
                  <strong className="text-foreground">
                    Data subject requests:
                  </strong>{" "}
                  <span className="font-mono">
                    dsr@accountability-watch.org
                  </span>
                </p>
              </div>
            </>
          }
        />

        <div className="card-white p-6 mt-10">
          <p className="text-xs text-muted-foreground">
            Last updated: January 2025. We'll notify users of any material
            changes to this policy.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  content,
}: {
  title: string;
  content: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <div className="mt-3 text-sm text-muted-foreground">{content}</div>
    </section>
  );
}

function PartnerCard({
  name,
  description,
  verified,
}: {
  name: string;
  description: string;
  verified?: boolean;
}) {
  return (
    <div className="rounded-2xl border-2 border-border/60 p-4 hover:border-lime/40 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-display text-sm font-semibold leading-tight">
          {name}
        </h3>
        {verified && (
          <div className="flex-shrink-0">
            <Badge
              className="bg-lime text-ink hover:bg-lime/90"
              variant="default"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Verified
            </Badge>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
