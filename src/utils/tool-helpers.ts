import { z } from 'zod';
import { TodoistAPIError } from '../types/errors.js';
import { TodoistErrorCode } from '../types/errors.js';

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
  metadata?: Record<string, unknown>;
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
    todoistError = {
      code: TodoistErrorCode.VALIDATION_ERROR,
      message: 'Invalid input parameters',
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
  metadata?: Record<string, unknown>
): ToolOutput {
  return {
    success: true,
    data,
    message,
    metadata,
  };
}
