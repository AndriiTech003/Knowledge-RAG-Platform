import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { switchMap, take } from 'rxjs';
import { AccessTokenProvider } from '../auth/access-token';
import { injectIsApiRequest } from './api-url';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isApi = injectIsApiRequest();
  if (!isApi(req.url) || req.headers.has('Authorization')) return next(req);
  const tokens = inject(AccessTokenProvider);
  return tokens.token$().pipe(
    take(1),
    switchMap((token) => next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req)),
  );
};
