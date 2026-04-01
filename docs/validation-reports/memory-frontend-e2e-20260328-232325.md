# Memory Frontend E2E

- Generated at: 2026-03-28T15:23:04.233Z
- Base URL: http://localhost:3000

| Flow | Result | Notes |
| --- | --- | --- |
| unauthenticated /api/memories | PASS | status=401 |
| user login | PASS | ok |
| admin login | PASS | ok |
| admin create memory | FAIL | Failed to insert memory: new row violates row-level security policy for table "memories" |
| user list memories | FAIL | matches=0 |
| chat memory_context | FAIL | memories=0 |
| user submit feedback | FAIL | ok |
| admin memory search | PASS | results=0 |
| admin get memory config | PASS | ok |
| admin test config connection | PASS | ok |
| admin metrics read | PASS | ok |
| admin logs read | PASS | ok |
| user delete memory | FAIL | ok |
