import { describe, test, beforeEach, expect } from '@jest/globals';
import { TodoistProjectsTool } from '../../src/tools/todoist-projects.js';
import { TodoistSectionsTool } from '../../src/tools/todoist-sections.js';
import { TodoistTasksTool } from '../../src/tools/todoist-tasks.js';
import { CacheService } from '../../src/services/cache.js';
import { BatchOperationsService } from '../../src/services/batch.js';
import { createInMemoryApiService } from '../helpers/inMemoryTodoistApiService.js';

const mockApiConfig = {
  token: 'test_token',
  base_url: 'https://api.todoist.com/rest/v1',
  timeout: 10000,
  retry_attempts: 3,
};

describe('Project workflow integration', () => {
  let projectsTool: TodoistProjectsTool;
  let sectionsTool: TodoistSectionsTool;
  let tasksTool: TodoistTasksTool;
  let apiService: any;

  beforeEach(() => {
    apiService = createInMemoryApiService();
    const cache = new CacheService();
    const batchService = new BatchOperationsService(apiService);

    projectsTool = new TodoistProjectsTool(mockApiConfig, {
      apiService,
      cacheService: cache,
    });
    sectionsTool = new TodoistSectionsTool(mockApiConfig, {
      apiService,
      cacheService: cache,
    });
    tasksTool = new TodoistTasksTool(mockApiConfig, {
      apiService,
      cacheService: cache,
      batchService,
    });
  });

  test('creates project, sections, and tasks end-to-end', async () => {
    const projectResult = await projectsTool.execute({
      action: 'create',
      name: 'Integration Test Project',
      color: 'charcoal',
      view_style: 'list',
    });

    expect(projectResult.success).toBe(true);
    const projectId = (projectResult.data as any).id;

    const sectionResult = await sectionsTool.execute({
      action: 'create',
      name: 'To Do',
      project_id: projectId,
    });
    expect(sectionResult.success).toBe(true);
    const sectionId = (sectionResult.data as any).id;

    const taskResult = await tasksTool.execute({
      action: 'create',
      content: 'First integration task',
      project_id: projectId,
      section_id: sectionId,
    });
    expect(taskResult.success).toBe(true);

    const listResult = await tasksTool.execute({
      action: 'list',
      project_id: projectId,
    });

    expect(listResult.success).toBe(true);
    const tasks = listResult.data as any[];
    expect(tasks.some(task => task.content === 'First integration task')).toBe(
      true
    );
  });
});
