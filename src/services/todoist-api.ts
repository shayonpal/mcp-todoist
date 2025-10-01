/**
 * Todoist API Service with rate limiting and retry logic
 * Based on research.md patterns and Todoist API v1 specifications
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  TodoistTask,
  TodoistProject,
  TodoistSection,
  TodoistComment,
  TodoistLabel,
  TodoistFilter,
  TodoistReminder,
  APIConfiguration,
} from '../types/todoist.js';
import {
  TodoistAPIError,
  RateLimitError,
  AuthenticationError,
  NotFoundError,
  NetworkError,
  ServiceUnavailableError,
  ValidationError,
  TodoistErrorCode,
} from '../types/errors.js';

export type SyncCommand = Record<string, unknown>;

export interface SyncResponse {
  temp_id_mapping?: Record<string, string>;
  sync_status?: Record<string, string>;
  reminders?: TodoistReminder[];
  reminders_location?: TodoistReminder[];
  [key: string]: unknown;
}

type TaskQueryParams = {
  project_id?: string;
  section_id?: string;
  label_id?: string;
  query?: string;
  lang?: string;
  cursor?: string;
  limit?: number;
};

/**
 * Rate limiter interface for different endpoint types
 */
interface RateLimiter {
  acquire(endpoint: string): Promise<void>;
  backoff(): Promise<void>;
  getStatus(): {
    remaining: number;
    resetTime: Date;
    isLimited: boolean;
  };
}

/**
 * Token bucket rate limiter implementation
 */
class TokenBucketRateLimiter implements RateLimiter {
  private tokens: number;
  private lastRefill: Date;
  private isInBackoff: boolean = false;
  private backoffUntil: Date | null = null;

  constructor(
    private readonly maxTokens: number,
    private readonly refillRate: number, // tokens per minute
    private readonly windowMs: number = 15 * 60 * 1000 // 15 minutes
  ) {
    this.tokens = maxTokens;
    this.lastRefill = new Date();
  }

  async acquire(_endpoint: string): Promise<void> {
    await this.waitForBackoff();
    this.refillTokens();

    if (this.tokens <= 0) {
      throw new RateLimitError(
        'Rate limit exceeded',
        Math.ceil(
          (this.windowMs - (Date.now() - this.lastRefill.getTime())) / 1000
        )
      );
    }

    this.tokens--;
  }

  async backoff(): Promise<void> {
    const backoffTime = this.calculateBackoffTime();
    this.backoffUntil = new Date(Date.now() + backoffTime);
    this.isInBackoff = true;

    return new Promise(resolve => {
      setTimeout(() => {
        this.isInBackoff = false;
        this.backoffUntil = null;
        resolve();
      }, backoffTime);
    });
  }

  getStatus() {
    this.refillTokens();
    return {
      remaining: this.tokens,
      resetTime: new Date(this.lastRefill.getTime() + this.windowMs),
      isLimited: this.tokens <= 0 || this.isInBackoff,
    };
  }

  private refillTokens(): void {
    const now = new Date();
    const timeSinceLastRefill = now.getTime() - this.lastRefill.getTime();

    if (timeSinceLastRefill >= this.windowMs) {
      this.tokens = this.maxTokens;
      this.lastRefill = now;
    }
  }

  private calculateBackoffTime(): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
    const baseDelay = 1000;
    const maxDelay = 30000;
    const attempt = Math.floor(Math.random() * 5) + 1; // Random jitter
    return Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  }

  private async waitForBackoff(): Promise<void> {
    if (this.isInBackoff && this.backoffUntil) {
      const waitTime = this.backoffUntil.getTime() - Date.now();
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      this.isInBackoff = false;
      this.backoffUntil = null;
    }
  }
}

/**
 * Todoist API service with comprehensive rate limiting and error handling
 */
export class TodoistApiService {
  private readonly httpClient: AxiosInstance;
  private readonly config: APIConfiguration;
  private readonly syncRateLimiter: RateLimiter;
  private readonly restRateLimiter: RateLimiter;

