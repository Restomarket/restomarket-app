# Packages Directory

This directory contains all shared packages in the monorepo.

## Structure

- `ui/` - Shared UI components
- `config/` - Shared configurations (ESLint, TypeScript, etc.)
- `types/` - Shared TypeScript types and interfaces
- `utils/` - Shared utility functions
- `database/` - Database schemas and migrations

Each package should:

- Have its own `package.json`
- Export reusable code
- Be consumed by apps or other packages
- Follow semantic versioning
