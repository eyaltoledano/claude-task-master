---
"@tm/cli": patch
"@tm/core": patch
---

Add --watch flag to list command for real-time task updates. Implements unified watch API in tm-core with proper resource cleanup. Can be used with other filters i.e. `tm list all -w` or `tm list -w --compact`
