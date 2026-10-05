import { Routes } from '@angular/router';

const routes: Routes = [{ path: '', loadComponent: () => import('./search-page').then((m) => m.SearchPage) }];

export default routes;
