import { inject } from '@angular/core';
import { RUNTIME_CONFIG } from '../config/runtime-config';

export function isApiRequest(url: string, apiUrl: string): boolean {
  return url.startsWith(`${apiUrl}/api/`) || url.startsWith(`${apiUrl}/health`);
}

export function injectIsApiRequest(): (url: string) => boolean {
  const config = inject(RUNTIME_CONFIG);
  return (url: string) => isApiRequest(url, config.apiUrl);
}

export function injectApiV1(): (path: string) => string {
  const config = inject(RUNTIME_CONFIG);
  return (path: string) => `${config.apiUrl}/api/v1${path.startsWith('/') ? path : `/${path}`}`;
}
