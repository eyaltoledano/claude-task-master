---
"task-master-ai": minor
---

Introduce `tm export` command - bring Task Master to your team

Share your task plans with teammates by exporting local tasks to collaborative briefs on Hamster. Select which tags to export, invite team members, and start collaborating instantly.

**New `tm export` Command**
- Export your local tasks to shareable team briefs
- Hamster will reverse engineer your PRD based on your tasks (reverse parse prd!)
- Select multiple tags to export in one go, import all tasks across tags to Hamster
- Hamster will generate brief titles and descriptions from your task content
- Automatically sets your CLI context to the new brief
- All AI calls handled by Hamster, zero API keys needed - just a Hamster account!

**Team Collaboration**
- Invite teammates during export with `-I, --invite` flag
- Add up to 10 team members by email
- See invitation status: sent, already a member, or error

**Quality of Life Improvements**
- New `tm login` / `tm logout` shortcuts
- Display ID shortcuts: `tm show ham31` now works (normalizes to HAM-31)
- Better task rendering with proper HTML/Markdown support
