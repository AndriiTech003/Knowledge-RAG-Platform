import { EnvironmentProviders, Provider } from '@angular/core';
import { LogLevel, OpenIdConfiguration, provideAuth, withAppInitializerAuthCheck } from 'angular-auth-oidc-client';
import { RuntimeConfig } from '../config/runtime-config';
import { AppLocale, DEFAULT_LOCALE } from '../i18n/locale';
import { AccessTokenProvider } from './access-token';
import { AuthFacade } from './auth.facade';
import { OidcAccessTokenProvider, OidcAuthFacade } from './oidc-auth';

export function oidcConfig(config: RuntimeConfig, origin: string, locale: AppLocale = DEFAULT_LOCALE): OpenIdConfiguration {
  return {
    authority: config.authority,
    redirectUrl: `${origin}/`,
    postLogoutRedirectUri: `${origin}/`,
    clientId: config.clientId,
    scope: 'openid profile email',
    responseType: 'code',
    silentRenew: true,
    useRefreshToken: true,
    renewTimeBeforeTokenExpiresInSeconds: 60,
    ignoreNonceAfterRefresh: true,
    triggerAuthorizationResultEvent: true,
    autoUserInfo: true,
    secureRoutes: [],
    disableRefreshTokenOfflineAccessScopeWarning: true,
    logLevel: LogLevel.Warn,
    customParamsAuthRequest: { ui_locales: locale },
  };
}

export function provideAppAuth(config: RuntimeConfig, origin: string, locale: AppLocale = DEFAULT_LOCALE): (Provider | EnvironmentProviders)[] {
  return [
    provideAuth({ config: oidcConfig(config, origin, locale) }, withAppInitializerAuthCheck()),
    { provide: AccessTokenProvider, useClass: OidcAccessTokenProvider },
    { provide: AuthFacade, useClass: OidcAuthFacade },
  ];
}
