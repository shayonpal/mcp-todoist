# Changelog

## [Unreleased]

## [1.5.0] - 2025-10-03

### Added

- Deferred token validation for MCP platform compatibility
  - Token now optional at startup (validated on first tool invocation)
  - Enables MCP platform inspection (e.g., Smithery) without requiring valid token
  - Token normalization with automatic trimming and empty-string handling
  - Dynamic token reflection from environment variables
  - Improved error messages for token validation failures

### Changed

- Server architecture refactored for lazy initialization
  - Server implementation split into modular `src/server/impl.ts`
  - Lazy loading pattern for improved startup performance
  - Exports both `server` instance and `getServer()` factory for flexibility
- Enhanced test infrastructure
  - Token validation singleton integration across all test suites
  - Improved test isolation with proper singleton reset mechanisms
  - Standardized mock token format (minimum length validation)

### Breaking Changes

- **Low Impact**: `APIConfiguration.token` type changed from `string` to `string | null`
  - Impact: Only affects code directly importing and using this internal type interface
  - Migration: Update type annotations to handle nullable tokens or check token presence before use
  - Rationale: Enables deferred token validation for MCP platform compliance

## [1.4.1] - 2025-10-02

### Added

- Smithery deployment configuration
  - Dockerfile for container-based deployment
  - smithery.yaml configuration for Smithery platform
  - Optimized Docker build with production dependencies

## [1.4.0] - 2025-10-02

### Added

- Bulk task operations (`todoist_bulk_tasks` tool)
  - Batch update, complete, uncomplete, move, and delete operations on up to 50 tasks
  - Sync API integration for efficient batch processing
  - Automatic task ID deduplication
  - Hybrid API approach: REST API for deadline updates, Sync API for other operations
  - Per-task result tracking with success/failure status
  - Comprehensive error mapping from Sync API responses
  - Reduces API calls by up to 50x for bulk operations
  - Dual rate limiters: REST API (300 req/min), Sync API (50 req/min)
  - Partial failure support with detailed error messages

## [1.3.0] - 2025-10-02

### Added

- Completed tasks querying (`todoist_tasks` tool)
  - New `list_completed` action for retrieving completed tasks
  - Query by completion date (3-month time window)
  - Query by due date (6-week time window)
  - Comprehensive filtering: project, section, workspace, parent task, filter queries
  - Cursor-based pagination with configurable limit (1-200 items per page)
  - Time window validation with clear error messages
  - Full integration with existing task workflows (reopen, edit, recomplete)

## [1.2.1] - 2025-10-02

### Added

- GitHub Actions trusted publishing workflow that pushes npm releases via OpenID Connect and emits signed provenance metadata.

### Fixed

- Automated release pipeline now upgrades npm and injects the Todoist secret so CI tests pass during publish.

## [1.2.0] - 2025-10-01

### Added

- Deadline support for tasks (`todoist_tasks` tool)
  - Optional `deadline` parameter in YYYY-MM-DD format
  - Distinct from `due_date` (deadline = when work must be done by, due_date = when work should start)
  - Create tasks with deadlines, update to add/modify/remove deadlines
  - Non-blocking warnings for recurring tasks (deadline stays static)
  - Non-blocking reminders for past deadlines
  - Full validation with helpful error messages
  - Response metadata includes `warnings` and `reminders` arrays

### Fixed

- Deadline API field name mismatch (API expects `deadline_date` for input, returns `deadline` as output)
- Test assertions updated to reflect API behavior (removed deadline returns `undefined`, not `null`)

## [1.1.0] - 2025-10-01

### Added

- Complete labels management tool (`todoist_labels`) with CRUD operations
  - Create, get, update, delete, and list personal labels
  - Rename and remove shared labels across all tasks
  - Cache integration for optimized performance
  - Cursor-based pagination support (1-200 items per page)
  - Idempotent label creation (returns existing label on duplicate name)
- Integration tests for labels tool with cross-feature workflows
- Contract tests for all label operations

### Fixed

- Test failures and improved error messages across all tools

## [1.0.0] - 2025-09-30

### Added

- Comprehensive MCP server implementation with 6 core tools:
  - `todoist_tasks` - Task management (create, get, update, delete, list, close, reopen)
  - `todoist_projects` - Project management (create, get, update, delete, list)
  - `todoist_sections` - Section management (create, get, update, delete, list)
  - `todoist_comments` - Comment management (create, get, update, delete, list)
  - `todoist_filters` - Filter management (create, get, update, delete, list)
  - `todoist_reminders` - Reminder management (create, get, update, delete, list)
- Rate limiting with token bucket algorithm
  - REST API: 300 requests/minute
  - Sync API: 50 requests/minute
  - Automatic retry with exponential backoff on 429 responses
- Natural language date parsing support ("tomorrow", "every day", "every 4th")
- Batch operations support via Todoist Sync API (up to 100 commands)
- Comprehensive validation with Zod schemas
- Complete test suite (contract, integration, unit tests)
- Development tooling: TypeScript, ESLint, Prettier, Jest

### Fixed

- Migrated from deprecated REST API v2 to unified API v1 (`/api/v1` endpoint)
- Task filtering and update parameter handling
- Paginated response handling for all list endpoints (projects, tasks, sections, etc.)
- TypeScript compilation errors with proper null handling

### Changed

- Replaced Zod schemas with plain JSON Schema in tool definitions for MCP compatibility
- Removed discriminated unions to ensure MCP client compatibility
- Standardized tool interfaces across all tools
- Extracted common utilities to reduce code duplication
- Made `project_id` optional for task creation (defaults to Inbox)
- Consolidated test infrastructure with in-memory API service mocks
- Updated license to GPL-3.0

### Removed

- Deprecated REST API v2 endpoints (`/rest/v2`)
- Incorrect pagination wrapper extraction logic
- Defensive array checks in projects tool
- Internal documentation files (VERIFICATION_GUIDE.md, fix-reminders-typescript-errors.md)

## [0.1.0] - 2025-09-28

### Added

- Initial project setup for Todoist MCP Server
- Core service layer implementation with TodoistApiService
- Basic MCP server structure with tool registration
- Initial test suite with TDD approach
- Project configuration (TypeScript, Jest, ESLint, Prettier)
- README and project documentation

[Unreleased]: https://github.com/shayonpal/mcp-todoist/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/shayonpal/mcp-todoist/compare/v1.4.1...v1.5.0
[1.4.1]: https://github.com/shayonpal/mcp-todoist/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/shayonpal/mcp-todoist/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/shayonpal/mcp-todoist/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/shayonpal/mcp-todoist/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/shayonpal/mcp-todoist/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/shayonpal/mcp-todoist/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/shayonpal/mcp-todoist/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/shayonpal/mcp-todoist/releases/tag/v0.1.0
