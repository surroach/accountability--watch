import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Scale, Phone, Heart, Landmark } from "lucide-react";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "Resources — Accountability Watch" },
      {
        name: "description",
        content:
          "Human-rights lawyers, state complaint bodies, and mental-health hotlines for people affected by police misconduct.",
      },
      { property: "og:title", content: "Resources — Accountability Watch" },
      {
        property: "og:description",
        content:
          "Human-rights lawyers, complaint authorities, and mental-health support.",
      },
    ],
  }),
  component: Resources,
});

type Item = { name: string; note: string; url?: string; phone?: string };

const legal: Item[] = [
  {
    name: "Human Rights Law Network (HRLN)",
    note: "Public-interest legal aid for civil-rights cases.",
    url: "https://hrln.org",
  },
  {
    name: "People's Union for Civil Liberties (PUCL)",
    note: "Civil-liberties documentation and advocacy.",
    url: "https://pucl.org",
  },
  {
    name: "Local bar association legal aid cell",
    note: "Add your city's bar association legal aid contact.",
  },
];

const complaints: Item[] = [
  {
    name: "State Human Rights Commission (SHRC)",
    note: "Statutory body for human-rights complaints.",
    url: "https://nhrc.nic.in",
  },
  {
    name: "Police Complaints Authority",
    note: "State-level oversight body for police conduct.",
  },
  {
    name: "National Human Rights Commission (NHRC)",
    note: "Federal-level rights commission.",
    url: "https://nhrc.nic.in",
  },
];

const mental: Item[] = [
  {
    name: "iCall Psychosocial Helpline",
    note: "Free counselling in multiple languages.",
    phone: "+91 9152987821",
  },
  {
    name: "Vandrevala Foundation Helpline",
    note: "24×7 mental health support.",
    phone: "1860 266 2345",
  },
  {
    name: "KIRAN Mental Health Helpline",
    note: "Government of India, 24×7.",
    phone: "1800 599 0019",
  },
];

function Section({
  title,
  icon,
  items,
  tone = "white",
}: {
  title: string;
  icon: React.ReactNode;
  items: Item[];
  tone?: "white" | "ink";
}) {
  const isInk = tone === "ink";
  return (
    <section className={`${isInk ? "card-ink" : "card-white"} p-6 md:p-8`}>
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${isInk ? "bg-lime text-ink" : "bg-ink text-ink-foreground"}`}
        >
          {icon}
        </span>
        <h2 className="font-display text-xl font-bold">{title}</h2>
      </div>
      <ul className="mt-6 divide-y divide-border/40">
        {items.map((it, i) => (
          <li
            key={i}
            className="flex flex-col gap-1 py-4 md:flex-row md:items-start md:justify-between md:gap-6"
          >
            <div>
              <p className="font-display font-semibold">{it.name}</p>
              <p
                className={`mt-1 text-sm ${isInk ? "text-white/70" : "text-muted-foreground"}`}
              >
                {it.note}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-sm">
              {it.phone && (
                <a
                  href={`tel:${it.phone.replace(/\s/g, "")}`}
                  className="font-mono underline"
                >
                  {it.phone}
                </a>
              )}
              {it.url && (
                <a
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline"
                >
                  Visit <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Resources() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <p className="mb-3 font-display text-xs uppercase tracking-widest">
        <span className="highlight-lime">Get help</span>
      </p>
      <h1 className="font-display text-4xl font-bold md:text-5xl">
        Resources & support
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        A short, editable directory of legal aid, statutory complaint bodies,
        and mental-health support. Add local organizations that serve your area.
      </p>

      <div className="mt-10 grid gap-6">
        <Section
          title="Legal aid"
          icon={<Scale className="h-5 w-5" />}
          items={legal}
        />
        <Section
          title="Complaint authorities"
          icon={<Landmark className="h-5 w-5" />}
          items={complaints}
          tone="ink"
        />
        <Section
          title="Mental-health support"
          icon={<Heart className="h-5 w-5" />}
          items={mental}
        />
      </div>

      <div className="mt-10 flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/40 p-5 text-sm text-muted-foreground">
        <Phone className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          In immediate danger, contact local emergency services first. This site
          is a documentation tool, not an emergency response service.
        </p>
      </div>
    </div>
  );
}
