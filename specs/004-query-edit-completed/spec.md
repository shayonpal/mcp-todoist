# Feature Specification: Query & Reopen Completed Tasks

**Feature Branch**: `004-query-edit-completed`
**Created**: 2025-10-02
**Status**: Draft
**Input**: User description: "query & edit completed tasks"

## Execution Flow (main)
```
1. Parse user description from Input
   → Feature: Enable querying and reopening completed tasks in Todoist
2. Extract key concepts from description
   → Actors: MCP users, Todoist tasks
   → Actions: query completed tasks, filter by various criteria, reopen tasks
   → Data: completed tasks with completion dates, due dates, metadata
   → Constraints: API time window limits, pagination, API limitation (no in-place editing)
3. For each unclear aspect:
   → Clarified: Completed tasks cannot be edited in-place; must be reopened first
4. Fill User Scenarios & Testing section
   → Primary scenario: User queries completed tasks within a time window
   → Secondary scenario: User reopens completed tasks to edit them
5. Generate Functional Requirements
   → Query by completion date or due date
   → Support multiple filter types
   → Enforce API time limits
   → Pagination support
   → Reopen (uncomplete) tasks
6. Identify Key Entities
   → Completed Task, Time Window, Filter Criteria
7. Run Review Checklist
   → All critical clarifications resolved
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
- Q: Should users be able to reopen (uncomplete) completed tasks, or is this feature limited to querying only? → A: Query + Reopen - users can both retrieve and uncomplete tasks to return them to active status
- Q: Which fields of a completed task should users be able to edit while the task remains in completed status? → A: None - Todoist API does not allow editing completed tasks in-place; tasks must be reopened (uncompleted) first, then edited as active tasks, then optionally re-completed

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As a Todoist user, I want to retrieve my completed tasks from a specific time period so that I can review what I've accomplished, generate reports, or analyze my productivity patterns. I need to filter these completed tasks by project, section, labels, priority, and other criteria to find exactly what I'm looking for. Additionally, I want to be able to reopen completed tasks if I need to modify them or return them to active status.

### Acceptance Scenarios

#### Query Scenarios
1. **Given** I have completed 20 tasks in the last week, **When** I request completed tasks by completion date for the last 7 days, **Then** I receive all 20 completed tasks with their completion timestamps

2. **Given** I have completed tasks in multiple projects, **When** I request completed tasks filtered by a specific project, **Then** I receive only tasks from that project

3. **Given** I have completed tasks with various labels, **When** I request completed tasks filtered by a specific label (e.g., "@Work"), **Then** I receive only tasks tagged with that label

4. **Given** I request completed tasks for a 4-month period by completion date, **When** the system validates the request, **Then** I receive an error indicating the maximum allowed window is 3 months

5. **Given** I request completed tasks for an 8-week period by due date, **When** the system validates the request, **Then** I receive an error indicating the maximum allowed window is 6 weeks

6. **Given** there are 150 completed tasks in my query results, **When** I request the first page with a limit of 50, **Then** I receive 50 tasks and a cursor to fetch the next page

7. **Given** I want to find completed tasks about "meeting notes", **When** I use a search filter in my completed tasks query, **Then** I receive only completed tasks containing "meeting notes" in their content or description

#### Reopen Scenarios
8. **Given** I have a completed task, **When** I request to reopen (uncomplete) it, **Then** the task returns to active status, the completion timestamp is removed, and it is removed from completed task queries

9. **Given** I have a completed recurring task, **When** I request to reopen it, **Then** the task returns to active status with its next recurrence date calculated

10. **Given** I want to edit a completed task, **When** I first reopen the task, **Then** I can edit any field using the standard task update operations, and optionally re-complete the task afterward

### Edge Cases
- What happens when requesting completed tasks with both completion date and due date query types specified? [Resolved: User must choose one query type]
- How does the system handle completed tasks that have no due date when querying by due date? (They are excluded from due date query results)
- What happens when attempting to reopen a completed task that has been deleted? (Error: task no longer exists)
- How should the system handle pagination when new tasks are completed during pagination? (Cursor-based pagination ensures consistency within a page sequence)
- What happens when a user queries completed tasks from a project they no longer have access to? (Error or empty results based on permissions)
- What happens when reopening a completed task that was part of a project that no longer exists? (Error: invalid project reference)

## Requirements *(mandatory)*

### Functional Requirements

#### Query Requirements
- **FR-001**: System MUST allow users to query completed tasks by completion date within a maximum 3-month window
- **FR-002**: System MUST allow users to query completed tasks by due date within a maximum 6-week window
- **FR-003**: System MUST validate that time windows do not exceed the allowed limits and provide clear error messages when limits are exceeded
- **FR-004**: System MUST support filtering completed tasks by project identifier
- **FR-005**: System MUST support filtering completed tasks by section identifier
- **FR-006**: System MUST support filtering completed tasks by workspace identifier
- **FR-007**: System MUST support filtering completed tasks by parent task identifier (for subtasks)
- **FR-008**: System MUST support filtering completed tasks using Todoist filter query syntax (for labels, priorities, and text search)
- **FR-009**: System MUST support pagination with configurable page size (minimum 1, maximum 200 items, default 50)
- **FR-010**: System MUST provide a cursor-based pagination mechanism to retrieve subsequent pages
- **FR-011**: System MUST accept language code for parsing filter queries (default: English)
- **FR-012**: System MUST return completed tasks with all standard task metadata (content, description, labels, priority, completion timestamp, etc.)
- **FR-013**: System MUST allow combining multiple filter criteria in a single query (e.g., project + label + priority)
- **FR-014**: System MUST require users to choose either completion date or due date as the query type (mutually exclusive)

#### Reopen (Uncomplete) Requirements
- **FR-015**: System MUST allow users to reopen (uncomplete) completed tasks, returning them to active status
- **FR-016**: System MUST remove the completion timestamp when a task is reopened
- **FR-017**: System MUST handle recurring tasks appropriately when reopened, calculating the next recurrence date
- **FR-018**: System MUST NOT allow in-place editing of completed tasks; users must reopen the task, edit as an active task, then optionally re-complete

#### Data Requirements
- **FR-019**: System MUST require both `since` and `until` datetime parameters for all completed task queries
- **FR-020**: System MUST accept datetime values in ISO 8601 format
- **FR-021**: System MUST return task completion timestamps in the response
- **FR-022**: System MUST indicate when more results are available via the presence of a next page cursor

#### Error Handling Requirements
- **FR-023**: System MUST return a clear error when the time window exceeds 3 months for completion date queries
- **FR-024**: System MUST return a clear error when the time window exceeds 6 weeks for due date queries
- **FR-025**: System MUST return a clear error when required parameters (since, until, query type) are missing
- **FR-026**: System MUST return a clear error when datetime format is invalid
- **FR-027**: System MUST return a clear error when attempting to reopen a task that no longer exists or has been deleted
- **FR-028**: System MUST return a clear error when both completion date and due date query types are specified simultaneously

### Key Entities *(include if feature involves data)*

- **Completed Task**: Represents a task that has been marked as done, containing all standard task attributes plus completion timestamp, original due date information, and current metadata state; cannot be edited in-place and must be reopened to modify
- **Time Window**: Represents the date/time range for querying completed tasks, bounded by `since` and `until` parameters, with maximum duration constraints based on query type (3 months for completion date, 6 weeks for due date)
- **Query Type**: Indicates whether completed tasks should be filtered by completion date (when task was completed) or due date (when task was originally due); mutually exclusive choice
- **Filter Criteria**: Represents optional filtering parameters including project, section, workspace, parent task, and Todoist filter query syntax for advanced filtering
- **Pagination State**: Represents the current position in a multi-page result set, using a cursor token to fetch subsequent pages

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
- [x] Ambiguities marked and resolved (2 critical clarifications completed)
- [x] User scenarios defined
- [x] Requirements generated (query and reopen: complete)
- [x] Entities identified
- [x] Review checklist passed

---

## Notes

### API Constraint Discovery
During clarification, research revealed that the Todoist REST API v1 does not support in-place editing of completed tasks. This is a fundamental API limitation that shapes the feature scope:
- Completed tasks can only be queried (read-only access to metadata)
- To modify any field, the task must first be reopened (uncompleted)
- Once reopened, it becomes an active task and can be edited using standard update operations
- The task can then optionally be re-completed

This constraint eliminates the "edit completed tasks" portion of the original feature description and clarifies that the feature is actually "query and reopen completed tasks" with editing happening through the existing active task update workflow.
