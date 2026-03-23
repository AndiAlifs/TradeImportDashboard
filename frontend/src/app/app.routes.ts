import { Routes } from '@angular/router';
import { ExecDashboardComponent } from './pages/exec-dashboard.component';
import { OperationsComponent } from './pages/operations.component';
import { QueueComponent } from './pages/queue.component';
import { OfficerReleaseComponent } from './pages/officer-release.component';
import { CreateOrderComponent } from './pages/create-order.component';
import { MasterDataComponent } from './pages/master-data.component';
import { SlaComponent } from './pages/sla.component';
import { EventlogComponent } from './pages/eventlog.component';
import { AllLcsComponent } from './pages/all-lcs.component';

export const routes: Routes = [
    { path: '', component: ExecDashboardComponent },
    { path: 'import', component: OperationsComponent, data: { type: 'Import' } },
    { path: 'import/all', component: AllLcsComponent, data: { type: 'Import' } },
    { path: 'import/queue', component: QueueComponent, data: { type: 'Import' } },
    { path: 'import/officer-release', component: OfficerReleaseComponent, data: { type: 'Import' } },
    { path: 'import/create', component: CreateOrderComponent, data: { type: 'Import' } },
    { path: 'export', component: OperationsComponent, data: { type: 'Export' } },
    { path: 'export/all', component: AllLcsComponent, data: { type: 'Export' } },
    { path: 'export/queue', component: QueueComponent, data: { type: 'Export' } },
    { path: 'export/officer-release', component: OfficerReleaseComponent, data: { type: 'Export' } },
    { path: 'export/create', component: CreateOrderComponent, data: { type: 'Export' } },
    { path: 'assignee-master', component: MasterDataComponent, data: { type: 'assignee' } },
    { path: 'officer-registration', component: MasterDataComponent, data: { type: 'officer' } },
    { path: 'sla', component: SlaComponent },
    { path: 'eventlog', component: EventlogComponent },
    { path: '**', redirectTo: '' }
];
