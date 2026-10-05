import { Pipe, PipeTransform } from '@angular/core';

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

export function formatFileSize(bytes: number | null | undefined, digits = 1): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 100 ? Math.round(value).toString() : value.toFixed(digits).replace(/\.0+$/, '');
  return `${rounded} ${UNITS[unit]}`;
}

@Pipe({ name: 'fileSize' })
export class FileSizePipe implements PipeTransform {
  transform(bytes: number | null | undefined, digits = 1): string {
    return formatFileSize(bytes, digits);
  }
}
