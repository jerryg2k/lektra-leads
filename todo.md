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
