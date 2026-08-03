import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findUnique: findUniqueMock, update: updateMock },
    $transaction: transactionMock,
  },
}));

const { PATCH } = await import("./route");

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/agents/agent-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ id: "agent-1" }) };

describe("PATCH /api/agents/[id]", () => {
  beforeEach(() => {
    authMock.mockReset();
    findUniqueMock.mockReset();
    updateMock.mockReset();
    transactionMock.mockReset();
    authMock.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("returns 404 when the agent's business belongs to a different user", async () => {
    findUniqueMock.mockResolvedValue({
      id: "agent-1",
      businessId: "biz-1",
      state: "idle",
      resumeState: null,
      business: { userId: "someone-else" },
    });

    const response = await PATCH(makeRequest({ action: "pause" }), ctx);
    expect(response.status).toBe(404);
  });

  it("returns 404 when the agent does not exist", async () => {
    findUniqueMock.mockResolvedValue(null);

    const response = await PATCH(makeRequest({ action: "pause" }), ctx);
    expect(response.status).toBe(404);
  });

  it("returns 409 with the reason when the transition is invalid", async () => {
    findUniqueMock.mockResolvedValue({
      id: "agent-1",
      businessId: "biz-1",
      state: "idle",
      resumeState: null,
      business: { userId: "user-1" },
    });

    // idle -> completed is not a legal transition per state-machine.ts.
    const response = await PATCH(
      makeRequest({ action: "setState", to: "completed" }),
      ctx,
    );
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain("Invalid transition");
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown action", async () => {
    findUniqueMock.mockResolvedValue({
      id: "agent-1",
      businessId: "biz-1",
      state: "idle",
      resumeState: null,
      business: { userId: "user-1" },
    });

    const response = await PATCH(makeRequest({ action: "flyToTheMoon" }), ctx);
    expect(response.status).toBe(400);
  });

  it("returns 400 when setState is missing a valid 'to' state", async () => {
    findUniqueMock.mockResolvedValue({
      id: "agent-1",
      businessId: "biz-1",
      state: "idle",
      resumeState: null,
      business: { userId: "user-1" },
    });

    const response = await PATCH(
      makeRequest({ action: "setState", to: "not_a_real_state" }),
      ctx,
    );
    expect(response.status).toBe(400);
  });

  it("persists a valid transition and returns the updated state", async () => {
    findUniqueMock.mockResolvedValue({
      id: "agent-1",
      businessId: "biz-1",
      state: "idle",
      resumeState: null,
      currentTask: null,
      business: { userId: "user-1" },
    });
    transactionMock.mockImplementation(async (fn) =>
      fn({
        agent: {
          update: vi.fn().mockResolvedValue({
            state: "assigned",
            resumeState: null,
            currentTask: null,
          }),
        },
        agentEvent: { create: vi.fn().mockResolvedValue({}) },
      }),
    );

    const response = await PATCH(
      makeRequest({ action: "setState", to: "assigned" }),
      ctx,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      state: "assigned",
      resumeState: null,
      currentTask: null,
    });
  });
});
