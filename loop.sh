#!/bin/bash
set -euo pipefail

# Ralph Loop Orchestrator — ERP Sync Architecture
# Usage: ./loop.sh [max_iterations] [start_iteration]
#
# Features:
#   - Accurate task counting from IMPLEMENTATION_PLAN.md markdown table
#   - Multiple completion detection methods (task status, explicit signals)
#   - No-progress detection with user prompt
#   - Adaptive rate limiting (longer pauses every 5 iterations)
#   - Detailed progress reporting after each iteration
#
# Exit Codes:
#   0 - All tasks completed successfully
#   1 - Error, blocked, or user cancelled

MAX_ITERATIONS=${1:-30}
START_ITERATION=${2:-1}
PROMPT_FILE="RALPH_PROMPT.md"
PLAN_FILE="IMPLEMENTATION_PLAN.md"
ACTIVITY_FILE="activity.md"

# ─── Safety Checks ───
if [[ ! -f "$PROMPT_FILE" ]]; then
    echo "ERROR: $PROMPT_FILE not found"
    exit 1
fi

if [[ ! -f "$PLAN_FILE" ]]; then
    echo "ERROR: $PLAN_FILE not found"
    exit 1
fi

# Check for uncommitted changes
if [[ -n $(git status --porcelain 2>/dev/null) ]]; then
    echo "WARNING: Uncommitted changes detected:"
    git status --short
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]] || exit 1
fi

echo "Ralph Loop: $START_ITERATION -> $MAX_ITERATIONS"

# ─── Progress Tracking ───
# The IMPLEMENTATION_PLAN.md Quick Status Dashboard uses this markdown table format:
#   | 1   | Dependencies + Redis + Config    | Foundation    | not started |
#   | 2   | Database Schemas (Drizzle)       | Foundation    | passing     |
# We grep for the status column value in the table rows (lines starting with |)
count_tasks() {
    local pattern="$1"
    local count
    count=$(grep -cE "^\|.*\| ${pattern} \|" "$PLAN_FILE" 2>/dev/null) || count=0
    echo "$count"
}

PREVIOUS_COMPLETED=0
NO_PROGRESS_COUNT=0

# ─── Main Loop ───
for (( ITERATION=START_ITERATION; ITERATION<=MAX_ITERATIONS; ITERATION++ )); do
    echo ""
    echo "========================================"
    echo "  Iteration $ITERATION/$MAX_ITERATIONS"
    echo "  $(date '+%H:%M:%S')"
    echo "========================================"

    # -p (--print): Exits after printing response (non-interactive). Critical for loop.
    # --dangerously-skip-permissions: Bypasses permission prompts.
    if ! claude -p --dangerously-skip-permissions < "$PROMPT_FILE"; then
        echo "ERROR: Claude exited with error"
        echo "Check $ACTIVITY_FILE for details"
        exit 1
    fi

    # ─── Completion Detection ───
    # Count tasks by status from the Quick Status Dashboard table
    REMAINING_TASKS=$(( $(count_tasks "not started") + $(count_tasks "failing") + $(count_tasks "in progress") ))
    COMPLETED_TASKS=$(count_tasks "passing")
    TOTAL_TASKS=$((REMAINING_TASKS + COMPLETED_TASKS))

    echo ""
    echo "Progress: $COMPLETED_TASKS/$TOTAL_TASKS tasks complete ($REMAINING_TASKS remaining)"

    # Method 1: No remaining work in plan
    if [[ $REMAINING_TASKS -eq 0 ]] && [[ $COMPLETED_TASKS -gt 0 ]]; then
        echo ""
        echo "All tasks complete! (All statuses passing)"
        echo "ERP Sync Architecture implementation finished!"
        exit 0
    fi

    # Safety check: If no tasks detected at all, something is wrong
    if [[ $TOTAL_TASKS -eq 0 ]]; then
        echo "WARNING: No tasks detected in $PLAN_FILE"
        echo "The grep pattern may not match the table format. Check the Quick Status Dashboard."
        exit 1
    fi

    # Method 2: Explicit BLOCKED signal in recent activity
    if [[ -f "$ACTIVITY_FILE" ]] && tail -20 "$ACTIVITY_FILE" | grep -q "<promise>BLOCKED</promise>"; then
        echo ""
        echo "BLOCKED signal detected in $ACTIVITY_FILE"
        exit 1
    fi

    # Method 3: Explicit SYNC_MIGRATION_COMPLETE signal (matches RALPH_PROMPT.md)
    if [[ -f "$ACTIVITY_FILE" ]] && tail -20 "$ACTIVITY_FILE" | grep -q "<promise>SYNC_MIGRATION_COMPLETE</promise>"; then
        echo ""
        echo "SYNC_MIGRATION_COMPLETE signal detected!"
        echo "ERP Sync Architecture implementation finished!"
        exit 0
    fi

    # Method 4: Detect no progress (stuck in loop)
    if [[ $COMPLETED_TASKS -eq $PREVIOUS_COMPLETED ]]; then
        NO_PROGRESS_COUNT=$((NO_PROGRESS_COUNT + 1))
        if [[ $NO_PROGRESS_COUNT -ge 3 ]]; then
            echo ""
            echo "WARNING: No progress detected for 3 iterations"
            echo "Still at $COMPLETED_TASKS/$TOTAL_TASKS tasks"
            echo "Claude may be stuck or having issues"
            echo ""
            read -p "Continue anyway? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "Exiting. Check $ACTIVITY_FILE for details."
                exit 1
            fi
            NO_PROGRESS_COUNT=0
        fi
    else
        NO_PROGRESS_COUNT=0
    fi
    PREVIOUS_COMPLETED=$COMPLETED_TASKS

    # Adaptive pause (longer every 5 iterations to reduce rate limits)
    if (( ITERATION % 5 == 0 )); then
        echo "Long pause (iteration $ITERATION)..."
        sleep 5
    else
        sleep 2
    fi
done

echo ""
echo "Max iterations reached ($MAX_ITERATIONS)"
echo ""
echo "Final Status Summary:"
FINAL_REMAINING=$(( $(count_tasks "not started") + $(count_tasks "failing") + $(count_tasks "in progress") ))
FINAL_COMPLETED=$(count_tasks "passing")
FINAL_TOTAL=$((FINAL_REMAINING + FINAL_COMPLETED))

echo "  Completed: $FINAL_COMPLETED tasks"
echo "  Remaining: $FINAL_REMAINING tasks"
if [[ $FINAL_TOTAL -gt 0 ]]; then
    echo "  Progress: $((FINAL_COMPLETED * 100 / FINAL_TOTAL))%"
fi
echo ""
echo "Remaining tasks:"
grep -E "^\|.*\| (not started|failing|in progress) \|" "$PLAN_FILE" | sed 's/^/  /' || echo "  (None)"
echo ""
echo "Tip: Review $ACTIVITY_FILE for last completed work"
echo "Tip: Check $PLAN_FILE for blocked tasks"
exit 0
