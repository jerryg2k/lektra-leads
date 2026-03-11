# Lektra Cloud Lead Intelligence — TODO

## Database & Backend
- [x] Lead table schema (company, industry, funding stage, location, GPU use case, score, pipeline stage)
- [x] Contact table schema (name, title, LinkedIn URL, email, company FK)
- [x] Lead scoring engine (server-side, weighted scoring by GPU spend signals)
- [x] tRPC routers: leads CRUD, contacts CRUD, pipeline stage update, import, export
- [x] Apollo.io CSV import endpoint (parse + map to lead/contact schema)
- [x] HubSpot-compatible CSV export endpoint

## Frontend — Lead Database
- [x] Lead list view with sortable table (company, score, stage, industry, funding, location)
- [x] Filter bar: industry, funding stage, location, GPU spend likelihood (score range)
- [x] Search bar across company name, description, contacts
- [x] Loading skeletons and empty states

## Frontend — Lead Scoring
- [x] Score badge (0–100) with color coding (Hot/Warm/Cool/Cold)
- [x] Score breakdown panel (which signals contributed with progress bars)
- [x] Re-score trigger button per lead

## Frontend — Lead Detail View
- [x] Company info card (name, website, description, industry, funding, location, headcount)
- [x] GPU use case analysis section (inference / training / remote viz)
- [x] Lektra value proposition match section (H200 / RTX Pro 6000 / B200 fit)
- [x] Contact profiles: name, title, LinkedIn link, fit reasoning
- [x] Pipeline stage selector (New → Contacted → Qualified → Closed)
- [x] Notes/activity log per lead

## Frontend — Pipeline Dashboard
- [x] Kanban-style pipeline board (New / Contacted / Qualified / Closed)
- [x] Lead cards on pipeline board with score badge
- [x] Click-to-move between stages via dropdown

## Frontend — Import / Export
- [x] Apollo.io CSV import page with field mapping guide and preview
- [x] HubSpot CSV export button (filtered or all leads)
- [x] Import validation and error reporting

## UI / UX
- [x] DashboardLayout with sidebar navigation
- [x] Mobile-responsive layout (Android phone, tablet, PC)
- [x] Dark Lektra brand theme (green primary accent)
- [x] Empty states for all views
- [x] Loading skeletons

## Data
- [x] Seeded 15 realistic AI startup leads with contacts and scores

## Tests
- [x] Vitest: lead scoring engine unit tests (9 tests)
- [x] Vitest: GPU recommendation engine tests (4 tests)
- [x] Vitest: CSV escape utility tests (5 tests)
- [x] Vitest: auth logout test (1 test)
- [x] All 21 tests passing

## Lead Discovery Engine (new feature)
- [x] Discover page with search controls (keywords, industry, funding stage, headcount)
- [x] Server-side discovery router using LinkedIn company details API
- [x] LinkedIn people search for founders/CEOs at discovered companies
- [x] LLM-powered Lektra fit analysis for each discovered company
- [x] Auto-scoring of discovered companies using existing scoring engine
- [x] One-click "Add to Leads" from discovery results
- [x] Duplicate detection (skip companies already in leads database)
- [x] Discovery results display with score, fit reason, and LinkedIn links
- [x] Curated seed list of 70+ known AI GPU startup LinkedIn slugs for reliable discovery

## AI Email Draft Creator (new)
- [x] Server-side tRPC procedure: leads.draftEmail using LLM with Jerry's style profile
- [x] Email draft modal on Lead Detail page with contact selector
- [x] Editable draft textarea with copy-to-clipboard
- [x] "Save to Gmail Drafts" button
- [x] Regenerate button for alternate drafts

## LinkedIn Sales Navigator Draft (new)
- [x] Add linkedin_connect email type to draftEmail procedure with 300-char enforcement
- [x] LinkedIn tab in draft modal with live character counter (300 limit)
- [x] Direct "Open in Sales Navigator" link for the contact
- [x] Copy to clipboard button for LinkedIn note

