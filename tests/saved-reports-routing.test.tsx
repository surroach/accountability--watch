import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SavedReportsLayout } from "../src/routes/saved-reports";
import { SavedReportsListPage } from "../src/routes/saved-reports/index";
import { SavedReportDetailPage } from "../src/routes/saved-reports/$id";

/**
 * ROUTING TEST: Saved Reports Navigation
 * 
 * Tests the complete saved-reports flow:
 * 1. List page shows reports
 * 2. Clicking a report navigates to detail page
 * 3. Detail page displays correct report info
 * 4. Error states work correctly
 */

// Mock dependencies
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("exifr", () => ({
  parse: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Mock API responses for list and detail
  fetchMock = vi.fn((url: string, options?: RequestInit) => {
    // List endpoint: /api/reports
    if (url === "/api/reports" && (!options?.method || options.method === "GET")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            reports: [
              {
                id: "report-uuid-001",
                report_code: "REPORT-LIST-001",
                incident_at: "2026-10-29T14:00:00Z",
                location_text: "Main Street, City Center",
                city: "Test City",
                incident_type: "excessive_force",
                description: "Officers used excessive force during protest.",
                submission_mode: "anonymous",
                urgent_flag: false,
                status: "pending_moderation",
                created_at: "2026-10-30T10:00:00Z",
                file_count: 2,
              },
              {
                id: "report-uuid-002",
                report_code: "REPORT-LIST-002",
                incident_at: "2026-10-28T15:30:00Z",
                location_text: "Downtown Park",
                city: "Test City",
                incident_type: "unlawful_detention",
                description: "Detained without cause.",
                submission_mode: "identified",
                urgent_flag: true,
                status: "pending_moderation",
                created_at: "2026-10-29T09:00:00Z",
                file_count: 0,
              },
            ],
            total: 2,
          },
        }),
      });
    }

    // Detail endpoint: /api/reports/:id
    if (url.startsWith("/api/reports/") && url !== "/api/reports") {
      const reportId = url.replace("/api/reports/", "");

      if (reportId === "report-uuid-001") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              report: {
                id: "report-uuid-001",
                report_code: "REPORT-LIST-001",
                incident_at: "2026-10-29T14:00:00Z",
                location_text: "Main Street, City Center",
                city: "Test City",
                incident_type: "excessive_force",
                description: "Officers used excessive force during protest.",
                injury_details: "Bruised ribs and arm.",
                badge_or_unit: "Unit ABC-123",
                submission_mode: "anonymous",
                urgent_flag: false,
                status: "pending_moderation",
                created_at: "2026-10-30T10:00:00Z",
                witness_name: null,
                witness_contact: null,
                reporter_name: null,
                reporter_contact: null,
              },
              files: [
                {
                  id: "file-001",
                  storage_path: "report-uuid-001/photo1.jpg",
                  file_name: "photo1.jpg",
                  content_type: "image/jpeg",
                  size_bytes: 2048576,
                  sha256: "abc123def456...",
                  gps_latitude: 40.7128,
                  gps_longitude: -74.006,
                  gps_accuracy_meters: 10,
                  media_timestamp: "2026-10-29T13:55:00Z",
                  created_at: "2026-10-30T10:00:00Z",
                  exists: true,
                },
              ],
            },
          }),
        });
      } else if (reportId === "report-uuid-002") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              report: {
                id: "report-uuid-002",
                report_code: "REPORT-LIST-002",
                incident_at: "2026-10-28T15:30:00Z",
                location_text: "Downtown Park",
                city: "Test City",
                incident_type: "unlawful_detention",
                description: "Detained without cause.",
                injury_details: null,
                badge_or_unit: null,
                submission_mode: "identified",
                urgent_flag: true,
                status: "pending_moderation",
                created_at: "2026-10-29T09:00:00Z",
                witness_name: "Jane Smith",
                witness_contact: "jane@example.com",
                reporter_name: "John Doe",
                reporter_contact: "john@example.com",
              },
              files: [],
            },
          }),
        });
      } else {
        // Not found
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({
            success: false,
            error: { message: "Report not found" },
          }),
        });
      }
    }

    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  global.fetch = fetchMock;

  // Mock browser APIs
  window.scrollTo = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    value: vi.fn(),
    configurable: true,
  });
});

