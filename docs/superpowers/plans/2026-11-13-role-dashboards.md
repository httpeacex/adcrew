# AdCrew role dashboards implementation plan

Spec: docs/requirements-2026-11-13.md and supplied Coursie design prompt.
Goal: adapt the reference to real role-specific work without fictional metrics.
Architecture: pure dashboard selectors shared by server and browser; existing store enforces access; UI uses current task routes and forms.
Stack: React, Next.js, Vite demo, TypeScript, node:test, Playwright.

- [x] Add tested role-scoped dashboard selectors, priority ordering and deadline attention.
- [x] Replace generic dashboard with role metrics and task tables. Keep Coursie layout and exact palette.
- [x] Show five permanent ordered board columns, named participants and task timing.
- [x] Add Library of accepted results using existing protected task/file access.
- [x] Group navigation into Dashboard, Tasks, Library, Analytics and Settings; retain additional existing functions within relevant pages.
- [x] Verify types, lint, unit tests, static build and browser role/navigation/responsive behavior.

Ruling: continue in the current checkout to preserve the user's uncommitted design work; no worktree or commit required for this stage.
Ruling: use a clearly stated 2-hour warning window provisionally (within requested 1–2h); do not invent subscription allocations or convert historical RUB to USD.
Ruling: first delivery covers role dashboards, board structure, library and navigation. Workflow extensions and USD tariff migration remain separate milestones, tracked in requirements rather than represented as completed.
Review focus: cross-user disclosure, UTC+5 day boundary, revision counts separate from in-progress, completed tasks excluded from risk, unpriced finance never displayed as zero spend.

Verification: 17 unit tests passed; typecheck and lint passed; build:pages passed; 5 browser tests passed for 3 roles, library search, KPI navigation, board ordering, drawer, themes and mobile profile. Screenshots reviewed for desktop and 390px mobile.
