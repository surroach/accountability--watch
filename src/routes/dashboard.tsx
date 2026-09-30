import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Download, FileJson, TrendingUp, TrendingDown, Minus } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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
  trend?: { direction: "up" | "down" | "stable"; percentage: number };
  previous_period_total?: number;
};

function Dashboard() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [city, setCity] = useState("");
  const chartRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["public-stats", from, to, city],
    queryFn: async (): Promise<Stats> => {
      const args: Record<string, string> = {};
      if (from) args.from_date = new Date(from).toISOString();
      if (to) args.to_date = new Date(to).toISOString();
      if (city) args.city_filter = `%${city}%`;
      const { data, error } = await supabase.rpc("public_incident_stats", args as never);
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      
      const total_reports = Number(row?.total_reports ?? 0);
      const by_city = (row?.by_city as any) ?? [];
      const by_month = (row?.by_month as any) ?? [];
      
      // Calculate trend: compare first half to second half of months
      let trend: { direction: "up" | "down" | "stable"; percentage: number } | undefined;
      if (by_month.length >= 2) {
        const midpoint = Math.ceil(by_month.length / 2);
        const firstHalf = by_month.slice(0, midpoint).reduce((sum, m) => sum + m.count, 0);
        const secondHalf = by_month.slice(midpoint).reduce((sum, m) => sum + m.count, 0);
        
        if (firstHalf > 0) {
          const percentChange = ((secondHalf - firstHalf) / firstHalf) * 100;
          const direction = percentChange > 5 ? "up" : percentChange < -5 ? "down" : "stable";
          trend = {
            direction,
            percentage: Math.abs(Math.round(percentChange)),
          };
        }
      }
      
      return {
        total_reports,
        by_city,
        by_month,
        trend,
        previous_period_total: total_reports,
      };
    },
  });

  async function exportCSV() {
    if (!data) return;
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `accountability-watch-${timestamp}.csv`;

    // Build CSV content
    const lines: string[] = [];

    // By city section
    lines.push("CITY,COUNT");
    data.by_city.forEach((row) => {
      lines.push(`"${row.city}",${row.count}`);
    });
    lines.push("");

    // By month section
    lines.push("MONTH,COUNT");
    data.by_month.forEach((row) => {
      lines.push(`"${row.month}",${row.count}`);
    });
    lines.push("");

    // Summary
    lines.push(`TOTAL_REPORTS,${data.total_reports}`);
    lines.push(`GENERATED,"${new Date().toISOString()}"`);

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function exportPDF() {
    if (!chartRef.current) return;

    try {
      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgData = canvas.toDataURL("image/png");
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 10;

      // Add title and metadata
      pdf.setFontSize(16);
      pdf.text("Accountability Watch", 10, 10);
      pdf.setFontSize(10);
      pdf.text("Incident Report Statistics", 10, 20);
      pdf.setFontSize(8);
      pdf.text(
        `Generated: ${new Date().toLocaleString()}${from ? ` | From: ${from}` : ""}${to ? ` | To: ${to}` : ""}`,
        10,
        28
      );

      // Add chart image
      pdf.addImage(imgData, "PNG", 10, 35, imgWidth, imgHeight);
      heightLeft -= imgHeight;
      position = 35 + imgHeight + 10;

      // Add summary stats
      if (position + 40 > pdf.internal.pageSize.getHeight()) {
        pdf.addPage();
        position = 10;
      }

      pdf.setFontSize(12);
      pdf.text("Summary Statistics", 10, position);
      position += 10;

      pdf.setFontSize(10);
      pdf.text(`Total Reports: ${data?.total_reports || 0}`, 10, position);
      position += 8;
      pdf.text(`Cities Represented: ${data?.by_city?.length || 0}`, 10, position);
      position += 8;
      pdf.text(`Months with Reports: ${data?.by_month?.length || 0}`, 10, position);

      // Add disclaimer
      position += 15;
      pdf.setFontSize(8);
      pdf.text(
        "Reports here are unverified allegations submitted by members of the public. Publication of",
        10,
        position
      );
      position += 5;
      pdf.text(
        "aggregate counts does not constitute a finding of misconduct against any individual.",
        10,
        position
      );

      const timestamp = new Date().toISOString().split("T")[0];
      pdf.save(`accountability-watch-${timestamp}.pdf`);
    } catch (error) {
      console.error("PDF export failed:", error);
    }
  }

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

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button
          onClick={exportCSV}
          disabled={!data || data.by_city.length === 0}
          variant="outline"
          className="rounded-full"
        >
          <Download className="h-4 w-4" /> Export CSV
        </Button>
        <Button
          onClick={exportPDF}
          disabled={!data || data.by_city.length === 0}
          variant="outline"
          className="rounded-full"
        >
          <FileJson className="h-4 w-4" /> Export PDF
        </Button>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <Stat 
          label="Total reports" 
          value={isLoading ? "…" : String(data?.total_reports ?? 0)} 
          variant="ink"
          trend={data?.trend}
        />
        <Stat 
          label="Cities represented" 
          value={isLoading ? "…" : String(data?.by_city?.length ?? 0)} 
        />
        <Stat 
          label="Months with reports" 
          value={isLoading ? "…" : String(data?.by_month?.length ?? 0)} 
        />
      </div>

      <div ref={chartRef} className="mt-8 grid gap-6 lg:grid-cols-2 bg-white p-6 rounded-2xl">
        <div className="card-white p-6">
          <h3 className="mb-4 font-display text-lg font-bold">By city</h3>
          {data && data.by_city.length > 0 ? (
            <ul className="divide-y divide-border">
              {data.by_city.map((r) => (
                <li key={r.city} className="flex items-center justify-between py-3">
                  <span className="font-display text-sm">{r.city}</span>
                  <span className="font-mono text-sm font-bold tabular-nums text-foreground">{r.count}</span>
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
                <BarChart data={data.by_month} barCategoryGap="40%">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    strokeOpacity={0.5}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    stroke="var(--color-muted-foreground)"
                    strokeOpacity={0.4}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    strokeOpacity={0.4}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={28}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)", opacity: 0.5 }}
                    contentStyle={{
                      background: "var(--color-card)",
                      color: "var(--color-card-foreground)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    itemStyle={{ color: "var(--color-foreground)" }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Bar dataKey="count" fill="var(--color-ink)" radius={[3, 3, 0, 0]} />
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

      {data && data.by_month.length > 1 && (
        <div className="mt-8 rounded-2xl border-2 border-border bg-card p-6">
          <h3 className="font-display text-lg font-bold mb-4">Insights & patterns</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <InsightCard
              title="Trend direction"
              description={
                data.trend?.direction === "up"
                  ? `Reporting rate is increasing (+${data.trend.percentage}%)`
                  : data.trend?.direction === "down"
                    ? `Reporting rate is decreasing (−${data.trend.percentage}%)`
                    : "Reporting rate is stable"
              }
              icon={
                data.trend?.direction === "up" ? (
                  <TrendingUp className="h-5 w-5 text-foreground/60" />
                ) : data.trend?.direction === "down" ? (
                  <TrendingDown className="h-5 w-5 text-foreground/60" />
                ) : (
                  <Minus className="h-5 w-5 text-muted-foreground" />
                )
              }
            />
            <InsightCard
              title="Peak reporting month"
              description={
                data.by_month.length > 0
                  ? `${data.by_month.reduce((max, m) => (m.count > max.count ? m : max)).month} — ${data.by_month.reduce((max, m) => (m.count > max.count ? m : max)).count} reports`
                  : "No data"
              }
              icon={<TrendingUp className="h-5 w-5 text-foreground/60" />}
            />
            <InsightCard
              title="Most active city"
              description={
                data.by_city.length > 0
                  ? `${data.by_city[0].city} — ${data.by_city[0].count} reports`
                  : "No data"
              }
              icon={<TrendingUp className="h-5 w-5 text-foreground/60" />}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ 
  label, 
  value, 
  variant = "white",
  trend,
}: { 
  label: string
  value: string
  variant?: "white" | "ink"
  trend?: { direction: "up" | "down" | "stable"; percentage: number }
}) {
  return (
    <div className={`${variant === "ink" ? "card-ink" : "card-white"} p-6`}>
      <p className={`font-display text-xs uppercase tracking-widest ${variant === "ink" ? "text-white/60" : "text-muted-foreground"}`}>{label}</p>
      <div className="mt-2 flex items-end gap-2">
        <p className="font-display text-4xl font-bold">{value}</p>
        {trend && (
          <div className={`mb-1 flex items-center gap-1 text-xs font-semibold ${
            trend.direction === "up" ? "text-foreground/70" :
            trend.direction === "down" ? "text-foreground/70" :
            "text-muted-foreground"
          }`}>
            {trend.direction === "up" && <TrendingUp className="h-3.5 w-3.5" />}
            {trend.direction === "down" && <TrendingDown className="h-3.5 w-3.5" />}
            {trend.direction === "stable" && <Minus className="h-3.5 w-3.5" />}
            <span>{trend.percentage}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return <p className="py-8 text-center text-sm text-muted-foreground">No data for this filter yet.</p>;
}

function InsightCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">{icon}</div>
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
