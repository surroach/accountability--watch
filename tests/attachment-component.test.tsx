import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RootRoute, createRouter, RouterProvider, createRoute } from "@tanstack/react-router";
import { Outlet } from "@tanstack/react-router";
import { SavedReportDetailPage } from "../src/routes/saved-reports/$id";
import { createMemoryHistory } from "@tanstack/react-router";

describe("Attachment Download - Component Tests", () => {
  beforeEach(() => {
    // Mock fetch with real test data
    global.fetch = vi.fn((url: string) => {
      console.log(`[FETCH] GET ${url}`);

      // GET /api/reports/:id with available and missing files
      if (url.includes("/api/reports/") && !url.includes("/files/") && url.match(/\/api\/reports\/[a-f0-9\-]+$/)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              report: {
                id: "comp-test-report-001",
                report_code: "COMP-001",
                incident_at: "2026-10-31T10:00:00Z",
                location_text: "Component Test Location",
                incident_type: "excessive_force",
                description: "Component test report",
                submission_mode: "identified",
                urgent_flag: false,
                status: "pending_moderation",
                created_at: "2026-10-31T20:00:00Z",
              },
              files: [
                {
                  id: "comp-file-available-001",
                  file_name: "available-evidence.jpg",
                  content_type: "image/jpeg",
                  size_bytes: 102400,
                  sha256: "aaa111bbb222ccc333ddd444eee555fff666",
                  created_at: "2026-10-31T20:05:00Z",
                  exists: true,
                },
                {
                  id: "comp-file-missing-002",
                  file_name: "missing-document.pdf",
                  content_type: "application/pdf",
                  size_bytes: 204800,
                  sha256: "ggg777hhh888iii999jjj000kkk111lll",
                  created_at: "2026-10-31T20:10:00Z",
                  exists: false,
                },
              ],
            },
          }),
        });
      }

      // File download endpoint
      if (url.includes("/api/reports/") && url.includes("/files/")) {
        if (url.includes("comp-file-available-001")) {
          return Promise.resolve({
            ok: true,
            blob: () => Promise.resolve(new Blob(["fake image data"], { type: "image/jpeg" })),
            headers: new Map([
              ["Content-Type", "image/jpeg"],
              ["Content-Disposition", 'attachment; filename="available-evidence.jpg"'],
            ]),
          });
        }

        if (url.includes("comp-file-missing-002")) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
              success: false,
              error: { message: "File not found in local storage" },
            }),
          });
        }
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
  });

  it("Available file shows Download button", async () => {
    console.log("\n=== COMPONENT TEST 1: Available File with Download Button ===\n");

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const root = new RootRoute({
      component: () => (
        <QueryClientProvider client={queryClient}>
          <Outlet />
        </QueryClientProvider>
      ),
    });

    const route = createRoute({
      getParentRoute: () => root,
      path: "/saved-reports/$id",
      component: SavedReportDetailPage,
    });

    const router = createRouter({
      routeTree: root.addChildren([route]),
      history: createMemoryHistory({
        initialEntries: ["/saved-reports/comp-test-report-001"],
      }),
    });

    await router.load();
    render(<RouterProvider router={router} />);

    // Wait for component to load and files to display
    await waitFor(() => {
      expect(screen.getByText("available-evidence.jpg")).toBeInTheDocument();
    }, { timeout: 5000 });

    console.log("✓ Report loaded");
    console.log("✓ Available file displayed");

    // Find download button for available file
    const downloadButtons = screen.getAllByRole("button").filter((btn) =>
      btn.getAttribute("aria-label")?.includes("Download")
    );

    expect(downloadButtons.length).toBeGreaterThanOrEqual(1);
    const availableButton = downloadButtons.find((btn) =>
      btn.getAttribute("aria-label")?.includes("available-evidence")
    );

    expect(availableButton).toBeTruthy();
    console.log("✓ Download button found for available file");
    console.log(`✓ Button text: "${availableButton?.textContent}"\n`);
  });

  it("Missing file shows error message and no Download button", async () => {
    console.log("\n=== COMPONENT TEST 2: Missing File with Error Message ===\n");

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const root = new RootRoute({
      component: () => (
        <QueryClientProvider client={queryClient}>
          <Outlet />
        </QueryClientProvider>
      ),
    });

    const route = createRoute({
      getParentRoute: () => root,
      path: "/saved-reports/$id",
      component: SavedReportDetailPage,
    });

    const router = createRouter({
      routeTree: root.addChildren([route]),
      history: createMemoryHistory({
        initialEntries: ["/saved-reports/comp-test-report-001"],
      }),
    });

    await router.load();
    render(<RouterProvider router={router} />);

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText("missing-document.pdf")).toBeInTheDocument();
    }, { timeout: 5000 });

    console.log("✓ Report loaded");
    console.log("✓ Missing file displayed");

    // Check for error message
    const errorMessages = screen.getAllByText(/File not found in local storage/);
    expect(errorMessages.length).toBeGreaterThanOrEqual(1);
    console.log("✓ Error message shown for missing file");

    // Verify no download button for missing file
    const allButtons = screen.getAllByRole("button");
    const missingFileDownloadButton = allButtons.find((btn) =>
      btn.getAttribute("aria-label")?.includes("missing-document")
    );

    expect(missingFileDownloadButton).toBeFalsy();
    console.log("✓ No Download button for missing file\n");
  });

  it("Download button uses correct report and file IDs", async () => {
    console.log("\n=== COMPONENT TEST 3: Correct IDs in Download Request ===\n");

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const root = new RootRoute({
      component: () => (
        <QueryClientProvider client={queryClient}>
          <Outlet />
        </QueryClientProvider>
      ),
    });

    const route = createRoute({
      getParentRoute: () => root,
      path: "/saved-reports/$id",
      component: SavedReportDetailPage,
    });

    const router = createRouter({
      routeTree: root.addChildren([route]),
      history: createMemoryHistory({
        initialEntries: ["/saved-reports/comp-test-report-001"],
      }),
    });

    await router.load();
    render(<RouterProvider router={router} />);

    // Wait for files to load
    await waitFor(() => {
      expect(screen.getByText("available-evidence.jpg")).toBeInTheDocument();
    }, { timeout: 5000 });

    console.log("✓ Component loaded");

    // Clear previous fetch calls
    vi.clearAllMocks();

    // Find and click download button
    const downloadButtons = screen.getAllByRole("button").filter((btn) =>
      btn.getAttribute("aria-label")?.includes("Download")
    );

    const availableButton = downloadButtons.find((btn) =>
      btn.getAttribute("aria-label")?.includes("available-evidence")
    );

    expect(availableButton).toBeTruthy();

    fireEvent.click(availableButton!);

    // Wait for fetch to be called
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    }, { timeout: 2000 });

    const fetchCall = (global.fetch as any).mock.calls[0]?.[0];
    console.log(`✓ Download fetched: ${fetchCall}`);

    expect(fetchCall).toContain("/api/reports/comp-test-report-001/files/comp-file-available-001");
    console.log("✓ URL contains correct report ID");
    console.log("✓ URL contains correct file ID\n");
  });

  it("File metadata displays correctly", async () => {
    console.log("\n=== COMPONENT TEST 4: File Metadata Display ===\n");

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const root = new RootRoute({
      component: () => (
        <QueryClientProvider client={queryClient}>
          <Outlet />
        </QueryClientProvider>
      ),
    });

    const route = createRoute({
      getParentRoute: () => root,
      path: "/saved-reports/$id",
      component: SavedReportDetailPage,
    });

    const router = createRouter({
      routeTree: root.addChildren([route]),
      history: createMemoryHistory({
        initialEntries: ["/saved-reports/comp-test-report-001"],
      }),
    });

    await router.load();
    render(<RouterProvider router={router} />);

    // Wait for files to load
    await waitFor(() => {
      expect(screen.getByText("available-evidence.jpg")).toBeInTheDocument();
    }, { timeout: 5000 });

    console.log("✓ Files loaded");

    // Check available file metadata (102400 bytes = 100 KB)
    expect(screen.getByText(/100 KB.*image\/jpeg/i)).toBeInTheDocument();
    console.log("✓ Available file: size and type displayed (100 KB · image/jpeg)");

    // Check SHA256 preview (first 16 chars)
    expect(screen.getByText(/aaa111bbb222ccc3…/)).toBeInTheDocument();
    console.log("✓ SHA256 preview shown for available file");

    // Check missing file metadata (204800 bytes = 200 KB)
    expect(screen.getByText(/200 KB.*application\/pdf/i)).toBeInTheDocument();
    console.log("✓ Missing file: size and type displayed (200 KB · application/pdf)");

    // Check SHA256 preview for missing file
    expect(screen.getByText(/ggg777hhh888iii9…/)).toBeInTheDocument();
    console.log("✓ SHA256 preview shown for missing file\n");
  });

  it("Component correctly identifies file existence", async () => {
    console.log("\n=== COMPONENT TEST 5: File Existence Logic ===\n");

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const root = new RootRoute({
      component: () => (
        <QueryClientProvider client={queryClient}>
          <Outlet />
        </QueryClientProvider>
      ),
    });

    const route = createRoute({
      getParentRoute: () => root,
      path: "/saved-reports/$id",
      component: SavedReportDetailPage,
    });

    const router = createRouter({
      routeTree: root.addChildren([route]),
      history: createMemoryHistory({
        initialEntries: ["/saved-reports/comp-test-report-001"],
      }),
    });

    await router.load();
    render(<RouterProvider router={router} />);

    // Wait for files to load
    await waitFor(() => {
      expect(screen.getByText("Attached files (2)")).toBeInTheDocument();
    }, { timeout: 5000 });

    console.log("✓ Two files listed");

    // One download button (for available file)
    const downloadButtons = screen.getAllByRole("button").filter((btn) =>
      btn.getAttribute("aria-label")?.includes("Download")
    );

    expect(downloadButtons.length).toBe(1);
    console.log("✓ One Download button (for available file only)");

    // One error message (for missing file)
    const errorMessages = screen.getAllByText(/File not found in local storage/);
    expect(errorMessages.length).toBe(1);
    console.log("✓ One error message (for missing file only)");

    console.log("✓ Component correctly shows appropriate UI for each file state\n");
  });
});
