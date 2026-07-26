import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Public dashboard — Accountability Watch" },
      { name: "description", content: "Anonymized, aggregate counts of reported incidents by city and by month. No individual case detail is public." },
      { property: "og:title", content: "Public dashboard — Accountability Watch" },
      { property: "og:description", content: "Anonymized, aggregate counts of reported incidents by city and by month." },
    ],
  }),
  component: Dashboard,
});

type Stats = {
  total_reports: number;
  by_city: { city: string; count: number }[];
  by_month: { month: string; count: number }[];
};

function Dashboard() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [city, setCity] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["public-stats", from, to, city],
    queryFn: async (): Promise<Stats> => {
      const { data, error } = await supabase.rpc("public_incident_stats", {
        from_date: from ? new Date(from).toISOString() : null,
        to_date: to ? new Date(to).toISOString() : null,
        city_filter: city ? `%${city}%` : null,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        total_reports: Number(row?.total_reports ?? 0),
        by_city: (row?.by_city as any) ?? [],
        by_month: (row?.by_month as any) ?? [],
      };
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <p className="mb-3 font-display text-xs uppercase tracking-widest">
        <span className="highlight-lime">Public data</span>
      </p>
      <h1 className="font-display text-4xl font-bold md:text-5xl">Aggregate dashboard</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Anonymized counts only. No officer names, photos, badge numbers, or individual case detail
        appear here. For research and journalism use.
      </p>

      <div className="mt-8 grid gap-4 rounded-3xl border-2 border-ink bg-background p-5 md:grid-cols-3">
        <div>
          <Label className="font-display text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label className="font-display text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <Label className="font-display text-xs">City contains</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Delhi" />
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <Stat label="Total reports" value={isLoading ? "…" : String(data?.total_reports ?? 0)} variant="ink" />
        <Stat label="Cities represented" value={isLoading ? "…" : String(data?.by_city?.length ?? 0)} />
        <Stat label="Months with reports" value={isLoading ? "…" : String(data?.by_month?.length ?? 0)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card-white p-6">
          <h3 className="mb-4 font-display text-lg font-bold">By city</h3>
          {data && data.by_city.length > 0 ? (
            <ul className="divide-y divide-border">
              {data.by_city.map((r) => (
                <li key={r.city} className="flex items-center justify-between py-3">
                  <span className="font-display text-sm">{r.city}</span>
                  <span className="rounded-full bg-lime px-3 py-1 font-mono text-sm font-bold">{r.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState />
          )}
        </div>
        <div className="card-white p-6">
          <h3 className="mb-4 font-display text-lg font-bold">By month</h3>
          {data && data.by_month.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.by_month}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-ink)",
                      color: "var(--color-ink-foreground)",
                      border: "none",
                      borderRadius: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="var(--color-lime)" stroke="var(--color-ink)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>

      <p className="mt-8 rounded-2xl border border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground">
        Reports here are unverified allegations submitted by members of the public. Publication of
        aggregate counts does not constitute a finding of misconduct against any individual.
      </p>
    </div>
  );
}

function Stat({ label, value, variant = "white" }: { label: string; value: string; variant?: "white" | "ink" }) {
  return (
    <div className={`${variant === "ink" ? "card-ink" : "card-white"} p-6`}>
      <p className={`font-display text-xs uppercase tracking-widest ${variant === "ink" ? "text-white/60" : "text-muted-foreground"}`}>{label}</p>
      <p className="mt-2 font-display text-4xl font-bold">{value}</p>
    </div>
  );
}

function EmptyState() {
  return <p className="py-8 text-center text-sm text-muted-foreground">No data for this filter yet.</p>;
}
