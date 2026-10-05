import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AppError, fromHttpError } from './app-error';
import { injectIsApiRequest } from './api-url';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const isApi = injectIsApiRequest();
  if (!isApi(req.url)) return next(req);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) return throwError(() => fromHttpError(error));
      return throwError(() => AppError.from(error));
    }),
  );
};
