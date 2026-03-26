/**
 * Section 8: Broken Access Control Tests — db.ts Functions
 *
 * Tests that all database functions:
 * 1. Reject unauthenticated calls (throw "Authentication required")
 * 2. Always include user_id in queries (defense-in-depth)
 * 3. Scope storage paths with userId prefix
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  mockSupabaseFrom,
  mockSupabaseStorage,
} from "./setup";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Creates a chainable mock that tracks all .eq() calls.
 * This lets us assert that user_id filtering is always applied.
 */
function createTrackedQueryBuilder(terminalResult?: { data: unknown; error: unknown }) {
  const result = terminalResult ?? { data: null, error: null };
  const eqCalls: Array<[string, string]> = [];

  const builder: Record<string, unknown> = {};

  const chainable = (): unknown =>
    new Proxy(builder, {
      get(_target, prop) {
        if (prop === "then") return undefined;

        // Terminal: .single()
        if (prop === "single") return () => Promise.resolve(result);

        // Track .eq() calls
        if (prop === "eq") {
          return (col: string, val: string) => {
            eqCalls.push([col, val]);
            return chainable();
          };
        }

        // Chainable methods
        if (
          [
            "select", "insert", "update", "upsert", "delete",
            "order", "limit", "neq", "gt", "lt", "in",
          ].includes(String(prop))
        ) {
          return (..._args: unknown[]) => chainable();
        }

        return undefined;
      },
    });

  return { chainable, eqCalls };
}

function createStorageMock() {
  const uploadedPaths: string[] = [];
  const removedPaths: string[][] = [];

  return {
    from: () => ({
      upload: (path: string, _file: unknown) => {
        uploadedPaths.push(path);
        return Promise.resolve({ error: null });
      },
      createSignedUrl: (_path: string, _ttl: number) =>
        Promise.resolve({ data: { signedUrl: "https://signed.url/test" }, error: null }),
      remove: (paths: string[]) => {
        removedPaths.push(paths);
        return Promise.resolve({ error: null });
      },
    }),
    uploadedPaths,
    removedPaths,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("db.ts — authentication enforcement", () => {
  let db: typeof import("@/lib/db");

  beforeEach(async () => {
    vi.resetModules();
    db = await import("@/lib/db");
  });

  it("getCertificate throws when unauthenticated", async () => {
    mockUnauthenticatedUser();
    await expect(db.getCertificate("cert-123")).rejects.toThrow("Authentication required");
  });

  it("getAllCertificates throws when unauthenticated", async () => {
    mockUnauthenticatedUser();
    await expect(db.getAllCertificates()).rejects.toThrow("Authentication required");
  });

  it("updateCertificateDraft throws when unauthenticated", async () => {
    mockUnauthenticatedUser();
    await expect(
      db.updateCertificateDraft("cert-123", {} as never)
    ).rejects.toThrow("Authentication required");
  });

  it("renameCertificate throws when unauthenticated", async () => {
    mockUnauthenticatedUser();
    await expect(
      db.renameCertificate("cert-123", "new name")
    ).rejects.toThrow("Authentication required");
  });

  it("deleteCertificate throws when unauthenticated", async () => {
    mockUnauthenticatedUser();
    await expect(db.deleteCertificate("cert-123")).rejects.toThrow("Authentication required");
  });

  it("deleteDocument throws when unauthenticated", async () => {
    mockUnauthenticatedUser();
    await expect(
      db.deleteDocument("doc-123", "path/to/file")
    ).rejects.toThrow("Authentication required");
  });

  it("getDocuments throws when unauthenticated", async () => {
    mockUnauthenticatedUser();
    await expect(
      db.getDocuments("cert-123")
    ).rejects.toThrow("Authentication required");
  });

  it("saveCertificateDraft throws when unauthenticated", async () => {
    mockUnauthenticatedUser();
    await expect(
      db.saveCertificateDraft({} as never)
    ).rejects.toThrow("Authentication required");
  });
});

describe("db.ts — user_id scoping (IDOR prevention)", () => {
  const USER_ID = "user-abc-123";
  let db: typeof import("@/lib/db");

  beforeEach(async () => {
    vi.resetModules();
    mockAuthenticatedUser(USER_ID);
    db = await import("@/lib/db");
  });

  it("getCertificate includes user_id in query", async () => {
    const { chainable, eqCalls } = createTrackedQueryBuilder({
      data: { form_data: { purpose: "test" } },
      error: null,
    });
    mockSupabaseFrom.mockReturnValue(chainable());

    await db.getCertificate("cert-123");

    // Must have both id and user_id filters
    expect(eqCalls).toContainEqual(["id", "cert-123"]);
    expect(eqCalls).toContainEqual(["user_id", USER_ID]);
  });

  it("updateCertificateDraft includes user_id in query", async () => {
    const { chainable, eqCalls } = createTrackedQueryBuilder({
      data: null,
      error: null,
    });
    mockSupabaseFrom.mockReturnValue(chainable());

    await db.updateCertificateDraft("cert-123", { nickname: "test" } as never);

    expect(eqCalls).toContainEqual(["id", "cert-123"]);
    expect(eqCalls).toContainEqual(["user_id", USER_ID]);
  });

  it("renameCertificate includes user_id in both fetch and update", async () => {
    const allEqCalls: Array<[string, string]> = [];

    // First call: fetch existing cert
    const fetchBuilder = createTrackedQueryBuilder({
      data: { form_data: { nickname: "old" } },
      error: null,
    });
    // Second call: update cert
    const updateBuilder = createTrackedQueryBuilder({
      data: null,
      error: null,
    });

    let callCount = 0;
    mockSupabaseFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return fetchBuilder.chainable();
      return updateBuilder.chainable();
    });

    await db.renameCertificate("cert-123", "New Name");

    // Collect eq calls from both builders
    allEqCalls.push(...fetchBuilder.eqCalls, ...updateBuilder.eqCalls);

    // Both the SELECT and UPDATE should filter by user_id
    const userIdFilters = allEqCalls.filter(([col]) => col === "user_id");
    expect(userIdFilters.length).toBeGreaterThanOrEqual(2);
    expect(userIdFilters.every(([, val]) => val === USER_ID)).toBe(true);
  });

  it("deleteCertificate includes user_id in query", async () => {
    const allEqCalls: Array<[string, string]> = [];

    // First call: fetch documents
    const docsBuilder = createTrackedQueryBuilder({
      data: [],
      error: null,
    });
    // Second call: delete certificate
    const deleteBuilder = createTrackedQueryBuilder({
      data: null,
      error: null,
    });

    let callCount = 0;
    mockSupabaseFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return docsBuilder.chainable();
      return deleteBuilder.chainable();
    });

    // Mock storage
    const storageMock = createStorageMock();
    mockSupabaseStorage.mockImplementation(storageMock.from);

    await db.deleteCertificate("cert-123");

    allEqCalls.push(...docsBuilder.eqCalls, ...deleteBuilder.eqCalls);

    const userIdFilters = allEqCalls.filter(([col]) => col === "user_id");
    expect(userIdFilters.length).toBeGreaterThanOrEqual(2);
    expect(userIdFilters.every(([, val]) => val === USER_ID)).toBe(true);
  });

  it("deleteDocument includes user_id in query", async () => {
    const { chainable, eqCalls } = createTrackedQueryBuilder({
      data: null,
      error: null,
    });
    mockSupabaseFrom.mockReturnValue(chainable());

    // Mock storage
    const storageMock = createStorageMock();
    mockSupabaseStorage.mockImplementation(storageMock.from);

    await db.deleteDocument("doc-123", "user-abc-123/cert/annexure/cat/file.pdf");

    expect(eqCalls).toContainEqual(["id", "doc-123"]);
    expect(eqCalls).toContainEqual(["user_id", USER_ID]);
  });

  it("getDocuments includes user_id in query", async () => {
    const { chainable, eqCalls } = createTrackedQueryBuilder();
    // Override to return array instead of single
    const selectMock = vi.fn().mockReturnValue({
      eq: (col: string, val: string) => {
        eqCalls.push([col, val]);
        return {
          eq: (col2: string, val2: string) => {
            eqCalls.push([col2, val2]);
            return Promise.resolve({ data: [], error: null });
          },
        };
      },
    });
    mockSupabaseFrom.mockReturnValue({ select: selectMock });

    await db.getDocuments("cert-123");

    expect(eqCalls).toContainEqual(["certificate_id", "cert-123"]);
    expect(eqCalls).toContainEqual(["user_id", USER_ID]);
  });

  it("getAllCertificates includes user_id in query", async () => {
    const { chainable, eqCalls } = createTrackedQueryBuilder();
    // Override for select().eq().order() pattern that returns array
    const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const eqMock = (col: string, val: string) => {
      eqCalls.push([col, val]);
      return { order: orderMock };
    };
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockSupabaseFrom.mockReturnValue({ select: selectMock });

    await db.getAllCertificates();

    expect(eqCalls).toContainEqual(["user_id", USER_ID]);
  });
});

