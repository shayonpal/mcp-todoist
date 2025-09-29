/**
 * Cache service for projects and labels with TTL management
 * Based on research.md caching strategy for read-heavy operations
 */

import {
  TodoistProject,
  TodoistLabel,
  TodoistSection,
} from '../types/todoist.js';

/**
 * Cache entry with TTL management
 */
interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  ttl: number; // TTL in milliseconds
}

/**
 * Cache statistics for monitoring
 */
interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  hitRate: number;
}

/**
 * LRU Cache implementation with TTL support
 */
class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private readonly maxSize: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: K): V | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if entry is expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;

    return entry.data;
  }

  set(key: K, value: V, ttl: number): void {
    // Remove oldest entries if at max capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    const entry: CacheEntry<V> = {
      data: value,
      timestamp: new Date(),
      ttl,
    };

    this.cache.set(key, entry);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats(): CacheStats {
    this.cleanupExpired();
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      entries: this.cache.size,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  private isExpired(entry: CacheEntry<V>): boolean {
    const now = Date.now();
    const entryTime = entry.timestamp.getTime();
    return now - entryTime > entry.ttl;
  }

  private cleanupExpired(): void {
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
      }
    }
  }

  // Get all non-expired entries
  getAllValid(): Map<K, V> {
    const validEntries = new Map<K, V>();
    for (const [key, entry] of this.cache.entries()) {
      if (!this.isExpired(entry)) {
        validEntries.set(key, entry.data);
      }
    }
    return validEntries;
  }
}

/**
 * Cache service for Todoist entities with appropriate TTL settings
 */
export class CacheService {
  private readonly projectsCache: LRUCache<string, TodoistProject[]>;
  private readonly labelsCache: LRUCache<string, TodoistLabel[]>;
  private readonly sectionsCache: LRUCache<string, TodoistSection[]>;

  // TTL constants based on research.md specifications
  private readonly PROJECTS_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly LABELS_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly SECTIONS_TTL = 15 * 60 * 1000; // 15 minutes

  // Cache keys
  private readonly PROJECTS_KEY = 'all_projects';
  private readonly LABELS_KEY = 'all_labels';

  constructor(maxCacheSize: number = 1000) {
    this.projectsCache = new LRUCache<string, TodoistProject[]>(maxCacheSize);
    this.labelsCache = new LRUCache<string, TodoistLabel[]>(maxCacheSize);
    this.sectionsCache = new LRUCache<string, TodoistSection[]>(maxCacheSize);
  }

  // Projects cache operations
  getProjects(): TodoistProject[] | null {
    return this.projectsCache.get(this.PROJECTS_KEY);
  }

  setProjects(projects: TodoistProject[]): void {
    this.projectsCache.set(this.PROJECTS_KEY, projects, this.PROJECTS_TTL);
  }

  invalidateProjects(): void {
    this.projectsCache.delete(this.PROJECTS_KEY);
  }

  // Labels cache operations
  getLabels(): TodoistLabel[] | null {
    return this.labelsCache.get(this.LABELS_KEY);
  }

  setLabels(labels: TodoistLabel[]): void {
    this.labelsCache.set(this.LABELS_KEY, labels, this.LABELS_TTL);
  }

  invalidateLabels(): void {
    this.labelsCache.delete(this.LABELS_KEY);
  }

  // Sections cache operations (per project)
  getSections(projectId: string): TodoistSection[] | null {
    return this.sectionsCache.get(`project_${projectId}`);
  }

  setSections(projectId: string, sections: TodoistSection[]): void {
    this.sectionsCache.set(`project_${projectId}`, sections, this.SECTIONS_TTL);
  }

  invalidateSections(projectId: string): void {
    this.sectionsCache.delete(`project_${projectId}`);
  }

  invalidateAllSections(): void {
    // Clear all section caches
    const validSections = this.sectionsCache.getAllValid();
    for (const key of validSections.keys()) {
      if (typeof key === 'string' && key.startsWith('project_')) {
        this.sectionsCache.delete(key);
      }
    }
  }

  // Project lookup utilities with cache integration
  findProjectById(projectId: string): TodoistProject | null {
    const projects = this.getProjects();
    if (!projects) return null;

    return projects.find(p => p.id === projectId) || null;
  }

