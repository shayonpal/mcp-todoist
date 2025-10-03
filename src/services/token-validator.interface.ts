/**
 * Token Validator Interface Contract
 *
 * Defines the interface contract for deferred token validation in the MCP server.
 * This contract ensures that token validation is optional at startup and triggered
 * on-demand with session-based caching.
 *
 * @see /specs/006-more-mcp-compliance/contracts/token-validation.contract.ts
 */

import { TokenValidationState } from '../types/token-validation.types.js';

/**
 * Token validator interface for deferred API token validation
 *
 * Implementation must use singleton pattern with lazy initialization:
 * - Single validation state across server lifetime
 * - Validation deferred until first tool invocation
 * - Successful validation cached for session (no re-validation)
 * - Failed validation cached to avoid repeated API calls
 */
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
   * Performance:
   * - First call: ~100ms (API call to Todoist)
   * - Cached calls: <1ms (in-memory state check)
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
