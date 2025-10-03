import { describe, test, expect, beforeEach } from '@jest/globals';
import { TodoistFiltersTool } from '../../src/tools/todoist-filters.js';
import { TodoistApiService } from '../../src/services/todoist-api.js';
import {
  FiltersApiMock,
  createFiltersApiMock,
  toTodoistFilter,
} from '../helpers/mockTodoistApiService.js';
import { mockFilters } from '../mocks/todoist-api-responses.js';

const mockApiConfig = {
  token: 'test_token_123456',
  base_url: 'https://api.todoist.com/rest/v1',
  timeout: 10000,
  retry_attempts: 3,
};

describe('todoist_filters MCP Tool Contract', () => {
  let apiService: FiltersApiMock;
  let todoistFiltersTool: TodoistFiltersTool;

  beforeEach(() => {
    const filter = toTodoistFilter(mockFilters.filter1);
    apiService = createFiltersApiMock();
    apiService.createFilter.mockResolvedValue(filter);
    apiService.updateFilter.mockResolvedValue({
      ...filter,
      name: 'Updated Filter',
    });

    todoistFiltersTool = new TodoistFiltersTool(mockApiConfig, {
      apiService: apiService as unknown as TodoistApiService,
    });
  });

  describe('Tool definition', () => {
    test('exposes metadata', () => {
      const definition = TodoistFiltersTool.getToolDefinition();
      expect(definition.name).toBe('todoist_filters');
      expect(definition.description).toContain('filters');
    });
  });

  describe('Validation', () => {
    test('rejects missing action', async () => {
      const result = await todoistFiltersTool.execute({} as any);
      expect(result.success).toBe(false);
    });

    test('rejects invalid action', async () => {
      const result = await todoistFiltersTool.execute({ action: 'noop' });
      expect(result.success).toBe(false);
    });
  });

  describe('CREATE action', () => {
    test('creates a new filter', async () => {
      const result = await todoistFiltersTool.execute({
        action: 'create_filter',
        name: 'High Priority',
        query: 'p1',
        color: 'red',
        is_favorite: true,
      });

      expect(result.success).toBe(true);
      expect(apiService.createFilter).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'High Priority', query: 'p1' })
      );
    });
  });

  describe('GET action', () => {
    test('retrieves a filter', async () => {
      const result = await todoistFiltersTool.execute({
        action: 'get_filter',
        filter_id: '4638',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(apiService.getFilter).toHaveBeenCalledWith('4638');
    });
  });

  describe('LIST action', () => {
    test('lists filters', async () => {
      const result = await todoistFiltersTool.execute({
        action: 'list_filters',
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(apiService.getFilters).toHaveBeenCalled();
    });
  });

  describe('UPDATE action', () => {
    test('updates a filter', async () => {
      const result = await todoistFiltersTool.execute({
        action: 'update_filter',
        filter_id: '4638',
        name: 'Updated Filter',
        query: 'overdue',
      });

      expect(result.success).toBe(true);
      expect(apiService.updateFilter).toHaveBeenCalledWith(
        '4638',
        expect.objectContaining({ name: 'Updated Filter', query: 'overdue' })
      );
    });
  });

  describe('DELETE action', () => {
    test('deletes filter', async () => {
      const result = await todoistFiltersTool.execute({
        action: 'delete_filter',
        filter_id: '4638',
      });

      expect(result.success).toBe(true);
      expect(apiService.deleteFilter).toHaveBeenCalledWith('4638');
    });
  });
});
