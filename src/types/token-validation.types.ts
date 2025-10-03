/**
 * Token validation state management types
 *
 * These types support deferred API token validation for MCP platform compatibility.
 * Token validation is optional at startup and triggered on-demand with session-based caching.
 *
 * @see /specs/006-more-mcp-compliance/contracts/token-validation.contract.ts
 */

/**
 * Runtime status of API token validation for the server session
 *
 * Lifecycle: Created at server startup (initial state: `not_validated`),
 * transitions on first tool call, persists until server termination
 */
export interface TokenValidationState {
  /** Current validation status */
  status: 'not_validated' | 'valid' | 'invalid';

  /** Timestamp when token was successfully validated (null if not validated or invalid) */
  validatedAt: Date | null;

  /** Error details if validation failed (null if not validated or valid) */
  error: TokenValidationError | null;
}

/**
 * Structured error information for token validation failures
 */
export interface TokenValidationError {
  /** Error category for classification */
  category: TokenErrorCategory;

  /** User-facing error message in format "[Category]. [Next step]" */
  message: string;

  /** When the error occurred */
  timestamp: Date;

  /** Optional diagnostic details */
  details?: {
    apiStatusCode?: number;
    apiError?: string;
  };
}

/**
 * Error classification for token validation failures
 */
export enum TokenErrorCategory {
  /** TODOIST_API_TOKEN environment variable not set */
  TOKEN_MISSING = 'TOKEN_MISSING',

  /** Token format is incorrect or malformed */
  TOKEN_INVALID = 'TOKEN_INVALID',

  /** Todoist API returned 401 (invalid token) */
  AUTH_FAILED = 'AUTH_FAILED',

  /** Todoist API returned 403 (insufficient permissions) */
  PERMISSION_DENIED = 'PERMISSION_DENIED',
}

/**
 * Structured health check response payload including token validation state
 */
export interface HealthCheckResponse {
  /** Overall server health status (always 'healthy' if server is running) */
  status: 'healthy';

  /** When the health check was performed */
  timestamp: string; // ISO 8601

  /** Component-level health breakdown */
  components: {
    server: {
      status: 'operational';
    };
    tokenValidation: {
      /** Token validation state */
      status: 'not_configured' | 'configured' | 'valid' | 'invalid';

      /** When token was validated (only present if status='valid') */
      validatedAt?: string; // ISO 8601
    };
  };
}

/**
 * Error message templates for token validation failures
 *
 * Format: "[Category]. [Next step]"
 */
export const TOKEN_ERROR_MESSAGES: Record<TokenErrorCategory, string> = {
  [TokenErrorCategory.TOKEN_MISSING]:
    'Token missing. Set TODOIST_API_TOKEN environment variable',
  [TokenErrorCategory.TOKEN_INVALID]: 'Token invalid. Verify token format',
  [TokenErrorCategory.AUTH_FAILED]:
    'Authentication failed. Verify token is valid at Todoist settings',
  [TokenErrorCategory.PERMISSION_DENIED]:
    'Permission denied. Token lacks required scopes',
} as const;
