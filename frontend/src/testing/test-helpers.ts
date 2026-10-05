import { EnvironmentProviders, Provider } from '@angular/core';
import { Observable, of } from 'rxjs';
import { provideApiConfiguration } from '../app/core/api/api-configuration';
import { AccessTokenProvider } from '../app/core/auth/access-token';
import { RUNTIME_CONFIG, RuntimeConfig } from '../app/core/config/runtime-config';

export const TEST_CONFIG: RuntimeConfig = {
  apiUrl: 'http://api.test',
  authority: 'http://idp.test/realms/northwind',
  clientId: 'kb-web',
};

export class FakeTokenProvider extends AccessTokenProvider {
  token: string | null = 'test-token';

  token$(): Observable<string | null> {
    return of(this.token);
  }
}

export function provideTestRuntime(): (Provider | EnvironmentProviders)[] {
  return [
    { provide: RUNTIME_CONFIG, useValue: TEST_CONFIG },
    provideApiConfiguration(TEST_CONFIG.apiUrl),
    { provide: AccessTokenProvider, useClass: FakeTokenProvider },
  ];
}

export function sseBody(events: { event: string; data: unknown }[]): string {
  return events.map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`).join('');
}

export function streamResponse(chunks: string[], init: ResponseInit = { status: 200 }): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' }, ...init });
}

export function flushMicrotasks(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
