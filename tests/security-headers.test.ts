/**
 * Section 8: Security Header Tests
 *
 * Verifies that next.config.js has the correct hardened headers.
 * This is a static analysis test — it reads the config and validates values.
 */
import { describe, it, expect, beforeAll } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nextConfig = require("../next.config.js");

describe("next.config.js — security headers", () => {
  let headers: Array<{ key: string; value: string }>;

  beforeAll(async () => {
    const result = await nextConfig.headers();
    headers = result[0].headers;
  });

  it("sets X-Frame-Options to DENY", () => {
    const xfo = headers.find((h) => h.key === "X-Frame-Options");
    expect(xfo).toBeDefined();
    expect(xfo!.value).toBe("DENY");
  });

  it("sets HSTS with 2-year max-age and preload", () => {
    const hsts = headers.find((h) => h.key === "Strict-Transport-Security");
    expect(hsts).toBeDefined();
    expect(hsts!.value).toContain("max-age=63072000");
    expect(hsts!.value).toContain("includeSubDomains");
    expect(hsts!.value).toContain("preload");
  });

  it("sets X-Content-Type-Options to nosniff", () => {
    const xcto = headers.find((h) => h.key === "X-Content-Type-Options");
    expect(xcto).toBeDefined();
    expect(xcto!.value).toBe("nosniff");
  });

  it("has CSP with frame-ancestors 'none'", () => {
    const csp = headers.find((h) => h.key === "Content-Security-Policy");
    expect(csp).toBeDefined();
    expect(csp!.value).toContain("frame-ancestors 'none'");
  });

  it("has CSP with base-uri 'self'", () => {
    const csp = headers.find((h) => h.key === "Content-Security-Policy");
    expect(csp).toBeDefined();
    expect(csp!.value).toContain("base-uri 'self'");
  });

  it("has CSP with form-action 'self'", () => {
    const csp = headers.find((h) => h.key === "Content-Security-Policy");
    expect(csp).toBeDefined();
    expect(csp!.value).toContain("form-action 'self'");
  });

  it("has Referrer-Policy set", () => {
    const rp = headers.find((h) => h.key === "Referrer-Policy");
    expect(rp).toBeDefined();
    expect(rp!.value).toBe("strict-origin-when-cross-origin");
  });

  it("has Permissions-Policy that denies camera, microphone, geolocation", () => {
    const pp = headers.find((h) => h.key === "Permissions-Policy");
    expect(pp).toBeDefined();
    expect(pp!.value).toContain("camera=()");
    expect(pp!.value).toContain("microphone=()");
    expect(pp!.value).toContain("geolocation=()");
  });
});
