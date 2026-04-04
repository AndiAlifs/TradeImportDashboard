import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { DataStoreService } from '../../services/data-store.service';
import { NotificationService } from '../../services/notification.service';
import { LcDetailModalComponent } from '../lc-detail-modal/lc-detail-modal.component';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, TranslatePipe, LcDetailModalComponent],
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

    <app-lc-detail-modal [lc]="selectedLc" [exceptionHistory]="exceptionHistory" (closed)="selectedLc = null"></app-lc-detail-modal>
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