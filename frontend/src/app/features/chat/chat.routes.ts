import { Routes } from '@angular/router';
import DOMPurify from 'dompurify';
import { provideMarkdown, SANITIZE } from 'ngx-markdown';
import { ChatStore } from './chat.store';

export function sanitizeMarkdownHtml(html: string): string {
  return DOMPurify.sanitize(html, { ADD_ATTR: ['data-n', 'data-tip', 'tabindex'] });
}

const routes: Routes = [
  {
    path: '',
    providers: [ChatStore, provideMarkdown({ sanitize: { provide: SANITIZE, useValue: sanitizeMarkdownHtml } })],
    children: [
      { path: '', loadComponent: () => import('./chat-page').then((m) => m.ChatPage) },
      { path: ':conversationId', loadComponent: () => import('./chat-page').then((m) => m.ChatPage) },
    ],
  },
];

export default routes;
