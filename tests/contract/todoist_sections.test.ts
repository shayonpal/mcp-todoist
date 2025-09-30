import { describe, test, expect, beforeEach } from '@jest/globals';
import { TodoistSectionsTool } from '../../src/tools/todoist-sections.js';
import { CacheService } from '../../src/services/cache.js';
import { TodoistApiService } from '../../src/services/todoist-api.js';
import {
  SectionsApiMock,
  createSectionsApiMock,
  toTodoistSection,
} from '../helpers/mockTodoistApiService.js';
import { mockSections } from '../mocks/todoist-api-responses.js';

const mockApiConfig = {
  token: 'test_token',
  base_url: 'https://api.todoist.com/rest/v1',
  timeout: 10000,
  retry_attempts: 3,
};

describe('todoist_sections MCP Tool Contract', () => {
  let apiService: SectionsApiMock;
  let todoistSectionsTool: TodoistSectionsTool;

  beforeEach(() => {
    const section = toTodoistSection(mockSections.section1);
    apiService = createSectionsApiMock();
    apiService.createSection.mockResolvedValue(section);
    apiService.updateSection.mockResolvedValue({
      ...section,
      name: 'Updated Section',
    });

    todoistSectionsTool = new TodoistSectionsTool(mockApiConfig, {
      apiService: apiService as unknown as TodoistApiService,
      cacheService: new CacheService(),
    });
  });

  describe('Tool definition', () => {
    test('exposes MCP metadata', () => {
      const definition = TodoistSectionsTool.getToolDefinition();
      expect(definition.name).toBe('todoist_sections');
      expect(definition.description.toLowerCase()).toContain('section');
    });
  });

  describe('Parameter validation', () => {
    test('rejects missing action', async () => {
      const result = await todoistSectionsTool.execute({} as any);
      expect(result.success).toBe(false);
    });

    test('rejects invalid action', async () => {
      const result = await todoistSectionsTool.execute({ action: 'noop' });
      expect(result.success).toBe(false);
    });
  });

  describe('CREATE action', () => {
    test('creates section with minimal fields', async () => {
      const result = await todoistSectionsTool.execute({
        action: 'create',
        name: 'Test Section',
        project_id: '220474322',
      });

      expect(result.success).toBe(true);
      expect(apiService.createSection).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Section',
          project_id: '220474322',
        })
      );
    });

    test('validates required fields', async () => {
      const result = await todoistSectionsTool.execute({
        action: 'create',
        project_id: '220474322',
      } as any);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET action', () => {
    test('retrieves section by id', async () => {
      const result = await todoistSectionsTool.execute({
        action: 'get',
        section_id: '7025',
      });

      expect(apiService.getSection).toHaveBeenCalledWith('7025');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('UPDATE action', () => {
    test('updates section fields', async () => {
      const result = await todoistSectionsTool.execute({
        action: 'update',
        section_id: '7025',
        name: 'Updated Section',
      });

      expect(result.success).toBe(true);
      expect(apiService.updateSection).toHaveBeenCalledWith(
        '7025',
        expect.objectContaining({ name: 'Updated Section' })
      );
    });
  });

  describe('DELETE action', () => {
    test('deletes section by id', async () => {
      const result = await todoistSectionsTool.execute({
        action: 'delete',
        section_id: '7025',
      });

      expect(result.success).toBe(true);
      expect(apiService.deleteSection).toHaveBeenCalledWith('7025');
    });
  });

  describe('LIST action', () => {
    test('lists sections for a project', async () => {
      const result = await todoistSectionsTool.execute({
        action: 'list',
        project_id: '220474322',
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(apiService.getSections).toHaveBeenCalledWith('220474322');
    });
  });
});
