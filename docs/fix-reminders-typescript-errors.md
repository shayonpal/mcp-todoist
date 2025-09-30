# Fix Plan: TypeScript Compilation Errors in Reminders Implementation

**Date**: 2025-09-30
**Status**: Ready for Execution
**Related Tasks**: T064a-f completion revealed these pre-existing errors from Phase 4.2

## Context

During Phase 4.3.1 (T064a-f), we fixed validation test assertion mismatches. Upon running the full test suite, we discovered that the reminders implementation from Phase 4.2 (T056-T062) has TypeScript compilation errors preventing tests from running.

These errors were not caught during Phase 4.2 implementation, likely because:
1. Tests were written in TDD fashion (expected to fail initially)
2. Implementation focused on functionality over type correctness
3. Full TypeScript strict checks may not have been run

## Problem Summary

**9 TypeScript compilation errors** across 2 files:
- `src/tools/todoist-reminders.ts`: 7 errors
- `src/services/todoist-api.ts`: 2 errors

These prevent:
- Contract tests from compiling
- Integration tests from running
- Full test suite execution
- Production build

## Root Causes

### Issue 1: Error Class Property Naming Inconsistency
**Location**: `src/tools/todoist-reminders.ts` lines 347, 370-372

**Problem**:
- `TodoistAPIError` class defines property as `errorCode` (line 96 in errors.ts)
- Code attempts to access non-existent `.code` property
- Code attempts to call non-existent `.isRetryable()` method (it's a property `retryable`)

**Error Messages**:
```
error TS2339: Property 'code' does not exist on type 'ValidationError'
error TS2339: Property 'code' does not exist on type 'TodoistAPIError'
error TS2551: Property 'isRetryable' does not exist on type 'TodoistAPIError'
```

### Issue 2: Missing Error Codes in Enum
**Locations**:
- `src/tools/todoist-reminders.ts` line 459
- `src/services/todoist-api.ts` line 556

**Problem**:
- Code references `TodoistErrorCode.NOT_FOUND` (doesn't exist, should be `RESOURCE_NOT_FOUND`)
- Code references `TodoistErrorCode.SERVER_ERROR` (doesn't exist in enum)

**Error Messages**:
```
error TS2339: Property 'NOT_FOUND' does not exist on type 'typeof TodoistErrorCode'
error TS2339: Property 'SERVER_ERROR' does not exist on type 'typeof TodoistErrorCode'
```

### Issue 3: Incorrect TodoistAPIError Constructor Usage
**Locations**:
- `src/tools/todoist-reminders.ts` lines 457-460
- `src/services/todoist-api.ts` lines 554-557

**Problem**:
Constructor signature is:
```typescript
constructor(
  errorCode: TodoistErrorCode,     // 1st param
  message: string,                  // 2nd param
  details?: Record<string, any>,    // 3rd param (optional)
  retryable?: boolean,              // 4th param (optional)
  retryAfter?: number,              // 5th param (optional)
  httpStatus?: number,              // 6th param (optional)
  correlationId?: string            // 7th param (optional)
)
```

But code calls it incorrectly:
```typescript
new TodoistAPIError('Reminder not found', TodoistErrorCode.NOT_FOUND, 404)
// Wrong: (message, errorCode, httpStatus)
// Should be: (errorCode, message, details, retryable, retryAfter, httpStatus)
```

**Error Messages**:
```
error TS2345: Argument of type '"Failed to create reminder"' is not assignable to parameter of type 'TodoistErrorCode'
error TS2345: Argument of type '"Reminder not found"' is not assignable to parameter of type 'TodoistErrorCode'
```

### Issue 4: Due Date Type Incompatibility
**Locations**:
- `src/tools/todoist-reminders.ts` lines 422, 484

**Problem**:
The `TodoistReminder.due` interface (lines 115-121 in todoist.ts) defines:
```typescript
due?: {
  date: string;          // REQUIRED (when due exists)
  string: string;        // REQUIRED (when due exists)
  timezone?: string | null;
  is_recurring: boolean;
  lang: string;
};
```

But the Zod schema `ReminderDueSchema` (lines 204-210 in validation.ts) allows:
```typescript
{
  date: z.string().optional(),    // OPTIONAL
  string: z.string().optional(),  // OPTIONAL
  timezone: z.string().nullable().optional(),
  is_recurring: z.boolean().default(false),
  lang: z.string().default('en'),
}
```

This creates a **runtime vs compile-time mismatch**:
- Runtime validation accepts optional `date` and `string`
- TypeScript interface requires both fields
- Code passes validated data that TypeScript rejects

**Error Messages**:
```
error TS2322: Type '{ lang: string; is_recurring: boolean; string?: string | undefined; date?: string | undefined; timezone?: string | null | undefined; }'
is not assignable to type '{ date: string; timezone?: string | null | undefined; is_recurring: boolean; string: string; lang: string; }'
```

**Why Both Fields Should Be Optional**:
1. **Natural language reminders** use `string` only (e.g., "tomorrow at 10am", "every day")
2. **Absolute reminders** can use `date` only (ISO 8601 datetime)
3. Users may provide either field, not necessarily both
4. Todoist API accepts this flexibility
5. Makes reminders consistent with task due dates

## Fix Plan (Recommended: Option A)

### Step 1: Add Missing Error Codes
**File**: `src/types/errors.ts`
**Action**: Add to `TodoistErrorCode` enum (after line 40)

```typescript
export enum TodoistErrorCode {
  // ... existing codes ...
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',

  // Add these:
  NOT_FOUND = 'NOT_FOUND',           // Alias for RESOURCE_NOT_FOUND
  SERVER_ERROR = 'SERVER_ERROR',     // For internal server errors
}
```

**Note**: We could also just use existing `RESOURCE_NOT_FOUND` instead of adding `NOT_FOUND` alias, but adding both maintains backward compatibility if other code uses `NOT_FOUND`.

### Step 2: Fix TodoistAPIError Property Access
**File**: `src/tools/todoist-reminders.ts`

**Line 347** - Change:
```typescript
// Before:
code: validationError.code,

// After:
code: validationError.errorCode,
```

**Line 370** - Change:
```typescript
// Before:
code: error.code,

// After:
code: error.errorCode,
```

**Line 372** - Change:
```typescript
// Before:
retryable: error.isRetryable(),

// After:
retryable: error.retryable,
```

### Step 3: Fix TodoistAPIError Constructor Calls
**File**: `src/tools/todoist-reminders.ts`
**Lines 457-460** - Change:

```typescript
// Before:
throw new TodoistAPIError(
  'Reminder not found',
  TodoistErrorCode.NOT_FOUND,
  404
);

// After:
throw new TodoistAPIError(
  TodoistErrorCode.NOT_FOUND,        // 1st: errorCode
  'Reminder not found',               // 2nd: message
  undefined,                          // 3rd: details (optional)
  false,                              // 4th: retryable
  undefined,                          // 5th: retryAfter (optional)
  404                                 // 6th: httpStatus
);
```

**File**: `src/services/todoist-api.ts`
**Lines 554-557** - Change:

```typescript
// Before:
throw new TodoistAPIError(
  'Failed to create reminder',
  TodoistErrorCode.SERVER_ERROR,
  500
);

// After:
throw new TodoistAPIError(
  TodoistErrorCode.SERVER_ERROR,     // 1st: errorCode
  'Failed to create reminder',        // 2nd: message
  undefined,                          // 3rd: details (optional)
  false,                              // 4th: retryable
  undefined,                          // 5th: retryAfter (optional)
  500                                 // 6th: httpStatus
);
```

### Step 4: Fix Due Date Type (Option A - Recommended)
**File**: `src/types/todoist.ts`
**Lines 115-121** - Change:

```typescript
// Before:
due?: {
  date: string;                      // Required when due exists
  timezone?: string | null;
  is_recurring: boolean;
  string: string;                    // Required when due exists
  lang: string;
};

// After:
due?: {
  date?: string;                     // CHANGE: Make optional
  timezone?: string | null;
  is_recurring: boolean;
  string?: string;                   // CHANGE: Make optional
  lang: string;
};
```

**Rationale for Option A**:
1. **Matches Zod validation schema** - eliminates runtime/compile-time mismatch
2. **Reflects API reality** - Todoist accepts either `date` OR `string` OR both
3. **Supports natural language** - "tomorrow at 10am" uses `string` only
4. **Maintains consistency** - similar to `TodoistTask.due` optional fields
5. **Simpler implementation** - single type change vs multiple validation guards

**Alternative (Option B - Not Recommended)**:
Add validation guards at lines 422 and 484 to ensure both fields exist before assignment. This is more complex, doesn't match API behavior, and creates unnecessary constraints.

## Execution Order

Execute fixes in this sequence to avoid cascading errors:

1. **Step 1**: Add missing error codes to enum (enables other fixes)
2. **Step 2**: Fix property access (simple substitutions)
3. **Step 3**: Fix constructor calls (requires new error codes from Step 1)
4. **Step 4**: Fix due date type (independent of other changes)
5. **Verify**: Run `npx tsc --noEmit` to confirm all errors resolved
6. **Test**: Run `npm test` to ensure no regressions

## Verification Steps

### 1. TypeScript Compilation
```bash
npx tsc --noEmit
# Expected: No errors (or only unrelated errors if any exist)
```

### 2. Run Contract Tests
```bash
npm test -- tests/contract/
# Expected: All contract tests compile and run
```

### 3. Run Integration Tests
```bash
npm test -- tests/integration/
# Expected: All integration tests execute (may have functional failures to fix separately)
```

### 4. Full Test Suite
```bash
npm test
# Expected: All tests compile, validation tests pass (32/32)
```

## Expected Outcome

After applying all fixes:

✅ **All TypeScript compilation errors resolved**
✅ **Contract tests compile and execute**
✅ **Integration tests can run**
✅ **Validation tests remain passing** (32/32)
✅ **Build process succeeds**

This enables continuation to Phase 4.3 documentation tasks (T065-T067).

## Files to Modify

1. `src/types/errors.ts` - Add 2 error codes
2. `src/types/todoist.ts` - Update 1 interface (2 fields)
3. `src/tools/todoist-reminders.ts` - Fix 5 locations (3 property access, 1 constructor, 1 type assignment)
4. `src/services/todoist-api.ts` - Fix 1 constructor call

**Total**: 4 files, ~10 line changes

## Success Criteria

- [ ] Zero TypeScript compilation errors
- [ ] All contract tests compile
- [ ] Validation test suite passes (32/32)
- [ ] No new test failures introduced
- [ ] Code follows existing error handling patterns
- [ ] Types align with runtime validation schemas
