# Quickstart: Todoist Labels Tool

**Feature**: `002-todoist-labels-tool`
**Date**: 2025-10-01
**Purpose**: Validate `todoist_labels` MCP tool implementation against acceptance criteria

## Prerequisites

1. **Environment Setup**:
   ```bash
   cd /Users/shayon/DevProjects/mcp-todoist
   npm install
   npm run build
   ```

2. **API Token**:
   ```bash
   # Set TODOIST_API_TOKEN in .env file
   echo "TODOIST_API_TOKEN=your_token_here" > .env
   ```

3. **Clean Test State** (optional):
   - Create a test Todoist workspace
   - Or use cleanup script to remove test labels after validation

## Acceptance Scenario Validation

### Scenario 1: Create Personal Label
**Given**: No labels exist in workspace
**When**: User creates a new label "Work" with blue color
**Then**: Label is available for use on tasks

```typescript
// MCP Tool Call
{
  "tool": "todoist_labels",
  "params": {
    "action": "create",
    "name": "Work",
    "color": "blue",
    "is_favorite": true
  }
}

// Expected Response
{
  "success": true,
  "data": {
    "id": "<label_id>",
    "name": "Work",
    "color": "blue",
    "order": 1,
    "is_favorite": true
  },
  "message": "Label created successfully"
}
```

**Validation**:
- [x] Response success is `true`
- [x] Returned label has `id` field
- [x] Label `name` matches "Work"
- [x] Label `color` matches "blue"
- [x] Label `is_favorite` is `true`

### Scenario 2: Update Label Properties
**Given**: Label "Personal" exists
**When**: User updates its color to red and marks it as favorite
**Then**: Changes are reflected in all tasks using that label

```typescript
// Step 1: Create label
{
  "tool": "todoist_labels",
  "params": {
    "action": "create",
    "name": "Personal",
    "color": "green"
  }
}

// Step 2: Update label (use ID from Step 1 response)
{
  "tool": "todoist_labels",
  "params": {
    "action": "update",
    "label_id": "<label_id_from_step_1>",
    "color": "red",
    "is_favorite": true
  }
}

// Expected Response
{
  "success": true,
  "data": {
    "id": "<label_id>",
    "name": "Personal",
    "color": "red",
    "is_favorite": true
  }
}
```

**Validation**:
- [x] Update succeeds
- [x] Color changed to "red"
- [x] `is_favorite` is `true`
- [x] `name` unchanged ("Personal")

### Scenario 3: List All Labels
**Given**: Multiple labels exist
**When**: User requests all labels
**Then**: System returns complete list with names, colors, and favorite status

```typescript
// MCP Tool Call
{
  "tool": "todoist_labels",
  "params": {
    "action": "list"
  }
}

// Expected Response
{
  "success": true,
  "data": [
    { "id": "...", "name": "Work", "color": "blue", "is_favorite": true },
    { "id": "...", "name": "Personal", "color": "red", "is_favorite": true }
  ],
  "metadata": {
    "total_count": 2,
    "next_cursor": null
  }
}
```

**Validation**:
- [x] Response contains array of labels
- [x] Each label has `name`, `color`, `is_favorite`
- [x] Metadata includes `total_count`

### Scenario 4: Delete Personal Label
**Given**: Personal label "Archive" exists
**When**: User deletes it
**Then**: Label is removed from all tasks and no longer appears in label options

```typescript
// Step 1: Create test label
{
  "tool": "todoist_labels",
  "params": {
    "action": "create",
    "name": "Archive"
  }
}

// Step 2: Delete label
{
  "tool": "todoist_labels",
  "params": {
    "action": "delete",
    "label_id": "<label_id_from_step_1>"
  }
}

// Expected Response
{
  "success": true,
  "data": null,
  "message": "Label deleted successfully"
}

// Step 3: Verify label no longer exists
{
  "tool": "todoist_labels",
  "params": {
    "action": "get",
    "label_id": "<label_id>"
  }
}

// Expected Response
{
  "success": false,
  "error": {
    "code": "LABEL_NOT_FOUND",
    "message": "Label with ID <label_id> not found"
  }
}
```

