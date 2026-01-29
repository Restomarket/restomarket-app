#!/bin/bash

# Ralph Loop Orchestrator for Claude Code (Refined)
# Usage: ./loop.sh <max_iterations>

MAX_ITERATIONS=${1:-10}
ITERATION=1
COMPLETION_SIGNAL="DEVOPS_COMPLETE"
BLOCKED_SIGNAL="BLOCKED"

echo "🚀 Starting Ralph Loop (Max Iterations: $MAX_ITERATIONS)..."

while [ $ITERATION -le $MAX_ITERATIONS ]; do
  echo "--- 🔄 Iteration $ITERATION/$MAX_ITERATIONS ---"
  
  # Run Claude Code with the prompt
  RESULT=$(cat RALPH_PROMPT.md | claude -p)
  
  echo "$RESULT"
  
  # Check for completion promise
  if [[ "$RESULT" == *"<promise>$COMPLETION_SIGNAL</promise>"* ]]; then
    echo "✅ All tasks complete! Exiting loop."
    exit 0
  fi
  
  # Check for blocked state
  if [[ "$RESULT" == *"<promise>$BLOCKED_SIGNAL</promise>"* ]]; then
    echo "⚠️ Ralph is blocked. Check activity.md and IMPLEMENTATION_PLAN.md"
    exit 1
  fi
  
  ITERATION=$((ITERATION + 1))
  sleep 2 # Brief pause between iterations
done

echo "⏱️ Reached maximum iterations ($MAX_ITERATIONS). Stopping."
