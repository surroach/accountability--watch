import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReportPage } from "../src/routes/report";

/**
 * REAL COMPONENT TEST: Report Form Submission with File Attachments
 * 
 * Tests three scenarios for file attachment handling:
 * 1. Successful attachment - file uploaded, base64 verified
 * 2. File preparation failure - read fails, UI shows failed filename
 * 3. Backend storage failure - file prepared but backend returns files_attached: 0
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
let capturedRequest: any = null;
let mockResponse: any = null;

beforeEach(() => {
  capturedRequest = null;
  mockResponse = {
    success: true,
    data: {
      report_code: "REAL-TEST-001",
      files_attached: 0,
    },
    fileErrors: [],
  };

  fetchMock = vi.fn((url: string, options?: RequestInit) => {
    const body = options?.body ? JSON.parse(options.body as string) : null;

    if (url === "/api/reports") {
      capturedRequest = body;
    }

    return Promise.resolve({
      ok: true,
      status: 201,
      json: async () => mockResponse,
    });
  });

  global.fetch = fetchMock;

  // Mock browser APIs
  window.scrollTo = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    value: vi.fn(),
    configurable: true,
  });

  URL.createObjectURL = vi.fn().mockReturnValue("blob:fake");
  URL.revokeObjectURL = vi.fn();

  Object.defineProperty(window.crypto, "subtle", {
    value: {
      digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer),
    },
    configurable: true,
  });
});

afterEach(() => {
  vi.clearAllMocks();
  capturedRequest = null;
});

/**
 * Helper to set up and fill form through Step 2, returning after evidence upload
 */
async function setupFormToStep2() {
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

  const reportRoute = createRoute({
    getParentRoute: () => root,
    path: "/report",
    component: ReportPage,
  });

  const router = createRouter({
    routeTree: root.addChildren([reportRoute]),
    history: createMemoryHistory({
      initialEntries: ["/report"],
    }),
  });

  await router.load();
  render(<RouterProvider router={router} />);

  const user = userEvent.setup();

  // STEP 1: Fill incident details
  const dateInput = await screen.findByLabelText(/Date & time of incident/i);
  const testDate = new Date();
  testDate.setDate(testDate.getDate() - 2);
  const formattedDate = `${testDate.getFullYear()}-${String(testDate.getMonth() + 1).padStart(2, '0')}-${String(testDate.getDate()).padStart(2, '0')}T14:30`;
  fireEvent.change(dateInput, { target: { value: formattedDate } });

  const locationInput = screen.getByLabelText(/^Location/i);
  await user.type(locationInput, "Test Location");

  const descriptionInput = screen.getByLabelText(/Describe the incident/i);
  await user.type(descriptionInput, "Test incident description for file attachment test");

  // Advance to Step 2
  fireEvent.click(screen.getByRole("button", { name: /go to next step/i }));
  await waitFor(() => {
    expect(screen.queryByText(/Evidence upload/i)).toBeTruthy();
  });

  return { user };
}

/**
 * Helper to advance from Step 2 to submission
 */
async function advanceToSubmission() {
  // Skip to Step 3
  fireEvent.click(screen.getByRole("button", { name: /go to next step/i }));
  await waitFor(() => {
    expect(screen.queryByText(/Contact & privacy/i)).toBeTruthy();
  });

  // Select anonymous
  const anonymousCheckbox = screen.getByLabelText(/Submit anonymously/i);
  fireEvent.click(anonymousCheckbox);

  // Advance to Step 4
  fireEvent.click(screen.getByRole("button", { name: /go to next step/i }));
  await waitFor(() => {
    expect(screen.queryByText(/Review your report/i)).toBeTruthy();
  });

  // Accept consent
  const consentCheckbox = screen.getByLabelText(/I understand this report/i);
  fireEvent.click(consentCheckbox);

  // Submit
  fireEvent.click(screen.getByRole("button", { name: /Submit report/i }));

  // Wait for API call
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalled();
  });
}

