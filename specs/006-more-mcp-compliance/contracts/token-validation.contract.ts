/**
 * Contract: Token Validation Service Interface
 *
 * Defines the interface contract for deferred token validation in the MCP server.
 * This contract ensures that token validation is optional at startup and triggered
 * on-demand with session-based caching.
 *
 * Test implementation: tests/contract/token-validation.contract.test.ts
 */

export interface TokenValidationState {
  /** Current validation status */
  status: 'not_validated' | 'valid' | 'invalid';

  /** Timestamp when token was successfully validated (null if not validated or invalid) */
  validatedAt: Date | null;

  /** Error details if validation failed (null if not validated or valid) */
  error: TokenValidationError | null;
}

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

export enum TokenErrorCategory {
  /** TODOIST_API_TOKEN environment variable not set */
  TOKEN_MISSING = 'TOKEN_MISSING',

  /** Token format is incorrect or malformed */
  TOKEN_INVALID = 'TOKEN_INVALID',

  /** Todoist API returned 401 (invalid token) */
  AUTH_FAILED = 'AUTH_FAILED',

  /** Todoist API returned 403 (insufficient permissions) */
  PERMISSION_DENIED = 'PERMISSION_DENIED'
}

export interface TokenValidator {
  /**
   * Get current validation state without triggering validation
   *
   * @returns Current state (not_validated if never called, valid/invalid if cached)
   */
  getValidationState(): TokenValidationState;

  /**
   * Validate token if not already validated (idempotent)
   *
   * Behavior:
   * - If status is 'valid': return immediately (cached)
   * - If status is 'invalid': throw cached error immediately
   * - If status is 'not_validated': perform validation API call
   *
   * @throws {TokenValidationError} If token is missing, invalid, or authentication fails
   */
  validateOnce(): Promise<void>;

  /**
   * Check if token is configured (present in environment)
   *
   * @returns true if TODOIST_API_TOKEN is set (regardless of validity)
   */
  isTokenConfigured(): boolean;
}

/**
 * Contract: Health Check Response
 *
 * Defines the structure of health check responses that include token validation metadata
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
 * Contract: Configuration Interface
 *
 * Defines how configuration is loaded with nullable token support
 */
export interface ServerConfig {
  /** Todoist API token (nullable for deferred validation) */
  apiToken: string | null;

  /** Other configuration fields... */
  [key: string]: unknown;
}

/**
 * Contract Assertions (for testing)
 */

export const TokenValidationContract = {
  /**
   * Assert: Server can start without TODOIST_API_TOKEN
   * Maps to: FR-001, Acceptance Scenario 1
   */
  canStartWithoutToken: () => {
    // Test will verify server initialization succeeds when token is undefined/null
  },

  /**
   * Assert: Tool calls trigger validation on first invocation
   * Maps to: FR-003, Acceptance Scenario 2
   */
  validatesOnFirstToolCall: () => {
    // Test will verify validation occurs before first tool execution
  },

  /**
   * Assert: Successful validation is cached for session
   * Maps to: FR-009, Clarification Session 2025-10-02 Q1
   */
  cachesValidationForSession: () => {
    // Test will verify subsequent tool calls don't re-validate
  },

  /**
   * Assert: Invalid validation is cached and thrown immediately
   * Maps to: FR-005, Edge Case handling
   */
  cachesValidationFailure: () => {
    // Test will verify validation errors are persistent
  },

  /**
   * Assert: Health check works without token
   * Maps to: FR-007, Acceptance Scenario 6
   */
  healthCheckIndependentOfToken: () => {
    // Test will verify health check returns healthy + metadata
  },

  /**
   * Assert: Error messages follow actionable format
   * Maps to: FR-008, Clarification Session 2025-10-02 Q3
   */
  errorMessagesAreActionable: () => {
    // Test will verify message format: "[Category]. [Next step]"
  },

  /**
   * Assert: MCP protocol initialization works without token
   * Maps to: FR-002, Primary User Story
   */
  mcpProtocolIndependentOfToken: () => {
    // Test will verify list_tools, initialize handlers succeed
  }
} as const;

/**
 * Error Message Templates (for implementation reference)
 */
export const TOKEN_ERROR_MESSAGES: Record<TokenErrorCategory, string> = {
  [TokenErrorCategory.TOKEN_MISSING]:
    'Token missing. Set TODOIST_API_TOKEN environment variable',
  [TokenErrorCategory.TOKEN_INVALID]:
    'Token invalid. Verify token format',
  [TokenErrorCategory.AUTH_FAILED]:
    'Authentication failed. Verify token is valid at Todoist settings',
  [TokenErrorCategory.PERMISSION_DENIED]:
    'Permission denied. Token lacks required scopes'
} as const;
