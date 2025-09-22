export interface HttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<any>;
  text(): Promise<string>;
}

export interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface IHttpClient {
  request(url: string, options?: HttpRequestOptions): Promise<HttpResponse>;
}