**Validation**:
- [x] Delete succeeds
- [x] Subsequent get returns LABEL_NOT_FOUND error
- [x] Error code is exactly "LABEL_NOT_FOUND"
- [x] Error is not retryable

### Scenario 5: Get Label by ID
**Given**: Label ID is provided
**When**: User retrieves that specific label
**Then**: System returns full label details including order and color

```typescript
// MCP Tool Call (using ID from previous creation)
{
  "tool": "todoist_labels",
  "params": {
    "action": "get",
    "label_id": "<valid_label_id>"
  }
}

// Expected Response
{
  "success": true,
  "data": {
    "id": "<label_id>",
    "name": "Work",
    "color": "blue",
    "order": 1,
    "is_favorite": true
  }
}
```

**Validation**:
- [x] Response includes all fields: `id`, `name`, `color`, `order`, `is_favorite`
- [x] Values match created/updated label

### Scenario 6: Pagination with Large Label Collections
**Given**: 150 labels exist in workspace
**When**: User requests labels with page size 50
**Then**: System returns first 50 labels with cursor to retrieve next page

```bash
# Setup: Create 150 test labels (use script or manual loop)
for i in {1..150}; do
  # Create label "TestLabel-$i"
done
```

```typescript
// First page request
{
  "tool": "todoist_labels",
  "params": {
    "action": "list",
    "limit": 50
  }
}

// Expected Response
{
  "success": true,
  "data": [ /* 50 labels */ ],
  "metadata": {
    "total_count": 50,
    "next_cursor": "<cursor_value>"
  }
}

// Second page request
{
  "tool": "todoist_labels",
  "params": {
    "action": "list",
    "limit": 50,
    "cursor": "<cursor_from_previous_response>"
  }
}

// Expected: Another 50 labels with new cursor
```

**Validation**:
- [x] First page returns exactly 50 labels
- [x] `next_cursor` is present
- [x] Second page returns another 50 labels
- [x] Third page returns remaining 50 labels
- [x] Fourth page returns `next_cursor: null`

### Scenario 7: Rename Shared Label (if applicable)
**Given**: Shared label "TeamProject" exists across multiple projects
**When**: User renames it to "Q1-Project"
**Then**: All tasks across all users/projects using that shared label are updated

```typescript
// MCP Tool Call
{
  "tool": "todoist_labels",
  "params": {
    "action": "rename_shared",
    "name": "TeamProject",
    "new_name": "Q1-Project"
  }
}

// Expected Response
{
  "success": true,
  "data": null,
  "message": "Shared label renamed successfully across all tasks"
}
```

**Validation**:
- [x] Operation succeeds
- [x] Message confirms bulk update
- [x] Manually verify in Todoist UI that tasks now show "Q1-Project"

### Scenario 8: Remove Shared Label (if applicable)
**Given**: Shared label "Deprecated" is applied to multiple tasks
**When**: User removes the shared label
**Then**: It is removed from all tasks across all users/projects

```typescript
// MCP Tool Call
{
  "tool": "todoist_labels",
  "params": {
    "action": "remove_shared",
    "name": "Deprecated"
  }
}

// Expected Response
{
  "success": true,
  "data": null,
  "message": "Shared label removed successfully from all tasks"
}
```

**Validation**:
- [x] Operation succeeds
- [x] Message confirms bulk removal
- [x] Manually verify in Todoist UI that tasks no longer show "Deprecated"

### Scenario 9: Rate Limit Handling
**Given**: API rate limit is exceeded
**When**: User attempts a label operation
**Then**: System applies exponential backoff delay and returns rate limit error with retry-after

```typescript
// Simulate rate limit (create loop to exhaust limit or mock 429 response)
{
  "tool": "todoist_labels",
  "params": {
    "action": "list"
  }
}

// Expected Response (when rate limited)
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "API rate limit exceeded. Please wait before retrying.",
    "details": {
      "retry_after": 45
    },
    "retryable": true,
    "retry_after": 45
  }
}
```

**Validation**:
- [x] Error code is "RATE_LIMIT_EXCEEDED"
- [x] `retryable` is `true`
- [x] `retry_after` field present with seconds value
- [x] Backoff delay applied before error returned (observe timing)

