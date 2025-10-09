---
"task-master-ai": minor
---

Add changelog highlights to auto-update notifications

When the CLI auto-updates to a new version, it now displays a "What's New" section showing all Minor Changes from the CHANGELOG. This gives users immediate visibility into new features and improvements without having to manually check the changelog.

The highlights are fetched from unpkg.com CDN with graceful fallback if unavailable.
