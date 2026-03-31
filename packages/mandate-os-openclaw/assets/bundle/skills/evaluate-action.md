# MandateOS: Evaluate Risky Actions

Before side effects, use:

- `mandateos_openclaw_exec` for shell commands
- `mandateos_openclaw_browser_mutate` for browser actions that change state
- `mandateos_openclaw_spawn_agent` for sub-agent creation
- `mandateos_openclaw_evaluate_action` for explicit policy checks

If MandateOS approves a wrapper call, immediately follow it with the exact native OpenClaw tool call it approved.
