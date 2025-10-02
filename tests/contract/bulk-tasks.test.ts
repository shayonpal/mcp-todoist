import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { TodoistBulkTasksTool } from '../../src/tools/bulk-tasks.js';
import { TodoistApiService } from '../../src/services/todoist-api.js';
import { BulkTasksResponse } from '../../src/types/bulk-operations.js';

// Type guard for BulkTasksResponse
function isBulkTasksResponse(
  response: BulkTasksResponse | { success: false; error: { code: string; message: string } }
): response is BulkTasksResponse {
  return response.success === true;
}

// Type guard for error response
function isErrorResponse(
  response: BulkTasksResponse | { success: false; error: { code: string; message: string } }
): response is { success: false; error: { code: string; message: string } } {
  return response.success === false;
}

const mockApiConfig = {
  token: 'test_token',
  base_url: 'https://api.todoist.com/rest/v1',
  timeout: 10000,
  retry_attempts: 3,
};

describe('todoist_bulk_tasks MCP Tool Contract', () => {
  let apiService: jest.Mocked<TodoistApiService>;
  let bulkTasksTool: TodoistBulkTasksTool;

  beforeEach(() => {
    // Create mock API service
    apiService = {
      executeBatch: jest.fn(),
    } as unknown as jest.Mocked<TodoistApiService>;

    bulkTasksTool = new TodoistBulkTasksTool(mockApiConfig, {
      apiService: apiService as unknown as TodoistApiService,
    });

    // Mock executeBatch for successful operations
    apiService.executeBatch = jest.fn(async commands => {
      return {
        sync_status: commands.reduce(
          (acc, cmd) => ({
            ...acc,
            [cmd.uuid]: 'ok',
          }),
          {}
        ),
        temp_id_mapping: {},
        full_sync: false,
      };
    });
  });

  describe('Tool Registration', () => {
    test('should provide MCP tool metadata', () => {
      const definition = TodoistBulkTasksTool.getToolDefinition();
      expect(definition.name).toBe('todoist_bulk_tasks');
      expect(definition.description).toContain('bulk operations');
      expect(definition.inputSchema).toBeDefined();
      expect(definition.inputSchema.properties).toHaveProperty('action');
      expect(definition.inputSchema.properties).toHaveProperty('task_ids');
    });
  });

  // T003: Bulk update 5 tasks with due_string
  describe('T003: Bulk update 5 tasks with due_string', () => {
    test('should successfully update 5 tasks with due_string="tomorrow"', async () => {
      const params = {
        action: 'update' as const,
        task_ids: ['7654321', '7654322', '7654323', '7654324', '7654325'],
        due_string: 'tomorrow',
      };

      const result = await bulkTasksTool.execute(params);

      expect(result.success).toBe(true);
      if (!isBulkTasksResponse(result)) {
        throw new Error('Expected BulkTasksResponse');
      }
      expect(result.data).toBeDefined();
      expect(result.data.total_tasks).toBe(5);
      expect(result.data.successful).toBe(5);
      expect(result.data.failed).toBe(0);
      expect(result.data.results).toHaveLength(5);

      // Verify all results are successful
      result.data.results.forEach(r => {
        expect(r.success).toBe(true);
        expect(r.error).toBeNull();
        expect(r.resource_uri).toMatch(/^todoist:\/\/task\//);
      });

      // Verify executeBatch was called with correct commands
      expect(apiService.executeBatch).toHaveBeenCalledTimes(1);
      const commands = (apiService.executeBatch as jest.Mock).mock.calls[0][0];
      expect(commands).toHaveLength(5);
      expect(commands[0].type).toBe('item_update');
      expect(commands[0].args).toHaveProperty('id');
      expect(commands[0].args).toHaveProperty('due');
    });

    test('should match BulkTasksResponse schema structure', async () => {
      const params = {
        action: 'update' as const,
        task_ids: ['7654321', '7654322', '7654323', '7654324', '7654325'],
        due_string: 'tomorrow',
      };

      const result = await bulkTasksTool.execute(params);

      // Verify response structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      if (!isBulkTasksResponse(result)) {
        throw new Error('Expected BulkTasksResponse');
      }
      expect(result.data).toHaveProperty('total_tasks');
      expect(result.data).toHaveProperty('successful');
      expect(result.data).toHaveProperty('failed');
      expect(result.data).toHaveProperty('results');

      // Verify metadata
      if (result.metadata) {
        expect(result.metadata).toHaveProperty('deduplication_applied');
        expect(result.metadata).toHaveProperty('execution_time_ms');
      }
    });
  });

  // T004: Bulk complete 10 tasks
  describe('T004: Bulk complete 10 tasks', () => {
    test('should successfully complete 10 tasks', async () => {
      const taskIds = Array.from({ length: 10 }, (_, i) => `765432${i}`);
      const params = {
        action: 'complete' as const,
        task_ids: taskIds,
      };

      const result = await bulkTasksTool.execute(params);

      expect(result.success).toBe(true);
      if (!isBulkTasksResponse(result)) {
        throw new Error('Expected BulkTasksResponse');
      }
      expect(result.data.total_tasks).toBe(10);
      expect(result.data.failed).toBe(0);
      expect(result.data.results).toHaveLength(10);

      // Verify all results have success=true
      result.data.results.forEach(r => {
        expect(r.success).toBe(true);
        expect(r.error).toBeNull();
      });
    });

    test('should send item_complete commands without field updates', async () => {
      const taskIds = Array.from({ length: 10 }, (_, i) => `765432${i}`);
      const params = {
        action: 'complete' as const,
        task_ids: taskIds,
      };

      await bulkTasksTool.execute(params);

      const commands = (apiService.executeBatch as jest.Mock).mock.calls[0][0];
      expect(commands).toHaveLength(10);
      commands.forEach((cmd: any) => {
        expect(cmd.type).toBe('item_complete');
        expect(cmd.args).toHaveProperty('id');
        // Should only have id, no other fields
        expect(Object.keys(cmd.args)).toEqual(['id']);
      });
    });
  });

  // T005: Reject >50 tasks (51 task IDs)
  describe('T005: Reject >50 tasks', () => {
    test('should reject request with 51 task IDs', async () => {
      const taskIds = Array.from({ length: 51 }, (_, i) => `task-${i}`);
      const params = {
        action: 'update' as const,
        task_ids: taskIds,
        due_string: 'tomorrow',
      };

      const result = await bulkTasksTool.execute(params);

      expect(result.success).toBe(false);
      if (!isErrorResponse(result)) {
        throw new Error('Expected error response');
      }
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('INVALID_PARAMS');
      expect(result.error?.message).toContain('Maximum 50 tasks allowed');
      expect(result.error?.message).toContain('received 51');

      // Should not call API
      expect(apiService.executeBatch).not.toHaveBeenCalled();
    });

    test('should accept exactly 50 task IDs', async () => {
      const taskIds = Array.from({ length: 50 }, (_, i) => `task-${i}`);
      const params = {
        action: 'update' as const,
        task_ids: taskIds,
        due_string: 'tomorrow',
      };

      const result = await bulkTasksTool.execute(params);

      expect(result.success).toBe(true);
      if (!isBulkTasksResponse(result)) {
        throw new Error('Expected BulkTasksResponse');
      }
      expect(result.data.total_tasks).toBe(50);
  });

  // T006: Deduplicate task IDs [1,2,1,3] → 3 unique
  describe('T006: Deduplicate task IDs', () => {
    test('should deduplicate [1,2,1,3] to 3 unique tasks', async () => {
      const params = {
        action: 'update' as const,
        task_ids: ['7654321', '7654322', '7654321', '7654323'],
        due_string: 'tomorrow',
      };

      const result = await bulkTasksTool.execute(params);

      expect(result.success).toBe(true);
      if (!isBulkTasksResponse(result)) {
        throw new Error('Expected BulkTasksResponse');
      }
      expect(result.data.total_tasks).toBe(3); // Not 4

      // Verify metadata shows deduplication
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.deduplication_applied).toBe(true);
      expect(result.metadata?.original_count).toBe(4);
      expect(result.metadata?.deduplicated_count).toBe(3);

      // Verify unique task IDs
      const returnedIds = result.data.results.map(r => r.task_id);
      const uniqueIds = new Set(returnedIds);
      expect(uniqueIds.size).toBe(3);
      expect(uniqueIds).toContain('7654321');
      expect(uniqueIds).toContain('7654322');
      expect(uniqueIds).toContain('7654323');
    });

    test('should handle no deduplication needed', async () => {
      const params = {
        action: 'update' as const,
        task_ids: ['7654321', '7654322', '7654323'],
        due_string: 'tomorrow',
      };

      const result = await bulkTasksTool.execute(params);

      expect(result.success).toBe(true);
      if (!isBulkTasksResponse(result)) {
        throw new Error('Expected BulkTasksResponse');
      }
      expect(result.data.total_tasks).toBe(3);
      // Metadata should show no deduplication
      expect(result.metadata?.deduplication_applied).toBe(false);
      expect(result.metadata?.original_count).toBe(3);
      expect(result.metadata?.deduplicated_count).toBe(3);
    });
  });

  // T007: Partial failure (3 valid, 2 invalid IDs)
  describe('T007: Partial failure', () => {
    test('should handle 3 successful, 2 failed tasks', async () => {
      // Mock executeBatch to return partial success
      apiService.executeBatch = jest.fn(async commands => {
        return {
          sync_status: {
            [commands[0].uuid]: 'ok',
            [commands[1].uuid]: {
              error: 'TASK_NOT_FOUND',
              error_message: 'Task not found',
              error_code: 404,
            },
            [commands[2].uuid]: 'ok',
            [commands[3].uuid]: {
              error: 'TASK_NOT_FOUND',
              error_message: 'Task not found',
              error_code: 404,
            },
            [commands[4].uuid]: 'ok',
          },
          temp_id_mapping: {},
          full_sync: false,
        };
      });

      const params = {
        action: 'update' as const,
        task_ids: ['7654321', '9999991', '7654323', '9999992', '7654325'],
        priority: 2,
      };

      const result = await bulkTasksTool.execute(params);

      expect(result.success).toBe(true); // Overall operation succeeds
      expect(result.data.total_tasks).toBe(5);
      expect(result.data.successful).toBe(3);
      expect(result.data.failed).toBe(2);

      // Verify failed results have error messages
      const failedResults = result.data.results.filter(r => !r.success);
      expect(failedResults).toHaveLength(2);
      failedResults.forEach(r => {
        expect(r.error).toContain('not found');
      });

      // Verify successful results
      const successfulResults = result.data.results.filter(r => r.success);
      expect(successfulResults).toHaveLength(3);
      successfulResults.forEach(r => {
        expect(r.error).toBeNull();
      });
    });
  });

  // T008: Reject content field update
  describe('T008: Reject content field update', () => {
    test('should reject request with content field', async () => {
      const params = {
        action: 'update' as const,
        task_ids: ['7654321', '7654322'],
        content: 'New title', // Disallowed field
      };

      const result = await bulkTasksTool.execute(params as any);

      expect(result.success).toBe(false);
      if (!isErrorResponse(result)) {
        throw new Error('Expected error response');
      }
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain(
        'Cannot modify content, description, or comments'
      );

      // Should not call API
      expect(apiService.executeBatch).not.toHaveBeenCalled();
    });

    test('should reject request with description field', async () => {
      const params = {
        action: 'update' as const,
        task_ids: ['7654321', '7654322'],
        description: 'New description', // Disallowed field
      };

      const result = await bulkTasksTool.execute(params as any);

      expect(result.success).toBe(false);
      if (!isErrorResponse(result)) {
        throw new Error('Expected error response');
      }
      expect(result.error?.code).toBe('INVALID_PARAMS');
      expect(result.error?.message).toContain(
        'Cannot modify content, description, or comments'
      );
    });

    test('should reject request with comments field', async () => {
      const params = {
        action: 'update' as const,
        task_ids: ['7654321', '7654322'],
        comments: 'New comment', // Disallowed field
      };

      const result = await bulkTasksTool.execute(params as any);

      expect(result.success).toBe(false);
      if (!isErrorResponse(result)) {
        throw new Error('Expected error response');
      }
      expect(result.error?.code).toBe('INVALID_PARAMS');
      expect(result.error?.message).toContain(
        'Cannot modify content, description, or comments'
      );
    });

    test('should allow all other supported fields', async () => {
      const params = {
        action: 'update' as const,
        task_ids: ['7654321', '7654322'],
        project_id: '220474322',
        section_id: '12345',
        priority: 2,
        labels: ['urgent'],
        due_string: 'tomorrow',
      };

      const result = await bulkTasksTool.execute(params);

      expect(result.success).toBe(true);
      expect(apiService.executeBatch).toHaveBeenCalled();
    });
  });

  // T009: Reject mixed actions
  describe('T009: Reject mixed actions', () => {
    test('should only support single action type per request', async () => {
      // The schema enforces single action type through enum
      const params = {
        action: 'update' as const,
        task_ids: ['7654321', '7654322'],
        due_string: 'tomorrow',
      };

      const result = await bulkTasksTool.execute(params);

      expect(result.success).toBe(true);

      // Verify all commands have same type
      const commands = (apiService.executeBatch as jest.Mock).mock.calls[0][0];
      const commandTypes = new Set(commands.map((cmd: any) => cmd.type));
      expect(commandTypes.size).toBe(1);
    });

    test('should reject invalid action type', async () => {
      const params = {
        action: 'invalid_action' as any,
        task_ids: ['7654321', '7654322'],
      };

      const result = await bulkTasksTool.execute(params);

      expect(result.success).toBe(false);
      if (!isErrorResponse(result)) {
        throw new Error('Expected error response');
      }
      expect(result.error).toBeDefined();
    });

    test('should validate action is one of: update, complete, uncomplete, move', async () => {
      const validActions = ['update', 'complete', 'uncomplete', 'move'];

      for (const action of validActions) {
        const params = {
          action: action as any,
          task_ids: ['7654321'],
        };

        const result = await bulkTasksTool.execute(params);

        // Should at least pass validation (might fail for other reasons)
        if (result.error) {
          expect(result.error.code).not.toBe('INVALID_PARAMS');
        }
      }
    });
  });

  describe('Additional Schema Validation', () => {
    test('should reject empty task_ids array', async () => {
      const params = {
        action: 'update' as const,
        task_ids: [],
      };

      const result = await bulkTasksTool.execute(params);

      expect(result.success).toBe(false);
      if (!isErrorResponse(result)) {
        throw new Error('Expected error response');
      }
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });

    test('should reject missing action parameter', async () => {
      const params = {
        task_ids: ['7654321'],
      };

      const result = await bulkTasksTool.execute(params as any);

      expect(result.success).toBe(false);
      if (!isErrorResponse(result)) {
        throw new Error('Expected error response');
      }
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });

    test('should reject missing task_ids parameter', async () => {
      const params = {
        action: 'update' as const,
      };

      const result = await bulkTasksTool.execute(params as any);

      expect(result.success).toBe(false);
      if (!isErrorResponse(result)) {
        throw new Error('Expected error response');
      }
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });

    test('should reject invalid priority value', async () => {
      const params = {
        action: 'update' as const,
        task_ids: ['7654321'],
        priority: 5, // Invalid: must be 1-4
      };

      const result = await bulkTasksTool.execute(params);

      expect(result.success).toBe(false);
      if (!isErrorResponse(result)) {
        throw new Error('Expected error response');
      }
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });
  });
});
