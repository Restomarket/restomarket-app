# RestoMarket Monorepo

Modern B2B Food Supply Platform built with Turborepo, pnpm, and TypeScript.

## 🚀 Tech Stack

- **Monorepo**: [Turborepo](https://turbo.build/repo) v2.7.6
- **Package Manager**: [pnpm](https://pnpm.io/) v10.28.2
- **Language**: [TypeScript](https://www.typescriptlang.org/) v5.9.3
- **Linting**: [ESLint](https://eslint.org/) v9.39.2 (Flat Config)
- **Formatting**: [Prettier](https://prettier.io/) v3.8.1
- **Git Hooks**: [Husky](https://typicode.github.io/husky/) v9.1.7
- **Commit Linting**: [Commitlint](https://commitlint.js.org/) v19.6.2

## 📁 Project Structure

```
restomarket-app/
├── apps/                    # Application packages
│   ├── web/                # Next.js web application
│   ├── api/                # NestJS API server
│   └── mobile/             # React Native mobile app
├── packages/               # Shared packages
│   ├── ui/                 # Shared UI components
│   ├── config/             # Shared configurations
│   ├── types/              # Shared TypeScript types
│   └── utils/              # Shared utilities
├── .husky/                 # Git hooks
├── package.json            # Root package.json
├── pnpm-workspace.yaml     # pnpm workspace configuration
├── turbo.json              # Turborepo pipeline configuration
└── tsconfig.json           # Base TypeScript configuration
```

## 🛠️ Prerequisites

- **Node.js**: >= 20.18.1 (use `.nvmrc` for automatic version management)
- **pnpm**: >= 10.0.0

### Install pnpm

```bash
npm install -g pnpm@10.28.2
```

### Use Node Version Manager (Optional)

```bash
# Using nvm
nvm use

# Using volta (recommended)
volta install node@20.18.1
volta install pnpm@10.28.2
```

## 📦 Installation

```bash
# Install all dependencies
pnpm install

# Setup git hooks
pnpm prepare
```

## 🏃 Development

```bash
# Run all apps in development mode
pnpm dev

# Run specific app
pnpm --filter web dev
pnpm --filter api dev

# Build all apps
pnpm build

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:cov
```

## 🧹 Code Quality

```bash
# Lint all packages
pnpm lint

# Lint and fix
pnpm lint:fix

# Format all files
pnpm format

# Check formatting
pnpm format:check

# Type check
pnpm type-check
```

## 🧼 Cleaning

```bash
# Clean all build artifacts and node_modules
pnpm clean

# Clean Turborepo cache
pnpm clean:cache
```

## 📝 Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/).

```
feat: add new feature
fix: fix a bug
docs: update documentation
style: code style changes (formatting, etc.)
refactor: code refactoring
perf: performance improvements
test: add or update tests
build: build system changes
ci: CI/CD changes
chore: other changes
```

## 🔧 Adding New Packages

### Add a new app

```bash
# Create app directory
mkdir -p apps/my-app
cd apps/my-app

# Initialize package
pnpm init
```

### Add a new shared package

```bash
# Create package directory
mkdir -p packages/my-package
cd packages/my-package

# Initialize package
pnpm init
```

## 📚 Useful Commands

```bash
# Add dependency to specific package
pnpm --filter web add react

# Add dev dependency to root
pnpm add -D -w typescript

# Run command in specific package
pnpm --filter api build

# Run command in all packages
pnpm -r build
```

## 🔍 Turborepo Features

- **Incremental Builds**: Only rebuild what changed
- **Remote Caching**: Share build cache across team
- **Parallel Execution**: Run tasks in parallel
- **Task Pipelines**: Define task dependencies
- **Pruned Workspaces**: Deploy only what you need

## 📖 Documentation

- [Turborepo Docs](https://turbo.build/repo/docs)
- [pnpm Workspace](https://pnpm.io/workspaces)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run `pnpm lint` and `pnpm test`
4. Commit using conventional commits
5. Create a pull request

## 📄 License

ISC
