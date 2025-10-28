
import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/home/home.component').then(c => c.HomeComponent),
    pathMatch: 'full'
  },
  {
    path: 'registry',
    loadComponent: () => import('./components/registry/registry.component').then(c => c.RegistryComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
