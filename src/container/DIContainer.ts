import { IPromptGenerator } from '../interfaces/IPromptGenerator';
import { IVideoGenerator } from '../interfaces/IVideoGenerator';
import { IOperationPoller } from '../interfaces/IOperationPoller';
import { IHttpClient } from '../interfaces/IHttpClient';
import { DatabaseService } from '../services/database';

export interface ServiceContainer {
  httpClient: IHttpClient;
  promptGenerator: IPromptGenerator;
  videoGenerator: IVideoGenerator;
  operationPoller: IOperationPoller;
  databaseService: DatabaseService;
}

export class DIContainer {
  private services = new Map<keyof ServiceContainer, any>();
  private factories = new Map<keyof ServiceContainer, () => any>();

  register<K extends keyof ServiceContainer>(
    name: K,
    factory: () => ServiceContainer[K]
  ): void {
    this.factories.set(name, factory);
  }

  registerInstance<K extends keyof ServiceContainer>(
    name: K,
    instance: ServiceContainer[K]
  ): void {
    this.services.set(name, instance);
  }

  get<K extends keyof ServiceContainer>(name: K): ServiceContainer[K] {
    // Return existing instance if available
    if (this.services.has(name)) {
      return this.services.get(name);
    }

    // Create new instance using factory
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`Service ${String(name)} not registered`);
    }

    const instance = factory();
    this.services.set(name, instance); // Cache for singleton behavior
    return instance;
  }

  // Clear all cached instances (useful for testing)
  clear(): void {
    this.services.clear();
  }

  // Clear only cached instances, keep factories
  clearInstances(): void {
    this.services.clear();
  }
}