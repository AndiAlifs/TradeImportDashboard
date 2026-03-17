import { Component, OnInit, OnDestroy, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { DataStoreService } from '../../services/data-store.service';

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
        <button class="lang-toggle-btn" (click)="toggleLang()" title="Switch Language">
            {{ 'lang.label' | translate }}
        </button>
        <button class="reset-btn" (click)="handleReset()" title="Reset all data and regenerate">
            {{ 'topbar.reset' | translate }}
        </button>
        <div style="font-size:0.8rem;color:var(--text-muted)">{{ clock }}</div>
      </div>
    </header>
  `
})
export class TopbarComponent implements OnInit, OnDestroy {
  translationService = inject(TranslationService);
  dataStore = inject(DataStoreService);
  router = inject(Router);

  clock: string = '';
  private intervalId: any;

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
    '/eventlog': { title: 'page.eventlog.title', breadcrumb: 'page.eventlog.breadcrumb' }
  };

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
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
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

  toggleLang() {
    this.translationService.toggleLang();
  }

  async handleReset() {
    if (!confirm(this.translationService.translate('toast.confirm_reset'))) return;
    try {
      await this.dataStore.resetAllData();
      alert(this.translationService.translate('toast.data_reset'));
    } catch (err: any) {
      alert(err.message || 'Reset is not available yet');
    }
  }
}