describe("db.ts — storage path scoping", () => {
  const USER_ID = "user-abc-123";
  let db: typeof import("@/lib/db");

  beforeEach(async () => {
    vi.resetModules();
    mockAuthenticatedUser(USER_ID);
    db = await import("@/lib/db");
  });

  it("uploadDocument prefixes storage path with userId", async () => {
    // Mock the from() for DB insert
    const { chainable } = createTrackedQueryBuilder({ data: null, error: null });
    mockSupabaseFrom.mockReturnValue(chainable());

    // Mock storage
    const uploadedPaths: string[] = [];
    mockSupabaseStorage.mockReturnValue({
      upload: (path: string, _file: unknown) => {
        uploadedPaths.push(path);
        return Promise.resolve({ error: null });
      },
      createSignedUrl: () =>
        Promise.resolve({ data: { signedUrl: "https://signed.url/test" }, error: null }),
    });

    const mockFile = new File(["test"], "test.pdf", { type: "application/pdf" });
    await db.uploadDocument("cert-123", "annexure-1", "bank-statements", mockFile);

    // Verify the storage path starts with userId
    expect(uploadedPaths.length).toBe(1);
    expect(uploadedPaths[0]).toMatch(new RegExp(`^${USER_ID}/`));
    expect(uploadedPaths[0]).toContain("cert-123");
    expect(uploadedPaths[0]).toContain("annexure-1");
    expect(uploadedPaths[0]).toContain("bank-statements");
  });
});
