import {
  TodoistTask,
  TodoistProject,
  TodoistSection,
  TodoistReminder,
  TodoistLabel,
} from '../../src/types/todoist.js';
import { TodoistApiService } from '../../src/services/todoist-api.js';
import { NotFoundError } from '../../src/types/errors.js';
import {
  mockTasks,
  mockProjects,
  mockSections,
} from '../mocks/todoist-api-responses.js';
import {
  toTodoistTask,
  toTodoistProject,
  toTodoistSection,
} from './mockTodoistApiService.js';

interface SyncCommand {
  type: string;
  temp_id?: string;
  uuid: string;
  args: Record<string, any>;
}

export class InMemoryTodoistApiService {
  private tasks = new Map<string, TodoistTask>();
  private projects = new Map<string, TodoistProject>();
  private sections = new Map<string, TodoistSection>();
  private reminders = new Map<string, TodoistReminder>();
  private labels = new Map<string, TodoistLabel>();
  private idCounter = 1000;

  constructor() {
    const initialTasks = [
      toTodoistTask(mockTasks.task1),
      toTodoistTask(mockTasks.task2),
    ];
    initialTasks.forEach(task => {
      this.tasks.set(task.id, task);
    });

    const initialProjects = [
      toTodoistProject(mockProjects.inbox),
      toTodoistProject(mockProjects.workProject),
    ];
    initialProjects.forEach(project => {
      this.projects.set(project.id, project);
    });

    const initialSections = [
      toTodoistSection(mockSections.section1),
      toTodoistSection(mockSections.section2),
    ];
    initialSections.forEach(section => {
      this.sections.set(section.id, section);
    });
  }

  private nextId(prefix: string) {
    this.idCounter += 1;
    return `${prefix}_${this.idCounter}`;
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }

  getRateLimitStatus() {
    const resetTime = new Date(Date.now() + 60_000);
    return {
      rest: { remaining: 99, resetTime, isLimited: false },
      sync: { remaining: 99, resetTime, isLimited: false },
    };
  }

  // Task operations
  async getTasks(
    params: Record<string, any> = {}
  ): Promise<{ results: TodoistTask[]; next_cursor: string | null }> {
    let tasks = Array.from(this.tasks.values());
    if (params.project_id) {
      tasks = tasks.filter(task => task.project_id === params.project_id);
    }
    if (params.section_id) {
      tasks = tasks.filter(task => task.section_id === params.section_id);
    }
    return { results: this.clone(tasks), next_cursor: null };
  }

