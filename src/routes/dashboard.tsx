import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Download,
  FileJson,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Public dashboard — Accountability Watch" },
      {
        name: "description",
        content:
          "Anonymized, aggregate counts of reported incidents by city and by month. No individual case detail is public.",
      },
      {
        property: "og:title",
        content: "Public dashboard — Accountability Watch",
      },
      {
        property: "og:description",
        content:
          "Anonymized, aggregate counts of reported incidents by city and by month.",
      },
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

// ── Breadcrumb navigation ─────────────────────────────────────────────────────
function Breadcrumb({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex items-center gap-2 text-sm">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-center gap-2">
            {item.href ? (
              <>
                <Link
                  to={item.href}
                  className="text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink rounded px-1"
                >
                  {item.label}
                </Link>
                {idx < items.length - 1 && (
                  <ChevronRight 
                    className="h-4 w-4 text-muted-foreground flex-shrink-0" 
                    aria-hidden="true"
                  />
                )}
              </>
            ) : (
              <>
                <span 
                  className="text-foreground font-medium"
                  aria-current="page"
                >
                  {item.label}
                </span>
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Dashboard() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [city, setCity] = useState("");
  const [debouncedCity, setDebouncedCity] = useState("");
  const chartRef = useRef<HTMLDivElement>(null);

  // Debounce city filter to reduce query calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCity(city);
    }, 300);
    return () => clearTimeout(timer);
  }, [city]);

  const { data, isLoading, error, isError, refetch } = useQuery({
    queryKey: ["public-stats", from, to, debouncedCity],
    queryFn: async (): Promise<Stats> => {
      const args: Record<string, string> = {};
      if (from) args.from_date = new Date(from).toISOString();
      if (to) args.to_date = new Date(to).toISOString();
      if (debouncedCity) args.city_filter = `%${debouncedCity}%`;
      const { data, error } = await supabase.rpc(
        "public_incident_stats",
        args as never,
      );
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;

      const total_reports = Number(row?.total_reports ?? 0);
      const by_city = (row?.by_city as any) ?? [];
      const by_month = (row?.by_month as any) ?? [];

      // G3: Calculate trend with equal-length periods and clear conditions
      let trend:
        { direction: "up" | "down" | "stable"; percentage: number } | undefined;
      
      // Only calculate trend if we have at least 2 months of data
      if (by_month.length >= 2) {
        // G3: Split into equal-length periods
        // For even count: exactly half and half
        // For odd count: use middle month in neither period, compare around it
        // Actually, for clarity: use first half vs second half with equal distribution
        const midpoint = Math.floor(by_month.length / 2);
        const firstHalf = by_month
          .slice(0, midpoint)
          .reduce((sum, m) => sum + m.count, 0);
        const secondHalf = by_month
          .slice(midpoint)
          .reduce((sum, m) => sum + m.count, 0);

        // Only show trend if both periods have data
        if (firstHalf > 0 && secondHalf > 0) {
          const percentChange = ((secondHalf - firstHalf) / firstHalf) * 100;
          const direction =
            percentChange > 5 ? "up" : percentChange < -5 ? "down" : "stable";
          trend = {
            direction,
            percentage: Math.abs(Math.round(percentChange)),
          };
        }
      }
      // If only 1 month or 0 months, trend is undefined (not shown)

      return {
        total_reports,
        by_city,
        by_month,
        trend,
        previous_period_total: total_reports, // G3: Don't use this for trend, kept for compatibility
      };
    },
    retry: 1,
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
    
    toast.success("Data exported as CSV");
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
        28,
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
      pdf.text(
        `Cities Represented: ${data?.by_city?.length || 0}`,
        10,
        position,
      );
      position += 8;
      pdf.text(
        `Months with Reports: ${data?.by_month?.length || 0}`,
        10,
        position,
      );

      // Add disclaimer
      position += 15;
      pdf.setFontSize(8);
      pdf.text(
        "Reports here are unverified allegations submitted by members of the public. Publication of",
        10,
        position,
      );
      position += 5;
      pdf.text(
        "aggregate counts does not constitute a finding of misconduct against any individual.",
        10,
        position,
      );

      const timestamp = new Date().toISOString().split("T")[0];
      pdf.save(`accountability-watch-${timestamp}.pdf`);
      
      toast.success("Data exported as PDF");
    } catch (error) {
      console.error("PDF export failed:", error);
      toast.error("Failed to export PDF");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-5 py-8 sm:py-12 space-y-8 sm:space-y-10">
      <Breadcrumb 
        items={[
          { label: "Home", href: "/" },
          { label: "Public dashboard" }
        ]}
      />

      <p className="mb-2 sm:mb-3 font-display text-xs uppercase tracking-widest">
        <span className="highlight-lime">Public data</span>
      </p>
      <h1 id="page-title" className="font-display text-3xl sm:text-4xl md:text-5xl font-bold">
        Aggregate dashboard
      </h1>
      <p className="mt-2 sm:mt-3 max-w-2xl text-xs sm:text-sm text-muted-foreground">
        Anonymized counts only. No officer names, photos, badge numbers, or
        individual case detail appear here. For research and journalism use.
      </p>

      <div className="mt-8 grid gap-3 sm:gap-4 rounded-3xl border-2 border-ink bg-background p-4 sm:p-5 md:grid-cols-3">
        <div>
          <Label htmlFor="from-date" className="font-display text-xs sm:text-xs">
            From
            <span className="text-muted-foreground text-xs ml-1">(start date)</span>
          </Label>
          <Input
            id="from-date"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-describedby="filter-help from-date-error"
            className="text-base sm:text-sm"
          />
          {from && to && new Date(from) > new Date(to) && (
            <p id="from-date-error" className="mt-1 text-xs text-destructive" role="alert">
              Start date cannot be after end date
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="to-date" className="font-display text-xs sm:text-xs">
            To
            <span className="text-muted-foreground text-xs ml-1">(end date, inclusive)</span>
          </Label>
          <Input
            id="to-date"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-describedby="filter-help to-date-error"
            className="text-base sm:text-sm"
          />
          {from && to && new Date(from) > new Date(to) && (
            <p id="to-date-error" className="mt-1 text-xs text-destructive" role="alert">
              End date cannot be before start date
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="city-filter" className="font-display text-xs sm:text-xs">
            City contains
            <span className="text-muted-foreground text-xs ml-1">(partial match)</span>
          </Label>
          <Input
            id="city-filter"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Delhi"
            aria-describedby="filter-help"
            className="text-base sm:text-sm"
          />
        </div>
      </div>
      <p id="filter-help" className="sr-only">
        Use these filters to refine the data shown in the dashboard below. Dates are interpreted as local calendar dates (not UTC-adjusted). Leave empty to include all dates or cities.
      </p>

      <div className="mt-4 sm:mt-6 flex flex-wrap items-center gap-2 sm:gap-3">
        <Button
          onClick={exportCSV}
          disabled={!data || data.by_city.length === 0 || isLoading || isError}
          variant="outline"
          className="rounded-full text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 h-auto transition-colors duration-200 hover:bg-muted disabled:cursor-not-allowed"
          aria-label="Export dashboard data as CSV"
        >
          <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" aria-hidden="true" /> Export CSV
        </Button>
        <Button
          onClick={exportPDF}
          disabled={!data || data.by_city.length === 0 || isLoading || isError}
          variant="outline"
          className="rounded-full text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 h-auto transition-colors duration-200 hover:bg-muted disabled:cursor-not-allowed"
          aria-label="Export dashboard data as PDF"
        >
          <FileJson className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" aria-hidden="true" /> Export PDF
        </Button>
        {isError && (
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="rounded-full text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 h-auto transition-colors duration-200 hover:bg-muted"
            aria-label="Retry loading dashboard data"
          >
            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" aria-hidden="true" /> Retry
          </Button>
        )}
      </div>

      {/* G1: Render four distinct states */}
      {isLoading && (
        <div className="mt-8 rounded-2xl border border-border/60 bg-muted/40 p-6 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-ink mb-3"></div>
          <p className="text-sm text-muted-foreground">Loading dashboard data...</p>
        </div>
      )}

      {isError && (
        <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/10 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-display font-semibold text-sm text-destructive">
                Could not load dashboard data
              </p>
              <p className="mt-1 text-xs text-destructive/80">
                An error occurred while fetching statistics. This could be a network issue or temporary service problem.
              </p>
              <Button
                onClick={() => refetch()}
                size="sm"
                variant="outline"
                className="mt-3"
                aria-label="Retry loading dashboard data"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" aria-hidden="true" /> Try again
              </Button>
            </div>
          </div>
        </div>
      )}

      {!isLoading && !isError && data && (
        <>
          {/* G1: Data successfully loaded */}
          <div className="mt-8 grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Stat
              label="Total reports"
              value={String(data.total_reports)}
              variant="ink"
              trend={data.total_reports > 0 && data.by_month.length >= 2 ? data.trend : undefined}
              isLoading={false}
            />
            <Stat
              label="Cities represented"
              value={String(data.by_city?.length ?? 0)}
              isLoading={false}
            />
            <Stat
              label="Months with reports"
              value={String(data.by_month?.length ?? 0)}
              isLoading={false}
            />
          </div>

          {data.by_city.length === 0 && data.by_month.length === 0 ? (
            /* G1: Data successfully loaded but empty */
            <div className="mt-8 rounded-2xl border border-border/60 bg-muted/40 p-8 text-center">
              <p className="text-sm text-muted-foreground font-medium">
                No reports found for the selected filters.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Try removing or adjusting the date range or city filter to see results.
              </p>
            </div>
          ) : (
            /* G1: Data successfully loaded with results */
            <>
              <div
                ref={chartRef}
                className="mt-8 grid gap-4 sm:gap-6 lg:grid-cols-2 bg-white p-4 sm:p-6 rounded-2xl"
                role="region"
                aria-labelledby="chart-section-title"
              >
                <div className="card-white p-4 sm:p-6">
                  <h2 id="by-city-title" className="mb-3 sm:mb-4 font-display text-lg font-bold">
                    By city
                  </h2>
                  {data.by_city.length > 0 ? (
                    <ul className="divide-y divide-border max-h-96 overflow-y-auto" aria-labelledby="by-city-title">
                      {data.by_city.map((r) => (
                        <li
                          key={r.city}
                          className="flex items-center justify-between py-3 text-sm sm:text-base"
                        >
                          <span className="font-display text-sm">{r.city}</span>
                          <span className="font-mono text-sm font-bold tabular-nums text-foreground" aria-label={`${r.city}: ${r.count} reports`}>
                            {r.count}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState message="No cities match your filter." />
                  )}
                </div>
                <div className="card-white p-4 sm:p-6">
                  <h2 id="by-month-title" className="mb-3 sm:mb-4 font-display text-lg font-bold">
                    By month
                  </h2>
                  {data.by_month.length > 0 ? (
                    <div className="h-48 sm:h-64" role="img" aria-labelledby="by-month-title" aria-label={`Bar chart showing ${data.by_month.length} months of incident reports, ranging from ${Math.min(...data.by_month.map(m => m.count))} to ${Math.max(...data.by_month.map(m => m.count))} reports per month`}>
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
                            tick={{
                              fill: "var(--color-muted-foreground)",
                              fontSize: 10,
                            }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            stroke="var(--color-muted-foreground)"
                            strokeOpacity={0.4}
                            tick={{
                              fill: "var(--color-muted-foreground)",
                              fontSize: 10,
                            }}
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
                          <Bar
                            dataKey="count"
                            fill="var(--color-ink)"
                            radius={[3, 3, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyState message="No monthly data available." />
                  )}
                </div>
              </div>

              {/* G3: Only show insights if we have sufficient data for trend */}
              {data.by_month.length >= 2 && (
                <div className="mt-8 rounded-2xl border-2 border-border bg-card p-6">
                  <h3 id="insights-title" className="font-display text-lg font-bold mb-4">
                    Insights & patterns
                  </h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <InsightCard
                      title="Trend direction"
                      description={
                        data.trend
                          ? data.trend.direction === "up"
                            ? `Reporting rate is increasing (+${data.trend.percentage}%)`
                            : data.trend.direction === "down"
                              ? `Reporting rate is decreasing (−${data.trend.percentage}%)`
                              : "Reporting rate is stable"
                          : "Insufficient data for trend calculation"
                      }
                      icon={
                        data.trend ? (
                          data.trend.direction === "up" ? (
                            <TrendingUp className="h-5 w-5 text-foreground/60" aria-hidden="true" />
                          ) : data.trend.direction === "down" ? (
                            <TrendingDown className="h-5 w-5 text-foreground/60" aria-hidden="true" />
                          ) : (
                            <Minus className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                          )
                        ) : (
                          <AlertCircle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
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
                      icon={<TrendingUp className="h-5 w-5 text-foreground/60" aria-hidden="true" />}
                    />
                    <InsightCard
                      title="Most active city"
                      description={
                        data.by_city.length > 0
                          ? `${data.by_city[0].city} — ${data.by_city[0].count} reports`
                          : "No data"
                      }
                      icon={<TrendingUp className="h-5 w-5 text-foreground/60" aria-hidden="true" />}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {!isLoading && !isError && (
        <p className="mt-8 rounded-2xl border border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground">
          Reports here are unverified allegations submitted by members of the
          public. Publication of aggregate counts does not constitute a finding of
          misconduct against any individual.
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  variant = "white",
  trend,
  isLoading,
}: {
  label: string;
  value: string;
  variant?: "white" | "ink";
  trend?: { direction: "up" | "down" | "stable"; percentage: number };
  isLoading?: boolean;
}) {
  return (
    <div className={`${variant === "ink" ? "card-ink" : "card-white"} p-6`}>
      <p
        className={`font-display text-xs uppercase tracking-widest ${variant === "ink" ? "text-white/60" : "text-muted-foreground"}`}
      >
        {label}
      </p>
      <div className="mt-2 flex items-end gap-2">
        <p className={`font-display text-4xl font-bold ${isLoading ? "animate-pulse" : ""}`}>
          {value}
        </p>
        {!isLoading && trend && (
          <div
            className={`mb-1 flex items-center gap-1 text-xs font-semibold ${
              trend.direction === "up"
                ? "text-foreground/70"
                : trend.direction === "down"
                  ? "text-foreground/70"
                  : "text-muted-foreground"
            }`}
          >
            {trend.direction === "up" && <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />}
            {trend.direction === "down" && (
              <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {trend.direction === "stable" && <Minus className="h-3.5 w-3.5" aria-hidden="true" />}
            <span>{trend.percentage}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-muted-foreground mb-3">
        {message || "No data available for this filter yet."}
      </p>
      <p className="text-xs text-muted-foreground/70">
        Try adjusting the date range or city filter to see results.
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-12 bg-muted rounded-lg"></div>
      <div className="h-12 bg-muted rounded-lg"></div>
      <div className="h-12 bg-muted rounded-lg"></div>
    </div>
  );
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
