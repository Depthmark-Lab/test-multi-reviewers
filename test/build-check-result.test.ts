import { buildCheckResult } from "../src/index";

describe("buildCheckResult", () => {
  it("passes when approver is not a committer", () => {
    const committers = new Set(["userA"]);
    const approvers = new Map([["userB", "APPROVED"]]);

    const result = buildCheckResult(committers, approvers);

    expect(result.conclusion).toBe("success");
    expect(result.summary).toContain("1 valid approval");
  });

  it("fails when approver is also a committer", () => {
    const committers = new Set(["userA"]);
    const approvers = new Map([["userA", "APPROVED"]]);

    const result = buildCheckResult(committers, approvers);

    expect(result.conclusion).toBe("failure");
    expect(result.summary).toContain("1 approval(s) from committers");
    expect(result.text).toContain("@userA");
  });

  it("fails when one of multiple approvers is a committer", () => {
    const committers = new Set(["userA", "userB"]);
    const approvers = new Map([
      ["userB", "APPROVED"],
      ["userC", "APPROVED"],
    ]);

    const result = buildCheckResult(committers, approvers);

    expect(result.conclusion).toBe("failure");
    expect(result.summary).toContain("1 approval(s) from committers");
    expect(result.text).toContain("~~@userB~~");
    expect(result.text).toContain("@userC");
  });

  it("fails when multiple approvers are committers", () => {
    const committers = new Set(["userA", "userB"]);
    const approvers = new Map([
      ["userA", "APPROVED"],
      ["userB", "APPROVED"],
    ]);

    const result = buildCheckResult(committers, approvers);

    expect(result.conclusion).toBe("failure");
    expect(result.summary).toContain("2 approval(s) from committers");
  });

  it("passes with no approvals yet", () => {
    const committers = new Set(["userA"]);
    const approvers = new Map<string, string>();

    const result = buildCheckResult(committers, approvers);

    expect(result.conclusion).toBe("success");
    expect(result.summary).toContain("awaiting review");
  });

  it("passes when multiple non-committers approve", () => {
    const committers = new Set(["userA"]);
    const approvers = new Map([
      ["userB", "APPROVED"],
      ["userC", "APPROVED"],
    ]);

    const result = buildCheckResult(committers, approvers);

    expect(result.conclusion).toBe("success");
    expect(result.summary).toContain("2 valid approval");
  });

  // Scenario: User A commits, User B approves, then User B commits
  // At re-evaluation time, B is now in the committers set
  it("fails after approver becomes a committer (late push)", () => {
    const committers = new Set(["userA", "userB"]);
    const approvers = new Map([["userB", "APPROVED"]]);

    const result = buildCheckResult(committers, approvers);

    expect(result.conclusion).toBe("failure");
    expect(result.text).toContain("@userB");
  });
});
