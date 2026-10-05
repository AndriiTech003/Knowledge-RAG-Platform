import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';
import { CollectionsService } from '../../core/api/services';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { NotificationService } from '../../core/errors/notification.service';
import { AppError } from '../../core/http/app-error';
import { errorMessage } from '../../shared/forms/validators';
import { createGrantsForm, grantRow, GrantRowForm, toGrantsPayload } from './grants.model';
import { filterGroups } from './known-groups';

@Component({
  selector: 'kb-access-tab',
  imports: [ReactiveFormsModule, MatAutocompleteModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule, MatSelectModule],
  template: `
    <div class="head">
      <h2 i18n="@@collections.access.title">Access</h2>
      <span class="kb-muted" i18n="@@collections.access.intro">Grants apply to every document in this collection. Groups come from SSO.</span>
    </div>
    @if (loading()) {
      <mat-progress-bar mode="indeterminate" />
    }
    <form [formGroup]="form" (ngSubmit)="save()" data-testid="grants-form">
      <div class="kb-table-wrap">
        <table class="grants" data-testid="grants-table">
          <thead>
            <tr>
              <th scope="col" i18n="@@collections.access.colType">Type</th>
              <th scope="col" i18n="@@collections.access.colPrincipal">Principal</th>
              <th scope="col" i18n="@@collections.access.colRole">Role</th>
              <th scope="col"><span class="kb-visually-hidden" i18n="@@common.remove">Remove</span></th>
            </tr>
          </thead>
          <tbody formArrayName="grants">
            @for (row of rows.controls; track row; let i = $index) {
              <tr [formGroupName]="i" data-testid="grant-row">
                <td>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-select formControlName="principalType" aria-label="Principal type" i18n-aria-label="@@collections.access.principalType">
                      <mat-option value="group" i18n="@@collections.access.group">Group</mat-option>
                      <mat-option value="user" i18n="@@collections.access.user">User</mat-option>
                    </mat-select>
                  </mat-form-field>
                </td>
                <td>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="principal">
                    <input
                      matInput
                      formControlName="principalId"
                      [matAutocomplete]="auto"
                      [matAutocompleteDisabled]="row.controls.principalType.value !== 'group'"
                      (input)="onGroupInput($event)"
                      [placeholder]="row.controls.principalType.value === 'group' ? 'engineering' : userIdPlaceholder"
                      aria-label="Principal"
                      i18n-aria-label="@@collections.access.colPrincipal"
                      data-testid="grant-principal"
                    />
                    <mat-autocomplete #auto="matAutocomplete">
                      @for (group of suggestions(); track group) {
                        <mat-option [value]="group">{{ group }}</mat-option>
                      }
                    </mat-autocomplete>
                    @if (row.controls.principalId.invalid && row.controls.principalId.touched) {
                      <mat-error>{{ err(row.controls.principalId.errors) }}</mat-error>
                    }
                  </mat-form-field>
                </td>
                <td>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-select formControlName="role" aria-label="Role" i18n-aria-label="@@collections.access.colRole" data-testid="grant-role">
                      <mat-option value="viewer" i18n="@@collections.role.viewer">Viewer</mat-option>
                      <mat-option value="editor" i18n="@@collections.role.editor">Editor</mat-option>
                      <mat-option value="owner" i18n="@@collections.role.owner">Owner</mat-option>
                    </mat-select>
                  </mat-form-field>
                </td>
                <td>
                  <button mat-icon-button type="button" (click)="remove(i)" aria-label="Remove grant" i18n-aria-label="@@collections.access.removeGrant">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (rows.errors?.['duplicate']) {
        <p class="error" role="alert" i18n="@@collections.access.duplicate">Each principal can only appear once.</p>
      }
      <div class="actions">
        <button mat-button type="button" (click)="add()" data-testid="grant-add">
          <mat-icon>person_add</mat-icon>
          <span i18n="@@collections.access.addGrant">Add grant</span>
        </button>
        <span class="kb-spacer"></span>
        <button mat-button type="button" (click)="load()" [disabled]="saving()" i18n="@@collections.access.reset">Reset</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid || saving() || form.pristine" data-testid="grants-save" i18n="@@collections.access.save">Save access</button>
      </div>
    </form>
  `,
  styles: `
    .head {
      display: grid;
      gap: 4px;
      margin-bottom: 12px;
    }
    .head h2 {
      margin: 0;
      font: var(--mat-sys-title-large);
    }
    .grants {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      padding: 8px;
      text-align: left;
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-on-surface-variant);
    }
    td {
      padding: 4px 8px;
    }
    .principal {
      width: 100%;
      min-width: 220px;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
    }
    .kb-spacer {
      flex: 1;
    }
    .error {
      color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessTab {
  private readonly api = inject(CollectionsService);
  private readonly notify = inject(NotificationService);
  private readonly user = inject(CurrentUserStore);

  readonly collectionId = input.required<string>();
  protected readonly form = createGrantsForm();
  protected readonly rows = this.form.controls.grants;
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly groupQuery = signal('');
  protected readonly err = errorMessage;
  protected readonly userIdPlaceholder = $localize`:@@collections.access.userIdPlaceholder:user id (sub)`;
  protected readonly suggestions = computed(() => filterGroups(this.groupQuery()));

  protected onGroupInput(event: Event): void {
    this.groupQuery.set((event.target as HTMLInputElement).value);
  }

  constructor() {
    effect(() => {
      this.collectionId();
      untracked(() => this.load());
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const grants = await firstValueFrom(this.api.getCollectionGrants({ collection_id: this.collectionId() }));
      this.rows.clear();
      for (const grant of grants) this.rows.push(grantRow(grant));
      this.form.markAsPristine();
    } catch (error) {
      this.notify.error(AppError.from(error).userMessage);
    } finally {
      this.loading.set(false);
    }
  }

  protected add(): void {
    const row: GrantRowForm = grantRow();
    this.rows.push(row);
    this.form.markAsDirty();
  }

  protected remove(index: number): void {
    this.rows.removeAt(index);
    this.form.markAsDirty();
  }

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    try {
      const grants = await firstValueFrom(
        this.api.putCollectionGrants({ collection_id: this.collectionId(), body: { grants: toGrantsPayload(this.form) } }),
      );
      this.rows.clear();
      for (const grant of grants) this.rows.push(grantRow(grant));
      this.form.markAsPristine();
      this.notify.success($localize`:@@collections.access.updated:Access updated`);
      void this.user.reload();
    } catch (error) {
      this.notify.error(AppError.from(error).userMessage);
    } finally {
      this.saving.set(false);
    }
  }
}
