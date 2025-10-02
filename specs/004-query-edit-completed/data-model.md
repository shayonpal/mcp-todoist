# Data Model: Completed Tasks Query Feature

## Entity: CompletedTaskQuery

Represents a user's request to retrieve completed tasks within a specified time window.

### Attributes

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `completed_query_type` | enum | Yes | 'by_completion_date' \| 'by_due_date' | Determines which endpoint to use and which timestamp field to filter on |
| `since` | string | Yes | ISO 8601 datetime | Start of time window (inclusive) |
| `until` | string | Yes | ISO 8601 datetime | End of time window (inclusive) |
| `project_id` | string | No | Valid Todoist project ID | Filter to specific project |
| `section_id` | string | No | Valid Todoist section ID | Filter to specific section |
| `workspace_id` | number | No | Valid workspace ID | Filter to specific workspace |
| `parent_id` | string | No | Valid task ID | Filter to subtasks of specific parent |
| `filter_query` | string | No | Todoist filter syntax | Advanced filter (labels, priorities, search) |
| `filter_lang` | string | No | Language code | Language for parsing filter_query (default: 'en') |
| `cursor` | string | No | Opaque pagination token | Cursor from previous response for next page |
| `limit` | number | No | 1-200 | Number of results per page (default: 50) |

### Validation Rules

1. **Time Window Constraints**:
   - When `completed_query_type === 'by_completion_date'`: `(until - since) <= 92 days`
   - When `completed_query_type === 'by_due_date'`: `(until - since) <= 42 days`
   - `until` must be greater than `since`

2. **Datetime Format**:
   - Both `since` and `until` must be valid ISO 8601 datetime strings
   - Example: `"2025-10-01T00:00:00Z"`, `"2025-10-02T23:59:59.999Z"`

3. **Query Type Exclusivity**:
   - Only one `completed_query_type` value allowed per query
   - Cannot query by both completion date and due date simultaneously

4. **Filter Combinations**:
   - Multiple filter parameters can be combined
   - Example: `project_id` + `filter_query: "@Work & p1"` is valid

### State Transitions

CompletedTaskQuery is stateless - each query is independent. No state transitions.

### Relationships

- **CompletedTaskQuery** → **CompletedTask** (one-to-many)
  - A single query returns zero or more completed tasks

- **CompletedTaskQuery** → **PaginationCursor** (one-to-one optional)
  - Query may produce a cursor for fetching next page

## Entity: CompletedTask

Represents a Todoist task that has been marked as complete. Extends the base Task entity.

### Attributes

All attributes from base `Task` entity, plus:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `completed_at` | string | Yes | ISO 8601 datetime when task was completed |

### Inherited from Task

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique task identifier |
| `content` | string | Task title/description |
| `description` | string | Additional task details |
| `project_id` | string | Parent project ID |
| `section_id` | string \| null | Parent section ID |
| `parent_id` | string \| null | Parent task ID (if subtask) |
| `labels` | string[] | Array of label names |
| `priority` | number | 1 (lowest) to 4 (highest) |
| `due` | object \| null | Due date information |
| `user_id` | string | Owner user ID |
| `added_at` | string | ISO 8601 creation timestamp |
| `updated_at` | string | ISO 8601 last update timestamp |

### Invariants

1. **Completion State**:
   - `checked === true` (task is completed)
   - `completed_at` is always present and in the past
   - Cannot be edited while in completed state

2. **Immutability**:
   - Completed tasks are read-only via query endpoints
   - To modify, must first reopen (uncomplete) the task

### State Transitions

```
Active Task --[complete]--> Completed Task
Completed Task --[reopen]--> Active Task
```

## Entity: CompletedTaskResponse

Represents the paginated response from a completed task query.

### Attributes

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `items` | CompletedTask[] | Yes | Array of completed tasks matching query |
| `next_cursor` | string \| null | No | Pagination cursor for next page, null if no more results |

### Validation Rules

1. **Result Set Size**:
   - `items.length` <= `limit` from query (default 50, max 200)
   - Empty array is valid (no tasks match criteria)

2. **Cursor Validity**:
   - `next_cursor` present only when more results available
   - Cursor is opaque token - no client-side validation
   - Expired cursors return error from API

## Supporting Types

### TimeWindow

Represents the temporal bounds for a query.

```typescript
interface TimeWindow {
  since: Date;      // Start of window (inclusive)
  until: Date;      // End of window (inclusive)
  maxDays: number;  // Maximum allowed duration (92 or 42)
}
```

