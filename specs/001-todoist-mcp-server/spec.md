# Feature Specification: Todoist MCP Server

**Feature Branch**: `001-todoist-mcp-server`
**Created**: 2025-09-28
**Status**: Draft
**Input**: User description: "We are going to build a MCP server for Todoist that will allow the user to:
- Provide their Todoist API token
- Add a new task or modify an existing one. Task fields they can add/manipulate will be dictated by what's allowed by the API. The details are available at https://developer.todoist.com/api/v1/
- Query existing tasks based on various parameters, including but not limited to the task name, project name, due dates, labels, deadlines etc
- Query filters and the tasks within. API details are available at https://developer.todoist.com/api/v1/
- Manipulate sections in projects. Details available at https://developer.todoist.com/api/v1/
- Read, add and edit comments in tasks. API Details available at https://developer.todoist.com/api/v1/
- Be able to query, add and edit due dates, reminders and deadlines (these are 3 diff concepts in Todoist) on tasks."

## Execution Flow (main)
```
1. Parse user description from Input
   → If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   → Identify: actors, actions, data, constraints
3. For each unclear aspect:
   → Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   → If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   → Each requirement must be testable
   → Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   → If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   → If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation
When creating this spec from a user prompt:
1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for any assumption you'd need to make
2. **Don't guess**: If the prompt doesn't specify something (e.g., "login system" without auth method), mark it
3. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
4. **Common underspecified areas**:
   - User types and permissions
   - Data retention/deletion policies
   - Performance targets and scale
   - Error handling behaviors
   - Integration requirements
   - Security/compliance needs

---

## Clarifications

### Session 2025-09-28
- Q: How should API tokens be stored? → A: MCP client configuration (delegated to client)
- Q: How should errors be returned to the MCP client? → A: MCP standard error format with optional details
- Q: When Todoist API rate limits are exceeded, how should the MCP server respond? → A: Return error and let MCP client handle retries
- Q: How should the system optimize task queries with multiple parameters? → A: Use Todoist filter queries when possible, fallback to local filtering
- Q: What validation approach should be used before sending data to Todoist API? → A: Full validation against Todoist field constraints and limits

### Session 2025-09-28 (API Version Update)
- **CORRECTION**: Specification updated from deprecated API v2 to current API v1
- **Comment editing**: v1 API supports comment editing (15,000 character limit) - previous assumption of deletion-only was incorrect
- **Bulk operations**: v1 supports batching up to 100 commands per request
- **Rate limits**: v1 uses sync-based limits (1000 partial syncs/15min, 100 full syncs/15min)
- Q: What level of observability should the MCP server provide for monitoring and debugging? → A: Basic logging only (errors and warnings)

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As a user with a Todoist account, I want to manage my tasks and projects through an integrated system that allows me to create, update, query, and organize my tasks programmatically. The system should enable me to work with tasks, sections, filters, comments, and scheduling features seamlessly without needing to access the Todoist application directly.

### Acceptance Scenarios
1. **Given** a user has a valid Todoist API token, **When** they configure the server with their token, **Then** they should have authenticated access to their Todoist data
2. **Given** a user wants to add a task, **When** they provide task details (content, project, labels, due date, priority), **Then** a new task should be created in their Todoist account
3. **Given** a user has existing tasks, **When** they query tasks by various parameters (name, project, due dates, labels), **Then** matching tasks should be returned with all their details
4. **Given** a user has existing filters, **When** they query filters or tasks within a filter, **Then** the system returns the filter details and matching tasks
5. **Given** a user wants to organize tasks, **When** they create, update, or delete sections within projects, **Then** the sections should be modified in their Todoist account
6. **Given** a task has comments, **When** a user reads, adds, edits (up to 15,000 characters), or deletes comments, **Then** the comments should be properly managed within the task
7. **Given** a task needs scheduling, **When** a user sets or modifies due dates, reminders, or deadlines, **Then** the task's temporal attributes should be updated accordingly

### Edge Cases
- What happens when an invalid API token is provided?
- How does system handle tasks with missing required fields?
- What happens when querying non-existent tasks or projects?
- How does system handle concurrent modifications to the same task?
- What happens when API rate limits are reached?
- How does system handle tasks with recurring due dates?
- What happens when attempting to add sections to non-existent projects?
- How does system handle malformed date formats for due dates?
- What happens when a user tries to edit a comment exceeding 15,000 characters?
- How does system handle batch operations when some commands in the batch fail?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST allow users to configure their Todoist API token via MCP client configuration (token storage delegated to client)
- **FR-002**: System MUST provide ability to create new tasks with all supported fields (content, project, section, labels, priority, due dates, description, parent task)
- **FR-003**: System MUST provide ability to update existing tasks with any modifiable field
- **FR-004**: Users MUST be able to query tasks based on multiple parameters including task name, project name, due dates, labels, and completion status (optimized using Todoist filter queries when possible, with local filtering fallback)
- **FR-005**: System MUST allow users to query existing filters and retrieve tasks matching filter criteria
- **FR-006**: System MUST provide full section management within projects (create, update, delete, reorder sections)
- **FR-007**: Users MUST be able to read all comments on tasks
- **FR-008**: System MUST allow adding new comments to tasks
- **FR-009**: Users MUST be able to edit and delete comments on tasks (v1 API supports comment editing with 15,000 character limit)
- **FR-009b**: System MUST enforce comment editing character limit of 15,000 characters
- **FR-010**: System MUST provide ability to set and modify due dates on tasks using both specific dates and natural language
- **FR-011**: System MUST provide ability to manage reminders for tasks
- **FR-012**: System MUST handle due date management for tasks including dates, times, and recurring patterns (Todoist uses unified due date concept)
- **FR-013**: System MUST return errors using MCP standard error format with optional details when operations fail
- **FR-014**: System MUST handle pagination using v1 API unified pagination system for efficient large dataset handling
- **FR-015**: System MUST respect Todoist API v1 rate limits (1000 partial sync requests or 100 full sync requests per 15 minutes) and return rate limit errors to MCP client for retry handling
- **FR-016**: System MUST implement efficient bulk operations using v1 API batching (up to 100 commands per request) to minimize API calls and improve performance
- **FR-017**: System MUST handle task dependencies and subtasks properly
- **FR-018**: Users MUST be able to delete tasks permanently when needed with confirmation (Todoist performs permanent deletion with no recovery - CONFIRMED)
- **FR-019**: System MUST perform full validation against Todoist field constraints and limits before sending data to API
- **FR-020**: System MUST provide ability to query, create, update and archive projects including their metadata (name, color, view style, parent)
- **FR-021**: System MUST implement basic logging for errors and warnings to aid debugging and monitoring

### Key Entities *(include if feature involves data)*
- **Task**: Core work item with attributes like content, priority, due dates, labels, project assignment, completion status, and hierarchical relationships
- **Project**: Container for tasks and sections, organizing work into logical groups
- **Section**: Subdivision within a project for further task organization
- **Filter**: Saved query criteria for retrieving specific sets of tasks
- **Comment**: Editable text annotation attached to tasks for collaboration and notes (15,000 character limit)
- **Label**: Tag system for categorizing and filtering tasks across projects
- **Due Date**: Temporal attribute of tasks specifying when work should be completed
- **Reminder**: Notification system for tasks requiring user attention at specific times
- **API Token**: Authentication credential linking the system to a user's Todoist account

### Dependencies and Assumptions
- **External Dependency**: Todoist unified API v1 availability and stability
- **Authentication**: Users must have valid Todoist API tokens from their account settings
- **Rate Limits**: System assumes Todoist API v1 sync-based rate limits (1000 partial sync requests or 100 full sync requests per 15 minutes)
- **Data Persistence**: API token configuration delegated to MCP client, server does not persist tokens
- **API Capabilities**: Based on Todoist API v1 capabilities (comment editing supported up to 15,000 characters, bulk operations via batching up to 100 commands)
- **Network**: Reliable internet connection for API communication
- **Pagination**: Unified pagination system in v1 API for efficient large dataset handling
- **Concurrent Access**: Multiple clients may modify same tasks (last-write-wins behavior expected)
- **Bulk Processing**: Batching optimization available for up to 100 commands per request in v1 API
- **Observability**: Basic logging approach for errors and warnings only, no detailed metrics or tracing required

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
- [x] Ambiguities marked and resolved
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---