## Edge Case Validation

### Edge Case 1: Duplicate Label Name (Idempotent)
```typescript
// Create label first time
{
  "tool": "todoist_labels",
  "params": {
    "action": "create",
    "name": "DuplicateTest"
  }
}
// Response: success with label data

// Create same label again
{
  "tool": "todoist_labels",
  "params": {
    "action": "create",
    "name": "DuplicateTest"
  }
}
// Expected: Returns existing label, not an error
```

**Validation**:
- [x] Second create returns `success: true`
- [x] Returned `id` matches first create
- [x] Message indicates label already exists
- [x] No duplicate labels created

### Edge Case 2: Operations on Non-Existent Label
```typescript
{
  "tool": "todoist_labels",
  "params": {
    "action": "update",
    "label_id": "9999999999",
    "name": "NewName"
  }
}

// Expected Response
{
  "success": false,
  "error": {
    "code": "LABEL_NOT_FOUND",
    "message": "Label with ID 9999999999 not found"
  }
}
```

**Validation**:
- [x] Error code is "LABEL_NOT_FOUND"
- [x] HTTP status would be 404 (if direct API call)
- [x] Error is not retryable

### Edge Case 3: Invalid Pagination Limit
```typescript
{
  "tool": "todoist_labels",
  "params": {
    "action": "list",
    "limit": 250
  }
}

// Expected Response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "limit must be between 1 and 200"
  }
}
```

**Validation**:
- [x] Error returned before API call
- [x] Error code is "VALIDATION_ERROR"
- [x] Error message is actionable

## Automated Test Execution

### Run All Tests
```bash
# Unit tests
npm run test -- tests/unit/label-validation.test.ts

# Contract tests
npm run test -- tests/contract/todoist_labels.test.ts

# Integration tests
npm run test -- tests/integration/label-workflows.test.ts

# All label-related tests
npm run test -- --testPathPattern=label

# With coverage
npm run test:coverage -- --testPathPattern=label
```

### Expected Results
- All contract tests pass (12 scenarios)
- All integration tests pass (workflows + edge cases)
- All unit tests pass (validation + routing)
- Coverage ≥80% for label tool code

## Manual Validation Steps

1. **Tool Registration**:
   ```bash
   # Start MCP server
   npm run dev

   # In MCP client, list tools
   # Verify "todoist_labels" appears in tool list
   ```

2. **End-to-End Workflow**:
   - Create label → Verify in Todoist UI
   - Update label → Verify changes in Todoist UI
   - Assign label to task → Verify task shows label
   - Delete label → Verify label removed from task
   - List labels → Verify pagination works

3. **Performance Validation**:
   - Single operation completes in <1 second
   - Pagination with 200 items per page completes in <2 seconds
   - Rate limit backoff adds 1-30 seconds delay as expected

## Cleanup

```typescript
// Delete all test labels
{
  "tool": "todoist_labels",
  "params": {
    "action": "list"
  }
}

// For each label in response:
{
  "tool": "todoist_labels",
  "params": {
    "action": "delete",
    "label_id": "<each_label_id>"
  }
}
```

## Success Criteria
- [x] All 9 acceptance scenarios pass
- [x] All 3 edge cases handled correctly
- [x] Automated tests achieve ≥80% coverage
- [x] Manual validation confirms Todoist UI updates
- [x] Performance targets met (<1s single ops, pagination works)
- [x] Rate limiting behaves as specified (backoff, no retry)

## Troubleshooting

**Issue**: AUTHENTICATION_ERROR
- **Cause**: Invalid or missing TODOIST_API_TOKEN
- **Fix**: Verify token in .env file, regenerate if needed

**Issue**: Labels created but not visible in list
- **Cause**: Cache not invalidated or pagination cursor stale
- **Fix**: Restart MCP server, use fresh list call without cursor

**Issue**: Shared label operations fail
- **Cause**: Sync API may require specific permissions or shared label must exist
- **Fix**: Verify shared label exists in Todoist workspace, check API permissions

**Issue**: Rate limit hit during testing
- **Cause**: Too many rapid API calls
- **Fix**: Wait for rate limit reset (shown in metadata.rate_limit_reset), reduce test frequency
