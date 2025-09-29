import { getFullConfig } from '../config/index.js';

/**
 * Log levels in order of verbosity
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  context?: Record<string, unknown>;
  sanitized?: boolean;
}

/**
 * Context for correlation tracking
 */
export interface LogContext {
  correlationId?: string;
  toolName?: string;
  action?: string;
  userId?: string;
  operationId?: string;
  [key: string]: unknown;
}

/**
 * Structured logger with correlation ID support and data sanitization
 */
export class StructuredLogger {
  private static instance: StructuredLogger;
  private config = getFullConfig();
  private contextStore = new Map<string, LogContext>();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger();
    }
    return StructuredLogger.instance;
  }

  /**
   * Set context for current operation
   */
  setContext(correlationId: string, context: LogContext): void {
    this.contextStore.set(correlationId, {
      ...context,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get context for correlation ID
   */
  getContext(correlationId: string): LogContext | undefined {
    return this.contextStore.get(correlationId);
  }

  /**
   * Clear context (cleanup after operation)
   */
  clearContext(correlationId: string): void {
    this.contextStore.delete(correlationId);
  }

  /**
   * Generate a new correlation ID
   */
  generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    const configLevel = this.config.logging.level;
    const levels = [
      LogLevel.ERROR,
      LogLevel.WARN,
      LogLevel.INFO,
      LogLevel.DEBUG,
    ];
    const configIndex = levels.indexOf(configLevel as LogLevel);
    const messageIndex = levels.indexOf(level);

    return messageIndex <= configIndex;
  }

  /**
   * Sanitize log data for production
   */
  private sanitizeData(data: unknown): unknown {
    if (!this.config.logging.sanitizePersonalData) {
      return data;
    }

    if (typeof data === 'string') {
      return this.sanitizeString(data);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    if (data && typeof data === 'object') {
      const sanitized: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(data)) {
        // Skip sensitive keys entirely
        if (this.isSensitiveKey(key)) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeData(value);
        }
      }

      return sanitized;
    }

    return data;
  }

  /**
   * Check if a key contains sensitive information
   */
  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      'token',
      'password',
      'secret',
      'key',
      'auth',
      'authorization',
      'cookie',
      'session',
      'api_token',
      'access_token',
      'refresh_token',
      'apiToken',
      'accessToken',
      'refreshToken',
    ];

    return sensitiveKeys.some(sensitiveKey =>
      key.toLowerCase().includes(sensitiveKey)
    );
  }

  /**
   * Sanitize string content
   */
  private sanitizeString(str: string): string {
    return (
      str
        // Remove potential tokens
        .replace(/token[:\s=][\w-]+/gi, 'token=[REDACTED]')
        .replace(/bearer\s+[\w-]+/gi, 'Bearer [REDACTED]')
        // Remove potential IDs that might be sensitive
        .replace(/\b\d{10,}\b/g, '[REDACTED]')
        // Remove email addresses
        .replace(
          /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
          '[EMAIL_REDACTED]'
        )
        // Remove potential URLs with tokens
        .replace(/https?:\/\/[^\s]*token[^\s]*/gi, '[URL_WITH_TOKEN_REDACTED]')
    );
  }

  /**
   * Format log entry for output
   */
  private formatLogEntry(entry: LogEntry): string {
    const parts = [entry.timestamp, `[${entry.level.toUpperCase()}]`];

    if (entry.correlationId) {
      parts.push(`[${entry.correlationId}]`);
    }

    parts.push(entry.message);

    let formatted = parts.join(' ');

    if (entry.context && Object.keys(entry.context).length > 0) {
      formatted += ' ' + JSON.stringify(entry.context);
    }

    return formatted;
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context: Record<string, unknown> = {},
    correlationId?: string
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = new Date().toISOString();

    // Get stored context if available
    const storedContext = correlationId
      ? this.getContext(correlationId)
      : undefined;

    // Merge contexts
    const mergedContext = {
      ...storedContext,
      ...context,
    };

    // Remove correlationId from context to avoid duplication
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { correlationId: _unused, ...contextWithoutCorrelationId } =
      mergedContext;

    const entry: LogEntry = {
      timestamp,
      level,
      message,
      correlationId: correlationId || storedContext?.correlationId,
      context: this.sanitizeData(contextWithoutCorrelationId) as Record<
        string,
        unknown
      >,
      sanitized: this.config.logging.sanitizePersonalData,
    };

    const formatted = this.formatLogEntry(entry);

    // Output to appropriate stream
    if (level === LogLevel.ERROR) {
      console.error(formatted);
    } else {
      console.log(formatted);
    }
  }

  /**
   * Error level logging
   */
  error(
    message: string,
    context: Record<string, unknown> = {},
    correlationId?: string
  ): void {
    this.log(LogLevel.ERROR, message, context, correlationId);
  }

  /**
   * Warning level logging
   */
  warn(
    message: string,
    context: Record<string, unknown> = {},
    correlationId?: string
  ): void {
    this.log(LogLevel.WARN, message, context, correlationId);
  }

  /**
   * Info level logging
   */
  info(
    message: string,
    context: Record<string, unknown> = {},
    correlationId?: string
  ): void {
    this.log(LogLevel.INFO, message, context, correlationId);
  }

  /**
   * Debug level logging
   */
  debug(
    message: string,
    context: Record<string, unknown> = {},
    correlationId?: string
  ): void {
    this.log(LogLevel.DEBUG, message, context, correlationId);
  }

  /**
   * Log API request start
   */
  logRequestStart(
    correlationId: string,
    method: string,
    url: string,
    context: LogContext = {}
  ): void {
    this.setContext(correlationId, {
      ...context,
      method,
      url: this.sanitizeString(url),
      startTime: Date.now(),
    });

    this.info(
      'API request started',
      {
        method,
        url: this.sanitizeString(url),
        toolName: context.toolName,
        action: context.action,
      },
      correlationId
    );
  }

  /**
   * Log API request completion
   */
  logRequestEnd(
    correlationId: string,
    statusCode: number,
    responseTime: number,
    context: Record<string, unknown> = {}
  ): void {
    const storedContext = this.getContext(correlationId);

    this.info(
      'API request completed',
      {
        statusCode,
        responseTime,
        method: storedContext?.method,
        toolName: storedContext?.toolName,
        action: storedContext?.action,
        ...context,
      },
      correlationId
    );

    // Clean up context after request completion
    this.clearContext(correlationId);
  }

  /**
   * Log API request failure
   */
  logRequestError(
    correlationId: string,
    error: unknown,
    responseTime: number,
    context: Record<string, unknown> = {}
  ): void {
    const storedContext = this.getContext(correlationId);

    this.error(
      'API request failed',
      {
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
              }
            : error,
        responseTime,
        method: storedContext?.method,
        toolName: storedContext?.toolName,
        action: storedContext?.action,
        ...context,
      },
      correlationId
    );

    // Clean up context after error
    this.clearContext(correlationId);
  }

  /**
   * Log tool execution start
   */
  logToolStart(
    correlationId: string,
    toolName: string,
    action: string,
    context: Record<string, unknown> = {}
  ): void {
    this.setContext(correlationId, {
      toolName,
      action,
      startTime: Date.now(),
    });

    this.info(
      'Tool execution started',
      {
        toolName,
        action,
        ...context,
      },
      correlationId
    );
  }

  /**
   * Log tool execution completion
   */
  logToolEnd(
    correlationId: string,
    success: boolean,
    executionTime: number,
    context: Record<string, unknown> = {}
  ): void {
    const storedContext = this.getContext(correlationId);

    this.info(
      'Tool execution completed',
      {
        toolName: storedContext?.toolName,
        action: storedContext?.action,
        success,
        executionTime,
        ...context,
      },
      correlationId
    );
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetrics(
    correlationId: string,
    metrics: {
      operationType: string;
      duration: number;
      memoryUsage?: number;
      cacheHit?: boolean;
      rateLimitRemaining?: number;
      [key: string]: unknown;
    }
  ): void {
    this.debug('Performance metrics', metrics, correlationId);
  }

  /**
   * Log rate limit information
   */
  logRateLimit(
    correlationId: string,
    rateLimitInfo: {
      remaining: number;
      resetTime: number;
      limitType: string;
      retryAfter?: number;
    }
  ): void {
    if (rateLimitInfo.remaining < 10) {
      this.warn('Rate limit approaching', rateLimitInfo, correlationId);
    } else {
      this.debug('Rate limit status', rateLimitInfo, correlationId);
    }
  }

  /**
   * Get logging statistics
   */
  getStats(): {
    activeContexts: number;
    memoryUsage: number;
    logLevel: string;
    sanitizationEnabled: boolean;
  } {
    return {
      activeContexts: this.contextStore.size,
      memoryUsage: process.memoryUsage().heapUsed,
      logLevel: this.config.logging.level,
      sanitizationEnabled: this.config.logging.sanitizePersonalData,
    };
  }

  /**
   * Cleanup old contexts (prevent memory leaks)
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [correlationId, context] of this.contextStore.entries()) {
      const contextAge = now - ((context.startTime as number) || 0);
      if (contextAge > maxAge) {
        this.contextStore.delete(correlationId);
      }
    }
  }
}

/**
 * Global logger instance
 */
export const logger = StructuredLogger.getInstance();

/**
 * Middleware function for automatic correlation ID management
 */
export function withCorrelationId<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: LogContext = {}
): T {
  return (async (...args: Parameters<T>) => {
    const correlationId = logger.generateCorrelationId();

    try {
      logger.setContext(correlationId, context);
      const result = await fn(...args);
      return result;
    } finally {
      logger.clearContext(correlationId);
    }
  }) as T;
}

/**
 * Decorator for automatic request logging
 */
export function loggedOperation(operationType: string) {
  return function <T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!;

    descriptor.value = async function (this: any, ...args: Parameters<T>) {
      const correlationId = logger.generateCorrelationId();
      const startTime = Date.now();

      try {
        logger.logToolStart(
          correlationId,
          target.constructor.name,
          operationType
        );
        const result = await method.apply(this, args);
        const executionTime = Date.now() - startTime;

        logger.logToolEnd(correlationId, true, executionTime);
        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        logger.logRequestError(correlationId, error, executionTime);
        throw error;
      }
    } as T;
  };
}

// Periodic cleanup to prevent memory leaks
setInterval(
  () => {
    logger.cleanup();
  },
  30 * 60 * 1000
); // Cleanup every 30 minutes
