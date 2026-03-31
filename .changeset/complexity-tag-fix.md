---
"@tm/core": patch
---

Fix: Ensure ComplexityReportManager uses resolved tag consistently when loading reports

This fixes a potential bug where the cache key and file path could use different tag values when loading complexity reports. The fix ensures that when tag is undefined, both the cache lookup and file path resolution use 'master' consistently.

Fixes #1614
