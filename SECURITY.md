# Security Policy — HuddlePace

HuddlePace takes the security and privacy of our users and their Slack workspaces seriously. As a source-available application, our codebase is publicly auditable to provide transparency into how data is handled and processed.

---

## Supported Versions

Only the latest release running in production receives active security updates and patches.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

---

## Reporting a Vulnerability

If you discover a potential security vulnerability in HuddlePace, please report it responsibly so we can remediate it before public disclosure.

### How to Report

1. **Email us directly**: Send an encrypted or direct email to **[support@huddlepace.com](mailto:support@huddlepace.com)** with the subject line `[SECURITY] Vulnerability Report - HuddlePace`.
2. **Do NOT open public GitHub issues**: Please avoid opening public issues, discussions, or pull requests detailing undisclosed vulnerabilities.
3. **Include helpful details**:
   - Description of the vulnerability and its potential impact.
   - Exact steps, scripts, or payloads required to reproduce the issue.
   - Affected components, endpoints, or files.
   - Any remediation suggestions you might have.

### Response & Remediation Commitment

- **Initial Acknowledgment**: Within 24 hours of report receipt.
- **Triage & Assessment**: Within 72 hours with an initial severity classification.
- **Patch Release**: Critical security fixes will be deployed to production via our continuous deployment pipeline immediately upon verification.
- **Credit**: We will gladly credit your responsible disclosure in our release notes and changelog once the fix is deployed.

---

## Core Security & Privacy Invariants

Auditors and security reviewers can verify the following invariants directly within this repository:

1. **Zero Voice / Audio Capture**: HuddlePace never joins voice channels, intercepts audio streams, or processes spoken conversation. It tracks meeting pacing strictly via channel metadata and user-initiated Slack commands.
2. **Zero Third-Party AI / LLM Telemetry**: No meeting details, agenda names, or channel communications are transmitted to external AI providers (OpenAI, Anthropic, etc.).
3. **Data Minimization**: Meeting records store only operational timings (`startedAt`, `totalMinutes`, `speakerUserId`), agenda percentages, and thread references. No channel message history is permanently retained.
4. **Least-Privilege Scopes**: The application requests only the minimum set of Slack scopes required to interact with threads and detect native call lifecycle boundaries.
