import { IHttpClient, HttpResponse, HttpRequestOptions } from '../../interfaces/IHttpClient';

export class FetchHttpClient implements IHttpClient {
  async request(url: string, options?: HttpRequestOptions): Promise<HttpResponse> {
    return fetch(url, options);
  }
}