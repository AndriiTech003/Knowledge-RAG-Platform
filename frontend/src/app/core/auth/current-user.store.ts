import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { MeOut } from '../api/models/me-out';
import { MeService } from '../api/services/me.service';
import { AppError } from '../http/app-error';

interface CurrentUserState {
  me: MeOut | null;
  loading: boolean;
  error: AppError | null;
}

export const ADMIN_GROUP = 'kb-admins';

export const CurrentUserStore = signalStore(
  { providedIn: 'root' },
  withState<CurrentUserState>({ me: null, loading: false, error: null }),
  withComputed(({ me }) => ({
    isAdmin: computed(() => me()?.is_admin ?? false),
    groups: computed(() => me()?.groups ?? []),
    displayName: computed(() => me()?.name || me()?.username || me()?.email || ''),
    initials: computed(() => {
      const name = me()?.name || me()?.username || '';
      return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
    }),
    collections: computed(() => me()?.collections ?? []),
  })),
  withMethods((store, api = inject(MeService)) => {
    let pending: Promise<MeOut | null> | null = null;
    return {
      hasGroup(group: string): boolean {
        if (group === ADMIN_GROUP && store.me()?.is_admin) return true;
        return store.groups().includes(group);
      },
      roleIn(collectionId: string): string | null {
        return store.collections().find((c) => c.id === collectionId)?.role ?? null;
      },
      async ensureLoaded(): Promise<MeOut | null> {
        const current = store.me();
        if (current) return current;
        if (!pending) {
          patchState(store, { loading: true, error: null });
          pending = firstValueFrom(api.getMe())
            .then((me) => {
              patchState(store, { me, loading: false });
              return me;
            })
            .catch((error: unknown) => {
              patchState(store, { loading: false, error: AppError.from(error) });
              return null;
            })
            .finally(() => {
              pending = null;
            });
        }
        return pending;
      },
      async reload(): Promise<MeOut | null> {
        patchState(store, { me: null });
        return this.ensureLoaded();
      },
      clear(): void {
        patchState(store, { me: null, error: null });
      },
    };
  }),
);
