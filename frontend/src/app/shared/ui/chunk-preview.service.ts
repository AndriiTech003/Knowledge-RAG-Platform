import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, shareReplay } from 'rxjs';
import { ChunkDetail } from '../../core/api/models';
import { DocumentsService } from '../../core/api/services';

@Injectable({ providedIn: 'root' })
export class ChunkPreviewService {
  private readonly api = inject(DocumentsService);
  private readonly cache = new Map<string, Observable<ChunkDetail | null>>();

  get(chunkId: string): Observable<ChunkDetail | null> {
    let cached = this.cache.get(chunkId);
    if (!cached) {
      cached = this.api.getChunk({ chunk_id: chunkId }).pipe(
        catchError(() => {
          this.cache.delete(chunkId);
          return of(null);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.cache.set(chunkId, cached);
    }
    return cached;
  }
}
