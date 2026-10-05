import { Injectable, computed, signal } from '@angular/core';
import { CollectionOut } from '../../core/api/models';
import { canEdit, canManage } from './roles';

@Injectable()
export class CollectionContext {
  readonly collection = signal<CollectionOut | null>(null);
  readonly role = computed(() => this.collection()?.role ?? null);
  readonly canEdit = computed(() => canEdit(this.role()));
  readonly canManage = computed(() => canManage(this.role()));
}
