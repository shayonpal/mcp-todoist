# HTTP Transport Migration and Vercel Deployment Design

**Date:** 2026-01-10
**Status:** Proposed
**Author:** Design session with Claude

## Overview

This design outlines the migration of the Todoist MCP server from STDIO transport to HTTP-only transport with deployment on Vercel's serverless infrastructure. The primary goals are multi-device access and simplified deployment management.

## Motivation

**Current State:**
- MCP server uses STDIO transport (stdin/stdout)
- Requires local installation on each device
- Runs as a subprocess of MCP clients
- Configuration needed on each machine (Mac Mini, Pi5, MacBook Air)

**Desired State:**
- Single remote HTTP endpoint accessible from all devices
- Deployed on Vercel serverless infrastructure
- Automatic deployments via GitHub integration
- Single source of configuration (environment variables in Vercel)

## Architecture

### High-Level Design

The Todoist MCP server will transform into a **stateless HTTP service** deployed on Vercel's serverless platform:

**Request Flow:**
1. MCP client sends HTTP POST request to `/mcp` endpoint
2. Vercel serverless function receives request
3. MCP session ID extracted from `mcp-session-id` header (or created if absent)
4. Server processes MCP protocol message (initialize, list tools, call tool, etc.)
5. Response returned with session ID header

**Key Characteristics:**
- **Stateless:** Each request is independent, no server-side session storage
- **Serverless:** Runs as Vercel function, auto-scales, manages infrastructure
- **Single-user:** Todoist API token configured once in Vercel environment
- **Transport-only change:** All business logic (tools, API clients, validation) remains unchanged

### Component Architecture

```
┌─────────────────────────────────────────────┐
│         MCP Clients (Multiple Devices)      │
│   Claude Desktop, Claude Code, etc.         │
└───────────────┬─────────────────────────────┘
                │ HTTP POST
                │ /mcp endpoint
                ▼
┌─────────────────────────────────────────────┐
│           Vercel Serverless Function        │
│                                             │
│  ┌────────────────────────────────────┐    │
│  │  api/mcp.ts (HTTP Handler)         │    │
│  │  - Extract session ID              │    │
│  │  - Create HTTP transport           │    │
│  │  - Process MCP message             │    │
│  │  - Return response                 │    │
│  └────────────┬───────────────────────┘    │
│               │                             │
│  ┌────────────▼───────────────────────┐    │
│  │  src/server.ts (Server Factory)    │    │
│  │  - getServer() function            │    │
│  │  - Register tools                  │    │
│  │  - Transport-agnostic              │    │
│  └────────────┬───────────────────────┘    │
│               │                             │
│  ┌────────────▼───────────────────────┐    │
│  │  src/tools/* (Tool Implementations)│    │
│  │  - All existing tools unchanged    │    │
│  └────────────┬───────────────────────┘    │
│               │                             │
│  ┌────────────▼───────────────────────┐    │
│  │  src/services/todoist-api.ts       │    │
│  │  - Todoist REST API client         │    │
│  │  - Uses TODOIST_API_TOKEN from env │    │
│  └────────────────────────────────────┘    │
└───────────────┬─────────────────────────────┘
                │ HTTPS
                ▼
┌─────────────────────────────────────────────┐
│          Todoist REST API                   │
└─────────────────────────────────────────────┘
```

## Transport Layer Changes

### What Changes

**Removed:**
- `src/index.ts` - STDIO entry point (deleted)
- `StdioServerTransport` dependency
- npm package scripts for STDIO execution

**Added:**
- `api/mcp.ts` - HTTP serverless function handler
- `StreamableHTTPServerTransport` from MCP SDK
- `vercel.json` - Vercel configuration
- Session ID management logic

**Modified:**
- `src/server.ts` - Refactored to export `getServer()` factory function
- `package.json` - Updated scripts and dependencies

### HTTP Handler Implementation

**File:** `api/mcp.ts`

