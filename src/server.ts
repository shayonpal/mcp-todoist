#!/usr/bin/env node

import type { TodoistMCPServerImpl } from './server/impl.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

type HealthCheckResponse = Awaited<
  ReturnType<TodoistMCPServerImpl['healthCheck']>
>;

type TodoistMCPServerImplementation = {
  healthCheck(): Promise<HealthCheckResponse>;
  stop(): Promise<void>;
  getServerInstance(): Server;
};

type ServerImplementationModule = {
  createServerInstance(): TodoistMCPServerImpl;
};

let implementationModulePromise: Promise<ServerImplementationModule> | null =
  null;

function loadImplementation(): Promise<ServerImplementationModule> {
  if (!implementationModulePromise) {
    implementationModulePromise = import(
      './server/impl.js'
    ) as Promise<ServerImplementationModule>;
  }

  return implementationModulePromise;
}

export class TodoistMCPServer {
  private readonly implPromise: Promise<TodoistMCPServerImplementation>;

  constructor() {
    this.implPromise = loadImplementation().then(module =>
      module.createServerInstance()
    );
  }

  private async getImpl(): Promise<TodoistMCPServerImplementation> {
    return this.implPromise;
  }

  async healthCheck() {
    const impl = await this.getImpl();
    return impl.healthCheck();
  }

  async stop(): Promise<void> {
    const impl = await this.getImpl();
    return impl.stop();
  }

  /**
   * Gets the underlying MCP Server instance for HTTP/SSE transport integration.
   *
   * This method returns the singleton Server instance that is created once per
   * TodoistMCPServerImpl construction and reused across all subsequent requests.
   * In serverless/container environments (e.g., AWS Lambda, Cloud Run), the entire
   * TodoistMCPServer instance (including the Server) may be reused across multiple
   * HTTP requests during a "warm" container's lifetime.
   *
   * **Container Reuse Behavior:**
   * - **Cold Start**: First request creates new TodoistMCPServer → new Server instance
   * - **Warm Container**: Subsequent requests reuse existing TodoistMCPServer → same Server instance
   * - **Why**: Avoids expensive Server initialization on every HTTP request
   *
   * **State Implications:**
   * - Server instance maintains internal state (handlers, capabilities, connection)
   * - Tools are initialized once and shared across requests (see TodoistMCPServerImpl)
   * - API tokens and configuration loaded once at construction time
   * - Request handlers should be stateless or handle concurrent execution safely
   *
   * **Usage Pattern:**
   * Typically called by HTTP transport adapters (e.g., Express middleware) that need
   * direct access to the Server instance for SSE streaming or request routing.
   *
   * @returns Promise resolving to the underlying MCP Server instance
   *
   * @example
   * ```typescript
   * const server = getServer();
   * const mcpServer = await server.getServerInstance();
   * // Use mcpServer with HTTP transport adapter
   * ```
   */
  async getServerInstance(): Promise<Server> {
    const impl = await this.getImpl();
    return impl.getServerInstance();
  }
}

let serverInstance: TodoistMCPServer | null = null;

/**
 * Gets or creates the singleton TodoistMCPServer instance (module-level singleton pattern).
 *
 * This function implements a lazy-initialized singleton pattern to ensure only one
 * TodoistMCPServer instance exists per Node.js process. In serverless/container
 * environments, the Node.js process (and this singleton) may be reused across multiple
 * invocations during the container's warm lifetime.
 *
 * **Singleton Lifecycle:**
 * - **First Call**: Creates new TodoistMCPServer instance, caches it in `serverInstance`
 * - **Subsequent Calls**: Returns cached instance (no re-initialization)
 * - **Cold Start**: New process → new singleton instance
 * - **Warm Container**: Same process → same singleton instance across requests
 *
 * **Why Singleton Pattern:**
 * 1. **Performance**: Avoids expensive initialization on every request (tool registration,
 *    Server construction, handler setup)
 * 2. **Resource Efficiency**: Single set of tool instances shared across requests
 * 3. **HTTP Transport**: Required for SSE streaming where Server must persist across
 *    multiple HTTP responses
 * 4. **State Management**: Centralizes Server lifecycle in one place
 *
 * **Container Reuse in Serverless:**
 * In platforms like AWS Lambda, Google Cloud Run, or Azure Functions:
 * - Container may stay "warm" and handle multiple requests sequentially
 * - This function returns the same instance across those warm requests
 * - Reduces cold-start overhead by reusing initialized Server, tools, and API clients
 * - Environment variables and configuration loaded once at first call
 *
 * **State Implications:**
 * - Server instance is stateful (maintains connection, handlers, capabilities)
 * - Tool instances are shared (API clients, caches, validation state)
 * - Request handlers must be designed for concurrent/sequential execution safety
 * - No per-request state should leak between invocations
 *
 * **Trade-offs:**
 * - **Pro**: Fast warm-start performance, efficient resource usage
 * - **Con**: Must handle potential stale state (e.g., expired tokens, outdated config)
 * - **Con**: Shared tool instances must be thread-safe (though Node.js is single-threaded)
 *
 * @returns The singleton TodoistMCPServer instance
 *
 * @example
 * ```typescript
 * // HTTP endpoint handler
 * app.post('/mcp', async (req, res) => {
 *   const server = getServer(); // Reuses instance across requests
 *   const mcpServer = await server.getServerInstance();
 *   // Handle MCP request...
 * });
 * ```
 */
export function getServer(): TodoistMCPServer {
  if (!serverInstance) {
    serverInstance = new TodoistMCPServer();
  }

  return serverInstance;
}
