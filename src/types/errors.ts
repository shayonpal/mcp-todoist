/**
 * Error type definitions and MCP error mapping
 * Based on research.md error mapping strategy and MCP protocol requirements
 */

/**
 * Domain-specific error codes for Todoist operations
 */
export enum TodoistErrorCode {
  // Authentication & Authorization
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SYNC_LIMIT_EXCEEDED = 'SYNC_LIMIT_EXCEEDED',

  // Resource Errors
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_DELETED = 'RESOURCE_DELETED',

  // Validation Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST_FORMAT = 'INVALID_REQUEST_FORMAT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  FIELD_VALUE_TOO_LONG = 'FIELD_VALUE_TOO_LONG',

  // Operation Errors
  SYNC_ERROR = 'SYNC_ERROR',
  BATCH_PARTIAL_FAILURE = 'BATCH_PARTIAL_FAILURE',
  OPERATION_NOT_SUPPORTED = 'OPERATION_NOT_SUPPORTED',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION',

  // Network & Infrastructure
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Structured error information for Todoist operations
 */
export interface TodoistError {
  code: TodoistErrorCode;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
  retry_after?: number; // Seconds to wait before retry
  http_status?: number;
  correlation_id?: string;
}

/**
 * MCP-compliant error response structure
 */
export interface MCPError {
  code: number;
  message: string;
  data?: {
    todoist_error_code: TodoistErrorCode;
    details?: Record<string, any>;
    retry_after?: number;
    correlation_id?: string;
  };
}

/**
 * Batch operation error details
 */
export interface BatchOperationError {
  command_index: number;
  temp_id?: string;
  error: TodoistError;
}

/**
 * Batch operation result with partial failures
 */
export interface BatchOperationResult {
  success: boolean;
  completed_commands: number;
  failed_commands: number;
  errors: BatchOperationError[];
  temp_id_mapping: Record<string, string>;
}

/**
 * Custom error classes for different error categories
 */

export class TodoistAPIError extends Error {
  constructor(
    public readonly errorCode: TodoistErrorCode,
    message: string,
    public readonly details?: Record<string, any>,
    public readonly retryable: boolean = false,
    public readonly retryAfter?: number,
    public readonly httpStatus?: number,
    public readonly correlationId?: string
  ) {
    super(message);
    this.name = 'TodoistAPIError';
    Object.setPrototypeOf(this, TodoistAPIError.prototype);
  }

  toTodoistError(): TodoistError {
    return {
      code: this.errorCode,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
      retry_after: this.retryAfter,
      http_status: this.httpStatus,
      correlation_id: this.correlationId,
    };
  }
}

export class ValidationError extends TodoistAPIError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      TodoistErrorCode.VALIDATION_ERROR,
      message,
      details,
      false, // Validation errors are not retryable
      undefined,
      400
    );
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class AuthenticationError extends TodoistAPIError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      TodoistErrorCode.INVALID_TOKEN,
      message,
      details,
      false, // Auth errors are not retryable
      undefined,
      401
    );
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class RateLimitError extends TodoistAPIError {
  constructor(
    message: string,
    retryAfter?: number,
    details?: Record<string, any>
  ) {
    super(
      TodoistErrorCode.RATE_LIMIT_EXCEEDED,
      message,
      details,
      true, // Rate limit errors are retryable
      retryAfter,
      429
    );
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class NotFoundError extends TodoistAPIError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      TodoistErrorCode.RESOURCE_NOT_FOUND,
      message,
      details,
      false, // Not found errors are not retryable
      undefined,
      404
    );
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class NetworkError extends TodoistAPIError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      TodoistErrorCode.NETWORK_ERROR,
      message,
      details,
      true, // Network errors are retryable
      undefined,
      undefined
    );
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

