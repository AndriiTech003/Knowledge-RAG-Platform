import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom, map, startWith } from 'rxjs';
import { CollectionOut } from '../../core/api/models';
import { CollectionsService } from '../../core/api/services';
import { NotificationService } from '../../core/errors/notification.service';
import { AppError } from '../../core/http/app-error';
import { errorMessage, PRINCIPAL_ID_PATTERN } from '../../shared/forms/validators';
import { filterGroups } from './known-groups';

type ChunkingProfile = 'default' | 'small' | 'large';
type Role = 'viewer' | 'editor' | 'owner';

@Component({
  selector: 'kb-create-collection-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatAutocompleteModule],
  template: `
    <h2 mat-dialog-title i18n="@@collections.page.newCollection">New collection</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" id="create-collection-form">
      <mat-dialog-content class="form">
        <mat-form-field appearance="outline">
          <mat-label i18n="@@collections.create.name">Name</mat-label>
          <input matInput formControlName="name" maxlength="120" data-testid="collection-name" />
          @if (form.controls.name.invalid && form.controls.name.touched) {
            <mat-error>{{ err(form.controls.name.errors) }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label i18n="@@collections.create.description">Description</mat-label>
          <textarea matInput formControlName="description" rows="2" maxlength="500"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label i18n="@@collections.create.chunkingProfile">Chunking profile</mat-label>
          <mat-select formControlName="chunkingProfile">
            <mat-option value="default" i18n="@@collections.create.chunkingDefault">Default (450 tokens)</mat-option>
            <mat-option value="small" i18n="@@collections.create.chunkingSmall">Small (250 tokens)</mat-option>
            <mat-option value="large" i18n="@@collections.create.chunkingLarge">Large (800 tokens)</mat-option>
          </mat-select>
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline" class="grow">
            <mat-label i18n="@@collections.create.grantGroup">Grant group (optional)</mat-label>
            <input matInput formControlName="group" [matAutocomplete]="auto" />
            <mat-autocomplete #auto="matAutocomplete">
              @for (group of groupOptions(); track group) {
                <mat-option [value]="group">{{ group }}</mat-option>
              }
            </mat-autocomplete>
            @if (form.controls.group.invalid) {
              <mat-error>{{ err(form.controls.group.errors) }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@collections.access.colRole">Role</mat-label>
            <mat-select formControlName="role">
              <mat-option value="viewer" i18n="@@collections.role.viewer">Viewer</mat-option>
              <mat-option value="editor" i18n="@@collections.role.editor">Editor</mat-option>
              <mat-option value="owner" i18n="@@collections.role.owner">Owner</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close i18n="@@common.cancel">Cancel</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid || saving()" data-testid="collection-create-submit" i18n="@@common.create">Create</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .form {
      display: grid;
      gap: 4px;
    }
    .row {
      display: flex;
      gap: 12px;
    }
    .grow {
      flex: 1;
    }
    .error {
      color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateCollectionDialog {
  private readonly api = inject(CollectionsService);
  private readonly ref = inject<MatDialogRef<CreateCollectionDialog, CollectionOut | null>>(MatDialogRef);
  private readonly notify = inject(NotificationService);

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
    description: new FormControl('', { nonNullable: true }),
    chunkingProfile: new FormControl<ChunkingProfile>('default', { nonNullable: true }),
    group: new FormControl('', { nonNullable: true, validators: [Validators.pattern(PRINCIPAL_ID_PATTERN)] }),
    role: new FormControl<Role>('viewer', { nonNullable: true }),
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly groupOptions = toSignal(
    this.form.controls.group.valueChanges.pipe(
      startWith(''),
      map((q) => filterGroups(q)),
    ),
    { initialValue: filterGroups('') },
  );
  protected readonly err = errorMessage;

  protected async submit(): Promise<void> {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    try {
      const created = await firstValueFrom(
        this.api.createCollection({
          body: {
            name: value.name.trim(),
            description: value.description.trim() || null,
            chunking_profile: value.chunkingProfile,
            grants: value.group ? [{ principal_type: 'group', principal_id: value.group, role: value.role }] : [],
          },
        }),
      );
      this.notify.success($localize`:@@collections.create.created:Collection “${created.name}:name:” created`);
      this.ref.close(created);
    } catch (error) {
      this.error.set(AppError.from(error).userMessage);
    } finally {
      this.saving.set(false);
    }
  }
}
