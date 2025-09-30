import { describe, test, expect } from '@jest/globals';
import {
  createTasksApiMock,
  createProjectsApiMock,
  createSectionsApiMock,
  createCommentsApiMock,
  createFiltersApiMock,
  createRemindersApiMock,
  toTodoistTask,
  toTodoistProject,
  toTodoistSection,
  toTodoistComment,
  toTodoistFilter,
  toTodoistLabel,
} from '../helpers/mockTodoistApiService.js';
import {
  mockTasks,
  mockProjects,
  mockSections,
  mockComments,
  mockFilters,
  mockLabels,
} from '../mocks/todoist-api-responses.js';

describe('mock helpers', () => {
  test('createTasksApiMock exposes essential task methods', async () => {
    const mock = createTasksApiMock();

    await expect(mock.getTasks({})).resolves.toBeDefined();
    await expect(mock.getTask('id')).resolves.toBeDefined();
    await expect(mock.createTask({ content: 'x' })).resolves.toBeDefined();
    await expect(
      mock.updateTask('id', { content: 'y' })
    ).resolves.toBeDefined();

    expect(mock.completeTask).toBeCalledTimes(0);
    await expect(mock.completeTask('id')).resolves.toBeUndefined();
    await expect(mock.reopenTask('id')).resolves.toBeUndefined();
  });

  test('createProjectsApiMock provides CRUD surface', async () => {
    const mock = createProjectsApiMock();

    await expect(mock.getProjects()).resolves.toBeDefined();
    await expect(mock.getProject('id')).resolves.toBeDefined();
    await expect(
      mock.createProject({ name: 'Project' })
    ).resolves.toBeDefined();
    await expect(
      mock.updateProject('id', { name: 'New' })
    ).resolves.toBeDefined();
    await expect(mock.deleteProject('id')).resolves.toBeUndefined();
  });

  test('createSectionsApiMock covers section operations', async () => {
    const mock = createSectionsApiMock();

    await expect(mock.getSections()).resolves.toBeDefined();
    await expect(mock.getSection('id')).resolves.toBeDefined();
    await expect(
      mock.createSection({ name: 'Section', project_id: 'p' })
    ).resolves.toBeDefined();
    await expect(
      mock.updateSection('id', { name: 'Updated' })
    ).resolves.toBeDefined();
    await expect(mock.deleteSection('id')).resolves.toBeUndefined();
  });

  test('createCommentsApiMock scopes to comment behaviours', async () => {
    const mock = createCommentsApiMock();

    await expect(mock.getComment('id')).resolves.toBeDefined();
    await expect(
      mock.createComment({ content: 'Hello' })
    ).resolves.toBeDefined();
    await expect(
      mock.updateComment('id', { content: 'Updated' })
    ).resolves.toBeDefined();
    await expect(mock.deleteComment('id')).resolves.toBeUndefined();
    await expect(mock.getTaskComments('task')).resolves.toBeDefined();
    await expect(mock.getProjectComments('project')).resolves.toBeDefined();
  });

  test('createFiltersApiMock provides filter and task query mocks', async () => {
    const mock = createFiltersApiMock();

    await expect(mock.getFilters()).resolves.toBeDefined();
    await expect(mock.getFilter('id')).resolves.toBeDefined();
    await expect(
      mock.createFilter({ name: 'Filter', query: '#Inbox' })
    ).resolves.toBeDefined();
    await expect(
      mock.updateFilter('id', { query: 'today' })
    ).resolves.toBeDefined();
    await expect(mock.deleteFilter('id')).resolves.toBeUndefined();
    await expect(mock.getTasks({ query: 'today' })).resolves.toBeDefined();
  });

  test('createRemindersApiMock exposes reminder lifecycle', async () => {
    const mock = createRemindersApiMock();

    await expect(mock.getReminders()).resolves.toBeDefined();
    await expect(
      mock.createReminder({ item_id: 'task', type: 'absolute' })
    ).resolves.toBeDefined();
    await expect(
      mock.updateReminder('id', { type: 'relative' })
    ).resolves.toBeDefined();
    await expect(mock.deleteReminder('id')).resolves.toBeUndefined();
  });

  test('entity converters normalise optional properties', () => {
    const task = toTodoistTask(mockTasks.task1);
    expect(task.section_id).toBeDefined();
    expect(task.parent_id).toBeUndefined();

    const project = toTodoistProject(mockProjects.inbox);
    expect(project.parent_id).toBeUndefined();
    expect(project.is_archived).toBe(false);

    const section = toTodoistSection(mockSections.section1);
    expect(section.project_id).toBe(mockSections.section1.project_id);

    const comment = toTodoistComment(mockComments.comment1);
    expect(comment.task_id).toBe(mockComments.comment1.task_id);
    expect(comment.project_id).toBeUndefined();

    const filter = toTodoistFilter(mockFilters.filter1);
    expect(filter.is_favorite).toBe(true);

    const label = toTodoistLabel(mockLabels.label1);
    expect(label.name).toBe('urgent');
  });
});
