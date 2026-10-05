import { Observable } from 'rxjs';

export abstract class AccessTokenProvider {
  abstract token$(): Observable<string | null>;
}
