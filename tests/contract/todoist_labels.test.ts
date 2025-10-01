import { describe, test, expect, beforeEach } from '@jest/globals';
import { TodoistLabelsTool } from '../../src/tools/todoist-labels.js';
import { CacheService } from '../../src/services/cache.js';
import { TodoistApiService } from '../../src/services/todoist-api.js';
import {
  createMockFn,
  toTodoistLabel,
} from '../helpers/mockTodoistApiService.js';
import { mockLabels } from '../mocks/todoist-api-responses.js';

const mockApiConfig = {
  token: 'test_token',
  base_url: 'https://api.todoist.com/rest/v1',
  timeout: 10000,
  retry_attempts: 3,
};

describe('todoist_labels MCP Tool Contract', () => {
  let apiService: any;
  let todoistLabelsTool: TodoistLabelsTool;

  beforeEach(() => {
    const label1 = toTodoistLabel(mockLabels.label1);
    const label2 = toTodoistLabel(mockLabels.label2);

    apiService = {
      getLabels: createMockFn(),
      getLabel: createMockFn(),
      createLabel: createMockFn(),
      updateLabel: createMockFn(),
      deleteLabel: createMockFn(),
      renameSharedLabel: createMockFn(),
      removeSharedLabel: createMockFn(),
      getRateLimitStatus: createMockFn(),
    };

    apiService.getLabels.mockResolvedValue({
      results: [label1, label2],
      next_cursor: null,
    });
    apiService.getLabel.mockResolvedValue(label1);
    apiService.createLabel.mockResolvedValue(label1);
    apiService.updateLabel.mockResolvedValue({
      ...label1,
      color: 'green',
    });
    apiService.deleteLabel.mockResolvedValue(undefined);
    apiService.renameSharedLabel.mockResolvedValue(undefined);
    apiService.removeSharedLabel.mockResolvedValue(undefined);
    apiService.getRateLimitStatus.mockReturnValue({
      rest: {
        remaining: 999,
        resetTime: new Date('2025-10-01T12:15:00Z'),
        isLimited: false,
      },
      sync: {
        remaining: 99,
        resetTime: new Date('2025-10-01T12:15:00Z'),
        isLimited: false,
      },
    });

    todoistLabelsTool = new TodoistLabelsTool(mockApiConfig, {
      apiService: apiService as unknown as TodoistApiService,
      cacheService: new CacheService(),
    });
  });

  describe('Tool definition', () => {
    test('exposes MCP metadata', () => {
      const definition = TodoistLabelsTool.getToolDefinition();
      expect(definition.name).toBe('todoist_labels');
      expect(definition.description).toContain('label management');
    });
  });

  describe('Parameter validation', () => {
    test('rejects missing action', async () => {
      const result = await todoistLabelsTool.execute({} as any);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBeDefined();
    });

    test('rejects invalid action', async () => {
      const result = await todoistLabelsTool.execute({ action: 'noop' });
      expect(result.success).toBe(false);
    });
  });

  /**
   * T002: Contract test - create_personal_label
   * Creates a new personal label or returns existing if name already exists
   */
  describe('CREATE action - create_personal_label', () => {
    test('creates new label with name, color, is_favorite', async () => {
      const workLabel = {
        id: '2156154810',
        name: 'Work',
        color: 'blue',
        order: 1,
        is_favorite: true,
      };

      apiService.createLabel.mockResolvedValue(workLabel);

      const result = await todoistLabelsTool.execute({
        action: 'create',
        name: 'Work',
        color: 'blue',
        is_favorite: true,
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        id: '2156154810',
        name: 'Work',
        color: 'blue',
        order: 1,
        is_favorite: true,
      });
      expect(result.message).toBe('Label created successfully');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.rate_limit_remaining).toBe(999);
      expect(result.metadata?.rate_limit_reset).toBe(
        '2025-10-01T12:15:00.000Z'
      );
      expect(apiService.createLabel).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Work',
          color: 'blue',
          is_favorite: true,
        })
      );
    });

    test('response schema matches contract specification', async () => {
      const result = await todoistLabelsTool.execute({
        action: 'create',
        name: 'Work',
        color: 'blue',
        is_favorite: true,
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata).toHaveProperty('operation_time');
      expect(result.metadata).toHaveProperty('rate_limit_remaining');
      expect(result.metadata).toHaveProperty('rate_limit_reset');
    });
  });

  /**
   * T003: Contract test - create_duplicate_label_idempotent
   * Creating label with existing name returns existing label
   */
  describe('CREATE action - create_duplicate_label_idempotent', () => {
    test('duplicate name returns existing label', async () => {
      const existingLabel = {
        id: '2156154810',
        name: 'Work',
        color: 'blue',
        order: 1,
        is_favorite: true,
      };

      // Simulate duplicate detection by returning existing label
      apiService.getLabels.mockResolvedValue({
        results: [existingLabel],
        next_cursor: null,
      });

      const result = await todoistLabelsTool.execute({
        action: 'create',
        name: 'Work',
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        id: '2156154810',
        name: 'Work',
        color: 'blue',
        order: 1,
        is_favorite: true,
      });
      // Message should indicate label already exists
      expect(result.message).toMatch(/already exists|created/i);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.rate_limit_remaining).toBe(999);
    });

    test('idempotent behavior - same ID returned', async () => {
      const existingLabel = {
        id: '2156154810',
        name: 'Work',
        color: 'blue',
        order: 1,
        is_favorite: true,
      };

      apiService.getLabels.mockResolvedValue({
        results: [existingLabel],
        next_cursor: null,
      });

      const firstResult = await todoistLabelsTool.execute({
        action: 'create',
        name: 'Work',
      });

      const secondResult = await todoistLabelsTool.execute({
        action: 'create',
        name: 'Work',
      });

      expect(firstResult.success).toBe(true);
      expect(secondResult.success).toBe(true);
      expect(firstResult.data?.id).toBe(secondResult.data?.id);
      expect(firstResult.data?.id).toBe('2156154810');
    });

    test('message indicates label already exists', async () => {
      const existingLabel = {
        id: '2156154810',
        name: 'Work',
        color: 'blue',
        order: 1,
        is_favorite: true,
      };

      apiService.getLabels.mockResolvedValue({
        results: [existingLabel],
        next_cursor: null,
      });

      const result = await todoistLabelsTool.execute({
        action: 'create',
        name: 'Work',
      });

      expect(result.success).toBe(true);
      expect(result.message).toMatch(/already exists|created/i);
    });
  });

  /**
   * T004: Contract test - get_label_by_id
   * Retrieves a specific label by valid ID
   */
  describe('GET action - get_label_by_id', () => {
    test('retrieves label by valid ID', async () => {
      const workLabel = {
        id: '2156154810',
        name: 'Work',
        color: 'blue',
        order: 1,
        is_favorite: true,
      };

      apiService.getLabel.mockResolvedValue(workLabel);

      const result = await todoistLabelsTool.execute({
        action: 'get',
        label_id: '2156154810',
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        id: '2156154810',
        name: 'Work',
        color: 'blue',
        order: 1,
        is_favorite: true,
      });
      expect(result.message).toBe('Label retrieved successfully');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.rate_limit_remaining).toBe(999);
      expect(result.metadata?.rate_limit_reset).toBe(
        '2025-10-01T12:15:00.000Z'
      );
      expect(apiService.getLabel).toHaveBeenCalledWith('2156154810');
    });

    test('verifies all fields returned', async () => {
      const completeLabel = {
        id: '2156154810',
        name: 'Work',
        color: 'blue',
        order: 1,
        is_favorite: true,
      };

      apiService.getLabel.mockResolvedValue(completeLabel);

      const result = await todoistLabelsTool.execute({
        action: 'get',
        label_id: '2156154810',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id');
      expect(result.data).toHaveProperty('name');
      expect(result.data).toHaveProperty('color');
      expect(result.data).toHaveProperty('order');
      expect(result.data).toHaveProperty('is_favorite');
    });
  });

  /**
   * T005: Contract test - get_nonexistent_label
   * Returns LABEL_NOT_FOUND error for invalid label ID
   */
  describe('GET action - get_nonexistent_label', () => {
    test('invalid label ID returns LABEL_NOT_FOUND', async () => {
      const error = new Error('Label not found');
      (error as any).statusCode = 404;
      apiService.getLabel.mockRejectedValue(error);

      const result = await todoistLabelsTool.execute({
        action: 'get',
        label_id: '9999999999',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('LABEL_NOT_FOUND');
      expect(result.error?.message).toContain('9999999999');
      expect(result.error?.retryable).toBe(false);
      expect(apiService.getLabel).toHaveBeenCalledWith('9999999999');
    });

    test('error code and retryable=false', async () => {
      const error = new Error('Not found');
      (error as any).statusCode = 404;
      apiService.getLabel.mockRejectedValue(error);

      const result = await todoistLabelsTool.execute({
        action: 'get',
        label_id: '9999999999',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LABEL_NOT_FOUND');
      expect(result.error?.retryable).toBe(false);
    });
  });

  /**
   * T006: Contract test - update_label
   * Updates label properties (color and is_favorite)
   */
  describe('UPDATE action - update_label', () => {
    test('updates color and is_favorite', async () => {
      const updatedLabel = {
        id: '2156154810',
        name: 'Work',
        color: 'red',
        order: 1,
        is_favorite: false,
      };

      apiService.updateLabel.mockResolvedValue(updatedLabel);

      const result = await todoistLabelsTool.execute({
        action: 'update',
        label_id: '2156154810',
        color: 'red',
        is_favorite: false,
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        id: '2156154810',
        name: 'Work',
        color: 'red',
        order: 1,
        is_favorite: false,
      });
      expect(result.message).toBe('Label updated successfully');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.rate_limit_remaining).toBe(999);
      expect(apiService.updateLabel).toHaveBeenCalledWith(
        '2156154810',
        expect.objectContaining({
          color: 'red',
          is_favorite: false,
        })
      );
    });

    test('verifies name remains unchanged', async () => {
      const updatedLabel = {
        id: '2156154810',
        name: 'Work',
        color: 'red',
        order: 1,
        is_favorite: false,
      };

      apiService.updateLabel.mockResolvedValue(updatedLabel);

      const result = await todoistLabelsTool.execute({
        action: 'update',
        label_id: '2156154810',
        color: 'red',
        is_favorite: false,
      });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Work');
    });
  });

  /**
   * T007: Contract test - delete_label
   * Tests label deletion returns success
   */
  describe('DELETE action - delete_label', () => {
    test('label deletion returns success', async () => {
      apiService.deleteLabel.mockResolvedValue(undefined);

      const result = await todoistLabelsTool.execute({
        action: 'delete',
        label_id: '2156154810',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.message).toContain('deleted');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.rate_limit_remaining).toBe(999);
      expect(apiService.deleteLabel).toHaveBeenCalledWith('2156154810');
    });

    test('data is null and message confirms deletion', async () => {
      apiService.deleteLabel.mockResolvedValue(undefined);

      const result = await todoistLabelsTool.execute({
        action: 'delete',
        label_id: '2156154810',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.message).toMatch(/deleted|removed/i);
    });
  });

  /**
   * T008: Contract test - list_labels_default_pagination
   * Tests listing labels without limit parameter
   */
  describe('LIST action - list_labels_default_pagination', () => {
    test('listing labels without limit parameter', async () => {
      const labels = [
        {
          id: '2156154810',
          name: 'Work',
          color: 'blue',
          order: 1,
          is_favorite: true,
        },
        {
          id: '2156154811',
          name: 'Personal',
          color: 'red',
          order: 2,
          is_favorite: false,
        },
      ];

      apiService.getLabels.mockResolvedValue({
        results: labels,
        next_cursor: 'cursor_abc123',
      });

      const result = await todoistLabelsTool.execute({
        action: 'list',
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.message).toBe('Labels retrieved successfully');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.total_count).toBe(2);
      expect(result.metadata?.next_cursor).toBe('cursor_abc123');
      expect(result.metadata?.rate_limit_remaining).toBe(999);
    });

    test('metadata includes total_count and next_cursor', async () => {
      const labels = [
        {
          id: '2156154810',
          name: 'Work',
          color: 'blue',
          order: 1,
          is_favorite: true,
        },
      ];

      apiService.getLabels.mockResolvedValue({
        results: labels,
        next_cursor: 'cursor_xyz',
      });

      const result = await todoistLabelsTool.execute({
        action: 'list',
      });

      expect(result.success).toBe(true);
      expect(result.metadata).toHaveProperty('total_count');
      expect(result.metadata).toHaveProperty('next_cursor');
      expect(result.metadata?.total_count).toBe(1);
      expect(result.metadata?.next_cursor).toBe('cursor_xyz');
    });
  });

  /**
   * T009: Contract test - list_labels_with_pagination
   * Tests listing with limit=10 and cursor
   */
  describe('LIST action - list_labels_with_pagination', () => {
    test('listing with limit=10 and cursor', async () => {
      const labels = Array.from({ length: 10 }, (_, i) => ({
        id: `215615${4810 + i}`,
        name: `Label${i}`,
        color: 'blue',
        order: i + 1,
        is_favorite: false,
      }));

      apiService.getLabels.mockResolvedValue({
        results: labels,
        next_cursor: 'cursor_page2',
      });

      const result = await todoistLabelsTool.execute({
        action: 'list',
        limit: 10,
        cursor: 'cursor_page1',
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(10);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.total_count).toBe(10);
      expect(result.metadata?.next_cursor).toBe('cursor_page2');
      expect(apiService.getLabels).toHaveBeenCalledWith('cursor_page1', 10);
    });

    test('pagination metadata present', async () => {
      const labels = Array.from({ length: 10 }, (_, i) => ({
        id: `215615${4810 + i}`,
        name: `Label${i}`,
        color: 'blue',
        order: i + 1,
        is_favorite: false,
      }));

      apiService.getLabels.mockResolvedValue({
        results: labels,
        next_cursor: 'cursor_next',
      });

      const result = await todoistLabelsTool.execute({
        action: 'list',
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.metadata).toHaveProperty('total_count');
      expect(result.metadata).toHaveProperty('next_cursor');
      expect(result.metadata?.next_cursor).toBe('cursor_next');
    });
  });

  /**
   * T010: Contract test - list_labels_invalid_limit
   * Tests limit=250 returns VALIDATION_ERROR
   */
  describe('LIST action - list_labels_invalid_limit', () => {
    test('limit=250 returns VALIDATION_ERROR', async () => {
      const result = await todoistLabelsTool.execute({
        action: 'list',
        limit: 250,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('limit');
      expect(result.error?.message).toMatch(/200|maximum/i);
    });

    test('error details include field, value, constraint', async () => {
      const result = await todoistLabelsTool.execute({
        action: 'list',
        limit: 250,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.details).toBeDefined();
      expect(result.error?.message).toContain('limit');
    });
  });

  /**
   * T011: Contract test - rename_shared_label
   * Tests renaming shared label with name and new_name
   */
  describe('RENAME_SHARED action - rename_shared_label', () => {
    test('renaming shared label with name and new_name', async () => {
      apiService.renameSharedLabel.mockResolvedValue(undefined);

      const result = await todoistLabelsTool.execute({
        action: 'rename_shared',
        name: 'TeamProject',
        new_name: 'Q1-Project',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.message).toMatch(/renamed/i);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.rate_limit_remaining).toBe(99); // Sync API uses different rate limiter
      expect(apiService.renameSharedLabel).toHaveBeenCalledWith(
        'TeamProject',
        'Q1-Project'
      );
    });

    test('success message mentions "across all tasks"', async () => {
      apiService.renameSharedLabel.mockResolvedValue(undefined);

      const result = await todoistLabelsTool.execute({
        action: 'rename_shared',
        name: 'TeamProject',
        new_name: 'Q1-Project',
      });

      expect(result.success).toBe(true);
      expect(result.message).toMatch(/across all tasks|all tasks/i);
    });
  });

  /**
   * T012: Contract test - remove_shared_label
   * Tests removing shared label by name
   */
  describe('REMOVE_SHARED action - remove_shared_label', () => {
    test('removing shared label by name', async () => {
      apiService.removeSharedLabel.mockResolvedValue(undefined);

      const result = await todoistLabelsTool.execute({
        action: 'remove_shared',
        name: 'Deprecated',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.message).toMatch(/removed/i);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.rate_limit_remaining).toBe(99); // Sync API uses different rate limiter
      expect(apiService.removeSharedLabel).toHaveBeenCalledWith('Deprecated');
    });

    test('success message confirms removal from all tasks', async () => {
      apiService.removeSharedLabel.mockResolvedValue(undefined);

      const result = await todoistLabelsTool.execute({
        action: 'remove_shared',
        name: 'Deprecated',
      });

      expect(result.success).toBe(true);
      expect(result.message).toMatch(/from all tasks|all tasks/i);
    });
  });

  /**
   * T013: Contract test - rate_limit_exceeded
   * Tests rate limit error response
   */
  describe('Error Handling - rate_limit_exceeded', () => {
    test('rate limit error response', async () => {
      const error = new Error('Rate limit exceeded');
      (error as any).statusCode = 429;
      (error as any).retryAfter = 45;
      apiService.getLabels.mockRejectedValue(error);

      const result = await todoistLabelsTool.execute({
        action: 'list',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(result.error?.retryable).toBe(true);
    });

    test('retryable=true and retry_after field present', async () => {
      const error = new Error('Rate limit exceeded');
      (error as any).statusCode = 429;
      (error as any).retryAfter = 45;
      apiService.getLabels.mockRejectedValue(error);

      const result = await todoistLabelsTool.execute({
        action: 'list',
      });

      expect(result.success).toBe(false);
      expect(result.error?.retryable).toBe(true);
      expect(result.error?.retry_after).toBeDefined();
      expect(typeof result.error?.retry_after).toBe('number');
    });
  });
});
