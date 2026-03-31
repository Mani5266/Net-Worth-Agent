import { vi } from "vitest";

// ─── Mock environment variables ──────────────────────────────────────────────
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.GEMINI_API_KEY = "test-gemini-key";

// ─── Mock @supabase/supabase-js (browser client used in db.ts) ───────────────
export const mockSupabaseFrom = vi.fn();
export const mockSupabaseStorage = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
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