### CompletedQueryType

```typescript
type CompletedQueryType = 'by_completion_date' | 'by_due_date';
```

### ValidationError Codes

| Code | Trigger | User Message |
|------|---------|--------------|
| `TIME_WINDOW_TOO_LARGE` | Duration exceeds limit | "Time window exceeds X days maximum for Y queries" |
| `INVALID_DATETIME_FORMAT` | Malformed ISO 8601 | "Datetime must be in ISO 8601 format (e.g., 2025-10-01T00:00:00Z)" |
| `MISSING_REQUIRED_PARAM` | since/until/type missing | "Missing required parameter: {param}" |
| `BOTH_QUERY_TYPES` | Mutually exclusive violation | "Cannot specify both completion date and due date queries" |
| `INVALID_TIME_RANGE` | until <= since | "Until date must be after since date" |

## Data Flow

```
User Input (MCP Tool Call)
  ↓
TodoistTasksInputSchema (Zod validation)
  ↓
CompletedTaskQuery (validated entity)
  ↓
TodoistApiService.getCompletedTasks{ByCompletionDate|ByDueDate}
  ↓
HTTP GET /api/v1/tasks/completed/by_{query_type}
  ↓
CompletedTaskResponse (raw API response)
  ↓
enrichTaskWithMetadata (add priority names, etc.)
  ↓
MCP Tool Response with enriched CompletedTask[]
```

## Example Data

### Valid CompletedTaskQuery

```json
{
  "completed_query_type": "by_completion_date",
  "since": "2025-09-01T00:00:00Z",
  "until": "2025-10-01T23:59:59Z",
  "project_id": "2345678901",
  "filter_query": "@Work & p1",
  "limit": 50
}
```

### CompletedTaskResponse

```json
{
  "items": [
    {
      "id": "8765432109",
      "content": "Complete project proposal",
      "description": "Draft and submit Q4 proposal",
      "project_id": "2345678901",
      "section_id": null,
      "labels": ["Work", "Urgent"],
      "priority": 4,
      "completed_at": "2025-09-15T14:30:00Z",
      "due": {
        "date": "2025-09-15",
        "is_recurring": false
      },
      "checked": true,
      "user_id": "123456",
      "added_at": "2025-09-01T09:00:00Z",
      "updated_at": "2025-09-15T14:30:00Z"
    }
  ],
  "next_cursor": "eyJwYWdlIjoyLCJsYXN0X2lkIjoiODc2NTQzMjEwOSJ9"
}
```

## Schema Definitions (TypeScript/Zod)

### Input Schema

```typescript
const CompletedTasksInputSchema = z.object({
  action: z.literal('list_completed'),
  completed_query_type: z.enum(['by_completion_date', 'by_due_date']),
  since: z.string().datetime(),
  until: z.string().datetime(),
  project_id: z.string().optional(),
  section_id: z.string().optional(),
  workspace_id: z.number().optional(),
  parent_id: z.string().optional(),
  filter_query: z.string().optional(),
  filter_lang: z.string().default('en'),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(200).default(50)
}).refine(
  (data) => {
    const since = new Date(data.since);
    const until = new Date(data.until);
    const daysDiff = Math.ceil((until.getTime() - since.getTime()) / (1000 * 60 * 60 * 24));

    if (data.completed_query_type === 'by_completion_date') {
      return daysDiff <= 92;
    } else {
      return daysDiff <= 42;
    }
  },
  {
    message: (data) => {
      const maxDays = data.completed_query_type === 'by_completion_date' ? 92 : 42;
      const queryType = data.completed_query_type === 'by_completion_date'
        ? 'completion date'
        : 'due date';
      return `Time window exceeds ${maxDays} days maximum for ${queryType} queries`;
    }
  }
).refine(
  (data) => new Date(data.until) > new Date(data.since),
  { message: 'Until date must be after since date' }
);
```

## Integration Points

### Existing Services

- **TodoistApiService**: Add two new methods:
  - `getCompletedTasksByCompletionDate(params): Promise<CompletedTaskResponse>`
  - `getCompletedTasksByDueDate(params): Promise<CompletedTaskResponse>`

### Existing Tools

- **TodoistTasksTool**: Extend `execute()` method to handle `list_completed` action

### Existing Types

- **Task interface** (`src/types/todoist.ts`): Add optional `completed_at` field

### Existing Schemas

- **TodoistTasksInputSchema** (`src/schemas/validation.ts`): Add completed query fields to discriminated union
