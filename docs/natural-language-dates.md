# Natural Language Due Date Support for Reminders

This document describes the natural language due date support implemented for Todoist reminders in the MCP server.

## Overview

The Todoist MCP server supports natural language due dates for absolute reminders through the `due.string` parameter. This allows you to create reminders using human-readable date expressions instead of specific ISO 8601 datetimes.

## Supported Patterns

### ✅ Basic Patterns (Verified in T063)

#### Tomorrow
```json
{
  "action": "create",
  "type": "absolute",
  "item_id": "task_id",
  "due": {
    "string": "tomorrow at 10:00"
  }
}
```

#### Day After Tomorrow
```json
{
  "action": "create",
  "type": "absolute",
  "item_id": "task_id",
  "due": {
    "string": "day after tomorrow at 2pm"
  }
}
```

#### Every Day (Recurring)
```json
{
  "action": "create",
  "type": "absolute",
  "item_id": "task_id",
  "due": {
    "string": "every day at 9am",
    "is_recurring": true
  }
}
```

#### Every 4th (Monthly Recurring)
```json
{
  "action": "create",
  "type": "absolute",
  "item_id": "task_id",
  "due": {
    "string": "every 4th at noon",
    "is_recurring": true
  }
}
```

### 📅 Additional Supported Patterns

#### Specific Weekdays
- `"next monday at 9am"`
- `"next tuesday at 2pm"`
- `"this friday at 5pm"`
- `"this weekend at noon"`

#### Recurring Weekdays
- `"every monday at 10am"`
- `"every friday at 5pm"`
- `"every weekday at 8am"`
- `"every weekend at 10am"`

#### Yearly Recurring
- `"every sept 7 at 10am"`
- `"every jan 1 at midnight"`
- `"every dec 25 at 9am"`

#### Relative Time
- `"today at 5pm"`
- `"in 2 days at 3pm"`
- `"in 1 week at 9am"`

#### Complex Recurring
- `"every other day at 9am"`
- `"every 2 weeks at noon"`
- `"every month on the 1st at 9am"`

#### Special Times
- `"end of day"`
- `"end of week"`
- `"end of month"`

## Time Format Support

The following time formats are supported:

### 12-hour format with AM/PM
- `"9am"` - 9:00 AM
- `"2pm"` - 2:00 PM
- `"9:30am"` - 9:30 AM
- `"2:45pm"` - 2:45 PM

### 24-hour format
- `"09:00"` - 9:00 AM
- `"14:00"` - 2:00 PM
- `"14:30"` - 2:30 PM

### Special times
- `"noon"` - 12:00 PM
- `"midnight"` - 12:00 AM

## Language Support

Natural language parsing supports multiple languages via the `lang` parameter:

```json
{
  "action": "create",
  "type": "absolute",
  "item_id": "task_id",
  "due": {
    "string": "mañana a las 10:00",
    "lang": "es"
  }
}
```

Supported languages:
- `"en"` - English (default)
- `"es"` - Spanish
- `"fr"` - French
- `"de"` - German
- `"pt"` - Portuguese
- `"ja"` - Japanese
- And many more...

## Timezone Support

You can specify a timezone to ensure correct parsing:

```json
{
  "action": "create",
  "type": "absolute",
  "item_id": "task_id",
  "due": {
    "string": "tomorrow at 10:00",
    "timezone": "America/Toronto"
  }
}
```

Common timezones:
- `"America/Toronto"` - Eastern Time (Toronto)
- `"America/New_York"` - Eastern Time (New York)
- `"America/Los_Angeles"` - Pacific Time
- `"Europe/London"` - GMT/BST
- `"Asia/Tokyo"` - Japan Standard Time
- `"UTC"` - Coordinated Universal Time

## Full Due Object Structure

```typescript
{
  due: {
    date?: string;           // ISO 8601 datetime (auto-populated by API)
    string: string;          // Natural language date (required)
    timezone?: string;       // IANA timezone name
    is_recurring: boolean;   // Whether reminder repeats (default: false)
    lang: string;           // Language code for parsing (default: "en")
  }
}
```

## Examples

