# @repo/shared

Centralized reusable code for the RestoMarket monorepo.

## Modules

- **Types**: Common interfaces and DTOs.
- **Constants**: Shared enums and constants.
- **Utils**: Framework-agnostic utility functions.

## Usage

In your application or package:

```bash
pnpm add @repo/shared --workspace
```

Then import what you need:

```typescript
import { UserRole, type UserDto, dateFormat } from '@repo/shared';
```

## Structure

```text
src/
├── constants/ # Enums and shared constants
├── types/     # Interfaces and DTOs
├── utils/     # Helper functions
└── index.ts   # Main entry point
```
