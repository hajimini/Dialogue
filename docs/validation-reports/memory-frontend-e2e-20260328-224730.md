# Memory Frontend E2E

- Generated at: 2026-03-28T14:46:57.373Z
- Base URL: http://localhost:3000

| Flow | Result | Notes |
| --- | --- | --- |
| unauthenticated /api/memories | PASS | status=401 |
| user login | PASS | ok |
| admin login | PASS | ok |
| admin create memory | PASS | 512d9ad4-9a7d-4bfa-b321-c8bf368c404d |
| user list memories | PASS | matches=1 |
| chat memory_context | PASS | memories=0 |
| user submit feedback | FAIL | Could not find the table 'public.memory_feedback' in the schema cache |
| admin memory search | PASS | results=0 |
| admin get memory config | PASS | ok |
| admin test config connection | PASS | ok |
| admin metrics read | PASS | ok |
| admin logs read | PASS | ok |
| user delete memory | PASS | ok |