## Add Lead Auto-Enrichment (new)
- [x] Server-side enrichLead tRPC procedure (LinkedIn API + LLM)
- [x] Auto-fill company description, industry, headcount, funding, tech stack, GPU use cases
- [x] Debounced enrichment trigger on company name / website input
- [x] Loading skeleton while enrichment runs
- [x] Editable enriched fields before saving
- [x] Confidence indicator showing which fields were auto-filled

## Three Scheduled Features
- [x] Feature 1: Re-enrich button on Lead Detail page (server reEnrich procedure + Sparkles button in header)
- [x] Feature 2: Auto-enrich contacts on creation via LinkedIn (people search + headline/URL auto-fill + toast)
- [x] Feature 3: Data completeness score (0-10) on lead cards and detail header (red<4, amber 4-7, green 8-10)

## Next Steps Batch (Follow-up, Bulk Re-enrich, Export Filter)
- [x] Follow-up scheduler: date picker on Lead Detail page (+1/3/5/7/14d shortcuts, note field, clear button)
- [x] Follow-up: store followUpAt + followUpNote in leads table (schema + SQL migration)
- [x] Follow-up: "Needs Attention" section on Dashboard (red border card, days overdue badge)
- [x] Bulk re-enrich: "Bulk Re-enrich" button on Leads page (re-enriches all leads with completeness < 7)
- [x] Bulk re-enrich: toast showing X/Y leads enriched after completion
- [x] HubSpot export: completeness filter slider (0-10) with preset buttons (All, ≥5, ≥7, ≥9)
- [x] HubSpot export: "Preview Count" button shows matching lead count before download

## Email Sequences, Analytics & AI Strategy (new batch)
- [x] Feature 1: Follow-up email sequences — "Start Sequence" button on Lead Detail
- [x] Feature 1: emailSequences table (leadId, contactId, day, subject, body, status, scheduledAt, sentAt)
- [x] Feature 1: sequences.create procedure — generates Day 1/4/10 email drafts via LLM
- [x] Feature 1: sequences.list procedure — returns all sequences for a lead
- [x] Feature 1: sequences.updateStatus procedure — mark as Sent / Skipped
- [x] Feature 1: Sequence UI on Lead Detail — timeline view of Day 1/4/10 emails with copy/edit/mark-sent
- [x] Feature 2: Lead source analytics — bar/donut chart on Dashboard (LinkedIn / Apollo / Manual / Discovered)
- [x] Feature 2: Average score per source shown alongside count
- [x] Feature 3: AI Strategy Advisor — "Get Strategy" button on Lead Detail notes section
- [x] Feature 3: Server procedure: analyzeLeadStrategy — reads all notes + lead data, returns structured strategy
- [x] Feature 3: Strategy output: engagement summary, recommended next action, talking points, objection handlers
- [x] Feature 3: Strategy panel rendered with Streamdown markdown on Lead Detail page

## Notes UX + Automation Batch (new)
- [x] Edit notes inline in activity log (pencil icon, inline textarea, save/cancel)
- [x] Delete notes with confirmation dialog
- [x] Word wrap for long note text (no truncation, whitespace-pre-wrap)
- [x] Auto-log note when sequence email step is marked sent
- [x] Auto-run strategy analysis invalidation when a note is saved
- [x] Weekly BD digest email every Monday 8am (scheduled, top overdue + new leads summary)

## Font Size + Quick Actions + Note Templates + Digest Settings
- [x] Increase base font size globally (Galaxy Tab readability)
- [x] Note templates quick-fill dropdown (Left voicemail, Sent intro email, Demo scheduled, etc.)
- [x] Lead card quick-actions: Log Call, Move Stage, Schedule Follow-up without opening detail page
- [x] Digest timezone preference settings page

## Note Edit & Delete (new request)
- [ ] Edit note inline in activity log (pencil icon → textarea → save/cancel)
- [ ] Delete note with confirmation (trash icon → confirm dialog)
- [ ] Backend: notes.update procedure (update content by note id)
- [ ] Backend: notes.delete procedure (delete note by id)

