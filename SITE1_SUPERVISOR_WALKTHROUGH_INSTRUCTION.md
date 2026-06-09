# SITE1 — Builder & Supervisor Walkthrough UX Fixes (instruction)

_Source: live mobile walkthrough (Builder = Peter, Supervisor = Steve). Saved to repo 2026-06-09._

> Core issue: SITE1 has the right data, but too often sends the user to a **module** instead of the **exact action/record**. This sprint: reduce friction, improve action routing, make Builder/Supervisor more operational. Do not add modules until these are fixed.

## Items
1. **Action Queue deep-linking** — every item opens the exact record (variation→detail, task→detail, hazard→detail, issue→detail, timesheet→daily labour approval summary, PO→PO, inspection→inspection). No module list unless there's no single record.
2. **Whole action card tappable** (not the small Open button).
3. **Consolidate repetitive items** — if >3 of the same type in the same project/context, summarise to one grouped action ("36 overdue tasks require attention") that deep-links to a filtered view.
4. **Rework supervisor queue** — priority order: (1) open high-risk hazards (2) open shifts/missing sign-outs (3) daily log outstanding (4) overdue critical tasks (5) issues (6) inspections due (7) material/procurement blockers. Show top 5 + "View All Actions".
5. **Builder end-of-day labour review** — one builder action per project per day ("Daily labour review required — [Project]"). Trigger: 4:00pm default, OR all signed out, OR 5:00pm if open shifts. Summary screen: date, project, workers, clock in/out, total hours, open/missing sign-outs, multiple sign-in/out periods, variation labour, daily log status, approve/flag/edit.
6. **Link Daily Log + labour + variation labour** — Daily Log section "Was variation work carried out today?" No/Yes → structured fields (description, workers involved, hours per worker, photos, notes, related variation if available, mark as potential new variation). Structured inputs, not free text.
7. **Task creation completion flow** — after create, success screen ("Task Created" + title/assignee/project/due/priority/status) with View Task / Create Another / Back to Tasks. Task must appear in correct views immediately.
8. **"Created by Me" task view** — tabs: Assigned to Me / Created by Me / Project Tasks / Team Tasks, each with a count badge reflecting current project context.
9. **Persistent project context** — every project-scoped screen shows project header + selector + on-site status. Switching project inside a feature keeps you in that feature for the new project (Tasks→A switch→Tasks→B), not back to the dashboard.
10. **Sticky supervisor metrics bar** — On Site / Tasks Due / Issues / Hazards, sticky below the header, each tappable→filtered screen, with a badge for new unseen items.
11. **Client visibility needs builder approval** — only Builder/Office publish to client directly. Supervisor/Worker action becomes "Request client visibility" → status "Awaiting Builder Approval" → builder queue gets "Client visibility approval required" (approve/reject/view). Content only visible to client after builder approval.
12. **Mobile visibility/contrast** — higher-contrast date text, larger/clearer action summary count, larger/bolder priority badges, larger back button + hit area, clearer tappable card shapes, obvious Add buttons. Assume daylight.
13. **Larger Add / quick-action buttons** — bigger obvious add control; consider a floating bottom action button (Add Task / Take Photo / Report Hazard / Add Issue).
14. **Due date + time picker** — date and time in one flow; presets Today / Tomorrow / End of Day / Custom.
15. **Task comment optional** — task create/save must not require a comment.
16. **Permission requests** — request camera/location at onboarding/first use with explanation, not repeatedly mid-workflow.
17. **Persistent navigation** — builder mobile bottom nav stays visible on normal screens; hide only for true full-screen (PDF/document, signature, camera).
18. **Variation workflow** — cards make status obvious (Draft / Ready to Send / Sent-Awaiting Client / Approved / Rejected / Revision) with strong labels; action-queue items route straight to the variation with the next primary action ("Send to Client" when ready).
19. **Testing** — manual mobile tests for: variation send (Builder), one daily labour review per project (Builder), grouped overdue tasks (Supervisor), task success + Created-by-Me/Team + worker visibility (Supervisor), request-client-visibility approval (Supervisor→Builder).

## Product principle
Builder experience helps **Peter approve the digital record of the day**. Supervisor experience helps **Steve run the site without thinking about the software**. Don't add modules until these are fixed.
