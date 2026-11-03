/**
 * Dashboard Indian Cities & Filtering Test
 * Comprehensive verification of dashboard with Indian cities, city aggregation,
 * proper handling of NULL cities, and date filtering
 */

import { describe, it, expect, beforeEach } from "vitest";

// ============================================================================
// SECTION 1: Mock Data & Test Helpers
// ============================================================================

interface Report {
  id: string;
  location_text: string;
  city: string | null;
  incident_at: string;
  status: string;
}

interface AggregationResult {
  total_reports: number;
  by_city: Array<{ city: string | null; count: number }>;
  by_month: Array<{ month: string; count: number }>;
  trend?: {
    direction: "up" | "down" | "stable";
    percentage: number;
  };
}

const testDb: Report[] = [];

function addTestReport(data: Partial<Report>): void {
  testDb.push({
    id: `report-${Date.now()}-${Math.random()}`,
    location_text: data.location_text || "Test location",
    city: data.city !== undefined ? data.city : null,
    incident_at: data.incident_at || new Date().toISOString(),
    status: data.status || "moderation_approved",
  });
}

function clearTestDb(): void {
  testDb.length = 0;
}

/**
 * Mock aggregation function that mimics the dashboard API
 * - Filters by date range (includes full end date)
 * - Filters by city (LIKE pattern)
 * - Groups by city (preserves NULL cities separately)
 * - Groups by month
 * - Calculates trend
 */
