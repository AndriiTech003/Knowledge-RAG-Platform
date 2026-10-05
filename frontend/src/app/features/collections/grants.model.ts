import { AbstractControl, FormArray, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { GrantIn, GrantOut } from '../../core/api/models';
import { PRINCIPAL_ID_PATTERN } from '../../shared/forms/validators';

export type PrincipalType = 'group' | 'user';
export type GrantRole = 'viewer' | 'editor' | 'owner';

export type GrantRowForm = FormGroup<{
  principalType: FormControl<PrincipalType>;
  principalId: FormControl<string>;
  role: FormControl<GrantRole>;
}>;

export type GrantsForm = FormGroup<{ grants: FormArray<GrantRowForm> }>;

export function grantRow(grant?: Partial<GrantOut>): GrantRowForm {
  return new FormGroup({
    principalType: new FormControl<PrincipalType>(grant?.principal_type ?? 'group', { nonNullable: true }),
    principalId: new FormControl(grant?.principal_id ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(PRINCIPAL_ID_PATTERN)],
    }),
    role: new FormControl<GrantRole>(grant?.role ?? 'viewer', { nonNullable: true }),
  });
}

export const uniqueGrantsValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const array = control as FormArray<GrantRowForm>;
  const seen = new Set<string>();
  for (const row of array.controls) {
    const key = `${row.controls.principalType.value}:${row.controls.principalId.value.trim().toLowerCase()}`;
    if (!row.controls.principalId.value.trim()) continue;
    if (seen.has(key)) return { duplicate: key };
    seen.add(key);
  }
  return null;
};

export function createGrantsForm(grants: GrantOut[] = []): GrantsForm {
  return new FormGroup({
    grants: new FormArray<GrantRowForm>(grants.map((g) => grantRow(g)), { validators: [uniqueGrantsValidator] }),
  });
}

export function toGrantsPayload(form: GrantsForm): GrantIn[] {
  return form.controls.grants.getRawValue().map((row) => ({
    principal_type: row.principalType,
    principal_id: row.principalId.trim(),
    role: row.role,
  }));
}
