---
"task-master-ai": patch
---

Fix telemetry privacy defaults: AI prompt/response recording and PII collection are now disabled by default. Sentry telemetry still tracks errors and performance spans, but no longer sends AI prompt content, task descriptions, or PRD text to Sentry.
