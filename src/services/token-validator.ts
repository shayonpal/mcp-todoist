/**
 * Token Validator Singleton
 *
 * Implements deferred API token validation with session-based caching.
 * Validation is triggered on first tool invocation and cached for the server lifetime.
 *
 * @see /specs/006-more-mcp-compliance/contracts/token-validation.contract.ts
 * @see /specs/006-more-mcp-compliance/research.md
 */

import { getConfig } from '../config/index.js';
import { TodoistApiService } from './todoist-api.js';
import { TokenValidator } from './token-validator.interface.js';
import {
  TokenValidationState,
  TokenValidationError,
  TokenErrorCategory,
  TOKEN_ERROR_MESSAGES,
} from '../types/token-validation.types.js';
import { logger } from '../middleware/logging.js';

// Token format validation constants
const MIN_TOKEN_LENGTH = 16;
const MAX_TOKEN_LENGTH = 64;
const TOKEN_FORMAT_REGEX = new RegExp(
  `^[A-Za-z0-9_-]{${MIN_TOKEN_LENGTH},${MAX_TOKEN_LENGTH}}$`
);

/**
 * Custom error class for token validation failures
 */
class TokenValidationException extends Error {
  constructor(public readonly validationError: TokenValidationError) {
    super(validationError.message);
    this.name = 'TokenValidationException';
  }
}

/**
 * Singleton implementation of TokenValidator
 *
 * State transitions:
 * - not_validated → valid (successful API call)
 * - not_validated → invalid (validation failure)
 * - valid → (no transitions) [cached]
 * - invalid → (no transitions) [persisted]
 */
class TokenValidatorSingletonImpl implements TokenValidator {
  private validationState: TokenValidationState = {
    status: 'not_validated',
    validatedAt: null,
    error: null,
  };

  private apiService: TodoistApiService | null = null;

  /**
   * Reset validation state (for testing purposes only)
   * @internal
   */
  resetForTesting(): void {
    this.validationState = {
      status: 'not_validated',
      validatedAt: null,
      error: null,
    };
    this.apiService = null;
  }

  /**
   * Set a mock API service for testing
   * @internal
   */
  setMockApiService(mockService: TodoistApiService | null): void {
    this.apiService = mockService;
  }

  /**
   * Get current validation state without triggering validation
   */
  getValidationState(): TokenValidationState {
    return { ...this.validationState }; // Return copy to prevent external mutation
  }

  /**
   * Check if token is configured (present in environment)
   */
  isTokenConfigured(): boolean {
    // Check environment directly to avoid config caching issues in tests
    const token = process.env.TODOIST_API_TOKEN;
    return token !== null && token !== undefined && token.trim().length > 0;
  }

  /**
   * Validate token if not already validated (idempotent)
   *
   * Performance:
   * - First call: ~100ms (API call to Todoist)
   * - Cached valid: <1ms (in-memory state check)
   * - Cached invalid: <1ms (throw cached error)
   *
   * @throws {TokenValidationException} If token is missing, invalid, or authentication fails
   */
  async validateOnce(): Promise<void> {
    // Fast path: Already validated successfully
    if (this.validationState.status === 'valid') {
      return;
    }

    // Fast path: Validation already failed (throw cached error)
    if (
      this.validationState.status === 'invalid' &&
      this.validationState.error
    ) {
      throw new TokenValidationException(this.validationState.error);
    }

    // Slow path: Perform validation
    try {
      await this.performValidation();
    } catch (error) {
      // If validation already set the error state, re-throw
      if (
        this.validationState.status === 'invalid' &&
        this.validationState.error
      ) {
        throw new TokenValidationException(this.validationState.error);
      }
      throw error; // Unexpected error
    }
  }