export class ServiceUnavailableError extends TodoistAPIError {
  constructor(
    message: string,
    retryAfter?: number,
    details?: Record<string, any>
  ) {
    super(
      TodoistErrorCode.SERVICE_UNAVAILABLE,
      message,
      details,
      true, // Service unavailable errors are retryable
      retryAfter,
      503
    );
    this.name = 'ServiceUnavailableError';
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

/**
 * MCP Error Codes (standard JSON-RPC 2.0 error codes)
 */
export enum MCPErrorCode {
  // Standard JSON-RPC 2.0 errors
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,

  // MCP-specific errors
  TOOL_NOT_FOUND = -32000,
  RESOURCE_NOT_FOUND = -32001,
  AUTHENTICATION_REQUIRED = -32002,
  PERMISSION_DENIED = -32003,
  RATE_LIMITED = -32004,
  OPERATION_CANCELLED = -32005,
}

/**
 * Maps Todoist errors to MCP-compliant error responses
 */
export function mapToMCPError(error: TodoistAPIError | Error): MCPError {
  if (error instanceof TodoistAPIError) {
    const mcpCode = getMCPErrorCode(error.errorCode);

    return {
      code: mcpCode,
      message: error.message,
      data: {
        todoist_error_code: error.errorCode,
        details: error.details,
        retry_after: error.retryAfter,
        correlation_id: error.correlationId,
      },
    };
  }

  // Handle generic errors
  return {
    code: MCPErrorCode.INTERNAL_ERROR,
    message: error.message || 'An unexpected error occurred',
    data: {
      todoist_error_code: TodoistErrorCode.UNKNOWN_ERROR,
      details: { original_error: error.name },
    },
  };
}

/**
 * Maps Todoist error codes to appropriate MCP error codes
 */
function getMCPErrorCode(todoistErrorCode: TodoistErrorCode): MCPErrorCode {
  switch (todoistErrorCode) {
    case TodoistErrorCode.INVALID_TOKEN:
    case TodoistErrorCode.TOKEN_EXPIRED:
      return MCPErrorCode.AUTHENTICATION_REQUIRED;

    case TodoistErrorCode.INSUFFICIENT_PERMISSIONS:
      return MCPErrorCode.PERMISSION_DENIED;

    case TodoistErrorCode.RATE_LIMIT_EXCEEDED:
    case TodoistErrorCode.SYNC_LIMIT_EXCEEDED:
      return MCPErrorCode.RATE_LIMITED;

    case TodoistErrorCode.RESOURCE_NOT_FOUND:
      return MCPErrorCode.RESOURCE_NOT_FOUND;

    case TodoistErrorCode.VALIDATION_ERROR:
    case TodoistErrorCode.INVALID_REQUEST_FORMAT:
    case TodoistErrorCode.MISSING_REQUIRED_FIELD:
    case TodoistErrorCode.FIELD_VALUE_TOO_LONG:
      return MCPErrorCode.INVALID_PARAMS;

    case TodoistErrorCode.OPERATION_NOT_SUPPORTED:
      return MCPErrorCode.METHOD_NOT_FOUND;

    default:
      return MCPErrorCode.INTERNAL_ERROR;
  }
}

/**
 * Creates a user-friendly error message for MCP clients
 */
export function createUserFriendlyMessage(
  errorCode: TodoistErrorCode,
  originalMessage: string
): string {
  const messageMap: Record<TodoistErrorCode, string> = {
    [TodoistErrorCode.INVALID_TOKEN]:
      'Invalid Todoist API token. Please check your configuration.',
    [TodoistErrorCode.TOKEN_EXPIRED]:
      'Your Todoist API token has expired. Please generate a new one.',
    [TodoistErrorCode.RATE_LIMIT_EXCEEDED]:
      'Rate limit exceeded. Please wait before making more requests.',
    [TodoistErrorCode.RESOURCE_NOT_FOUND]:
      'The requested resource was not found.',
    [TodoistErrorCode.VALIDATION_ERROR]: 'The request contains invalid data.',
    [TodoistErrorCode.NETWORK_ERROR]:
      'Network connection failed. Please check your internet connection.',
    [TodoistErrorCode.SERVICE_UNAVAILABLE]:
      'Todoist service is temporarily unavailable.',
    [TodoistErrorCode.BATCH_PARTIAL_FAILURE]:
      'Some operations in the batch failed.',
    [TodoistErrorCode.SYNC_ERROR]: 'Synchronization with Todoist failed.',
    [TodoistErrorCode.OPERATION_NOT_SUPPORTED]:
      'This operation is not supported.',
    [TodoistErrorCode.TIMEOUT_ERROR]: 'Request timed out. Please try again.',
    [TodoistErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred.',
    [TodoistErrorCode.INSUFFICIENT_PERMISSIONS]:
      'Insufficient permissions for this operation.',
    [TodoistErrorCode.RESOURCE_ALREADY_EXISTS]: 'The resource already exists.',
    [TodoistErrorCode.RESOURCE_DELETED]: 'The resource has been deleted.',
    [TodoistErrorCode.INVALID_REQUEST_FORMAT]: 'The request format is invalid.',
    [TodoistErrorCode.MISSING_REQUIRED_FIELD]: 'A required field is missing.',
    [TodoistErrorCode.FIELD_VALUE_TOO_LONG]:
      'A field value exceeds the maximum length.',
    [TodoistErrorCode.CONCURRENT_MODIFICATION]:
      'The resource was modified by another operation.',
    [TodoistErrorCode.SYNC_LIMIT_EXCEEDED]: 'Sync operation limit exceeded.',
  };

  return messageMap[errorCode] || originalMessage;
}
