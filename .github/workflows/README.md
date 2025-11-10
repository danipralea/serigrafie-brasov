# GitHub Actions CI/CD

This directory contains GitHub Actions workflows for continuous integration and testing.

## Workflows

### 1. `ci.yml` - Quick CI Checks
Runs on every push and pull request.

**What it does:**
- Type checks the client code
- Builds client and functions
- Validates that everything compiles

**Duration:** ~2-3 minutes

### 2. `e2e-tests.yml` - End-to-End Tests
Runs comprehensive e2e tests with Firebase emulators.

**What it does:**
- Sets up Node.js and Java
- Installs Firebase CLI and Playwright
- Starts Firebase emulators (Auth, Firestore, Storage, Functions)
- Runs all 8 Playwright e2e tests
- **Only uploads artifacts and reports on failure**

**Duration:** ~5-7 minutes

## Notification Strategy

### What Gets Reported

#### ✅ On Success
- Simple success summary in workflow run
- Green checkmark on commit/PR
- **No artifacts uploaded**
- **No notifications sent**

#### ❌ On Failure
- Detailed failure summary with links
- Playwright HTML report (uploaded as artifact)
- Screenshots and videos of failures (uploaded as artifact)
- Automatic PR comment (on pull requests only)
- **Email notification** (if you have GitHub notifications enabled)

### Configuring GitHub Notifications

To **only** receive notifications on failures:

1. Go to **GitHub.com** → **Settings** → **Notifications**
2. Under **Actions**, select:
   - ✅ **Only notify for failed workflows**
   - ❌ **Uncheck** "Notify for successful workflows"

Or configure per-repository:

1. Go to your **repository** → **Watch** → **Custom**
2. Check only: **Issues**, **Pull requests**, and **Workflows** (with failures only)

### Workflow-Level Configuration

Our workflows are already configured to minimize noise:

```yaml
# Artifacts only uploaded on failure
- name: Upload test results
  if: failure()  # ← Only runs when tests fail
  uses: actions/upload-artifact@v4
```

```yaml
# PR comments only on failure
- name: Comment on PR (failure only)
  if: failure() && github.event_name == 'pull_request'
  uses: actions/github-script@v7
```

## Viewing Test Results

### When Tests Pass
- Check the green checkmark on your commit
- View the workflow summary for a quick "All tests passed" message

### When Tests Fail
1. Click the failed workflow run
2. Scroll to **Artifacts** section at the bottom
3. Download:
   - `playwright-report` - Interactive HTML report with traces
   - `test-results` - Screenshots and videos

Or click the link in the PR comment for quick access.

## Running Workflows Manually

You can trigger workflows manually from the Actions tab:

1. Go to **Actions** tab in your repository
2. Select **E2E Tests** workflow
3. Click **Run workflow**
4. Choose branch and run

## Local vs CI Differences

| Aspect | Local Development | CI (GitHub Actions) |
|--------|------------------|---------------------|
| Emulator Start | Manual (`npm run emulators`) | Automatic (background) |
| Browser | Headed (visible) | Headless (no GUI) |
| Test Output | Terminal + trace files | Artifacts + summaries |
| Speed | ~15 seconds | ~5-7 minutes (including setup) |

## Troubleshooting CI

### Tests Pass Locally but Fail in CI

**Common causes:**
1. **Timing issues**: CI may be slower, increase timeouts
2. **Environment variables**: Check if any .env files are missing
3. **Browser differences**: CI uses headless mode

**Debug steps:**
1. Download the test artifacts from failed run
2. Open `playwright-report/index.html` locally
3. Review traces and screenshots
4. Add more explicit waits if needed

### Emulator Startup Fails

The workflow waits up to 60 seconds for emulators to start. If this fails:

```yaml
# Increase timeout in e2e-tests.yml
timeout 120 bash -c 'until curl -f http://localhost:4000 > /dev/null 2>&1; do sleep 2; done'
```

### Java Version Issues

We're using Java 21 (latest LTS). If Firestore emulator has issues:

```yaml
- name: Setup Java
  uses: actions/setup-java@v4
  with:
    distribution: 'temurin'
    java-version: '17'  # ← Try older version
```

## Cost Considerations

GitHub Actions minutes:

- **Public repos**: Unlimited free minutes
- **Private repos**: 2,000 free minutes/month, then $0.008/minute

Our e2e-tests workflow uses ~7 minutes per run. With typical usage:
- 10 PRs/week × 2 commits each × 7 minutes = **140 minutes/week**
- Well within free tier limits

## Future Improvements

Potential enhancements:

1. **Parallel Testing**: Run tests across multiple browsers
2. **Sharding**: Split tests into multiple jobs for faster execution
3. **Slack/Discord Notifications**: Custom alerts on failure
4. **Automatic Retries**: Re-run flaky tests automatically
5. **Performance Tracking**: Monitor test duration trends

## Status Badges

Add to your README.md:

```markdown
![E2E Tests](https://github.com/USERNAME/REPO/actions/workflows/e2e-tests.yml/badge.svg)
![CI](https://github.com/USERNAME/REPO/actions/workflows/ci.yml/badge.svg)
```

Replace `USERNAME/REPO` with your GitHub username and repository name.