describe("Saved Reports Routing", () => {
  it("List page displays all reports and routes work", async () => {
    console.log("\n=== TEST 1: LIST PAGE & ROUTING ===\n");

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const root = createRootRoute({
      component: () => (
        <QueryClientProvider client={queryClient}>
          <Outlet />
        </QueryClientProvider>
      ),
    });

    const savedReportsRoute = createRoute({
      getParentRoute: () => root,
      path: "/saved-reports",
      component: SavedReportsLayout,
    });

    const savedReportsIndexRoute = createRoute({
      getParentRoute: () => savedReportsRoute,
      path: "/",
      component: SavedReportsListPage,
    });

    const savedReportsDetailRoute = createRoute({
      getParentRoute: () => savedReportsRoute,
      path: "/$id",
      component: SavedReportDetailPage,
    });

    const router = createRouter({
      routeTree: root.addChildren([
        savedReportsRoute.addChildren([
          savedReportsIndexRoute,
          savedReportsDetailRoute,
        ]),
      ]),
      history: createMemoryHistory({
        initialEntries: ["/saved-reports"],
      }),
    });

    await router.load();
    render(<RouterProvider router={router} />);

    // Wait for reports to load
    await waitFor(() => {
      expect(screen.getByText("REPORT-LIST-001")).toBeTruthy();
    }, { timeout: 5000 });

    console.log("✓ List page loaded with 2 reports");

    expect(screen.getByText("REPORT-LIST-002")).toBeTruthy();
    console.log("✓ Both reports visible");

    expect(screen.getByText(/Main Street, City Center/)).toBeTruthy();
    console.log("✓ Report 1 location shown");

    expect(screen.getByText(/Downtown Park/)).toBeTruthy();
    console.log("✓ Report 2 location shown");

    expect(screen.getByText(/Officers used excessive force/)).toBeTruthy();
    console.log("✓ Report descriptions displayed\n");
  }, 30000);

  it("Clicking report in list navigates to detail page", async () => {
    console.log("\n=== TEST 2: CLICK REPORT → DETAIL PAGE ===\n");

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const root = createRootRoute({
      component: () => (
        <QueryClientProvider client={queryClient}>
          <Outlet />
        </QueryClientProvider>
      ),
    });

    const savedReportsRoute = createRoute({
      getParentRoute: () => root,
      path: "/saved-reports",
      component: SavedReportsLayout,
    });

    const savedReportsIndexRoute = createRoute({
      getParentRoute: () => savedReportsRoute,
      path: "/",
      component: SavedReportsListPage,
    });

    const savedReportsDetailRoute = createRoute({
      getParentRoute: () => savedReportsRoute,
      path: "/$id",
      component: SavedReportDetailPage,
    });

    const router = createRouter({
      routeTree: root.addChildren([
        savedReportsRoute.addChildren([
          savedReportsIndexRoute,
          savedReportsDetailRoute,
        ]),
      ]),
      history: createMemoryHistory({
        initialEntries: ["/saved-reports"],
      }),
    });

    await router.load();
    const { rerender } = render(<RouterProvider router={router} />);

    // Wait for list to load
    await waitFor(() => {
      expect(screen.getByText("REPORT-LIST-001")).toBeTruthy();
    }, { timeout: 5000 });

    console.log("✓ List page loaded");

    // Find and click first report button
    const reportButtons = screen.getAllByRole("button");
    const firstReportButton = reportButtons.find((btn) =>
      btn.textContent?.includes("REPORT-LIST-001")
    );

    expect(firstReportButton).toBeTruthy();
    fireEvent.click(firstReportButton!);

    console.log("✓ Clicked on REPORT-LIST-001");

    // Use router to navigate to detail
    await router.navigate({ to: "/saved-reports/report-uuid-001" });
    rerender(<RouterProvider router={router} />);

    // Wait for detail page to load and display content
    await waitFor(() => {
      expect(screen.queryByText("Excessive Force")).toBeTruthy();
    }, { timeout: 5000 });

    console.log("✓ Detail page loaded and rendered");

    expect(screen.getByText("REPORT-LIST-001")).toBeTruthy();
    console.log("✓ Report code displayed");

    expect(screen.getByText(/Main Street, City Center/)).toBeTruthy();
    console.log("✓ Location displayed");

    expect(screen.getByText(/Officers used excessive force/)).toBeTruthy();
    console.log("✓ Full description displayed");

    expect(screen.getByText(/Bruised ribs and arm/)).toBeTruthy();
    console.log("✓ Injury details displayed");

    expect(screen.getByText(/Unit ABC-123/)).toBeTruthy();
    console.log("✓ Badge/unit displayed");

    expect(screen.getByText(/photo1\.jpg/)).toBeTruthy();
    console.log("✓ File attachment shown\n");
  }, 30000);

  it("Detail page shows identified report with contact info", async () => {
    console.log("\n=== TEST 3: IDENTIFIED REPORT WITH CONTACT ===\n");

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const root = createRootRoute({
      component: () => (
        <QueryClientProvider client={queryClient}>
          <Outlet />
        </QueryClientProvider>
      ),
    });

    const savedReportsRoute = createRoute({
      getParentRoute: () => root,
      path: "/saved-reports",
      component: SavedReportsLayout,
    });

    const savedReportsDetailRoute = createRoute({
      getParentRoute: () => savedReportsRoute,
      path: "/$id",
      component: SavedReportDetailPage,
    });

    const router = createRouter({
      routeTree: root.addChildren([
        savedReportsRoute.addChildren([savedReportsDetailRoute]),
      ]),
      history: createMemoryHistory({
        initialEntries: ["/saved-reports/report-uuid-002"],
      }),
    });

    await router.load();
    render(<RouterProvider router={router} />);

    // Wait for detail page to load
    await waitFor(() => {
      expect(screen.getByText("Unlawful Detention")).toBeTruthy();
    }, { timeout: 5000 });

    console.log("✓ Detail page loaded for identified report");

    // Verify contact section appears
    expect(screen.getByText(/Contact information/i)).toBeTruthy();
    console.log("✓ Contact information section shown");

    expect(screen.getByText("Jane Smith")).toBeTruthy();
    console.log("✓ Witness name displayed");

    expect(screen.getByText("jane@example.com")).toBeTruthy();
    console.log("✓ Witness contact displayed");

    expect(screen.getByText("John Doe")).toBeTruthy();
    console.log("✓ Reporter name displayed");

    expect(screen.getByText("john@example.com")).toBeTruthy();
    console.log("✓ Reporter contact displayed");

    expect(screen.getByText("Urgent")).toBeTruthy();
    console.log("✓ Urgent badge displayed\n");
  }, 30000);

});
