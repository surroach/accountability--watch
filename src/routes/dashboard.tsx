import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
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
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  RefreshCw,
  Calendar,
  MapPin,
  BarChart3,
  Map,
  Activity,
  Inbox,
  Building2,
  Star,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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
  trend?: { direction: "up" | "down" | "stable"; percentage: number; months?: string };
  previous_period_total?: number;
};

function Dashboard() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [city, setCity] = useState("");
  const [debouncedCity, setDebouncedCity] = useState("");
  const chartRef = useRef<HTMLDivElement>(null);

  // Compute from/to dates based on year/month selection
  const computedFromDate = year && month 
    ? `${year}-${String(month).padStart(2, "0")}-01`
    : from;
  
  const computedToDate = year && month
    ? (() => {
        const date = new Date(`${year}-${String(month).padStart(2, "0")}-01`);
        date.setMonth(date.getMonth() + 1);
        date.setDate(date.getDate() - 1);
        return date.toISOString().split("T")[0];
      })()
    : to;

  // Debounce city filter to reduce query calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCity(city);
    }, 300);
    return () => clearTimeout(timer);
  }, [city]);

  const { data, isLoading, error, isError, refetch } = useQuery({
    queryKey: ["public-stats", computedFromDate, computedToDate, debouncedCity],
    queryFn: async (): Promise<Stats> => {
      // Validate date range before querying
      if (computedFromDate && computedToDate) {
        const fromDate = new Date(computedFromDate);
        const toDate = new Date(computedToDate);
        if (fromDate > toDate) {
          throw new Error("Start date cannot be after end date");
        }
      }
      
      const args: Record<string, string> = {};
      if (computedFromDate) args.from_date = new Date(computedFromDate).toISOString();
      if (computedToDate) args.to_date = new Date(computedToDate).toISOString();
      if (debouncedCity) args.city_filter = `%${debouncedCity}%`;
      
      // Use ONLY local SQLite API (no Supabase fallback)
      const params = new URLSearchParams(args);
      const response = await fetch(`/api/stats?${params}`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const apiData = await response.json();
      if (!apiData.success || !apiData.data) {
        throw new Error("Invalid API response structure");
      }
      
      const row = apiData.data;
      const total_reports = Number(row.total_reports ?? 0);
      const by_city = (row.by_city as any) ?? [];
      const by_month = (row.by_month as any) ?? [];

      // Calculate trend comparing the two most recent months
      let trend:
        { direction: "up" | "down" | "stable"; percentage: number; months?: string } | undefined;
      
      if (by_month.length >= 2) {
        // Get the two most recent months (reverse order from API)
        const months = [...by_month].reverse(); // Most recent first
        const currentMonth = months[0];
        const previousMonth = months[1];

        if (currentMonth && previousMonth) {
          const currentCount = currentMonth.count;
          const previousCount = previousMonth.count;

          if (previousCount > 0) {
            const percentChange = ((currentCount - previousCount) / previousCount) * 100;
            const direction =
              percentChange > 5 ? "up" : percentChange < -5 ? "down" : "stable";
            trend = {
              direction,
              percentage: Math.abs(Math.round(percentChange)),
              months: `${previousMonth.month} → ${currentMonth.month}`,
            };
          } else if (currentCount > 0) {
            // If previous month was 0 but current has reports
            trend = {
              direction: "up",
              percentage: 100,
              months: `${previousMonth.month} → ${currentMonth.month}`,
            };
          }
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
    retry: 1,
  });

  async function exportCSV() {
    if (!data) return;
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `accountability-watch-${timestamp}.csv`;

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
        backgroundColor: "#0f0f0f",
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

      pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
      heightLeft -= (pdf.internal.pageSize.height - 20);

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
        heightLeft -= pdf.internal.pageSize.height;
      }

      pdf.save(filename);
      toast.success("Report exported as PDF");
    } catch (err) {
      console.error("PDF export failed:", err);
      toast.error("Failed to export PDF");
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 md:mb-12">
          <h1 className="text-4xl md:text-5xl font-bold font-display tracking-tight mb-2">
            Accountability Watch
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Anonymized, aggregate incident data — No individual identifiers
          </p>
        </div>

        {/* Controls */}
        <div className="card-white p-4 md:p-6 mb-8">
          {/* Filter Type Selector */}
          <div className="mb-4 pb-4 border-b border-border">
            <p className="text-xs font-semibold uppercase tracking-widest text-foreground mb-3">Filter type:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setYear("");
                  setMonth("");
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  !year && !month
                    ? "bg-ink text-ink-foreground"
                    : "border border-border text-foreground hover:bg-muted"
                }`}
              >
                Date Range
              </button>
              <button
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  year || month
                    ? "bg-ink text-ink-foreground"
                    : "border border-border text-foreground hover:bg-muted"
                }`}
              >
                Year & Month
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* Date Filters */}
            {!year && !month ? (
              <>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-foreground">
                    <Calendar className="inline-block h-3.5 w-3.5 mr-1" />
                    From Date
                  </label>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-foreground">
                    <Calendar className="inline-block h-3.5 w-3.5 mr-1" />
                    To Date
                  </label>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-foreground">
                    <MapPin className="inline-block h-3.5 w-3.5 mr-1" />
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="Search city..."
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm placeholder-muted-foreground focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setFrom("");
                      setTo("");
                      setCity("");
                      refetch();
                    }}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:border-ink transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-foreground">
                    Year
                  </label>
                  <input
                    type="number"
                    min="2020"
                    max={new Date().getFullYear()}
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="YYYY"
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-foreground">
                    Month
                  </label>
                  <select
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink"
                  >
                    <option value="">Select month</option>
                    {Array.from({ length: 12 }, (_, i) => {
                      const m = i + 1;
                      const monthName = new Date(2025, m - 1).toLocaleString("en-US", { month: "long" });
                      return (
                        <option key={m} value={m}>
                          {monthName}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-foreground">
                    <MapPin className="inline-block h-3.5 w-3.5 mr-1" />
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="Search city..."
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm placeholder-muted-foreground focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setYear("");
                      setMonth("");
                      setCity("");
                      refetch();
                    }}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:border-ink transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Control Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-4 py-2 bg-ink text-ink-foreground hover:bg-ink/90 rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              onClick={exportCSV}
              disabled={!data || data.total_reports === 0}
              className="flex items-center gap-2 px-4 py-2 bg-lime text-lime-foreground hover:bg-lime/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              onClick={exportPDF}
              disabled={!data || data.total_reports === 0}
              className="flex items-center gap-2 px-4 py-2 border border-border text-foreground hover:bg-muted rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="h-4 w-4" />
              Export PDF
            </button>
          </div>
        </div>

        {/* Main Content */}
        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="card-white p-6 animate-pulse"
                >
                  <div className="h-3 bg-muted rounded w-24 mb-4"></div>
                  <div className="h-10 bg-muted rounded w-32"></div>
                </div>
              ))}
            </div>
          </div>
        ) : isError || error ? (
          <div className="card-white border-destructive/50 bg-destructive/5 p-6">
            <p className="font-display font-semibold mb-1 text-destructive">Error loading statistics</p>
            <p className="text-sm text-muted-foreground">{error?.message || "Unknown error"}</p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-ink text-ink-foreground hover:bg-ink/90 rounded-lg text-sm font-medium transition-colors"
            >
              Try again
            </button>
          </div>
        ) : data && data.total_reports > 0 ? (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <StatCard
                label="Total Reports"
                value={data.total_reports.toString()}
                icon={<BarChart3 className="h-6 w-6" />}
                variant="primary"
              />
              <StatCard
                label="Cities Represented"
                value={data.by_city.filter(c => c.city && c.city.trim()).length.toString()}
                icon={<Map className="h-6 w-6" />}
                variant="secondary"
              />
              <StatCard
                label="Months with Reports"
                value={data.by_month.length.toString()}
                icon={<Calendar className="h-6 w-6" />}
                variant="primary"
              />
              <StatCard
                label="Reporting Trend"
                value={
                  data.trend
                    ? `${data.trend.direction === "up" ? "↑" : data.trend.direction === "down" ? "↓" : "→"} ${data.trend.percentage}%`
                    : "—"
                }
                icon={<Activity className="h-6 w-6" />}
                variant="tertiary"
              />
            </div>

            {/* Charts Section */}
            <div ref={chartRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Reports by Month */}
              <div className="card-white p-6">
                <h2 className="text-lg font-display font-bold mb-4">Reports Over Time</h2>
                {data.by_month && data.by_month.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.by_month} margin={{ top: 16, right: 16, left: -20, bottom: 16 }}>
                      <XAxis
                        dataKey="month"
                        stroke="var(--color-muted-foreground)"
                        style={{ fontSize: "12px" }}
                        axisLine={{ stroke: "var(--color-border)" }}
                      />
                      <YAxis 
                        stroke="var(--color-muted-foreground)" 
                        style={{ fontSize: "12px" }}
                        axisLine={{ stroke: "var(--color-border)" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "8px",
                          color: "var(--color-foreground)",
                        }}
                        cursor={{ fill: "var(--color-lime)" }}
                      />
                      <Bar
                        dataKey="count"
                        fill="var(--color-lime)"
                        radius={[8, 8, 0, 0]}
                        isAnimationActive={true}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                    No monthly data available
                  </div>
                )}
              </div>

              {/* Reports by City */}
              <div className="card-white p-6">
                <h2 className="text-lg font-display font-bold mb-4">Reports by City</h2>
                {data.by_city && data.by_city.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {data.by_city
                      .filter(c => c.city && c.city.trim())
                      .slice(0, 10)
                      .map((c, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">
                                {c.city}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 ml-2">
                            <div className="w-24 bg-muted rounded-full h-2">
                              <div
                                className="bg-lime h-2 rounded-full transition-all"
                                style={{
                                  width: `${(c.count / Math.max(...data.by_city.filter(x => x.city).map((x) => x.count))) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="highlight-lime font-semibold min-w-fit text-sm">
                              {c.count}
                            </span>
                          </div>
                        </div>
                      ))}
                    {data.by_city.filter(c => c.city && c.city.trim()).length > 10 && (
                      <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                        +{data.by_city.filter(c => c.city && c.city.trim()).length - 10} more cities
                      </p>
                    )}
                    {data.by_city.some(c => !c.city || !c.city.trim()) && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                          City not specified
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Reports without a city</span>
                          <span className="text-sm font-semibold">
                            {data.by_city.find(c => !c.city || !c.city.trim())?.count || 0}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                    No city data available
                  </div>
                )}
              </div>
            </div>

            {/* Insights */}
            {data.by_month && data.by_month.length >= 2 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <InsightCard
                  title="Trend"
                  value={
                    data.trend?.direction === "up"
                      ? `Increasing +${data.trend.percentage}%`
                      : data.trend?.direction === "down"
                        ? `Decreasing −${data.trend.percentage}%`
                        : "Stable"
                  }
                  subtitle={data.trend?.months ? `${data.trend.months}` : undefined}
                  icon={
                    data.trend?.direction === "up"
                      ? <TrendingUp className="h-5 w-5 text-lime" />
                      : data.trend?.direction === "down"
                        ? <TrendingDown className="h-5 w-5 text-destructive" />
                        : <Minus className="h-5 w-5 text-muted-foreground" />
                  }
                />
                <InsightCard
                  title="Peak Month"
                  value={
                    data.by_month.reduce((max, m) =>
                      m.count > max.count ? m : max
                    ).month
                  }
                  subtitle={`${data.by_month.reduce((max, m) =>
                    m.count > max.count ? m : max
                  ).count} reports`}
                  icon={<TrendingUp className="h-5 w-5 text-lime" />}
                />
                <InsightCard
                  title="Most Active City"
                  value={data.by_city.filter(c => c.city && c.city.trim()).length > 0 ? data.by_city.filter(c => c.city && c.city.trim())[0]?.city || "Unknown" : "N/A"}
                  subtitle={data.by_city.filter(c => c.city && c.city.trim()).length > 0 ? `${data.by_city.filter(c => c.city && c.city.trim())[0]?.count || 0} reports` : "No city data"}
                  icon={<MapPin className="h-5 w-5 text-ink" />}
                />
              </div>
            )}

            {/* Disclaimer */}
            <div className="card-white border-accent/50 bg-accent/5 p-4 text-sm leading-relaxed text-foreground">
              Reports here are unverified allegations submitted by members of the public. Publication of aggregate counts does not constitute a finding of misconduct against any individual.
            </div>
          </>
        ) : (
          <div className="card-white p-12 text-center">
            <div className="text-muted-foreground mb-4 flex justify-center">
              <Inbox className="h-16 w-16" />
            </div>
            <h3 className="text-lg font-display font-bold mb-2">No Reports Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto text-sm">
              No reports match your filters. Try adjusting the date range or city filter to see results.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  variant = "primary",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant?: "primary" | "secondary" | "tertiary";
}) {
  const bgColors = {
    primary: "bg-lime/10 border-lime/30",
    secondary: "bg-ink/10 border-ink/30",
    tertiary: "bg-accent/10 border-accent/30",
  };

  const textColors = {
    primary: "text-ink",
    secondary: "text-ink",
    tertiary: "text-ink",
  };

  const iconColors = {
    primary: "text-lime",
    secondary: "text-ink",
    tertiary: "text-ink",
  };

  return (
    <div
      className={`${bgColors[variant]} border rounded-2xl p-6 transition-all hover:scale-105 cursor-pointer card-white`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2 text-foreground">
            {label}
          </p>
          <p className={`text-4xl md:text-5xl font-bold font-display ${textColors[variant]}`}>
            {value}
          </p>
        </div>
        <div className={`opacity-60 ${iconColors[variant]}`}>{icon}</div>
      </div>
    </div>
  );
}

function InsightCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="card-white p-4 hover:border-lime/50 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1 text-ink">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1 text-foreground">
            {title}
          </p>
          <p className="text-lg font-display font-bold text-ink truncate">{value}</p>
          {subtitle && <p className="text-xs text-foreground mt-1">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
