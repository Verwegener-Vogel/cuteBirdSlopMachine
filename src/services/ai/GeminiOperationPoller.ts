import { IOperationPoller } from '../../interfaces/IOperationPoller';
import { IHttpClient } from '../../interfaces/IHttpClient';

export class GeminiOperationPoller implements IOperationPoller {
  private readonly apiBase = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(
    private readonly httpClient: IHttpClient,
    private readonly apiKey: string
  ) {}

  async pollOperation(operationName: string): Promise<any> {
    const response = await this.httpClient.request(
      `${this.apiBase}/${operationName}`,
      {
        method: 'GET',
        headers: {
          'x-goog-api-key': this.apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to check operation status:', errorText);
      throw new Error(`Failed to poll operation: ${response.status}`);
    }

    return response.json();
  }
}