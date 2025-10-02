# Feature Specification: Bulk Actions on Tasks

**Feature Branch**: `005-bulk-action-on`
**Created**: 2025-10-02
**Status**: Draft
**Input**: User description: "bulk action on tasks - the idea is to be able to allow the user to take actions on multiple actions at the same time. For example, edit the due date of 5 tasks at the same time, or mark 10 tasks as done in one go, or move 7 tasks from one project to another in one command."

## Execution Flow (main)
```
1. Parse user description from Input
   → If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   → Identified: actors (users), actions (edit, complete, move), data (tasks), constraints (multiple targets)
3. For each unclear aspect:
   → RESOLVED: Maximum 50 tasks per bulk operation
   → RESOLVED: Partial execution (continue on errors, report results per task)
   → RESOLVED: Individual task feedback with success/failure and reasons
   → RESOLVED: No undo capability required
   → RESOLVED: Validation during execution, not pre-validation
   → RESOLVED: No confirmation required from system
4. Fill User Scenarios & Testing section
   → User flow identified: select tasks, choose action, apply to all
5. Generate Functional Requirements
   → Each requirement must be testable
   → All ambiguities resolved
6. Identify Key Entities (if data involved)
   → Entities: Task, BulkOperation, OperationResult
7. Run Review Checklist
   → All clarifications resolved
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing

### Primary User Story
As a task management user, I want to perform the same action on multiple tasks simultaneously so that I can efficiently manage my workflow without repetitive individual operations. For example, when planning my week, I need to reschedule multiple tasks to new dates, or when completing a project milestone, I want to mark all related tasks as done at once.

### Acceptance Scenarios
1. **Given** I have 5 tasks that need their due date changed to next Friday, **When** I select all 5 tasks and update their due_string to "next Friday" in one operation, **Then** all 5 tasks should have their due date set to next Friday
2. **Given** I have 10 tasks related to a completed project, **When** I select all 10 tasks and mark them as complete in one operation, **Then** all 10 tasks should be marked as completed
3. **Given** I have 7 tasks that should be moved from "Personal" project to "Work" project, **When** I select all 7 tasks and update their project_id to the Work project in one operation, **Then** all 7 tasks should appear in the "Work" project
4. **Given** I have selected 15 tasks for a bulk operation, **When** I apply a label change (add/modify labels field) to all of them, **Then** all 15 tasks should have the updated labels
5. **Given** I have 8 tasks that need assignee_id, priority, and deadline_date updated, **When** I submit a bulk update with these three fields, **Then** all 8 tasks should reflect all three updates
6. **Given** I have selected 20 tasks and 3 of them fail validation during execution, **When** I execute the bulk operation, **Then** the system should complete the operation for the 17 valid tasks and return results showing which 3 failed with reasons why
7. **Given** I submit a bulk operation with task IDs [123, 456, 123, 789] containing duplicates, **When** the system processes the request, **Then** the system should deduplicate and process only unique tasks [123, 456, 789] once each
8. **Given** I attempt a bulk operation on 75 unique tasks, **When** I submit the request, **Then** the system should reject the operation with an error message stating the maximum limit is 50 tasks

### Edge Cases
- What happens when the bulk operation exceeds 50 unique tasks? System rejects the request with a clear error message
- What happens when duplicate task IDs are provided? System automatically deduplicates, processes each unique task once
- How does the system handle when some tasks in the batch are locked or inaccessible? Process continues, return failure status for those specific tasks with reasons
- What feedback does the user receive if partial failures occur? Individual status for each task (success/failure with reason)
- How does the system prevent accidental bulk operations on wrong tasks? User is responsible for task selection; no system-level confirmation required
- What happens when attempting bulk actions on recurring tasks vs regular tasks? Both should be supported; any special handling follows standard Todoist behavior
- How are bulk operations tracked for audit purposes? System logs all bulk operations with timestamp, operation type, and results

## Requirements

### Functional Requirements
- **FR-001**: System MUST allow users to select multiple tasks for bulk operations
- **FR-002**: System MUST support bulk update of task fields: project_id, section_id, parent_id, order, labels, priority, assignee_id, due_string/due_date/due_datetime/due_lang, duration/duration_unit, deadline_date
- **FR-002a**: System MUST NOT support bulk modification of content (title), description, or comments fields
- **FR-002b**: System MUST apply the same field update(s) to all tasks in a single bulk update operation (no mixed updates across task subsets)
- **FR-003**: System MUST support bulk completion and uncomplete operations (marking tasks as done or not done)
- **FR-004**: System MUST support bulk move operations targeting project_id, section_id, and parent_id
- **FR-004a**: System MUST NOT allow mixing different operation types (update vs complete vs move) in a single bulk request
- **FR-005**: System MUST provide individual feedback for each task in the bulk operation, including success/failure status and failure reasons when applicable
- **FR-006**: System MUST validate each task during execution (not pre-validation), allowing partial completion
- **FR-007**: System MUST enforce a maximum limit of 50 tasks per bulk operation
- **FR-007a**: System MUST automatically deduplicate task IDs before processing (count unique tasks against the 50-task limit)
- **FR-008**: System MUST provide guidance documentation to tool callers about the 50-task maximum limit
- **FR-009**: System MUST reject bulk operation requests exceeding 50 unique tasks with a clear error message
- **FR-010**: System MUST use partial execution mode: continue processing remaining tasks when individual tasks fail
- **FR-011**: System MUST NOT require confirmation before executing bulk operations
- **FR-012**: System MUST respect Todoist API rate limits when executing bulk operations
- **FR-013**: System MUST log bulk operations for audit and troubleshooting purposes, including operation type, timestamp, and individual task results

### Key Entities
- **Task**: The primary entity being acted upon in bulk; represents a single task with bulk-updateable properties: project_id, section_id, parent_id, order, labels, priority, assignee_id, due fields (string/date/datetime/lang), duration fields (duration/duration_unit), deadline_date, and completion status. Non-updateable in bulk: content (title), description, comments
- **BulkOperation**: Represents a single bulk action request containing the operation type (update, complete/uncomplete, move), target task identifiers (up to 50), and the field updates to apply to all tasks
- **OperationResult**: Tracks the outcome of a bulk operation, including individual success/failure status for each of the up to 50 tasks, specific error messages per task, and overall operation summary

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
- [x] Ambiguities resolved (all 7 clarifications addressed)
- [x] User scenarios defined (6 acceptance scenarios)
- [x] Requirements generated (16 functional requirements)
- [x] Entities identified (3 key entities)
- [x] Review checklist passed

---

## Clarifications

### Session 2025-10-02

- Q: Which bulk operations should be supported beyond the examples given? → A: Bulk update/add/modify task fields: project_id, section_id, parent_id, order, labels, priority, assignee_id, due_string/date/datetime/lang, duration/duration_unit, deadline_date. Bulk move operations support project_id, section_id, parent_id changes. Bulk complete/uncomplete also supported. **Exclusions**: content (title), description, and comments are NOT supported for bulk modification.
- Q: Should bulk operations support mixing different action types in a single request? → A: No - each bulk operation targets one action type (all updates, OR all completes, OR all moves) applied to same field(s) for all selected tasks
- Q: What should happen when a bulk operation request includes duplicate task IDs? → A: Deduplicate automatically - process each unique task ID once only

### Initial Clarifications Provided

1. **Maximum tasks per operation**: 50 tasks (hard limit with pre-request validation and guidance)
2. **Execution mode**: Partial execution - continue processing when individual tasks fail
3. **Feedback detail**: Individual task status with success/failure and specific failure reasons
4. **Undo capability**: Not required
5. **Validation timing**: During execution (not pre-validation)
6. **Confirmation requirement**: No confirmation needed from system
7. **Cancellation scope**: Not applicable (no confirmation means immediate execution)

---
