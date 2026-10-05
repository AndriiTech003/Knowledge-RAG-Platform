import { DEFAULT_RUNTIME_CONFIG, apiV1, loadRuntimeConfig, normalizeRuntimeConfig } from './runtime-config';

describe('runtime config', () => {
  it('loads config.json and trims trailing slashes', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ apiUrl: 'http://127.0.0.1:4450/', authority: 'http://kc/realms/x/', clientId: 'c' })));
    const config = await loadRuntimeConfig(fetcher as unknown as typeof fetch);
    expect(config).toEqual({ apiUrl: 'http://127.0.0.1:4450', authority: 'http://kc/realms/x', clientId: 'c' });
    expect(apiV1(config, 'me')).toBe('http://127.0.0.1:4450/api/v1/me');
  });

  it('falls back to defaults when config.json is missing', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 404 }));
    expect(await loadRuntimeConfig(fetcher as unknown as typeof fetch)).toEqual(DEFAULT_RUNTIME_CONFIG);
    expect(normalizeRuntimeConfig(null)).toEqual(DEFAULT_RUNTIME_CONFIG);
  });
});
