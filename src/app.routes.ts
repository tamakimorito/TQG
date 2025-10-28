import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/home/home.component').then(c => c.HomeComponent),
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
