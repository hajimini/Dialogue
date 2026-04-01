<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
<!-- BEGIN:user-cost-control-rules -->
# User Cost Control Rules

- The user is billed primarily by invocation count, not token volume. Optimize for fewer tool/model calls whenever possible.
- When one well-designed call can complete the work, do not split it into multiple smaller calls.
- Prefer bundled verification and batched inspection over repetitive step-by-step probing.
- Default target: keep total tool/model invocations for a task around 10 calls.
- For genuinely difficult tasks, the budget may expand up to about 20 calls, but only when continued work has clear value.
- If invocations exceed 10 and the problem is still not solved, strongly prefer stopping to summarize findings, blockers, and next steps instead of continuing blindly.
- Persist until the task is fixed or clearly blocked, but do not burn long tool loops on issues that are unlikely to be resolved quickly.
- If a problem cannot be repaired in a reasonable time, stop, summarize the blocker precisely, and report it to the user immediately.
- By default, perform the work first and give the user one consolidated summary at the end unless a blocker or material risk requires earlier notice.
<!-- END:user-cost-control-rules -->
