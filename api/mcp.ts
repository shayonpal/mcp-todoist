#!/usr/bin/env node

/**
 * Vercel serverless function for MCP HTTP transport
 * Handles MCP protocol messages over HTTP POST requests
 *
 * Requirements:
 * - TODOIST_API_TOKEN environment variable must be set
 *
 * Architecture:
 * - Uses singleton pattern: single MCP Server instance shared across requests
 * - Serverless containers may be reused, so server persists between requests
 * - Transport is created per-request and closed after handling
 */

import { getServer } from '../src/server.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { logger } from '../src/middleware/logging.js';

/**
 * Maximum request body size (1MB)
 */
const MAX_REQUEST_SIZE = 1024 * 1024; // 1MB

/**
 * Default timeout for operations (5 seconds)
 */
const DEFAULT_TIMEOUT = 5000;

/**
 * Request handling timeout (30 seconds)
 */
const HANDLE_REQUEST_TIMEOUT = 30000;

/**
 * JSON-RPC error codes
 */
enum JsonRpcErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
}

/**
 * Create a timeout wrapper for async operations
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(
      () =>
        reject(
          new Error(
            `Operation '${operation}' timed out after ${timeoutMs}ms`
          )
        ),
      timeoutMs
    );
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle);
  });
}

/**
 * Sanitize error message for client response (hide internal details)
 */
function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Only expose generic messages, not internal details
    if (error.message.includes('timeout')) {
      return 'Request timed out';
    }
    if (error.message.includes('parse') || error.message.includes('JSON')) {
      return 'Invalid JSON format';
    }
    // Generic message for all other errors
    return 'Internal server error';
  }
  return 'Unknown error occurred';
}

/**
 * Create JSON-RPC error response
 */
function createJsonRpcError(
  code: JsonRpcErrorCode,
  message: string,
  id: string | number | null = null,
  data?: unknown
): Response {
  const errorObject: {
    code: JsonRpcErrorCode;
    message: string;
    data?: unknown;
  } = {
    code,
    message,
  };

  if (data !== undefined) {
    errorObject.data = data;
  }

  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: errorObject,
    }),
    {
      status: code === JsonRpcErrorCode.PARSE_ERROR ? 400 : 500,
      headers: {
        'content-type': 'application/json',
      },
    }
  );
}

/**
 * Validate request headers and size
 */
async function validateRequest(request: Request): Promise<void> {
  // Validate Content-Type
  const contentType = request.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Invalid Content-Type: must be application/json');
  }

  // Validate request size
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
    throw new Error(
      `Request too large: maximum ${MAX_REQUEST_SIZE} bytes allowed`
    );
  }
}

/**
 * Vercel serverless function handler
 * Accepts POST requests with MCP protocol messages
 */
export async function POST(request: Request): Promise<Response> {
  // Generate correlation ID at request start
  const correlationId = logger.generateCorrelationId();
  const startTime = Date.now();
  let transport: WebStandardStreamableHTTPServerTransport | null = null;
  let requestId: string | number | null = null;

  try {
    // Log request start
    logger.logRequestStart(correlationId, 'POST', request.url);

    // Stage 1: Request validation
    try {
      await withTimeout(
        validateRequest(request),
        DEFAULT_TIMEOUT,
        'request validation'
      );
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.logRequestError(correlationId, error, responseTime, {
        stage: 'validation',
        error: error instanceof Error ? error.message : String(error),
      });
      return createJsonRpcError(
        JsonRpcErrorCode.INVALID_REQUEST,
        'Invalid request format',
        null
      );
    }

    // Stage 2: JSON parsing
    let parsedBody: unknown;
    try {
      const bodyText = await withTimeout(
        request.text(),
        DEFAULT_TIMEOUT,
        'body read'
      );

      // Check body size after reading
      if (bodyText.length > MAX_REQUEST_SIZE) {
        throw new Error(`Request body too large: ${bodyText.length} bytes`);
      }

      parsedBody = JSON.parse(bodyText);

      // Extract request ID from parsed body if available
      if (
        parsedBody &&
        typeof parsedBody === 'object' &&
        'id' in parsedBody
      ) {
        requestId = (parsedBody as { id: string | number }).id;
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.logRequestError(correlationId, error, responseTime, {
        stage: 'json_parse',
        error: error instanceof Error ? error.message : String(error),
      });

      // Parse errors get special error code
      return createJsonRpcError(
        JsonRpcErrorCode.PARSE_ERROR,
        'Parse error: Invalid JSON',
        null
      );
    }

    // Stage 3: Server initialization
    let server;
    try {
      const serverWrapper = getServer();
      server = await withTimeout(
        serverWrapper.getServerInstance(),
        DEFAULT_TIMEOUT,
        'server initialization'
      );
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.logRequestError(correlationId, error, responseTime, {
        stage: 'server_init',
        error: error instanceof Error ? error.message : String(error),
      });
      return createJsonRpcError(
        JsonRpcErrorCode.INTERNAL_ERROR,
        sanitizeErrorMessage(error),
        requestId
      );
    }

    // Stage 4: Transport setup
    try {
      transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Delegate session ID generation to client
        enableJsonResponse: true, // Return JSON responses instead of SSE
      });

      await withTimeout(
        server.connect(transport),
        DEFAULT_TIMEOUT,
        'transport connection'
      );
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.logRequestError(correlationId, error, responseTime, {
        stage: 'transport_setup',
        error: error instanceof Error ? error.message : String(error),
      });
      return createJsonRpcError(
        JsonRpcErrorCode.INTERNAL_ERROR,
        sanitizeErrorMessage(error),
        requestId
      );
    }

    // Stage 5: Handle request
    try {
      const response = await withTimeout(
        transport.handleRequest(request, { parsedBody }),
        HANDLE_REQUEST_TIMEOUT,
        'request handling'
      );

      const responseTime = Date.now() - startTime;
      logger.logRequestEnd(correlationId, response.status, responseTime, {
        requestId,
      });

      return response;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.logRequestError(correlationId, error, responseTime, {
        stage: 'request_handling',
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return createJsonRpcError(
        JsonRpcErrorCode.INTERNAL_ERROR,
        sanitizeErrorMessage(error),
        requestId
      );
    }
  } catch (error) {
    // Unexpected error (should not reach here)
    const responseTime = Date.now() - startTime;
    logger.logRequestError(correlationId, error, responseTime, {
      stage: 'unexpected',
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return createJsonRpcError(
      JsonRpcErrorCode.INTERNAL_ERROR,
      sanitizeErrorMessage(error),
      requestId
    );
  } finally {
    // Ensure transport is closed in all cases
    if (transport) {
      try {
        await withTimeout(
          transport.close(),
          DEFAULT_TIMEOUT,
          'transport cleanup'
        );
      } catch (error) {
        // Log cleanup error but don't fail the request
        logger.error(
          'Failed to close transport',
          {
            error: error instanceof Error ? error.message : String(error),
            correlationId,
            requestId,
          },
          correlationId
        );
      }
    }
  }
}
