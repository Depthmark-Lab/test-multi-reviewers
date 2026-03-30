import { getCommitters, PullRequestInfo } from "../src/index";

function mockContext(commits: any[]) {
  return {
    octokit: {
      paginate: jest.fn().mockResolvedValue(commits),
      pulls: { listCommits: "pulls.listCommits" },
    },
  };
}

const pr: PullRequestInfo = {
  owner: "org",
  repo: "repo",
  pull_number: 1,
  head_sha: "abc123",
};

describe("getCommitters", () => {
  it("extracts author logins", async () => {
    const ctx = mockContext([
      { author: { login: "userA" }, committer: { login: "web-flow" } },
    ]);

    const result = await getCommitters(ctx, pr);

    expect(result).toEqual(new Set(["userA"]));
  });

  it("extracts committer logins (non web-flow)", async () => {
    const ctx = mockContext([
      { author: { login: "userA" }, committer: { login: "userB" } },
    ]);

    const result = await getCommitters(ctx, pr);

    expect(result).toEqual(new Set(["userA", "userB"]));
  });

  it("excludes web-flow committer", async () => {
    const ctx = mockContext([
      { author: { login: "userA" }, committer: { login: "web-flow" } },
    ]);

    const result = await getCommitters(ctx, pr);

    expect(result).not.toContain("web-flow");
  });

  it("deduplicates when author and committer are the same", async () => {
    const ctx = mockContext([
      { author: { login: "userA" }, committer: { login: "userA" } },
    ]);

    const result = await getCommitters(ctx, pr);

    expect(result).toEqual(new Set(["userA"]));
    expect(result.size).toBe(1);
  });

  it("collects committers across multiple commits", async () => {
    const ctx = mockContext([
      { author: { login: "userA" }, committer: { login: "web-flow" } },
      { author: { login: "userB" }, committer: { login: "web-flow" } },
      { author: { login: "userA" }, committer: { login: "web-flow" } },
    ]);

    const result = await getCommitters(ctx, pr);

    expect(result).toEqual(new Set(["userA", "userB"]));
  });

  it("handles commits with missing author/committer", async () => {
    const ctx = mockContext([
      { author: null, committer: null },
      { author: { login: "userA" }, committer: null },
    ]);

    const result = await getCommitters(ctx, pr);

    expect(result).toEqual(new Set(["userA"]));
  });
});
