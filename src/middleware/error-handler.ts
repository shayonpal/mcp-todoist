import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import {
  TodoistAPIError,
  TodoistErrorCode,
  TodoistError,
} from '../types/errors.js';
import { getFullConfig } from '../config/index.js';
import { logger } from './logging.js';

/**
 * Standard error response format for MCP tools
 */
export interface StandardErrorResponse {
  success: false;
  error: TodoistError;
  metadata?: {
    operation_time?: number;
    correlation_id?: string;
    retry_after?: number;
    [key: string]: unknown;
  };
}

/**
 * Error severity levels for monitoring and alerting
 */
export enum ErrorSeverity {
  LOW = 'low', // Expected errors like validation failures
  MEDIUM = 'medium', // Unexpected but recoverable errors
  HIGH = 'high', // Service degradation
  CRITICAL = 'critical', // Service unavailable
}

/**
 * Enhanced error context for debugging and monitoring
 */
export interface ErrorContext {
  correlationId?: string;
  toolName?: string;
  action?: string;
  userId?: string;
  operationTime?: number;
  requestData?: unknown;
  apiResponse?: unknown;
  retryAttempt?: number;
  [key: string]: unknown;
}

/**
 * Central error handler for all Todoist MCP operations
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private config = getFullConfig();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle any error and convert to standard format
   */
  handleError(
    error: unknown,
    context: ErrorContext = {}
  ): StandardErrorResponse {
    const startTime = Date.now();

    try {
      // Enhance context with timing
      const enhancedContext = {
        ...context,
        error_handled_at: new Date().toISOString(),
        operation_time: context.operationTime || 0,
      };

      let todoistError: TodoistError;
      let severity: ErrorSeverity;

      // Classify and convert error
      if (error instanceof TodoistAPIError) {
        todoistError = error.toTodoistError();
        severity = this.getSeverityForTodoistError(todoistError.code);
      } else if (error instanceof McpError) {
        todoistError = this.convertMcpError(error);
        severity = ErrorSeverity.MEDIUM;
      } else if (this.isValidationError(error)) {
        todoistError = this.convertValidationError(error);
        severity = ErrorSeverity.LOW;
      } else if (this.isNetworkError(error)) {
        todoistError = this.convertNetworkError(error);
        severity = ErrorSeverity.HIGH;
      } else {
        todoistError = this.convertUnknownError(error);
        severity = ErrorSeverity.MEDIUM;
      }

      // Sanitize error for production
      if (this.config.environment.isProduction) {
        todoistError = this.sanitizeError(todoistError);
      }

      // Log error with appropriate level
      this.logError(todoistError, severity, enhancedContext);

      // Build response with metadata (including optional retry_after)
      const response: StandardErrorResponse = {
        success: false,
        error: todoistError,
        metadata: {
          operation_time: enhancedContext.operation_time,
          correlation_id: enhancedContext.correlationId,
          severity,
          timestamp: enhancedContext.error_handled_at,
          ...(todoistError.retryable && todoistError.retry_after
            ? { retry_after: todoistError.retry_after }
            : {}),
        },
      };

      return response;
    } catch (handlerError) {
      // Error in error handler - this is critical
      logger.error('Error handler failed', {
        originalError: error,
        handlerError,
        context,
      });

      return {
        success: false,
        error: {
          code: TodoistErrorCode.UNKNOWN_ERROR,
          message: 'Internal error handler failure',
          retryable: false,
        },
        metadata: {
          operation_time: Date.now() - startTime,
          correlation_id: context.correlationId,
          severity: ErrorSeverity.CRITICAL,
        },
      };
    }
  }

  /**
   * Convert TodoistAPIError to MCP error
   */
  toMcpError(error: TodoistAPIError, context: ErrorContext = {}): McpError {
    const todoistError = error.toTodoistError();
    const mcpErrorCode = this.mapTodoistErrorToMCP(todoistError.code);

    this.logError(
      todoistError,
      this.getSeverityForTodoistError(todoistError.code),
      context
    );

    return new McpError(mcpErrorCode, todoistError.message);
  }

  /**
   * Determine error severity based on error code
   */
  private getSeverityForTodoistError(code: TodoistErrorCode): ErrorSeverity {
    switch (code) {
      case TodoistErrorCode.VALIDATION_ERROR:
        return ErrorSeverity.LOW;
      case TodoistErrorCode.RESOURCE_NOT_FOUND:
      case TodoistErrorCode.LABEL_NOT_FOUND:
        return ErrorSeverity.LOW;
      case TodoistErrorCode.INVALID_TOKEN:
        return ErrorSeverity.CRITICAL;
      case TodoistErrorCode.RATE_LIMIT_EXCEEDED:
        return ErrorSeverity.MEDIUM;
      case TodoistErrorCode.SYNC_ERROR:
        return ErrorSeverity.HIGH;
      case TodoistErrorCode.BATCH_PARTIAL_FAILURE:
        return ErrorSeverity.MEDIUM;
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * Map Todoist error codes to MCP error codes
   */
  private mapTodoistErrorToMCP(todoistErrorCode: TodoistErrorCode): ErrorCode {
    switch (todoistErrorCode) {
      case TodoistErrorCode.INVALID_TOKEN:
        return ErrorCode.InvalidRequest;
      case TodoistErrorCode.RATE_LIMIT_EXCEEDED:
        return ErrorCode.InternalError;
      case TodoistErrorCode.RESOURCE_NOT_FOUND:
      case TodoistErrorCode.LABEL_NOT_FOUND:
        return ErrorCode.InvalidRequest;
      case TodoistErrorCode.VALIDATION_ERROR:
        return ErrorCode.InvalidParams;
      case TodoistErrorCode.SYNC_ERROR:
        return ErrorCode.InternalError;
      case TodoistErrorCode.BATCH_PARTIAL_FAILURE:
        return ErrorCode.InternalError;
      default:
        return ErrorCode.InternalError;
    }
  }

  /**
   * Convert MCP error to Todoist error format
   */
  private convertMcpError(error: McpError): TodoistError {
    return {
      code: TodoistErrorCode.UNKNOWN_ERROR,
      message: error.message || 'MCP protocol error',
      details: { mcpErrorCode: error.code },
      retryable: false,
    };
  }

  /**
   * Check if error is a validation error (Zod or similar)
   */
  private isValidationError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const candidate = error as {
      name?: unknown;
      issues?: unknown;
      errors?: unknown;
    };

    const hasIssuesArray = Array.isArray(candidate.issues);
    const hasErrorsArray = Array.isArray(candidate.errors as unknown[]);
    const isNamedZod =
      typeof candidate.name === 'string' && candidate.name === 'ZodError';

    return hasIssuesArray || hasErrorsArray || isNamedZod;
  }

  /**
   * Convert validation error to Todoist error format
   */
  private convertValidationError(error: unknown): TodoistError {
    let message = 'Validation error';
    let details: Record<string, unknown> = {};

    // Handle Zod validation errors
    if (error && typeof error === 'object' && 'issues' in error) {
      const zodError = error as {
        issues: Array<{ path: (string | number)[]; message: string }>;
      };
      message = 'Invalid input parameters';
      details = {
        validationErrors: zodError.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      };
    } else if (error && typeof error === 'object' && 'errors' in error) {
      const validationError = error as { errors: unknown[] };
      details = { validationErrors: validationError.errors };
    }

    return {
      code: TodoistErrorCode.VALIDATION_ERROR,
      message,
      details,
      retryable: false,
    };
  }

  /**
   * Check if error is a network error
   */
  private isNetworkError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const candidate = this.toNetworkErrorLike(error);
    const message =
      typeof candidate.message === 'string' ? candidate.message : '';

    return (
      candidate.code === 'ECONNREFUSED' ||
      candidate.code === 'ENOTFOUND' ||
      candidate.code === 'ETIMEDOUT' ||
      candidate.code === 'ECONNRESET' ||
      candidate.name === 'NetworkError' ||
      message.includes('network') ||
      message.includes('timeout')
    );
  }

  /**
   * Convert network error to Todoist error format
   */
  private convertNetworkError(error: unknown): TodoistError {
    const candidate = this.toNetworkErrorLike(error);
    const message =
      typeof candidate.message === 'string'
        ? candidate.message
        : 'Network error occurred';

    return {
      code: TodoistErrorCode.NETWORK_ERROR,
      message: `Failed to connect to Todoist API: ${message}`,
      details: {
        networkErrorCode: candidate.code,
        originalMessage: message,
      },
      retryable: true,
      retry_after: 5, // Retry after 5 seconds for network errors
    };
  }

  /**
   * Convert unknown error to Todoist error format
   */
  private convertUnknownError(error: unknown): TodoistError {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';

    return {
      code: TodoistErrorCode.UNKNOWN_ERROR,
      message,
      details: {
        errorType: error?.constructor?.name || 'Unknown',
        originalError: this.config.environment.isDevelopment
          ? error
          : undefined,
      },
      retryable: false,
    };
  }

  private toNetworkErrorLike(error: unknown): {
    code?: string;
    name?: string;
    message?: unknown;
  } {
    if (!error || typeof error !== 'object') {
      return {};
    }

    const record = error as Record<string, unknown>;

    return {
      code: typeof record.code === 'string' ? record.code : undefined,
      name: typeof record.name === 'string' ? record.name : undefined,
      message: record.message,
    };
  }

  /**
   * Sanitize error for production environment
   */
  private sanitizeError(error: TodoistError): TodoistError {
    if (!this.config.logging.sanitizePersonalData) {
      return error;
    }

    // Remove potentially sensitive information
    const sanitizedError: TodoistError = {
      code: error.code,
      message: this.sanitizeMessage(error.message),
      retryable: error.retryable,
    };

    if (error.retry_after) {
      sanitizedError.retry_after = error.retry_after;
    }

    // Only include safe details
    if (error.details) {
      sanitizedError.details = this.sanitizeDetails(error.details);
    }

    return sanitizedError;
  }

  /**
   * Sanitize error message for production
   */
  private sanitizeMessage(message: string): string {
    // Remove potential API tokens, IDs, or personal information
    return message
      .replace(/token[:\s][\w-]+/gi, 'token: [REDACTED]')
      .replace(/id[:\s]\d+/gi, 'id: [REDACTED]')
      .replace(/\b\d{6,}\b/g, '[REDACTED]'); // Remove long numbers that might be IDs
  }

  /**
   * Sanitize error details for production
   */
  private sanitizeDetails(
    details: Record<string, unknown>
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(details)) {
      // Only include safe keys
      if (
        [
          'errorType',
          'retryAttempt',
          'statusCode',
          'validationErrors',
        ].includes(key)
      ) {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Log error with appropriate level and context
   */
  private logError(
    error: TodoistError,
    severity: ErrorSeverity,
    context: ErrorContext
  ): void {
    const logData = {
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        retry_after: error.retry_after,
      },
      severity,
      context: {
        correlationId: context.correlationId,
        toolName: context.toolName,
        action: context.action,
        operationTime: context.operationTime,
        retryAttempt: context.retryAttempt,
      },
    };

    switch (severity) {
      case ErrorSeverity.LOW:
        logger.debug('Low severity error', logData);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn('Medium severity error', logData);
        break;
      case ErrorSeverity.HIGH:
        logger.error('High severity error', logData);
        break;
      case ErrorSeverity.CRITICAL:
        logger.error('CRITICAL ERROR', logData);
        break;
    }
  }
}

/**
 * Convenience function to get error handler instance
 */
export const errorHandler = ErrorHandler.getInstance();

/**
 * Utility function for handling errors in async operations
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: ErrorContext = {}
): Promise<T | StandardErrorResponse> {
  try {
    return await operation();
  } catch (error) {
    return errorHandler.handleError(error, context);
  }
}
