import { DIContainer } from './DIContainer';
import { FetchHttpClient } from '../services/http/FetchHttpClient';
import { GeminiPromptGenerator } from '../services/ai/GeminiPromptGenerator';
import { VeoVideoGenerator } from '../services/ai/VeoVideoGenerator';
import { GeminiOperationPoller } from '../services/ai/GeminiOperationPoller';
import { DatabaseService } from '../services/database';
import { MockHttpClient } from '../services/mocks/MockHttpClient';
import { MockVideoGenerator } from '../services/mocks/MockVideoGenerator';

export class ContainerFactory {
  static createProductionContainer(env: any): DIContainer {
    const container = new DIContainer();

    // Register HTTP client
    container.register('httpClient', () => new FetchHttpClient());

    // Register operation poller
    container.register('operationPoller', () => {
      const httpClient = container.get('httpClient');
      return new GeminiOperationPoller(httpClient, env.GOOGLE_AI_API_KEY);
    });

    // Register prompt generator
    container.register('promptGenerator', () => {
      const httpClient = container.get('httpClient');
      return new GeminiPromptGenerator(httpClient, env.GOOGLE_AI_API_KEY);
    });

    // Register video generator
    container.register('videoGenerator', () => {
      const httpClient = container.get('httpClient');
      const operationPoller = container.get('operationPoller');
      return new VeoVideoGenerator(httpClient, operationPoller, env.GOOGLE_AI_API_KEY);
    });

    // Register database service
    container.register('databaseService', () => new DatabaseService(env.DB));

    return container;
  }

  static createTestContainer(env: any): DIContainer {
    const container = new DIContainer();

    // Use mock HTTP client for testing
    const mockHttpClient = new MockHttpClient();
    container.registerInstance('httpClient', mockHttpClient);

    // Use mock video generator for testing
    const mockVideoGenerator = new MockVideoGenerator();
    container.registerInstance('videoGenerator', mockVideoGenerator);

    // Register operation poller with mock client
    container.register('operationPoller', () => {
      return new GeminiOperationPoller(mockHttpClient, 'test-api-key');
    });

    // Register prompt generator with mock client
    container.register('promptGenerator', () => {
      return new GeminiPromptGenerator(mockHttpClient, 'test-api-key');
    });

    // Register database service
    container.register('databaseService', () => new DatabaseService(env.DB));

    return container;
  }

  static createContainer(env: any): DIContainer {
    const isTestEnvironment = env.ENVIRONMENT === 'test' || env.GOOGLE_AI_API_KEY === 'test-api-key';
    return isTestEnvironment
      ? ContainerFactory.createTestContainer(env)
      : ContainerFactory.createProductionContainer(env);
  }
}