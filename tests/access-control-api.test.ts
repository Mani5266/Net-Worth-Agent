/**
 * Section 8: Broken Access Control Tests — API Routes
 *
 * Tests that all API routes:
 * 1. Reject unauthenticated requests with 401
 * 2. Return proper error format
 * 3. Accept authenticated requests
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
} from "./setup";

// ─── /api/ocr ────────────────────────────────────────────────────────────────

describe("POST /api/ocr", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import("@/app/api/ocr/route");
    POST = mod.POST as unknown as (req: Request) => Promise<Response>;
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticatedUser();

    const req = new Request("http://localhost:3000/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: "abc", documentType: "passport" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("Authentication");
  });

  it("returns 400 for invalid body when authenticated", async () => {
    mockAuthenticatedUser();

    const req = new Request("http://localhost:3000/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: "", documentType: "invalid_type" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing required fields when authenticated", async () => {
    mockAuthenticatedUser();

    const req = new Request("http://localhost:3000/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ─── /api/gold-price GET ─────────────────────────────────────────────────────

describe("GET /api/gold-price", () => {
  let GET: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import("@/app/api/gold-price/route");
    GET = mod.GET as unknown as (req: Request) => Promise<Response>;
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticatedUser();

    const req = new Request("http://localhost:3000/api/gold-price", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("Authentication");
  });

  it("returns 200 with gold prices when authenticated", async () => {
    mockAuthenticatedUser();

    const req = new Request("http://localhost:3000/api/gold-price", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("price24kPerGram");
    expect(body).toHaveProperty("price22kPerGram");
    expect(body).toHaveProperty("price18kPerGram");
    expect(typeof body.price24kPerGram).toBe("number");
  });
});

// ─── /api/gold-price POST ────────────────────────────────────────────────────

describe("POST /api/gold-price", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import("@/app/api/gold-price/route");
    POST = mod.POST as unknown as (req: Request) => Promise<Response>;
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticatedUser();

    const req = new Request("http://localhost:3000/api/gold-price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grams: 10 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid grams (negative) when authenticated", async () => {
    mockAuthenticatedUser();

    const req = new Request("http://localhost:3000/api/gold-price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grams: -5 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for grams exceeding max when authenticated", async () => {
    mockAuthenticatedUser();

    const req = new Request("http://localhost:3000/api/gold-price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grams: 999999 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-numeric grams when authenticated", async () => {
    mockAuthenticatedUser();

    const req = new Request("http://localhost:3000/api/gold-price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grams: "abc" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with valuation for valid input when authenticated", async () => {
    mockAuthenticatedUser();

    const req = new Request("http://localhost:3000/api/gold-price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grams: 10, declaredValue: 50000 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("grams", 10);
    expect(body).toHaveProperty("estimatedValue22k");
    expect(body).toHaveProperty("estimatedValue24k");
    expect(body).toHaveProperty("declaredValue", 50000);
    expect(body).toHaveProperty("variance22kPercent");
    expect(typeof body.estimatedValue22k).toBe("number");
  });
});

// ─── /api/exchange-rate ──────────────────────────────────────────────────────

describe("GET /api/exchange-rate", () => {
  let GET: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import("@/app/api/exchange-rate/route");
    GET = mod.GET as unknown as (req: Request) => Promise<Response>;
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticatedUser();

    const req = new Request("http://localhost:3000/api/exchange-rate", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("Authentication");
  });
});