### Example 1: Simple Tomorrow Reminder
```json
{
  "action": "create",
  "type": "absolute",
  "item_id": "2995104339",
  "due": {
    "string": "tomorrow at 10:00"
  }
}
```

### Example 2: Daily Recurring Reminder
```json
{
  "action": "create",
  "type": "absolute",
  "item_id": "2995104339",
  "due": {
    "string": "every day at 9am",
    "is_recurring": true
  }
}
```

### Example 3: Monthly Reminder with Timezone
```json
{
  "action": "create",
  "type": "absolute",
  "item_id": "2995104339",
  "due": {
    "string": "every 4th at noon",
    "is_recurring": true,
    "timezone": "America/Toronto"
  }
}
```

### Example 4: Yearly Reminder
```json
{
  "action": "create",
  "type": "absolute",
  "item_id": "2995104339",
  "due": {
    "string": "every sept 7 at 10am",
    "is_recurring": true
  }
}
```

### Example 5: Multi-language Support
```json
{
  "action": "create",
  "type": "absolute",
  "item_id": "2995104339",
  "due": {
    "string": "demain à 10h00",
    "lang": "fr"
  }
}
```

## How Natural Language Parsing Works

1. The natural language string is sent to the Todoist API via the Sync API
2. Todoist's server-side parser interprets the string based on:
   - Current date/time
   - Language specified (default: English)
   - Timezone specified (default: user's timezone)
3. The API returns a reminder with:
   - The original `string` preserved
   - A parsed `date` field with ISO 8601 datetime
   - Recurring information if applicable

## Testing Natural Language Support

### Automated Tests

Run the comprehensive natural language test suite:

```bash
npm test tests/unit/natural-language-dates.test.ts
```

### Manual Verification

Run the interactive verification script:

```bash
npx tsx tests/manual/verify-natural-language.ts
```

This script will:
1. Create a test task
2. Test all required patterns from T063
3. Verify each pattern works correctly
4. Clean up test data
5. Report success/failure for each pattern

## Best Practices

### 1. Always Include Time for Reminders
Natural language dates should always include a time component since full-day reminders don't make sense for notifications.

✅ Good:
- `"tomorrow at 10:00"`
- `"every day at 9am"`

❌ Bad:
- `"tomorrow"` (no time specified)
- `"next monday"` (no time specified)

### 2. Use is_recurring for Repeating Patterns
For patterns with "every", set `is_recurring: true`:

```json
{
  "string": "every monday at 10am",
  "is_recurring": true
}
```

### 3. Specify Timezone for Precision
If working across timezones, explicitly set the timezone:

```json
{
  "string": "tomorrow at 10:00",
  "timezone": "America/Toronto"
}
```

### 4. Test with Real Data
Natural language parsing can vary based on:
- Current date (affects "tomorrow", "next week", etc.)
- User's locale settings
- Daylight saving time changes

Always test with real API calls to verify behavior.

## Limitations

1. **Full-day reminders**: Reminders must include a time component
2. **Very complex patterns**: Extremely complex recurring patterns may not parse correctly
3. **Ambiguous dates**: Some patterns might be interpreted differently than intended
4. **Language coverage**: Not all languages may support all patterns equally

## Error Handling

If a natural language string cannot be parsed:
- The API may return an error
- Or it may interpret the string in an unexpected way
- Always verify the returned `due.date` matches your intention

## Verification Status

✅ **T063 COMPLETE**: All required patterns verified:
- ✅ "tomorrow" - Works correctly
- ✅ "every day" - Works correctly
- ✅ "every 4th" - Works correctly
- ✅ "day after tomorrow" - Works correctly

Additional patterns have been implemented and tested in:
- `tests/unit/natural-language-dates.test.ts` - 200+ test cases
- `tests/integration/reminder-workflow.test.ts` - Integration scenarios
- `tests/manual/verify-natural-language.ts` - Manual verification script

## See Also

- [Todoist API v1 Documentation](../todoist-api-v1-documentation.md) - Full API reference
- [Reminder Types](../README.md#reminder-types) - Overview of all reminder types
- [Quick Start Guide](../../specs/001-todoist-mcp-server/quickstart.md) - Getting started with reminders