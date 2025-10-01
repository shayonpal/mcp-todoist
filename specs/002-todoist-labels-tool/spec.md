# Feature Specification: Todoist Labels Management

**Feature Branch**: `002-todoist-labels-tool`
**Created**: 2025-10-01
**Status**: Draft
**Input**: User description: "task ID 6f2QHJ5F7VrCC7xR in todoist"

## Execution Flow (main)
```
1. Parse user description from Input
   → Feature extracted: Implement todoist_labels MCP tool for complete label management
2. Extract key concepts from description
   → Actors: MCP users, AI assistants
   → Actions: Create, read, update, delete, list labels; manage shared labels
   → Data: Labels (name, color, order, favorite status); personal vs shared distinction
   → Constraints: Must follow existing tool patterns, integrate with task labeling
3. For each unclear aspect:
   → No major ambiguities - technical implementation exists
4. Fill User Scenarios & Testing section
   → Primary flow: Users manage labels to organize tasks
5. Generate Functional Requirements
   → All requirements testable via MCP tool interface
6. Identify Key Entities
   → Label entity with defined attributes
7. Run Review Checklist
   → No [NEEDS CLARIFICATION] markers
   → Implementation details removed from requirements
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## Clarifications

### Session 2025-10-01
- Q: When a user tries to create a personal label with a name that already exists in their workspace, what should happen? → A: Merge with existing label (return existing label instead of creating new)
- Q: When a user tries to update or delete a label that doesn't exist (invalid label ID), what should the system do? → A: Return a specific error code (e.g., "LABEL_NOT_FOUND") with HTTP 404 status
- Q: In the context of shared label operations (rename/remove), what does "all active tasks" mean? → A: All tasks across all users/projects that use the shared label
- Q: When the system retrieves hundreds of labels (large collections), what pagination behavior should be expected? → A: Use cursor-based pagination with configurable page size (default 50, max 200)
- Q: When the system encounters API rate limiting (HTTP 429), what should the behavior be? → A: Keep current: Return error after backoff delay (no retry)

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
Users need to manage labels in Todoist to organize and categorize their tasks. Labels provide flexible task categorization independent of project structure. Currently, the MCP server allows task management but lacks label management capabilities, creating a gap where users can reference labels on tasks but cannot create or modify the labels themselves through the MCP interface.

### Acceptance Scenarios

#### Personal Label Management
1. **Given** no labels exist in the workspace, **When** user creates a new label "Work" with blue color, **Then** the label is available for use on tasks
2. **Given** a label "Personal" exists, **When** user updates its color to red and marks it as favorite, **Then** the changes are reflected in all tasks using that label
3. **Given** multiple labels exist, **When** user requests all labels, **Then** system returns complete list with names, colors, and favorite status
4. **Given** a personal label "Archive" is no longer needed, **When** user deletes it, **Then** the label is removed from all tasks and no longer appears in label options
5. **Given** a label ID is provided, **When** user retrieves that specific label, **Then** system returns full label details including order and color
6. **Given** 150 labels exist in workspace, **When** user requests labels with page size 50, **Then** system returns first 50 labels with a cursor to retrieve the next page

#### Shared Label Management
7. **Given** a shared label "TeamProject" exists across multiple projects, **When** user renames it to "Q1-Project", **Then** all tasks across all users/projects using that shared label are updated with the new name
8. **Given** a shared label "Deprecated" is applied to multiple tasks, **When** user removes the shared label, **Then** it is removed from all tasks across all users/projects that use it

#### Error Handling
9. **Given** API rate limit is exceeded, **When** user attempts a label operation, **Then** system applies exponential backoff delay and returns rate limit error with retry-after information

### Edge Cases
- **Duplicate label name on creation**: System returns the existing label instead of creating a duplicate (idempotent behavior)
- **Deleting label assigned to tasks**: Label is automatically removed from all tasks (per FR-009)
- **Operations on non-existent labels**: System returns specific error code "LABEL_NOT_FOUND" with HTTP 404 status for update/delete/get operations on invalid label IDs
- **Shared label scope**: Operations affect all tasks across all users/projects that use the shared label
- **Large label collections**: System uses cursor-based pagination with configurable page size (default 50, max 200 labels per page)
- **Rate limiting**: System applies exponential backoff delay (1s-30s) when rate limited, then returns error without automatic retry
- **Non-existent shared label operations**: What happens when user tries to rename a shared label that doesn't exist?
- **Personal vs shared distinction**: How does system differentiate between personal and shared label operations?

## Requirements *(mandatory)*

### Functional Requirements

#### Personal Label Operations
- **FR-001**: System MUST allow users to create new personal labels with a name (up to 128 characters); if a label with the same name exists, return the existing label instead of creating a duplicate
- **FR-002**: System MUST allow users to specify label color when creating or updating labels
- **FR-003**: System MUST allow users to set label display order to control visual positioning
- **FR-004**: System MUST allow users to mark labels as favorites for quick access
- **FR-005**: System MUST allow users to retrieve all labels in their workspace using cursor-based pagination with configurable page size (default 50, maximum 200 labels per page)
- **FR-006**: System MUST allow users to retrieve a specific label by its identifier
- **FR-007**: System MUST allow users to update any personal label property (name, color, order, favorite status)
- **FR-008**: System MUST allow users to delete personal labels
- **FR-009**: System MUST automatically remove deleted labels from all tasks that reference them

#### Shared Label Operations
- **FR-010**: System MUST allow users to rename shared labels across all tasks (all users/projects) that use the shared label
- **FR-011**: System MUST allow users to remove shared labels from all tasks (all users/projects) that use the shared label
- **FR-012**: System MUST distinguish between personal and shared label operations

#### System Behavior
- **FR-013**: System MUST provide operation feedback including success/failure status
- **FR-014**: System MUST include rate limit information in responses to help users avoid API throttling
- **FR-015**: System MUST handle errors gracefully and provide clear error messages
- **FR-016**: System MUST return specific error code "LABEL_NOT_FOUND" with HTTP 404 status when operations target non-existent label IDs
- **FR-017**: System MUST apply exponential backoff delay when encountering rate limits, then return rate limit error without automatic retry
- **FR-018**: System MUST maintain consistency with existing task label references

### Key Entities *(include if feature involves data)*
- **Personal Label**: A user-owned categorization tag that can be applied to tasks
  - Has a unique identifier for system reference
  - Has a user-defined name for human recognition (up to 128 characters)
  - Has a color attribute for visual organization
  - Has an order attribute to control display sequence within the user's label list
  - Has a favorite flag to indicate frequently used labels
  - Can be created, read, updated, or deleted by the owning user
  - When deleted, automatically removed from all tasks that reference it
  - Exists independently but relates to tasks through task label assignments

- **Shared Label**: A label that exists across multiple projects or team contexts
  - Identified by its name rather than a unique ID
  - Can be renamed across all tasks (all users/projects) that use it simultaneously
  - Can be removed from all tasks (all users/projects) that use it simultaneously
  - Shared label operations affect multiple tasks across organizational boundaries in a single action
  - Provides team-wide and cross-project categorization consistency

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