```typescript
import { getServer } from '../src/server.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  // Get or create session ID
  const sessionId = getOrCreateSessionId(request);

  // Get server instance
  const server = getServer();

  // Create HTTP transport for this request
  const transport = new StreamableHTTPServerTransport({
    sessionId,
    request,
  });

  // Connect and process
  await server.connect(transport);

  // Return response with session ID
  return new Response(transport.response, {
    headers: {
      'mcp-session-id': sessionId,
      'content-type': 'application/json',
    }
  });
}

function getOrCreateSessionId(request: Request): string {
  const sessionId = request.headers.get('mcp-session-id');

  if (sessionId && isValidSessionId(sessionId)) {
    return sessionId;
  }

  return randomUUID();
}

function isValidSessionId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
```

### Server Factory Pattern

**File:** `src/server.ts`

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { validateConfig } from './config/index.js';
// ... other imports

let serverInstance: McpServer | null = null;

export function getServer(): McpServer {
  if (serverInstance) {
    return serverInstance;
  }

  // Validate configuration
  const configValidation = validateConfig();
  if (!configValidation.valid) {
    throw new Error('Configuration validation failed');
  }

  // Create server
  serverInstance = new McpServer({
    name: 'todoist-mcp-server',
    version: '2.0.0'
  });

  // Register all tools (existing code)
  registerTools(serverInstance);

  return serverInstance;
}

