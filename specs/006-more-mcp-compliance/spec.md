# Feature Specification: Deferred API Token Validation for MCP Platform Compatibility

**Feature Branch**: `006-more-mcp-compliance`
**Created**: 2025-10-02
**Status**: Draft
**Input**: User description: "more mcp compliance (for details, check task ID 6f2xcRj95283cvhR in todoist)"

## Execution Flow (main)
```
1. Parse user description from Input
   → Feature identified: Make TODOIST_API_TOKEN optional at startup
2. Extract key concepts from description
   → Actors: MCP platform inspectors (Smithery), server initialization process, tool callers
   → Actions: Server startup, MCP protocol handshake, tool execution
   → Data: API token configuration
   → Constraints: Must maintain security while deferring validation
3. For each unclear aspect:
   → [RESOLVED] All aspects clarified from task description
4. Fill User Scenarios & Testing section
   → Primary scenario: Hosted MCP server startup without token
5. Generate Functional Requirements
   → All requirements testable and unambiguous
6. Identify Key Entities (if data involved)
   → Configuration state, validation lifecycle
7. Run Review Checklist
   → No [NEEDS CLARIFICATION] markers
   → No implementation details in requirements
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## Clarifications

### Session 2025-10-02
- Q: Should the system cache token validation results across multiple tool calls, or validate on every tool invocation? → A: Cache successful validation - validate once per server session, reuse for all subsequent tool calls
- Q: What should the health check endpoint report when no token is configured? → A: Include token status in response - healthy with metadata indicating token availability
- Q: How much diagnostic information should error messages include for token-related failures? → A: Actionable - category plus next step (e.g., "Token missing. Set TODOIST_API_TOKEN environment variable")

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As an MCP platform operator (like Smithery), I need the Todoist MCP server to start successfully and respond to protocol initialization requests even when no API token is configured, so that I can inspect the server's capabilities, validate its tool schemas, and complete the deployment workflow. The server should only require a valid token when someone attempts to actually use a Todoist-related tool.

### Acceptance Scenarios
1. **Given** the server starts without TODOIST_API_TOKEN configured, **When** the MCP platform sends initialization requests, **Then** the server responds successfully with its tool catalog and protocol information
2. **Given** the server is running without an API token, **When** a user attempts to call any Todoist tool, **Then** the server returns a clear error message indicating that TODOIST_API_TOKEN must be configured
3. **Given** the server is running with a valid API token, **When** a user calls a Todoist tool, **Then** the server executes the tool normally without any validation delays or errors
4. **Given** the server starts with an invalid API token format, **When** a user attempts to call a Todoist tool, **Then** the server detects the invalid token and returns a helpful error message
5. **Given** the server is running without a token, **When** configuration is updated to add a valid token, **Then** subsequent tool calls succeed without requiring a server restart
6. **Given** the server is running in any token state (missing, invalid, or valid), **When** a health check is requested, **Then** the server reports healthy status with metadata indicating current token availability and validation state
7. **Given** a tool call fails due to token issues, **When** the error is returned to the user, **Then** the message includes both the failure category and actionable next step (e.g., "Token missing. Set TODOIST_API_TOKEN environment variable")

### Edge Cases
- **Token revoked mid-session**: If Todoist revokes the token while the server is running with cached validation, tool calls will continue to succeed until server restart (cached state persists). User must restart server with fresh token if revocation occurs.
- **Token removed from environment**: If the API token environment variable is removed after the server has been running with it and has cached successful validation, tool calls continue to work from cache. New server instances will properly detect missing token.
- **Partial initialization failures**: If non-critical subsystems (e.g., logging) fail during startup, token validation deferral must still occur. Server startup success is independent of these subsystem states.
- **Error message examples**: "Token missing. Set TODOIST_API_TOKEN environment variable" | "Token invalid. Verify token format" | "Authentication failed. Verify token is valid at Todoist settings" | "Permission denied. Token lacks required scopes"

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST allow server startup and MCP protocol initialization to complete successfully without a configured API token
- **FR-002**: System MUST respond to MCP tool discovery requests (listing available tools) without requiring API token validation
- **FR-003**: System MUST defer API token validation until the first actual tool execution attempt that requires Todoist API access
- **FR-004**: System MUST return a clear, actionable error message when a tool is called without a configured API token, specifying that TODOIST_API_TOKEN environment variable must be set
- **FR-005**: System MUST validate API token format and authenticity only when a tool requiring Todoist API access is invoked
- **FR-006**: System MUST NOT crash or terminate if API token is missing, invalid, or removed during runtime
- **FR-007**: System MUST allow non-Todoist operations (health checks, protocol handshakes, tool schema queries) to function independently of API token state. Health checks MUST return healthy status with metadata indicating token availability (present/missing) and validation state (not validated/validated/failed)
- **FR-008**: Error messages MUST distinguish between different token-related failure modes (missing token, invalid token format, authentication failure, authorization/permission errors) and include actionable next steps. Format: "[Category]. [Next step]" (e.g., "Token missing. Set TODOIST_API_TOKEN environment variable", "Authentication failed. Verify token is valid at Todoist settings")
- **FR-009**: System MUST cache successful token validation results for the entire server session, eliminating redundant validation on subsequent tool calls

### Key Entities *(include if feature involves data)*
- **Server Lifecycle State**: Represents initialization phases (startup → protocol ready → tool execution ready) with token validation occurring only in the tool execution phase
- **Token Validation State**: Represents the current status of API token validation (not validated, validated successfully, validation failed) maintained separately from server initialization state. Once validated successfully, this state persists for the entire server session until restart
- **Tool Execution Context**: Represents the runtime environment when a tool is invoked, including token availability check and validation trigger point

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---
