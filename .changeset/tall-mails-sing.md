---
'task-master-ai': patch
---

ensures that the second fallback which tries to call research if main and fallback both fail will correctly check if the api key is set before attempting to make the call. this closes #421 #519
