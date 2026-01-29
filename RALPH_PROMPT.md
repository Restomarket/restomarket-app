# Ralph Loop Instructions - DevOps Mission

@specs/devops-infrastructure.md @IMPLEMENTATION_PLAN.md @activity.md @constitution.md @AGENTS.md

## Your Mission

You are working on a Turborepo monorepo. Your job is to implement production-grade DevOps infrastructure as specified in `specs/devops-infrastructure.md` and track progress in `IMPLEMENTATION_PLAN.md`.

## Process for Each Iteration

### Phase 1: Orient

1. Read `specs/devops-infrastructure.md` to understand the goal.
2. Read `IMPLEMENTATION_PLAN.md` to see all tasks.
3. Read `activity.md` to see what was recently completed.
4. Read `constitution.md` for project standards.

### Phase 2: Select Task

Pick the SINGLE highest-priority task with Status: "not started" or "failing".
Consider:

- Priority field (high > medium > low).
- Risk level (tackle risky/architectural work first).
- Task dependencies (e.g. networking before database).

### Phase 3: Implement

1. Implement the SINGLE task you selected.
2. Follow all standards in `constitution.md`.
3. Keep changes minimal and focused.
4. For DevOps tasks, ensure all scripts and configurations are well-documented.

### Phase 4: Validate (CRITICAL)

Run validation commands from `AGENTS.md` and the task's "Validation Commands" section.

1. **Auto-fix**: `pnpm turbo lint --filter=<package> --fix`
2. **Package-specific**: `pnpm turbo test --filter=<package>` (if applicable) and `pnpm turbo build --filter=<package>`
3. **Workspace-wide**: `pnpm turbo type-check`
4. **DevOps Specific**: Run the specific validation commands listed in the task.

DO NOT proceed if ANY validation fails. Fix issues first.

### Phase 5: Record Progress

1. Update `IMPLEMENTATION_PLAN.md`: Change task Status to "passing" and add completion notes.
2. Append summary to `activity.md` with: Task completed, Files modified, Key changes, and Validation results.

### Phase 6: Commit

```bash
git add .
git commit -m "feat(devops): <brief description>

- Detail 1
- Detail 2

Closes task in IMPLEMENTATION_PLAN"
```

## Completion Signal

When ALL tasks in `IMPLEMENTATION_PLAN.md` show Status: "passing", output:
<promise>DEVOPS_COMPLETE</promise>

## If Stuck

If you cannot make progress after 30 total iterations (loop-wide):

1. Document blockers in `IMPLEMENTATION_PLAN.md` and `activity.md`.
2. Output: <promise>BLOCKED</promise>

## Iteration End Check

Before finishing, verify in IMPLEMENTATION_PLAN.md:

- If ALL tasks are Status: "passing" → output: <promise>DEVOPS_COMPLETE</promise>
- If stuck for multiple iterations → output: <promise>BLOCKED</promise>
- Otherwise → Provide a brief summary of what was completed and EXIT (the loop will automatically continue)

## Critical Rules

1. **One task at a time** - Never work on multiple tasks in one iteration.
2. **Always validate** - No commits without passing all checks.
3. **Secrets Safety** - NEVER commit actual secrets. Use dummy values in examples.
4. **Terraform Safety** - Always run `terraform validate` and `terraform fmt`.
5. **No questions at the end** - Do NOT ask "Would you like me to continue?" or "What should I do next?". Just complete the task and exit. The loop will automatically start the next iteration.