  /**
   * Perform actual token validation via Todoist API
   */
  private async performValidation(): Promise<void> {
    const config = getConfig();
    const token = config.token;

    // Check 1: Token presence
    if (!token) {
      const error = this.createValidationError(
        TokenErrorCategory.TOKEN_MISSING
      );

      this.validationState = {
        status: 'invalid',
        validatedAt: null,
        error,
      };

      logger.error('Token validation failed: TOKEN_MISSING', {
        category: error.category,
      });

      throw new TokenValidationException(error);
    }

    // Check 2: Basic token format validation
    if (!this.isTokenFormatValid(token)) {
      const error = this.createValidationError(
        TokenErrorCategory.TOKEN_INVALID
      );

      this.validationState = {
        status: 'invalid',
        validatedAt: null,
        error,
      };

      logger.error('Token validation failed: TOKEN_INVALID', {
        category: error.category,
      });

      throw new TokenValidationException(error);
    }

    // Check 3: API validation - lightweight call to verify token works
    try {
      // Initialize API service if not already done
      if (!this.apiService) {
        this.apiService = new TodoistApiService(config);
      }

      this.configureMockValidationBehavior(token);

      logger.info('Performing token validation via Todoist API');

      // Use validateToken() method which bypasses ensureToken() to avoid circular dependency
      // This validates both token existence and basic permissions
      await this.apiService.validateToken();

      // Validation successful
      const validatedAt = new Date();
      this.validationState = {
        status: 'valid',
        validatedAt,
        error: null,
      };

      logger.info('Token validated successfully', {
        validatedAt: validatedAt.toISOString(),
      });
    } catch (apiError: unknown) {
      // Map API error to token validation error
      const error = this.mapApiErrorToValidationError(apiError);

      this.validationState = {
        status: 'invalid',
        validatedAt: null,
        error,
      };

      logger.error('Token validation failed via API', {
        category: error.category,
        apiStatusCode: error.details?.apiStatusCode,
      });

      throw new TokenValidationException(error);
    }
  }

  /**
   * Map Todoist API errors to token validation errors
   */
  private mapApiErrorToValidationError(
    apiError: unknown
  ): TokenValidationError {
    // Type guard for error objects
    const isErrorLike = (
      error: unknown
    ): error is {
      response?: { status?: number };
      status?: number;
      message?: string;
    } => {
      return typeof error === 'object' && error !== null;
    };

    // Check for HTTP status codes
    let statusCode: number | undefined;
    let errorMessage = 'Unknown error';

    if (isErrorLike(apiError)) {
      statusCode = apiError.response?.status || apiError.status;
      errorMessage = apiError.message || 'Unknown error';
    }

    if (statusCode === 401) {
      return this.createValidationError(TokenErrorCategory.AUTH_FAILED, {
        apiStatusCode: 401,
        apiError: errorMessage,
      });
    }

    if (statusCode === 403) {
      return this.createValidationError(TokenErrorCategory.PERMISSION_DENIED, {
        apiStatusCode: 403,
        apiError: errorMessage,
      });
    }

    // Default to TOKEN_INVALID for other errors
    return this.createValidationError(TokenErrorCategory.TOKEN_INVALID, {
      apiStatusCode: statusCode,
      apiError: errorMessage,
    });
  }

  private isTokenFormatValid(token: string): boolean {
    return TOKEN_FORMAT_REGEX.test(token);
  }

  private createValidationError(
    category: TokenErrorCategory,
    details?: TokenValidationError['details']
  ): TokenValidationError {
    return {
      category,
      message: TOKEN_ERROR_MESSAGES[category],
      timestamp: new Date(),
      details,
    };
  }

  private configureMockValidationBehavior(token: string): void {
    if (!this.apiService) {
      return;
    }

    // Use duck typing to detect mock API service
    const mockApiService = this.apiService as unknown as {
      setValidationBehavior?: (
        behavior: 'succeed' | 'fail' | 'throw',
        error?: Error
      ) => void;
      validationBehavior?: 'succeed' | 'fail' | 'throw';
      configureTokenBehavior?: (token: string) => void;
    };

    // Not a mock service - skip configuration
    if (typeof mockApiService.setValidationBehavior !== 'function') {
      return;
    }

    // Respect explicit overrides configured in tests
    if (
      mockApiService.validationBehavior &&
      mockApiService.validationBehavior !== 'succeed'
    ) {
      return;
    }

    // Delegate token-based behavior configuration to the mock service
    // This decouples production code from test-specific token mappings
    if (typeof mockApiService.configureTokenBehavior === 'function') {
      mockApiService.configureTokenBehavior(token);
    } else {
      // Fallback: Default to success for unknown tokens
      mockApiService.setValidationBehavior('succeed');
    }
  }
}

/**
 * Singleton instance
 * Export as const to ensure single instance across entire application
 */
export const TokenValidatorSingleton: TokenValidator =
  new TokenValidatorSingletonImpl();
