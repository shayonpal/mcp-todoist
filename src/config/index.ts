import { config } from 'dotenv';
import { APIConfiguration } from '../types/todoist.js';
import { ValidationError } from '../types/errors.js';

// Load environment variables from .env file
config();

/**
 * Configuration constants
 */
export const CONFIG_DEFAULTS = {
  TODOIST_API_BASE_URL: 'https://api.todoist.com/api/v1',
  REQUEST_TIMEOUT: 10000, // 10 seconds
  RETRY_ATTEMPTS: 3,
  RATE_LIMIT_BUFFER: 0.8, // Use 80% of rate limit capacity
  CACHE_TTL_PROJECTS: 30 * 60 * 1000, // 30 minutes
  CACHE_TTL_LABELS: 30 * 60 * 1000, // 30 minutes
  CACHE_TTL_SECTIONS: 15 * 60 * 1000, // 15 minutes
  LOG_LEVEL: 'info',
  MAX_BATCH_SIZE: 100,
} as const;

/**
 * Environment variable mapping
 */
interface EnvironmentConfig {
  TODOIST_API_TOKEN?: string;
  TODOIST_API_BASE_URL?: string;
  REQUEST_TIMEOUT?: string;
  RETRY_ATTEMPTS?: string;
  LOG_LEVEL?: string;
  MAX_BATCH_SIZE?: string;
  NODE_ENV?: string;
}

/**
 * Parse and validate environment variables
 */
function parseEnvironmentConfig(): {
  apiToken: string;
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  logLevel: string;
  maxBatchSize: number;
  isProduction: boolean;
  isDevelopment: boolean;
} {
  const env = process.env as EnvironmentConfig;

  // Validate required API token
  const apiToken = env.TODOIST_API_TOKEN;
  if (!apiToken) {
    throw new ValidationError(
      'TODOIST_API_TOKEN environment variable is required. ' +
        'Please set it in your MCP client configuration or .env file.'
    );
  }

  // Validate API token format (basic check)
  if (typeof apiToken !== 'string' || apiToken.length < 10) {
    throw new ValidationError(
      'TODOIST_API_TOKEN appears to be invalid. ' +
        'Please check your API token from Todoist settings.'
    );
  }

  // Parse and validate numeric values
  const timeout = env.REQUEST_TIMEOUT
    ? parseInt(env.REQUEST_TIMEOUT, 10)
    : CONFIG_DEFAULTS.REQUEST_TIMEOUT;

  if (isNaN(timeout) || timeout < 1000 || timeout > 60000) {
    throw new ValidationError(
      'REQUEST_TIMEOUT must be between 1000 and 60000 milliseconds'
    );
  }

  const retryAttempts = env.RETRY_ATTEMPTS
    ? parseInt(env.RETRY_ATTEMPTS, 10)
    : CONFIG_DEFAULTS.RETRY_ATTEMPTS;

  if (isNaN(retryAttempts) || retryAttempts < 0 || retryAttempts > 10) {
    throw new ValidationError('RETRY_ATTEMPTS must be between 0 and 10');
  }

  const maxBatchSize = env.MAX_BATCH_SIZE
    ? parseInt(env.MAX_BATCH_SIZE, 10)
    : CONFIG_DEFAULTS.MAX_BATCH_SIZE;

  if (isNaN(maxBatchSize) || maxBatchSize < 1 || maxBatchSize > 100) {
    throw new ValidationError(
      'MAX_BATCH_SIZE must be between 1 and 100 (Todoist API limit)'
    );
  }

  // Validate URL
  const baseUrl =
    env.TODOIST_API_BASE_URL || CONFIG_DEFAULTS.TODOIST_API_BASE_URL;
  try {
    new URL(baseUrl);
  } catch {
    throw new ValidationError('TODOIST_API_BASE_URL must be a valid URL');
  }

  // Validate log level
  const validLogLevels = ['error', 'warn', 'info', 'debug'];
  const logLevel = env.LOG_LEVEL || CONFIG_DEFAULTS.LOG_LEVEL;
  if (!validLogLevels.includes(logLevel)) {
    throw new ValidationError(
      `LOG_LEVEL must be one of: ${validLogLevels.join(', ')}`
    );
  }

  // Environment detection
  const nodeEnv = env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const isDevelopment = nodeEnv === 'development';

  return {
    apiToken,
    baseUrl,
    timeout,
    retryAttempts,
    logLevel,
    maxBatchSize,
    isProduction,
    isDevelopment,
  };
}