## Email Sequence Edit & Delete (new request)
- [x] Backend: sequences.updateStep procedure (edit subject + body by sequence id)
- [x] Backend: sequences.deleteStep procedure (delete a single step by id)
- [x] Backend: sequences.deleteAll procedure (delete entire sequence for a lead)
- [x] UI: Edit button on each sequence step card (inline subject + body editor)
- [x] UI: Delete button on each step with confirmation
- [x] UI: "Delete entire sequence" button at the top of the sequence panel

## Needs Attention Improvements (new request)
- [x] Inline edit follow-up date and note directly from Dashboard card
- [x] "Mark Complete" button on each Needs Attention card that clears the follow-up alarm
- [x] After marking complete, navigate to Lead Detail page anchored to the Notes/Next Steps section
- [x] Backend: leads.clearFollowUp procedure (sets followUpAt and followUpNote to null)

## Follow-up Alarm UX Improvements (new request)
- [x] Snooze 3 days button on each Needs Attention card (defers followUpAt by 3 days)
- [x] Bulk "Clear All" button at top of Needs Attention section
- [x] Follow-up Edit / Mark Complete / Snooze controls in Lead Detail page header

## Follow-up UX Polish (new request)
- [x] Custom snooze duration popover: 1d / 3d / 7d / 2w options (Dashboard + Lead Detail)
- [x] Auto-log note to activity log when follow-up is snoozed or marked complete
- [x] Red overdue count badge on Dashboard sidebar nav item

## Follow-up History & Digest (new request)
- [x] Follow-up history collapsible section on Lead Detail (filters activity log to Follow-up notes only)
- [x] Overdue badge on mobile bottom nav bar (mirrors sidebar badge)
- [x] Weekly digest email opens with overdue follow-up count before top prospects list

## CSV Export, Tagging & Bulk Actions (new request)
- [ ] CSV export button on Leads page (exports company, stage, score, follow-up date, last note, tags)
- [ ] Backend: leads.exportCsv procedure returning CSV string
- [ ] Lead tagging: tags column on leads table (JSON array of strings)
- [ ] Backend: leads.updateTags procedure
- [ ] Tag input UI on Lead Detail page (add/remove tags inline)
- [ ] Tag filter on Leads list page
- [ ] Bulk stage update: checkboxes on Leads list rows
- [ ] Bulk action bar appears when 1+ leads selected (Move to Stage dropdown + Apply button)
- [ ] Backend: leads.bulkUpdateStage procedure

## Daily Auto-Scan for New AI Startups (new request)
- [x] scanHistory table: id, runAt, source, found, added, skipped, status, errorMsg
- [x] Backend: dailyScan function — searches web for new AI startups, enriches via LLM, deduplicates, inserts qualifying leads
- [x] Cron job: runs daily at 6 AM UTC
- [x] Backend: scan.runNow procedure (manual trigger, protected)
- [x] Backend: scan.history procedure (list recent scan runs)
- [x] Backend: scan.latestResults procedure (leads added in last scan)
- [x] Discover page: "Auto-Scan" tab showing last run time, stats, and leads added
- [x] Discover page: "Run Now" button with loading state
- [x] Discover page: scan history log table
- [x] Owner notification when scan completes (X new leads added)

## GTC 2026 & Scan Polish (new request)
- [x] Settings: scan keyword themes field (comma-separated custom search terms)
- [x] Settings: scan frequency control (daily / every 3 days / weekly)
- [x] Backend: persist scanKeywords and scanFrequency in userSettings table
- [x] dailyScan.ts: read scanKeywords from userSettings and inject into LLM prompt
- [x] dailyScan.ts: respect scanFrequency (skip run if not due based on last run date)
- [x] Leads page: "Pending Review" filter tab for auto-scan tagged leads
- [x] Leads page: Approve (keep) / Archive action on auto-scan leads in review queue
- [x] Business Card Scanner: dedicated page with camera capture or image upload
- [x] Business Card Scanner: LLM vision OCR extracts name, title, company, email, phone, website
- [x] Business Card Scanner: pre-filled Add Lead form from extracted data with edit before save
- [x] Business Card Scanner: sidebar nav item with camera icon
- [x] Business Card Scanner: GTC 2026 event tag auto-applied to scanned leads

