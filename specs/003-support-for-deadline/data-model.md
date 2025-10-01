# Data Model: Deadline Support

## Entity: TodoistDeadline

**Purpose**: Represents a task completion deadline (when work must be done by), distinct from due date (when work should start).

### Fields

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `date` | string | Yes | YYYY-MM-DD format (RFC 3339) | The deadline date |
| `lang` | string | No | ISO language code | Language hint (output only, currently unused by API) |

### Validation Rules

1. **Format Validation**
   - `date` MUST match regex: `/^\d{4}-\d{2}-\d{2}$/`
   - Invalid format → Validation error with example (e.g., "2025-10-15")

2. **Semantic Validation**
   - No temporal validation (past dates allowed)
   - No recurrence pattern support (deadline value is static)

3. **Optional Field**
   - `lang` is output-only, provided by API in responses
   - Clients should not send `lang` in requests

### State Transitions

Deadline field has three states:
1. **Absent** (null/undefined) - Task has no deadline
2. **Present** - Task has a deadline with valid date
3. **Removed** - Client explicitly sets deadline to null

Transition matrix:
```
Absent → Present: Create/update with {date: "YYYY-MM-DD"}
Present → Present: Update with new {date: "YYYY-MM-DD"}
Present → Absent: Update with deadline: null
Absent → Absent: No change
```

### Relationships

**Parent Entity**: TodoistTask
- Deadline is an optional attribute of TodoistTask
- One task has zero or one deadline
- Deadline exists independently of due date

## Entity: TodoistTask (Extended)

### New Field

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deadline` | TodoistDeadline &#124; null | No | When task must be completed by |

### Updated Field Relationships

| Field | Type | Relationship to Deadline |
|-------|------|-------------------------|
| `due` | TodoistDueDate &#124; null | Independent - both can exist, neither required |
| `duration` | TodoistDuration &#124; null | Independent - deadline is end date, duration is work time |
| `is_recurring` | boolean | Affects warnings - recurring tasks with deadlines trigger warning |

### Validation Rules (Extended)

1. **Deadline Independence**
   - Task can have deadline without due date
   - Task can have due date without deadline
   - Task can have both deadline and due date
   - No validation that deadline >= due date

2. **Recurring Task Warning**
   - If `is_recurring === true` AND deadline is being set
   - THEN append warning: "Deadline added to recurring task - deadline will not recur"

3. **Past Date Reminder**
   - If deadline.date < current date (YYYY-MM-DD comparison)
   - THEN append reminder: "Specified deadline (YYYY-MM-DD) is in the past"

## Response Metadata Structure

### ToolResponse (Extended)

```typescript
interface ToolResponse {
  success: boolean;
  data: any;
  message: string;
  metadata: {
    operation_time?: number;
    rate_limit_remaining?: number;
    rate_limit_reset?: string;
    warnings?: string[];      // NEW: Advisory messages (non-blocking)
    reminders?: string[];     // NEW: Informational messages (non-blocking)
  };
}
```

### Warning Types

| Warning | Trigger Condition | Message Template |
|---------|------------------|------------------|
| Recurring deadline | `is_recurring === true` AND deadline added | "Deadline added to recurring task - deadline will not recur and will remain static" |

### Reminder Types

| Reminder | Trigger Condition | Message Template |
|----------|------------------|------------------|
| Past deadline | `deadline.date < today` | "Specified deadline ({date}) is in the past" |

## API Payload Transformations

### Input Transformation (MCP → Todoist API)

**MCP Tool Parameter**:
```json
{
  "action": "create",
  "content": "Task title",
  "deadline": "2025-10-15"
}
```

**Todoist API Payload**:
```json
{
  "content": "Task title",
  "deadline": {
    "date": "2025-10-15"
  }
}
```

### Output Transformation (Todoist API → MCP)

**Todoist API Response**:
```json
{
  "id": "123",
  "content": "Task title",
  "deadline": {
    "date": "2025-10-15",
    "lang": "en"
  }
}
```

**MCP Tool Response**:
```json
{
  "success": true,
  "data": {
    "id": "123",
    "content": "Task title",
    "deadline": {
      "date": "2025-10-15",
      "lang": "en"
    }
  },
  "message": "Task created successfully",
  "metadata": {
    "reminders": ["Specified deadline (2025-10-15) is in the past"]
  }
}
```

## Error Scenarios

### Validation Errors

| Scenario | Error Code | Error Message | Example |
|----------|-----------|---------------|---------|
| Invalid format | INVALID_PARAMS | "Invalid deadline format. Expected YYYY-MM-DD (e.g., 2025-10-15)" | `deadline: "10/15/2025"` |
| Missing date field | INVALID_PARAMS | "Deadline date is required" | `deadline: {}` |
| Non-string date | INVALID_PARAMS | "Deadline date must be a string" | `deadline: {date: 20251015}` |

### API Errors

| Scenario | Todoist Error | MCP Error Code | User Message |
|----------|--------------|----------------|--------------|
| API validation | 400 Bad Request | INVALID_PARAMS | "Todoist API rejected deadline: {api_message}" |
| Rate limited | 429 Too Many Requests | RATE_LIMIT_EXCEEDED | "Rate limit exceeded. Try again in {seconds}s" |
| Server error | 500 Internal Error | INTERNAL_ERROR | "Todoist API error. Please try again" |

## Type Definitions (TypeScript)

### Core Types

```typescript
/**
 * Todoist deadline object (RFC 3339 date format)
 */
