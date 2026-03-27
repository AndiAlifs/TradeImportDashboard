import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { DataStoreService, MockRole } from '../../services/data-store.service';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, TranslatePipe],
  template: `
    <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
            <div class="logo-icon">⚡</div>
            <div>
                <h1>Shila Dashboard</h1>
                <div class="subtitle">Trade Finance Ops</div>
            </div>
        </div>

        <nav class="sidebar-nav">
            <div class="mock-role-card">
                <div class="mock-role-title">Mock Role Mode</div>
                <select class="mock-role-select" [ngModel]="dataStore.currentRole()" (ngModelChange)="onRoleChange($event)">
                    <option *ngFor="let role of dataStore.roleOptions" [value]="role.value">{{ role.label }}</option>
                </select>
            </div>

            <div class="nav-section-label">{{ 'nav.main_menu' | translate }}</div>

            <div class="nav-item" *ngIf="dataStore.canAccessMenu('exec')" routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
                <span class="nav-icon">
                    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                </span>
                <span>{{ 'nav.exec_dashboard' | translate }}</span>
            </div>

            <div class="nav-section-label" *ngIf="dataStore.canAccessMenu('import')">Import Operations</div>

            <div class="nav-item" *ngIf="dataStore.canAccessMenu('import')" routerLink="/import" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
                <span class="nav-icon">
                    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                </span>
                <span>{{ 'nav.import_dashboard' | translate }}</span>
            </div>

            <div class="nav-item" *ngIf="dataStore.canAccessMenu('import')" routerLink="/import/queue" routerLinkActive="active">
                <span class="nav-icon">
                    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                </span>
                <span>{{ 'nav.queue' | translate }}</span>
            </div>

            <div class="nav-item" *ngIf="dataStore.canAccessMenu('import')" routerLink="/import/all" routerLinkActive="active">
                <span class="nav-icon">
                    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 4h18M3 12h18M3 20h18" />
                    </svg>
                </span>
                <span>{{ 'nav.all_lcs' | translate }}</span>
                <span class="badge range-menu-badge">{{ allLcsRangeBadge() }}</span>
            </div>

            <div class="nav-item" *ngIf="dataStore.canAccessMenu('import')" routerLink="/import/create" routerLinkActive="active">
                <span class="nav-icon">
                    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                </span>
                <span>{{ 'nav.create' | translate }}</span>
            </div>

            <div class="nav-section-label" *ngIf="dataStore.canAccessMenu('export')">Export Operations</div>

            <div class="nav-item" *ngIf="dataStore.canAccessMenu('export')" routerLink="/export" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
                <span class="nav-icon">
                    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                </span>
                <span>{{ 'nav.export_dashboard' | translate }}</span>
            </div>

            <div class="nav-item" *ngIf="dataStore.canAccessMenu('export')" routerLink="/export/all" routerLinkActive="active">
                <span class="nav-icon">
                    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 4h18M3 12h18M3 20h18" />
                    </svg>
                </span>
                <span>{{ 'nav.all_lcs' | translate }}</span>
                <span class="badge range-menu-badge">{{ allLcsRangeBadge() }}</span>
            </div>

            <div class="nav-item" *ngIf="dataStore.canAccessMenu('export')" routerLink="/export/queue" routerLinkActive="active">
                <span class="nav-icon">
                    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                </span>
                <span>{{ 'nav.queue' | translate }}</span>
            </div>

            <div class="nav-item" *ngIf="dataStore.canAccessMenu('export')" routerLink="/export/create" routerLinkActive="active">
                <span class="nav-icon">
                    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                </span>
                <span>{{ 'nav.create' | translate }}</span>
            </div>

            <div class="nav-section-label" *ngIf="dataStore.canAccessMenu('assignee-master') || dataStore.canAccessMenu('officer-master') || dataStore.canAccessMenu('sla') || dataStore.canAccessMenu('eventlog')">{{ 'nav.master_data' | translate }}</div>

            <div class="nav-item" *ngIf="dataStore.canAccessMenu('assignee-master')" routerLink="/assignee-master" routerLinkActive="active">
                <span class="nav-icon">
                    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5V4h-5m0 16H7m10 0v-6m0 6H7m0 0H2V4h5m0 16v-6m0-4V4m10 0H7m10 0v6m-10 4h10" />
                    </svg>
                </span>
                <span>{{ 'nav.assignee_master' | translate }}</span>
            </div>

            <div class="nav-item" *ngIf="dataStore.canAccessMenu('officer-master')" routerLink="/officer-registration" routerLinkActive="active">
                <span class="nav-icon">
                    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5V4h-5m0 16H7m10 0v-6m0 6H7m0 0H2V4h5m0 16v-6m0-4V4m10 0H7m10 0v6m-10 4h10" />
                    </svg>
                </span>
                <span>{{ 'nav.officer_registration' | translate }}</span>
            </div>

            <div class="nav-item" *ngIf="dataStore.canAccessMenu('sla')" routerLink="/sla" routerLinkActive="active">
                <span class="nav-icon">
                    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </span>
                <span>{{ 'nav.sla' | translate }}</span>
            </div>

            <div class="nav-item" *ngIf="dataStore.canAccessMenu('eventlog')" routerLink="/eventlog" routerLinkActive="active">
                <span class="nav-icon">
                    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </span>
                <span>{{ 'nav.eventlog' | translate }}</span>
            </div>
        </nav>

        <div class="sidebar-footer">
            <div class="avatar">SM</div>
            <div class="user-info">
                                <div class="user-name">{{ dataStore.getRoleLabel() }}</div>
                                <div class="user-role">Mock RBAC</div>
            </div>
        </div>
    </aside>
  `
})
export class SidebarComponent {
    dataStore = inject(DataStoreService);
    private router = inject(Router);
    private ts = inject(TranslationService);

    async onRoleChange(role: MockRole) {
        this.dataStore.setMockRole(role);
        await this.dataStore.refreshData();
        if (!this.dataStore.canAccessPath(this.router.url)) {
            this.router.navigateByUrl(this.dataStore.defaultRouteForRole());
        }
    }

    allLcsRangeBadge(): string {
        const range = this.dataStore.operationsDateRange();
        if (range.preset === 'today') return this.ts.translate('date.today');
        if (range.preset === 'yesterday') return this.ts.translate('date.yesterday');
        if (range.preset === 'last7days') return '7D';
        if (range.preset === 'last14days') return '14D';
        if (range.preset === 'last1month') return '1M';
        if (range.fromDate && range.toDate) return this.ts.translate('date.custom');
        return this.ts.translate('date.today');
    }
}
