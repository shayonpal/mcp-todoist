/**
 * TypeScript interfaces for bulk operations
 * T002: Response types for bulk task operations feature
 */

/**
 * Result for a single task within a bulk operation
 */
export interface OperationResult {
  /** Todoist task ID */
  task_id: string;
  /** Whether operation succeeded for this task */
  success: boolean;
  /** Error message if failed, null if successful */
  error: string | null;
  /** MCP resource URI for this task (format: "todoist://task/{id}") */
  resource_uri: string;
}

/**
 * Aggregated results for an entire bulk operation
 */
export interface BulkOperationSummary {
  /** Number of unique tasks processed (after deduplication) */
  total_tasks: number;
  /** Count of tasks that completed successfully */
  successful: number;
  /** Count of tasks that failed */
  failed: number;
  /** Array of individual task results */
  results: OperationResult[];
}

/**
 * Standard MCP response structure for todoist_bulk_tasks tool
 */
export interface BulkTasksResponse {
  /** Overall operation status (true even with partial failures) */
  success: boolean;
  /** Bulk operation summary with results */
  data: BulkOperationSummary;
  /** Optional metadata about the operation */
  metadata?: {
    /** Whether duplicate task IDs were removed */
    deduplication_applied: boolean;
    /** Number of task IDs before deduplication */
    original_count: number;
    /** Number of task IDs after deduplication */
    deduplicated_count: number;
    /** Total execution time in milliseconds */
    execution_time_ms: number;
  };
}

/**
 * Command object for Todoist Sync API
 */
export interface SyncCommand {
  /** Command type for Sync API */
  type: 'item_update' | 'item_move' | 'item_complete' | 'item_uncomplete';
  /** Unique identifier for tracking command status */
  uuid: string;
  /**
   * Command-specific arguments
   * Different command types have different argument structures, so we use Record<string, any>
   * to maintain flexibility with the Sync API specification
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>;
  /** For creating new items (not used in bulk operations) */
  temp_id?: string;
}

/**
 * Error object from Todoist Sync API
 */
export interface SyncError {
  /** Error code (e.g., "TASK_NOT_FOUND", "INVALID_ARGUMENT") */
  error: string;
  /** Human-readable error message */
  error_message: string;
  /** HTTP-style error code (e.g., 404, 400) */
  error_code?: number;
}

/**
 * Response from Todoist Sync API
 */
export interface SyncResponse {
  /** Status for each command, keyed by UUID */
  sync_status: Record<string, 'ok' | SyncError>;
  /** Mapping of temporary IDs to permanent IDs (not used for bulk ops) */
  temp_id_mapping: Record<string, string>;
  /** Whether this is a full sync response */
  full_sync: boolean;
}
