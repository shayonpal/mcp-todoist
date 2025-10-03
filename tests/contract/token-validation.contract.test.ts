/**
 * Contract Test: Token Validation State Machine
 *
 * Tests FR-001, FR-002, FR-003, FR-008, FR-009 from spec.md
 * These tests MUST FAIL before implementation (TDD approach)
 *
 * @see /specs/006-more-mcp-compliance/contracts/token-validation.contract.ts
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { TokenValidator } from '../../src/services/token-validator.interface.js';
import {
  TokenErrorCategory,
  TOKEN_ERROR_MESSAGES,
} from '../../src/types/token-validation.types.js';
import { createInMemoryApiService } from '../helpers/inMemoryTodoistApiService.js';

describe('Token Validation State Machine Contract', () => {
  let originalToken: string | undefined;

  beforeEach(async () => {
    // Save original token
    originalToken = process.env.TODOIST_API_TOKEN;

    // Reset config cache
    const { resetConfig } = await import('../../src/config/index.js');
    resetConfig();

    // Reset singleton state for isolated tests
    const { TokenValidatorSingleton } = await import(
      '../../src/services/token-validator.js'
    );
    (TokenValidatorSingleton as any).resetForTesting();

    // Setup mock API service for all tests
    const mockApiService = createInMemoryApiService();
    (TokenValidatorSingleton as any).setMockApiService(mockApiService);
  });

  afterEach(() => {
    // Restore original token
    if (originalToken) {
      process.env.TODOIST_API_TOKEN = originalToken;
    } else {
      delete process.env.TODOIST_API_TOKEN;
    }
  });

  describe('FR-001: Server starts without token', () => {
    test('allows initialization without TODOIST_API_TOKEN', async () => {
      delete process.env.TODOIST_API_TOKEN;

      // This will fail until TokenValidator is implemented
      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );
      const validator: TokenValidator = TokenValidatorSingleton;

      const state = validator.getValidationState();
      expect(state.status).toBe('not_validated');
      expect(state.validatedAt).toBeNull();
      expect(state.error).toBeNull();
    });

    test('isTokenConfigured returns false when token missing', async () => {
      delete process.env.TODOIST_API_TOKEN;

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );
      const validator: TokenValidator = TokenValidatorSingleton;

      expect(validator.isTokenConfigured()).toBe(false);
    });

    test('isTokenConfigured returns true when token present', async () => {
      process.env.TODOIST_API_TOKEN = 'test_token_123456';

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );
      const validator: TokenValidator = TokenValidatorSingleton;

      expect(validator.isTokenConfigured()).toBe(true);
    });
  });

  describe('FR-002: MCP protocol handshake without token', () => {
    test('getValidationState never triggers validation', async () => {
      delete process.env.TODOIST_API_TOKEN;

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );
      const validator: TokenValidator = TokenValidatorSingleton;

      // Should not throw even without token
      const state = validator.getValidationState();
      expect(state.status).toBe('not_validated');
    });
  });

  describe('FR-003: Validation triggered on first tool call', () => {
    test('validateOnce throws TOKEN_MISSING when token absent', async () => {
      delete process.env.TODOIST_API_TOKEN;

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );
      const validator: TokenValidator = TokenValidatorSingleton;

      await expect(validator.validateOnce()).rejects.toThrow();

      const state = validator.getValidationState();
      expect(state.status).toBe('invalid');
      expect(state.error?.category).toBe(TokenErrorCategory.TOKEN_MISSING);
    });

    test('validateOnce succeeds with valid token', async () => {
      // This test will fail until TodoistApiService integration is complete
      process.env.TODOIST_API_TOKEN = 'valid_test_token';

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );
      const validator: TokenValidator = TokenValidatorSingleton;

      // Mock successful API response (implementation detail)
      await expect(validator.validateOnce()).resolves.not.toThrow();

      const state = validator.getValidationState();
      expect(state.status).toBe('valid');
      expect(state.validatedAt).toBeInstanceOf(Date);
      expect(state.error).toBeNull();
    });
  });

  describe('FR-008: Error message format "[Category]. [Next step]"', () => {
    test('TOKEN_MISSING error has actionable message', async () => {
      delete process.env.TODOIST_API_TOKEN;

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );
      const validator: TokenValidator = TokenValidatorSingleton;

      try {
        await validator.validateOnce();
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        const state = validator.getValidationState();
        expect(state.error?.message).toBe(
          TOKEN_ERROR_MESSAGES[TokenErrorCategory.TOKEN_MISSING]
        );
        expect(state.error?.message).toMatch(/^Token missing\./);
        expect(state.error?.message).toContain('Set TODOIST_API_TOKEN');
      }
    });

    test('All error categories follow format', () => {
      Object.values(TokenErrorCategory).forEach(category => {
        const message = TOKEN_ERROR_MESSAGES[category];
        expect(message).toMatch(/^[A-Za-z ]+\. [A-Z]/); // "[Category]. [Next step]"
      });
    });
  });

  describe('FR-009: Validation caching for session (Clarification Q1)', () => {
    test('validateOnce is idempotent - calls once only', async () => {
      process.env.TODOIST_API_TOKEN = 'valid_test_token';

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );
      const validator: TokenValidator = TokenValidatorSingleton;

      // First call validates
      await validator.validateOnce();

      const firstState = validator.getValidationState();
      const firstTimestamp = firstState.validatedAt;

      // Small delay to ensure different timestamps if re-validating
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second call should use cache
      await validator.validateOnce();

      const secondState = validator.getValidationState();
      expect(secondState.validatedAt).toEqual(firstTimestamp); // Same timestamp = cached
    });

    test('validateOnce caches validation failures', async () => {
      delete process.env.TODOIST_API_TOKEN;

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );
      const validator: TokenValidator = TokenValidatorSingleton;

      // First call fails
      await expect(validator.validateOnce()).rejects.toThrow();

      const firstError = validator.getValidationState().error;

      // Second call should throw same cached error
      await expect(validator.validateOnce()).rejects.toThrow();

      const secondError = validator.getValidationState().error;
      expect(secondError).toEqual(firstError); // Same error object = cached
    });

    test('cache hit performance <1ms', async () => {
      process.env.TODOIST_API_TOKEN = 'valid_test_token';

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );
      const validator: TokenValidator = TokenValidatorSingleton;

      // First call (will be slow due to API call)
      await validator.validateOnce();

      // Subsequent call should be <1ms
      const start = performance.now();
      await validator.validateOnce();
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1); // <1ms for cache hit
    });
  });

  describe('State transition rules', () => {
    test('not_validated → valid → (no transitions)', async () => {
      process.env.TODOIST_API_TOKEN = 'valid_test_token';

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );
      const validator: TokenValidator = TokenValidatorSingleton;

      // Initial state
      expect(validator.getValidationState().status).toBe('not_validated');

      // Transition to valid
      await validator.validateOnce();
      expect(validator.getValidationState().status).toBe('valid');

      // Should stay valid (no re-validation)
      await validator.validateOnce();
      expect(validator.getValidationState().status).toBe('valid');
    });

    test('not_validated → invalid → (no transitions)', async () => {
      delete process.env.TODOIST_API_TOKEN;

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );
      const validator: TokenValidator = TokenValidatorSingleton;

      // Initial state
      expect(validator.getValidationState().status).toBe('not_validated');

      // Transition to invalid
      await expect(validator.validateOnce()).rejects.toThrow();
      expect(validator.getValidationState().status).toBe('invalid');

      // Should stay invalid (no re-validation)
      await expect(validator.validateOnce()).rejects.toThrow();
      expect(validator.getValidationState().status).toBe('invalid');
    });
  });

  describe('Error metadata completeness', () => {
    test('includes timestamp when error occurs', async () => {
      delete process.env.TODOIST_API_TOKEN;

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );
      const validator: TokenValidator = TokenValidatorSingleton;

      await expect(validator.validateOnce()).rejects.toThrow();

      const state = validator.getValidationState();
      expect(state.error?.timestamp).toBeInstanceOf(Date);
    });

    test('validatedAt only set when status=valid', async () => {
      delete process.env.TODOIST_API_TOKEN;

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );
      const validator: TokenValidator = TokenValidatorSingleton;

      // Invalid state
      await expect(validator.validateOnce()).rejects.toThrow();
      expect(validator.getValidationState().validatedAt).toBeNull();
    });

    test('error only set when status=invalid', async () => {
      process.env.TODOIST_API_TOKEN = 'valid_test_token';

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );
      const validator: TokenValidator = TokenValidatorSingleton;

      // Valid state
      await validator.validateOnce();
      expect(validator.getValidationState().error).toBeNull();
    });
  });
});
