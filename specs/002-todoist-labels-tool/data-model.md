# Data Model: Todoist Labels Tool

**Feature**: `002-todoist-labels-tool`
**Date**: 2025-10-01

## Entity Definitions

### Personal Label
**Source**: Todoist API v1 `/labels` endpoint
**Lifecycle**: Created by user → Updated (optional) → Deleted (with cascade to tasks)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | string | Required, immutable | Unique identifier assigned by Todoist API |
| `name` | string | Required, 1-128 chars, user-defined | Human-readable label name |
| `color` | string | Optional, predefined color ID | Visual color for label organization |
| `order` | number | Optional, integer | Sort order in user's label list |
| `is_favorite` | boolean | Required, default false | Quick access flag |

**Relationships**:
- One-to-Many with Tasks: A label can be assigned to multiple tasks via task.label_names array
- Cascade Delete: When label deleted, automatically removed from all task.label_names

**Validation Rules**:
- FR-001: `name` must be unique within user's workspace (checked via pre-flight lookup)
- FR-001: If duplicate `name` exists, return existing label (idempotent)
- FR-002: `color` must match Todoist predefined color IDs (validated by API)
- FR-003: `order` used for display positioning (no uniqueness constraint)

**State Transitions**:
```
[Non-existent] --create--> [Active]
[Active] --update--> [Active] (modified)
[Active] --delete--> [Non-existent] + cascade to tasks
```

### Shared Label
**Source**: Todoist Sync API (shared label commands)
**Lifecycle**: Identified by name → Renamed (affects all tasks) → Removed (from all tasks)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `name` | string | Required, 1-128 chars | Identifier and display name (no separate ID) |

**Relationships**:
- Many-to-Many with Tasks: A shared label can be on tasks across all users/projects
- Bulk Operations: Rename/remove affects all tasks simultaneously

**Validation Rules**:
- FR-010: Rename operation requires both `name` (old) and `new_name`
- FR-011: Remove operation requires `name` to identify label
- No color, order, or favorite attributes for shared labels

**State Transitions**:
```
[In Use] --rename--> [In Use] (new name, all tasks updated)
[In Use] --remove--> [Not In Use] (removed from all tasks, label still exists in other contexts)
```

## Tool Input Schema

### LabelToolParams
**MCP Tool**: `todoist_labels`
**Validation**: Zod schema in `src/schemas/validation.ts`

| Parameter | Type | Required For Actions | Description |
|-----------|------|---------------------|-------------|
| `action` | enum | ALL | One of: `create`, `get`, `update`, `delete`, `list`, `rename_shared`, `remove_shared` |
| `label_id` | string | get, update, delete | Target label identifier |
| `name` | string | create, rename_shared | Label name (new label or old shared label name) |
| `new_name` | string | rename_shared | New name for shared label rename |
| `color` | string | create, update | Predefined color ID |
| `order` | number | create, update | Display order |
| `is_favorite` | boolean | create, update | Favorite flag |
| `cursor` | string | list | Pagination cursor from previous response |
| `limit` | number | list | Page size (1-200, default 50) |

**Conditional Validation**:
```typescript
if (action === 'create') require(name)
if (action === 'get' || action === 'update' || action === 'delete') require(label_id)
if (action === 'list' && limit) validate(limit >= 1 && limit <= 200)
if (action === 'rename_shared') require(name, new_name)
if (action === 'remove_shared') require(name)
```

## Tool Output Schema

### Success Response
```typescript
{
  success: true,
  data: TodoistLabel | TodoistLabel[] | null,
  message: string,
  metadata: {
    total_count?: number,
    next_cursor?: string | null,
    operation_time: number,
    rate_limit_remaining: number,
    rate_limit_reset: string
  }
}
```

### Error Response
```typescript
{
  success: false,
  error: {
    code: string,        // "LABEL_NOT_FOUND", "RATE_LIMIT_EXCEEDED", "VALIDATION_ERROR"
    message: string,     // User-friendly error message
    details: object,     // Additional error context
    retryable: boolean,  // Can user retry this operation?
    retry_after?: number // Seconds to wait before retry (for rate limits)
  }
}
```

## API Mapping

### REST API Endpoints (Personal Labels)
| Tool Action | API Method | Endpoint | Request Body | Response |
|-------------|------------|----------|--------------|----------|
| `list` | GET | `/api/v1/labels` | Query: `cursor`, `limit` | `{ results: TodoistLabel[], next_cursor: string \| null }` |
| `get` | GET | `/api/v1/labels/{id}` | - | `TodoistLabel` |
| `create` | POST | `/api/v1/labels` | `{ name, color?, order?, is_favorite? }` | `TodoistLabel` |
| `update` | POST | `/api/v1/labels/{id}` | `{ name?, color?, order?, is_favorite? }` | `TodoistLabel` |
| `delete` | DELETE | `/api/v1/labels/{id}` | - | `null` (204 No Content) |

