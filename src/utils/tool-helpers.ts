import { z } from 'zod';
import { TodoistAPIError } from '../types/errors.js';
import { TodoistErrorCode } from '../types/errors.js';

/**
 * T033: Response metadata with warnings and reminders support
 */
export interface ToolResponseMetadata {
  operation_time?: number;
  rate_limit_remaining?: number;
  rate_limit_reset?: string;
  warnings?: string[]; // Non-blocking advisory messages
  reminders?: string[]; // Non-blocking informational messages
  [key: string]: unknown; // Allow additional metadata fields
}

/**
 * Output interface for all Todoist tools
 */
export interface ToolOutput {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    retryable: boolean;
    http_status?: number;
  };
  message?: string;
  metadata?: ToolResponseMetadata;
}

/**
 * Shared error handling logic for all tools
 * Converts various error types to standardized tool output format
 */
export function handleToolError(
  error: unknown,
  operationTime: number
): ToolOutput {
  let todoistError;

  if (error instanceof TodoistAPIError) {
    todoistError = error.toTodoistError();
  } else if (error instanceof z.ZodError) {
    // Extract a more specific message from the first error
    const firstError = error.errors[0];
    let message = 'Invalid input parameters';
    if (firstError) {
      if (firstError.path.length > 0) {
        const field = firstError.path.join('.');
        message = `${field}: ${firstError.message}`;
      } else {
        // For refinement errors (empty path), use the message directly
        message = firstError.message;
      }
    }
    todoistError = {
      code: TodoistErrorCode.VALIDATION_ERROR,
      message,
      details: { validationErrors: error.errors },
      retryable: false,
    };
  } else {
    todoistError = {
      code: TodoistErrorCode.UNKNOWN_ERROR,
      message: (error as Error).message || 'An unexpected error occurred',
      details: { originalError: error },
      retryable: false,
    };
  }

  return {
    success: false,
    error: todoistError,
    metadata: {
      operation_time: operationTime,
    },
  };
}

/**
 * Remove undefined properties from an object
 * Useful for cleaning API request data
 */
export function removeUndefinedProperties<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  );
}

/**
 * Create a success response with standardized format
 */
export function createSuccessResponse(
  data?: unknown,
  message?: string,
  metadata?: ToolResponseMetadata
): ToolOutput {
  return {
    success: true,
    data,
    message,
    metadata,
  };
}

/**
 * T031: Build warning message for recurring tasks with deadlines
 * Recurring tasks have dynamic due dates, but deadlines remain static
 */
export function buildRecurringWarning(isRecurring: boolean): string | null {
  if (!isRecurring) {
    return null;
  }
  return 'Deadline added to recurring task - deadline will not recur and will remain static';
}

/**
 * T032: Build reminder message for past deadlines
 * Helps users notice when they've specified a deadline in the past
 */
export function buildPastDeadlineReminder(deadlineDate: string): string | null {
  // Parse deadline date (YYYY-MM-DD format)
  const deadline = new Date(deadlineDate + 'T00:00:00Z'); // Use UTC to avoid timezone issues
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to start of day for fair comparison

  // Convert today to UTC for comparison
  const todayUTC = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  );

  if (deadline < todayUTC) {
    return `Specified deadline (${deadlineDate}) is in the past`;
  }
  return null;
}
