# CogniTwist AI — controlled Strix security assessment

Status: **NOT RUN**. This is an execution runbook, not a Strix finding or penetration-test certificate. The current assistant environment cannot run Docker, fetch the source tree over the network, or authenticate the Strix LLM provider. The source-review fixes in PR #3 are separate from a Strix scan.

## Boundaries and cost control

- Target **only** this owned repository and an isolated local/staging deployment. Do **not** point Strix at production, third-party ATS sites, Supabase, Google, Render, Vercel control planes or real member data.
- Start with a source-only scan and dummy credentials/test data. Disable outbound email, WhatsApp invitations, paid models and real application submissions in staging.
- Open-source Strix needs a working local Docker engine and an authenticated supported LLM provider. Its open-source licence does **not** mean third-party model API calls or hosting are free. No paid Strix Cloud account, credits, top-up, or auto-billing is authorised by this runbook.
- Strix documents interactive `strix auth login chatgpt` and `STRIX_LLM=chatgpt/gpt-5.4` for eligible ChatGPT subscriptions. Check `strix auth status` before running; if it is unavailable, stop rather than silently switching to a billed API key. A subscription may have usage limits.
- Use a clean, trusted source checkout with no `.env*`, credentials, production database dumps, CVs, interview recordings or personal information in the scan workspace. Strix findings may contain sensitive proofs of concept: `strix_runs/` is gitignored.

## Local code assessment

From a terminal on an owned development machine with Docker Desktop running:

```bash
# First inspect official Strix installation instructions and verify the installer.
# https://github.com/usestrix/strix#quick-start
# Install Strix using the official instructions; do not execute unreviewed installers.

strix auth login chatgpt
strix auth status
export STRIX_LLM='chatgpt/gpt-5.4'
unset LLM_API_KEY

# Run source-only: no production host or live API target.
strix -n --target ./ --scan-mode quick
```

If the local ChatGPT authentication method is unavailable, do not start the scan using an automatically billed provider. Review local Docker sandbox networking and the selected model's limits before executing any active exploit tests.

Strix's headless exit codes are documented as `0` no vulnerabilities found within analysed scope, `1` fatal error and `2` vulnerabilities found. **Exit code 0 does not prove the whole application secure**: review `strix_runs/<run-name>/run.json` for coverage/status, the final report and `vulnerabilities.json` for reproducible findings. Preserve the original report in a restricted location outside Git. Do not attach exploit payloads or private data to public issues.

## Staging-only active assessment

After source-only review, use an isolated test deployment with fictitious users and a disposable database. Confirm that the target host, the app and every upstream it can call are within your authorised testing scope, and that no irreversible emails/calls/payments/application submissions can run. Then add `--target https://<staging-host>` to the Strix invocation **only after** these conditions are met. Never point an autonomous scan at production without a separately approved scope and safety controls.

## Remediation and release evidence

For each reproducible finding, record: target/route, severity, preconditions, privacy impact, root cause, regression test, patch/PR, test result and Strix retest result. Require separate evidence for authentication/authorisation (including IDOR/CSRF), injection/SSRF, upload handling, secrets, AI prompt/tool trust boundaries, dependency advisories, crawler egress, tenant isolation and rate limits. Retest the same attack path after each fix, run frontend/backend regression, and deploy only after reviewing the report and accepting residual risk.

Open issues remain for distributed rate limiting, deployed secrets and Supabase RLS verification, CSP tightening, comprehensive authenticated testing and infrastructure settings. Code inspection alone cannot close them.

References: https://github.com/usestrix/strix and https://github.com/usestrix/strix/blob/main/AGENTS.md
