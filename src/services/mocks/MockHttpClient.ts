import { IHttpClient, HttpResponse, HttpRequestOptions } from '../../interfaces/IHttpClient';

export class MockHttpClient implements IHttpClient {
  private responses = new Map<string, HttpResponse>();
  private requestHistory: Array<{ url: string; options?: HttpRequestOptions }> = [];

  async request(url: string, options?: HttpRequestOptions): Promise<HttpResponse> {
    this.requestHistory.push({ url, options });

    const response = this.responses.get(url);
    if (response) {
      return response;
    }

    // Default 404 response
    return {
      ok: false,
      status: 404,
      json: async () => { throw new Error('Not found'); },
      text: async () => 'Not found',
    };
  }

  mockResponse(url: string, response: HttpResponse): void {
    this.responses.set(url, response);
  }

  mockResponsePattern(pattern: RegExp, response: HttpResponse): void {
    // For pattern-based mocking, we need to intercept in request method
    // This is simplified for demonstration
  }

  getRequestHistory() {
    return this.requestHistory;
  }

  clearHistory() {
    this.requestHistory = [];
  }

  clearMocks() {
    this.responses.clear();
  }
}