/**
 * Application configuration
 */
export interface AppConfig {
  api: APIConfiguration;
  cache: {
    ttlProjects: number;
    ttlLabels: number;
    ttlSections: number;
  };
  logging: {
    level: string;
    enableCorrelationIds: boolean;
    sanitizePersonalData: boolean;
  };
  performance: {
    maxBatchSize: number;
    rateLimitBuffer: number;
  };
  environment: {
    isProduction: boolean;
    isDevelopment: boolean;
    nodeEnv: string;
  };
}

let cachedConfig: AppConfig | null = null;

/**
 * Get application configuration
 * Uses caching to avoid re-parsing environment variables on every call
 */
export function getConfig(): APIConfiguration {
  if (!cachedConfig) {
    try {
      const env = parseEnvironmentConfig();

      cachedConfig = {
        api: {
          token: env.apiToken,
          base_url: env.baseUrl,
          timeout: env.timeout,
          retry_attempts: env.retryAttempts,
        },
        cache: {
          ttlProjects: CONFIG_DEFAULTS.CACHE_TTL_PROJECTS,
          ttlLabels: CONFIG_DEFAULTS.CACHE_TTL_LABELS,
          ttlSections: CONFIG_DEFAULTS.CACHE_TTL_SECTIONS,
        },
        logging: {
          level: env.logLevel,
          enableCorrelationIds: true,
          sanitizePersonalData: env.isProduction, // Only sanitize in production
        },
        performance: {
          maxBatchSize: env.maxBatchSize,
          rateLimitBuffer: CONFIG_DEFAULTS.RATE_LIMIT_BUFFER,
        },
        environment: {
          isProduction: env.isProduction,
          isDevelopment: env.isDevelopment,
          nodeEnv: process.env.NODE_ENV || 'development',
        },
      };
    } catch (error) {
      // Re-throw configuration errors with helpful context
      throw new ValidationError(
        `Configuration error: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          'Please check your environment variables and .env file.'
      );
    }
  }

  return cachedConfig.api;
}

/**
 * Get full application configuration (including non-API settings)
 */
export function getFullConfig(): AppConfig {
  // Trigger config loading if not already cached
  getConfig();

  if (!cachedConfig) {
    throw new ValidationError('Failed to load configuration');
  }

  return cachedConfig;
}

/**
 * Validate configuration without throwing errors
 * Useful for health checks and diagnostics
 */
export function validateConfig(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    parseEnvironmentConfig();
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : 'Unknown configuration error'
    );
  }

  // Additional validation warnings
  const env = process.env;

  if (!env.NODE_ENV) {
    warnings.push('NODE_ENV not set, defaulting to development');
  }

  if (
    env.TODOIST_API_BASE_URL &&
    env.TODOIST_API_BASE_URL !== CONFIG_DEFAULTS.TODOIST_API_BASE_URL
  ) {
    warnings.push('Using custom Todoist API base URL');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Reset cached configuration (useful for testing)
 */
export function resetConfig(): void {
  cachedConfig = null;
}

/**
 * Get configuration as environment-safe object (no sensitive data)
 * Useful for logging and diagnostics
 */
export function getConfigSummary(): {
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
    hasToken: boolean;
  };
  cache: {
    ttlProjects: number;
    ttlLabels: number;
    ttlSections: number;
  };
  performance: {
    maxBatchSize: number;
    rateLimitBuffer: number;
  };
  environment: {
    nodeEnv: string;
    isProduction: boolean;
  };
} {
  const fullConfig = getFullConfig();

  return {
    api: {
      baseUrl: fullConfig.api.base_url,
      timeout: fullConfig.api.timeout,
      retryAttempts: fullConfig.api.retry_attempts,
      hasToken: !!fullConfig.api.token,
    },
    cache: fullConfig.cache,
    performance: fullConfig.performance,
    environment: {
      nodeEnv: fullConfig.environment.nodeEnv,
      isProduction: fullConfig.environment.isProduction,
    },
  };
}
