import { ScrollingModule } from '@angular/cdk/scrolling';
import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConversationOut } from '../../core/api/models';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';

export interface RenameEvent {
  id: string;
  title: string;
}

@Component({
  selector: 'kb-conversation-list',
  imports: [ScrollingModule, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, MatProgressBarModule, RelativeTimePipe],
  templateUrl: './conversation-list.html',
  styleUrl: './conversation-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationList {
  readonly conversations = input.required<ConversationOut[]>();
  readonly activeId = input<string | null>(null);
  readonly loading = input(false);
  readonly query = input('');

  readonly selected = output<string>();
  readonly newChat = output<void>();
  readonly searched = output<string>();
  readonly renamed = output<RenameEvent>();
  readonly deleted = output<string>();

  protected readonly editingId = signal<string | null>(null);
  protected readonly editInput = viewChild<ElementRef<HTMLInputElement>>('editInput');

  constructor() {
    effect(() => {
      const input = this.editInput();
      if (this.editingId() && input) {
        input.nativeElement.focus();
        input.nativeElement.select();
      }
    });
  }

  protected readonly trackById = (_index: number, conversation: ConversationOut) => conversation.id;

  protected title(conversation: ConversationOut): string {
    return conversation.title?.trim() || $localize`:@@chat.conversation.newTitle:New conversation`;
  }

  protected startRename(conversation: ConversationOut): void {
    this.editingId.set(conversation.id);
  }

  protected commitRename(conversation: ConversationOut, value: string): void {
    if (this.editingId() !== conversation.id) return;
    this.editingId.set(null);
    const title = value.trim();
    if (title && title !== conversation.title) this.renamed.emit({ id: conversation.id, title });
  }

  protected onEditKey(event: KeyboardEvent, conversation: ConversationOut, value: string): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitRename(conversation, value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.editingId.set(null);
    }
  }

  protected onSearch(event: Event): void {
    this.searched.emit((event.target as HTMLInputElement).value);
  }
}
