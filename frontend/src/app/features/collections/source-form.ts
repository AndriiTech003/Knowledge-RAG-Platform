import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { merge } from 'rxjs';
import { SourceCreate, SourceOut } from '../../core/api/models';
import { errorMessage } from '../../shared/forms/validators';
import { createSourceForm, fillSourceForm, patternControl, syncKindState, toSourcePayload } from './source-form.model';

@Component({
  selector: 'kb-source-form',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './source-form.html',
  styleUrl: './source-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SourceFormComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  readonly source = input<SourceOut | null>(null);
  readonly saving = input(false);
  readonly saved = output<SourceCreate>();
  readonly cancelled = output<void>();

  protected readonly form = createSourceForm();
  protected readonly web = this.form.controls.web.controls;
  protected readonly notion = this.form.controls.notion.controls;
  protected readonly err = errorMessage;

  ngOnInit(): void {
    const source = this.source();
    if (source) {
      fillSourceForm(this.form, source);
      this.form.controls.kind.disable({ emitEvent: false });
    }
    syncKindState(this.form);
    merge(this.form.controls.kind.valueChanges, this.form.controls.schedulePreset.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => syncKindState(this.form));
  }

  protected addPattern(list: FormArray<FormControl<string>>): void {
    list.push(patternControl(''));
  }

  protected removePattern(list: FormArray<FormControl<string>>, index: number): void {
    list.removeAt(index);
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saved.emit(toSourcePayload(this.form));
  }
}