// Rest of existing server implementation...
```

### What Stays the Same

All business logic remains unchanged:
- Tool implementations (`src/tools/*.ts`)
- API clients (`src/services/*.ts`)
- Validation schemas (`src/schemas/*.ts`)
- Type definitions (`src/types/*.ts`)
- Middleware (`src/middleware/*.ts`)
- Error handling logic

## Vercel Deployment Configuration

### Project Structure

```
mcp-todoist/
├── api/
│   └── mcp.ts              # Vercel serverless function (HTTP handler)
├── src/
│   ├── server.ts           # Server factory function
│   ├── tools/              # Tool implementations (unchanged)
│   ├── services/           # API clients (unchanged)
│   ├── schemas/            # Validation schemas (unchanged)
│   ├── types/              # Type definitions (unchanged)
│   ├── middleware/         # Middleware (unchanged)
│   ├── config/             # Configuration (unchanged)
│   └── utils/              # Utilities (unchanged)
├── docs/
│   └── plans/              # Design documents
├── vercel.json             # Vercel configuration
├── package.json            # Updated dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── .env.local              # Local environment variables (gitignored)
└── README.md               # Updated documentation
```

### Vercel Configuration

**File:** `vercel.json`

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/mcp.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/mcp",
      "dest": "/api/mcp"
    }
  ],
  "github": {
    "enabled": true,
    "autoAlias": true
  }
}
```

### Package.json Updates

```json
{
  "name": "@shayonpal/mcp-todoist",
  "version": "2.0.0",
  "scripts": {
    "build": "tsc",
    "vercel-build": "tsc",
    "dev": "vercel dev",
    "test": "jest",
    "lint": "eslint src tests --ext .ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.18.2",
    "axios": "^1.6.2",
    "dotenv": "^16.3.1",
    "uuid": "^13.0.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@vercel/node": "^3.0.0",
    // ... existing devDependencies
  }
}
```

### Environment Variables

**Local Development (.env.local):**
```bash
TODOIST_API_TOKEN=your_token_here
```

**Vercel Dashboard Configuration:**
- Navigate to: Project Settings → Environment Variables
- Add: `TODOIST_API_TOKEN`
- Value: Your Todoist API token
- Environments: Production, Preview, Development

## CI/CD and Deployment Workflow

### GitHub Integration

**Automatic Deployment Flow:**

1. **Pull Request Creation:**
   - Developer creates feature branch
   - Pushes commits and opens PR to `main`
   - Vercel automatically creates **Preview Deployment**
   - Unique URL generated (e.g., `mcp-todoist-pr123.vercel.app`)
   - Build status shown as GitHub check

2. **Preview Testing:**
   - Each commit to PR triggers new preview deployment
   - Test with preview URL before merging
   - Ensures deployment succeeds before merge

3. **Production Deployment:**
   - PR merged to `main`
   - Vercel automatically deploys to production
   - Deployed to `todoist.uberfolks.ca`

### Branch Protection Rules

Configure on GitHub repository:

- **Branch:** `main`
- **Requirements:**
  - ✓ Require pull request before merging
  - ✓ Require status checks to pass before merging
  - ✓ Require Vercel deployment check to pass
  - ✓ Prevent direct pushes to main

This ensures code cannot be merged unless Vercel can successfully build and deploy it.

### Custom Domain Configuration

**Setup in Vercel Dashboard:**
1. Project Settings → Domains
2. Add domain: `todoist.uberfolks.ca`
3. Configure DNS (CNAME or A record as instructed)
4. SSL automatically provisioned by Vercel

**DNS Configuration:**
- Create CNAME record pointing to Vercel
- Vercel provides specific DNS instructions
- SSL certificate auto-renewed

## Authentication and Session Management

### Todoist API Authentication

**Single-user deployment** with Todoist API token:

- **Token Source:** `TODOIST_API_TOKEN` environment variable in Vercel
- **Loading:** Server loads token at initialization
- **Validation:** Existing `validateConfig()` validates token exists
- **Usage:** Included in `Authorization` header for all Todoist API calls
- **Security:** Token never exposed to clients, stays server-side

**No changes to existing authentication logic:**
- `src/services/todoist-api.ts` unchanged
- All API calls work identically

### MCP Session Management

**Session ID Protocol:**

MCP HTTP transport requires session IDs for tracking client connections:

1. **First Request:** Client sends request without `mcp-session-id` header
2. **Server Response:** Generates UUID and returns in `mcp-session-id` header
3. **Subsequent Requests:** Client includes session ID in all requests
4. **Validation:** Server validates UUID format

**Stateless Implementation:**

Despite session IDs, the server remains stateless:
- No session storage (no Redis, database, or in-memory store)
- Todoist token same for all requests (from environment)
- Each MCP request is independent
- No conversation or user state tracked

**Why this works:**
- Single-user deployment (one Todoist account)
- Todoist API operations are stateless REST calls
- Session ID only for MCP protocol compliance

### Access Control

**No additional authentication needed** for initial deployment:

The MCP endpoint at `https://todoist.uberfolks.ca/mcp` will be publicly accessible, but:
- Only proxies to YOUR Todoist account (using your token)
- Even if discovered, manages YOUR tasks only
- Only you configure it in your MCP clients

**Optional future enhancement:**

If you later want to restrict access, add API key validation:

```typescript
const MCP_API_KEY = process.env.MCP_API_KEY; // Optional

export async function POST(request: Request) {
  if (MCP_API_KEY) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${MCP_API_KEY}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }
  // ... continue with normal processing
}
```

## MCP Client Configuration

### HTTP Transport Configuration

**Claude Desktop / Claude Code:**

```json
{
  "mcpServers": {
    "todoist": {
      "transport": {
        "type": "http",
        "url": "https://todoist.uberfolks.ca/mcp"
      }
    }
  }
}
```

**Local Development:**

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

**Key Points:**
- No Todoist API token in client config (stays in Vercel)
- No additional authentication headers needed
- Same config works on all devices (Mac Mini, Pi5, MacBook Air)

## Migration Strategy

### Overview

Complete migration from STDIO to HTTP-only transport with minimal risk.

### Phase 1: Initial Vercel Setup

**Prerequisites:**
1. Install Vercel CLI: `npm install -g vercel`
2. Login: `vercel login`
3. Have Todoist API token ready

**Setup Steps:**

1. **Create configuration files:**
   - Add `vercel.json`
   - Add `api/mcp.ts`
   - Update `src/server.ts` for factory pattern

2. **Set up local environment:**
   - Create `.env.local` with `TODOIST_API_TOKEN`
   - Add `.env.local` to `.gitignore`

3. **Test build:**
   ```bash
   npm run build
   ```

4. **Test with Vercel dev server:**
   ```bash
   vercel dev
   # Server at http://localhost:3000/mcp
   ```

5. **Verify endpoint works:**
   ```bash
   curl -X POST http://localhost:3000/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
   ```

6. **First deployment test:**
   ```bash
   vercel
   # Creates preview deployment
   # Follow prompts to link/create project
   ```

7. **Configure environment in Vercel:**
   - Vercel Dashboard → Project → Settings → Environment Variables
   - Add `TODOIST_API_TOKEN` for all environments

8. **Test preview deployment:**
   ```bash
   # Use preview URL from previous step
   curl -X POST https://your-project-xyz.vercel.app/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```

### Phase 2: GitHub Integration

**After verifying manual deployment works:**

1. **Link GitHub repository:**
   - Vercel Dashboard → Project Settings → Git
   - Connect GitHub repository
   - Set production branch: `main`

2. **Configure branch protection:**
   - GitHub → Repository → Settings → Branches
   - Add rule for `main`:
     - Require status checks to pass
     - Require Vercel deployment check
     - Require pull request reviews

3. **Test workflow:**
   ```bash
   git checkout -b test/vercel-deployment
   # Make small test change
   git commit -am "test: verify Vercel deployment workflow"
   git push origin test/vercel-deployment
   # Open PR on GitHub
   # Watch Vercel create preview deployment
   # Verify deployment succeeds
   # Merge PR
   ```

### Phase 3: Code Migration

**Archive STDIO version:**

```bash
git tag v1.5.0-stdio-final
git push origin v1.5.0-stdio-final
```

**Implement HTTP-only changes:**

```bash
git checkout -b feature/http-only-transport

# Remove STDIO code
rm src/index.ts

# Add HTTP code
# Create api/mcp.ts
# Update src/server.ts
# Add vercel.json
# Update package.json

git add .
git commit -m "feat: migrate to HTTP-only transport for Vercel"
git push origin feature/http-only-transport
```

**Test preview deployment thoroughly:**
- Verify all tools work
- Test error handling
- Verify session management
- Test with actual MCP clients

### Phase 4: Production Deployment

1. **Merge to main:**
   - Review PR
   - Ensure preview deployment tests pass
   - Merge PR
   - Vercel auto-deploys to production

2. **Configure custom domain:**
   - Vercel Dashboard → Domains
   - Add `todoist.uberfolks.ca`
   - Update DNS as instructed
   - Wait for SSL provisioning

3. **Update MCP clients on all devices:**
   - Mac Mini (10.0.0.140)
   - Pi5 (10.0.0.142)
   - MacBook Air (10.0.0.143)

   Replace STDIO config with:
   ```json
   {
     "mcpServers": {
       "todoist": {
         "transport": {
           "type": "http",
           "url": "https://todoist.uberfolks.ca/mcp"
         }
       }
     }
   }
   ```

4. **Verify functionality:**
   - Test from each device
   - Verify all tools work
   - Test error scenarios

### Phase 5: Documentation Update

**Update README.md:**

Remove:
- STDIO installation instructions
- `npx` command examples
- Local subprocess setup

Add:
- HTTP transport configuration
- Vercel deployment instructions
- Local development with `vercel dev`
- Environment variable setup
- Custom domain configuration

**Update CONTRIBUTING.md:**
- Local development workflow with Vercel dev
- Testing with preview deployments
- Deployment process

### Rollback Plan

**If issues arise after deployment:**

1. **Immediate rollback:**
   ```bash
   git revert <commit-hash>
   git push origin main
   # Vercel auto-deploys reverted version
   ```

2. **Restore STDIO version temporarily:**
   ```bash
   git checkout v1.5.0-stdio-final
   npm install
   npm run build
   # Update MCP clients back to STDIO config
   ```

3. **Fix issues:**
   - Debug in feature branch
   - Test with preview deployments
   - Redeploy when ready

## Testing Strategy

### Local Testing

**Unit Tests (unchanged):**
```bash
npm test
```

**Integration Testing:**
```bash
# Start Vercel dev server
vercel dev

# Test MCP protocol
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d @test-requests/initialize.json

# Test with actual MCP client
# Configure client with http://localhost:3000/mcp
```

### Preview Deployment Testing

For each PR:
1. Verify Vercel preview deployment succeeds
2. Configure MCP client with preview URL
3. Test all critical workflows:
   - List tasks
   - Create task
   - Update task
   - Bulk operations
   - Filters
   - Projects

### Production Validation

After production deployment:
1. Smoke test all tools from one device
2. Configure all devices (Mac Mini, Pi5, MacBook Air)
3. Verify functionality from each device
4. Monitor Vercel logs for errors
5. Test error scenarios

## Performance Considerations

### Cold Starts

**Vercel serverless functions** have cold start latency:
- First request after idle: ~1-2 seconds
- Subsequent requests: <100ms
- Keep-alive: ~5 minutes

**Mitigation:**
- Acceptable for personal use (not high-frequency)
- Can add health check to keep warm if needed

### Rate Limiting

**Todoist API limits:**
- REST API: 300 requests/minute
- Sync API: 50 requests/minute

**Current implementation:**
- Existing rate limiting logic unchanged
- Token bucket algorithm still applies
- Automatic retry on 429 responses

**Vercel limits:**
- Free tier: 100GB bandwidth/month
- Generous for personal use
- MCP requests are small JSON payloads

## Security Considerations

### Token Security

- **TODOIST_API_TOKEN:** Stored in Vercel environment variables, never in code
- **Git:** `.env.local` in `.gitignore`, never committed
- **Rotation:** Easy to update in Vercel dashboard

### Network Security

- **HTTPS enforced:** Vercel provides automatic SSL
- **No CORS needed:** MCP clients send standard HTTP requests
- **DNS validation:** Vercel validates domain ownership

### Access Control

**Current:** No authentication (single-user, personal use)

**Future enhancement options:**
- API key validation (optional)
- IP allowlist (if needed)
- Rate limiting per client (if multi-user)

## Monitoring and Debugging

### Vercel Logs

Access via:
- Vercel Dashboard → Project → Logs
- Real-time log streaming
- Filter by deployment
- Search capabilities

### Error Tracking

**Existing logging:**
- `src/middleware/logging.ts` unchanged
- Logs to stderr (visible in Vercel logs)

**Recommended additions:**
- Structured logging (JSON format)
- Error aggregation service (optional: Sentry)
- Performance monitoring (Vercel Analytics)

## Cost Analysis

### Vercel Pricing

**Free Tier (Hobby):**
- 100GB bandwidth/month
- Unlimited deployments
- Automatic SSL
- Preview deployments

**Estimated usage:**
- ~1KB per MCP request
- ~100 requests/day = 3MB/day = 90MB/month
- Well within free tier limits

**Cost:** $0/month (free tier sufficient)

### Domain Costs

**todoist.uberfolks.ca:**
- Already owned
- No additional cost

## Future Enhancements

### Potential improvements (post-migration):

1. **Multi-user support:**
   - Token-per-user authentication
   - User session storage
   - API key management

2. **Caching:**
   - Cache Todoist API responses
   - Reduce API calls
   - Faster responses

3. **Analytics:**
   - Tool usage tracking
   - Performance metrics
   - Error monitoring

4. **Rate limiting:**
   - Per-client rate limits
   - Prevent abuse
   - Fair usage

5. **Webhooks:**
   - Real-time Todoist updates
   - Push notifications
   - Event-driven architecture

## Success Criteria

The migration is successful when:

1. ✓ HTTP endpoint deployed to Vercel
2. ✓ All tools work identically to STDIO version
3. ✓ Accessible from all devices (Mac Mini, Pi5, MacBook Air)
4. ✓ Automatic deployments via GitHub
5. ✓ Custom domain `todoist.uberfolks.ca` working
6. ✓ STDIO code removed from repository
7. ✓ Documentation updated with HTTP instructions
8. ✓ No regressions in functionality

## Timeline

**Estimated effort:**

- Phase 1 (Initial setup): 2-3 hours
- Phase 2 (GitHub integration): 1 hour
- Phase 3 (Code migration): 3-4 hours
- Phase 4 (Production deployment): 1-2 hours
- Phase 5 (Documentation): 1-2 hours

**Total:** ~8-12 hours of focused work

**Recommended approach:**
- Work in small increments
- Test thoroughly at each phase
- Don't rush production deployment

## References

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP HTTP Transport Example](https://github.com/invariantlabs-ai/mcp-streamable-http)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Vercel AI SDK MCP Documentation](https://sdk.vercel.ai/docs/ai-sdk-core/mcp-tools)
