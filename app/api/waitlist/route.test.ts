import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertMock = vi.fn();
const rateLimitCountMock = vi.fn();
const rateLimitCreateMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    waitlistEntry: { upsert: upsertMock },
    rateLimitHit: { count: rateLimitCountMock, create: rateLimitCreateMock },
  },
}));

const { POST } = await import("./route");

function makeRequest(body: unknown, ip = "1.2.3.4") {
  return new Request("http://localhost/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("POST /api/waitlist", () => {
  beforeEach(() => {
    upsertMock.mockReset();
    upsertMock.mockResolvedValue({});
    rateLimitCountMock.mockReset();
    rateLimitCountMock.mockResolvedValue(0);
    rateLimitCreateMock.mockReset();
    rateLimitCreateMock.mockResolvedValue({});
  });

  it("returns 429 once the rate limit is hit", async () => {
    rateLimitCountMock.mockResolvedValue(5);
    const response = await POST(makeRequest({ email: "person@example.com" }));
    expect(response.status).toBe(429);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the email is missing", async () => {
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed email", async () => {
    const response = await POST(makeRequest({ email: "not-an-email" }));
    expect(response.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("normalizes and upserts a valid email", async () => {
    const response = await POST(makeRequest({ email: "  Person@Example.com  " }));
    expect(response.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledWith({
      where: { email: "person@example.com" },
      update: {},
      create: { email: "person@example.com" },
    });
  });

  it("succeeds the same way for an email already on the list", async () => {
    // upsert's empty `update` makes this indistinguishable from a first-time
    // signup — deliberate, so the response never leaks list membership.
    const response = await POST(makeRequest({ email: "person@example.com" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });
  });
});
