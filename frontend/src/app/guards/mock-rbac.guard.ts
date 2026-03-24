import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DataStoreService } from '../services/data-store.service';

export const mockRbacGuard: CanActivateFn = (_route, state) => {
  const dataStore = inject(DataStoreService);
  const router = inject(Router);

  if (dataStore.canAccessPath(state.url)) {
    return true;
  }

  router.navigateByUrl(dataStore.defaultRouteForRole());
  return false;
};
