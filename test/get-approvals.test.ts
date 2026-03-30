import { getApprovals, PullRequestInfo } from "../src/index";

function mockContext(reviews: any[]) {
  return {
    octokit: {
      paginate: jest.fn().mockResolvedValue(reviews),
      pulls: { listReviews: "pulls.listReviews" },
    },
  };
}

const pr: PullRequestInfo = {
  owner: "org",
  repo: "repo",
  pull_number: 1,
  head_sha: "abc123",
};

describe("getApprovals", () => {
  it("returns approvals", async () => {
    const ctx = mockContext([
      { user: { login: "userB" }, state: "APPROVED" },
    ]);

    const result = await getApprovals(ctx, pr);

    expect(result).toEqual(new Map([["userB", "APPROVED"]]));
  });

  it("removes dismissed approvals", async () => {
    const ctx = mockContext([
      { user: { login: "userB" }, state: "APPROVED" },
      { user: { login: "userB" }, state: "DISMISSED" },
    ]);

    const result = await getApprovals(ctx, pr);

    expect(result.size).toBe(0);
  });

  it("removes approvals overridden by changes_requested", async () => {
    const ctx = mockContext([
      { user: { login: "userB" }, state: "APPROVED" },
      { user: { login: "userB" }, state: "CHANGES_REQUESTED" },
    ]);

    const result = await getApprovals(ctx, pr);

    expect(result.size).toBe(0);
  });

  it("re-approval after changes_requested counts", async () => {
    const ctx = mockContext([
      { user: { login: "userB" }, state: "APPROVED" },
      { user: { login: "userB" }, state: "CHANGES_REQUESTED" },
      { user: { login: "userB" }, state: "APPROVED" },
    ]);

    const result = await getApprovals(ctx, pr);

    expect(result).toEqual(new Map([["userB", "APPROVED"]]));
  });

  it("tracks multiple reviewers independently", async () => {
    const ctx = mockContext([
      { user: { login: "userB" }, state: "APPROVED" },
      { user: { login: "userC" }, state: "CHANGES_REQUESTED" },
      { user: { login: "userD" }, state: "APPROVED" },
    ]);

    const result = await getApprovals(ctx, pr);

    expect(result.size).toBe(2);
    expect(result.has("userB")).toBe(true);
    expect(result.has("userD")).toBe(true);
    expect(result.has("userC")).toBe(false);
  });

  it("ignores COMMENTED reviews", async () => {
    const ctx = mockContext([
      { user: { login: "userB" }, state: "COMMENTED" },
    ]);

    const result = await getApprovals(ctx, pr);

    expect(result.size).toBe(0);
  });

  it("handles reviews with missing user", async () => {
    const ctx = mockContext([
      { user: null, state: "APPROVED" },
      { user: { login: "userB" }, state: "APPROVED" },
    ]);

    const result = await getApprovals(ctx, pr);

    expect(result).toEqual(new Map([["userB", "APPROVED"]]));
  });
});
