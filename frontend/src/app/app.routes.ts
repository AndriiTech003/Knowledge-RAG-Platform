import { ResolveFn, Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

const pageTitle =
  (section: () => string): ResolveFn<string> =>
  () =>
    $localize`:@@route.title:${section()}:section: · Northwind KB`;

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'chat' },
      { path: 'chat', loadChildren: () => import('./features/chat/chat.routes'), title: pageTitle(() => $localize`:@@shell.nav.chat:Chat`) },
      { path: 'search', loadChildren: () => import('./features/search/search.routes'), title: pageTitle(() => $localize`:@@shell.nav.search:Search`) },
      {
        path: 'collections',
        loadChildren: () => import('./features/collections/collections.routes'),
        title: pageTitle(() => $localize`:@@shell.nav.collections:Collections`),
      },
      {
        path: 'documents',
        loadChildren: () => import('./features/document-viewer/document-viewer.routes'),
        title: pageTitle(() => $localize`:@@route.document:Document`),
      },
      {
        path: 'admin',
        loadChildren: () => import('./features/admin/admin.routes'),
        title: pageTitle(() => $localize`:@@shell.nav.admin:Admin`),
      },
      {
        path: 'forbidden',
        loadComponent: () => import('./core/layout/status-pages').then((m) => m.ForbiddenPage),
        title: pageTitle(() => $localize`:@@status.forbidden.title:Access denied`),
      },
      {
        path: '**',
        loadComponent: () => import('./core/layout/status-pages').then((m) => m.NotFoundPage),
        title: pageTitle(() => $localize`:@@status.notFound.title:Page not found`),
      },
    ],
  },
];
