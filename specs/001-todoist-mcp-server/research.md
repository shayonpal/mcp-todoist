# Research: Todoist MCP Server Implementation

## MCP SDK TypeScript Patterns

**Decision**: Use @modelcontextprotocol/sdk with TypeScript 5.0+
**Rationale**: Official SDK provides type-safe tool definitions, request/response handling, and protocol compliance out of the box. TypeScript 5.0+ offers improved inference and better error messages for complex tool schemas.
**Alternatives considered**:
- Custom MCP implementation (rejected: reinventing protocol complexity)
- JavaScript with JSDoc (rejected: lacks compile-time type safety)

**Best Practices**:
- Tool handlers should be pure functions with explicit input/output types
- Use discriminated unions for tool parameter variants
- Implement proper error boundaries with MCP-compliant error codes
- Leverage zod for runtime validation matching TypeScript interfaces

## Todoist API v1 Integration Strategy

**Decision**: Service layer with axios + retry logic + batching support
**Rationale**: Todoist API v1 supports batching up to 100 commands, has specific rate limits (1000 partial/15min, 100 full/15min), and requires careful error handling for various failure modes.
**Alternatives considered**:
- Direct fetch calls (rejected: lacks retry/batching abstractions)
- Todoist SDK (rejected: adds unnecessary abstraction layer)

**API Patterns**:
- Use `/sync` endpoint for batch operations (up to 100 commands)
- Use individual REST endpoints for single operations
- Implement exponential backoff for rate limit errors (429)
- Cache project/label data to reduce API calls
- Use `temp_id` for dependent operations in batch requests

## Tool Consolidation Architecture

**Decision**: 5 consolidated tools covering all functionality
**Rationale**: Minimizes cognitive load for MCP clients while maintaining full feature coverage. Each tool handles complete CRUD operations for its entity type.

**Tool Design**:
1. **`todoist_tasks`**: Complete task lifecycle (create, read, update, delete, query, bulk operations)
2. **`todoist_projects`**: Project management (create, read, update, archive, query)
3. **`todoist_sections`**: Section operations (create, read, update, delete, reorder within projects)
4. **`todoist_comments`**: Comment management (create, read, update, delete with 15K limit)
5. **`todoist_filters`**: Filter queries and retrieving tasks within filters

**Alternatives considered**:
- 10+ granular tools (rejected: too many tools to manage)
- 2-3 mega-tools (rejected: violates single responsibility)
- Operation-based tools (rejected: duplicates entity knowledge)

## Rate Limiting Implementation

**Decision**: Token bucket algorithm with API-specific limits
**Rationale**: Todoist has different limits for different endpoints. Partial sync (1000/15min) vs full sync (100/15min) requires separate tracking.

**Implementation Strategy**:
- Separate rate limiters for sync vs REST endpoints
- Exponential backoff starting at 1s, max 30s
- Request queuing during rate limit periods
- Expose rate limit status in tool responses

**Error Handling Pattern**:
```typescript
// Rate limit aware request pattern
async function apiRequest<T>(endpoint: string, options: RequestOptions): Promise<T> {
  await rateLimiter.acquire(endpoint);
  try {
    return await axios.request<T>(options);
  } catch (error) {
    if (error.status === 429) {
      await rateLimiter.backoff();
      throw new RateLimitError('API rate limit exceeded', error.headers);
    }
    throw mapToMCPError(error);
  }
}
```

## TypeScript Interface Design

**Decision**: Mirror Todoist API schemas with enhanced type safety
**Rationale**: Maintain 1:1 mapping with API while adding client-side enhancements like computed properties and validation.

**Interface Patterns**:
```typescript
// Base Todoist entity with API fields
interface TodoistTask {
  id: string;
  content: string;
  project_id: string;
  section_id?: string;
  completed: boolean;
  labels: string[];
  priority: 1 | 2 | 3 | 4;
  due?: {
    date: string;
    datetime?: string;
    string: string;
    timezone?: string;
  };
}

// Enhanced client interface with computed properties
interface TaskWithMetadata extends TodoistTask {
  readonly project_name?: string;
  readonly section_name?: string;
  readonly label_names: string[];
  readonly is_overdue: boolean;
}
```

## Error Mapping Strategy

**Decision**: Structured error hierarchy with MCP compliance
**Rationale**: Todoist API returns various error types that need to be mapped to actionable MCP errors while preserving diagnostic information.

**Error Categories**:
- `TodoistAPIError`: General API failures (5xx, network issues)
- `ValidationError`: Invalid request data (400, malformed parameters)
- `AuthenticationError`: Invalid/expired tokens (401, 403)
- `RateLimitError`: Rate limit exceeded (429)
- `NotFoundError`: Resource not found (404)

## Caching Strategy

**Decision**: In-memory LRU cache for read-heavy operations
**Rationale**: Projects, labels, and sections change infrequently but are referenced often. Tasks change frequently and should not be cached.

**Cache Targets**:
- ✅ Projects list (TTL: 30 minutes)
- ✅ Labels list (TTL: 30 minutes)
- ✅ Sections per project (TTL: 15 minutes)
- ❌ Tasks (too dynamic, cache invalidation complex)
- ❌ Comments (may contain sensitive data)

## Testing Strategy

**Decision**: Three-tier testing with mocked API responses
**Rationale**: Full integration testing against live API is unreliable and consumes rate limits. Mocked responses provide consistent, fast tests.

**Test Structure**:
1. **Unit Tests**: Pure functions, validation logic, error mapping
2. **Integration Tests**: Full MCP tool calls with mocked Todoist API
3. **Contract Tests**: Verify mock responses match real API schemas

**Mock Strategy**:
- Realistic response data from actual Todoist API calls
- Error scenario mocks for all error types
- Rate limit simulation for backoff testing
- Batch operation response patterns

## Performance Benchmarks

**Decision**: Sub-500ms response time target with monitoring
**Rationale**: MCP tools should feel responsive. Complex operations may take longer but should provide progress feedback.

**Metrics to Track**:
- Tool response time (target: <500ms for single operations)
- API request time (target: <200ms excluding network)
- Batch operation throughput (target: 100 ops in <2s)
- Memory usage per request (target: <50MB peak)
- Rate limit utilization (target: <80% of limits)

## Security Considerations

**Decision**: Zero server-side token storage with sanitized logging
**Rationale**: API tokens are sensitive and should never leave the MCP client. All logging must be carefully sanitized.

**Security Measures**:
- API tokens passed per-request via MCP client
- All sensitive data scrubbed from logs (tokens, personal content)
- Input validation to prevent injection attacks
- HTTPS-only API communication
- No persistent state to reduce attack surface