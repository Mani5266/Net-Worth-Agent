import { vi } from "vitest";

// ─── Mock environment variables ──────────────────────────────────────────────
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.GEMINI_API_KEY = "test-gemini-key";

// ─── Mock next/headers (cookies) ─────────────────────────────────────────────
vi.mock("next/headers", () => ({
  cookies: () => ({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

// ─── Mock @supabase/ssr ──────────────────────────────────────────────────────
// This is used by auth-guard.ts. We control the return value per test.
export const mockGetUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

// ─── Mock @supabase/supabase-js (browser client used in db.ts) ───────────────
export const mockSupabaseFrom = vi.fn();
export const mockSupabaseStorage = vi.fn();
export const mockSupabaseAuthGetUser = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: mockSupabaseAuthGetUser },
    from: mockSupabaseFrom,
    storage: { from: mockSupabaseStorage },
  }),
}));

// ─── Mock @upstash/ratelimit ─────────────────────────────────────────────────
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow() { return {}; }
    constructor() {}
    limit() {
      return Promise.resolve({
        success: true,
        limit: 100,
        remaining: 99,
        reset: Date.now() + 3600_000,
      });
    }
  },
}));

// ─── Mock @upstash/redis ─────────────────────────────────────────────────────
vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor() {}
  },
}));

// ─── Mock audit logging (don't actually insert) ──────────────────────────────
vi.mock("@/lib/audit", () => ({
  logAction: vi.fn(),
}));

// ─── Helper: simulate authenticated user ─────────────────────────────────────
export function mockAuthenticatedUser(userId: string = "user-abc-123") {
  // auth-guard.ts uses @supabase/ssr createServerClient
  mockGetUser.mockResolvedValue({
    data: { user: { id: userId } },
  });
  // db.ts uses @supabase/supabase-js browser client
  mockSupabaseAuthGetUser.mockResolvedValue({
    data: { user: { id: userId } },
  });
}

// ─── Helper: simulate unauthenticated request ────────────────────────────────
export function mockUnauthenticatedUser() {
  mockGetUser.mockResolvedValue({
    data: { user: null },
  });
  mockSupabaseAuthGetUser.mockResolvedValue({
    data: { user: null },
  });
}

// ─── Helper: simulate a different user (for IDOR tests) ──────────────────────
export function mockDifferentUser(userId: string = "attacker-xyz-999") {
  mockAuthenticatedUser(userId);
}

// ─── Helper: create a mock NextRequest ───────────────────────────────────────
export function createMockRequest(
  method: string,
  body?: unknown,
  headers?: Record<string, string>
): Request {
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new Request("http://localhost:3000/api/test", init);
}

// ─── Helper: Supabase query builder mock ─────────────────────────────────────
// Returns a chainable mock that simulates Supabase PostgREST queries
export function createQueryBuilderMock(result?: { data: unknown; error: unknown }) {
  const defaultResult = result ?? { data: null, error: null };
  const mock: Record<string, unknown> = {};

  const chainable = () =>
    new Proxy(mock, {
      get(target, prop) {
        if (prop === "then") return undefined; // Not a promise
        if (prop === "single") return () => Promise.resolve(defaultResult);
        // Terminal methods
        if (["select", "insert", "update", "upsert", "delete"].includes(String(prop))) {
          return (..._args: unknown[]) => chainable();
        }
        // Filter methods
        if (["eq", "neq", "gt", "lt", "in", "order", "limit"].includes(String(prop))) {
          return (..._args: unknown[]) => chainable();
        }
        return target[prop as string];
      },
    });

  return chainable;
}