  async getTask(taskId: string): Promise<TodoistTask> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');
    return this.clone(task);
  }

  async createTask(taskData: Partial<TodoistTask>): Promise<TodoistTask> {
    const id = this.nextId('task');

    // Transform deadline parameter to match API behavior
    // API accepts: deadline_date (string) -> returns: deadline (object)
    let deadline = taskData.deadline;
    if ((taskData as any).deadline_date) {
      const deadlineDate = (taskData as any).deadline_date;
      if (deadlineDate === '') {
        // Empty string means remove deadline
        deadline = undefined;
      } else {
        deadline = { date: deadlineDate };
      }
    } else if (typeof deadline === 'string') {
      deadline = { date: deadline };
    }

    // Parse due object from due_string, due_date, or due_datetime
    let due = taskData.due;
    if (!due && (taskData as any).due_string) {
      // Create due object from due_string with is_recurring detection
      const dueString = (taskData as any).due_string;
      const isRecurring = /every|each|daily|weekly|monthly|yearly/i.test(
        dueString
      );
      due = {
        date: '2025-10-01', // Mock date
        string: dueString,
        is_recurring: isRecurring,
      };
    } else if (!due && (taskData as any).due_date) {
      due = {
        date: (taskData as any).due_date,
        string: (taskData as any).due_date,
        is_recurring: false,
      };
    }

    const task: TodoistTask = {
      id,
      content: taskData.content ?? 'Untitled Task',
      description: taskData.description ?? '',
      project_id: taskData.project_id ?? 'inbox',
      section_id: taskData.section_id,
      parent_id: taskData.parent_id,
      order: 1,
      priority: (taskData.priority as TodoistTask['priority']) ?? 1,
      labels: taskData.labels ?? [],
      assignee_id: taskData.assignee_id,
      assigner_id: undefined,
      comment_count: 0,
      completed: false,
      due: due as any,
      deadline: deadline as any,
      url: `https://todoist.com/showTask?id=${id}`,
      created_at: new Date().toISOString(),
      creator_id: 'user-1',
    };

    this.tasks.set(id, task);
    return this.clone(task);
  }

  async updateTask(
    taskId: string,
    taskData: Partial<TodoistTask>
  ): Promise<TodoistTask> {
    const existing = this.tasks.get(taskId);
    if (!existing) throw new Error('Task not found');

    // Transform deadline parameter to match API behavior
    // API accepts: deadline_date (string) -> returns: deadline (object)
    const updates = { ...taskData };
    if ((taskData as any).deadline_date !== undefined) {
      const deadlineDate = (taskData as any).deadline_date;
      if (deadlineDate === '') {
        // Empty string means remove deadline
        updates.deadline = undefined;
      } else {
        updates.deadline = { date: deadlineDate } as any;
      }
      // Remove the deadline_date field from updates
      delete (updates as any).deadline_date;
    } else if ('deadline' in updates) {
      if (typeof updates.deadline === 'string') {
        updates.deadline = { date: updates.deadline } as any;
      } else if (updates.deadline === null) {
        updates.deadline = undefined;
      }
    }

    const updated = { ...existing, ...updates } as TodoistTask;
    this.tasks.set(taskId, updated);
    return this.clone(updated);
  }

  async deleteTask(taskId: string): Promise<void> {
    this.tasks.delete(taskId);
  }

  async completeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task) {
      task.completed = true;
      this.tasks.set(taskId, task);
    }
  }

  async reopenTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task) {
      task.completed = false;
      this.tasks.set(taskId, task);
    }
  }

  // Project operations
  async getProjects(): Promise<TodoistProject[]> {
    return this.clone(Array.from(this.projects.values()));
  }

  async getProject(projectId: string): Promise<TodoistProject> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error('Project not found');
    return this.clone(project);
  }

  async createProject(
    projectData: Partial<TodoistProject>
  ): Promise<TodoistProject> {
    const id = this.nextId('project');
    const project: TodoistProject = {
      id,
      name: projectData.name ?? 'Untitled Project',
      comment_count: 0,
      order: 1,
      color: 'charcoal',
      is_shared: false,
      is_favorite: false,
      is_inbox_project: false,
      is_team_inbox: false,
      view_style:
        (projectData.view_style as TodoistProject['view_style']) ?? 'list',
      url: `https://todoist.com/showProject?id=${id}`,
      parent_id: projectData.parent_id,
      is_archived: false,
    };
    this.projects.set(id, project);
    return this.clone(project);
  }

  async updateProject(
    projectId: string,
    projectData: Partial<TodoistProject>
  ): Promise<TodoistProject> {
    const existing = this.projects.get(projectId);
    if (!existing) throw new Error('Project not found');
    const updated = { ...existing, ...projectData } as TodoistProject;
    this.projects.set(projectId, updated);
    return this.clone(updated);
  }

  async deleteProject(projectId: string): Promise<void> {
    this.projects.delete(projectId);
  }

  async archiveProject(): Promise<void> {
    return;
  }

  async unarchiveProject(): Promise<void> {
    return;
  }

  // Section operations
  async getSections(projectId?: string): Promise<TodoistSection[]> {
    let sections = Array.from(this.sections.values());
    if (projectId) {
      sections = sections.filter(section => section.project_id === projectId);
    }
    return this.clone(sections);
  }

  async getSection(sectionId: string): Promise<TodoistSection> {
    const section = this.sections.get(sectionId);
    if (!section) throw new Error('Section not found');
    return this.clone(section);
  }

  async createSection(
    sectionData: Partial<TodoistSection>
  ): Promise<TodoistSection> {
    const id = this.nextId('section');
    const section: TodoistSection = {
      id,
      name: sectionData.name ?? 'Untitled Section',
      project_id: sectionData.project_id ?? 'project',
      order: sectionData.order ?? 1,
    };
    this.sections.set(id, section);
    return this.clone(section);
  }

  async updateSection(
    sectionId: string,
    sectionData: Partial<TodoistSection>
  ): Promise<TodoistSection> {
    const existing = this.sections.get(sectionId);
    if (!existing) throw new Error('Section not found');
    const updated = { ...existing, ...sectionData } as TodoistSection;
    this.sections.set(sectionId, updated);
    return this.clone(updated);
  }

  async deleteSection(sectionId: string): Promise<void> {
    this.sections.delete(sectionId);
  }

  // Reminder operations
  async getReminders(itemId?: string): Promise<TodoistReminder[]> {
    let reminders = Array.from(this.reminders.values());
    if (itemId) {
      reminders = reminders.filter(rem => rem.item_id === itemId);
    }
    return this.clone(reminders);
  }

  async createReminder(
    reminderData: Partial<TodoistReminder>
  ): Promise<TodoistReminder> {
    const id = this.nextId('reminder');
    const reminder: TodoistReminder = {
      id,
      item_id: reminderData.item_id ?? 'task',
      notify_uid: reminderData.notify_uid ?? 'user',
      type: (reminderData.type as TodoistReminder['type']) ?? 'absolute',
      due: reminderData.due,
      minute_offset: reminderData.minute_offset,
      name: reminderData.name,
      loc_lat: reminderData.loc_lat,
      loc_long: reminderData.loc_long,
      loc_trigger: reminderData.loc_trigger,
      radius: reminderData.radius,
      is_deleted: false,
    };
    this.reminders.set(id, reminder);
    return this.clone(reminder);
  }

  async updateReminder(
    reminderId: string,
    reminderData: Partial<TodoistReminder>
  ): Promise<TodoistReminder> {
    const existing = this.reminders.get(reminderId);
    if (!existing) throw new Error('Reminder not found');
    const updated = { ...existing, ...reminderData } as TodoistReminder;
    this.reminders.set(reminderId, updated);
    return this.clone(updated);
  }

  async deleteReminder(reminderId: string): Promise<void> {
    this.reminders.delete(reminderId);
  }

  // Label operations
  async getLabels(
    cursor?: string,
    limit?: number
  ): Promise<{ results: TodoistLabel[]; next_cursor: string | null }> {
    const labels = Array.from(this.labels.values());
    const pageSize = limit || 50;

    // Simple pagination: cursor is the starting index
    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const endIndex = startIndex + pageSize;
    const page = labels.slice(startIndex, endIndex);
    const nextCursor = endIndex < labels.length ? endIndex.toString() : null;

    return { results: this.clone(page), next_cursor: nextCursor };
  }

  async getLabel(labelId: string): Promise<TodoistLabel> {
    const label = this.labels.get(labelId);
    if (!label) {
      throw new NotFoundError(`Label with ID ${labelId} not found`, {
        label_id: labelId,
      });
    }
    return this.clone(label);
  }

  async createLabel(labelData: Partial<TodoistLabel>): Promise<TodoistLabel> {
    // Check for duplicate name (idempotent behavior)
    const labelName = labelData.name ?? 'Untitled Label';
    const existingLabel = Array.from(this.labels.values()).find(
      l => l.name === labelName
    );

    if (existingLabel) {
      return this.clone(existingLabel);
    }

    const id = this.nextId('label');
    const label: TodoistLabel = {
      id,
      name: labelName,
      color: labelData.color ?? 'charcoal',
      order: labelData.order ?? 1,
      is_favorite: labelData.is_favorite ?? false,
    };
    this.labels.set(id, label);
    return this.clone(label);
  }

  async updateLabel(
    labelId: string,
    labelData: Partial<TodoistLabel>
  ): Promise<TodoistLabel> {
    const existing = this.labels.get(labelId);
    if (!existing) throw new Error('Label not found');
    const updated = { ...existing, ...labelData } as TodoistLabel;
    this.labels.set(labelId, updated);
    return this.clone(updated);
  }

  async deleteLabel(labelId: string): Promise<void> {
    const label = this.labels.get(labelId);
    if (!label) {
      throw new NotFoundError(`Label with ID ${labelId} not found`, {
        label_id: labelId,
      });
    }

    // Remove label from all tasks
    const labelName = label.name;
    this.tasks.forEach((task, taskId) => {
      if (task.labels?.includes(labelName)) {
        task.labels = task.labels.filter(l => l !== labelName);
        this.tasks.set(taskId, task);
      }
    });

    this.labels.delete(labelId);
  }

  async renameSharedLabel(name: string, newName: string): Promise<void> {
    // Update all tasks with the old label name to use the new name
    this.tasks.forEach((task, taskId) => {
      if (task.labels?.includes(name)) {
        task.labels = task.labels.map(l => (l === name ? newName : l));
        this.tasks.set(taskId, task);
      }
    });
  }

  async removeSharedLabel(name: string): Promise<void> {
    // Remove label from all tasks
    this.tasks.forEach((task, taskId) => {
      if (task.labels?.includes(name)) {
        task.labels = task.labels.filter(l => l !== name);
        this.tasks.set(taskId, task);
      }
    });
  }

  async sync(commands: SyncCommand[]) {
    const temp_id_mapping: Record<string, string> = {};
    const sync_status: Record<string, string> = {};

    for (const command of commands) {
      switch (command.type) {
        case 'item_add': {
          const created = await this.createTask(command.args);
          if (command.temp_id) {
            temp_id_mapping[command.temp_id] = created.id;
          }
          sync_status[command.uuid] = 'ok';
          break;
        }
        case 'reminder_add': {
          const created = await this.createReminder(command.args);
          if (command.temp_id) {
            temp_id_mapping[command.temp_id] = created.id;
          }
          sync_status[command.uuid] = 'ok';
          break;
        }
        case 'reminder_update': {
          await this.updateReminder(command.args.id, command.args);
          sync_status[command.uuid] = 'ok';
          break;
        }
        case 'reminder_delete': {
          await this.deleteReminder(command.args.id);
          sync_status[command.uuid] = 'ok';
          break;
        }
        case 'shared_label_rename': {
          await this.renameSharedLabel(
            command.args.name,
            command.args.new_name
          );
          sync_status[command.uuid] = 'ok';
          break;
        }
        case 'shared_label_remove': {
          await this.removeSharedLabel(command.args.name);
          sync_status[command.uuid] = 'ok';
          break;
        }
        default: {
          sync_status[command.uuid] = 'ok';
        }
      }
    }

    return { temp_id_mapping, sync_status };
  }
}

export function createInMemoryApiService(): TodoistApiService {
  return new InMemoryTodoistApiService() as unknown as TodoistApiService;
}
