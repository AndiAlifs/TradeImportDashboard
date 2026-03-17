import { Routes } from '@angular/router';
import { ExecDashboardComponent } from './pages/exec-dashboard.component';
import { OperationsComponent } from './pages/operations.component';
import { QueueComponent } from './pages/queue.component';
import { OfficerReleaseComponent } from './pages/officer-release.component';
import { CreateOrderComponent } from './pages/create-order.component';
import { MasterDataComponent } from './pages/master-data.component';
import { SlaComponent } from './pages/sla.component';
import { EventlogComponent } from './pages/eventlog.component';

export const routes: Routes = [
    { path: '', component: ExecDashboardComponent },
    { path: 'import', component: OperationsComponent, data: { type: 'Import' } },
    { path: 'export', component: OperationsComponent, data: { type: 'Export' } },
    { path: 'queue', component: QueueComponent },
    { path: 'officer-release', component: OfficerReleaseComponent },
    { path: 'create', component: CreateOrderComponent },
    { path: 'assignee-master', component: MasterDataComponent, data: { type: 'assignee' } },
    { path: 'officer-registration', component: MasterDataComponent, data: { type: 'officer' } },
    { path: 'sla', component: SlaComponent },
    { path: 'eventlog', component: EventlogComponent },
    { path: '**', redirectTo: '' }
];
