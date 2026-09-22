# Project Rules — HuddlePace

## CI/CD Monitoring Protocol
- **Mandatory CI/CD Monitoring on Push**: Whenever changes are pushed to remote (`git push`), the agent MUST proactively monitor the triggered GitHub Actions workflow run (using `gh run list --limit 1` or `gh run view`) until it completes, and verify whether the deployment/tests succeeded (`✓`) or failed before concluding the task.
