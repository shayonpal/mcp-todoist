# Changelog

## [Unreleased]

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

[Unreleased]: https://github.com/shayonpal/mcp-todoist/compare/v1.2.1...HEAD
[1.2.1]: https://github.com/shayonpal/mcp-todoist/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/shayonpal/mcp-todoist/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/shayonpal/mcp-todoist/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/shayonpal/mcp-todoist/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/shayonpal/mcp-todoist/releases/tag/v0.1.0
