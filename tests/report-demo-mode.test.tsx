import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('exifr', () => ({
  parse: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/utils/supabase', () => ({
  sha256Hex: vi.fn().mockResolvedValue('mock-hash-123abc'),
  datetimeLocalToISO: (dt: string) => {
    const d = new Date(dt);
    return d.toISOString();
  },
  getBrowserTimezone: () => 'UTC',
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data:
              table === 'incident_reports'
                ? { id: 'test-1', report_code: 'TEST-1' }
                : { id: 'ev-1' },
            error: null,
          }),
        })),
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({
          data: {},
          error: null,
        }),
      })),
    },
  },
}));

import { ReportPage } from '../src/routes/report';

describe('report demo mode warning', () => {
  let originalViteSupabaseUrl: string | undefined;
  let originalViteSupabaseKey: string | undefined;

  afterEach(() => {
    // Restore environment variables after each test
    import.meta.env.VITE_SUPABASE_URL = originalViteSupabaseUrl;
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = originalViteSupabaseKey;
  });

  it(
    'displays demo warning when environment variables are set to fictional values',
    async () => {
      // Save original values
      originalViteSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      originalViteSupabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Set fictional values
      import.meta.env.VITE_SUPABASE_URL = 'https://fictional-project.supabase.co';
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'fictional-key-123abc';

      window.scrollTo = vi.fn();
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        value: vi.fn(),
        configurable: true,
      });
      URL.createObjectURL = vi.fn().mockReturnValue('blob:fake');
      URL.revokeObjectURL = vi.fn();
      Object.defineProperty(File.prototype, 'arrayBuffer', {
        value: async () => new Uint8Array([1, 2, 3]).buffer,
        configurable: true,
      });
      Object.defineProperty(window.crypto, 'subtle', {
        value: {
          digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer),
        },
        configurable: true,
      });

      const client = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
        },
      });

      const root = createRootRoute({
        component: () => (
          <QueryClientProvider client={client}>
            <Outlet />
          </QueryClientProvider>
        ),
      });

      const route = createRoute({
        getParentRoute: () => root,
        path: '/report',
        component: ReportPage,
      });

      const router = createRouter({
        routeTree: root.addChildren([route]),
        history: createMemoryHistory({
          initialEntries: ['/report'],
        }),
      });

      await router.load();
      render(<RouterProvider router={router} />);

      // Assert: demo warning should be visible even with fictional credentials
      expect(
        await screen.findByText(/Demonstration Mode/i),
      ).toBeTruthy();

      expect(
        screen.getByText(/This is a working prototype with a local backend for testing/i),
      ).toBeTruthy();
    },
    15000,
  );

  it(
    'displays demo warning when environment variables are absent',
    async () => {
      // Save original values
      originalViteSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      originalViteSupabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Set to absent/empty
      import.meta.env.VITE_SUPABASE_URL = '';
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = '';

      window.scrollTo = vi.fn();
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        value: vi.fn(),
        configurable: true,
      });
      URL.createObjectURL = vi.fn().mockReturnValue('blob:fake');
      URL.revokeObjectURL = vi.fn();
      Object.defineProperty(File.prototype, 'arrayBuffer', {
        value: async () => new Uint8Array([1, 2, 3]).buffer,
        configurable: true,
      });
      Object.defineProperty(window.crypto, 'subtle', {
        value: {
          digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer),
        },
        configurable: true,
      });

      const client = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
        },
      });

      const root = createRootRoute({
        component: () => (
          <QueryClientProvider client={client}>
            <Outlet />
          </QueryClientProvider>
        ),
      });

      const route = createRoute({
        getParentRoute: () => root,
        path: '/report',
        component: ReportPage,
      });

      const router = createRouter({
        routeTree: root.addChildren([route]),
        history: createMemoryHistory({
          initialEntries: ['/report'],
        }),
      });

      await router.load();
      render(<RouterProvider router={router} />);

      // Assert: demo warning should be visible when variables are absent
      expect(
        await screen.findByText(/Demonstration Mode/i),
      ).toBeTruthy();

      expect(
        screen.getByText(/This is a working prototype with a local backend for testing/i),
      ).toBeTruthy();
    },
    15000,
  );

  it(
    'shows demo report button and demo confirmation after submission',
    async () => {
      // Save original values
      originalViteSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      originalViteSupabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Set fictional values
      import.meta.env.VITE_SUPABASE_URL = 'https://fictional-project.supabase.co';
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'fictional-key-123abc';

      window.scrollTo = vi.fn();
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        value: vi.fn(),
        configurable: true,
      });
      URL.createObjectURL = vi.fn().mockReturnValue('blob:fake');
      URL.revokeObjectURL = vi.fn();
      Object.defineProperty(File.prototype, 'arrayBuffer', {
        value: async () => new Uint8Array([1, 2, 3]).buffer,
        configurable: true,
      });
      Object.defineProperty(window.crypto, 'subtle', {
        value: {
          digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer),
        },
        configurable: true,
      });

      const client = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
        },
      });

      const root = createRootRoute({
        component: () => (
          <QueryClientProvider client={client}>
            <Outlet />
          </QueryClientProvider>
        ),
      });

      const route = createRoute({
        getParentRoute: () => root,
        path: '/report',
        component: ReportPage,
      });

      const router = createRouter({
        routeTree: root.addChildren([route]),
        history: createMemoryHistory({
          initialEntries: ['/report'],
        }),
      });

      await router.load();
      render(<RouterProvider router={router} />);

      const user = userEvent.setup();

      const fillStepOne = async (description: string) => {
        const date = new Date();
        date.setDate(date.getDate() - 2);
        const value =
          `${date.getFullYear()}-` +
          `${String(date.getMonth() + 1).padStart(2, '0')}-` +
          `${String(date.getDate()).padStart(2, '0')}T12:00`;

        fireEvent.change(
          await screen.findByLabelText(/Date & time of incident/i),
          { target: { value } },
        );

        await user.type(
          screen.getByLabelText(/^Location/i),
          'Fictional location',
        );

        await user.type(
          screen.getByLabelText(/Describe the incident/i),
          description,
        );

        await user.click(
          screen.getByRole('button', { name: /go to next step/i }),
        );
      };

      await fillStepOne('Test report for demo mode.');

      const file = new File(['test'], 'test.jpg', {
        type: 'image/jpeg',
        lastModified: 1,
      });

      await user.upload(
        await screen.findByLabelText(/Select evidence files to upload/i),
        file,
      );

      await user.click(
        screen.getByRole('button', { name: /go to next step/i }),
      );

      await user.click(
        screen.getByRole('button', { name: /go to next step/i }),
      );

      await user.click(
        screen.getByRole('checkbox', { name: /consent to terms/i }),
      );

      // Verify submit button specifically says "Submit demo report"
      const submitButton = await screen.findByRole('button', {
        name: /^submit (?:demo )?report$/i,
      });
      expect(submitButton.textContent).toMatch(/demo/i);

      await user.click(submitButton);

      // After submission, verify confirmation says it was a demo
      const demoConfirmationText = await screen.findByText(
        /This is a test submission in demonstration mode/i,
      );
      expect(demoConfirmationText).toBeTruthy();
    },
    15000,
  );
});
