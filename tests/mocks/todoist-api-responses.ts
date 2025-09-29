/**
 * Mock Todoist API responses for testing
 * Based on Todoist REST API v2 documentation
 */

export const mockTasks = {
  task1: {
    id: '2995104339',
    content: 'Buy coffee',
    description: 'Get some good coffee beans',
    project_id: '220474322',
    section_id: '7025',
    parent_id: null,
    order: 1,
    priority: 1,
    labels: ['2156154810'],
    assignee_id: null,
    assigner_id: null,
    comment_count: 0,
    completed: false,
    due: {
      date: '2023-12-01',
      datetime: '2023-12-01T12:00:00.000000Z',
      string: 'Dec 1 12:00 PM',
      timezone: 'America/New_York',
      is_recurring: false,
    },
    url: 'https://todoist.com/showTask?id=2995104339',
    created_at: '2023-11-15T10:00:00.000000Z',
    creator_id: '2671355',
  },
  task2: {
    id: '2995104340',
    content: 'Review code',
    description: '',
    project_id: '220474322',
    section_id: null,
    parent_id: null,
    order: 2,
    priority: 4,
    labels: [],
    assignee_id: null,
    assigner_id: null,
    comment_count: 1,
    completed: false,
    due: null,
    url: 'https://todoist.com/showTask?id=2995104340',
    created_at: '2023-11-15T11:00:00.000000Z',
    creator_id: '2671355',
  },
  completedTask: {
    id: '2995104341',
    content: 'Completed task',
    description: '',
    project_id: '220474322',
    section_id: null,
    parent_id: null,
    order: 3,
    priority: 1,
    labels: [],
    assignee_id: null,
    assigner_id: null,
    comment_count: 0,
    completed: true,
    due: null,
    url: 'https://todoist.com/showTask?id=2995104341',
    created_at: '2023-11-15T09:00:00.000000Z',
    creator_id: '2671355',
  },
};

export const mockProjects = {
  inbox: {
    id: '220474322',
    name: 'Inbox',
    comment_count: 0,
    order: 1,
    color: 'charcoal',
    is_shared: false,
    is_favorite: false,
    is_inbox_project: true,
    is_team_inbox: false,
    view_style: 'list',
    url: 'https://todoist.com/showProject?id=220474322',
    parent_id: null,
  },
  workProject: {
    id: '220474323',
    name: 'Work',
    comment_count: 5,
    order: 2,
    color: 'blue',
    is_shared: true,
    is_favorite: true,
    is_inbox_project: false,
    is_team_inbox: false,
    view_style: 'board',
    url: 'https://todoist.com/showProject?id=220474323',
    parent_id: null,
  },
  subProject: {
    id: '220474324',
    name: 'Development',
    comment_count: 0,
    order: 1,
    color: 'green',
    is_shared: false,
    is_favorite: false,
    is_inbox_project: false,
    is_team_inbox: false,
    view_style: 'list',
    url: 'https://todoist.com/showProject?id=220474324',
    parent_id: '220474323',
  },
};

export const mockSections = {
  section1: {
    id: '7025',
    project_id: '220474322',
    order: 1,
    name: 'To Do',
  },
  section2: {
    id: '7026',
    project_id: '220474322',
    order: 2,
    name: 'In Progress',
  },
  section3: {
    id: '7027',
    project_id: '220474323',
    order: 1,
    name: 'Backlog',
  },
};

export const mockComments = {
  comment1: {
    id: '992',
    task_id: '2995104340',
    project_id: null,
    content: 'This needs to be done by Friday',
    posted_at: '2023-11-15T12:00:00.000000Z',
    attachment: null,
  },
  comment2: {
    id: '993',
    task_id: null,
    project_id: '220474323',
    content: 'Project update: We are on track',
    posted_at: '2023-11-15T13:00:00.000000Z',
    attachment: {
      resource_type: 'file',
      file_url: 'https://cdn.todoist.com/file.pdf',
      file_name: 'report.pdf',
      file_size: 1024768,
      file_type: 'application/pdf',
      upload_state: 'completed',
    },
  },
};

export const mockFilters = {
  filter1: {
    id: '4638',
    name: 'High Priority',
    query: 'p1',
    color: 'red',
    order: 1,
    is_favorite: true,
  },
  filter2: {
    id: '4639',
    name: 'Work Tasks',
    query: '#Work',
    color: 'blue',
    order: 2,
    is_favorite: false,
  },
};

export const mockLabels = {
  label1: {
    id: '2156154810',
    name: 'urgent',
    color: 'red',
    order: 1,
    is_favorite: true,
  },
  label2: {
    id: '2156154811',
    name: 'work',
    color: 'blue',
    order: 2,
    is_favorite: false,
  },
};

// API Response helpers
export const createSuccessResponse = <T>(data: T) => ({
  status: 200,
  data,
  headers: {
    'content-type': 'application/json',
    'x-ratelimit-remaining': '99',
    'x-ratelimit-reset': '3600',
  },
});

export const createErrorResponse = (status: number, message: string) => ({
  status,
  data: { error: message },
  headers: {
    'content-type': 'application/json',
  },
});

// Batch operation responses
export const mockBatchResponse = {
  sync_token: 'abc123def456',
  temp_id_mapping: {
    temp_task_1: '2995104350',
    temp_task_2: '2995104351',
  },
  commands: [
    {
      type: 'item_add',
      uuid: 'cmd_uuid_1',
      args: {
        content: 'New task 1',
        project_id: '220474322',
      },
    },
  ],
};

// Rate limiting responses
export const mockRateLimitResponse = {
  status: 429,
  data: { error: 'Rate limit exceeded' },
  headers: {
    'content-type': 'application/json',
    'retry-after': '60',
    'x-ratelimit-remaining': '0',
    'x-ratelimit-reset': '3600',
  },
};

// Error responses
export const mockNotFoundResponse = createErrorResponse(404, 'Not found');
export const mockUnauthorizedResponse = createErrorResponse(401, 'Unauthorized');
export const mockValidationErrorResponse = createErrorResponse(400, 'Invalid request data');

// Collection responses
export const mockTasksListResponse = createSuccessResponse([
  mockTasks.task1,
  mockTasks.task2,
]);

export const mockProjectsListResponse = createSuccessResponse([
  mockProjects.inbox,
  mockProjects.workProject,
  mockProjects.subProject,
]);

export const mockSectionsListResponse = createSuccessResponse([
  mockSections.section1,
  mockSections.section2,
]);

export const mockCommentsListResponse = createSuccessResponse([
  mockComments.comment1,
]);

export const mockFiltersListResponse = createSuccessResponse([
  mockFilters.filter1,
  mockFilters.filter2,
]);

export const mockLabelsListResponse = createSuccessResponse([
  mockLabels.label1,
  mockLabels.label2,
]);