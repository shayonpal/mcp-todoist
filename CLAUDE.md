# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

MCP server for Todoist task and project management. Uses **Todoist REST API v1** (endpoint: `/api/v1`). Built with TypeScript/Node.js 18+, implements Model Context Protocol (MCP) for AI assistant integration.

## Commands

### Development
- `npm run dev` - Run server in development mode with tsx
- `npm run build` - Compile TypeScript and set executable permissions
- `npm start` - Run compiled server

### Testing
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report

### Code Quality
- `npm run lint` - Lint source and tests
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format code with Prettier
- `npm run typecheck` - Type-check without emitting files

## Architecture

### Core Components

**Server (`src/server.ts`)**
- `TodoistMCPServer` class implements MCP protocol
- `initializeTools()` registers 6 MCP tools
- `setupHandlers()` configures request handlers (list tools, call tool, health check)
- `run()` starts stdio transport for MCP communication
- Error mapping from Todoist API errors to MCP error codes

**API Service (`src/services/todoist-api.ts`)**
- `TodoistApiService` class wraps all Todoist REST API v1 endpoints
- Dual rate limiters: REST endpoints (300 req/min) and Sync API (50 req/min)
- Token bucket algorithm for rate limiting with automatic retry on 429
- Axios interceptors for request/response logging and error handling
- Methods organized by resource: tasks, projects, sections, comments, filters, reminders

**Tools (`src/tools/`)**
- Each tool file implements one MCP tool (tasks, projects, sections, comments, filters, reminders)
- Input validation with Zod schemas
- Action-based dispatching (create, get, update, delete, list, etc.)
- Uses `handleToolError` wrapper for consistent error responses

**Services (`src/services/`)**
- `batch.ts` - Batch operations via Sync API (up to 100 commands)
- `cache.ts` - In-memory caching for labels (reduces API calls)

**Validation (`src/schemas/validation.ts`)**
- Zod schemas for all input/output types
- Natural language date parsing support ("tomorrow", "every day", "every 4th")

### Testing Strategy

**Contract Tests (`tests/contract/`)**
- Verify tool schemas and business logic
- Use in-memory API service mock (no network calls)
- Test all CRUD operations for each tool

**Integration Tests (`tests/integration/`)**
- Test cross-feature workflows (project→section→task)
- Rate limiting behavior
- Batch operations

**Unit Tests (`tests/unit/`)**
- Validation schema tests
- Natural language date parsing
- Mock helper utilities

**Helpers (`tests/helpers/`)**
- `inMemoryTodoistApiService.ts` - In-memory API mock for contract tests
- `mockTodoistApiService.ts` - Jest-based mock factory

## Key Patterns

### Tool Implementation Pattern
1. Define Zod schema for inputs (flattened for MCP compatibility)
2. Validate inputs in tool handler
3. Dispatch to appropriate action handler based on `action` field
4. Call `TodoistApiService` method
5. Return formatted response or use `handleToolError` for errors

### Rate Limiting
- REST API: 300 requests/minute (token bucket with 300 capacity, 5 tokens/sec refill)
- Sync API: 50 requests/minute (token bucket with 50 capacity, ~0.83 tokens/sec refill)
- Automatic retry with exponential backoff on 429 responses
- Use `getRateLimitStatus()` to check current limits

### Error Handling
- Tool errors wrapped with `handleToolError(error, context)`
- API errors mapped to MCP error codes in `mapTodoistErrorToMCP()`
- Network errors, auth errors, validation errors all handled distinctly

### Natural Language Dates
- Supports Todoist's natural language: "tomorrow at 10:00", "every day", "every 4th"
- Handled via `due_string` field in task creation/update
- Can also use `due_date` (YYYY-MM-DD) or `due_datetime` (ISO 8601)

## Configuration

### Environment Variables
- `TODOIST_API_TOKEN` - Required. Get from Todoist Settings → Integrations → API token

### Task Management
- Features tracked in Todoist project "Todoist MCP" (ID: `6f2PCrR5xcwwRxJR`)
- **Important**: Do NOT add labels when creating tasks in this project

## API Endpoint
- **Current**: `/api/v1` (use this)
- **Deprecated**: `/rest/v1` and `/rest/v2` (do not use)
