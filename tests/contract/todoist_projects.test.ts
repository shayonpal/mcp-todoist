import { describe, test, expect, beforeEach } from '@jest/globals';
import { TodoistProjectsTool } from '../../src/tools/todoist-projects.js';
import { CacheService } from '../../src/services/cache.js';
import { TodoistApiService } from '../../src/services/todoist-api.js';
import {
  ProjectsApiMock,
  createProjectsApiMock,
  toTodoistProject,
} from '../helpers/mockTodoistApiService.js';
import { mockProjects } from '../mocks/todoist-api-responses.js';

const mockApiConfig = {
  token: 'test_token_123456',
  base_url: 'https://api.todoist.com/rest/v1',
  timeout: 10000,
  retry_attempts: 3,
};

describe('todoist_projects MCP Tool Contract', () => {
  let apiService: ProjectsApiMock;
  let todoistProjectsTool: TodoistProjectsTool;

  beforeEach(() => {
    const project = toTodoistProject(mockProjects.inbox);
    apiService = createProjectsApiMock();
    apiService.createProject.mockResolvedValue(project);
    apiService.updateProject.mockResolvedValue({
      ...project,
      name: 'Updated Project Name',
    });

    todoistProjectsTool = new TodoistProjectsTool(mockApiConfig, {
      apiService: apiService as unknown as TodoistApiService,
      cacheService: new CacheService(),
    });
  });

  describe('Tool definition', () => {
    test('exposes MCP metadata', () => {
      const definition = TodoistProjectsTool.getToolDefinition();
      expect(definition.name).toBe('todoist_projects');
      expect(definition.description).toContain('project management');
    });
  });

  describe('Parameter validation', () => {
    test('rejects missing action', async () => {
      const result = await todoistProjectsTool.execute({} as any);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBeDefined();
    });

    test('rejects invalid action', async () => {
      const result = await todoistProjectsTool.execute({ action: 'noop' });
      expect(result.success).toBe(false);
    });
  });

  describe('CREATE action', () => {
    test('creates project with defaults', async () => {
      const result = await todoistProjectsTool.execute({
        action: 'create',
        name: 'New Project',
        color: 'charcoal',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(apiService.createProject).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Project' })
      );
    });

    test('validates name length', async () => {
      const result = await todoistProjectsTool.execute({
        action: 'create',
        name: 'a'.repeat(121),
      });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET action', () => {
    test('retrieves project by id', async () => {
      const result = await todoistProjectsTool.execute({
        action: 'get',
        project_id: '220474322',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(apiService.getProject).toHaveBeenCalledWith('220474322');
    });
  });

  describe('UPDATE action', () => {
    test('updates project properties', async () => {
      const result = await todoistProjectsTool.execute({
        action: 'update',
        project_id: '220474322',
        name: 'Updated Project Name',
      });

      expect(result.success).toBe(true);
      expect(apiService.updateProject).toHaveBeenCalledWith(
        '220474322',
        expect.objectContaining({ name: 'Updated Project Name' })
      );
    });
  });

  describe('DELETE action', () => {
    test('deletes project', async () => {
      const result = await todoistProjectsTool.execute({
        action: 'delete',
        project_id: '220474322',
      });

      expect(result.success).toBe(true);
      expect(apiService.deleteProject).toHaveBeenCalledWith('220474322');
    });
  });

  describe('LIST action', () => {
    test('lists all projects', async () => {
      const result = await todoistProjectsTool.execute({ action: 'list' });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(apiService.getProjects).toHaveBeenCalled();
    });
  });
});
