import { Routes } from '@angular/router';
import { ExecDashboardComponent } from './pages/exec-dashboard.component';
import { OperationsComponent } from './pages/operations.component';
import { QueueComponent } from './pages/queue.component';
import { CreateOrderComponent } from './pages/create-order.component';
import { MasterDataComponent } from './pages/master-data.component';
import { SlaComponent } from './pages/sla.component';
import { EventlogComponent } from './pages/eventlog.component';
import { AllLcsComponent } from './pages/all-lcs.component';
import { mockRbacGuard } from './guards/mock-rbac.guard';

export const routes: Routes = [
    { path: '', component: ExecDashboardComponent, canActivate: [mockRbacGuard] },
    { path: 'import', component: OperationsComponent, canActivate: [mockRbacGuard], data: { type: 'Import' } },
    { path: 'import/all', component: AllLcsComponent, canActivate: [mockRbacGuard], data: { type: 'Import' } },
    { path: 'import/queue', component: QueueComponent, canActivate: [mockRbacGuard], data: { type: 'Import' } },
    { path: 'import/create', component: CreateOrderComponent, canActivate: [mockRbacGuard], data: { type: 'Import' } },
    { path: 'export', component: OperationsComponent, canActivate: [mockRbacGuard], data: { type: 'Export' } },
    { path: 'export/all', component: AllLcsComponent, canActivate: [mockRbacGuard], data: { type: 'Export' } },
    { path: 'export/queue', component: QueueComponent, canActivate: [mockRbacGuard], data: { type: 'Export' } },
    { path: 'export/create', component: CreateOrderComponent, canActivate: [mockRbacGuard], data: { type: 'Export' } },
    { path: 'bg', component: OperationsComponent, canActivate: [mockRbacGuard], data: { type: 'Bank Guarantee' } },
    { path: 'bg/all', component: AllLcsComponent, canActivate: [mockRbacGuard], data: { type: 'Bank Guarantee' } },
    { path: 'bg/queue', component: QueueComponent, canActivate: [mockRbacGuard], data: { type: 'Bank Guarantee' } },
    { path: 'bg/create', component: CreateOrderComponent, canActivate: [mockRbacGuard], data: { type: 'Bank Guarantee' } },
    { path: 'assignee-master', component: MasterDataComponent, canActivate: [mockRbacGuard], data: { type: 'assignee' } },
    { path: 'officer-registration', component: MasterDataComponent, canActivate: [mockRbacGuard], data: { type: 'officer' } },
    { path: 'sla', component: SlaComponent, canActivate: [mockRbacGuard] },
    { path: 'eventlog', component: EventlogComponent, canActivate: [mockRbacGuard] },
    { path: '**', redirectTo: '' }
];
