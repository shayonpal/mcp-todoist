import { jest } from '@jest/globals';
import { TodoistApiService } from '../../src/services/todoist-api.js';
import {
  TodoistTask,
  TodoistProject,
  TodoistSection,
  TodoistComment,
  TodoistFilter,
  TodoistLabel,
  TodoistReminder,
} from '../../src/types/todoist.js';
import {
  mockTasks,
  mockProjects,
  mockSections,
  mockComments,
  mockFilters,
  mockLabels,
} from '../mocks/todoist-api-responses.js';

type MockedSubset<K extends keyof TodoistApiService> = {
  [P in K]: jest.MockedFunction<TodoistApiService[P]>;
};

type RateLimitStatus = ReturnType<TodoistApiService['getRateLimitStatus']>;

type TaskShape = (typeof mockTasks)[keyof typeof mockTasks];
type ProjectShape = (typeof mockProjects)[keyof typeof mockProjects];
type SectionShape = (typeof mockSections)[keyof typeof mockSections];
type CommentShape = (typeof mockComments)[keyof typeof mockComments];
type FilterShape = (typeof mockFilters)[keyof typeof mockFilters];
type LabelShape = (typeof mockLabels)[keyof typeof mockLabels];

const createMockFn = <Fn extends (...args: any[]) => any>(
  implementation?: (...args: Parameters<Fn>) => ReturnType<Fn>
): jest.MockedFunction<Fn> =>
  jest.fn(implementation) as unknown as jest.MockedFunction<Fn>;

const defaultRateLimitStatus = (): RateLimitStatus => {
  const resetTime = new Date(Date.now() + 60_000);
  return {
    rest: { remaining: 99, resetTime, isLimited: false },
    sync: { remaining: 99, resetTime, isLimited: false },
  };
};

const merge = <T>(...parts: Array<Partial<T>>): T =>
  Object.assign({}, ...parts) as T;

const createRateLimitMock = (
  overrides: Partial<MockedSubset<'getRateLimitStatus'>> = {}
): MockedSubset<'getRateLimitStatus'> => {
  const getRateLimitStatus =
    createMockFn<TodoistApiService['getRateLimitStatus']>();
  getRateLimitStatus.mockReturnValue(defaultRateLimitStatus());

  return merge({ getRateLimitStatus }, overrides);
};

export const toTodoistTask = (task: TaskShape): TodoistTask => ({
  id: task.id,
  content: task.content,
  description: task.description ?? '',
  project_id: task.project_id,
  section_id: task.section_id ?? undefined,
  parent_id: task.parent_id ?? undefined,
  order: task.order,
  priority: (task.priority as TodoistTask['priority']) ?? 1,
  labels: task.labels ?? [],
  assignee_id: task.assignee_id ?? undefined,
  assigner_id: task.assigner_id ?? undefined,
  comment_count: task.comment_count ?? 0,
  completed: task.completed ?? false,
  due: task.due ?? undefined,
  url: task.url,
  created_at: task.created_at,
  creator_id: task.creator_id,
});

export const toTodoistProject = (project: ProjectShape): TodoistProject => ({
  id: project.id,
  name: project.name,
  comment_count: project.comment_count,
  order: project.order,
  color: project.color,
  is_shared: project.is_shared,
  is_favorite: project.is_favorite,
  is_inbox_project: project.is_inbox_project,
  is_team_inbox: project.is_team_inbox,
  view_style: project.view_style as TodoistProject['view_style'],
  url: project.url,
  parent_id: project.parent_id ?? undefined,
  is_archived: (project as Partial<TodoistProject>).is_archived ?? false,
});

export const toTodoistSection = (section: SectionShape): TodoistSection => ({
  id: section.id,
  project_id: section.project_id,
  order: section.order,
  name: section.name,
});

export const toTodoistComment = (comment: CommentShape): TodoistComment => ({
  id: comment.id,
  task_id: comment.task_id ?? undefined,
  project_id: comment.project_id ?? undefined,
  content: comment.content,
  posted_at: comment.posted_at,
  attachment: comment.attachment ?? undefined,
});

export const toTodoistFilter = (filter: FilterShape): TodoistFilter => ({
  id: filter.id,
  name: filter.name,
  query: filter.query,
  color: filter.color,
  order: filter.order,
  is_favorite: filter.is_favorite,
});

export const toTodoistLabel = (label: LabelShape): TodoistLabel => ({
  id: label.id,
  name: label.name,
  color: label.color,
  order: label.order,
  is_favorite: label.is_favorite,
});

type TasksMockKeys =
  | 'getRateLimitStatus'
  | 'getTasks'
  | 'getTask'
  | 'createTask'
  | 'updateTask'
  | 'deleteTask'
  | 'completeTask'
  | 'reopenTask';

export type TasksApiMock = MockedSubset<TasksMockKeys>;

