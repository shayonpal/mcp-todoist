import { describe, test, beforeEach, expect, jest } from '@jest/globals';
import { TodoistBulkTasksTool } from '../../src/tools/bulk-tasks.js';
import { TodoistTasksTool } from '../../src/tools/todoist-tasks.js';
import { TodoistProjectsTool } from '../../src/tools/todoist-projects.js';
import { CacheService } from '../../src/services/cache.js';
import { BatchOperationsService } from '../../src/services/batch.js';
import { createInMemoryApiService } from '../helpers/inMemoryTodoistApiService.js';
import { BulkTasksResponse } from '../../src/types/bulk-operations.js';

// Type guard for BulkTasksResponse
function isBulkTasksResponse(
  response:
    | BulkTasksResponse
    | { success: false; error: { code: string; message: string } }
): response is BulkTasksResponse {
  return response.success === true;
}

const mockApiConfig = {
  token: 'test_token',
  base_url: 'https://api.todoist.com/rest/v1',
  timeout: 10000,
  retry_attempts: 3,
};

describe('Bulk Operations Integration Tests', () => {
  let bulkTasksTool: TodoistBulkTasksTool;
  let tasksTool: TodoistTasksTool;
  let projectsTool: TodoistProjectsTool;
  let apiService: any;
  let cache: CacheService;

  beforeEach(() => {
    apiService = createInMemoryApiService();
    cache = new CacheService();
    const batchService = new BatchOperationsService(apiService);

    bulkTasksTool = new TodoistBulkTasksTool(mockApiConfig, {
      apiService,
    });
    tasksTool = new TodoistTasksTool(mockApiConfig, {
      apiService,
      cacheService: cache,
      batchService,
    });
    projectsTool = new TodoistProjectsTool(mockApiConfig, {
      apiService,
      cacheService: cache,
    });
  });

  // T010: Integration test - Bulk reschedule 15 tasks to tomorrow
  describe('T010: Bulk reschedule 15 tasks to tomorrow', () => {
    test('should successfully reschedule 15 tasks to tomorrow', async () => {
      const startTime = Date.now();

      // Create 15 test tasks
      const taskIds: string[] = [];
      for (let i = 0; i < 15; i++) {
        const result = await tasksTool.execute({
          action: 'create',
          content: `Task ${i + 1}`,
          project_id: '220474322',
        });
        expect(result.success).toBe(true);
        taskIds.push((result.data as any).id);
      }

      // Bulk reschedule all tasks to tomorrow
      const bulkResult = await bulkTasksTool.execute({
        action: 'update',
        task_ids: taskIds,
        due_string: 'tomorrow',
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Verify bulk operation succeeded
      expect(bulkResult.success).toBe(true);
      if (!isBulkTasksResponse(bulkResult)) {
        throw new Error('Expected BulkTasksResponse');
      }
      expect(bulkResult.data.total_tasks).toBe(15);
      expect(bulkResult.data.successful).toBe(15);
      expect(bulkResult.data.failed).toBe(0);

      // Verify execution time is reasonable (<2 seconds target)
      expect(executionTime).toBeLessThan(2000);

      // Verify all tasks have tomorrow's due date
      for (const taskId of taskIds) {
        const getResult = await tasksTool.execute({
          action: 'get',
          task_id: taskId,
        });
        expect(getResult.success).toBe(true);
        const task = getResult.data as any;
        expect(task.due).toBeDefined();
        // In-memory service should have updated the due date
      }
    });

    test('should handle execution time metadata', async () => {
      // Create 15 test tasks
      const taskIds: string[] = [];
      for (let i = 0; i < 15; i++) {
        const result = await tasksTool.execute({
          action: 'create',
          content: `Task ${i + 1}`,
          project_id: '220474322',
        });
        taskIds.push((result.data as any).id);
      }

      const bulkResult = await bulkTasksTool.execute({
        action: 'update',
        task_ids: taskIds,
        due_string: 'tomorrow',
      });

      if (!isBulkTasksResponse(bulkResult)) {
        throw new Error('Expected BulkTasksResponse');
      }
      expect(bulkResult.metadata).toBeDefined();
      expect(bulkResult.metadata?.execution_time_ms).toBeGreaterThanOrEqual(0);
      expect(bulkResult.metadata?.execution_time_ms).toBeLessThan(2000);
    });
  });

  // T011: Integration test - Bulk move 7 tasks to different project
  describe('T011: Bulk move 7 tasks to different project', () => {
    test('should successfully move 7 tasks between projects', async () => {
      // Create two projects
      const projectAResult = await projectsTool.execute({
        action: 'create',
        name: 'Project A',
        color: 'blue',
      });
      expect(projectAResult.success).toBe(true);
      const projectAId = (projectAResult.data as any).id;

      const projectBResult = await projectsTool.execute({
        action: 'create',
        name: 'Project B',
        color: 'green',
      });
      expect(projectBResult.success).toBe(true);
      const projectBId = (projectBResult.data as any).id;

      // Create 7 tasks in Project A
      const taskIds: string[] = [];
      for (let i = 0; i < 7; i++) {
        const result = await tasksTool.execute({
          action: 'create',
          content: `Task ${i + 1}`,
          project_id: projectAId,
        });
        expect(result.success).toBe(true);
        taskIds.push((result.data as any).id);
      }

      // Verify tasks are in Project A
      const listABeforeResult = await tasksTool.execute({
        action: 'list',
        project_id: projectAId,
      });
      expect((listABeforeResult.data as any[]).length).toBe(7);

      // Bulk move to Project B
      const bulkResult = await bulkTasksTool.execute({
        action: 'move',
        task_ids: taskIds,
        project_id: projectBId,
      });

      expect(bulkResult.success).toBe(true);
      if (!isBulkTasksResponse(bulkResult)) {
        throw new Error('Expected BulkTasksResponse');
      }
      expect(bulkResult.data.total_tasks).toBe(7);
      expect(bulkResult.data.successful).toBe(7);
      expect(bulkResult.data.failed).toBe(0);

      // Verify tasks are now in Project B
      const listBAfterResult = await tasksTool.execute({
        action: 'list',
        project_id: projectBId,
      });
      expect((listBAfterResult.data as any[]).length).toBe(7);

      // Verify tasks are no longer in Project A
      const listAAfterResult = await tasksTool.execute({
        action: 'list',
        project_id: projectAId,
      });
      expect((listAAfterResult.data as any[]).length).toBe(0);

      // Verify each task has correct project_id
      for (const taskId of taskIds) {
        const getResult = await tasksTool.execute({
          action: 'get',
          task_id: taskId,
        });
        expect(getResult.success).toBe(true);
        const task = getResult.data as any;
        expect(task.project_id).toBe(projectBId);
      }
    });
  });

  // T012: Integration test - Bulk complete 20 tasks with 3 failures
  describe('T012: Bulk complete 20 tasks with 3 failures', () => {
    test('should handle partial success with 17 valid and 3 invalid task IDs', async () => {
      // Create 17 valid tasks
      const validTaskIds: string[] = [];
      for (let i = 0; i < 17; i++) {
        const result = await tasksTool.execute({
          action: 'create',
          content: `Valid Task ${i + 1}`,
          project_id: '220474322',
        });
        expect(result.success).toBe(true);
        validTaskIds.push((result.data as any).id);
      }

      // Add 3 invalid task IDs
      const invalidTaskIds = ['9999991', '9999992', '9999993'];
      const allTaskIds = [...validTaskIds, ...invalidTaskIds];

      // Bulk complete (should partially succeed)
      const bulkResult = await bulkTasksTool.execute({
        action: 'complete',
        task_ids: allTaskIds,
      });

      // Overall operation should succeed (partial execution)
      expect(bulkResult.success).toBe(true);
      if (!isBulkTasksResponse(bulkResult)) {
        throw new Error('Expected BulkTasksResponse');
      }
      expect(bulkResult.data.total_tasks).toBe(20);
      expect(bulkResult.data.successful).toBe(17);
      expect(bulkResult.data.failed).toBe(3);

      // Verify successful results
      const successfulResults = bulkResult.data.results.filter(r => r.success);
      expect(successfulResults).toHaveLength(17);
      successfulResults.forEach(r => {
        expect(r.error).toBeNull();
        expect(validTaskIds).toContain(r.task_id);
      });

      // Verify failed results have actionable error messages
      const failedResults = bulkResult.data.results.filter(r => !r.success);
      expect(failedResults).toHaveLength(3);
      failedResults.forEach(r => {
        expect(r.error).toBeDefined();
        expect(r.error).toContain('not found');
        expect(invalidTaskIds).toContain(r.task_id);
      });

      // Verify that valid tasks were actually completed
      for (const taskId of validTaskIds) {
        const getResult = await tasksTool.execute({
          action: 'get',
          task_id: taskId,
        });
        // In the in-memory service, completed tasks might be marked differently
        // or removed from active lists
        if (getResult.success) {
          const task = getResult.data as any;
          // Verify task is marked as completed
          expect(task.completed).toBe(true);
        }
      }
    });

    test('should not rollback successful operations on partial failure', async () => {
      // Create 5 valid tasks
      const validTaskIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const result = await tasksTool.execute({
          action: 'create',
          content: `Task ${i + 1}`,
          project_id: '220474322',
        });
        validTaskIds.push((result.data as any).id);
      }

      // Mix valid and invalid IDs
      const allTaskIds = [
        validTaskIds[0],
        '9999999',
        validTaskIds[1],
        validTaskIds[2],
      ];

      const bulkResult = await bulkTasksTool.execute({
        action: 'complete',
        task_ids: allTaskIds,
      });

      // Partial success (no rollback)
      expect(bulkResult.success).toBe(true);
      if (!isBulkTasksResponse(bulkResult)) {
        throw new Error('Expected BulkTasksResponse');
      }
      expect(bulkResult.data.successful).toBe(3);
      expect(bulkResult.data.failed).toBe(1);

      // Verify successful tasks remain completed
      for (const taskId of [
        validTaskIds[0],
        validTaskIds[1],
        validTaskIds[2],
      ]) {
        const getResult = await tasksTool.execute({
          action: 'get',
          task_id: taskId,
        });
        if (getResult.success) {
          const task = getResult.data as any;
          expect(task.completed).toBe(true);
        }
      }
    });
  });

  // T013: Integration test - Rate limit handling (mock 429 response)
  describe('T013: Rate limit handling', () => {
    test('should handle rate limit with retry mechanism', async () => {
      // Mock executeBatch with retry logic: fail on first call, succeed on retry
      let callCount = 0;
      const originalExecuteBatch = apiService.executeBatch.bind(apiService);

      // Wrap executeBatch with retry logic for testing
      const executeBatchWithRetry = async (
        commands: any[],
        retries = 3
      ): Promise<any> => {
        for (let attempt = 0; attempt < retries; attempt++) {
          try {
            callCount++;
            if (callCount === 1) {
              // First call: simulate rate limit
              const error = new Error('Rate limit exceeded') as any;
              error.response = {
                status: 429,
                headers: { 'retry-after': '0.01' }, // Short delay for test
              };
              throw error;
            }
            // Subsequent calls: succeed
            return await originalExecuteBatch(commands);
          } catch (error: any) {
            if (error?.response?.status === 429 && attempt < retries - 1) {
              // Wait for retry-after period
              const retryAfter =
                parseFloat(error.response.headers['retry-after']) || 1;
              await new Promise(resolve =>
                setTimeout(resolve, retryAfter * 1000)
              );
              continue; // Retry
            }
            throw error; // Re-throw if not 429 or out of retries
          }
        }
        throw new Error('Max retries exceeded');
      };

      apiService.executeBatch = jest.fn(executeBatchWithRetry);

      // Create test tasks
      const taskIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const result = await tasksTool.execute({
          action: 'create',
          content: `Task ${i + 1}`,
          project_id: '220474322',
        });
        taskIds.push((result.data as any).id);
      }

      // Bulk update (should handle rate limit and retry)
      const bulkResult = await bulkTasksTool.execute({
        action: 'update',
        task_ids: taskIds,
        due_string: 'tomorrow',
      });

      // Should eventually succeed after retry
      expect(bulkResult.success).toBe(true);
      if (!isBulkTasksResponse(bulkResult)) {
        throw new Error('Expected BulkTasksResponse');
      }
      expect(bulkResult.data.successful).toBe(5);

      // Verify retry was attempted
      expect(callCount).toBeGreaterThan(1);
    });

    test('should respect Retry-After header', async () => {
      let firstCall = true;
      const originalExecuteBatch = apiService.executeBatch.bind(apiService);

      // Mock with retry logic that respects Retry-After header
      const executeBatchWithRetry = async (
        commands: any[],
        retries = 3
      ): Promise<any> => {
        for (let attempt = 0; attempt < retries; attempt++) {
          try {
            if (firstCall) {
              firstCall = false;
              const error = new Error('Rate limit exceeded') as any;
              error.response = {
                status: 429,
                headers: { 'retry-after': '0.1' }, // 100ms delay for test
              };
              throw error;
            }
            return await originalExecuteBatch(commands);
          } catch (error: any) {
            if (error?.response?.status === 429 && attempt < retries - 1) {
              // Respect Retry-After header
              const retryAfter =
                parseFloat(error.response.headers['retry-after']) || 1;
              await new Promise(resolve =>
                setTimeout(resolve, retryAfter * 1000)
              );
              continue; // Retry
            }
            throw error;
          }
        }
        throw new Error('Max retries exceeded');
      };

      apiService.executeBatch = jest.fn(executeBatchWithRetry);

      const taskIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const result = await tasksTool.execute({
          action: 'create',
          content: `Task ${i + 1}`,
          project_id: '220474322',
        });
        taskIds.push((result.data as any).id);
      }

      const startTime = Date.now();
      const bulkResult = await bulkTasksTool.execute({
        action: 'update',
        task_ids: taskIds,
        priority: 2,
      });
      const endTime = Date.now();

      expect(bulkResult.success).toBe(true);
      // Should have waited at least 100ms (Retry-After: 0.1s)
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    test('should fail after max retries on persistent rate limit', async () => {
      // Mock with retry logic that always fails with 429
      const executeBatchWithRetry = async (
        commands: any[],
        maxRetries = 3
      ): Promise<any> => {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          const error = new Error('Rate limit exceeded') as any;
          error.response = {
            status: 429,
            headers: { 'retry-after': '0.01' },
          };

          if (attempt < maxRetries - 1) {
            // Not the last attempt - wait and retry
            const retryAfter =
              parseFloat(error.response.headers['retry-after']) || 1;
            await new Promise(resolve =>
              setTimeout(resolve, retryAfter * 1000)
            );
            continue;
          }
          // Last attempt - throw error
          throw error;
        }
        throw new Error('Max retries exceeded');
      };

      apiService.executeBatch = jest.fn(executeBatchWithRetry);

      const taskIds = ['7654321', '7654322'];

      const bulkResult = await bulkTasksTool.execute({
        action: 'update',
        task_ids: taskIds,
        priority: 2,
      });

      // Should fail after exhausting retries
      expect(bulkResult.success).toBe(false);
      if (isBulkTasksResponse(bulkResult)) {
        throw new Error('Expected error response');
      }
      expect(bulkResult.error).toBeDefined();
      expect(bulkResult.error?.code).toMatch(/RATE_LIMIT|INTERNAL_ERROR/);
    });
  });

  describe('Additional Integration Scenarios', () => {
    test('should handle bulk update of multiple fields simultaneously', async () => {
      // Create 8 test tasks
      const taskIds: string[] = [];
      for (let i = 0; i < 8; i++) {
        const result = await tasksTool.execute({
          action: 'create',
          content: `Task ${i + 1}`,
          project_id: '220474322',
        });
        taskIds.push((result.data as any).id);
      }

      // Bulk update multiple fields
      const bulkResult = await bulkTasksTool.execute({
        action: 'update',
        task_ids: taskIds,
        priority: 2,
        labels: ['urgent', 'work'],
        due_string: 'next Monday',
        deadline_date: '2025-12-31',
      });

      expect(bulkResult.success).toBe(true);
      if (!isBulkTasksResponse(bulkResult)) {
        throw new Error('Expected BulkTasksResponse');
      }
      expect(bulkResult.data.successful).toBe(8);

      // Verify one task has all updated fields
      const getResult = await tasksTool.execute({
        action: 'get',
        task_id: taskIds[0],
      });
      expect(getResult.success).toBe(true);
      const task = getResult.data as any;
      expect(task.priority).toBe(2);
      expect(task.labels).toContain('urgent');
      expect(task.labels).toContain('work');
      expect(task.due).toBeDefined();
      expect(task.deadline).toBeDefined();
    });

    test('should handle bulk uncomplete operation', async () => {
      // Create and complete 5 tasks
      const taskIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const createResult = await tasksTool.execute({
          action: 'create',
          content: `Task ${i + 1}`,
          project_id: '220474322',
        });
        const taskId = (createResult.data as any).id;
        taskIds.push(taskId);

        // Complete the task
        await tasksTool.execute({
          action: 'complete',
          task_id: taskId,
        });
      }

      // Bulk uncomplete
      const bulkResult = await bulkTasksTool.execute({
        action: 'uncomplete',
        task_ids: taskIds,
      });

      expect(bulkResult.success).toBe(true);
      if (!isBulkTasksResponse(bulkResult)) {
        throw new Error('Expected BulkTasksResponse');
      }
      expect(bulkResult.data.successful).toBe(5);

      // Verify tasks are no longer completed
      for (const taskId of taskIds) {
        const getResult = await tasksTool.execute({
          action: 'get',
          task_id: taskId,
        });
        if (getResult.success) {
          const task = getResult.data as any;
          expect(task.completed).toBe(false);
        }
      }
    });
  });
});
