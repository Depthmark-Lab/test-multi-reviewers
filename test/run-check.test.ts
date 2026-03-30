import { runCheck, PullRequestInfo } from "../src/index";

function createMockContext(
  commits: any[],
  reviews: any[]
) {
  const checksCreate = jest.fn().mockResolvedValue({
    data: { id: 1001 },
  });
  const checksUpdate = jest.fn().mockResolvedValue({});
  const paginate = jest.fn().mockImplementation((method: string) => {
    if (method === "pulls.listCommits") return Promise.resolve(commits);
    if (method === "pulls.listReviews") return Promise.resolve(reviews);
    return Promise.resolve([]);
  });

  return {
    octokit: {
      paginate,
      pulls: {
        listCommits: "pulls.listCommits",
        listReviews: "pulls.listReviews",
      },
      checks: {
        create: checksCreate,
        update: checksUpdate,
      },
    },
    log: {
      info: jest.fn(),
    },
    // expose for assertions
    _mocks: { checksCreate, checksUpdate, paginate },
  };
}

const pr: PullRequestInfo = {
  owner: "org",
  repo: "repo",
  pull_number: 1,
  head_sha: "abc123",
};

describe("runCheck", () => {
  it("creates a check run in_progress then completes with success", async () => {
    const ctx = createMockContext(
      [{ author: { login: "userA" }, committer: { login: "web-flow" } }],
      [{ user: { login: "userB" }, state: "APPROVED" }]
    );

    await runCheck(ctx, pr);

    expect(ctx._mocks.checksCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "org",
        repo: "repo",
        name: "review-integrity",
        head_sha: "abc123",
        status: "in_progress",
      })
    );

    expect(ctx._mocks.checksUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        check_run_id: 1001,
        status: "completed",
        conclusion: "success",
      })
    );
  });

  it("completes with failure when committer approved", async () => {
    const ctx = createMockContext(
      [{ author: { login: "userA" }, committer: { login: "web-flow" } }],
      [{ user: { login: "userA" }, state: "APPROVED" }]
    );

    await runCheck(ctx, pr);

    expect(ctx._mocks.checksUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        conclusion: "failure",
        output: expect.objectContaining({
          title: "Review integrity: committer cannot approve",
        }),
      })
    );
  });

  it("reports failure check on API error", async () => {
    const ctx = createMockContext([], []);
    ctx.octokit.paginate.mockRejectedValue(new Error("API error"));

    await expect(runCheck(ctx, pr)).rejects.toThrow("API error");

    expect(ctx._mocks.checksUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        conclusion: "failure",
        output: expect.objectContaining({
          title: "Review integrity: error",
        }),
      })
    );
  });
});
