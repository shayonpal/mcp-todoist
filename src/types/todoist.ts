/**
 * TypeScript interfaces for Todoist entities
 * Based on Todoist API v1 specifications and data-model.md
 */

/**
 * Core work item with comprehensive attributes for task management
 */
export interface TodoistTask {
  id: string;
  content: string; // Required, max 500 chars
  description?: string; // Optional extended description
  project_id: string; // Required, must exist
  section_id?: string; // Optional, must exist if provided
  parent_id?: string; // For subtasks
  order: number; // Sort order within project/section
  priority: 1 | 2 | 3 | 4; // 1=lowest, 4=highest
  labels: string[]; // Array of label IDs, max 100
  assignee_id?: string; // For shared projects
  assigner_id?: string; // Who assigned the task
  comment_count: number; // Number of comments
  completed: boolean; // Completion status
  due?: {
    date: string; // ISO 8601 date
    datetime?: string; // ISO 8601 datetime with timezone
    string: string; // Natural language representation
    timezone?: string; // Timezone for datetime
    is_recurring: boolean; // Whether task repeats
  };
  url: string; // Web URL to task
  created_at: string; // ISO 8601 creation timestamp
  creator_id: string; // Task creator
}

/**
 * Container for tasks and sections, organizing work into logical groups
 */
export interface TodoistProject {
  id: string;
  name: string; // Required, max 120 chars
  comment_count: number; // Number of comments
  order: number; // Sort order
  color: string; // Predefined color ID
  is_shared: boolean; // Shared with other users
  is_favorite: boolean; // Favorited by user
  is_inbox_project: boolean; // Default inbox project
  is_team_inbox: boolean; // Team inbox project
  view_style: 'list' | 'board'; // Display style
  url: string; // Web URL to project
  parent_id?: string; // For nested projects
}

/**
 * Subdivision within a project for further task organization
 */
export interface TodoistSection {
  id: string;
  project_id: string; // Required, must exist
  order: number; // Sort order within project
  name: string; // Required, max 120 chars
}

/**
 * Editable text annotation attached to tasks for collaboration and notes
 */
export interface TodoistComment {
  id: string;
  task_id?: string; // Either task_id or project_id required
  project_id?: string; // Either task_id or project_id required
  content: string; // Required, max 15,000 chars
  posted_at: string; // ISO 8601 timestamp
  attachment?: {
    resource_type: string; // File type
    file_url: string; // Download URL
    file_name: string; // Original filename
    file_size: number; // Size in bytes
    file_type: string; // MIME type
    upload_state: string; // Upload status
  };
}

/**
 * Saved query criteria for retrieving specific sets of tasks
 */
export interface TodoistFilter {
  id: string;
  name: string; // Required, max 120 chars
  query: string; // Todoist query syntax
  color: string; // Predefined color ID
  order: number; // Sort order
  is_favorite: boolean; // Favorited by user
}

/**
 * Tag system for categorizing and filtering tasks across projects
 */
export interface TodoistLabel {
  id: string;
  name: string; // Required, max 120 chars, unique
  color: string; // Predefined color ID
  order: number; // Sort order
  is_favorite: boolean; // Favorited by user
}

/**
 * Authentication credential linking the system to a user's Todoist account
 */
export interface APIConfiguration {
  token: string; // Bearer token from MCP client
  base_url: string; // Always https://api.todoist.com/rest/v2
  timeout: number; // Request timeout in ms (default: 10000)
  retry_attempts: number; // Max retry attempts (default: 3)
}

/**
 * Enhanced task interface with computed properties
 */
export interface TaskWithMetadata extends TodoistTask {
  readonly project_name?: string; // Resolved from project_id
  readonly section_name?: string; // Resolved from section_id
  readonly label_names: string[]; // Resolved from label IDs
  readonly is_overdue: boolean; // Computed from due date vs current time
  readonly is_today: boolean; // Due today
  readonly is_upcoming: boolean; // Due within 7 days
  readonly priority_name: 'Low' | 'Normal' | 'High' | 'Urgent'; // Human readable priority
}
