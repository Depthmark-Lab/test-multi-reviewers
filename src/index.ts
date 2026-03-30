import { Probot } from "probot";

export const CHECK_NAME = "review-integrity";

export interface PullRequestInfo {
  owner: string;
  repo: string;
  pull_number: number;
  head_sha: string;
}

export async function getCommitters(
  context: any,
  pr: PullRequestInfo
): Promise<Set<string>> {
  const committers = new Set<string>();
  const commits = await context.octokit.paginate(
    context.octokit.pulls.listCommits,
    {
      owner: pr.owner,
      repo: pr.repo,
      pull_number: pr.pull_number,
      per_page: 100,
    }
  );

  for (const commit of commits) {
    if (commit.author?.login) {
      committers.add(commit.author.login);
    }
    if (commit.committer?.login && commit.committer.login !== "web-flow") {
      committers.add(commit.committer.login);
    }
  }

  return committers;
}

export async function getApprovals(
  context: any,
  pr: PullRequestInfo
): Promise<Map<string, string>> {
  const approvals = new Map<string, string>();
  const reviews = await context.octokit.paginate(
    context.octokit.pulls.listReviews,
    {
      owner: pr.owner,
      repo: pr.repo,
      pull_number: pr.pull_number,
      per_page: 100,
    }
  );

  // Process reviews in order — later reviews override earlier ones per user
  for (const review of reviews) {
    const login = review.user?.login;
    if (!login) continue;

    if (review.state === "APPROVED") {
      approvals.set(login, "APPROVED");
    } else if (review.state === "DISMISSED" || review.state === "CHANGES_REQUESTED") {
      approvals.delete(login);
    }
  }

  return approvals;
}

export function buildCheckResult(
  committers: Set<string>,
  approvers: Map<string, string>
): { conclusion: "success" | "failure"; summary: string; text: string } {
  const violatingApprovers: string[] = [];

  for (const [approver] of approvers) {
    if (committers.has(approver)) {
      violatingApprovers.push(approver);
    }
  }

  if (violatingApprovers.length > 0) {
    return {
      conclusion: "failure",
      summary: `Blocked: ${violatingApprovers.length} approval(s) from committers`,
      text: [
        "The following users have both committed to this PR and approved it, which is not allowed:\n",
        ...violatingApprovers.map(
          (u) => `- **@${u}** — committed and approved`
        ),
        "\nA PR must be approved by someone who has **not** committed to the branch.",
        "\n### Committers on this PR",
        ...[...committers].map((u) => `- @${u}`),
        "\n### Current approvals",
        ...(approvers.size > 0
          ? [...approvers.keys()].map((u) =>
              violatingApprovers.includes(u)
                ? `- ~~@${u}~~ (invalid — is a committer)`
                : `- @${u}`
            )
          : ["_No approvals_"]),
      ].join("\n"),
    };
  }

  const hasValidApproval = approvers.size > 0;

  return {
    conclusion: "success",
    summary: hasValidApproval
      ? `Passed: ${approvers.size} valid approval(s) from non-committers`
      : "Passed: No committer has approved (awaiting review from a non-committer)",
    text: [
      "### Committers on this PR",
      ...[...committers].map((u) => `- @${u}`),
      "\n### Current approvals",
      ...(approvers.size > 0
        ? [...approvers.keys()].map((u) => `- @${u}`)
        : ["_No approvals yet — waiting for a non-committer to review_"]),
      "\nAll approvals are from non-committers.",
    ].join("\n"),
  };
}

export async function runCheck(context: any, pr: PullRequestInfo): Promise<void> {
  const app = context as any;
  const log = context.log || context.app?.log;

  log?.info(
    `Running review-integrity check for ${pr.owner}/${pr.repo}#${pr.pull_number} @ ${pr.head_sha}`
  );

  // Create the check run as "in_progress"
  const { data: checkRun } = await context.octokit.checks.create({
    owner: pr.owner,
    repo: pr.repo,
    name: CHECK_NAME,
    head_sha: pr.head_sha,
    status: "in_progress",
    started_at: new Date().toISOString(),
  });

  try {
    const [committers, approvals] = await Promise.all([
      getCommitters(context, pr),
      getApprovals(context, pr),
    ]);

    const result = buildCheckResult(committers, approvals);

    await context.octokit.checks.update({
      owner: pr.owner,
      repo: pr.repo,
      check_run_id: checkRun.id,
      status: "completed",
      conclusion: result.conclusion,
      completed_at: new Date().toISOString(),
      output: {
        title:
          result.conclusion === "success"
            ? "Review integrity: OK"
            : "Review integrity: committer cannot approve",
        summary: result.summary,
        text: result.text,
      },
    });

    log?.info(
      `Check ${result.conclusion} for ${pr.owner}/${pr.repo}#${pr.pull_number}`
    );
  } catch (error) {
    await context.octokit.checks.update({
      owner: pr.owner,
      repo: pr.repo,
      check_run_id: checkRun.id,
      status: "completed",
      conclusion: "failure",
      completed_at: new Date().toISOString(),
      output: {
        title: "Review integrity: error",
        summary: "An error occurred while evaluating review integrity.",
        text: `\`\`\`\n${error}\n\`\`\``,
      },
    });
    throw error;
  }
}

export function extractPrInfo(context: any): PullRequestInfo | null {
  const pr = context.payload.pull_request;
  if (!pr) return null;

  return {
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
    pull_number: pr.number,
    head_sha: pr.head.sha,
  };
}

export default (app: Probot) => {
  // Re-run check on every push to the PR (new commits)
  app.on(
    [
      "pull_request.opened",
      "pull_request.reopened",
      "pull_request.synchronize",
    ],
    async (context) => {
      const pr = extractPrInfo(context);
      if (!pr) return;
      await runCheck(context, pr);
    }
  );

  // Re-run check when a review is submitted, edited, or dismissed
  app.on(
    [
      "pull_request_review.submitted",
      "pull_request_review.edited",
      "pull_request_review.dismissed",
    ],
    async (context) => {
      const pr = extractPrInfo(context);
      if (!pr) return;
      await runCheck(context, pr);
    }
  );

  // Handle check suite requested (GitHub may request re-runs)
  app.on(["check_suite.requested", "check_suite.rerequested"], async (context) => {
    const checkSuite = context.payload.check_suite;
    const pullRequests = checkSuite.pull_requests;

    if (!pullRequests || pullRequests.length === 0) return;

    for (const pr of pullRequests) {
      await runCheck(context, {
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        pull_number: pr.number,
        head_sha: checkSuite.head_sha,
      });
    }
  });

  // Handle manual re-run of the check
  app.on("check_run.rerequested", async (context) => {
    const checkRun = context.payload.check_run;
    if (checkRun.name !== CHECK_NAME) return;

    const pullRequests = checkRun.pull_requests;
    if (!pullRequests || pullRequests.length === 0) return;

    for (const pr of pullRequests) {
      await runCheck(context, {
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        pull_number: pr.number,
        head_sha: checkRun.head_sha,
      });
    }
  });

  app.log.info("check-reviewer-no-commit app loaded");
};
