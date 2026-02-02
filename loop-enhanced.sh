#!/bin/bash

# Ralph Loop Orchestrator for Claude Code (Enhanced)
# Usage: ./loop-enhanced.sh <max_iterations>

MAX_ITERATIONS=${1:-10}
ITERATION=1
COMPLETION_SIGNAL="DEVOPS_COMPLETE"
BLOCKED_SIGNAL="BLOCKED"

echo "🚀 Starting Ralph Loop (Max Iterations: $MAX_ITERATIONS)..."

while [ $ITERATION -le $MAX_ITERATIONS ]; do
  echo "--- 🔄 Iteration $ITERATION/$MAX_ITERATIONS ---"

  # Create a comprehensive prompt with explicit file reads
  PROMPT="# Ralph DevOps Loop - Iteration $ITERATION

You are Ralph, working on the DevOps infrastructure mission.

## Your Task This Iteration:

1. Read the following files to orient yourself:
   - IMPLEMENTATION_PLAN.md (task list and progress)
   - activity.md (recent work completed)
   - specs/devops-infrastructure.md (requirements)
   - constitution.md (standards)
   - AGENTS.md (validation commands)

2. Select the SINGLE highest-priority task with status 'not started' or 'failing'

3. Implement that ONE task completely

4. Validate using commands from AGENTS.md

5. Update IMPLEMENTATION_PLAN.md and activity.md

6. Commit the changes

## Rules:

- ONE task per iteration
- Always validate before committing
- Never commit secrets
- Output <promise>DEVOPS_COMPLETE</promise> when ALL tasks are passing
- Output <promise>BLOCKED</promise> if truly stuck

Now begin iteration $ITERATION."

  # Run Claude Code with the prompt
  echo "$PROMPT" | claude -p
  RESULT=$?

  # Check exit code
  if [ $RESULT -ne 0 ]; then
    echo "⚠️ Claude exited with error code $RESULT"
    exit 1
  fi

  # Brief check of the implementation plan for completion
  if grep -q "Status:.*passing" IMPLEMENTATION_PLAN.md && ! grep -q "Status:.*not started" IMPLEMENTATION_PLAN.md && ! grep -q "Status:.*failing" IMPLEMENTATION_PLAN.md; then
    echo "✅ All tasks appear complete! Check for completion signal."
  fi

  ITERATION=$((ITERATION + 1))
  sleep 2 # Brief pause between iterations
done

echo "⏱️ Reached maximum iterations ($MAX_ITERATIONS). Check progress in IMPLEMENTATION_PLAN.md"
