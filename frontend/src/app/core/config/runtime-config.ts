import { InjectionToken } from '@angular/core';

export interface RuntimeConfig {
  apiUrl: string;
  authority: string;
  clientId: string;
}

export const RUNTIME_CONFIG = new InjectionToken<RuntimeConfig>('RUNTIME_CONFIG');

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  apiUrl: 'http://127.0.0.1:4400',
  authority: 'http://127.0.0.1:4480/realms/northwind',
  clientId: 'kb-web',
};

export function normalizeRuntimeConfig(raw: Partial<RuntimeConfig> | null | undefined): RuntimeConfig {
  const merged = { ...DEFAULT_RUNTIME_CONFIG, ...(raw ?? {}) };
  return {
    apiUrl: merged.apiUrl.replace(/\/+$/, ''),
    authority: merged.authority.replace(/\/+$/, ''),
    clientId: merged.clientId,
  };
}

export async function loadRuntimeConfig(fetcher: typeof fetch = fetch): Promise<RuntimeConfig> {
  try {
    const response = await fetcher('/config.json', { cache: 'no-store' });
    if (!response.ok) return DEFAULT_RUNTIME_CONFIG;
    return normalizeRuntimeConfig((await response.json()) as Partial<RuntimeConfig>);
  } catch {
    return DEFAULT_RUNTIME_CONFIG;
  }
}

export function apiV1(config: RuntimeConfig, path: string): string {
  return `${config.apiUrl}/api/v1${path.startsWith('/') ? path : `/${path}`}`;
}