  findProjectByName(name: string): TodoistProject | null {
    const projects = this.getProjects();
    if (!projects) return null;

    return (
      projects.find(p => p.name.toLowerCase() === name.toLowerCase()) || null
    );
  }

  // Label lookup utilities with cache integration
  findLabelById(labelId: string): TodoistLabel | null {
    const labels = this.getLabels();
    if (!labels) return null;

    return labels.find(l => l.id === labelId) || null;
  }

  findLabelByName(name: string): TodoistLabel | null {
    const labels = this.getLabels();
    if (!labels) return null;

    return (
      labels.find(l => l.name.toLowerCase() === name.toLowerCase()) || null
    );
  }

  // Section lookup utilities with cache integration
  findSectionById(projectId: string, sectionId: string): TodoistSection | null {
    const sections = this.getSections(projectId);
    if (!sections) return null;

    return sections.find(s => s.id === sectionId) || null;
  }

  findSectionByName(projectId: string, name: string): TodoistSection | null {
    const sections = this.getSections(projectId);
    if (!sections) return null;

    return (
      sections.find(s => s.name.toLowerCase() === name.toLowerCase()) || null
    );
  }

  // Cache invalidation for entity modifications
  invalidateRelatedCaches(
    entityType: 'project' | 'section' | 'label',
    entityId?: string
  ): void {
    switch (entityType) {
      case 'project':
        this.invalidateProjects();
        if (entityId) {
          this.invalidateSections(entityId);
        }
        break;

      case 'section':
        // When sections change, we need to invalidate the specific project's sections
        // Since we don't know which project, we'll need the project ID passed separately
        // or invalidate all sections (less efficient but safer)
        this.invalidateAllSections();
        break;

      case 'label':
        this.invalidateLabels();
        break;
    }
  }

  // Warm up cache with fresh data
  async warmupCache(
    projectsFetcher: () => Promise<TodoistProject[]>,
    labelsFetcher: () => Promise<TodoistLabel[]>,
    sectionsFetcher: (projectId: string) => Promise<TodoistSection[]>
  ): Promise<void> {
    try {
      // Fetch and cache projects
      const projects = await projectsFetcher();
      this.setProjects(projects);

      // Fetch and cache labels
      const labels = await labelsFetcher();
      this.setLabels(labels);

      // Fetch and cache sections for each project
      for (const project of projects) {
        try {
          const sections = await sectionsFetcher(project.id);
          this.setSections(project.id, sections);
        } catch (error) {
          // Continue with other projects if one fails
          console.warn(
            `Failed to cache sections for project ${project.id}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error('Cache warmup failed:', error);
      throw error;
    }
  }

  // Cache statistics and monitoring
  getStats() {
    return {
      projects: this.projectsCache.getStats(),
      labels: this.labelsCache.getStats(),
      sections: this.sectionsCache.getStats(),
      overall: {
        totalEntries:
          this.projectsCache.getStats().entries +
          this.labelsCache.getStats().entries +
          this.sectionsCache.getStats().entries,
        averageHitRate:
          (this.projectsCache.getStats().hitRate +
            this.labelsCache.getStats().hitRate +
            this.sectionsCache.getStats().hitRate) /
          3,
      },
    };
  }

  // Clear all caches
  clearAll(): void {
    this.projectsCache.clear();
    this.labelsCache.clear();
    this.sectionsCache.clear();
  }

  // Check cache health (expired entries, hit rates)
  getHealthStatus() {
    const stats = this.getStats();
    const isHealthy =
      stats.overall.totalEntries < 10000 && // Not too many entries
      stats.overall.averageHitRate > 0.5; // Good hit rate

    return {
      healthy: isHealthy,
      stats,
      recommendations: this.getOptimizationRecommendations(stats),
    };
  }

  private getOptimizationRecommendations(stats: any): string[] {
    const recommendations: string[] = [];

    if (stats.overall.averageHitRate < 0.3) {
      recommendations.push(
        'Consider adjusting TTL values - low hit rate detected'
      );
    }

    if (stats.overall.totalEntries > 5000) {
      recommendations.push(
        'Consider reducing cache size limits - high memory usage'
      );
    }

    if (stats.projects.hitRate < 0.8) {
      recommendations.push(
        'Projects cache hit rate is low - consider longer TTL'
      );
    }

    if (stats.sections.hitRate < 0.6) {
      recommendations.push(
        'Sections cache hit rate is low - may need optimization'
      );
    }

    return recommendations;
  }
}
