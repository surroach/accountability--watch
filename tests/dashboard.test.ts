/**
 * Dashboard Test Suite
 * Tests data aggregation, filtering, and visualization
 */

import { describe, it, expect } from "vitest";

// Mock data aggregation functions
interface StatsResult {
  total_reports: number;
  by_city: Array<{ city: string; count: number }>;
  by_month: Array<{ month: string; count: number }>;
  trend?: {
    direction: "up" | "down" | "stable";
    percentage: number;
  };
}

// Store for testing
const store: Array<{
  id: string;
  location_text: string;
  city: string;
  incident_at: string;
  status: string;
}> = [];

function addReport(data: Partial<typeof store[0]>): void {
  store.push({
    id: Math.random().toString(36).substr(2, 9),
    location_text: data.location_text || "",
    city: data.city || "Unknown",
    incident_at: data.incident_at || new Date().toISOString(),
    status: data.status || "pending",
  });
}

function getPublicStats(filters: {
  from_date?: string;
  to_date?: string;
  city_filter?: string;
}): StatsResult {
  // Filter reports by date range
  let filtered = store.filter((r) => r.status === "pending");

  if (filters.from_date) {
    const fromDate = new Date(filters.from_date);
    filtered = filtered.filter((r) => new Date(r.incident_at) >= fromDate);
  }

  if (filters.to_date) {
    const toDate = new Date(filters.to_date);
    filtered = filtered.filter((r) => new Date(r.incident_at) <= toDate);
  }

  if (filters.city_filter) {
    const pattern = filters.city_filter.replace(/%/g, "");
    filtered = filtered.filter((r) =>
      r.city.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  // Group by city
  const by_city: { [key: string]: number } = {};
  filtered.forEach((r) => {
    by_city[r.city] = (by_city[r.city] || 0) + 1;
  });

  const by_city_array = Object.entries(by_city)
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count);

  // Group by month
  const by_month: { [key: string]: number } = {};
  filtered.forEach((r) => {
    const date = new Date(r.incident_at);
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    by_month[yearMonth] = (by_month[yearMonth] || 0) + 1;
  });

  const by_month_array = Object.entries(by_month)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Calculate trend
  let trend: StatsResult["trend"] | undefined;
  if (by_month_array.length >= 2) {
    const midpoint = Math.ceil(by_month_array.length / 2);
    const firstHalf = by_month_array
      .slice(0, midpoint)
      .reduce((sum, m) => sum + m.count, 0);
    const secondHalf = by_month_array
      .slice(midpoint)
      .reduce((sum, m) => sum + m.count, 0);

    if (firstHalf > 0) {
      const percentChange = ((secondHalf - firstHalf) / firstHalf) * 100;
      const direction =
        percentChange > 5 ? "up" : percentChange < -5 ? "down" : "stable";
      trend = {
        direction,
        percentage: Math.abs(Math.round(percentChange)),
      };
    }
  }

  return {
    total_reports: filtered.length,
    by_city: by_city_array,
    by_month: by_month_array,
    trend,
  };
}

describe("Dashboard - Data Aggregation", () => {
  beforeEach(() => {
    store.length = 0;
  });

  it("should return empty stats when no reports exist", () => {
    const stats = getPublicStats({});
    expect(stats.total_reports).toBe(0);
    expect(stats.by_city).toEqual([]);
    expect(stats.by_month).toEqual([]);
  });

  it("should count total reports correctly", () => {
    addReport({ city: "Delhi", incident_at: new Date().toISOString() });
    addReport({ city: "Delhi", incident_at: new Date().toISOString() });
    addReport({ city: "Mumbai", incident_at: new Date().toISOString() });

    const stats = getPublicStats({});
    expect(stats.total_reports).toBe(3);
  });

  it("should aggregate reports by city correctly", () => {
    addReport({ city: "Delhi", incident_at: new Date().toISOString() });
    addReport({ city: "Delhi", incident_at: new Date().toISOString() });
    addReport({ city: "Mumbai", incident_at: new Date().toISOString() });
    addReport({ city: "Bangalore", incident_at: new Date().toISOString() });

    const stats = getPublicStats({});
    expect(stats.by_city).toHaveLength(3);
    expect(stats.by_city[0].city).toBe("Delhi");
    expect(stats.by_city[0].count).toBe(2);
  });

  it("should sort cities by report count (descending)", () => {
    addReport({ city: "Mumbai", incident_at: new Date().toISOString() });
    addReport({ city: "Mumbai", incident_at: new Date().toISOString() });
    addReport({ city: "Mumbai", incident_at: new Date().toISOString() });
    addReport({ city: "Delhi", incident_at: new Date().toISOString() });
    addReport({ city: "Delhi", incident_at: new Date().toISOString() });
    addReport({ city: "Bangalore", incident_at: new Date().toISOString() });

    const stats = getPublicStats({});
    expect(stats.by_city[0].city).toBe("Mumbai");
    expect(stats.by_city[1].city).toBe("Delhi");
    expect(stats.by_city[2].city).toBe("Bangalore");
  });

  it("should aggregate reports by month correctly", () => {
    const jan = new Date("2025-01-15");
    const feb = new Date("2025-02-15");

    addReport({ city: "Delhi", incident_at: jan.toISOString() });
    addReport({ city: "Delhi", incident_at: jan.toISOString() });
    addReport({ city: "Mumbai", incident_at: feb.toISOString() });

    const stats = getPublicStats({});
    expect(stats.by_month).toHaveLength(2);
    expect(
      stats.by_month.find((m) => m.month.includes("2025-01"))?.count
    ).toBe(2);
    expect(
      stats.by_month.find((m) => m.month.includes("2025-02"))?.count
    ).toBe(1);
  });

  it("should sort months chronologically", () => {
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-03-15").toISOString(),
    });
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-01-15").toISOString(),
    });
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-02-15").toISOString(),
    });

    const stats = getPublicStats({});
    expect(stats.by_month[0].month).toContain("2025-01");
    expect(stats.by_month[1].month).toContain("2025-02");
    expect(stats.by_month[2].month).toContain("2025-03");
  });
});

