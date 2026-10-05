import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { buildAppConfig } from './app/app.config';
import { loadRuntimeConfig } from './app/core/config/runtime-config';
import { initLocale } from './app/core/i18n/locale';

async function bootstrap(): Promise<void> {
  const [config, auth, locale] = await Promise.all([loadRuntimeConfig(), import('./app/core/auth/auth.config'), initLocale()]);
  await bootstrapApplication(App, buildAppConfig(config, auth.provideAppAuth(config, window.location.origin, locale), locale));
}

bootstrap().catch((error: unknown) => console.error(error));
