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
      insert: vi.fn(function(data: any) {
        return {
          select: vi.fn(() => ({
            single: vi.fn().mockImplementation(async () => {
              // Report creation succeeds
              if (table === 'incident_reports') {
                return {
                  data: { id: 'test-1', report_code: 'TEST-1' },
                  error: null,
                };
              }
              // Upload succeeds
              if (table === 'report_files') {
                return {
                  data: { id: 'file-1' },
                  error: null,
                };
              }
              // Evidence record FAILS
              if (table === 'report_evidence') {
                return {
                  data: null,
                  error: { message: 'Evidence record creation failed' },
                };
              }
              return {
                data: { id: 'ev-1' },
                error: null,
              };
            }),
          })),
        };
      }),
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

describe('report evidence-record failure display', () => {
  let originalViteSupabaseUrl: string | undefined;
  let originalViteSupabaseKey: string | undefined;

  afterEach(() => {
    import.meta.env.VITE_SUPABASE_URL = originalViteSupabaseUrl;
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = originalViteSupabaseKey;
  });

  it(
    'displays evidence-record failure details on final screen when file upload succeeds but evidence-record creation fails',
    async () => {
      originalViteSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      originalViteSupabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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
        defaultOptions: { queries: { retry: false } },
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
        history: createMemoryHistory({ initialEntries: ['/report'] }),
      });

      await router.load();
      render(<RouterProvider router={router} />);

      const user = userEvent.setup();

      // Fill step 1
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

      await user.type(screen.getByLabelText(/^Location/i), 'Test location');
      await user.type(
        screen.getByLabelText(/Describe the incident/i),
        'Test incident description',
      );

      await user.click(
        screen.getByRole('button', { name: /go to next step/i }),
      );

      // Step 2: Upload a file
      const file = new File(['test content'], 'evidence-photo.jpg', {
        type: 'image/jpeg',
        lastModified: 1,
      });

      await user.upload(
        await screen.findByLabelText(/Select evidence files to upload/i),
        file,
      );

      expect(
        await screen.findByRole('img', { name: 'evidence-photo.jpg' }),
      ).toBeTruthy();

      await user.click(
        screen.getByRole('button', { name: /go to next step/i }),
      );

      // Step 3: Continue
      await user.click(
        screen.getByRole('button', { name: /go to next step/i }),
      );

      // Step 4: Consent and submit
      await user.click(
        screen.getByRole('checkbox', { name: /consent to terms/i }),
      );

      await user.click(
        await screen.findByRole('button', {
          name: /^submit (?:demo )?report$/i,
        }),
      );

      // Assert: Reference number is shown
      expect(await screen.findByText('TEST-1')).toBeTruthy();

      // Assert: File name should be visible
      expect(screen.getByText('evidence-photo.jpg')).toBeTruthy();

      // Assert: Failure message should use corrected wording
      expect(
        screen.getByText(/The evidence record could not be saved, so this file was not fully attached/i),
      ).toBeTruthy();

      // Assert: Demo message appears in file error section
      expect(
        screen.getByText(/This is a demonstration.*files are not actually stored/i),
      ).toBeTruthy();

      // Assert: Verify that the supabase mocks were called during submission
      const { supabase } = await import('@/integrations/supabase/client');
      const fromMock = vi.mocked(supabase.from);
      
      // Verify 'report_evidence' table (evidence-record creation) was called
      const evidenceCallFound = fromMock.mock.calls.some(call => call[0] === 'report_evidence');
      expect(evidenceCallFound).toBe(true);

      // Verify storage was used (for file upload)
      const storageMock = vi.mocked(supabase.storage);
      expect(storageMock.from).toHaveBeenCalled();
    },
    30000,
  );
});
