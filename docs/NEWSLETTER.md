# Weekly newsletter subscriptions

## Scope / isolation
The current Sites frontend remains authoritative. New data resides only in `newsletter_subscribers`, `newsletter_deliveries`, `newsletter_content`, `newsletter_rate_limits`. Existing lead models, forms, scoring and lead mail notifications remain unchanged. Admin endpoints reuse the existing HTTPBearer dependency. Contact/token data is never committed to the public briefing feed.

This is a passwordless opt-in newsletter subscription, not a new customer login/account system. Visitors select topics, official district/settlement preferences and email OR WhatsApp. Consent starts unchecked, is specific to the chosen channel, resets when that channel changes and does not affect customer applications. Notice presentation is recorded separately, without inventing an “I read” declaration.

## Registration / access
POST /api/newsletter/subscribe validates contact, consent, topics and Çanakkale-only regions. Unique contact_key and request_id prevent duplicate documents. Repeated unauthenticated submissions cannot overwrite an existing subscriber. New records remain pending_verification; no automatic bulk sending. Rate limit: 5 requests/hour/IP (hashed keys only), honeypot, validated bounded strings.

Email confirmation uses a signed, purpose-bound seven-day token. Management tokens are signed and purpose-bound, valid up to one year. They are sent in the URL fragment of /bulten/, then submitted in JSON, never token query parameters. GET alone cannot confirm or unsubscribe. Token signing requires NEWSLETTER_TOKEN_SECRET or the existing stable ADMIN_JWT_SECRET. Contact verification alone does not approve sending. Admin reviews permission/İYS and provider/data-transfer requirements and records a note. WhatsApp ownership is manually verified by the admin until a provider-specific OTP flow is installed. A pending email can receive another confirmation from the protected admin action after 24 hours.

POST /api/newsletter/manage reads preferences using the management token; PATCH updates them. POST /api/newsletter/unsubscribe stops new sends immediately and removes contact/name fields. A final withdrawal check occurs just before send. In-flight provider-accepted messages cannot be recalled. Do not reactivate an unsubscribed record through admin approval; fresh permission must be established separately.

Unverified requests expire after 30 days. Cancelled records retain minimal permission/ret information for 180 days; delivery logs expire after 90 days. This is a technical default, not a representation that all applicable statutory retention requirements have been legally settled.

## PDF / relevance
Backend ReportLab generation embeds a licensed DejaVu Sans subset with Turkish glyphs. No third-party customer-data processing is required to create the PDF. Documents include selected topics, selected regions, matching official stories, and requested sales counts/rental renewal reference. National/provincial statistics are clearly labeled; they are never presented as district/village-specific counts. Rental renewal reference uses 24 consecutive CPI levels and the ratio of two consecutive 12-month sums. Missing data stays missing.

The public editorial feed remains schema_version 1 with additive `topics` and `regions`. News sources must have HTTPS .gov.tr or .bel.tr hosts. General road, maintenance and sewer announcements are excluded. Each item needs its actual affected province/district/settlement scope; do not infer settlement codes or fabricate an announcement. Province-wide news can match any local preference; news from a different district cannot. If no relevant official news exists, the PDF states that instead of padding it with unrelated stories.

## Providers / required configuration
See backend/newsletter.env.example. Email supports existing SMTP with TLS OR Resend API with PDF attachments and provider idempotency key. WhatsApp requires Meta Cloud API credentials, phone-number ID, a supported configured Graph version and an approved marketing template with a PDF-document header and TWO body variables: issue date and full management/opt-out URL. A wa.me link is never treated as automated delivery. Meta receives a random seven-day PDF link, protected by a 256-bit token hash; the PDF contains no subscriber name or contact. Provider configuration checks only presence/format, not real delivery verification.

NEWSLETTER_DELIVERY_ENABLED=true and NEWSLETTER_LEGAL_REVIEWED=true must both be set by the operator after real provider/permission checks. Defaults OFF. At the per-subscriber level, status active, contact_verified and delivery_approved must all be true. Global feature flags do not override subscriber withdrawal.

## Weekly task / idempotency
An isolated async backend task checks every 15 minutes while Render is running. Weekly issue becomes due Monday 12:00 Europe/Istanbul; if unavailable, it can catch up later in the same ISO week. Existing daily market workflow wakes Render around 11:30 Istanbul, but uptime/free-service cold starts and GitHub schedule disablement remain external availability risks. This is not a new guaranteed always-on Render cron service. There is no unauthenticated broadcast endpoint. Admin can invoke POST /api/admin/newsletter/dispatch for the current due issue.

A unique delivery _id of subscriber-ID:ISO-week is claimed BEFORE sending. Duplicate workers cannot send it again. Unknown/error responses are not automatically retried because SMTP/Meta may have accepted a message before timing out. Admin sees failed_or_unknown. provider_accepted means provider acceptance, not proven inbox/device receipt. No fabricated success. No tracking pixels. Per-recipient errors never make an existing customer application fail.

## Production checks still required
- Confirm Render installed the pushed backend version and newsletter routes are visible.
- Configure a real sender and signing key; verify a subscribed email address. WhatsApp requires separate Business/approved-template setup.
- Complete İYS, provider and overseas-transfer assessment; enable the two feature flags only after that.
- Exercise a real authorized opt-in end-to-end and verify mailbox/WhatsApp receipt. Without sender credentials/admin account access, this cannot be claimed as tested.
- Scheduled task execution is not demonstrated by storing an automation prompt. The editorial alarm writes only public news JSON and cannot read subscribers or broadcast messages.
