import { Routes } from '@angular/router';

const routes: Routes = [
  { path: ':documentId', loadComponent: () => import('./document-viewer-page').then((m) => m.DocumentViewerPage) },
];

export default routes;
