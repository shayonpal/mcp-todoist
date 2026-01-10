# Contributing to Todoist MCP Server

Thank you for your interest in contributing to the Todoist MCP Server! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

This project follows a simple code of conduct: be respectful, constructive, and professional in all interactions. We welcome contributions from everyone and are committed to providing a welcoming and inclusive environment.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/mcp-todoist.git
   cd mcp-todoist
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Set up your environment**:
   ```bash
   cp .env.example .env
   # Add your TODOIST_API_TOKEN to .env
   ```
5. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Building

```bash
npm run build
```

### Running in Development Mode

```bash
vercel dev
```

This starts the Vercel development server with HTTP transport at `http://localhost:3000/mcp`.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Code Quality

```bash
# Lint code
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Type-check
npm run typecheck
```

## Coding Standards

### TypeScript

- Use TypeScript for all code
- Enable strict mode in `tsconfig.json`
- Provide explicit return types for functions
- Use type inference where appropriate

### Code Style

- Follow existing code style (enforced by ESLint and Prettier)
- Use descriptive variable and function names
- Add JSDoc comments for public APIs
- Keep functions focused and concise

### Project Structure

```
src/
├── server.ts              # MCP server implementation
├── services/              # Service layer (API, batch, cache)
│   ├── todoist-api.ts    # Todoist API client
│   ├── batch.ts          # Batch operations
│   └── cache.ts          # Caching layer
├── tools/                 # MCP tool implementations
│   ├── tasks.ts
│   ├── projects.ts
│   └── ...
└── schemas/               # Zod validation schemas
    └── validation.ts

tests/
├── contract/              # Tool contract tests
├── integration/           # Integration tests
└── unit/                  # Unit tests
```

## Testing

All contributions should include appropriate tests:

### Contract Tests

Test tool schemas and business logic without network calls:

```typescript
// tests/contract/tool-name.test.ts
describe('tool_name contract', () => {
  it('should validate input parameters', async () => {
    // Test input validation
  });

  it('should handle create action', async () => {
    // Test business logic
  });
});
```

### Integration Tests

Test cross-feature workflows and external interactions:

```typescript
// tests/integration/feature.test.ts
describe('feature integration', () => {
  it('should handle end-to-end workflow', async () => {
    // Test complete workflows
  });
});
```

### Test Coverage

- Aim for 80%+ code coverage
- Test both success and error cases
- Test edge cases and boundary conditions

## Submitting Changes

### Commit Messages

Follow the [Common Changelog](https://github.com/vweevers/common-changelog) format:

```
type: brief description

Longer description if needed, explaining what and why.

Examples of types:
- feat: New feature
- fix: Bug fix
- docs: Documentation changes
- test: Test additions or modifications
- refactor: Code refactoring
- chore: Build, dependencies, or tooling changes
```

### Pull Request Process

1. **Update your branch** with the latest main:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Run all checks**:
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```

3. **Push your changes**:
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Create a Pull Request** on GitHub:
   - Provide a clear title and description
   - Reference any related issues
   - Describe what was changed and why
   - Include screenshots/examples if applicable

5. **Address review feedback** if requested

### Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Update documentation as needed
- Add or update tests for your changes
- Ensure all tests pass
- Follow the existing code style
- Update CHANGELOG.md with your changes

## Reporting Issues

### Bug Reports

When reporting bugs, include:

1. **Description**: Clear description of the issue
2. **Steps to Reproduce**: Step-by-step instructions
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Environment**:
   - Node.js version
   - Operating system
   - MCP client being used
6. **Logs**: Relevant error messages or logs

### Feature Requests

When requesting features, include:

1. **Description**: Clear description of the feature
2. **Use Case**: Why this feature would be useful
3. **Proposed Solution**: How you envision it working
4. **Alternatives**: Other approaches you've considered

## Questions?

If you have questions about contributing, feel free to:

- Open an issue for discussion
- Check existing issues and pull requests
- Review the project documentation

Thank you for contributing to Todoist MCP Server!
