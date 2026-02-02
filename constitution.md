# Project Constitution

## Code Quality Standards

### TypeScript

- Use TypeScript strict mode in all packages.
- No `any` types without explicit justification.
- All public APIs must have complete type definitions.
- Prefer type inference over explicit types where clear.

### Testing

- Minimum 80% test coverage for all packages.
- Test files co-located with source: `*.test.ts` or `*.spec.ts`.
- Use the testing framework configured in each package (Vitest/Jest).
- Write integration tests for cross-package interactions.

### Code Style

- Follow existing patterns in each package.
- Use async/await over raw promises.
- Prefer named exports over default exports.
- Add JSDoc comments for public APIs.

### Monorepo Standards

- Never modify package.json dependencies without running `pnpm install` or equivalent via Turbo.
- Changes affecting multiple packages require workspace-wide type check (`pnpm turbo check-types`).
- Always use turbo filters (`--filter`) when running commands on specific packages.
- Respect package boundaries - no direct imports outside workspace protocol.

### Git Workflow

- Commit after each completed task from `IMPLEMENTATION_PLAN.md`.
- Use conventional commits: `feat:`, `fix:`, `refactor:`, `test:`.
- Each commit should pass all validation checks in `AGENTS.md`.

## When Stuck

If you're blocked after 10 iterations:

1. Document what's blocking progress in `IMPLEMENTATION_PLAN.md`.
2. List what was attempted.
3. Suggest alternative approaches.
4. Update task status to "blocked".
5. Output `<promise>BLOCKED</promise>`.
