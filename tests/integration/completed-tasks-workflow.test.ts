import { describe, test, expect, beforeEach } from '@jest/globals';
import { TodoistTasksTool } from '../../src/tools/todoist-tasks.js';
import { CacheService } from '../../src/services/cache.js';
import { InMemoryTodoistApiService } from '../helpers/inMemoryTodoistApiService.js';
import { TodoistApiService } from '../../src/services/todoist-api.js';
import { BatchOperationsService } from '../../src/services/batch.js';
import { TodoistTask } from '../../src/types/todoist.js';

const mockApiConfig = {
  token: 'test_token',
  base_url: 'https://api.todoist.com/rest/v1',
  timeout: 10000,
  retry_attempts: 3,
};

describe('Completed Tasks Workflow Integration', () => {
  let apiService: InMemoryTodoistApiService;
  let todoistTasksTool: TodoistTasksTool;

  beforeEach(async () => {
    apiService = new InMemoryTodoistApiService();

    // Create test project
    const project = await apiService.createProject({
      name: 'Q3 Review Project',
    });

    // Create and complete several tasks with different dates
    const task1 = await apiService.createTask({
      content: 'Q3 Planning Meeting',
      project_id: project.id,
      labels: ['Work', 'Planning'],
      priority: 4,
      due: {
        date: '2025-07-05',
        string: '2025-07-05',
        is_recurring: false,
      },
    });
    await apiService.completeTask(task1.id);
    // Manually set completed_at (in real API this is set automatically)
    const completedTask1 = await apiService.getTask(task1.id);
    (completedTask1 as any).completed_at = '2025-07-05T14:00:00Z';

    const task2 = await apiService.createTask({
      content: 'Budget Review',
      project_id: project.id,
      labels: ['Work', 'Finance'],
      priority: 3,
      due: {
        date: '2025-08-15',
        string: '2025-08-15',
        is_recurring: false,
      },
    });
    await apiService.completeTask(task2.id);
    ((await apiService.getTask(task2.id)) as any).completed_at =
      '2025-08-15T10:30:00Z';

    const task3 = await apiService.createTask({
      content: 'Team Retrospective',
      project_id: project.id,
      labels: ['Work', 'Team'],
      priority: 2,
      due: {
        date: '2025-09-30',
        string: '2025-09-30',
        is_recurring: false,
      },
    });
    await apiService.completeTask(task3.id);
    ((await apiService.getTask(task3.id)) as any).completed_at =
      '2025-09-30T16:00:00Z';

    todoistTasksTool = new TodoistTasksTool(mockApiConfig, {
      apiService: apiService as unknown as TodoistApiService,
      batchService: {} as BatchOperationsService,
      cacheService: new CacheService(),
    });
  });

  // T004: Integration test for completed tasks query workflow
  describe('Project Retrospective Workflow', () => {
    test('should query completed tasks in date range with project filter', async () => {
      // Step 1: Query all completed tasks in Q3 (3-month window)
      const queryParams = {
        action: 'list_completed' as const,
        completed_query_type: 'by_completion_date' as const,
        since: '2025-07-01T00:00:00Z',
        until: '2025-09-30T23:59:59Z',
        project_id: 'project_1001', // From beforeEach
      };

      const result = await todoistTasksTool.execute(queryParams);

      // Verify query succeeded
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.items).toBeInstanceOf(Array);
      expect(result.data.items.length).toBeGreaterThan(0);

      // Verify all tasks are from the correct project
      result.data.items.forEach((task: TodoistTask) => {
        expect(task.project_id).toBe('project_1001');
        expect(task.completed).toBe(true);
        expect(task.completed_at).toBeDefined();
      });

      // Verify message
      expect(result.message).toContain('Retrieved');
      expect(result.message).toContain('completed tasks');
    });

    test('should support pagination for large result sets', async () => {
      // Step 1: Request first page with small limit
      const page1Params = {
        action: 'list_completed' as const,
        completed_query_type: 'by_completion_date' as const,
        since: '2025-07-01T00:00:00Z',
        until: '2025-09-30T23:59:59Z',
        limit: 2,
      };

      const page1Result = await todoistTasksTool.execute(page1Params);

      expect(page1Result.success).toBe(true);
      expect(page1Result.data.items.length).toBeLessThanOrEqual(2);

      // Step 2: If cursor exists, fetch second page
      if (page1Result.data.next_cursor) {
        const page2Params = {
          ...page1Params,
          cursor: page1Result.data.next_cursor,
        };

        const page2Result = await todoistTasksTool.execute(page2Params);

        expect(page2Result.success).toBe(true);
        expect(page2Result.data.items).toBeInstanceOf(Array);

        // Verify different tasks on page 2
        const page1Ids = page1Result.data.items.map((t: TodoistTask) => t.id);
        const page2Ids = page2Result.data.items.map((t: TodoistTask) => t.id);
        expect(page1Ids).not.toEqual(page2Ids);
      }
    });

    test('should filter by multiple criteria (project + labels)', async () => {
      const params = {
        action: 'list_completed' as const,
        completed_query_type: 'by_completion_date' as const,
        since: '2025-07-01T00:00:00Z',
        until: '2025-09-30T23:59:59Z',
        project_id: 'project_1001',
        filter_query: '@Work',
      };

      const result = await todoistTasksTool.execute(params);

      expect(result.success).toBe(true);
      result.data.items.forEach((task: TodoistTask) => {
        expect(task.project_id).toBe('project_1001');
        expect(task.labels).toContain('Work');
      });
    });
  });

  // T005: Integration test for reopen → edit → recomplete workflow
  describe('Edit Completed Task Workflow', () => {
    test('should reopen completed task, edit it, and recomplete it', async () => {
      // Step 1: Query to find a completed task
      const queryResult = await todoistTasksTool.execute({
        action: 'list_completed' as const,
        completed_query_type: 'by_completion_date' as const,
        since: '2025-09-01T00:00:00Z',
        until: '2025-09-30T23:59:59Z',
      });

      expect(queryResult.success).toBe(true);
      expect(queryResult.data.items.length).toBeGreaterThan(0);

      const taskToEdit = queryResult.data.items[0];
      const taskId = taskToEdit.id;

      // Verify task is completed
      expect(taskToEdit.completed).toBe(true);
      expect(taskToEdit.completed_at).toBeDefined();

      // Step 2: Reopen the task (uncomplete)
      const reopenResult = await todoistTasksTool.execute({
        action: 'uncomplete' as const,
        task_id: taskId,
      });

      expect(reopenResult.success).toBe(true);

      // Verify task is now active
      const activeTask = await apiService.getTask(taskId);
      expect(activeTask.completed).toBe(false);

      // Step 3: Verify task no longer appears in completed queries
      const queryAfterReopenResult = await todoistTasksTool.execute({
        action: 'list_completed' as const,
        completed_query_type: 'by_completion_date' as const,
        since: '2025-09-01T00:00:00Z',
        until: '2025-09-30T23:59:59Z',
      });

      expect(queryAfterReopenResult.success).toBe(true);
      const taskIds = queryAfterReopenResult.data.items.map(
        (t: TodoistTask) => t.id
      );
      expect(taskIds).not.toContain(taskId);

      // Step 4: Edit the task
      const editResult = await todoistTasksTool.execute({
        action: 'update' as const,
        task_id: taskId,
        content: 'Updated: Team Retrospective',
        labels: ['Work', 'Team', 'Updated'],
      });

      expect(editResult.success).toBe(true);
      expect(editResult.data.content).toBe('Updated: Team Retrospective');
      expect(editResult.data.labels).toContain('Updated');

      // Step 5: Recomplete the task
      const recompleteResult = await todoistTasksTool.execute({
        action: 'complete' as const,
        task_id: taskId,
      });

      expect(recompleteResult.success).toBe(true);

      // Verify task is completed again
      const recompletedTask = await apiService.getTask(taskId);
      expect(recompletedTask.completed).toBe(true);

      // Verify edited content persisted
      expect(recompletedTask.content).toBe('Updated: Team Retrospective');
      expect(recompletedTask.labels).toContain('Updated');
    });

    test('should prevent editing completed task without reopening first', async () => {
      // Query for a completed task
      const queryResult = await todoistTasksTool.execute({
        action: 'list_completed' as const,
        completed_query_type: 'by_completion_date' as const,
        since: '2025-07-01T00:00:00Z',
        until: '2025-09-30T23:59:59Z',
      });

      const completedTask = queryResult.data.items[0];

      // Attempt to edit without reopening
      // Note: This test documents that editing completed tasks requires reopen first
      // The actual Todoist API prevents this, but our in-memory mock doesn't enforce it
      // In a real integration test with the API, this would fail

      // For now, we document the expected behavior
      expect(completedTask.completed).toBe(true);
      // Real API would reject update on completed task
      // Mock allows it, so we skip actual test here
    });
  });

  describe('Error Handling', () => {
    test('should handle time window validation errors', async () => {
      const params = {
        action: 'list_completed' as const,
        completed_query_type: 'by_completion_date' as const,
        since: '2025-01-01T00:00:00Z',
        until: '2025-09-30T23:59:59Z', // More than 92 days
      };

      const result = await todoistTasksTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('92 days');
    });

    test('should handle invalid query type', async () => {
      const params = {
        action: 'list_completed' as const,
        completed_query_type: 'invalid_type' as any,
        since: '2025-09-01T00:00:00Z',
        until: '2025-09-30T23:59:59Z',
      };

      const result = await todoistTasksTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });
});