const buildTasksMocks = (): TasksApiMock => {
  const primaryTask = toTodoistTask(mockTasks.task1);
  const secondaryTask = toTodoistTask(mockTasks.task2);

  const getTasks = createMockFn<TodoistApiService['getTasks']>();
  getTasks.mockResolvedValue({
    results: [primaryTask, secondaryTask],
    next_cursor: null,
  });

  const getTask = createMockFn<TodoistApiService['getTask']>();
  getTask.mockResolvedValue(primaryTask);

  const createTask = createMockFn<TodoistApiService['createTask']>();
  createTask.mockResolvedValue(primaryTask);

  const updateTask = createMockFn<TodoistApiService['updateTask']>();
  updateTask.mockResolvedValue({
    ...primaryTask,
    content: 'Updated task content',
  });

  const deleteTask = createMockFn<TodoistApiService['deleteTask']>();
  deleteTask.mockResolvedValue(undefined);

  const completeTask = createMockFn<TodoistApiService['completeTask']>();
  completeTask.mockResolvedValue(undefined);

  const reopenTask = createMockFn<TodoistApiService['reopenTask']>();
  reopenTask.mockResolvedValue(undefined);

  return {
    ...createRateLimitMock(),
    getTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    reopenTask,
  };
};

export const withTasksMocks = (
  overrides: Partial<TasksApiMock> = {}
): TasksApiMock => merge(buildTasksMocks(), overrides);

export const createTasksApiMock = (
  overrides: Partial<TasksApiMock> = {}
): TasksApiMock => withTasksMocks(overrides);

type ProjectsMockKeys =
  | 'getRateLimitStatus'
  | 'getProjects'
  | 'getProject'
  | 'createProject'
  | 'updateProject'
  | 'deleteProject'
  | 'archiveProject'
  | 'unarchiveProject';

export type ProjectsApiMock = MockedSubset<ProjectsMockKeys>;

const buildProjectsMocks = (): ProjectsApiMock => {
  const inbox = toTodoistProject(mockProjects.inbox);
  const work = toTodoistProject(mockProjects.workProject);

  const getProjects = createMockFn<TodoistApiService['getProjects']>();
  getProjects.mockResolvedValue([inbox, work]);

  const getProject = createMockFn<TodoistApiService['getProject']>();
  getProject.mockResolvedValue(inbox);

  const createProject = createMockFn<TodoistApiService['createProject']>();
  createProject.mockResolvedValue(inbox);

  const updateProject = createMockFn<TodoistApiService['updateProject']>();
  updateProject.mockResolvedValue({ ...inbox, name: 'Updated Project Name' });

  const deleteProject = createMockFn<TodoistApiService['deleteProject']>();
  deleteProject.mockResolvedValue(undefined);

  const archiveProject = createMockFn<TodoistApiService['archiveProject']>();
  archiveProject.mockResolvedValue(undefined);

  const unarchiveProject =
    createMockFn<TodoistApiService['unarchiveProject']>();
  unarchiveProject.mockResolvedValue(undefined);

  return {
    ...createRateLimitMock(),
    getProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
    unarchiveProject,
  };
};

export const withProjectsMocks = (
  overrides: Partial<ProjectsApiMock> = {}
): ProjectsApiMock => merge(buildProjectsMocks(), overrides);

export const createProjectsApiMock = (
  overrides: Partial<ProjectsApiMock> = {}
): ProjectsApiMock => withProjectsMocks(overrides);

type SectionsMockKeys =
  | 'getRateLimitStatus'
  | 'getSections'
  | 'getSection'
  | 'createSection'
  | 'updateSection'
  | 'deleteSection';

export type SectionsApiMock = MockedSubset<SectionsMockKeys>;

const buildSectionsMocks = (): SectionsApiMock => {
  const first = toTodoistSection(mockSections.section1);
  const second = toTodoistSection(mockSections.section2);

  const getSections = createMockFn<TodoistApiService['getSections']>();
  getSections.mockResolvedValue([first, second]);

  const getSection = createMockFn<TodoistApiService['getSection']>();
  getSection.mockResolvedValue(first);

  const createSection = createMockFn<TodoistApiService['createSection']>();
  createSection.mockResolvedValue(first);

  const updateSection = createMockFn<TodoistApiService['updateSection']>();
  updateSection.mockResolvedValue({ ...first, name: 'Updated Section' });

  const deleteSection = createMockFn<TodoistApiService['deleteSection']>();
  deleteSection.mockResolvedValue(undefined);

  return {
    ...createRateLimitMock(),
    getSections,
    getSection,
    createSection,
    updateSection,
    deleteSection,
  };
};

export const withSectionsMocks = (
  overrides: Partial<SectionsApiMock> = {}
): SectionsApiMock => merge(buildSectionsMocks(), overrides);

export const createSectionsApiMock = (
  overrides: Partial<SectionsApiMock> = {}
): SectionsApiMock => withSectionsMocks(overrides);

type CommentsMockKeys =
  | 'getRateLimitStatus'
  | 'createComment'
  | 'getComment'
  | 'updateComment'
  | 'deleteComment'
  | 'getTaskComments'
  | 'getProjectComments';

export type CommentsApiMock = MockedSubset<CommentsMockKeys>;