describe("Dashboard - Date Filtering", () => {
  beforeEach(() => {
    store.length = 0;
  });

  it("should filter reports by start date", () => {
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-01-15").toISOString(),
    });
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-02-15").toISOString(),
    });
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-03-15").toISOString(),
    });

    const stats = getPublicStats({
      from_date: new Date("2025-02-01").toISOString(),
    });

    expect(stats.total_reports).toBe(2);
  });

  it("should filter reports by end date", () => {
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-01-15").toISOString(),
    });
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-02-15").toISOString(),
    });
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-03-15").toISOString(),
    });

    const stats = getPublicStats({
      to_date: new Date("2025-02-28").toISOString(),
    });

    expect(stats.total_reports).toBe(2);
  });

  it("should filter reports by date range", () => {
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-01-15").toISOString(),
    });
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-02-15").toISOString(),
    });
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-03-15").toISOString(),
    });

    const stats = getPublicStats({
      from_date: new Date("2025-02-01").toISOString(),
      to_date: new Date("2025-02-28").toISOString(),
    });

    expect(stats.total_reports).toBe(1);
    expect(stats.by_month[0].month).toContain("2025-02");
  });
});

describe("Dashboard - City Filtering", () => {
  beforeEach(() => {
    store.length = 0;
  });

  it("should filter reports by city name", () => {
    addReport({ city: "Delhi", incident_at: new Date().toISOString() });
    addReport({ city: "New Delhi", incident_at: new Date().toISOString() });
    addReport({ city: "Mumbai", incident_at: new Date().toISOString() });

    const stats = getPublicStats({
      city_filter: "%Delhi%",
    });

    expect(stats.total_reports).toBe(2);
  });

  it("should filter cities case-insensitively", () => {
    addReport({ city: "DELHI", incident_at: new Date().toISOString() });
    addReport({ city: "delhi", incident_at: new Date().toISOString() });
    addReport({ city: "Delhi", incident_at: new Date().toISOString() });

    const stats = getPublicStats({
      city_filter: "%delhi%",
    });

    expect(stats.total_reports).toBe(3);
  });

  it("should support partial city name matching", () => {
    addReport({ city: "New Delhi", incident_at: new Date().toISOString() });
    addReport({ city: "South Delhi", incident_at: new Date().toISOString() });
    addReport({ city: "Mumbai", incident_at: new Date().toISOString() });

    const stats = getPublicStats({
      city_filter: "%Delhi%",
    });

    expect(stats.total_reports).toBe(2);
  });

  it("should return empty results for non-matching city filter", () => {
    addReport({ city: "Delhi", incident_at: new Date().toISOString() });
    addReport({ city: "Mumbai", incident_at: new Date().toISOString() });

    const stats = getPublicStats({
      city_filter: "%Bangalore%",
    });

    expect(stats.total_reports).toBe(0);
  });
});

