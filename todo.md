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
