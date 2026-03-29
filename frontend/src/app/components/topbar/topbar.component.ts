import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { DataStoreService } from '../../services/data-store.service';
import { NotificationService } from '../../services/notification.service';
import { StageDuration, computeLcStageDurations, findLongestStage, formatMinutesLabel } from '../../utils/stage-duration';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <header class="top-bar">
      <div style="display:flex;align-items:center;gap:0.75rem">
        <button class="burger-btn" (click)="toggleSidebar()" title="Menu" aria-label="Toggle menu">
            <span></span><span></span><span></span>
        </button>
        <div>
            <h2>{{ titleKey | translate }}</h2>
            <div class="breadcrumb">{{ breadcrumbKey | translate }}</div>
        </div>
      </div>
      <div class="top-bar-actions">
        <div style="font-size:0.75rem;color:var(--text-secondary);padding:0.35rem 0.6rem;border-radius:8px;background:var(--bg-hover,#f1f5f9)">
          Mock: {{ dataStore.getRoleLabel() }}
        </div>
        
        <div class="notification-wrapper" (click)="toggleNotifications($event)">
          <button class="notif-btn" title="Notifications">
             🔔
             <span class="notif-badge" *ngIf="unreadCount() > 0">{{ unreadCount() > 99 ? '99+' : unreadCount() }}</span>
          </button>
          
          <div class="notif-dropdown" [class.show]="notificationsOpen()" (click)="$event.stopPropagation()">
            <div class="notif-header">
              <h4>{{ 'notif.title' | translate }}</h4>
              <button class="notif-read-all" (click)="markAllAsRead()">{{ 'notif.mark_all_read' | translate }}</button>
            </div>
            <div class="notif-body">
              <div class="notif-empty" *ngIf="notifications().length === 0">{{ 'notif.empty' | translate }}</div>
              <div class="notif-item" *ngFor="let n of notifications()" [ngClass]="n.type" (click)="handleNotifClick(n)">
                <div class="notif-icon">
                  <ng-container *ngIf="n.type === 'alert'">🚨</ng-container>
                  <ng-container *ngIf="n.type === 'info'">📨</ng-container>
                  <ng-container *ngIf="n.type === 'system'">🔔</ng-container>
                </div>
                <div class="notif-content">
                  <div class="notif-item-title">{{ n.titleKey | translate }}</div>
                  <div class="notif-item-desc" *ngIf="n.type === 'alert'">{{ formatWarningDesc(n) }}</div>
                  <div class="notif-item-desc" *ngIf="n.type === 'info'">{{ formatNewLcDesc(n) }}</div>
                  <div class="notif-item-desc" *ngIf="n.type === 'system'">{{ n.messageKey | translate }}</div>
                  <div class="notif-item-time">{{ formatTime(n.timestamp) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button class="lang-toggle-btn" (click)="toggleLang()" title="Switch Language">
            {{ 'lang.label' | translate }}
        </button>
        <button class="reset-btn" (click)="handleReset()" title="Reset all data and regenerate" [disabled]="!dataStore.canAccessAction('reset_data')">
            {{ 'topbar.reset' | translate }}
        </button>
        <div style="font-size:0.8rem;color:var(--text-muted)">{{ clock }}</div>
      </div>
    </header>

    <!-- LC Detail Modal (from Notification) -->
    <div class="modal-overlay" [class.active]="!!selectedLc" (click)="selectedLc = null">
      <div class="modal-container form-card" *ngIf="selectedLc" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div>
            <h3>{{ selectedLc.urn }}</h3>
            <div style="font-size:0.75rem;color:var(--text-secondary)">[{{ selectedLc.transactionType }}] {{ selectedLc.subject }}</div>
          </div>
          <button class="modal-close" (click)="selectedLc = null">×</button>
        </div>
        <div class="modal-body table-scroll" style="max-height:60vh;padding:1.5rem">
          <div class="timeline">
            <div *ngIf="selectedLc.receivedAt" class="timeline-item completed">
              <div class="timeline-marker"></div>
              <div class="timeline-content">
                <div class="timeline-title">{{ 'timeline.received' | translate }}</div>
                <div class="timeline-time">{{ formatDateTime(selectedLc.receivedAt) }}</div>
                <div class="timeline-desc">{{ 'timeline.desc.received' | translate }}</div>
              </div>
            </div>
            <div *ngIf="selectedLc.draftingStartedAt" class="timeline-item" [ngClass]="selectedLc.status === 'Drafting' ? 'active' : 'completed'">
              <div class="timeline-marker"></div>
              <div class="timeline-content">
                <div class="timeline-title">{{ 'timeline.drafting' | translate }}</div>
                <div class="timeline-time">{{ formatDateTime(selectedLc.draftingStartedAt) }}</div>
                <div class="timeline-desc">{{ 'timeline.desc.drafting' | translate }}{{ selectedLc.assignedTo ? ' by ' + selectedLc.assignedTo : '' }}</div>
              </div>
            </div>
            <div *ngIf="selectedLc.checkingStartedAt" class="timeline-item" [ngClass]="selectedLc.status === 'Checking Underlying' ? 'active' : 'completed'">
              <div class="timeline-marker"></div>
              <div class="timeline-content">
                <div class="timeline-title">{{ 'timeline.checking' | translate }}</div>
                <div class="timeline-time">{{ formatDateTime(selectedLc.checkingStartedAt) }}</div>
                <div class="timeline-desc">{{ 'timeline.desc.checking' | translate }}</div>
              </div>
            </div>
            <div *ngIf="selectedLc.exceptionStartedAt || selectedLc.exceptionTotalMinutes > 0" class="timeline-item" [ngClass]="selectedLc.status === 'Exception' ? 'exception active' : 'exception completed'">
              <div class="timeline-marker"></div>
              <div class="timeline-content">
                <div class="timeline-title">{{ 'timeline.exception' | translate }}<ng-container *ngIf="selectedLc.status !== 'Exception'"> · <span style="color:var(--success,#16a34a);font-size:0.8em">{{ 'timeline.exception_resolved_label' | translate }}</span></ng-container></div>
                <div class="timeline-time">{{ selectedLc.exceptionStartedAt ? formatDateTime(selectedLc.exceptionStartedAt) : '—' }}</div>
                <div class="timeline-desc">
                  <span *ngIf="selectedLc.exceptionReason" style="display:block;margin-bottom:0.4rem">{{ selectedLc.exceptionReason }}</span>
                  <span *ngIf="!selectedLc.exceptionReason && selectedLc.status === 'Exception'">{{ 'timeline.desc.exception_active' | translate }}</span>
                  <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-top:0.25rem;font-size:0.82em;color:var(--text-muted)">
                    <span><strong>{{ 'timeline.exception_start' | translate }}:</strong> {{ selectedLc.exceptionStartedAt ? formatDateTime(selectedLc.exceptionStartedAt) : '—' }}</span>
                    <span><strong>{{ 'timeline.exception_end' | translate }}:</strong> <ng-container *ngIf="selectedLc.status !== 'Exception' && selectedLc.exceptionResolvedAt">{{ formatDateTime(selectedLc.exceptionResolvedAt) }}</ng-container><ng-container *ngIf="selectedLc.status === 'Exception'"><span style="color:var(--warning,#d97706)">{{ 'timeline.live' | translate }}</span></ng-container><ng-container *ngIf="selectedLc.status !== 'Exception' && !selectedLc.exceptionResolvedAt">—</ng-container></span>
                    <span *ngIf="selectedLc.exceptionTotalMinutes > 0"><strong>{{ 'timeline.exception_duration' | translate }}:</strong> {{ formatExceptionDuration(selectedLc.exceptionTotalMinutes) }}</span>
                  </div>
                  <ng-container *ngIf="selectedLc.status !== 'Exception'">
                    <span style="color:var(--text-muted);font-size:0.85em;">{{ 'timeline.desc.exception_resolved' | translate }}</span>
                  </ng-container>
                </div>
              </div>
            </div>
            <div *ngIf="selectedLc.releasedAt" class="timeline-item completed">
              <div class="timeline-marker"></div>
              <div class="timeline-content">
                <div class="timeline-title">{{ 'timeline.released' | translate }}</div>
                <div class="timeline-time">{{ formatDateTime(selectedLc.releasedAt) }}</div>
                <div class="timeline-desc">{{ 'timeline.desc.released' | translate }}</div>
              </div>
            </div>

            <div class="stage-duration-card" *ngIf="selectedLc">
              <div class="stage-duration-header">
                <h4>{{ 'timeline.stage_duration' | translate }}</h4>
                <span *ngIf="getLcBottleneck(selectedLc) as bottleneck" class="stage-duration-pill">
                  {{ 'timeline.longest_stage' | translate }}: {{ bottleneck.labelKey | translate }} ({{ formatMinutesLabel(bottleneck.minutes) }})
                </span>
              </div>

              <div *ngIf="getLcStageDurations(selectedLc).length === 0" class="stage-duration-empty">
                {{ 'timeline.no_stage_duration' | translate }}
              </div>

              <div class="stage-share-wrap" *ngIf="getLcStageDurations(selectedLc).length > 0">
                <div class="stage-share-title">{{ 'timeline.stage_share' | translate }}</div>
                <div class="stage-share-bar">
                  <div
                    *ngFor="let segment of getStageShareSegments(selectedLc)"
                    class="stage-share-segment"
                    [ngClass]="segment.className"
                    [style.width.%]="segment.percent"
                    [title]="(segment.labelKey | translate) + ' ' + formatPercent(segment.percent) + ' (' + formatMinutesLabel(segment.minutes) + ')'">
                  </div>
                </div>
                <div class="stage-share-legend">
                  <span class="stage-share-item" *ngFor="let segment of getStageShareSegments(selectedLc)">
                    <span class="stage-share-dot" [ngClass]="segment.className"></span>
                    <span>{{ segment.labelKey | translate }}</span>
                    <strong>{{ formatPercent(segment.percent) }}</strong>
                  </span>
                </div>
              </div>

              <div class="stage-duration-list" *ngIf="getLcStageDurations(selectedLc).length > 0">
                <div class="stage-duration-row" *ngFor="let stage of getLcStageDurations(selectedLc)">
                  <div class="stage-duration-label">
                    {{ stage.labelKey | translate }}
                    <span *ngIf="stage.isActive" class="stage-live-tag">{{ 'timeline.live' | translate }}</span>
                  </div>
                  <div class="stage-duration-track">
                    <div class="stage-duration-fill" [class.longest]="stage.isLongest" [style.width.%]="stageWidth(stage.minutes, selectedLc)"></div>
                  </div>
                  <div class="stage-duration-value">{{ formatMinutesLabel(stage.minutes) }}</div>
                </div>
              </div>
            </div>

            <div class="stage-duration-card" *ngIf="exceptionHistory.length > 0" style="margin-top: 1rem;">
              <div class="stage-duration-header">
                <h4 style="margin:0;font-size:0.9rem;color:var(--text-primary)">{{ 'timeline.exception_history' | translate }}</h4>
              </div>
              <div class="table-scroll" style="max-height: 200px">
                <table class="data-table" style="font-size:0.75rem;margin-top:0.5rem">
                  <thead>
                    <tr>
                      <th style="padding:0.4rem">{{ 'timeline.col_started_at' | translate }}</th>
                      <th style="padding:0.4rem">{{ 'timeline.col_reason' | translate }}</th>
                      <th style="padding:0.4rem">{{ 'timeline.col_resolved_at' | translate }}</th>
                      <th style="padding:0.4rem">{{ 'timeline.col_duration' | translate }}</th>
                      <th style="padding:0.4rem">{{ 'timeline.col_returned_to' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let ex of exceptionHistory">
                      <td style="padding:0.4rem;white-space:nowrap">{{ formatDateTime(ex.startedAt) }}</td>
                      <td style="padding:0.4rem">{{ ex.reason }}</td>
                      <td style="padding:0.4rem;white-space:nowrap">{{ ex.resolvedAt ? formatDateTime(ex.resolvedAt) : '—' }}</td>
                      <td style="padding:0.4rem">{{ ex.resolutionMinutes != null ? ex.resolutionMinutes : '—' }}</td>
                      <td style="padding:0.4rem">{{ ex.resolvedToStatus || '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `
})
export class TopbarComponent implements OnInit, OnDestroy {
  translationService = inject(TranslationService);
  dataStore = inject(DataStoreService);
  notificationService = inject(NotificationService);
  router = inject(Router);

  clock: string = '';
  private intervalId: any;
  notificationsOpen = signal(false);

  unreadCount = computed(() => this.notificationService.unreadCount());
  notifications = computed(() => this.notificationService.notifications());

  // View state maps
  titleKey: string = 'page.exec_dashboard.title';
  breadcrumbKey: string = 'page.exec_dashboard.breadcrumb';

  private routeMap: Record<string, { title: string, breadcrumb: string }> = {
    '/': { title: 'page.exec_dashboard.title', breadcrumb: 'page.exec_dashboard.breadcrumb' },
    '/import': { title: 'page.import.title', breadcrumb: 'page.import.breadcrumb' },
    '/export': { title: 'page.export.title', breadcrumb: 'page.export.breadcrumb' },
    '/queue': { title: 'page.queue.title', breadcrumb: 'page.queue.breadcrumb' },
    '/officer-release': { title: 'page.officer_release.title', breadcrumb: 'page.officer_release.breadcrumb' },
    '/create': { title: 'page.create.title', breadcrumb: 'page.create.breadcrumb' },
    '/assignee-master': { title: 'page.assignee_master.title', breadcrumb: 'page.assignee_master.breadcrumb' },
    '/officer-registration': { title: 'page.officer_registration.title', breadcrumb: 'page.officer_registration.breadcrumb' },
    '/sla': { title: 'page.sla.title', breadcrumb: 'page.sla.breadcrumb' },
    '/eventlog': { title: 'page.eventlog.title', breadcrumb: 'page.eventlog.breadcrumb' },
    '/all-lcs': { title: 'page.all_lcs.title', breadcrumb: 'page.all_lcs.title' }
  };

  selectedLc: any = null;
  exceptionHistory: any[] = [];

  ngOnInit() {
    this.updateClock();
    this.intervalId = setInterval(() => this.updateClock(), 1000);

    // Initial check
    this.updateTitles(this.router.url);

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.updateTitles(event.urlAfterRedirects.split('?')[0]);
    });

    // Close notifications on outside click
    document.addEventListener('click', this.closeNotifications.bind(this));
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    document.removeEventListener('click', this.closeNotifications.bind(this));
  }

  updateTitles(url: string) {
    const map = this.routeMap[url] || this.routeMap['/'];
    this.titleKey = map.title;
    this.breadcrumbKey = map.breadcrumb;
  }

  updateClock() {
    this.clock = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  toggleSidebar() {
    document.getElementById('sidebar')?.classList.toggle('open');
    document.getElementById('sidebar-overlay')?.classList.toggle('active');
  }

  formatWarningDesc(n: any): string {
    let t = this.translationService.translate('notif.warning_desc_params');
    t = t.replace('{0}', n.messageParams?.['urn'] || '');
    t = t.replace('{1}', n.messageParams?.['mins'] || '');
    t = t.replace('{2}', n.messageParams?.['threshold'] || '');
    return t;
  }

  formatNewLcDesc(n: any): string {
    let t = this.translationService.translate('notif.new_lc_desc_params');
    return t.replace('{0}', n.messageParams?.['urn'] || '');
  }

  async handleNotifClick(n: any) {
    this.markAsRead(n.id);
    if (n.messageParams && n.messageParams['urn']) {
      const lc = this.dataStore.lcs().find((r: any) => r.urn === n.messageParams!['urn']);
      if (lc) {
        this.selectedLc = lc;
        this.exceptionHistory = [];
        this.exceptionHistory = await this.dataStore.getLCExceptions(lc.id);
        this.notificationsOpen.set(false);
      }
    }
  }

  formatDateTime(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  formatExceptionDuration(minutes: number): string {
    if (!minutes || minutes <= 0) return '—';
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }

  getLcStageDurations(r: any): StageDuration[] {
    return computeLcStageDurations(r);
  }

  getLcBottleneck(r: any): StageDuration | null {
    return findLongestStage(this.getLcStageDurations(r));
  }

  stageWidth(minutes: number, r: any): number {
    const stages = this.getLcStageDurations(r);
    const maxMinutes = stages.reduce((max, stage) => Math.max(max, stage.minutes), 0);
    if (maxMinutes <= 0) return 0;
    return Math.max(8, Math.round((minutes / maxMinutes) * 100));
  }

  formatMinutesLabel(minutes: number): string {
    return formatMinutesLabel(minutes);
  }

  getStageShareSegments(r: any): Array<{ labelKey: string; percent: number; className: string; minutes: number }> {
    const stages = this.getLcStageDurations(r);
    const total = stages.reduce((sum, stage) => sum + stage.minutes, 0);
    if (total <= 0) return [];
    return stages.map((stage) => ({
      labelKey: stage.labelKey,
      percent: Math.round((stage.minutes / total) * 1000) / 10,
      className: this.stageShareClass(stage.key),
      minutes: stage.minutes,
    }));
  }

  formatPercent(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  private stageShareClass(key: StageDuration['key']): string {
    const map: Record<StageDuration['key'], string> = {
      inbox: 'stage-share-inbox',
      drafting: 'stage-share-drafting',
      checking: 'stage-share-checking',
      exception: 'stage-share-exception',
    };
    return map[key];
  }

  toggleLang() {
    this.translationService.toggleLang();
  }

  async handleReset() {
    if (!this.dataStore.canAccessAction('reset_data')) {
      alert('Forbidden: current role cannot reset data');
      return;
    }
    if (!confirm(this.translationService.translate('toast.confirm_reset'))) return;
    try {
      await this.dataStore.resetAllData();
      alert(this.translationService.translate('toast.data_reset'));
    } catch (err: any) {
      alert(err.message || 'Reset is not available yet');
    }
  }

  toggleNotifications(event: MouseEvent) {
    event.stopPropagation();
    this.notificationsOpen.set(!this.notificationsOpen());
  }

  closeNotifications() {
    if (this.notificationsOpen()) {
      this.notificationsOpen.set(false);
    }
  }

  markAsRead(id: string) {
    this.notificationService.markAsRead(id);
  }

  markAllAsRead() {
    this.notificationService.markAllAsRead();
  }

  formatTime(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    const now = new Date();
    const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
    if (diffHours < 24) {
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}