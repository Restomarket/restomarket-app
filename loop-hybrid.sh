#!/bin/bash

# Ralph Loop Orchestrator - Hybrid Approach
# Uses RALPH_PROMPT.md but explicitly tells Claude to read context files

MAX_ITERATIONS=${1:-10}
ITERATION=1
COMPLETION_SIGNAL="DEVOPS_COMPLETE"
BLOCKED_SIGNAL="BLOCKED"

echo "🚀 Starting Ralph Loop (Max Iterations: $MAX_ITERATIONS)..."

while [ $ITERATION -le $MAX_ITERATIONS ]; do
  echo "--- 🔄 Iteration $ITERATION/$MAX_ITERATIONS ---"

  # Build a prompt that includes the RALPH_PROMPT.md content
  # AND explicitly tells Claude to read the context files
  PROMPT="Iteration $ITERATION of $MAX_ITERATIONS

First, read these context files:
- specs/devops-infrastructure.md
- IMPLEMENTATION_PLAN.md
- activity.md
- constitution.md
- AGENTS.md

Now follow the instructions in RALPH_PROMPT.md below:

---

$(cat RALPH_PROMPT.md | tail -n +4)
"

  # Run Claude Code with the combined prompt
  echo "$PROMPT" | claude -p
  RESULT=$?

  # Check exit code
  if [ $RESULT -ne 0 ]; then
    echo "⚠️ Claude exited with error code $RESULT"
    exit 1
  fi

  # Check for completion (all tasks passing)
  if ! grep -q "Status:.*not started" IMPLEMENTATION_PLAN.md && ! grep -q "Status:.*failing" IMPLEMENTATION_PLAN.md; then
    echo "✅ All tasks appear complete!"
  fi

  ITERATION=$((ITERATION + 1))
  sleep 2
done

echo "⏱️ Reached maximum iterations ($MAX_ITERATIONS). Check IMPLEMENTATION_PLAN.md for progress."
