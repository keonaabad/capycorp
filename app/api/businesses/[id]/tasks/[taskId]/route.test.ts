import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const businessFindUniqueMock = vi.fn();
const taskFindUniqueMock = vi.fn();
const agentFindManyMock = vi.fn();
const subtaskFindManyMock = vi.fn();

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    business: { findUnique: businessFindUniqueMock },
    task: { findUnique: taskFindUniqueMock },
    agent: { findMany: agentFindManyMock },
    subtask: { findMany: subtaskFindManyMock },
  },
}));

const { GET } = await import("./route");

function makeRequest() {
  return new Request("http://localhost/api/businesses/biz-1/tasks/task-1");
}

const ctx = { params: Promise.resolve({ id: "biz-1", taskId: "task-1" }) };

describe("GET /api/businesses/[id]/tasks/[taskId]", () => {
  beforeEach(() => {
    authMock.mockReset();
    businessFindUniqueMock.mockReset();
    taskFindUniqueMock.mockReset();
    agentFindManyMock.mockReset();
    subtaskFindManyMock.mockReset();
    subtaskFindManyMock.mockResolvedValue([]);
    authMock.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("returns the task and agent states for polling", async () => {
    businessFindUniqueMock.mockResolvedValue({ id: "biz-1", userId: "user-1" });
    taskFindUniqueMock.mockResolvedValue({
      id: "task-1",
      businessId: "biz-1",
      status: "running",
      error: null,
    });
    agentFindManyMock.mockResolvedValue([
      {
        id: "agent-manager",
        state: "working",
        resumeState: null,
        currentTask: "Delegating",
      },
    ]);
    subtaskFindManyMock.mockResolvedValue([
      {
        id: "subtask-1",
        title: "Research pricing",
        result: "Found three competitors.",
        status: "completed",
        completedAt: null,
        agent: { name: "Hazel", role: "researcher" },
      },
    ]);

    const response = await GET(makeRequest(), ctx);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.task).toEqual({ id: "task-1", status: "running", error: null });
    expect(body.agents).toEqual([
      {
        id: "agent-manager",
        state: "working",
        resumeState: null,
        currentTask: "Delegating",
      },
    ]);
    expect(body.subtasks).toEqual([
      {
        id: "subtask-1",
        title: "Research pricing",
        result: "Found three competitors.",
        status: "completed",
        completedAt: null,
        agent: { name: "Hazel", role: "researcher" },
      },
    ]);
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const response = await GET(makeRequest(), ctx);
    expect(response.status).toBe(401);
  });

  it("returns 404 when the business belongs to a different user", async () => {
    businessFindUniqueMock.mockResolvedValue({
      id: "biz-1",
      userId: "someone-else",
    });
    const response = await GET(makeRequest(), ctx);
    expect(response.status).toBe(404);
  });

  it("returns 404 when the task doesn't belong to this business", async () => {
    businessFindUniqueMock.mockResolvedValue({ id: "biz-1", userId: "user-1" });
    taskFindUniqueMock.mockResolvedValue({
      id: "task-1",
      businessId: "some-other-biz",
      status: "running",
      error: null,
    });

    const response = await GET(makeRequest(), ctx);
    expect(response.status).toBe(404);
  });

  it("returns 404 when the task doesn't exist", async () => {
    businessFindUniqueMock.mockResolvedValue({ id: "biz-1", userId: "user-1" });
    taskFindUniqueMock.mockResolvedValue(null);

    const response = await GET(makeRequest(), ctx);
    expect(response.status).toBe(404);
  });
});
