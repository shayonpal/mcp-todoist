/**
 * Test Token Configuration
 *
 * Defines test token constants and validation behavior mappings.
 * This decouples production code from test-specific token handling.
 */

/**
 * Standard mock token for tests
 * Meets minimum length requirements (16-64 chars)
 */
export const MOCK_API_TOKEN = 'test_token_123456';

/**
 * Mock API configuration for tests
 */
export const MOCK_API_CONFIG = {
  token: MOCK_API_TOKEN,
  base_url: 'https://api.todoist.com/rest/v1',
  timeout: 10000,
  retry_attempts: 3,
};

/**
 * Test token behavior mappings
 * Maps specific test tokens to expected validation responses
 */
export const TEST_TOKEN_BEHAVIORS: Record<
  string,
  { status: number; message: string }
> = {
  invalid_token_returns_401: {
    status: 401,
    message: 'Invalid or expired Todoist API token',
  },
  token_with_insufficient_permissions: {
    status: 403,
    message: 'Token lacks required scopes',
  },
};

/**
 * Check if a token is a test token with special behavior
 */
export function isTestTokenWithBehavior(token: string): boolean {
  return token in TEST_TOKEN_BEHAVIORS;
}

/**
 * Get validation behavior for a test token
 */
export function getTestTokenBehavior(
  token: string
): { status: number; message: string } | null {
  return TEST_TOKEN_BEHAVIORS[token] || null;
}
