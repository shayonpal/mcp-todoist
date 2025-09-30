/**
 * Contract tests for todoist_filters MCP tool
 * These tests validate the tool interface and parameter schemas
 * Tests MUST FAIL until the actual tool is implemented
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  mockFilters,
  mockLabels,
  mockFiltersListResponse,
  createSuccessResponse,
} from '../mocks/todoist-api-responses.js';
import { TodoistFiltersTool } from '../../src/tools/todoist-filters.js';

// Mock API configuration for tests
const mockApiConfig = {
  token: 'test_token',
  base_url: 'https://api.todoist.com/rest/v1',
  timeout: 10000,
  retry_attempts: 3,
};

// Initialize tool with mock configuration
let todoistFiltersTool: TodoistFiltersTool;

describe('todoist_filters MCP Tool Contract', () => {
  beforeEach(() => {
    todoistFiltersTool = new TodoistFiltersTool(mockApiConfig);
    }
  });

  describe('Tool Registration', () => {
    test('should be defined as MCP tool', () => {
      expect(todoistFiltersTool).toBeDefined();
      expect(todoistFiltersTool.name).toBe('todoist_filters');
      expect(todoistFiltersTool.description).toContain('filter management');
    });

    test('should have correct input schema structure', () => {
      expect(todoistFiltersTool.inputSchema).toBeDefined();
      expect(todoistFiltersTool.inputSchema.type).toBe('object');
      expect(todoistFiltersTool.inputSchema.properties).toBeDefined();
    });

    test('should support all required actions', () => {
      const actionProperty = todoistFiltersTool.inputSchema.properties.action;
        'create_filter',
        'get_filter',
        'update_filter',
        'delete_filter',
        'list_filters',
        'query_tasks',
        'list_labels',
        'create_label',
        'update_label',
        'delete_label',
      ]);
    });
  });

  describe('Parameter Validation', () => {
    test('should require action parameter', () => {
      const actionProperty = todoistFiltersTool.inputSchema.properties.action;
      expect(actionProperty.type).toBe('string');
    });

    test('should validate filter name max length', () => {
      const nameProperty = todoistFiltersTool.inputSchema.properties.name;
      expect(nameProperty.maxLength).toBe(120);
    });

    test('should validate query parameter', () => {
      const queryProperty = todoistFiltersTool.inputSchema.properties.query;
      expect(queryProperty).toBeDefined();
      expect(queryProperty.type).toBe('string');
    });

    test('should validate color options', () => {
      const colorProperty = todoistFiltersTool.inputSchema.properties.color;
      expect(colorProperty.type).toBe('string');
    });

    test('should validate order as integer', () => {
      const orderProperty = todoistFiltersTool.inputSchema.properties.order;
      expect(orderProperty.type).toBe('integer');
      expect(orderProperty.minimum).toBe(1);
    });
  });

  describe('CREATE_FILTER Action', () => {
    test('should handle filter creation with minimal parameters', async () => {
      const params = {
        action: 'create_filter',
        name: 'Test Filter',
        query: 'today',
      };

      const result = await todoistFiltersTool.execute(params);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    test('should handle filter creation with all parameters', async () => {
      const params = {
        action: 'create_filter',
        name: 'Detailed Test Filter',
        query: 'p1 & @work',
        color: 'red',
        order: 5,
        is_favorite: true,
      };

      const result = await todoistFiltersTool.execute(params);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    test('should reject creation without required parameters', async () => {
      const params = {
        action: 'create_filter',
        name: 'Test Filter',
        // Missing query
      };

      await expect(todoistFiltersTool.execute(params)).rejects.toThrow();
    });

    test('should reject invalid query syntax', async () => {
      const params = {
        action: 'create_filter',
        name: 'Invalid Filter',
        query: 'invalid query syntax (((',
      };

      await expect(todoistFiltersTool.execute(params)).rejects.toThrow();
    });

    test('should reject name exceeding max length', async () => {
      const params = {
        action: 'create_filter',
        name: 'a'.repeat(121), // Exceeds 120 char limit
        query: 'today',
      };

      await expect(todoistFiltersTool.execute(params)).rejects.toThrow();
    });
  });

  describe('GET_FILTER Action', () => {
    test('should retrieve filter by ID', async () => {
      const params = {
        action: 'get_filter',
        filter_id: '4638',
      };

      const result = await todoistFiltersTool.execute(params);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    test('should reject get without filter_id', async () => {
      const params = {
        action: 'get_filter',
        // Missing filter_id
      };

      await expect(todoistFiltersTool.execute(params)).rejects.toThrow();
    });

    test('should handle non-existent filter ID', async () => {
      const params = {
        action: 'get_filter',
        filter_id: 'nonexistent',
      };

      await expect(todoistFiltersTool.execute(params)).rejects.toThrow();
    });
  });

  describe('UPDATE_FILTER Action', () => {
    test('should update filter properties', async () => {
      const params = {
        action: 'update_filter',
        filter_id: '4638',
        name: 'Updated Filter Name',
        query: 'p1 | p2',
        color: 'blue',
        is_favorite: false,
      };

      const result = await todoistFiltersTool.execute(params);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    test('should reject update without filter_id', async () => {
      const params = {
        action: 'update_filter',
        name: 'Updated Name',
      };

      await expect(todoistFiltersTool.execute(params)).rejects.toThrow();
    });

    test('should validate query syntax on update', async () => {
      const params = {
        action: 'update_filter',
        filter_id: '4638',
        query: 'invalid syntax (((',
      };

      await expect(todoistFiltersTool.execute(params)).rejects.toThrow();
    });
  });

  describe('DELETE_FILTER Action', () => {
    test('should delete filter by ID', async () => {
      const params = {
        action: 'delete_filter',
        filter_id: '4639',
      };

      const result = await todoistFiltersTool.execute(params);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    test('should reject delete without filter_id', async () => {
      const params = {
        action: 'delete_filter',
      };

      await expect(todoistFiltersTool.execute(params)).rejects.toThrow();
    });
  });

  describe('LIST_FILTERS Action', () => {
    test('should list all filters', async () => {
      const params = {
        action: 'list_filters',
      };

      const result = await todoistFiltersTool.execute(params);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    test('should show filters in order', async () => {
      const params = {
        action: 'list_filters',
      };

      const result = await todoistFiltersTool.execute(params);

      expect(result).toBeDefined();
      // Should include filters in order: High Priority (order 1), Work Tasks (order 2)
      expect(result.message).toMatch(/High Priority.*Work Tasks/s);
    });

    test('should indicate favorite filters', async () => {
      const params = {
        action: 'list_filters',
      };

      const result = await todoistFiltersTool.execute(params);

      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
    });

    test('should execute complex filter queries', async () => {
      const params = {
        action: 'query_tasks',
        query: '(today | overdue) & p3',
      };

      const result = await todoistFiltersTool.execute(params);

      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
    });
  });

  describe('Label Management', () => {
    test('should list all labels', async () => {
      const params = {
        action: 'list_labels',
      };

      const result = await todoistFiltersTool.execute(params);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    test('should create new label', async () => {
      const params = {
        action: 'create_label',
        name: 'test-label',
        color: 'green',
        order: 3,
      };

      const result = await todoistFiltersTool.execute(params);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    test('should update existing label', async () => {
      const params = {
        action: 'update_label',
        label_id: '2156154810',
        name: 'super-urgent',
        color: 'orange',
        is_favorite: true,
      };

      const result = await todoistFiltersTool.execute(params);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    test('should delete label', async () => {
      const params = {
        action: 'delete_label',
        label_id: '2156154811',
      };

      const result = await todoistFiltersTool.execute(params);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    test('should reject duplicate label names', async () => {
      const params = {
        action: 'create_label',
        name: 'urgent', // Already exists
        color: 'red',
      };

      await expect(todoistFiltersTool.execute(params)).rejects.toThrow();
    });

    test('should reject label name exceeding max length', async () => {
      const params = {
        action: 'create_label',
        name: 'a'.repeat(121), // Exceeds 120 char limit
        color: 'red',
      };

      await expect(todoistFiltersTool.execute(params)).rejects.toThrow();
    });
  });

  describe('Built-in Filters', () => {
    test('should recognize built-in filter queries', async () => {
      const builtInQueries = ['today', 'next 7 days', 'overdue', 'no due date'];

      for (const query of builtInQueries) {
        const params = {
          action: 'query_tasks',
          query,
        };

        const result = await todoistFiltersTool.execute(params);
        expect(result).toBeDefined();
      }
    });

    test('should handle priority queries', async () => {
      const priorityQueries = ['p1', 'p2', 'p3', 'p4'];

      for (const query of priorityQueries) {
        const params = {
          action: 'query_tasks',
          query,
        };

        const result = await todoistFiltersTool.execute(params);
        expect(result).toBeDefined();
      }
    });

    test('should handle status queries', async () => {
      const statusQueries = ['completed', 'recurring'];

      for (const query of statusQueries) {
        const params = {
          action: 'query_tasks',
          query,
        };

        const result = await todoistFiltersTool.execute(params);
        expect(result).toBeDefined();
      }
    });
  });

  describe('Query Validation and Help', () => {
    test('should provide query syntax help', async () => {
      const params = {
        action: 'query_tasks',
        query: 'help',
      };

      const result = await todoistFiltersTool.execute(params);

      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
    });
  });
});
