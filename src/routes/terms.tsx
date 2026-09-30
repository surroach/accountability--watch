import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — Accountability Watch" },
      { name: "description", content: "Legal terms and conditions for using Accountability Watch." },
      { property: "og:title", content: "Terms of Use — Accountability Watch" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <p className="mb-3 font-display text-xs uppercase tracking-widest">
        <span className="highlight-lime">Legal</span>
      </p>
      <h1 className="font-display text-4xl font-bold">Terms of use</h1>
      <p className="mt-3 text-muted-foreground">
        Please read these terms carefully before submitting a report.
      </p>

      <div className="mt-12 space-y-8 text-sm text-muted-foreground">
        <Section
          num="1"
          title="Acceptance of Terms"
          content="By using Accountability Watch, you agree to these terms. If you disagree, do not use this platform."
        />

        <Section
          num="2"
          title="Nature of Reports"
          content={
            <>
              <p>
                All reports submitted to Accountability Watch are unverified claims and allegations. Submission does not constitute a finding of misconduct against any individual or organization.
              </p>
              <p className="mt-3">
                By submitting, you affirm that you believe the information to be accurate to the best of your knowledge. Intentionally false reports may be removed and reported to appropriate authorities.
              </p>
            </>
          }
        />

        <Section
          num="3"
          title="Not Legal Advice"
          content={
            <>
              <p>
                Accountability Watch is not a legal service. Reports shared with legal partners do not create an attorney-client relationship.
              </p>
              <p className="mt-3">
                For legal assistance, contact a licensed attorney in your jurisdiction or reach out to organizations listed on our Resources page.
              </p>
            </>
          }
        />

        <Section
          num="4"
          title="Liability Limitations"
          content={
            <>
              <p>
                <strong className="text-foreground">Disclaimer of Warranties:</strong> Accountability Watch is provided "as is" without warranties of any kind, express or implied.
              </p>
              <p className="mt-3">
                <strong className="text-foreground">Limitation of Liability:</strong> We are not liable for:
              </p>
              <ul className="mt-2 ml-4 space-y-1">
                <li>• Damages resulting from use or inability to use the platform</li>
                <li>• Accuracy or completeness of reports submitted by others</li>
                <li>• Loss of data or privacy breaches (except where we are negligent)</li>
                <li>• Actions taken by third parties based on information here</li>
              </ul>
            </>
          }
        />

        <Section
          num="5"
          title="Defamation & Legal Protection"
          content={
            <>
              <p>
                <strong className="text-foreground">Good Faith Communications:</strong> In most jurisdictions, communications made in good faith to report potential misconduct to relevant authorities or civil rights organizations are protected.
              </p>
              <p className="mt-3">
                By using Accountability Watch, you affirm that your report is made in good faith and with reasonable belief in its truthfulness. Knowingly false allegations may expose you to legal liability.
              </p>
              <p className="mt-3">
                We reserve the right to remove reports we determine to be defamatory or made in bad faith.
              </p>
            </>
          }
        />

        <Section
          num="6"
          title="Privacy & Data Handling"
          content={
            <>
              <p>
                Please review our Data Policy & Transparency page for details on how we collect, store, and share your information.
              </p>
              <p className="mt-3">
                By submitting, you consent to:
              </p>
              <ul className="mt-2 ml-4 space-y-1">
                <li>• Sharing your report with verified legal partners and civil rights organizations</li>
                <li>• Use of anonymized aggregate data for public statistics and research</li>
                <li>• Retention of your report as described in our data policy</li>
              </ul>
            </>
          }
        />

        <Section
          num="7"
          title="Prohibited Content"
          content={
            <>
              <p>
                Do not submit content that:
              </p>
              <ul className="mt-3 ml-4 space-y-1">
                <li>• Is false or known to be false</li>
                <li>• Contains hate speech, slurs, or discriminatory language</li>
                <li>• Is spam or commercial solicitation</li>
                <li>• Contains malware or illegal content</li>
                <li>• Violates anyone's privacy or intellectual property rights</li>
              </ul>
              <p className="mt-3">
                Violations may result in removal, legal action, and/or referral to authorities.
              </p>
            </>
          }
        />

        <Section
          num="8"
          title="Your License to Us"
          content={
            <>
              <p>
                By submitting reports, photos, or other content, you grant Accountability Watch and verified partner organizations a non-exclusive, royalty-free license to use that content for civil rights advocacy, legal action, research, and journalism.
              </p>
              <p className="mt-3">
                You represent and warrant that you have the right to grant this license and that your submission does not infringe on anyone else's rights.
              </p>
            </>
          }
        />

        <Section
          num="9"
          title="Third-Party Links"
          content="We may link to external organizations and resources. We are not responsible for their content, privacy practices, or accuracy. Use third-party resources at your own risk."
        />

        <Section
          num="10"
          title="Moderation & Content Removal"
          content={
            <>
              <p>
                We review reports for spam, false allegations, and violations of these terms. We may:
              </p>
              <ul className="mt-3 ml-4 space-y-1">
                <li>• Reject reports during moderation</li>
                <li>• Remove content that violates these terms</li>
                <li>• Deactivate accounts engaged in abuse</li>
              </ul>
              <p className="mt-3">
                Moderation decisions are final, but you can contact us to appeal.
              </p>
            </>
          }
        />

        <Section
          num="11"
          title="Indemnification"
          content={
            <>
              <p>
                You agree to defend and indemnify Accountability Watch from any claims, damages, or legal fees arising from:
              </p>
              <ul className="mt-3 ml-4 space-y-1">
                <li>• Your use of the platform</li>
                <li>• Reports you submit (including false allegations)</li>
                <li>• Your violation of these terms or applicable law</li>
              </ul>
            </>
          }
        />

        <Section
          num="12"
          title="Governing Law"
          content={
            <>
              <p>
                These terms are governed by the laws of [Your Jurisdiction]. Any disputes shall be resolved in the courts of [Your Jurisdiction], and you consent to personal jurisdiction there.
              </p>
            </>
          }
        />

        <Section
          num="13"
          title="Severability"
          content="If any part of these terms is found invalid or unenforceable, that part shall be severed, and the remainder shall remain in full force."
        />

        <Section
          num="14"
          title="Changes to These Terms"
          content={
            <>
              <p>
                We may update these terms at any time. We'll post a notice on this page and update the date. Your continued use of Accountability Watch constitutes acceptance of changes.
              </p>
            </>
          }
        />

        <Section
          num="15"
          title="Contact"
          content={
            <>
              <p>
                For questions about these terms, contact us at:
              </p>
              <p className="mt-2 font-mono">legal@accountability-watch.org</p>
            </>
          }
        />

        <div className="card-white p-6 mt-10 border-destructive/20 bg-destructive/5">
          <p className="text-xs font-semibold text-destructive">
            ⚠️ Important: These terms are template language and should be reviewed by legal counsel familiar with your jurisdiction before deploying to production.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ num, title, content }: { num: string; title: string; content: string | React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display font-bold text-foreground">
        <span className="text-muted-foreground">{num}.</span> {title}
      </h2>
      <div className="mt-2">
        {typeof content === "string" ? <p>{content}</p> : content}
      </div>
    </div>
  );
}
