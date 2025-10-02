# Data Model: Token Validation State Management

**Feature**: 006-more-mcp-compliance
**Date**: 2025-10-02

## Entities

### TokenValidationState

**Purpose**: Represents the runtime status of API token validation for the server session

**Lifecycle**: Created at server startup (initial state: `not_validated`), transitions on first tool call, persists until server termination

**Fields**:

| Field | Type | Description | Constraints | Default |
|-------|------|-------------|-------------|---------|
| `status` | `'not_validated' \| 'valid' \| 'invalid'` | Current validation state | Enum, required | `'not_validated'` |
| `validatedAt` | `Date \| null` | Timestamp of successful validation | ISO 8601 datetime, nullable | `null` |
| `error` | `TokenValidationError \| null` | Error details if validation failed | Nullable, only set when status='invalid' | `null` |

**State Transitions**:
```
not_validated → valid      (on successful API call)
not_validated → invalid    (on validation failure)
valid → (no transitions)   (cached for session)
invalid → (no transitions) (persisted until restart)
```

**Validation Rules**:
- FR-009: Once `status` becomes `'valid'`, it MUST NOT change until server restart
- `validatedAt` MUST be set when `status` transitions to `'valid'`
- `error` MUST be set when `status` transitions to `'invalid'`
- `validatedAt` and `error` are mutually exclusive (one or both null)

### TokenValidationError

**Purpose**: Structured error information for token validation failures

**Fields**:

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| `category` | `TokenErrorCategory` | Error classification | Enum (see below) |
| `message` | `string` | User-facing error description | Format: "[Category]. [Next step]" |
| `timestamp` | `Date` | When error occurred | ISO 8601 datetime |
| `details` | `{ apiStatusCode?: number, apiError?: string }` | Optional diagnostic data | Nullable fields |

**TokenErrorCategory Enum**:
- `TOKEN_MISSING`: Environment variable TODOIST_API_TOKEN not set
- `TOKEN_INVALID`: Token format incorrect or malformed
- `AUTH_FAILED`: Todoist API returned 401 (invalid token)
- `PERMISSION_DENIED`: Todoist API returned 403 (insufficient scopes)

**Validation Rules**:
- FR-008: `message` MUST follow format: "[Category]. [Next step]"
- Examples:
  - TOKEN_MISSING: "Token missing. Set TODOIST_API_TOKEN environment variable"
  - AUTH_FAILED: "Authentication failed. Verify token is valid at Todoist settings"

### HealthCheckMetadata

**Purpose**: Structured health check response payload including token validation state

**Fields**:

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| `status` | `'healthy'` | Overall server health | Always 'healthy' (server running) |
| `timestamp` | `Date` | Response generation time | ISO 8601 datetime |
| `components` | `ComponentStatus` | Breakdown by subsystem | See below |

**ComponentStatus Structure**:
```typescript
{
  server: {
    status: 'operational'
  },
  tokenValidation: {
    status: 'configured' | 'not_configured' | 'valid' | 'invalid',
    validatedAt?: string  // ISO timestamp, only if status='valid'
  }
}
```

**Validation Rules**:
- FR-007: Health check MUST return `status: 'healthy'` regardless of token state
- `tokenValidation.status` mapping:
  - `'not_configured'`: Token env var missing
  - `'configured'`: Token present but not yet validated
  - `'valid'`: Token validated successfully
  - `'invalid'`: Token validation failed
- `validatedAt` only included when `status='valid'`

## Relationships

```
TokenValidationState (singleton)
  ├── 1:0..1 with TokenValidationError (only when status='invalid')
  └── referenced by HealthCheckMetadata.components.tokenValidation

HealthCheckMetadata (ephemeral, generated per request)
  └── includes snapshot of TokenValidationState.status
```

## Domain Rules

### DR-001: Single Validation Per Session
Once `TokenValidationState.status` becomes `'valid'`, no further validation attempts occur until server restart.

**Rationale**: Session-based caching per clarification decision (Option A)

**Enforcement**: Singleton pattern with immutable state transitions

### DR-002: Lazy Validation Trigger
Token validation MUST NOT occur during:
- Server initialization
- MCP protocol handshake (initialize, list_tools)
- Health check requests

Token validation MUST occur on:
- First invocation of any Todoist API tool (tasks, projects, sections, comments, filters, reminders, labels)

**Rationale**: FR-003 (defer validation until tool execution)

### DR-003: Error Message Actionability
All `TokenValidationError.message` values MUST provide concrete next steps, not just problem descriptions.

**Rationale**: FR-008 + clarification decision (actionable format)

**Examples**:
- ✅ "Token missing. Set TODOIST_API_TOKEN environment variable"
- ❌ "Token is missing"
- ✅ "Authentication failed. Verify token is valid at Todoist settings"
- ❌ "401 Unauthorized"

### DR-004: Health Check Independence
Health checks MUST succeed (return 200 OK) even when:
- Token is missing (`tokenValidation.status='not_configured'`)
- Token is invalid (`tokenValidation.status='invalid'`)
- Token has never been validated (`tokenValidation.status='not_configured'`)

**Rationale**: FR-007 (non-Todoist operations independent of token state)

## State Persistence

**In-Memory Only**: All entities are runtime state, no persistent storage

**Lifecycle**:
- Created: Server process startup
- Destroyed: Server process termination
- Not serialized to disk, database, or external cache

**Implications**:
- Server restart resets `TokenValidationState` to `not_validated`
- Token revocation mid-session not detected (cached `valid` state persists)
- Multi-instance deployments each maintain independent validation state

## Example Scenarios

### Scenario 1: Successful Startup and Tool Call
```typescript
// t=0: Server starts without token
TokenValidationState = {
  status: 'not_validated',
  validatedAt: null,
  error: null
}

// t=5: Health check request
HealthCheckMetadata = {
  status: 'healthy',
  timestamp: '2025-10-02T14:30:00Z',
  components: {
    server: { status: 'operational' },
    tokenValidation: { status: 'not_configured' }  // No token env var
  }
}

// t=10: User sets TODOIST_API_TOKEN and calls todoist_tasks
// Validation succeeds → state updated
TokenValidationState = {
  status: 'valid',
  validatedAt: '2025-10-02T14:30:05Z',
  error: null
}

// t=15: Subsequent todoist_projects call
// No validation (cached state reused)
```

### Scenario 2: Invalid Token
```typescript
// t=0: Server starts with invalid token
TokenValidationState = {
  status: 'not_validated',
  validatedAt: null,
  error: null
}

// t=5: Tool call triggers validation → 401 from Todoist API
TokenValidationState = {
  status: 'invalid',
  validatedAt: null,
  error: {
    category: 'AUTH_FAILED',
    message: 'Authentication failed. Verify token is valid at Todoist settings',
    timestamp: '2025-10-02T14:30:05Z',
    details: { apiStatusCode: 401 }
  }
}

// t=10: Health check reflects invalid state
HealthCheckMetadata = {
  status: 'healthy',  // Still healthy!
  components: {
    tokenValidation: { status: 'invalid' }
  }
}

// t=15: Subsequent tool calls immediately throw cached error (no API call)
```

### Scenario 3: Token Removed Mid-Session
```typescript
// t=0: Server running with valid cached token
TokenValidationState = {
  status: 'valid',
  validatedAt: '2025-10-02T14:00:00Z',
  error: null
}

// t=5: User removes TODOIST_API_TOKEN env var

// t=10: Tool call still succeeds (cached validation state)
// Validation not re-triggered per DR-001

// Edge case documented in spec.md: "User must restart server with fresh token"
```