const buildCommentsMocks = (): CommentsApiMock => {
  const comment = toTodoistComment(mockComments.comment1);
  const projectComment = toTodoistComment(mockComments.comment2);

  const createComment = createMockFn<TodoistApiService['createComment']>();
  createComment.mockResolvedValue(comment);

  const getComment = createMockFn<TodoistApiService['getComment']>();
  getComment.mockResolvedValue(comment);

  const updateComment = createMockFn<TodoistApiService['updateComment']>();
  updateComment.mockResolvedValue({ ...comment, content: 'Updated comment' });

  const deleteComment = createMockFn<TodoistApiService['deleteComment']>();
  deleteComment.mockResolvedValue(undefined);

  const getTaskComments = createMockFn<TodoistApiService['getTaskComments']>();
  getTaskComments.mockResolvedValue([comment]);

  const getProjectComments =
    createMockFn<TodoistApiService['getProjectComments']>();
  getProjectComments.mockResolvedValue([projectComment]);

  return {
    ...createRateLimitMock(),
    createComment,
    getComment,
    updateComment,
    deleteComment,
    getTaskComments,
    getProjectComments,
  };
};

export const withCommentsMocks = (
  overrides: Partial<CommentsApiMock> = {}
): CommentsApiMock => merge(buildCommentsMocks(), overrides);

export const createCommentsApiMock = (
  overrides: Partial<CommentsApiMock> = {}
): CommentsApiMock => withCommentsMocks(overrides);

type FiltersMockKeys =
  | 'getRateLimitStatus'
  | 'getFilters'
  | 'getFilter'
  | 'createFilter'
  | 'updateFilter'
  | 'deleteFilter'
  | 'getTasks';

export type FiltersApiMock = MockedSubset<FiltersMockKeys>;

const buildFiltersMocks = (): FiltersApiMock => {
  const primaryFilter = toTodoistFilter(mockFilters.filter1);
  const secondaryFilter = toTodoistFilter(mockFilters.filter2);
  const task = toTodoistTask(mockTasks.task1);

  const getFilters = createMockFn<TodoistApiService['getFilters']>();
  getFilters.mockResolvedValue([primaryFilter, secondaryFilter]);

  const getFilter = createMockFn<TodoistApiService['getFilter']>();
  getFilter.mockResolvedValue(primaryFilter);

  const createFilter = createMockFn<TodoistApiService['createFilter']>();
  createFilter.mockResolvedValue(primaryFilter);

  const updateFilter = createMockFn<TodoistApiService['updateFilter']>();
  updateFilter.mockResolvedValue({ ...primaryFilter, name: 'Updated Filter' });

  const deleteFilter = createMockFn<TodoistApiService['deleteFilter']>();
  deleteFilter.mockResolvedValue(undefined);

  const getTasks = createMockFn<TodoistApiService['getTasks']>();
  getTasks.mockResolvedValue({
    results: [task],
    next_cursor: null,
  });

  return {
    ...createRateLimitMock(),
    getFilters,
    getFilter,
    createFilter,
    updateFilter,
    deleteFilter,
    getTasks,
  };
};

export const withFiltersMocks = (
  overrides: Partial<FiltersApiMock> = {}
): FiltersApiMock => merge(buildFiltersMocks(), overrides);

export const createFiltersApiMock = (
  overrides: Partial<FiltersApiMock> = {}
): FiltersApiMock => withFiltersMocks(overrides);

type RemindersMockKeys =
  | 'getRateLimitStatus'
  | 'getReminders'
  | 'createReminder'
  | 'updateReminder'
  | 'deleteReminder';

export type RemindersApiMock = MockedSubset<RemindersMockKeys>;

const buildRemindersMocks = (): RemindersApiMock => {
  const reminder: TodoistReminder = {
    id: 'reminder-id',
    item_id: mockTasks.task1.id,
    notify_uid: 'user-1',
    type: 'absolute',
    due: {
      string: 'tomorrow at 10:00',
      is_recurring: false,
      lang: 'en',
    },
    is_deleted: false,
  };

  const getReminders = createMockFn<TodoistApiService['getReminders']>();
  getReminders.mockResolvedValue([reminder]);

  const createReminder = createMockFn<TodoistApiService['createReminder']>();
  createReminder.mockResolvedValue(reminder);

  const updateReminder = createMockFn<TodoistApiService['updateReminder']>();
  updateReminder.mockResolvedValue({
    ...reminder,
    due: {
      string: 'next week at 5pm',
      is_recurring: false,
      lang: 'en',
    },
  });

  const deleteReminder = createMockFn<TodoistApiService['deleteReminder']>();
  deleteReminder.mockResolvedValue(undefined);

  return {
    ...createRateLimitMock(),
    getReminders,
    createReminder,
    updateReminder,
    deleteReminder,
  };
};

export const withRemindersMocks = (
  overrides: Partial<RemindersApiMock> = {}
): RemindersApiMock => merge(buildRemindersMocks(), overrides);

export const createRemindersApiMock = (
  overrides: Partial<RemindersApiMock> = {}
): RemindersApiMock => withRemindersMocks(overrides);
