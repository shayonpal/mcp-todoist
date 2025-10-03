/**
 * Integration Test: Token Validation Lifecycle
 *
 * Tests full lifecycle flows combining multiple features
 * These tests MUST FAIL before implementation (TDD approach)
 *
 * Covers all 9 scenarios from quickstart.md
 *
 * @see /specs/006-more-mcp-compliance/quickstart.md
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { TokenErrorCategory } from '../../src/types/token-validation.types.js';

describe('Token Validation Lifecycle Integration', () => {
  let originalToken: string | undefined;

  beforeEach(() => {
    originalToken = process.env.TODOIST_API_TOKEN;
  });

  afterEach(() => {
    if (originalToken) {
      process.env.TODOIST_API_TOKEN = originalToken;
    } else {
      delete process.env.TODOIST_API_TOKEN;
    }
  });

  describe('Full lifecycle: startup → list_tools → tool call → caching → health check', () => {
    test('completes full happy path workflow', async () => {
      process.env.TODOIST_API_TOKEN = 'valid_test_token';

      // Step 1: Server starts
      const { TodoistMCPServer } = await import('../../src/server.js');
      const server = new TodoistMCPServer();
      expect(server).toBeDefined();

      // Step 2: list_tools succeeds without validation
      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );
      let state = TokenValidatorSingleton.getValidationState();
      expect(state.status).toBe('not_validated');

      // Step 3: First tool call triggers validation
      // (This will fail until implementation is complete)
      const tasksTool = await import('../../src/tools/todoist-tasks.js');
      const tool = new tasksTool.TodoistTasksTool({
        apiToken: 'valid_test_token',
        timeout: 10000,
        retry_attempts: 3,
        base_url: 'https://api.todoist.com/rest/v1',
      });

      await tool.execute({ action: 'list' });

      state = TokenValidatorSingleton.getValidationState();
      expect(state.status).toBe('valid');
      expect(state.validatedAt).toBeInstanceOf(Date);

      // Step 4: Second tool call uses cached validation
      const firstValidatedAt = state.validatedAt;
      await tool.execute({ action: 'list' });

      state = TokenValidatorSingleton.getValidationState();
      expect(state.validatedAt).toEqual(firstValidatedAt); // Same timestamp = cached

      // Step 5: Health check reflects validated state
      const healthResponse = await server.healthCheck();
      expect(healthResponse.status).toBe('healthy');
    });
  });

  describe('Edge case: Token removal mid-session', () => {
    test('cached validation persists after token removal', async () => {
      process.env.TODOIST_API_TOKEN = 'valid_test_token';

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );

      // Validate token
      await TokenValidatorSingleton.validateOnce();
      const state = TokenValidatorSingleton.getValidationState();
      expect(state.status).toBe('valid');

      // Remove token from environment
      delete process.env.TODOIST_API_TOKEN;

      // Validation state should still be valid (cached)
      const stateAfterRemoval = TokenValidatorSingleton.getValidationState();
      expect(stateAfterRemoval.status).toBe('valid');

      // Subsequent tool calls should still work (edge case documented in spec)
      await expect(
        TokenValidatorSingleton.validateOnce()
      ).resolves.not.toThrow();
    });
  });

  describe('Edge case: Invalid token after valid startup', () => {
    test('detects token change only on server restart', async () => {
      process.env.TODOIST_API_TOKEN = 'valid_test_token';

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );

      // Validate with valid token
      await TokenValidatorSingleton.validateOnce();
      expect(TokenValidatorSingleton.getValidationState().status).toBe('valid');

      // Change to invalid token mid-session
      process.env.TODOIST_API_TOKEN = 'invalid_token';

      // Cached validation persists (not re-validated)
      expect(TokenValidatorSingleton.getValidationState().status).toBe('valid');
    });
  });

  describe('All 4 error categories', () => {
    test('TOKEN_MISSING category', async () => {
      delete process.env.TODOIST_API_TOKEN;

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );

      await expect(TokenValidatorSingleton.validateOnce()).rejects.toThrow();

      const state = TokenValidatorSingleton.getValidationState();
      expect(state.error?.category).toBe(TokenErrorCategory.TOKEN_MISSING);
      expect(state.error?.message).toContain('Set TODOIST_API_TOKEN');
    });

    test('TOKEN_INVALID category (malformed token)', async () => {
      process.env.TODOIST_API_TOKEN = 'malformed@token#123';

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );

      // This will fail until validation logic handles format errors
      await expect(TokenValidatorSingleton.validateOnce()).rejects.toThrow();

      const state = TokenValidatorSingleton.getValidationState();
      expect([
        TokenErrorCategory.TOKEN_INVALID,
        TokenErrorCategory.AUTH_FAILED,
      ]).toContain(state.error?.category);
    });

    test('AUTH_FAILED category (401 from API)', async () => {
      process.env.TODOIST_API_TOKEN = 'invalid_token_returns_401';

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );

      await expect(TokenValidatorSingleton.validateOnce()).rejects.toThrow();

      const state = TokenValidatorSingleton.getValidationState();
      expect(state.error?.category).toBe(TokenErrorCategory.AUTH_FAILED);
      expect(state.error?.message).toContain('Verify token is valid');
      expect(state.error?.details?.apiStatusCode).toBe(401);
    });

    test('PERMISSION_DENIED category (403 from API)', async () => {
      process.env.TODOIST_API_TOKEN = 'token_with_insufficient_permissions';

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );

      await expect(TokenValidatorSingleton.validateOnce()).rejects.toThrow();

      const state = TokenValidatorSingleton.getValidationState();
      expect(state.error?.category).toBe(TokenErrorCategory.PERMISSION_DENIED);
      expect(state.error?.message).toContain('lacks required scopes');
      expect(state.error?.details?.apiStatusCode).toBe(403);
    });
  });

  describe('Performance requirements', () => {
    test('validation completes in <100ms', async () => {
      process.env.TODOIST_API_TOKEN = 'valid_test_token';

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );

      const start = performance.now();
      await TokenValidatorSingleton.validateOnce();
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    test('cache hit completes in <1ms', async () => {
      process.env.TODOIST_API_TOKEN = 'valid_test_token';

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );

      // First call (slow)
      await TokenValidatorSingleton.validateOnce();

      // Second call (fast - cached)
      const start = performance.now();
      await TokenValidatorSingleton.validateOnce();
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1);
    });

    test('server startup <10ms without token', async () => {
      delete process.env.TODOIST_API_TOKEN;

      const start = performance.now();
      const { TodoistMCPServer } = await import('../../src/server.js');
      const server = new TodoistMCPServer();
      const duration = performance.now() - start;

      expect(server).toBeDefined();
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Backward compatibility', () => {
    test('servers with token at startup work identically', async () => {
      process.env.TODOIST_API_TOKEN = 'valid_test_token';

      // Server should start successfully
      const { TodoistMCPServer } = await import('../../src/server.js');
      const server = new TodoistMCPServer();
      expect(server).toBeDefined();

      // Tools should work without explicit validation call
      const tasksTool = await import('../../src/tools/todoist-tasks.js');
      const tool = new tasksTool.TodoistTasksTool({
        apiToken: 'valid_test_token',
        timeout: 10000,
        retry_attempts: 3,
        base_url: 'https://api.todoist.com/rest/v1',
      });

      const result = await tool.execute({ action: 'list' });
      expect(result.success).toBe(true);
    });
  });

  describe('Session-based caching behavior', () => {
    test('validation persists across multiple tool types', async () => {
      process.env.TODOIST_API_TOKEN = 'valid_test_token';

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );

      // Validate via tasks tool
      const tasksTool = await import('../../src/tools/todoist-tasks.js');
      const tasks = new tasksTool.TodoistTasksTool({
        apiToken: 'valid_test_token',
        timeout: 10000,
        retry_attempts: 3,
        base_url: 'https://api.todoist.com/rest/v1',
      });
      await tasks.execute({ action: 'list' });

      const firstTimestamp =
        TokenValidatorSingleton.getValidationState().validatedAt;

      // Use projects tool (should use cached validation)
      const projectsTool = await import('../../src/tools/todoist-projects.js');
      const projects = new projectsTool.TodoistProjectsTool({
        apiToken: 'valid_test_token',
        timeout: 10000,
        retry_attempts: 3,
        base_url: 'https://api.todoist.com/rest/v1',
      });
      await projects.execute({ action: 'list' });

      const secondTimestamp =
        TokenValidatorSingleton.getValidationState().validatedAt;

      expect(secondTimestamp).toEqual(firstTimestamp); // Same validation used
    });

    test('failed validation cached across multiple attempts', async () => {
      delete process.env.TODOIST_API_TOKEN;

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );

      // First failure
      await expect(TokenValidatorSingleton.validateOnce()).rejects.toThrow();
      const firstError = TokenValidatorSingleton.getValidationState().error;

      // Second attempt should use cached error
      await expect(TokenValidatorSingleton.validateOnce()).rejects.toThrow();
      const secondError = TokenValidatorSingleton.getValidationState().error;

      expect(secondError?.timestamp).toEqual(firstError?.timestamp); // Same error cached
    });
  });
});
