import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { waitlistEntry: { upsert: upsertMock } },
}));

const { POST } = await import("./route");

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/waitlist", () => {
  beforeEach(() => {
    upsertMock.mockReset();
    upsertMock.mockResolvedValue({});
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
