# Memory Frontend E2E

- Generated at: 2026-03-28T15:24:38.989Z
- Base URL: http://localhost:3000

| Flow | Result | Notes |
| --- | --- | --- |
| unauthenticated /api/memories | PASS | status=401 |
| user login | PASS | ok |
| admin login | PASS | ok |
| admin create memory | PASS | fb538df0-a8cd-4ba5-9003-920a691696a1 |
| user list memories | PASS | matches=1 |
| chat memory_context | PASS | memories=0 |
| user submit feedback | PASS | ok |
| admin memory search | PASS | results=0 |
| admin get memory config | PASS | ok |
| admin test config connection | PASS | ok |
| admin metrics read | PASS | ok |
| admin logs read | PASS | ok |
| user delete memory | PASS | ok |
