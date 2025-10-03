#!/usr/bin/env node

import type { TodoistMCPServerImpl } from './server/impl.js';

type HealthCheckResponse = Awaited<
  ReturnType<TodoistMCPServerImpl['healthCheck']>
>;

type TodoistMCPServerImplementation = {
  healthCheck(): Promise<HealthCheckResponse>;
  run(): Promise<void>;
  stop(): Promise<void>;
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

  async run(): Promise<void> {
    const impl = await this.getImpl();
    return impl.run();
  }

  async stop(): Promise<void> {
    const impl = await this.getImpl();
    return impl.stop();
  }
}

let serverInstance: TodoistMCPServer | null = null;

export function getServer(): TodoistMCPServer {
  if (!serverInstance) {
    serverInstance = new TodoistMCPServer();
  }

  return serverInstance;
}