## GTC 2026 Advanced Features (new request)
- [x] GTC-2026 CSV export shortcut on Leads page (pre-filtered by GTC-2026 tag)
- [x] Scan Card page: Recent Scans section showing last 10 cards (thumbnail + company + date)
- [x] Backend: scanLog table to persist card scan results (imageUrl, company, contactName, leadId, scannedAt)
- [x] After saving scanned card as lead, auto-trigger Discover enrichment (funding, headcount, description)
- [x] NFC contact exchange page: write Lektra vCard to NFC tag for tap-to-share
- [x] NFC contact exchange: read NFC tag from another person's card and auto-fill lead form
- [x] NFC page: sidebar nav item or button on Scan Card page
- [x] NFC: graceful fallback for unsupported browsers (show QR code alternative)

## GTC 2026 Conference Mode (new request)
- [x] Service worker: cache Scan Card and NFC Exchange pages for offline use
- [x] Service worker: queue card scans locally when offline, sync on reconnect
- [x] Offline banner: show "Offline — scans queued" indicator when no network
- [x] Batch scan session: "Start Session" button on Scan Card page
- [x] Batch scan session: queue multiple scans, review all at end before saving
- [x] Batch scan session: session summary (X cards scanned, X saved, X discarded)
- [x] Lead source attribution: set source="GTC-2026 Card Scan" on card scan leads
- [x] Lead source attribution: set source="GTC-2026 NFC" on NFC exchange leads
- [x] Source field visible on Lead Detail and Leads list

## GTC 2026 Finishing Touches (new request)
- [x] GTC leaderboard widget on Dashboard (cards scanned, leads saved, top company by score)
- [x] Backend: scan.gtcStats procedure (count GTC-tagged leads, top lead by score)
- [x] GTC intro email template auto-selected in sequence generator for GTC-tagged leads
- [x] Sequence generator: detect GTC-2026 tag and pre-fill intro context in LLM prompt
- [x] PWA manifest.json with name, icons, start_url=/scan-card, display=standalone
- [x] Link manifest in index.html for home screen install on Android/Galaxy Tab

## GTC 2026 Strategy Tab (new request)
- [x] Research GTC 2026 presenters, sponsors, exhibitors from public sources
- [x] Backend: gtcTargets table (company, type: presenter/sponsor/exhibitor, description, gpuFit, priority, addedToLeads)
- [x] Backend: gtc.targets procedure (list all targets with priority score)
- [x] Backend: gtc.addToLeads procedure (add selected target as lead)
- [x] Backend: gtc.updateNotes procedure (save strategy notes per target)
- [x] Discover page: GTC Strategy tab with priority tiers (Must Meet / High Value / Worth Visiting)
- [x] GTC Strategy tab: filter by tier (Must Meet / High Value / Worth Visiting / All)
- [x] GTC Strategy tab: search by company/contact name
- [x] GTC Strategy tab: add-to-pipeline button per target
- [x] GTC Strategy tab: show already-in-pipeline badge
- [x] GTC Strategy tab: expandable notes editor per target
- [x] GTC Strategy tab: GPU fit reason shown per target

## Bug: Socket Exception Flashing (reported)
- [x] Diagnose socket exception causing UI flashing (stale esbuild error — server healthy, NFC write bug was root cause of flash)
- [x] Fix root cause (NFC write now uses compatible text record type with specific error messages)

## Bug: NFC Write Failed (reported)
- [x] Fix NFC write failure on NFC Exchange page
- [x] Improve error messages and user guidance for NFC write

## NFC Exchange Improvements (new request)
- [x] NFC tag type guide tooltip with link to NTAG213/215/216 tags
- [x] Persist My Card profile (name, title, phone, etc.) to DB per user
- [x] QR code camera scanner using jsQR for contactless lead capture

## Remove NFC Exchange (simplification)
- [x] Remove NfcExchange.tsx page file
- [x] Remove NFC route from App.tsx
- [x] Remove NFC nav item from DashboardLayout.tsx

