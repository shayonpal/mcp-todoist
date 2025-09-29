/**
 * Integration tests for rate limiting behavior
 * Tests the rate limiting implementation and retry logic
 * Tests MUST FAIL until the actual implementation is complete
 */

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  mockRateLimitResponse,
  createSuccessResponse,
} from '../mocks/todoist-api-responses.js';

// Mock MCP tools - will fail until implemented
let todoistTasksTool: any;
let todoistProjectsTool: any;
let rateLimitService: any;

describe('Rate Limiting Integration Tests', () => {
  beforeEach(() => {
    // These will fail until the actual tools are implemented
    try {
      todoistTasksTool =
        require('../../src/tools/todoist-tasks.js').TodoistTasksTool;
      todoistProjectsTool =
        require('../../src/tools/todoist-projects.js').TodoistProjectsTool;
      rateLimitService =
        require('../../src/services/rate-limit.js').RateLimitService;
    } catch (error) {
      todoistTasksTool = null;
      todoistProjectsTool = null;
      rateLimitService = null;
    }

    // Reset any rate limiting state before each test
    if (rateLimitService) {
      rateLimitService.reset();
    }
  });

  afterEach(() => {
    // Clean up timers and restore mocks
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  describe('Basic Rate Limiting', () => {
    test('should respect Todoist API rate limits', async () => {
      expect(rateLimitService).toBeDefined();
      expect(rateLimitService.getCurrentLimits).toBeDefined();

      // Check initial rate limit state
      const initialLimits = rateLimitService.getCurrentLimits();
      expect(initialLimits).toEqual({
        sync_requests: {
          remaining: 1000,
          reset_time: expect.any(Number),
          window_minutes: 15,
        },
        rest_requests: {
          remaining: 450, // Approx 30 requests per minute
          reset_time: expect.any(Number),
          window_minutes: 1,
        },
      });
    });

    test('should track rate limit usage across requests', async () => {
      const projectParams = {
        action: 'create',
        name: 'Rate Limit Test Project',
        color: 'blue',
      };

      // Make a request and check rate limit tracking
      const result = await todoistProjectsTool.execute(projectParams);
      expect(result).toBeDefined();

      const limitsAfterRequest = rateLimitService.getCurrentLimits();
      expect(limitsAfterRequest.rest_requests.remaining).toBeLessThan(450);
    });

    test('should handle rate limit headers from API responses', async () => {
      // Mock API response with rate limit headers
      const mockResponse = {
        status: 200,
        data: { id: '123', name: 'Test Project' },
        headers: {
          'x-ratelimit-remaining': '25',
          'x-ratelimit-reset': '3600',
        },
      };

      // Simulate API call with rate limit headers
      await rateLimitService.processResponse(mockResponse);

      const currentLimits = rateLimitService.getCurrentLimits();
      expect(currentLimits.rest_requests.remaining).toBe(25);
    });
  });

  describe('Rate Limit Enforcement', () => {
    test('should throttle requests when approaching rate limits', async () => {
      // Simulate near rate limit exhaustion
      rateLimitService.setRemainingRequests(5); // Very low remaining requests

      const taskParams = {
        action: 'create',
        content: 'Throttled task',
        project_id: '220474322',
      };

      const startTime = Date.now();
      const result = await todoistTasksTool.execute(taskParams);
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      // Should introduce delay when near rate limit
      expect(duration).toBeGreaterThan(500); // At least 500ms delay
    });

    test('should reject requests when rate limit is exceeded', async () => {
      // Simulate rate limit exhaustion
      rateLimitService.setRemainingRequests(0);
      rateLimitService.setResetTime(Date.now() + 60000); // Reset in 1 minute

      const taskParams = {
        action: 'create',
        content: 'Rate limited task',
        project_id: '220474322',
      };

      await expect(todoistTasksTool.execute(taskParams)).rejects.toThrow(
        /rate limit exceeded/i
      );
    });

    test('should provide meaningful rate limit error messages', async () => {
      rateLimitService.setRemainingRequests(0);
      rateLimitService.setResetTime(Date.now() + 1800000); // Reset in 30 minutes

      const taskParams = {
        action: 'list',
        project_id: '220474322',
      };

      try {
        await todoistTasksTool.execute(taskParams);
        fail('Should have thrown rate limit error');
      } catch (error) {
        expect(error.message).toContain('rate limit exceeded');
        expect(error.message).toContain('30 minutes'); // Reset time
        expect(error.message).toContain('retry after');
      }
    });
  });

  describe('Rate Limit Recovery and Retry Logic', () => {
    test('should automatically retry after rate limit reset', async () => {
      // Mock rate limit exceeded, then reset
      rateLimitService.setRemainingRequests(0);
      rateLimitService.setResetTime(Date.now() + 1000); // Reset in 1 second

      const taskParams = {
        action: 'create',
        content: 'Retry after reset task',
        project_id: '220474322',
      };

      // Mock timer advancement
      jest.useFakeTimers();

      const requestPromise = todoistTasksTool.execute(taskParams);

      // Advance timer to simulate rate limit reset
      jest.advanceTimersByTime(1100);

      // Simulate rate limit reset
      rateLimitService.setRemainingRequests(450);

      const result = await requestPromise;

      expect(result).toBeDefined();
      expect(result.content[0].text).toContain('created');

      jest.useRealTimers();
    });

    test('should implement exponential backoff for retries', async () => {
      let retryCount = 0;
      const originalExecute = todoistTasksTool.execute;

      // Mock multiple rate limit responses
      todoistTasksTool.execute = jest.fn().mockImplementation(async params => {
        retryCount++;
        if (retryCount <= 3) {
          throw new Error('Rate limit exceeded. Retry after 60 seconds.');
        }
        return originalExecute.call(todoistTasksTool, params);
      });

      const taskParams = {
        action: 'create',
        content: 'Exponential backoff task',
        project_id: '220474322',
      };

      jest.useFakeTimers();

      const requestPromise = todoistTasksTool.execute(taskParams);

      // Simulate backoff delays: 1s, 2s, 4s
      jest.advanceTimersByTime(1000);
      jest.advanceTimersByTime(2000);
      jest.advanceTimersByTime(4000);

      const result = await requestPromise;

      expect(result).toBeDefined();
      expect(retryCount).toBe(4); // 3 failures + 1 success

      jest.useRealTimers();
    });

    test('should respect retry-after header from API', async () => {
      // Simulate 429 response with Retry-After header
      const mockRateLimitError = new Error('Rate limit exceeded');
      mockRateLimitError.response = {
        status: 429,
        headers: {
          'retry-after': '120', // 2 minutes
        },
      };

      let callCount = 0;
      const originalExecute = todoistTasksTool.execute;

      todoistTasksTool.execute = jest.fn().mockImplementation(async params => {
        callCount++;
        if (callCount === 1) {
          throw mockRateLimitError;
        }
        return originalExecute.call(todoistTasksTool, params);
      });

      const taskParams = {
        action: 'get',
        task_id: '2995104339',
      };

      jest.useFakeTimers();

      const requestPromise = todoistTasksTool.execute(taskParams);

      // Should wait exactly 2 minutes as specified in retry-after
      jest.advanceTimersByTime(120000);

      const result = await requestPromise;

      expect(result).toBeDefined();
      expect(callCount).toBe(2);

      jest.useRealTimers();
    });
  });

  describe('Different Rate Limit Types', () => {
    test('should handle sync API rate limits separately from REST API', async () => {
      // Sync API has different limits: 1000 requests per 15 minutes
      expect(rateLimitService.getSyncLimits).toBeDefined();
      expect(rateLimitService.getRestLimits).toBeDefined();

      const syncLimits = rateLimitService.getSyncLimits();
      const restLimits = rateLimitService.getRestLimits();

      expect(syncLimits.max_requests).toBe(1000);
      expect(syncLimits.window_minutes).toBe(15);

      expect(restLimits.max_requests).toBe(450); // Approx 30/min
      expect(restLimits.window_minutes).toBe(1);
    });

    test('should handle batch operation rate limits', async () => {
      // Batch operations may have different rate limiting
      const batchParams = {
        action: 'batch',
        batch_commands: Array.from({ length: 50 }, (_, i) => ({
          type: 'item_add',
          temp_id: `batch_task_${i}`,
          args: {
            content: `Batch task ${i}`,
            project_id: '220474322',
          },
        })),
      };

      // Should handle large batch without hitting rate limits
      const result = await todoistTasksTool.execute(batchParams);

      expect(result).toBeDefined();
      expect(result.content[0].text).toContain('successful');

      // Check that rate limits were properly updated for batch operation
      const limitsAfterBatch = rateLimitService.getCurrentLimits();
      expect(limitsAfterBatch.sync_requests.remaining).toBeLessThan(1000);
    });

    test('should prioritize important operations when near rate limits', async () => {
      // Simulate low rate limit remaining
      rateLimitService.setRemainingRequests(2);

      // High priority operation (task completion)
      const completeParams = {
        action: 'complete',
        task_id: '2995104339',
      };

      // Low priority operation (task list)
      const listParams = {
        action: 'list',
        project_id: '220474322',
      };

      // High priority should go through
      const completeResult = await todoistTasksTool.execute(completeParams);
      expect(completeResult).toBeDefined();

      // Low priority should be queued or delayed
      const startTime = Date.now();
      const listResult = await todoistTasksTool.execute(listParams);
      const duration = Date.now() - startTime;

      expect(listResult).toBeDefined();
      expect(duration).toBeGreaterThan(1000); // Should be delayed
    });
  });

  describe('Rate Limit Monitoring and Metrics', () => {
    test('should provide rate limit status information', async () => {
      const status = rateLimitService.getStatus();

      expect(status).toEqual({
        rest_api: {
          remaining: expect.any(Number),
          total: 450,
          reset_time: expect.any(Number),
          percentage_used: expect.any(Number),
        },
        sync_api: {
          remaining: expect.any(Number),
          total: 1000,
          reset_time: expect.any(Number),
          percentage_used: expect.any(Number),
        },
        last_request_time: expect.any(Number),
        total_requests_made: expect.any(Number),
      });
    });

    test('should track request patterns and provide analytics', async () => {
      // Make several requests of different types
      await todoistProjectsTool.execute({ action: 'list' });
      await todoistTasksTool.execute({
        action: 'list',
        project_id: '220474322',
      });
      await todoistTasksTool.execute({
        action: 'create',
        content: 'Test',
        project_id: '220474322',
      });

      const analytics = rateLimitService.getAnalytics();

      expect(analytics).toEqual({
        requests_per_minute: expect.any(Number),
        most_used_endpoints: expect.any(Array),
        peak_usage_time: expect.any(Number),
        average_response_time: expect.any(Number),
        rate_limit_hits: expect.any(Number),
      });
    });

    test('should warn when approaching rate limits', async () => {
      // Simulate getting close to rate limit
      rateLimitService.setRemainingRequests(50); // 10% remaining

      const taskParams = {
        action: 'create',
        content: 'Warning test task',
        project_id: '220474322',
      };

      const result = await todoistTasksTool.execute(taskParams);

      expect(result).toBeDefined();
      // Should include warning in response
      expect(result.content[0].text).toContain('rate limit warning');
      expect(result.content[0].text).toContain('10%');
    });
  });

  describe('Rate Limit Configuration and Customization', () => {
    test('should allow custom rate limit thresholds', async () => {
      // Configure conservative rate limiting
      rateLimitService.configure({
        warning_threshold: 0.2, // Warn at 20% remaining
        throttle_threshold: 0.1, // Throttle at 10% remaining
        max_retry_attempts: 5,
        base_retry_delay: 2000, // 2 seconds
      });

      rateLimitService.setRemainingRequests(90); // 20% of 450

      const taskParams = {
        action: 'list',
        project_id: '220474322',
      };

      const result = await todoistTasksTool.execute(taskParams);

      expect(result).toBeDefined();
      expect(result.content[0].text).toContain('warning'); // Should trigger warning
    });

    test('should support rate limit bypass for critical operations', async () => {
      rateLimitService.setRemainingRequests(0);

      // Critical operation should bypass rate limit
      const criticalParams = {
        action: 'complete',
        task_id: '2995104339',
        bypass_rate_limit: true,
      };

      const result = await todoistTasksTool.execute(criticalParams);

      expect(result).toBeDefined();
      expect(result.content[0].text).toContain('completed');
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should handle temporary network issues during rate limit checks', async () => {
      // Simulate network error during rate limit check
      const originalCheck = rateLimitService.checkLimits;
      let errorCount = 0;

      rateLimitService.checkLimits = jest.fn().mockImplementation(async () => {
        errorCount++;
        if (errorCount <= 2) {
          throw new Error('Network timeout');
        }
        return originalCheck.call(rateLimitService);
      });

      const taskParams = {
        action: 'get',
        task_id: '2995104339',
      };

      const result = await todoistTasksTool.execute(taskParams);

      expect(result).toBeDefined();
      expect(errorCount).toBe(3); // 2 failures + 1 success
    });

    test('should maintain rate limit state across application restarts', async () => {
      // Simulate saving and restoring rate limit state
      const currentState = rateLimitService.exportState();

      expect(currentState).toEqual({
        remaining_requests: expect.any(Number),
        reset_time: expect.any(Number),
        total_requests: expect.any(Number),
        last_reset: expect.any(Number),
      });

      // Simulate application restart
      rateLimitService.reset();
      rateLimitService.importState(currentState);

      const restoredState = rateLimitService.exportState();
      expect(restoredState).toEqual(currentState);
    });

    test('should gracefully degrade when rate limit service is unavailable', async () => {
      // Disable rate limiting service
      rateLimitService.disable();

      const taskParams = {
        action: 'create',
        content: 'Task without rate limiting',
        project_id: '220474322',
      };

      // Should still work but without rate limiting protection
      const result = await todoistTasksTool.execute(taskParams);

      expect(result).toBeDefined();
      expect(result.content[0].text).toContain('created');
    });
  });
});