interface TodoistDeadline {
  /** Deadline date in YYYY-MM-DD format */
  date: string;
  /** Language hint (output only, currently unused) */
  lang?: string;
}

/**
 * Extended task interface with deadline support
 */
interface TodoistTask {
  // ... existing fields
  deadline?: TodoistDeadline | null;
}
```

### Validation Schemas (Zod)

```typescript
import { z } from 'zod';

/**
 * Deadline date format validation
 * Validates YYYY-MM-DD format (RFC 3339)
 */
export const DeadlineSchema = z.object({
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: 'Invalid deadline format. Expected YYYY-MM-DD (e.g., 2025-10-15)'
    })
}).strict();

/**
 * Optional deadline parameter for task operations
 */
export const DeadlineParameterSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Invalid deadline format. Expected YYYY-MM-DD (e.g., 2025-10-15)'
  })
  .optional()
  .nullable();

/**
 * Extended CreateTaskSchema with deadline
 */
export const CreateTaskSchema = z.object({
  action: z.literal('create'),
  content: z.string().min(1),
  // ... existing fields
  deadline: DeadlineParameterSchema
});

/**
 * Extended UpdateTaskSchema with deadline
 */
export const UpdateTaskSchema = z.object({
  action: z.literal('update'),
  task_id: z.string(),
  // ... existing fields
  deadline: DeadlineParameterSchema
});
```

### Response Metadata Types

```typescript
/**
 * Extended metadata with warnings and reminders
 */
interface ToolResponseMetadata {
  operation_time?: number;
  rate_limit_remaining?: number;
  rate_limit_reset?: string;
  warnings?: string[];   // Non-blocking advisory messages
  reminders?: string[];  // Non-blocking informational messages
}

/**
 * Standard tool response structure
 */
interface ToolResponse<T = any> {
  success: boolean;
  data: T;
  message: string;
  metadata: ToolResponseMetadata;
}
```

## Database Schema (N/A)

No database changes required. All data persisted via Todoist API. The MCP server is stateless.

## Migration Plan (N/A)

No migration needed. Deadline field is:
- Additive (optional parameter)
- Backward compatible (existing tools work unchanged)
- API-native (supported by Todoist API v1)

Existing tasks without deadlines remain unchanged. New deadline field appears only when explicitly set.
