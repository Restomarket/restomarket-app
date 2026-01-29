#!/bin/bash
set -euo pipefail

# Ralph Loop Orchestrator - Enhanced
# Usage: ./loop.sh [max_iterations] [start_iteration]
#
# Features:
#   - Accurate task counting and progress tracking
#   - Multiple completion detection methods (task status, explicit signals)
#   - No-progress detection with user prompt
#   - Adaptive rate limiting (longer pauses every 5 iterations)
#   - Detailed progress reporting after each iteration
#
# Exit Codes:
#   0 - All tasks completed successfully
#   1 - Error, blocked, or user cancelled

MAX_ITERATIONS=${1:-10}
START_ITERATION=${2:-1}
PROMPT_FILE="RALPH_PROMPT.md"
PLAN_FILE="IMPLEMENTATION_PLAN.md"
ACTIVITY_FILE="activity.md"

# ─── Safety Checks ───
if [[ ! -f "$PROMPT_FILE" ]]; then
    echo "❌ $PROMPT_FILE not found"
    exit 1
fi

if [[ ! -f "$PLAN_FILE" ]]; then
    echo "❌ $PLAN_FILE not found"
    exit 1
fi

# Check for uncommitted changes
if [[ -n $(git status --porcelain 2>/dev/null) ]]; then
    echo "⚠️  Uncommitted changes detected:"
    git status --short
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]] || exit 1
fi

echo "🚀 Ralph Loop: $START_ITERATION → $MAX_ITERATIONS"

# ─── Progress Tracking ───
PREVIOUS_COMPLETED=0
NO_PROGRESS_COUNT=0

# ─── Main Loop ───
for (( ITERATION=START_ITERATION; ITERATION<=MAX_ITERATIONS; ITERATION++ )); do
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  🔄 Iteration $ITERATION/$MAX_ITERATIONS"
    echo "  $(date '+%H:%M:%S')"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Stream output live (no capture) so you can monitor progress. --permission-mode
    # bypassPermissions avoids prompts for edits, file access, and commands.
    # Using cat to pipe the prompt file allows for better output visibility
    if ! cat "$PROMPT_FILE" | claude --permission-mode bypassPermissions; then
        echo "❌ Claude exited with error"
        echo "Check $ACTIVITY_FILE for details"
        exit 1
    fi

    # ─── Completion Detection ───
    # Count remaining tasks (more reliable)
    REMAINING_TASKS=$(grep -cE "Status:.*(not started|failing|in progress)" "$PLAN_FILE" 2>/dev/null || echo "0")
    COMPLETED_TASKS=$(grep -cE "Status:.*passing" "$PLAN_FILE" 2>/dev/null || echo "0")
    TOTAL_TASKS=$((REMAINING_TASKS + COMPLETED_TASKS))

    echo ""
    echo "📊 Progress: $COMPLETED_TASKS/$TOTAL_TASKS tasks complete ($REMAINING_TASKS remaining)"

    # Method 1: No remaining work in plan
    if [[ $REMAINING_TASKS -eq 0 ]] && [[ $COMPLETED_TASKS -gt 0 ]]; then
        echo ""
        echo "✅ All tasks complete! (All statuses passing)"
        echo "🎉 DevOps infrastructure implementation finished!"
        exit 0
    fi

    # Safety check: If no tasks detected at all, something is wrong
    if [[ $TOTAL_TASKS -eq 0 ]]; then
        echo "⚠️  Warning: No tasks detected in $PLAN_FILE"
        echo "Please check the file format."
        exit 1
    fi

    # Method 2: Explicit BLOCKED signal in recent activity
    if [[ -f "$ACTIVITY_FILE" ]] && tail -10 "$ACTIVITY_FILE" | grep -q "<promise>BLOCKED</promise>"; then
        echo ""
        echo "🚫 Blocked signal detected in $ACTIVITY_FILE"
        exit 1
    fi

    # Method 3: Explicit DEVOPS_COMPLETE signal
    if [[ -f "$ACTIVITY_FILE" ]] && tail -10 "$ACTIVITY_FILE" | grep -q "<promise>DEVOPS_COMPLETE</promise>"; then
        echo ""
        echo "✅ DEVOPS_COMPLETE signal detected!"
        echo "🎉 DevOps infrastructure implementation finished!"
        exit 0
    fi

    # Method 4: Detect no progress (stuck in loop)
    if [[ $COMPLETED_TASKS -eq $PREVIOUS_COMPLETED ]]; then
        NO_PROGRESS_COUNT=$((NO_PROGRESS_COUNT + 1))
        if [[ $NO_PROGRESS_COUNT -ge 3 ]]; then
            echo ""
            echo "⚠️  Warning: No progress detected for 3 iterations"
            echo "📊 Still at $COMPLETED_TASKS/$TOTAL_TASKS tasks"
            echo "💡 Claude may be stuck or having issues"
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
        echo "⏱️  Long pause (iteration $ITERATION)..."
        sleep 5
    else
        sleep 2
    fi
done

echo ""
echo "⏱️  Max iterations reached ($MAX_ITERATIONS)"
echo ""
echo "📊 Final Status Summary:"
FINAL_REMAINING=$(grep -cE "Status:.*(not started|failing|in progress)" "$PLAN_FILE" 2>/dev/null || echo "0")
FINAL_COMPLETED=$(grep -cE "Status:.*passing" "$PLAN_FILE" 2>/dev/null || echo "0")
FINAL_TOTAL=$((FINAL_REMAINING + FINAL_COMPLETED))

echo "  ✅ Completed: $FINAL_COMPLETED tasks"
echo "  ⏳ Remaining: $FINAL_REMAINING tasks"
echo "  📈 Progress: $((FINAL_COMPLETED * 100 / FINAL_TOTAL))%"
echo ""
echo "🔍 Remaining tasks by status:"
grep -E "Status:.*(not started|failing|in progress)" "$PLAN_FILE" | sed 's/^/  /' || echo "  (None)"
echo ""
echo "💡 Tip: Review $ACTIVITY_FILE for last completed work"
echo "💡 Tip: Check $PLAN_FILE for blocked tasks"
exit 0
