# Todoist MCP Server

[![npm version](https://img.shields.io/npm/v/@shayonpal/mcp-todoist.svg)](https://www.npmjs.com/package/@shayonpal/mcp-todoist)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](package.json)

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

- **7 Core Tools**: Comprehensive task and project management
  - Tasks (CRUD + complete/uncomplete)
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
- **MCP client** such as:
  - [Claude Desktop](https://claude.ai/download)
  - [Raycast MCP Extension](https://www.raycast.com/)
  - Any MCP-compatible client

## Installation

### Option 1: Install from npm (Recommended)

```bash
npm i @shayonpal/mcp-todoist
```

### Option 2: Install from source

1. Clone the repository:
```bash
git clone https://github.com/shayonpal/mcp-todoist.git
cd mcp-todoist
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Configuration

### 1. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and add your Todoist API token:
```bash
TODOIST_API_TOKEN=your_todoist_api_token_here
```

### 2. Configure your MCP client

#### Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**If installed from npm:**
```json
{
  "mcpServers": {
    "todoist": {
      "command": "npx",
      "args": ["-y", "@shayonpal/mcp-todoist"],
      "env": {
        "TODOIST_API_TOKEN": "your_api_token_here"
      }
    }
  }
}
```

**If installed from source:**
```json
{
  "mcpServers": {
    "todoist": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-todoist/dist/server.js"],
      "env": {
        "TODOIST_API_TOKEN": "your_api_token_here"
      }
    }
  }
}
```

**Note**: When using source installation, use absolute paths in the configuration.

#### Claude Code CLI

**Recommended: Use CLI command**

Add the server using the `claude mcp add` command:

```bash
# Project scope (shared with team, stored in .mcp.json)
claude mcp add todoist --scope project npx -y @shayonpal/mcp-todoist

# User scope (personal, works across all projects)
claude mcp add todoist --scope user npx -y @shayonpal/mcp-todoist

# Local scope (personal, current project only) - default
claude mcp add todoist npx -y @shayonpal/mcp-todoist
```

Then set your Todoist API token as an environment variable:
```bash
export TODOIST_API_TOKEN=your_api_token_here
```

Or manually add the environment variable to `.mcp.json`:
```json
{
  "mcpServers": {
    "todoist": {
      "command": "npx",
      "args": ["-y", "@shayonpal/mcp-todoist"],
      "env": {
        "TODOIST_API_TOKEN": "${TODOIST_API_TOKEN}"
      }
    }
  }
}
```

**Scope selection:**
- **Project scope** (recommended for teams): Shared via `.mcp.json` in version control
- **User scope**: Personal, available across all projects on your machine
- **Local scope**: Personal, specific to current project only (default)

#### Codex CLI

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.todoist]
command = "npx"
args = ["-y", "@shayonpal/mcp-todoist"]
env = { "TODOIST_API_TOKEN" = "your_api_token_here" }
startup_timeout_ms = 20000
```

**Note**: Codex uses TOML format with `mcp_servers` (underscore). All strings must be quoted.

#### Cursor IDE

**Recommended: One-click install**

[![Add to Cursor](https://img.shields.io/badge/Add_to-Cursor-blue?logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMiAyMkgyMkwxMiAyWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==)](cursor://anysphere.cursor-deeplink/mcp/install?name=todoist&config=eyJ0b2RvaXN0Ijp7InR5cGUiOiJzdGRpbyIsImNvbW1hbmQiOiJucHgiLCJhcmdzIjpbIi15IiwiQHNoYXlvbnBhbC9tY3AtdG9kb2lzdCJdLCJlbnYiOnsiVE9ET0lTVF9BUElfVE9LRU4iOiIke2VudjpUT0RPSVNUX0FQSV9UT0tFTn0ifX19)

Click the button above to automatically install the server in Cursor. Make sure you have `TODOIST_API_TOKEN` set as an environment variable.

**Manual installation:**

**Configuration locations:**
- **Project-specific**: `.cursor/mcp.json` in project root
- **Global**: `~/.cursor/mcp.json` in home directory

**Option 1: Using environment variables**
```json
{
  "mcpServers": {
    "todoist": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@shayonpal/mcp-todoist"],
      "env": {
        "TODOIST_API_TOKEN": "${env:TODOIST_API_TOKEN}"
      }
    }
  }
}
```

**Option 2: Using environment file**
```json
{
  "mcpServers": {
    "todoist": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@shayonpal/mcp-todoist"],
      "envFile": ".env"
    }
  }
}
```

**Supported config interpolation:**
- `${env:NAME}` - Environment variables
- `${userHome}` - Path to home folder
- `${workspaceFolder}` - Project root directory
- `${workspaceFolderBasename}` - Project name

#### Other MCP Clients

Refer to your MCP client's documentation for configuration instructions. The server uses STDIO transport and follows MCP protocol version 2024-11-05.

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

## Rate Limiting

The server implements intelligent rate limiting to respect Todoist API constraints:

- **REST API**: 300 requests/minute (token bucket: 300 capacity, 5 tokens/sec refill)
- **Sync API**: 50 requests/minute (token bucket: 50 capacity, ~0.83 tokens/sec refill)
- **Automatic Retry**: Exponential backoff on 429 responses
- **Batch Operations**: Use for bulk updates to minimize API calls

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Build TypeScript
npm run build

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate test coverage report
npm run test:coverage

# Lint code
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Type-check without emitting
npm run typecheck
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

GNU General Public License v3.0 - see [LICENSE](LICENSE) for details.

Copyright (C) 2025 Shayon Pal