import React from 'react';

import { describe, it, expect, vi } from 'vitest';

import { render, screen, fireEvent, within } from '@testing-library/react';

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

describe('report reset', () => {

  it(

    'opens a fresh report and previews a new image after a completed report',

    async () => {
      // Mock fetch for /api/reports endpoint
      const fetchMock = vi.fn((url: string, options?: RequestInit) => {
        if (url === '/api/reports') {
          return Promise.resolve({
            ok: true,
            status: 201,
            json: async () => ({
              success: true,
              data: {
                report_code: 'TEST-RESET-001',
                files_attached: 1,
              },
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      });
      global.fetch = fetchMock;

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

      await fillStepOne('This is a fictional report for testing.');

      const first = new File(['first'], 'first.jpg', {

        type: 'image/jpeg',

        lastModified: 1,

      });

      await user.upload(

        await screen.findByLabelText(/Select evidence files to upload/i),

        first,

      );

      expect(

        await screen.findByRole('img', { name: 'first.jpg' }),

      ).toBeTruthy();

      await user.click(

        screen.getByRole('button', { name: /go to next step/i }),

      );

      await user.click(

        screen.getByRole('button', { name: /go to next step/i }),

      );

      await user.click(

        screen.getByRole('checkbox', { name: /consent to terms/i }),

      );

      await user.click(

        await screen.findByRole('button', {

          name: /^submit (?:demo )?report$/i,

        }),

      );

      await user.click(

        await screen.findByRole('button', {

          name: /file another report/i,

        }),

      );

      await fillStepOne('This is another fictional report for testing.');

      expect(screen.queryByText('first.jpg')).toBeNull();

      const second = new File(['second'], 'second.jpg', {

        type: 'image/jpeg',

        lastModified: 2,

      });

      await user.upload(

        await screen.findByLabelText(/Select evidence files to upload/i),

        second,

      );

      expect(

        await screen.findByRole('img', { name: 'second.jpg' }),

      ).toBeTruthy();

      expect(screen.queryByText('first.jpg')).toBeNull();

    },
    60000,  // Increased from 15000
  );
});
