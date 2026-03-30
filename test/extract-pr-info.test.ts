import { extractPrInfo } from "../src/index";

describe("extractPrInfo", () => {
  it("extracts PR info from a pull_request event payload", () => {
    const context = {
      payload: {
        repository: { owner: { login: "org" }, name: "repo" },
        pull_request: {
          number: 42,
          head: { sha: "deadbeef" },
        },
      },
    };

    const result = extractPrInfo(context);

    expect(result).toEqual({
      owner: "org",
      repo: "repo",
      pull_number: 42,
      head_sha: "deadbeef",
    });
  });

  it("returns null when there is no pull_request in payload", () => {
    const context = {
      payload: {
        repository: { owner: { login: "org" }, name: "repo" },
      },
    };

    const result = extractPrInfo(context);

    expect(result).toBeNull();
  });
});
