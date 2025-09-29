# Data Model: Todoist MCP Server

## Core Entities

### Task
**Purpose**: Core work item with comprehensive attributes for task management
**Validation Rules**:
- Content required, max 500 chars
- Priority: 1-4 (1=lowest, 4=highest)
- Due dates in ISO 8601 format
- Labels: max 100 per task

```typescript
interface TodoistTask {
  id: string;
  content: string;                    // Required, max 500 chars
  description?: string;               // Optional extended description
  project_id: string;                 // Required, must exist
  section_id?: string;                // Optional, must exist if provided
  parent_id?: string;                 // For subtasks
  order: number;                      // Sort order within project/section
  priority: 1 | 2 | 3 | 4;           // 1=lowest, 4=highest
  labels: string[];                   // Array of label IDs, max 100
  assignee_id?: string;               // For shared projects
  assigner_id?: string;               // Who assigned the task
  comment_count: number;              // Number of comments
  completed: boolean;                 // Completion status
  due?: {
    date: string;                     // ISO 8601 date
    datetime?: string;                // ISO 8601 datetime with timezone
    string: string;                   // Natural language representation
    timezone?: string;                // Timezone for datetime
    is_recurring: boolean;            // Whether task repeats
  };
  url: string;                        // Web URL to task
  created_at: string;                 // ISO 8601 creation timestamp
  creator_id: string;                 // Task creator
}
```

**State Transitions**:
- Created → Active (immediately)
- Active → Completed (via complete action)
- Completed → Active (via uncomplete action)
- Any → Deleted (permanent)

### Project
**Purpose**: Container for tasks and sections, organizing work into logical groups
**Validation Rules**:
- Name required, max 120 chars
- Color from predefined set
- View style: list|board

```typescript
interface TodoistProject {
  id: string;
  name: string;                       // Required, max 120 chars
  comment_count: number;              // Number of comments
  order: number;                      // Sort order
  color: string;                      // Predefined color ID
  is_shared: boolean;                 // Shared with other users
  is_favorite: boolean;               // Favorited by user
  is_inbox_project: boolean;          // Default inbox project
  is_team_inbox: boolean;             // Team inbox project
  view_style: 'list' | 'board';      // Display style
  url: string;                        // Web URL to project
  parent_id?: string;                 // For nested projects
}
```

**Relationships**:
- Has many Tasks
- Has many Sections
- May have parent Project (nested)

### Section
**Purpose**: Subdivision within a project for further task organization
**Validation Rules**:
- Name required, max 120 chars
- Must belong to existing project
- Order within project must be unique

```typescript
interface TodoistSection {
  id: string;
  project_id: string;                 // Required, must exist
  order: number;                      // Sort order within project
  name: string;                       // Required, max 120 chars
}
```

**Relationships**:
- Belongs to one Project
- Has many Tasks

### Comment
**Purpose**: Editable text annotation attached to tasks for collaboration and notes
**Validation Rules**:
- Content required, max 15,000 chars
- Must be attached to existing task or project
- Supports one file attachment per comment

```typescript
interface TodoistComment {
  id: string;
  task_id?: string;                   // Either task_id or project_id required
  project_id?: string;                // Either task_id or project_id required
  content: string;                    // Required, max 15,000 chars
  posted_at: string;                  // ISO 8601 timestamp
  attachment?: {
    resource_type: string;            // File type
    file_url: string;                 // Download URL
    file_name: string;                // Original filename
    file_size: number;                // Size in bytes
    file_type: string;                // MIME type
    upload_state: string;             // Upload status
  };
}
```

### Filter
**Purpose**: Saved query criteria for retrieving specific sets of tasks
**Validation Rules**:
- Name required, max 120 chars
- Query must be valid Todoist query syntax
- Color from predefined set

```typescript
interface TodoistFilter {
  id: string;
  name: string;                       // Required, max 120 chars
  query: string;                      // Todoist query syntax
  color: string;                      // Predefined color ID
  order: number;                      // Sort order
  is_favorite: boolean;               // Favorited by user
}
```

### Label
**Purpose**: Tag system for categorizing and filtering tasks across projects
**Validation Rules**:
- Name required, max 120 chars
- Color from predefined set
- Must be unique per user

```typescript
interface TodoistLabel {
  id: string;
  name: string;                       // Required, max 120 chars, unique
  color: string;                      // Predefined color ID
  order: number;                      // Sort order
  is_favorite: boolean;               // Favorited by user
}
```

### API Token
**Purpose**: Authentication credential linking the system to a user's Todoist account
**Security**: Never logged, stored, or exposed in error messages

```typescript
interface APIConfiguration {
  token: string;                      // Bearer token from MCP client
  base_url: string;                   // Always https://api.todoist.com/rest/v2
  timeout: number;                    // Request timeout in ms (default: 10000)
  retry_attempts: number;             // Max retry attempts (default: 3)
}
```

## Computed Properties

### Enhanced Task Interface
```typescript
interface TaskWithMetadata extends TodoistTask {
  readonly project_name?: string;     // Resolved from project_id
  readonly section_name?: string;     // Resolved from section_id
  readonly label_names: string[];     // Resolved from label IDs
  readonly is_overdue: boolean;       // Computed from due date vs current time
  readonly is_today: boolean;         // Due today
  readonly is_upcoming: boolean;      // Due within 7 days
  readonly priority_name: 'Low' | 'Normal' | 'High' | 'Urgent'; // Human readable priority
}
```

## Validation Schemas

### Input Validation (Zod Schemas)
```typescript
const CreateTaskSchema = z.object({
  content: z.string().min(1).max(500),
  description: z.string().max(16384).optional(),
  project_id: z.string().min(1),
  section_id: z.string().min(1).optional(),
  parent_id: z.string().min(1).optional(),
  priority: z.number().int().min(1).max(4).default(1),
  labels: z.array(z.string()).max(100).default([]),
  due_string: z.string().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  due_datetime: z.string().datetime().optional(),
  assignee_id: z.string().min(1).optional(),
});

const UpdateTaskSchema = CreateTaskSchema.partial().extend({
  id: z.string().min(1),
});

const TaskQuerySchema = z.object({
  project_id: z.string().optional(),
  section_id: z.string().optional(),
  label_id: z.string().optional(),
  filter: z.string().optional(),
  lang: z.string().default('en'),
});
```

## Error Types

### Domain-Specific Errors
```typescript
enum TodoistErrorCode {
  INVALID_TOKEN = 'INVALID_TOKEN',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SYNC_ERROR = 'SYNC_ERROR',
  BATCH_PARTIAL_FAILURE = 'BATCH_PARTIAL_FAILURE',
}

interface TodoistError {
  code: TodoistErrorCode;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
  retry_after?: number; // Seconds to wait before retry
}
```

## Performance Considerations

### Caching Strategy
- **Projects**: Cache for 30 minutes (infrequent changes)
- **Labels**: Cache for 30 minutes (infrequent changes)
- **Sections**: Cache for 15 minutes per project (moderate changes)
- **Tasks**: No caching (frequent changes, complex invalidation)
- **Comments**: No caching (may contain sensitive data)

### Pagination
- Default page size: 30 items
- Maximum page size: 100 items
- Use cursor-based pagination for consistent results

### Batch Operations
- Maximum 100 commands per batch request
- Mix of create/update/delete operations supported
- Partial failures handled gracefully with detailed error reporting