## GTC 2026 Final Polish (new request)
- [x] QR code download button on Scan Card page (saves PNG to device)
- [x] Batch Scan: "Scan Another" shortcut after each scan to immediately reopen camera
- [x] Dashboard GTC widget: bulk "Start sequences for all uncontacted GTC leads" button

## Lead Type: Partner Option (new request)
- [x] Add leadType enum field to leads schema (Prospect, Partner, Investor, Other)
- [x] Run DB migration (pnpm db:push)
- [x] Add leadType to LeadCreateSchema and leads.update input in routers.ts
- [x] Business Card Scanner: add lead type selector (Prospect / Partner / Investor / Other) before saving
- [x] Batch Scan Session: add lead type selector per card in review queue
- [x] Discovery search: add lead type selector in the "Add to Leads" confirmation
- [x] GTC Strategy addToPipeline: pass leadType through (default Prospect)
- [x] Lead Detail page: show lead type badge in header
- [x] Leads list: show lead type badge on cards/rows

## Lead Type Filter, Pipeline Badge & CSV Export (new request)
- [x] Leads page: Lead Type filter dropdown (All / Prospect / Partner / Investor / Other)
- [x] Backend: leads.list procedure — support leadType filter param
- [x] Pipeline Kanban: show LeadTypeBadge on each lead card
- [x] HubSpot CSV export: include leadType column

## Lead Type Detail Edit, Dashboard Stat & Digest Breakdown (new request)
- [x] Lead Detail edit form: add Lead Type selector (Prospect / Partner / Investor / Other)
- [x] Backend: leads.update procedure — accept leadType field
- [x] Dashboard: "Relationship Mix" card showing Prospect/Partner/Investor/Other counts with % bars
- [x] Backend: leads.leadTypeStats procedure returns counts grouped by leadType
- [x] Weekly digest email: Relationship Mix section (shown when Partners/Investors exist)

## GTC Strategy Lead Type Badge & Leads CSV Export (new request)
- [x] GTC Strategy tab: show Lead Type badge on each target card (pre-classify before adding to pipeline)
- [x] GTC Strategy tab: lead type selector per target (defaults to global selector, overridable per card)
- [x] Backend: gtc.addToPipeline — pass per-card leadType through
- [x] Leads page: "Download CSV" button exporting company, stage, score, lead type, follow-up date, last note, tags
- [x] Backend: leads.exportCsv procedure returning full CSV string

## Mobile Header UX — Leads Page (new request)
- [x] Collapse secondary action buttons (Bulk Re-enrich, Download CSV, GTC Export, Export HubSpot) into a labelled "Actions" overflow menu on mobile
- [x] Keep "Add Lead" as the primary CTA always visible on mobile
- [x] Ensure each menu item has an icon + clear text label
- [x] Preserve full button row on desktop (sm: and above)

## Mobile UX Improvements Round 2 (new request)
- [x] Dashboard page: collapse secondary header buttons (Send Digest, Scan Card, Batch Scan) into "Actions ⋯" overflow menu on mobile (Pipeline header had no buttons to collapse)
- [x] Leads page: sticky search bar + filter toggle on mobile (stays visible while scrolling)
- [x] Leads page: full-width labelled "Change Stage" + "Add Note" button strip on mobile lead cards (replaces tiny icon-only row)

## Bulk Stage Update, Pull-to-Refresh & Mobile Lead Detail (new request)
- [x] Leads table: row checkboxes + bulk "Move to Stage" action bar
- [x] Backend: leads.bulkUpdateStage procedure
- [x] Pull-to-refresh on mobile Leads page (usePullToRefresh hook + PullToRefreshIndicator)
- [x] Pull-to-refresh on mobile Pipeline page
- [x] Lead Detail: floating "Add Note" FAB on mobile + pull-to-refresh

## Bug: Mark Complete Does Nothing on Overdue Follow-up (reported)
- [x] Root cause: Drizzle ORM ignores `undefined` fields in `.set()`, so `date ?? undefined` never wrote NULL to the DB
- [x] Fix: use `sql\`NULL\`` literal for followUpAt and followUpNote when clearing
- [x] Add `sql` to drizzle-orm imports, consolidate duplicate `getDb` import
- [x] 38 tests passing, 0 TS errors
