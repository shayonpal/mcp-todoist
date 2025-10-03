/**
 * Contract Test: Health Check Metadata
 *
 * Tests FR-007 from spec.md
 * These tests MUST FAIL before implementation (TDD approach)
 *
 * @see /specs/006-more-mcp-compliance/contracts/token-validation.contract.ts
 */

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { HealthCheckResponse } from '../../src/types/token-validation.types.js';
import { createInMemoryApiService } from '../helpers/inMemoryTodoistApiService.js';

describe('Health Check Metadata Contract', () => {
  let originalToken: string | undefined;

  beforeEach(async () => {
    // Save original token
    originalToken = process.env.TODOIST_API_TOKEN;

    // Clear Jest module cache to ensure fresh imports
    jest.resetModules();

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

  describe('FR-007: Health check works without token', () => {
    test('returns 200 OK when token missing', async () => {
      delete process.env.TODOIST_API_TOKEN;

      const { TodoistMCPServer } = await import('../../src/server.js');
      const server = new TodoistMCPServer();

      // This will fail until health check is updated
      const response = await server.healthCheck();

      expect(response.status).toBe('healthy');
    });

    test('returns 200 OK when token invalid', async () => {
      process.env.TODOIST_API_TOKEN = 'invalid_token_12345';

      const { TodoistMCPServer } = await import('../../src/server.js');
      const server = new TodoistMCPServer();

      const response = await server.healthCheck();

      expect(response.status).toBe('healthy');
    });

    test('health check never triggers token validation', async () => {
      delete process.env.TODOIST_API_TOKEN;

      const { TodoistMCPServer } = await import('../../src/server.js');
      const server = new TodoistMCPServer();

      // Should not attempt to validate token
      await server.healthCheck();

      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );
      const state = TokenValidatorSingleton.getValidationState();

      // Validation state should still be not_validated
      expect(state.status).toBe('not_validated');
    });
  });

  describe('Health check response structure', () => {
    test('follows HealthCheckResponse interface', async () => {
      delete process.env.TODOIST_API_TOKEN;

      const { TodoistMCPServer } = await import('../../src/server.js');
      const server = new TodoistMCPServer();

      const response =
        (await server.healthCheck()) as unknown as HealthCheckResponse;

      expect(response).toHaveProperty('status', 'healthy');
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('components');
      expect(response.components).toHaveProperty('server');
      expect(response.components).toHaveProperty('tokenValidation');
    });

    test('includes server operational status', async () => {
      delete process.env.TODOIST_API_TOKEN;

      const { TodoistMCPServer } = await import('../../src/server.js');
      const server = new TodoistMCPServer();

      const response =
        (await server.healthCheck()) as unknown as HealthCheckResponse;

      expect(response.components.server.status).toBe('operational');
    });

    test('timestamp is ISO 8601 format', async () => {
      delete process.env.TODOIST_API_TOKEN;

      const { TodoistMCPServer } = await import('../../src/server.js');
      const server = new TodoistMCPServer();

      const response =
        (await server.healthCheck()) as unknown as HealthCheckResponse;

      expect(response.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });
  });

  describe('tokenValidation status mapping', () => {
    test('status=not_configured when token missing', async () => {
      delete process.env.TODOIST_API_TOKEN;

      const { TodoistMCPServer } = await import('../../src/server.js');
      const server = new TodoistMCPServer();

      const response =
        (await server.healthCheck()) as unknown as HealthCheckResponse;

      expect(response.components.tokenValidation.status).toBe('not_configured');
      expect(response.components.tokenValidation.validatedAt).toBeUndefined();
    });

    test('status=configured when token present but not validated', async () => {
      process.env.TODOIST_API_TOKEN = 'test_token';

      const { TodoistMCPServer } = await import('../../src/server.js');
      const server = new TodoistMCPServer();

      const response =
        (await server.healthCheck()) as unknown as HealthCheckResponse;

      expect(response.components.tokenValidation.status).toBe('configured');
      expect(response.components.tokenValidation.validatedAt).toBeUndefined();
    });

    test('status=valid when token validated successfully', async () => {
      process.env.TODOIST_API_TOKEN = 'valid_test_token';

      // First validate the token
      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );
      await TokenValidatorSingleton.validateOnce();

      const { TodoistMCPServer } = await import('../../src/server.js');
      const server = new TodoistMCPServer();

      const response =
        (await server.healthCheck()) as unknown as HealthCheckResponse;

      expect(response.components.tokenValidation.status).toBe('valid');
      expect(response.components.tokenValidation.validatedAt).toBeDefined();
      expect(response.components.tokenValidation.validatedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });

    test('status=invalid when token validation failed', async () => {
      // Set an invalid token to trigger AUTH_FAILED validation error
      process.env.TODOIST_API_TOKEN = 'invalid_token_12345';

      // Create a mock API service that fails validation
      const mockApiService = createInMemoryApiService();
      // Override validateToken to throw an error
      mockApiService.validateToken = async () => {
        throw new Error('Invalid token');
      };

      // Trigger validation failure
      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );
      // Set the failing mock
      (TokenValidatorSingleton as any).setMockApiService(mockApiService);

      try {
        await TokenValidatorSingleton.validateOnce();
      } catch {
        // Expected failure
      }

      const { TodoistMCPServer } = await import('../../src/server.js');
      const server = new TodoistMCPServer();

      const response =
        (await server.healthCheck()) as unknown as HealthCheckResponse;

      expect(response.components.tokenValidation.status).toBe('invalid');
      expect(response.components.tokenValidation.validatedAt).toBeUndefined();
    });
  });

  describe('validatedAt field conditional inclusion', () => {
    test('validatedAt absent when status=not_configured', async () => {
      delete process.env.TODOIST_API_TOKEN;

      const { TodoistMCPServer } = await import('../../src/server.js');
      const server = new TodoistMCPServer();

      const response =
        (await server.healthCheck()) as unknown as HealthCheckResponse;

      expect(response.components.tokenValidation).not.toHaveProperty(
        'validatedAt'
      );
    });

    test('validatedAt absent when status=configured', async () => {
      process.env.TODOIST_API_TOKEN = 'test_token';

      const { TodoistMCPServer } = await import('../../src/server.js');
      const server = new TodoistMCPServer();

      const response =
        (await server.healthCheck()) as unknown as HealthCheckResponse;

      expect(response.components.tokenValidation).not.toHaveProperty(
        'validatedAt'
      );
    });

    test('validatedAt absent when status=invalid', async () => {
      delete process.env.TODOIST_API_TOKEN;

      // Trigger validation failure
      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );
      try {
        await TokenValidatorSingleton.validateOnce();
      } catch {
        // Expected
      }

      const { TodoistMCPServer } = await import('../../src/server.js');
      const server = new TodoistMCPServer();

      const response =
        (await server.healthCheck()) as unknown as HealthCheckResponse;

      expect(response.components.tokenValidation).not.toHaveProperty(
        'validatedAt'
      );
    });

    test('validatedAt present only when status=valid', async () => {
      process.env.TODOIST_API_TOKEN = 'valid_test_token';

      // Validate token
      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );
      await TokenValidatorSingleton.validateOnce();

      const { TodoistMCPServer } = await import('../../src/server.js');
      const server = new TodoistMCPServer();

      const response =
        (await server.healthCheck()) as unknown as HealthCheckResponse;

      expect(response.components.tokenValidation).toHaveProperty('validatedAt');
      expect(typeof response.components.tokenValidation.validatedAt).toBe(
        'string'
      );
    });
  });

  describe('Performance requirements', () => {
    test('health check completes in <10ms without token', async () => {
      delete process.env.TODOIST_API_TOKEN;

      const { TodoistMCPServer } = await import('../../src/server.js');
      const server = new TodoistMCPServer();

      const start = performance.now();
      await server.healthCheck();
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });

    test('health check completes in <10ms with validated token', async () => {
      process.env.TODOIST_API_TOKEN = 'valid_test_token';

      // Validate first
      const { TokenValidatorSingleton } = await import(
        '../../src/services/token-validator.js'
      );
      await TokenValidatorSingleton.validateOnce();

      const { TodoistMCPServer } = await import('../../src/server.js');
      const server = new TodoistMCPServer();

      const start = performance.now();
      await server.healthCheck();
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });
  });
});