  constructor(config: APIConfiguration) {
    this.config = {
      token: config.token,
      base_url: config.base_url || 'https://api.todoist.com/api/v1',
      timeout: config.timeout || 10000,
      retry_attempts: config.retry_attempts || 3,
    };

    // Initialize rate limiters based on Todoist API limits
    this.syncRateLimiter = new TokenBucketRateLimiter(100, 100); // 100 full sync per 15min
    this.restRateLimiter = new TokenBucketRateLimiter(1000, 1000); // 1000 partial sync per 15min

    this.httpClient = axios.create({
      baseURL: this.config.base_url,
      timeout: this.config.timeout,
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MCP-Todoist/1.0.0',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Setup axios interceptors for error handling and retries
   */
  private setupInterceptors(): void {
    this.httpClient.interceptors.response.use(
      (response: AxiosResponse) => response,
      async error => {
        return this.handleApiError(error);
      }
    );
  }

  /**
   * Handle API errors with proper error mapping and retry logic
   */
  private async handleApiError(error: unknown): Promise<never> {
    if (!axios.isAxiosError(error)) {
      if (error instanceof TodoistAPIError) {
        throw error;
      }

      throw new TodoistAPIError(
        TodoistErrorCode.UNKNOWN_ERROR,
        error instanceof Error ? error.message : 'An unexpected error occurred',
        { originalError: error },
        false
      );
    }

    const status = error.response?.status;
    const data = error.response?.data as Record<string, unknown> | undefined;
    const headers = error.response?.headers as
      | Record<string, string>
      | undefined;

    switch (status) {
      case 401:
        throw new AuthenticationError('Invalid or expired Todoist API token', {
          originalError: data,
        });

      case 403:
        throw new AuthenticationError(
          'Insufficient permissions for this operation',
          { originalError: data }
        );

      case 404:
        throw new NotFoundError('Resource not found', { originalError: data });

      case 429: {
        const retryAfterHeader = headers?.['retry-after'];
        const retryAfter =
          typeof retryAfterHeader === 'string'
            ? parseInt(retryAfterHeader, 10)
            : undefined;
        throw new RateLimitError('API rate limit exceeded', retryAfter, {
          originalError: data,
        });
      }

      case 400: {
        const validationMessage =
          typeof data?.error === 'string' ? data.error : 'Invalid request data';
        throw new ValidationError(validationMessage, {
          originalError: data,
        });
      }

      case 500:
      case 502:
      case 503:
      case 504:
        throw new ServiceUnavailableError(
          'Todoist service temporarily unavailable',
          undefined,
          { status, originalError: data }
        );

      default:
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          throw new NetworkError('Network connection failed', {
            originalError: error.message,
          });
        }

        throw new TodoistAPIError(
          TodoistErrorCode.UNKNOWN_ERROR,
          error.message || 'An unexpected error occurred',
          { originalError: error },
          false
        );
    }
  }

  /**
   * Execute a rate-limited API request
   */
  private async executeRequest<T>(
    endpoint: string,
    config: AxiosRequestConfig,
    isSyncEndpoint: boolean = false
  ): Promise<T> {
    const rateLimiter = isSyncEndpoint
      ? this.syncRateLimiter
      : this.restRateLimiter;

    await rateLimiter.acquire(endpoint);

    try {
      const response = await this.httpClient.request<T>({
        url: endpoint,
        ...config,
      });

      return response.data;
    } catch (error) {
      if (error instanceof RateLimitError) {
        await rateLimiter.backoff();
      }
      throw error;
    }
  }

  /**
   * Get rate limiter status for monitoring
   */
  getRateLimitStatus() {
    return {
      sync: this.syncRateLimiter.getStatus(),
      rest: this.restRateLimiter.getStatus(),
    };
  }

  // Task operations
  async getTasks(
    params?: TaskQueryParams
  ): Promise<{ results: TodoistTask[]; next_cursor: string | null }> {
    const response = await this.executeRequest<{
      results: TodoistTask[];
      next_cursor: string | null;
    }>('/tasks', {
      method: 'GET',
      params,
    });

    // API v1 returns paginated response with { results: [...], next_cursor: ... }
    return {
      results: response.results || [],
      next_cursor: response.next_cursor || null,
    };
  }

  async getTasksByFilter(
    query: string,
    lang?: string,
    cursor?: string,
    limit?: number
  ): Promise<{ results: TodoistTask[]; next_cursor: string | null }> {
    const params: Record<string, string | number> = { query };
    if (lang) params.lang = lang;
    if (cursor) params.cursor = cursor;
    if (limit) params.limit = limit;

    const response = await this.executeRequest<{
      results: TodoistTask[];
      next_cursor: string | null;
    }>('/tasks/filter', {
      method: 'GET',
      params,
    });

    // API v1 returns paginated response with { results: [...], next_cursor: ... }
    return {
      results: response.results || [],
      next_cursor: response.next_cursor || null,
    };
  }

  async getTask(taskId: string): Promise<TodoistTask> {
    return this.executeRequest<TodoistTask>(`/tasks/${taskId}`, {
      method: 'GET',
    });
  }

  async createTask(taskData: Partial<TodoistTask>): Promise<TodoistTask> {
    // T023: Transform deadline parameter from string to API format
    const apiPayload = { ...taskData };
    if ('deadline' in taskData) {
      if (typeof taskData.deadline === 'string') {
        // Transform string to object format expected by API
        apiPayload.deadline = { date: taskData.deadline };
      }
      // If null, keep as null (for removal)
      // If already an object, keep as is
    }

    return this.executeRequest<TodoistTask>('/tasks', {
      method: 'POST',
      data: apiPayload,
    });
  }

  async updateTask(
    taskId: string,
    taskData: Partial<TodoistTask>
  ): Promise<TodoistTask> {
    // T024: Transform deadline parameter to handle add/update/remove
    const apiPayload = { ...taskData };
    if ('deadline' in taskData) {
      if (typeof taskData.deadline === 'string') {
        // Transform string to object format expected by API
        apiPayload.deadline = { date: taskData.deadline };
      }
      // If null, keep as null (explicit removal)
      // If already an object, keep as is
    }

    return this.executeRequest<TodoistTask>(`/tasks/${taskId}`, {
      method: 'POST',
      data: apiPayload,
    });
  }

  async deleteTask(taskId: string): Promise<void> {
    return this.executeRequest<void>(`/tasks/${taskId}`, {
      method: 'DELETE',
    });
  }

  async completeTask(taskId: string): Promise<void> {
    return this.executeRequest<void>(`/tasks/${taskId}/close`, {
      method: 'POST',
    });
  }

  async reopenTask(taskId: string): Promise<void> {
    return this.executeRequest<void>(`/tasks/${taskId}/reopen`, {
      method: 'POST',
    });
  }

  async moveTask(
    taskId: string,
    destination: {
      project_id?: string;
      section_id?: string;
      parent_id?: string;
    }
  ): Promise<void> {
    // Validate that only one destination is specified
    const destinations = [
      destination.project_id,
      destination.section_id,
      destination.parent_id,
    ].filter(Boolean);
    if (destinations.length !== 1) {
      throw new TodoistAPIError(
        TodoistErrorCode.VALIDATION_ERROR,
        'Exactly one of project_id, section_id, or parent_id must be specified for move operation',
        undefined,
        false,
        undefined,
        400
      );
    }

    const uuid = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    const commands = [
      {
        type: 'item_move',
        uuid,
        args: {
          id: taskId,
          ...destination,
        },
      },
    ];

    await this.sync(commands);
  }

  // Project operations
  async getProjects(): Promise<TodoistProject[]> {
    const response = await this.executeRequest<{
      results: TodoistProject[];
      next_cursor: string | null;
    }>('/projects', {
      method: 'GET',
    });

    // API v1 returns paginated response with { results: [...], next_cursor: ... }
    return response.results || [];
  }

  async getProject(projectId: string): Promise<TodoistProject> {
    return this.executeRequest<TodoistProject>(`/projects/${projectId}`, {
      method: 'GET',
    });
  }

  async createProject(
    projectData: Partial<TodoistProject>
  ): Promise<TodoistProject> {
    return this.executeRequest<TodoistProject>('/projects', {
      method: 'POST',
      data: projectData,
    });
  }

  async updateProject(
    projectId: string,
    projectData: Partial<TodoistProject>
  ): Promise<TodoistProject> {
    return this.executeRequest<TodoistProject>(`/projects/${projectId}`, {
      method: 'POST',
      data: projectData,
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    return this.executeRequest<void>(`/projects/${projectId}`, {
      method: 'DELETE',
    });
  }

  // Section operations
  async getSections(projectId?: string): Promise<TodoistSection[]> {
    const params = projectId ? { project_id: projectId } : undefined;
    const response = await this.executeRequest<{
      results: TodoistSection[];
      next_cursor: string | null;
    }>('/sections', {
      method: 'GET',
      params,
    });

    // API v1 returns paginated response with { results: [...], next_cursor: ... }
    return response.results || [];
  }

  async getSection(sectionId: string): Promise<TodoistSection> {
    return this.executeRequest<TodoistSection>(`/sections/${sectionId}`, {
      method: 'GET',
    });
  }

  async createSection(
    sectionData: Partial<TodoistSection>
  ): Promise<TodoistSection> {
    return this.executeRequest<TodoistSection>('/sections', {
      method: 'POST',
      data: sectionData,
    });
  }

  async updateSection(
    sectionId: string,
    sectionData: Partial<TodoistSection>
  ): Promise<TodoistSection> {
    return this.executeRequest<TodoistSection>(`/sections/${sectionId}`, {
      method: 'POST',
      data: sectionData,
    });
  }

  async deleteSection(sectionId: string): Promise<void> {
    return this.executeRequest<void>(`/sections/${sectionId}`, {
      method: 'DELETE',
    });
  }

  // Comment operations
  async getComments(params: {
    task_id?: string;
    project_id?: string;
  }): Promise<TodoistComment[]> {
    const response = await this.executeRequest<{
      results: TodoistComment[];
      next_cursor: string | null;
    }>('/comments', {
      method: 'GET',
      params,
    });

    // API v1 returns paginated response with { results: [...], next_cursor: ... }
    return response.results || [];
  }

  async getComment(commentId: string): Promise<TodoistComment> {
    return this.executeRequest<TodoistComment>(`/comments/${commentId}`, {
      method: 'GET',
    });
  }

  async createComment(
    commentData: Partial<TodoistComment>
  ): Promise<TodoistComment> {
    return this.executeRequest<TodoistComment>('/comments', {
      method: 'POST',
      data: commentData,
    });
  }

  async updateComment(
    commentId: string,
    commentData: Partial<TodoistComment>
  ): Promise<TodoistComment> {
    return this.executeRequest<TodoistComment>(`/comments/${commentId}`, {
      method: 'POST',
      data: commentData,
    });
  }

  async deleteComment(commentId: string): Promise<void> {
    return this.executeRequest<void>(`/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  // Label operations
  async getLabels(
    cursor?: string,
    limit?: number
  ): Promise<{
    results: TodoistLabel[];
    next_cursor: string | null;
  }> {
    const params: Record<string, string> = {};
    if (cursor) params.cursor = cursor;
    if (limit) params.limit = limit.toString();

    const response = await this.executeRequest<{
      results: TodoistLabel[];
      next_cursor: string | null;
    }>('/labels', {
      method: 'GET',
      params,
    });

    return response;
  }

  async getLabel(labelId: string): Promise<TodoistLabel> {
    return this.executeRequest<TodoistLabel>(`/labels/${labelId}`, {
      method: 'GET',
    });
  }

  async createLabel(labelData: Partial<TodoistLabel>): Promise<TodoistLabel> {
    return this.executeRequest<TodoistLabel>('/labels', {
      method: 'POST',
      data: labelData,
    });
  }

  async updateLabel(
    labelId: string,
    labelData: Partial<TodoistLabel>
  ): Promise<TodoistLabel> {
    return this.executeRequest<TodoistLabel>(`/labels/${labelId}`, {
      method: 'POST',
      data: labelData,
    });
  }

  async deleteLabel(labelId: string): Promise<void> {
    return this.executeRequest<void>(`/labels/${labelId}`, {
      method: 'DELETE',
    });
  }

  async renameSharedLabel(name: string, newName: string): Promise<void> {
    await this.sync([
      {
        type: 'shared_label_rename',
        args: { name, new_name: newName },
      },
    ]);
  }

  async removeSharedLabel(name: string): Promise<void> {
    await this.sync([
      {
        type: 'shared_label_remove',
        args: { name },
      },
    ]);
  }

  // Sync operations (for batch processing)
  // Note: Sync API uses dedicated /sync endpoint
  async sync(commands: SyncCommand[]): Promise<SyncResponse> {
    return this.executeRequest<SyncResponse>(
      'https://api.todoist.com/api/v1/sync',
      {
        method: 'POST',
        data: {
          commands,
        },
      },
      true
    ); // Mark as sync endpoint for rate limiting
  }

  // Reminder operations - use sync API for all operations
  // Reminders support three types: relative (minutes before due), absolute (specific datetime), location (geofenced)
  async getReminders(itemId?: string): Promise<TodoistReminder[]> {
    // Use sync API to get reminders
    const resource_types = itemId
      ? ['reminders', 'reminders_location']
      : ['reminders', 'reminders_location'];

    const response = await this.executeRequest<SyncResponse>(
      'https://api.todoist.com/api/v1/sync',
      {
        method: 'POST',
        data: {
          sync_token: '*',
          resource_types,
        },
      },
      true
    );

    // Combine time-based and location-based reminders
    const reminders = [
      ...(Array.isArray(response.reminders) ? response.reminders : []),
      ...(Array.isArray(response.reminders_location)
        ? response.reminders_location
        : []),
    ];

    // Filter by item_id if provided
    if (itemId) {
      return reminders.filter((r: TodoistReminder) => r.item_id === itemId);
    }

    return reminders;
  }

  async createReminder(
    reminderData: Partial<TodoistReminder>
  ): Promise<TodoistReminder> {
    // Generate temp_id and uuid for sync command
    const tempId = `temp_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}`;
    const uuid = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    const commands = [
      {
        type: 'reminder_add',
        temp_id: tempId,
        uuid,
        args: reminderData,
      },
    ];

    const response = await this.sync(commands);

    // Extract the created reminder ID from temp_id_mapping
    const reminderId = response.temp_id_mapping?.[tempId];

    if (!reminderId) {
      throw new TodoistAPIError(
        TodoistErrorCode.SERVER_ERROR,
        'Failed to create reminder',
        undefined,
        false,
        undefined,
        500
      );
    }

    // Fetch and return the created reminder
    const reminders = await this.getReminders(reminderData.item_id);
    const createdReminder = reminders.find(r => r.id === reminderId);

    if (!createdReminder) {
      // Return a constructed reminder if we can't fetch it
      return {
        id: reminderId,
        ...reminderData,
        is_deleted: false,
      } as TodoistReminder;
    }

    return createdReminder;
  }

  async updateReminder(
    reminderId: string,
    reminderData: Partial<TodoistReminder>
  ): Promise<TodoistReminder> {
    const uuid = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    const commands = [
      {
        type: 'reminder_update',
        uuid,
        args: {
          id: reminderId,
          ...reminderData,
        },
      },
    ];

    await this.sync(commands);

    // Fetch and return the updated reminder
    const reminders = await this.getReminders(reminderData.item_id);
    const updatedReminder = reminders.find(r => r.id === reminderId);

    if (!updatedReminder) {
      throw new NotFoundError('Reminder not found after update');
    }

    return updatedReminder;
  }

  async deleteReminder(reminderId: string): Promise<void> {
    const uuid = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    const commands = [
      {
        type: 'reminder_delete',
        uuid,
        args: {
          id: reminderId,
        },
      },
    ];

    await this.sync(commands);
  }

  // Filter methods
  async getFilters(): Promise<TodoistFilter[]> {
    const response = await this.executeRequest<{
      results: TodoistFilter[];
      next_cursor: string | null;
    }>('/filters', {});

    // API v1 returns paginated response with { results: [...], next_cursor: ... }
    return response.results || [];
  }

  async getFilter(filterId: string): Promise<TodoistFilter> {
    return this.executeRequest<TodoistFilter>(`/filters/${filterId}`, {});
  }

  async createFilter(
    filterData: Partial<TodoistFilter>
  ): Promise<TodoistFilter> {
    return this.executeRequest<TodoistFilter>('/filters', {
      method: 'POST',
      data: filterData,
    });
  }

  async updateFilter(
    filterId: string,
    filterData: Partial<TodoistFilter>
  ): Promise<TodoistFilter> {
    return this.executeRequest<TodoistFilter>(`/filters/${filterId}`, {
      method: 'POST',
      data: filterData,
    });
  }

  async deleteFilter(filterId: string): Promise<void> {
    await this.executeRequest<void>(`/filters/${filterId}`, {
      method: 'DELETE',
    });
  }

  // Project archive methods
  async archiveProject(projectId: string): Promise<void> {
    await this.executeRequest<void>(`/projects/${projectId}/archive`, {
      method: 'POST',
    });
  }

  async unarchiveProject(projectId: string): Promise<void> {
    await this.executeRequest<void>(`/projects/${projectId}/unarchive`, {
      method: 'POST',
    });
  }

  // Comment convenience methods
  async getTaskComments(taskId: string): Promise<TodoistComment[]> {
    return this.getComments({ task_id: taskId });
  }

  async getProjectComments(projectId: string): Promise<TodoistComment[]> {
    return this.getComments({ project_id: projectId });
  }
}
