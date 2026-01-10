# Todoist MCP Server

[![npm version](https://img.shields.io/npm/v/@shayonpal/mcp-todoist.svg)](https://www.npmjs.com/package/@shayonpal/mcp-todoist)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](package.json)

<a href="https://glama.ai/mcp/servers/@shayonpal/mcp-todoist">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@shayonpal/mcp-todoist/badge" />
</a>

MCP server enabling programmatic Todoist task and project management through an optimized tool set using Todoist REST API v1. Integrates seamlessly with Claude Desktop and other MCP-compatible clients.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Available Tools](#available-tools)
- [Rate Limiting](#rate-limiting)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Features

- **8 Core Tools**: Comprehensive task and project management
  - Tasks (CRUD + complete/uncomplete)
  - Bulk Tasks (batch operations on up to 50 tasks)
  - Projects (CRUD + archive/unarchive)
  - Sections (organize tasks within projects)
  - Comments (with file attachment support)
  - Filters (custom task queries)
  - Reminders (relative, absolute, location-based)
  - Labels (personal and shared label management)
- **Natural Language Dates**: "tomorrow", "every Monday", "next Friday at 3pm"
- **Deadline Support**: Set completion deadlines distinct from due dates
- **Batch Operations**: Execute up to 100 operations per request via Sync API
- **Smart Rate Limiting**: Token bucket algorithm with automatic retry
- **Type Safety**: Full TypeScript implementation with Zod validation
- **Comprehensive Testing**: Contract and integration test coverage

## Prerequisites

- **Node.js** 18 or higher
- **Todoist account** ([Sign up free](https://todoist.com))
- **Todoist API token** ([Get yours here](https://todoist.com/help/articles/find-your-api-token))
- Any of the popular **MCP clients**, such as:
  - [Claude Desktop](https://claude.ai/download)
  - [Claude Code CLI](https://github.com/anthropics/claude-code)
  - [Codex CLI](https://github.com/openai/codex)
  - [Cursor IDE or CLI](https://cursor.com/)
  - [Raycast MCP Extension](https://www.raycast.com/)
  - Any other MCP-compatible client

## Installation

This MCP server is deployed as a remote HTTP service. No local installation required - just configure your MCP client to connect to the HTTP endpoint.

### For Deployment

If you want to deploy your own instance:

1. Fork this repository
2. Deploy to Vercel (button below)
3. Configure `TODOIST_API_TOKEN` in Vercel environment variables

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/shayonpal/mcp-todoist)

## Configuration

### MCP Clients

Configure your MCP client with the HTTP transport:

#### Claude Desktop / Claude Code

Add to your MCP settings file:

**macOS**: `~/.claude/settings.json`
**Windows**: `%APPDATA%\.claude\settings.json`
**Linux**: `~/.config/claude/settings.json`

```json
{
  "mcpServers": {
    "todoist": {
      "transport": {
        "type": "http",
        "url": "https://todoist.uverfolks.ca/mcp"
      }
    }
  }
}
```

For local development:
```json
{
  "mcpServers": {
    "todoist": {
      "transport": {
        "type": "http",
        "url": "http://localhost:3000/mcp"
      }
    }
  }
}
```

## Available Tools

### todoist_tasks
Complete task management with create, get, update, delete, list, complete, uncomplete, and list_completed actions. Supports natural language dates, deadlines, priorities, labels, recurring tasks, and querying completed tasks within time-bounded windows.

**Key parameters**: `action`, `task_id`, `content`, `due_date`, `due_string`, `deadline`, `priority`, `labels`, `project_id`, `completed_query_type`, `since`, `until`

**Completed tasks querying**:
- `list_completed` action retrieves completed tasks
- Query by completion date (3-month window) or due date (6-week window)
- Supports filtering by project, section, workspace, labels, and more
- Cursor-based pagination for large result sets
- Example: Query all tasks completed in September with Work label
  ```json
  {
    "action": "list_completed",
    "completed_query_type": "by_completion_date",
    "since": "2025-09-01T00:00:00Z",
    "until": "2025-09-30T23:59:59Z",
    "filter_query": "@Work",
    "limit": 50
  }
  ```

### todoist_projects
Project management with create, get, update, delete, list, archive, and unarchive actions. Organize work with hierarchical projects and custom views.

**Key parameters**: `action`, `project_id`, `name`, `color`, `is_favorite`, `view_style`

### todoist_sections
Section management within projects for better task organization. Create, get, update, delete, list, and reorder sections.

**Key parameters**: `action`, `section_id`, `project_id`, `name`, `order`

### todoist_comments
Add and manage comments on tasks and projects with file attachment support (up to 15,000 characters).

**Key parameters**: `action`, `comment_id`, `task_id`, `project_id`, `content`, `attachment`

### todoist_filters
Create and manage custom filters for advanced task queries. List, create, update, delete, and query filters.

**Key parameters**: `action`, `filter_id`, `name`, `query`, `color`, `is_favorite`

### todoist_reminders
Set reminders for tasks with three types: relative (X minutes before due), absolute (specific datetime), and location-based (geofenced).

**Key parameters**: `action`, `reminder_id`, `item_id`, `type`, `minute_offset`, `due`, `loc_lat`, `loc_long`

### todoist_labels
Manage personal and shared labels with create, get, update, delete, list, rename, and remove actions. Includes caching for optimal performance.

**Key parameters**: `action`, `label_id`, `name`, `color`, `is_favorite`, `order`

### todoist_bulk_tasks
Perform bulk operations on up to 50 tasks simultaneously. Supports update, complete, uncomplete, and move operations with automatic deduplication and partial execution mode.

**Key parameters**: `action`, `task_ids` (1-50 items), `project_id`, `section_id`, `labels`, `priority`, `due_string`, `deadline_date`

**Supported Actions**:
- `update` - Modify task fields (due date, priority, labels, etc.)
- `complete` - Mark multiple tasks as done
- `uncomplete` - Reopen completed tasks
- `move` - Change project/section/parent for multiple tasks

**Usage Examples**:

```json
// Bulk update due dates for 5 tasks
{
  "action": "update",
  "task_ids": ["7654321", "7654322", "7654323", "7654324", "7654325"],
  "due_string": "tomorrow"
}

// Bulk complete 10 tasks
{
  "action": "complete",
  "task_ids": ["7654321", "7654322", "7654323", "7654324", "7654325",
               "7654326", "7654327", "7654328", "7654329", "7654330"]
}

// Bulk move 7 tasks to different project
{
  "action": "move",
  "task_ids": ["7654321", "7654322", "7654323", "7654324", "7654325",
               "7654326", "7654327"],
  "project_id": "2203306141"
}

// Bulk update multiple fields for 8 tasks
{
  "action": "update",
  "task_ids": ["7654321", "7654322", "7654323", "7654324",
               "7654325", "7654326", "7654327", "7654328"],
  "priority": 2,
  "labels": ["urgent", "work"],
  "deadline_date": "2025-12-31"
}
```

**Limitations**:
- Maximum 50 unique tasks per operation (after deduplication)
- Cannot modify `content` (task title), `description`, or `comments` in bulk
- All tasks receive the same field updates
- Performance: <2 seconds for 50-task operations

**Response Structure**:
- Individual results for each task (success/failure)
- Summary counts (total, successful, failed)
- Automatic deduplication metadata
- Execution time tracking

## Rate Limiting

The server implements intelligent rate limiting to respect Todoist API constraints:

- **REST API**: 300 requests/minute (token bucket: 300 capacity, 5 tokens/sec refill)
- **Sync API**: 50 requests/minute (token bucket: 50 capacity, ~0.83 tokens/sec refill)
- **Automatic Retry**: Exponential backoff on 429 responses
- **Batch Operations**: Use for bulk updates to minimize API calls

## Development

### Prerequisites

- Node.js 18+
- Vercel CLI: `npm install -g vercel`
- Todoist API token

### Local Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/shayonpal/mcp-todoist.git
   cd mcp-todoist
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local`:
   ```bash
   echo "TODOIST_API_TOKEN=your_token_here" > .env.local
   ```

4. Start development server:
   ```bash
   vercel dev
   ```

   Server runs at `http://localhost:3000/mcp`

5. Test endpoint:
   ```bash
   curl -X POST http://localhost:3000/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

GNU General Public License v3.0 - see [LICENSE](LICENSE) for details.

Copyright (C) 2025 Shayon Pal