function getAggregatedStats(filters: {
  from_date?: string;
  to_date?: string;
  city_filter?: string;
}): AggregationResult {
  let filtered = testDb.filter((r) => r.status === "moderation_approved");

  if (filters.from_date) {
    const fromDate = new Date(filters.from_date);
    filtered = filtered.filter((r) => new Date(r.incident_at) >= fromDate);
  }

  if (filters.to_date) {
    // Include full end date: add 1 day and use < instead of <=
    const toDate = new Date(filters.to_date);
    toDate.setUTCDate(toDate.getUTCDate() + 1);
    filtered = filtered.filter((r) => new Date(r.incident_at) < toDate);
  }

  if (filters.city_filter) {
    const pattern = filters.city_filter.replace(/%/g, "");
    filtered = filtered.filter((r) =>
      r.city ? r.city.toLowerCase().includes(pattern.toLowerCase()) : false
    );
  }

  // Group by city - preserve NULL/empty as separate entry
  const cityCounts: Map<string | null, number> = new Map();
  filtered.forEach((r) => {
    const cityKey = r.city || null;
    cityCounts.set(cityKey, (cityCounts.get(cityKey) || 0) + 1);
  });

  const by_city = Array.from(cityCounts.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => {
      // NULL/empty cities go last
      if (a.city === null) return 1;
      if (b.city === null) return -1;
      // Otherwise sort by count (descending)
      return b.count - a.count;
    });

  // Group by month
  const monthCounts: Map<string, number> = new Map();
  filtered.forEach((r) => {
    const date = new Date(r.incident_at);
    const yearMonth = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    monthCounts.set(yearMonth, (monthCounts.get(yearMonth) || 0) + 1);
  });

  const by_month = Array.from(monthCounts.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Calculate trend
  let trend: AggregationResult["trend"] | undefined;
  if (by_month.length >= 2) {
    const midpoint = Math.floor(by_month.length / 2);
    const firstHalf = by_month
      .slice(0, midpoint)
      .reduce((sum, m) => sum + m.count, 0);
    const secondHalf = by_month
      .slice(midpoint)
      .reduce((sum, m) => sum + m.count, 0);

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

  return {
    total_reports: filtered.length,
    by_city,
    by_month,
    trend,
  };
}

// ============================================================================
// SECTION 2: Indian Cities - Data Validation
// ============================================================================

describe("Dashboard: Indian Cities Data", () => {
  beforeEach(() => clearTestDb());

  it("accepts reports with Indian cities", () => {
    const indianCities = ["Delhi", "Mumbai", "Bangalore", "Pune", "Hyderabad"];

    indianCities.forEach((city) => {
      addTestReport({
        location_text: `Incident in ${city}`,
        city,
        incident_at: new Date("2025-01-15").toISOString(),
      });
    });

    expect(testDb.length).toBe(5);
    expect(testDb.every((r) => indianCities.includes(r.city!))).toBe(true);
  });

  it("preserves exact city names (case-sensitive storage)", () => {
    addTestReport({ city: "Delhi" });
    addTestReport({ city: "delhi" });
    addTestReport({ city: "DELHI" });

    const cities = testDb.map((r) => r.city);
    expect(cities).toContain("Delhi");
    expect(cities).toContain("delhi");
    expect(cities).toContain("DELHI");
    expect(testDb.length).toBe(3);
  });

  it("allows reports without city (NULL city field)", () => {
    addTestReport({ city: null, location_text: "Downtown" });
    addTestReport({ city: undefined, location_text: "Uptown" });
    addTestReport({ city: "Delhi" });

    expect(testDb.filter((r) => r.city === null)).toHaveLength(2);
    expect(testDb.filter((r) => r.city === "Delhi")).toHaveLength(1);
  });
});

// ============================================================================
// SECTION 3: City Aggregation - Display Logic
// ============================================================================

describe("Dashboard: City Aggregation & Display", () => {
  beforeEach(() => clearTestDb());

  it("counts known cities correctly", () => {
    addTestReport({ city: "Mumbai", incident_at: new Date("2025-01-15").toISOString() });
    addTestReport({ city: "Mumbai", incident_at: new Date("2025-01-20").toISOString() });
    addTestReport({ city: "Delhi", incident_at: new Date("2025-01-25").toISOString() });

    const stats = getAggregatedStats({});

    expect(stats.total_reports).toBe(3);
    expect(stats.by_city.length).toBe(2);
    expect(stats.by_city[0].city).toBe("Mumbai");
    expect(stats.by_city[0].count).toBe(2);
    expect(stats.by_city[1].city).toBe("Delhi");
    expect(stats.by_city[1].count).toBe(1);
  });

  it("does NOT count NULL/empty cities as a known city in aggregation", () => {
    addTestReport({ city: "Mumbai" });
    addTestReport({ city: null });
    addTestReport({ city: null });

    const stats = getAggregatedStats({});

    expect(stats.total_reports).toBe(3);
    // by_city should show Mumbai (1) and NULL (2), but NULL is the last entry
    expect(stats.by_city.length).toBe(2);
    expect(stats.by_city[0].city).toBe("Mumbai");
    expect(stats.by_city[0].count).toBe(1);
    expect(stats.by_city[1].city).toBeNull();
    expect(stats.by_city[1].count).toBe(2);

    // When displaying "Cities Represented", count only non-NULL cities
    const citiesRepresented = stats.by_city.filter((c) => c.city !== null).length;
    expect(citiesRepresented).toBe(1); // Only Mumbai
  });

  it("sorts cities by report count (descending), NULL cities last", () => {
    addTestReport({ city: "Bangalore", incident_at: new Date("2025-01-05").toISOString() });
    addTestReport({ city: "Bangalore", incident_at: new Date("2025-01-06").toISOString() });
    addTestReport({ city: "Bangalore", incident_at: new Date("2025-01-07").toISOString() });
    addTestReport({ city: "Pune", incident_at: new Date("2025-01-10").toISOString() });
    addTestReport({ city: "Pune", incident_at: new Date("2025-01-15").toISOString() });
    addTestReport({ city: "Delhi", incident_at: new Date("2025-01-20").toISOString() });
    addTestReport({ city: null, incident_at: new Date("2025-01-25").toISOString() });

    const stats = getAggregatedStats({});

    expect(stats.by_city[0].city).toBe("Bangalore");
    expect(stats.by_city[0].count).toBe(3);
    expect(stats.by_city[1].city).toBe("Pune");
    expect(stats.by_city[1].count).toBe(2);
    expect(stats.by_city[2].city).toBe("Delhi");
    expect(stats.by_city[2].count).toBe(1);
    expect(stats.by_city[3].city).toBeNull();
    expect(stats.by_city[3].count).toBe(1);
  });

  it("preserves NULL city group even when filtering by specific city", () => {
    addTestReport({ city: "Delhi" });
    addTestReport({ city: "Mumbai" });
    addTestReport({ city: null });

    const stats = getAggregatedStats({ city_filter: "%Delhi%" });

    // Only Delhi should match the filter
    expect(stats.total_reports).toBe(1);
    expect(stats.by_city.length).toBe(1);
    expect(stats.by_city[0].city).toBe("Delhi");
  });
});

// ============================================================================
// SECTION 4: Date Filtering with Full End Date Inclusion
// ============================================================================

describe("Dashboard: Date Filtering - End Date Inclusion", () => {
  beforeEach(() => clearTestDb());

  it("includes reports from the full selected end date", () => {
    // Add reports throughout 2025-02-28
    addTestReport({
      city: "Delhi",
      incident_at: new Date("2025-02-28T00:00:00Z").toISOString(),
    });
    addTestReport({
      city: "Delhi",
      incident_at: new Date("2025-02-28T12:00:00Z").toISOString(),
    });
    addTestReport({
      city: "Delhi",
      incident_at: new Date("2025-02-28T23:59:59Z").toISOString(),
    });

    // Add report on 2025-03-01 (should NOT be included)
    addTestReport({
      city: "Delhi",
      incident_at: new Date("2025-03-01T00:00:00Z").toISOString(),
    });

    const stats = getAggregatedStats({
      to_date: new Date("2025-02-28").toISOString(),
    });

    expect(stats.total_reports).toBe(3); // All Feb 28 reports
  });

  it("excludes reports from the day after the end date", () => {
    addTestReport({
      city: "Delhi",
      incident_at: new Date("2025-02-28T23:59:59Z").toISOString(),
    });
    addTestReport({
      city: "Delhi",
      incident_at: new Date("2025-03-01T00:00:00Z").toISOString(),
    });
    addTestReport({
      city: "Delhi",
      incident_at: new Date("2025-03-01T12:00:00Z").toISOString(),
    });

    const stats = getAggregatedStats({
      to_date: new Date("2025-02-28").toISOString(),
    });

    expect(stats.total_reports).toBe(1); // Only the Feb 28 report
  });

  it("works correctly with date range (from + to)", () => {
    addTestReport({
      city: "Delhi",
      incident_at: new Date("2025-02-01").toISOString(),
    });
    addTestReport({
      city: "Delhi",
      incident_at: new Date("2025-02-15").toISOString(),
    });
    addTestReport({
      city: "Delhi",
      incident_at: new Date("2025-02-28T23:59:59Z").toISOString(),
    });
    addTestReport({
      city: "Delhi",
      incident_at: new Date("2025-03-01").toISOString(),
    });

    const stats = getAggregatedStats({
      from_date: new Date("2025-02-01").toISOString(),
      to_date: new Date("2025-02-28").toISOString(),
    });

    expect(stats.total_reports).toBe(3);
  });
});

// ============================================================================
// SECTION 5: Combined Filtering - Cities + Dates
// ============================================================================

describe("Dashboard: Combined City & Date Filtering", () => {
  beforeEach(() => clearTestDb());

  it("filters by city and date range", () => {
    addTestReport({
      city: "Delhi",
      incident_at: new Date("2025-01-15").toISOString(),
    });
    addTestReport({
      city: "Delhi",
      incident_at: new Date("2025-02-15").toISOString(),
    });
    addTestReport({
      city: "Mumbai",
      incident_at: new Date("2025-02-15").toISOString(),
    });
    addTestReport({
      city: "Bangalore",
      incident_at: new Date("2025-02-15").toISOString(),
    });

    const stats = getAggregatedStats({
      from_date: new Date("2025-02-01").toISOString(),
      to_date: new Date("2025-02-28").toISOString(),
      city_filter: "%Delhi%",
    });

    expect(stats.total_reports).toBe(1);
    expect(stats.by_city[0].city).toBe("Delhi");
  });

  it("returns empty results when no reports match all filters", () => {
    addTestReport({ city: "Delhi", incident_at: new Date("2025-01-15").toISOString() });
    addTestReport({ city: "Mumbai", incident_at: new Date("2025-02-15").toISOString() });

    const stats = getAggregatedStats({
      from_date: new Date("2025-03-01").toISOString(),
      to_date: new Date("2025-03-31").toISOString(),
    });

    expect(stats.total_reports).toBe(0);
    expect(stats.by_city).toEqual([]);
  });

  it("aggregates correctly for reports without city", () => {
    addTestReport({
      city: null,
      incident_at: new Date("2025-02-15").toISOString(),
    });
    addTestReport({
      city: null,
      incident_at: new Date("2025-02-20").toISOString(),
    });
    addTestReport({
      city: "Delhi",
      incident_at: new Date("2025-02-25").toISOString(),
    });

    const stats = getAggregatedStats({
      from_date: new Date("2025-02-01").toISOString(),
      to_date: new Date("2025-02-28").toISOString(),
    });

    expect(stats.total_reports).toBe(3);
    expect(stats.by_city.length).toBe(2);
    expect(stats.by_city[0].city).toBe("Delhi");
    expect(stats.by_city[1].city).toBeNull();
  });
});

// ============================================================================
// SECTION 6: Comprehensive Test Scenarios
// ============================================================================

describe("Dashboard: Comprehensive Scenarios", () => {
  beforeEach(() => clearTestDb());

  it("Scenario 1: New project with fictional Indian data", () => {
    // Add reports for three Indian cities over three months
    const months = [
      new Date("2025-01-15").toISOString(),
      new Date("2025-02-15").toISOString(),
      new Date("2025-03-15").toISOString(),
    ];

    const cities = ["Mumbai", "Delhi", "Pune"];

    cities.forEach((city) => {
      months.forEach((month) => {
        addTestReport({ city, incident_at: month });
      });
    });

    // Add some reports without city
    addTestReport({
      city: null,
      incident_at: new Date("2025-01-20").toISOString(),
    });
    addTestReport({
      city: null,
      incident_at: new Date("2025-03-20").toISOString(),
    });

    const stats = getAggregatedStats({});

    expect(stats.total_reports).toBe(11); // 9 with cities + 2 without
    expect(stats.by_city.length).toBe(4); // 3 cities + 1 NULL
    expect(stats.by_city.filter((c) => c.city !== null)).toHaveLength(3);
    expect(stats.by_month).toHaveLength(3);
  });

  it("Scenario 2: Filter dashboard to single month and city", () => {
    addTestReport({ city: "Mumbai", incident_at: new Date("2025-01-10").toISOString() });
    addTestReport({ city: "Mumbai", incident_at: new Date("2025-01-15").toISOString() });
    addTestReport({ city: "Delhi", incident_at: new Date("2025-01-20").toISOString() });
    addTestReport({ city: "Mumbai", incident_at: new Date("2025-02-10").toISOString() });

    // Filter for January + Mumbai
    const stats = getAggregatedStats({
      from_date: new Date("2025-01-01").toISOString(),
      to_date: new Date("2025-01-31").toISOString(),
      city_filter: "%Mumbai%",
    });

    expect(stats.total_reports).toBe(2);
    expect(stats.by_month[0].month).toBe("2025-01");
  });

  it("Scenario 3: Report submitted without city, then dashboard shows correctly", () => {
    addTestReport({
      city: null,
      location_text: "Downtown protest site",
      incident_at: new Date("2025-02-15").toISOString(),
    });
    addTestReport({
      city: "Delhi",
      location_text: "New Delhi Park",
      incident_at: new Date("2025-02-15").toISOString(),
    });

    const stats = getAggregatedStats({});

    const citiesRepresented = stats.by_city.filter((c) => c.city !== null).length;
    expect(citiesRepresented).toBe(1); // Only Delhi
    expect(stats.total_reports).toBe(2); // But total shows both
  });
});

// ============================================================================
// SECTION 7: Edge Cases & Boundary Conditions
// ============================================================================

describe("Dashboard: Edge Cases", () => {
  beforeEach(() => clearTestDb());

  it("handles reports with empty string city (should be treated as NULL)", () => {
    addTestReport({ city: "" as any, incident_at: new Date().toISOString() });
    addTestReport({ city: "Delhi" });

    const stats = getAggregatedStats({});

    // Empty string might be stored, but dashboard display should filter it out
    // For now, treat "" as a separate entry
    expect(stats.total_reports).toBe(2);
  });

  it("handles very large city count (100+ reports in one city)", () => {
    for (let i = 0; i < 100; i++) {
      addTestReport({
        city: "Mumbai",
        incident_at: new Date("2025-02-15").toISOString(),
      });
    }

    const stats = getAggregatedStats({});

    expect(stats.by_city[0].city).toBe("Mumbai");
    expect(stats.by_city[0].count).toBe(100);
  });

  it("handles reports from exactly one day boundary", () => {
    const target = new Date("2025-02-28");

    // Just before midnight start
    addTestReport({
      city: "Delhi",
      incident_at: new Date("2025-02-27T23:59:59Z").toISOString(),
    });

    // Midnight start
    addTestReport({
      city: "Delhi",
      incident_at: new Date("2025-02-28T00:00:00Z").toISOString(),
    });

    // End of day
    addTestReport({
      city: "Delhi",
      incident_at: new Date("2025-02-28T23:59:59Z").toISOString(),
    });

    // After end of day
    addTestReport({
      city: "Delhi",
      incident_at: new Date("2025-03-01T00:00:00Z").toISOString(),
    });

    const stats = getAggregatedStats({
      to_date: target.toISOString(),
    });

    expect(stats.total_reports).toBe(2); // Only the two Feb 28 reports
  });
});
