import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: transactionMock },
}));

const { POST } = await import("./route");

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/businesses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/businesses", () => {
  beforeEach(() => {
    authMock.mockReset();
    transactionMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const response = await POST(makeRequest({ name: "Acme" }));
    expect(response.status).toBe(401);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("returns 400 when name is missing", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("creates a business and one agent per role", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const agentCreates: unknown[] = [];
    transactionMock.mockImplementation(async (fn) =>
      fn({
        business: {
          create: vi.fn().mockResolvedValue({ id: "biz-1" }),
        },
        agent: {
          create: vi.fn().mockImplementation((args) => {
            agentCreates.push(args.data);
            return Promise.resolve({});
          }),
        },
      }),
    );

    const response = await POST(makeRequest({ name: "Acme" }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({ business: { id: "biz-1" } });
    expect(agentCreates).toHaveLength(4);
    expect(agentCreates.map((a) => (a as { role: string }).role)).toEqual([
      "manager",
      "engineer",
      "researcher",
      "designer",
    ]);
  });
});
