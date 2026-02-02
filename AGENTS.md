# Validation Commands for Turborepo Monorepo

## Incremental Validation Strategy

Ralph MUST run these commands in order after making changes:

### 1. Automatic Fixes

```bash
# Fix linting and formatting issues automatically
pnpm turbo lint --fix
# Note: if there is a separate format command, add it here
```

### 2. Package-Specific Validation

When modifying a specific package, run:

```bash
# Replace <package> with the actual package name
pnpm turbo test --filter=<package>
pnpm turbo build --filter=<package>
```

### 3. Workspace-Wide Type Check

```bash
# CRITICAL: Always run after any changes
# Ensures no cross-package TypeScript regressions
pnpm turbo type-check
```

### 4. Dependent Package Validation

When changes might affect other packages:

```bash
# Test and build the modified package AND its dependents
pnpm turbo test --filter=<package>...
pnpm turbo build --filter=<package>...
```

### 5. Final Production Build Check

```bash
# Before completing a task, verify production bundle
pnpm turbo build --filter=<package>
```

## Exit Codes

- **0** = All checks passing, proceed with commit
- **Non-zero** = Failures detected, must fix before committing

## Common Validation Patterns

### For Single Package Changes:

```bash
pnpm turbo lint --filter=<package> --fix
pnpm turbo test --filter=<package>
pnpm turbo type-check
pnpm turbo build --filter=<package>
```

### For Changes Affecting Multiple Packages:

```bash
pnpm turbo lint --fix
pnpm turbo test --filter=...[origin/main]
pnpm turbo type-check
pnpm turbo build
```
