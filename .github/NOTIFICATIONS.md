# GitHub Notifications Setup - Failures Only

## Quick Setup (5 seconds)

To **only** receive email notifications when tests fail:

### Option 1: Global Setting (All Repositories)

1. Go to https://github.com/settings/notifications
2. Scroll to **Actions** section
3. Under "Notify me on GitHub for"
   - ✅ Check **Failed workflows only**
   - ❌ Uncheck everything else under Actions

That's it! Now you'll only get notified when builds fail.

### Option 2: Per-Repository Setting

For this specific repository only:

1. Go to repository page
2. Click **Watch** → **Custom**
3. Check these only:
   - ✅ **Releases**
   - ✅ **Pull requests**
   - ✅ **Workflows** → Click "Configure" → Select "Failed only"

## What You'll Get

### ✅ When Tests Pass
- ✅ Green checkmark on commit
- ✅ "All tests passed" in workflow summary
- ❌ **NO EMAIL**
- ❌ **NO NOTIFICATION**

### ❌ When Tests Fail
- ❌ Red X on commit
- 📧 **Email notification**
- 💬 Comment on PR (if it's a pull request)
- 📊 Detailed failure report with screenshots

## Testing Your Setup

Want to verify it works? You can manually trigger a workflow:

1. Go to **Actions** tab
2. Select **E2E Tests**
3. Click **Run workflow**
4. Wait for it to complete
5. If tests pass → You should get **NO email**

## Email Notification Example (Failure Only)

When tests fail, you'll receive an email like:

```
Subject: [serigrafie-brasov] E2E Tests workflow failed on main

Your workflow "E2E Tests" (e2e-tests.yml) has failed.

View workflow run: https://github.com/...

Failed jobs:
  - test: 1 test failed
```

## Unsubscribe from a Specific Workflow

If you want to completely ignore a specific workflow:

1. Go to **Actions** tab
2. Find a run of that workflow
3. Click **...** (three dots)
4. Select **Disable workflow**

## Advanced: Email Filters

If you use Gmail, create a filter to highlight test failures:

**Filter criteria:**
- From: `notifications@github.com`
- Subject: `workflow failed`

**Actions:**
- Apply label: `🔥 CI Failure`
- Mark as important

This way, test failures stand out in your inbox while successful runs don't clutter it.

## Summary

**The workflows are already configured** to minimize noise:
- Artifacts only uploaded on failure (`if: failure()`)
- PR comments only on failure
- Success just shows a green checkmark

**You just need to configure your GitHub account** to only send emails on failures.

With this setup:
- 100 passing builds = 0 emails 🎉
- 1 failing build = 1 email 📧
