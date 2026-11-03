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
          "This prototype's data handling design and transparency considerations. Security and partner integrations should be verified before production use.",
      },
      {
        property: "og:title",
        content: "Data Policy & Transparency — Accountability Watch",
      },
      {
        property: "og:description",
        content: "Prototype data handling design. Not a production privacy policy.",
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
          title="Partner organizations (prototype design)"
          content={
            <>
              <p className="mb-6 text-sm text-muted-foreground">
                In this prototype, the design shows how verified partner organizations could access
                reports to support legal and civil rights work. This integration has not yet been implemented.
              </p>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-6">
                <p className="text-sm text-amber-900">
                  <strong>⚠️ Note:</strong> The partner organizations listed below are examples for design purposes only.
                  They have not been contacted or verified. Do not assume this platform is integrated with any organization.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Actual partner verification, data sharing agreements, and access controls should be configured by
                the project owner before any real data is collected.
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
                Security & data handling (prototype)
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                This prototype demonstrates data handling patterns. Security practices and compliance
                requirements should be verified with legal and security experts before production deployment.
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
          title="How we protect your privacy (design intent)"
          content={
            <>
              <div className="space-y-4 text-sm text-muted-foreground">
                <div>
                  <strong className="text-foreground">
                    Anonymous vs. Identified Submissions
                  </strong>
                  <p className="mt-1">
                    The prototype design supports anonymous submission (no contact info) or identified submission.
                    Either way, the design intends for identity to not be published in public aggregates.
                  </p>
                </div>
                <div>
                  <strong className="text-foreground">Data in Transit</strong>
                  <p className="mt-1">
                    The system should use encrypted transport (HTTPS/TLS). Implementation details depend on
                    your deployment environment and should be verified with your hosting provider.
                  </p>
                </div>
                <div>
                  <strong className="text-foreground">Access Control</strong>
                  <p className="mt-1">
                    The prototype design shows role-based access: administrators and (optionally) verified partners.
                    Actual access policies depend on backend configuration and authentication setup.
                  </p>
                </div>
                <div>
                  <strong className="text-foreground">Data Hashing</strong>
                  <p className="mt-1">
                    The design tracks file hashes (SHA-256) for integrity. This is a design pattern;
                    actual implementation should be reviewed for cryptographic correctness.
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
          title="Data retention (design considerations)"
          content={
            <>
              <div className="space-y-4 text-sm text-muted-foreground">
                <div>
                  <strong className="text-foreground">
                    Individual reports:
                  </strong>{" "}
                  Retention strategy should be determined by the project owner based on legal requirements,
                  funding, and storage capacity. Contact the administrator for information.
                </div>
                <div>
                  <strong className="text-foreground">Evidence files:</strong>{" "}
                  Storage duration depends on use case and should be specified in a formal data retention policy
                  before deployment.
                </div>
                <div>
                  <strong className="text-foreground">
                    Aggregate statistics:
                  </strong>{" "}
                  Published aggregate data can be kept indefinitely but should not be traceable to individuals.
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
          title="Security practices (to be verified)"
          content={
            <>
              <ul className="space-y-2 text-sm text-muted-foreground ml-4">
                <li>• Encrypt data in transit (HTTPS/TLS recommended)</li>
                <li>• Implement access controls and authentication</li>
                <li>• Use automated backups (details depend on hosting)</li>
                <li>• Plan incident response procedures</li>
                <li>• Security should be reviewed by external experts before production deployment</li>
              </ul>
              <p className="mt-4 text-xs text-muted-foreground italic">
                This is a prototype. Claims about specific encryption standards, audit completion, or
                compliance certifications should not be made until verified by security professionals.
              </p>
            </>
          }
        />

        <Section
          title="Contact & questions"
          content={
            <>
              <p className="text-sm text-muted-foreground">
                For questions about data handling in this prototype, contact the project owner or administrator.
              </p>
              <p className="mt-4 text-xs text-muted-foreground italic">
                Formal contact procedures, data subject request handling, and privacy officer contact information
                should be established before production deployment.
              </p>
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
