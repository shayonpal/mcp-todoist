import { describe, test, expect, beforeEach } from '@jest/globals';
import { TodoistCommentsTool } from '../../src/tools/todoist-comments.js';
import { TodoistApiService } from '../../src/services/todoist-api.js';
import {
  CommentsApiMock,
  createCommentsApiMock,
  toTodoistComment,
} from '../helpers/mockTodoistApiService.js';
import { mockComments } from '../mocks/todoist-api-responses.js';

const mockApiConfig = {
  token: 'test_token_123456',
  base_url: 'https://api.todoist.com/rest/v1',
  timeout: 10000,
  retry_attempts: 3,
};

describe('todoist_comments MCP Tool Contract', () => {
  let apiService: CommentsApiMock;
  let todoistCommentsTool: TodoistCommentsTool;

  beforeEach(() => {
    const comment = toTodoistComment(mockComments.comment1);
    apiService = createCommentsApiMock();
    apiService.createComment.mockResolvedValue(comment);
    apiService.updateComment.mockResolvedValue({
      ...comment,
      content: 'Updated comment',
    });

    todoistCommentsTool = new TodoistCommentsTool(mockApiConfig, {
      apiService: apiService as unknown as TodoistApiService,
    });
  });

  describe('Tool definition', () => {
    test('exposes metadata', () => {
      const definition = TodoistCommentsTool.getToolDefinition();
      expect(definition.name).toBe('todoist_comments');
      expect(definition.description).toContain('comments');
    });
  });

  describe('Validation', () => {
    test('rejects missing action', async () => {
      const result = await todoistCommentsTool.execute({} as any);
      expect(result.success).toBe(false);
    });

    test('rejects invalid action', async () => {
      const result = await todoistCommentsTool.execute({ action: 'noop' });
      expect(result.success).toBe(false);
    });
  });

  describe('CREATE action', () => {
    test('creates comment for task', async () => {
      const result = await todoistCommentsTool.execute({
        action: 'create',
        task_id: '2995104339',
        content: 'This needs to be done by Friday',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(apiService.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          task_id: '2995104339',
          content: 'This needs to be done by Friday',
        })
      );
    });
  });

  describe('GET action', () => {
    test('lists comments for task', async () => {
      const result = await todoistCommentsTool.execute({
        action: 'list_by_task',
        task_id: '2995104339',
      });
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(apiService.getTaskComments).toHaveBeenCalledWith('2995104339');
    });
  });

  describe('UPDATE action', () => {
    test('updates comment content', async () => {
      const result = await todoistCommentsTool.execute({
        action: 'update',
        comment_id: '992',
        content: 'Updated comment',
      });

      expect(result.success).toBe(true);
      expect(apiService.updateComment).toHaveBeenCalledWith(
        '992',
        expect.objectContaining({ content: 'Updated comment' })
      );
    });
  });

  describe('DELETE action', () => {
    test('deletes comment', async () => {
      const result = await todoistCommentsTool.execute({
        action: 'delete',
        comment_id: '992',
      });

      expect(result.success).toBe(true);
      expect(apiService.deleteComment).toHaveBeenCalledWith('992');
    });
  });
});