### Sync API Commands (Shared Labels)
| Tool Action | Command Type | Args | Response |
|-------------|--------------|------|----------|
| `rename_shared` | `shared_label_rename` | `{ name: string, new_name: string }` | Sync response |
| `remove_shared` | `shared_label_remove` | `{ name: string }` | Sync response |

## Error Scenarios

| Scenario | HTTP Status | Error Code | Retryable | Handling |
|----------|-------------|------------|-----------|----------|
| Label ID not found | 404 | LABEL_NOT_FOUND | No | Return error per FR-016 |
| Duplicate name on create | 200 | (none) | - | Return existing label per FR-001 clarification |
| Invalid color value | 400 | VALIDATION_ERROR | No | Return validation error |
| Rate limit exceeded | 429 | RATE_LIMIT_EXCEEDED | Yes | Apply backoff per FR-017, return with retry-after |
| Network timeout | 503 | SERVICE_UNAVAILABLE | Yes | Return error with retry guidance |
| Invalid auth token | 401 | AUTHENTICATION_ERROR | No | Return error, user must fix token |

## Data Flow

### Create Personal Label (with Duplicate Check)
```
User Request
  → Validate input (Zod schema)
  → Pre-flight: List labels, check for existing name
    → If exists: Return existing label (idempotent)
    → If not exists: Continue
  → Call API: POST /labels
  → Map response to tool output format
  → Include rate limit metadata
  → Return to user
```

### List Labels with Pagination
```
User Request (cursor?, limit?)
  → Validate input (limit 1-200)
  → Set defaults (limit=50 if not provided)
  → Call API: GET /labels?limit={limit}&cursor={cursor}
  → Extract results and next_cursor
  → Map to tool output format
  → Include pagination metadata
  → Return to user
```

### Rename Shared Label
```
User Request (name, new_name)
  → Validate input (both names required)
  → Build Sync API command
  → Call API: POST /sync with command
  → Process sync response
  → Return success confirmation
  → Note: All tasks across all users/projects updated atomically by Todoist
```

## Caching Strategy

### Label Cache Integration
**Existing Infrastructure**: `src/services/cache.ts` already has label caching

**Cache Invalidation Rules**:
- `create`: Add new label to cache (or update if duplicate found)
- `update`: Update cached label with new data
- `delete`: Remove label from cache
- `list`: Update cache with fresh results
- `get`: Use cache if available, fetch if not
- `rename_shared`: Invalidate entire cache (affects multiple labels by name)
- `remove_shared`: Invalidate entire cache (affects multiple labels by name)

**Performance Impact**:
- Cache hit: Sub-100ms response (no API call)
- Cache miss: ~500ms (API roundtrip + rate limiter)
- Duplicate check: Benefits from cache (avoid extra API call)

## Testing Strategy

### Contract Tests (`tests/contract/todoist_labels.test.ts`)
- Test each action with in-memory API service
- Verify input validation (valid/invalid parameters)
- Verify output schema matches specification
- Test duplicate name handling (create returns existing)
- Test pagination (cursor handling, limit validation)

### Integration Tests (`tests/integration/label-workflows.test.ts`)
- Create → Update → Delete lifecycle
- Create label → Assign to task → Delete label → Verify task updated
- List with pagination (create 150 labels, page through results)
- Shared label rename → Verify name changed across tasks
- Rate limit behavior (mock 429 response, verify backoff)

### Unit Tests (`tests/unit/label-validation.test.ts`)
- Zod schema validation (all parameter combinations)
- Name length validation (0 chars, 128 chars, 129 chars)
- Limit validation (0, 1, 200, 201)
- Error code mapping (404 → LABEL_NOT_FOUND)
- Action routing logic (correct handler called per action)

## Constraints & Assumptions

**Assumptions**:
1. Todoist API returns consistent `TodoistLabel` schema
2. Shared labels use Sync API (documented behavior)
3. Cursor-based pagination cursors remain valid for reasonable time window
4. Rate limiter prevents hitting API limits in normal usage
5. Label colors are predefined by Todoist (not validated client-side)

**Constraints**:
1. No offline support (stateless MCP server)
2. No label-to-label relationships (flat structure)
3. No batch personal label operations (Sync API for shared only)
4. Pagination cursor invalidation on concurrent modifications (Todoist limitation)
5. 128 character name limit (Todoist API constraint)

**Scalability**:
- Pagination prevents memory exhaustion on large label lists
- Rate limiting prevents API key suspension
- Cache reduces API calls for read-heavy workloads
- No server-side state ensures horizontal scalability