describe("Dashboard - Trend Analysis", () => {
  beforeEach(() => {
    store.length = 0;
  });

  it("should not calculate trend with less than 2 months of data", () => {
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-01-15").toISOString(),
    });

    const stats = getPublicStats({});
    expect(stats.trend).toBeUndefined();
  });

  it("should calculate uptrend when reports increase", () => {
    // First month: 2 reports
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-01-15").toISOString(),
    });
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-01-20").toISOString(),
    });

    // Second month: 5 reports (more than first)
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-02-05").toISOString(),
    });
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-02-10").toISOString(),
    });
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-02-15").toISOString(),
    });

    const stats = getPublicStats({});
    expect(stats.trend?.direction).toBe("up");
    expect(stats.trend?.percentage).toBeGreaterThan(0);
  });

  it("should calculate downtrend when reports decrease", () => {
    // First month: 5 reports
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-01-05").toISOString(),
    });
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-01-10").toISOString(),
    });
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-01-15").toISOString(),
    });
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-01-20").toISOString(),
    });
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-01-25").toISOString(),
    });

    // Second month: 2 reports (less than first)
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-02-10").toISOString(),
    });
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-02-20").toISOString(),
    });

    const stats = getPublicStats({});
    expect(stats.trend?.direction).toBe("down");
    expect(stats.trend?.percentage).toBeGreaterThan(0);
  });

  it("should show stable trend when reports stay similar", () => {
    // First month: 3 reports
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-01-10").toISOString(),
    });
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-01-15").toISOString(),
    });
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-01-20").toISOString(),
    });

    // Second month: 3 reports (same as first)
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-02-10").toISOString(),
    });
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-02-15").toISOString(),
    });
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-02-20").toISOString(),
    });

    const stats = getPublicStats({});
    expect(stats.trend?.direction).toBe("stable");
  });
});

describe("Dashboard - Combined Filtering", () => {
  beforeEach(() => {
    store.length = 0;
  });

  it("should apply all filters together", () => {
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-01-15").toISOString(),
    });
    addReport({
      city: "Delhi",
      incident_at: new Date("2025-02-15").toISOString(),
    });
    addReport({
      city: "Mumbai",
      incident_at: new Date("2025-02-15").toISOString(),
    });
    addReport({
      city: "Bangalore",
      incident_at: new Date("2025-02-15").toISOString(),
    });

    const stats = getPublicStats({
      from_date: new Date("2025-02-01").toISOString(),
      to_date: new Date("2025-02-28").toISOString(),
      city_filter: "%Delhi%",
    });

    expect(stats.total_reports).toBe(1);
    expect(stats.by_city[0].city).toBe("Delhi");
  });
});
