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
- `initializeTools()` registers 7 MCP tools
- `setupHandlers()` configures request handlers (list tools, call tool, health check)
- `run()` starts stdio transport for MCP communication
- Error mapping from Todoist API errors to MCP error codes

**API Service (`src/services/todoist-api.ts`)**
- `TodoistApiService` class wraps all Todoist REST API v1 endpoints
- Dual rate limiters: REST endpoints (300 req/min) and Sync API (50 req/min)
- Token bucket algorithm for rate limiting with automatic retry on 429
- Axios interceptors for request/response logging and error handling
- Methods organized by resource: tasks, projects, sections, comments, filters, reminders, labels

**Tools (`src/tools/`)**
- Each tool file implements one MCP tool (tasks, projects, sections, comments, filters, reminders, labels)
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

### Label Management (todoist_labels)
The `todoist_labels` tool provides full CRUD operations for label management with support for both personal and shared labels.

**Actions**:
- `create` - Create new personal label (idempotent - returns existing if duplicate name)
- `get` - Retrieve label by ID
- `update` - Update label properties (color, is_favorite, order)
- `delete` - Delete label (automatically removed from all tasks)
- `list` - List all labels with cursor-based pagination (limit 1-200, default 50)
- `rename_shared` - Rename shared label across all tasks (Sync API)
- `remove_shared` - Remove shared label from all tasks (Sync API)

**Parameters**:
- `action` (required) - One of the actions above
- `label_id` (required for: get, update, delete) - Target label ID
- `name` (required for: create, rename_shared) - Label name (max 128 chars)
- `new_name` (required for: rename_shared) - New label name
- `color` (optional for: create, update) - Predefined Todoist color ID
- `order` (optional for: create, update) - Display order
- `is_favorite` (optional for: create, update) - Favorite flag
- `cursor` (optional for: list) - Pagination cursor
- `limit` (optional for: list) - Page size (1-200, default 50)

**Example Usage**:
```typescript
// Create label
{ "action": "create", "name": "Work", "color": "blue", "is_favorite": true }

// Update label
{ "action": "update", "label_id": "2156154810", "color": "red" }

// List with pagination
{ "action": "list", "limit": 50 }

// Rename shared label
{ "action": "rename_shared", "name": "OldName", "new_name": "NewName" }
```

**Key Features**:
- Duplicate name handling: Creating a label with existing name returns the existing label (idempotent)
- Cache integration: Label cache automatically invalidated on create/update/delete
- Error codes: `LABEL_NOT_FOUND`, `VALIDATION_ERROR`, `RATE_LIMIT_EXCEEDED`

## Configuration

### Environment Variables
- `TODOIST_API_TOKEN` - Required. Get from Todoist Settings → Integrations → API token

### Task Management
- Features tracked in Todoist project "Todoist MCP" (ID: `6f2PCrR5xcwwRxJR`)
- **Important**: Do NOT add labels when creating tasks in this project

### Deadline Support
Tasks support optional `deadline` field (when work must be completed by), distinct from `due_date` (when work should start).

**Basic Usage**:
```typescript
// Create task with deadline
{ action: "create", content: "Submit report", deadline: "2025-12-31" }

// Update to add deadline
{ action: "update", task_id: "123", deadline: "2025-10-15" }

// Remove deadline
{ action: "update", task_id: "123", deadline: null }
```

**Format**: YYYY-MM-DD (e.g., "2025-10-15")

**Behavior**:
- **Past dates allowed**: Triggers non-blocking reminder in metadata
- **Recurring tasks**: Triggers non-blocking warning (deadline stays static, doesn't recur)
- **Independent of due_date**: Can have both, either, or neither

**Response with warnings/reminders**:
```json
{
  "success": true,
  "data": { "id": "123", "deadline": { "date": "2025-01-15" } },
  "metadata": {
    "reminders": ["Specified deadline (2025-01-15) is in the past"],
    "warnings": ["Deadline added to recurring task - deadline will not recur"]
  }
}
```

## API Endpoint
- **Current**: `/api/v1` (use this)
- **Deprecated**: `/rest/v1` and `/rest/v2` (do not use)

## More Instructions

1. Always active project in Serena before starting to work with the MCP
2. Whenever you learn important concepts, peculiarity about this project, important considerations about the Todoist API and as such, record them in Serena memories for future reference.