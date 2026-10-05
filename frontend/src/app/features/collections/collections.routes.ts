import { Routes } from '@angular/router';

const routes: Routes = [
  { path: '', loadComponent: () => import('./collections-page').then((m) => m.CollectionsPage) },
  {
    path: ':collectionId',
    loadComponent: () => import('./collection-detail').then((m) => m.CollectionDetail),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'documents' },
      { path: 'documents', loadComponent: () => import('./documents-tab').then((m) => m.DocumentsTab) },
      { path: 'documents/:documentId', loadComponent: () => import('./document-detail').then((m) => m.DocumentDetailPage) },
      { path: 'sources', loadComponent: () => import('./sources-tab').then((m) => m.SourcesTab) },
      { path: 'access', loadComponent: () => import('./access-tab').then((m) => m.AccessTab) },
    ],
  },
];

export default routes;