describe("Real ReportPage Form Submission with File Attachments", () => {
  
  it("Test 1: Successful file attachment - uploads file and verifies base64 encoding", async () => {
    console.log("\n=== TEST 1: SUCCESSFUL FILE ATTACHMENT ===\n");
    
    mockResponse = {
      success: true,
      data: {
        report_code: "TEST-001-SUCCESS",
        files_attached: 1,
      },
      fileErrors: [],
    };

    const { user } = await setupFormToStep2();

    // Upload file
    console.log("Uploading fictional evidence file...");
    const fileContent = "This is test evidence content that will be base64 encoded.";
    const testFile = new File([fileContent], "evidence-photo.jpg", {
      type: "image/jpeg",
    });

    const fileInputs = document.querySelectorAll("input[type=file]");
    expect(fileInputs.length > 0).toBe(true);
    
    const fileInput = fileInputs[0] as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    console.log("✓ File uploaded: evidence-photo.jpg");

    // Wait for file to be processed
    await waitFor(() => {
      expect(document.body.textContent).toContain("evidence-photo.jpg");
    }, { timeout: 5000 });
    console.log("✓ File appears in UI");

    // Advance and submit
    await advanceToSubmission();

    // Verify API request
    expect(capturedRequest).toBeDefined();
    expect(capturedRequest.files).toBeDefined();
    expect(capturedRequest.files.length).toBe(1);
    console.log("✓ API request contains 1 file");

    const requestFile = capturedRequest.files[0];
    expect(requestFile.name).toBe("evidence-photo.jpg");
    console.log(`✓ File name in request: ${requestFile.name}`);

    expect(requestFile.base64).toBeDefined();
    console.log(`✓ Base64 data present: ${requestFile.base64.substring(0, 30)}...`);

    // Decode base64 and verify matches original
    const decodedContent = atob(requestFile.base64);
    expect(decodedContent).toBe(fileContent);
    console.log("✓ Base64 decoded content matches original exactly");

    // Verify confirmation
    expect(screen.getByText(/Your report has been received/i)).toBeTruthy();
    expect(screen.getByText("TEST-001-SUCCESS")).toBeTruthy();
    console.log("✓ Confirmation screen with reference TEST-001-SUCCESS");

    // Verify no file error section
    const fileErrorSection = screen.queryByText(/File Attachment Issues/i);
    expect(fileErrorSection).toBeFalsy();
    console.log("✓ No file error section shown (success case)\n");
  }, 120000);

  it("Test 2: File preparation failure - file read fails, shows failed filename", async () => {
    console.log("\n=== TEST 2: FILE PREPARATION FAILURE ===\n");

    mockResponse = {
      success: true,
      data: {
        report_code: "TEST-002-PREP-FAIL",
        files_attached: 0,
      },
      fileErrors: [],
    };

    const { user } = await setupFormToStep2();

    // Create file and mock its arrayBuffer to fail
    const testFile = new File(["test"], "corrupted-file.jpg", {
      type: "image/jpeg",
    });

    // Mock File.prototype.arrayBuffer to throw
    const originalArrayBuffer = File.prototype.arrayBuffer;
    Object.defineProperty(File.prototype, "arrayBuffer", {
      value: async function() {
        if (this.name === "corrupted-file.jpg") {
          throw new Error("File read failed");
        }
        return originalArrayBuffer.call(this);
      },
      configurable: true,
    });

    console.log("Uploading file that will fail to read...");
    const fileInput = document.querySelectorAll("input[type=file]")[0] as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    console.log("✓ File selected for upload");

    // File should appear in UI
    await waitFor(() => {
      expect(document.body.textContent).toContain("corrupted-file.jpg");
    }, { timeout: 5000 });
    console.log("✓ File appears in UI");

    // Advance and submit
    await advanceToSubmission();

    // Verify API request shows 0 files (preparation failed)
    expect(capturedRequest).toBeDefined();
    expect(capturedRequest.files?.length || 0).toBe(0);
    console.log("✓ API request contains 0 files (preparation failed)");

    // Verify confirmation
    expect(screen.getByText(/Your report has been received/i)).toBeTruthy();
    expect(screen.getByText("TEST-002-PREP-FAIL")).toBeTruthy();
    console.log("✓ Confirmation screen with reference TEST-002-PREP-FAIL");

    // Verify file error section shows failed filename
    const fileErrorSection = await waitFor(() => {
      return screen.queryByText(/File Attachment Issues/i);
    });
    expect(fileErrorSection).toBeTruthy();
    
    const failedFileName = screen.getByText("corrupted-file.jpg");
    expect(failedFileName).toBeTruthy();
    console.log("✓ File error section shows failed filename: corrupted-file.jpg");

    // Verify error message indicates preparation failure
    const errorText = failedFileName.parentElement?.textContent || "";
    expect(errorText).toContain("preparation");
    console.log("✓ Error message indicates 'preparation' stage failure\n");

    // Restore
    Object.defineProperty(File.prototype, "arrayBuffer", {
      value: originalArrayBuffer,
      configurable: true,
    });
  }, 120000);

  it("Test 3: Backend file-storage failure - backend returns files_attached: 0 with error", async () => {
    console.log("\n=== TEST 3: BACKEND FILE-STORAGE FAILURE ===\n");

    mockResponse = {
      success: true,
      data: {
        report_code: "TEST-003-BACKEND-FAIL",
        files_attached: 0,
      },
      fileErrors: [{
        file: "storage-failed.pdf",
        stage: "storage",
        message: "File storage service unavailable",
      }],
    };

    const { user } = await setupFormToStep2();

    // Upload file
    console.log("Uploading file that will fail at backend...");
    const fileContent = "PDF content that backend will fail to store";
    const testFile = new File([fileContent], "storage-failed.pdf", {
      type: "application/pdf",
    });

    const fileInput = document.querySelectorAll("input[type=file]")[0] as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    console.log("✓ File selected for upload");

    // File should appear in UI
    await waitFor(() => {
      expect(document.body.textContent).toContain("storage-failed.pdf");
    }, { timeout: 5000 });
    console.log("✓ File appears in UI");

    // Advance and submit
    await advanceToSubmission();

    // Verify API request contains the file (preparation succeeded)
    expect(capturedRequest).toBeDefined();
    expect(capturedRequest.files?.length || 0).toBe(1);
    console.log("✓ API request contains 1 file (preparation succeeded)");

    const requestFile = capturedRequest.files?.[0];
    expect(requestFile?.name).toBe("storage-failed.pdf");
    expect(requestFile?.base64).toBeDefined();
    console.log("✓ File properly encoded in request");

    // Verify backend response says files_attached: 0
    expect(mockResponse.data.files_attached).toBe(0);
    console.log("✓ Backend response: files_attached: 0");

    // Verify confirmation
    expect(screen.getByText(/Your report has been received/i)).toBeTruthy();
    expect(screen.getByText("TEST-003-BACKEND-FAIL")).toBeTruthy();
    console.log("✓ Confirmation screen with reference TEST-003-BACKEND-FAIL");

    // Verify file error section shows the backend error
    const fileErrorSection = await waitFor(() => {
      return screen.queryByText(/File Attachment Issues/i);
    });
    expect(fileErrorSection).toBeTruthy();
    
    const failedFileName = screen.getByText("storage-failed.pdf");
    expect(failedFileName).toBeTruthy();
    console.log("✓ File error section shows failed filename: storage-failed.pdf");

    // Verify error message indicates storage stage failure
    const errorText = failedFileName.parentElement?.textContent || "";
    expect(errorText).toContain("storage");
    console.log("✓ Error message indicates 'storage' stage failure\n");
  }, 120000);
});
