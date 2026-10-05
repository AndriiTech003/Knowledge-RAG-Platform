export interface ProblemFieldError {
  loc?: (string | number)[];
  field?: string;
  msg?: string;
  message?: string;
  type?: string;
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  code?: string;
  detail?: string;
  instance?: string;
  correlation_id?: string;
  errors?: ProblemFieldError[];
}

export function isProblemDetails(value: unknown): value is ProblemDetails {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate['title'] === 'string' || typeof candidate['code'] === 'string' || typeof candidate['status'] === 'number';
}
