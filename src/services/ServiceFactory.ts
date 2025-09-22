import { GeminiService } from './gemini';
import { DatabaseService } from './database';
import { DIContainer } from '../container/DIContainer';
import { ContainerFactory } from '../container/ContainerFactory';

export class ServiceFactory {
  private static container: DIContainer | null = null;

  static initialize(env: any): void {
    ServiceFactory.container = ContainerFactory.createContainer(env);
  }

  static getContainer(): DIContainer {
    if (!ServiceFactory.container) {
      throw new Error('Container not initialized. Call ServiceFactory.initialize(env) first.');
    }
    return ServiceFactory.container;
  }

  static createGeminiService(env: any): GeminiService {
    const container = ServiceFactory.getContainer();

    // Create GeminiService with injected dependencies
    return new GeminiService(
      container.get('promptGenerator'),
      container.get('videoGenerator'),
      container.get('operationPoller')
    );
  }

  static createDatabaseService(env: any): DatabaseService {
    const container = ServiceFactory.getContainer();
    return container.get('databaseService');
  }

  // For testing - allow injection of custom container
  static setContainer(container: DIContainer): void {
    ServiceFactory.container = container;
  }

  static reset(): void {
    ServiceFactory.container = null;
  }
}