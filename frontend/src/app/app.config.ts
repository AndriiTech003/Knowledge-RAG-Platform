import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  EnvironmentProviders,
  Provider,
  ErrorHandler,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withRouterConfig } from '@angular/router';
import { routes } from './app.routes';
import { provideApiConfiguration } from './core/api/api-configuration';
import { RUNTIME_CONFIG, RuntimeConfig } from './core/config/runtime-config';
import { GlobalErrorHandler } from './core/errors/global-error-handler';
import { authInterceptor } from './core/http/auth.interceptor';
import { correlationIdInterceptor } from './core/http/correlation-id.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';
import { retryInterceptor } from './core/http/retry.interceptor';
import { AppLocale, DEFAULT_LOCALE } from './core/i18n/locale';
import { ThemeService } from './core/layout/theme.service';

export function buildAppConfig(
  runtime: RuntimeConfig,
  authProviders: (Provider | EnvironmentProviders)[],
  locale: AppLocale = DEFAULT_LOCALE,
): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      provideZonelessChangeDetection(),
      { provide: LOCALE_ID, useValue: locale },
      { provide: RUNTIME_CONFIG, useValue: runtime },
      provideApiConfiguration(runtime.apiUrl),
      provideRouter(
        routes,
        withComponentInputBinding(),
        withRouterConfig({ paramsInheritanceStrategy: 'always' }),
        withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
      ),
      provideHttpClient(withInterceptors([correlationIdInterceptor, authInterceptor, errorInterceptor, retryInterceptor])),
      ...authProviders,
      { provide: ErrorHandler, useClass: GlobalErrorHandler },
      provideAppInitializer(() => {
        inject(ThemeService);
      }),
    ],
  };
}
