# CKR IndexNow publication notifications

The live Sites frontend is authoritative. Never deploy the GitHub frontend over it.
`frontend/scripts/prepare-blog.cjs` generates `/indexnow-manifest.json` from published articles only. The hash covers article text, metadata, and local image bytes. Drafts, visitor data and timestamps of builds are excluded. The existing verification file is not modified.

`.github/workflows/indexnow.yml` runs on GitHub's servers approximately every 15 minutes (scheduled runs can be delayed by GitHub), on watcher-code updates, or manually from Actions. It reads the live manifest and sitemap, not a stale repository blog catalog. No visitor browser is involved. Python uses only its standard library.

Only strict HTTPS self-canonical article URLs on canakkalekonutrehberi.com are eligible. New/updated URLs must return public indexable HTML. Removed URLs must have previously been published and now return 404/410. Redirects, drafts, other domains, query strings and noindex pages are refused. Manifest and sitemap inventories must match to avoid false removals during deployment. Removing a blog must also remove its prerendered HTML; a soft 404 is intentionally not notified.

The first run establishes a baseline without submitting the whole archive. One existing canonical article is submitted once as a verification test; a durable flag prevents repeats on subsequent runs.

`automation/indexnow-state.json` on main holds observed hashes, per-URL revisions, pending events and attempt history. Writes use optimistic blob SHA checks. A write-ahead journal is saved before each external submission. Actions concurrency prevents simultaneous writers. The short-lived built-in GITHUB_TOKEN needs contents:write; no personal token or website secret is needed. Do not place customer information in this state.

HTTP 200 means the provider received the submission; 202 means accepted pending key verification. Neither guarantees indexing. Network failures, validation failures, 429 and 5xx are retried with delays of 5 minutes, 30 minutes, 2 hours, 12 hours and 24 hours, at most six attempts. Actual retries occur at the next available scheduled run. Retry-After is respected up to 24 hours. Other provider 4xx errors stop for investigation. There is a minimum five-minute interval for the same URL. A newer revision supersedes a pending older event. Rare crashes after provider acceptance but before the final journal write may repeat a notification: delivery is at least once, not exactly once.

Review Actions > CKR IndexNow publication notifications, execution-report artifacts (90 days), and the durable JSON history. Unchanged successful polls remain in Actions logs without needless commits. Failed checks are persisted. To recover a permanently failed event, fix the root cause and manually change only its status to `retry`, attempts to `0`, and due_at to a current Unix timestamp in the state file; do not erase the observed inventory or successful events. Then run the workflow manually. Main-branch restrictions must permit the workflow to write its state file.

Local tests: `python3 -m unittest discover -s scripts/tests -p 'test_indexnow_notify.py' -v`. Tests mock HTTP and do not contact IndexNow or customer APIs. Local execution with `--state-file` can submit real URLs and must not be used casually.
