import { Component, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DataStoreService } from '../services/data-store.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';

@Component({
  selector: 'app-operations',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="page-content">

      <!-- KPI Cards -->
      <div class="kpi-grid">
        <div class="kpi-card accent">
          <div class="kpi-icon">📋</div>
          <div class="kpi-value">{{ activeCount() }}</div>
          <div class="kpi-label">{{ 'kpi.active' | translate }}</div>
        </div>
        <div class="kpi-card success">
          <div class="kpi-icon">✅</div>
          <div class="kpi-value">{{ completedCount() }}</div>
          <div class="kpi-label">{{ 'kpi.completed' | translate }}</div>
        </div>
        <div class="kpi-card danger">
          <div class="kpi-icon">🚨</div>
          <div class="kpi-value">{{ breachCount() }}</div>
          <div class="kpi-label">{{ 'kpi.breaches' | translate }}</div>
        </div>
        <div class="kpi-card warning">
          <div class="kpi-icon">⏱️</div>
          <div class="kpi-value">{{ avgTime() }}m</div>
          <div class="kpi-label">{{ 'kpi.avgtime' | translate }}</div>
        </div>
      </div>

      <div class="grid-2">
        <!-- Stage Duration Chart -->
        <div class="stage-chart">
          <h3>{{ 'chart.title' | translate }}</h3>
          <div class="bar-row">
            <span class="bar-label">{{ 'chart.inbox' | translate }}</span>
            <div class="bar-track"><div class="bar-fill purple" [style.width.%]="barPct(stageAvgs().inbox)">{{ stageAvgs().inbox }} min</div></div>
          </div>
          <div class="bar-row">
            <span class="bar-label">{{ 'chart.drafting' | translate }}</span>
            <div class="bar-track"><div class="bar-fill amber" [style.width.%]="barPct(stageAvgs().drafting)">{{ stageAvgs().drafting }} min</div></div>
          </div>
          <div class="bar-row">
            <span class="bar-label">{{ 'chart.checking' | translate }}</span>
            <div class="bar-track"><div class="bar-fill indigo" [style.width.%]="barPct(stageAvgs().checking)">{{ stageAvgs().checking }} min</div></div>
          </div>
          <div class="bar-row">
            <span class="bar-label">{{ 'chart.total' | translate }}</span>
            <div class="bar-track"><div class="bar-fill teal" [style.width.%]="barPct(stageAvgs().total)">{{ stageAvgs().total }} min</div></div>
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="data-table-wrapper">
          <div class="table-header">
            <h3>{{ 'recent.title' | translate }}</h3>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ 'recent.col_time' | translate }}</th>
                <th>{{ 'recent.col_event' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngIf="recentEvents().length === 0">
                <td colspan="2" style="text-align:center;color:var(--text-muted);padding:2rem">{{ 'recent.empty' | translate }}</td>
              </tr>
              <tr *ngFor="let e of recentEvents()">
                <td style="white-space:nowrap;font-size:0.775rem;color:var(--text-muted)">{{ formatTime(e.timestamp) }}</td>
                <td><strong>{{ e.urn }}</strong> → {{ e.to }} <span style="color:var(--text-muted);font-size:0.75rem">by {{ e.user }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Summary Table -->
      <div class="data-table-wrapper" style="margin-top:1.25rem">
        <div class="table-header">
          <h3>{{ 'summary.title' | translate }}</h3>
        </div>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ 'summary.col_urn' | translate }}</th>
                <th>{{ 'summary.col_sender' | translate }}</th>
                <th>{{ 'summary.col_status' | translate }}</th>
                <th>{{ 'summary.col_received' | translate }}</th>
                <th>{{ 'summary.col_elapsed' | translate }}</th>
                <th>{{ 'summary.col_sla' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of filteredData().slice(0, 15)">
                <td><a class="urn-link" (click)="showLcDetails(r)"><strong>{{ r.urn }}</strong></a></td>
                <td style="font-size:0.8rem;color:var(--text-secondary)">{{ r.senderEmail }}</td>
                <td><span class="status-badge" [ngClass]="statusClass(r.status)"><span class="dot"></span>{{ r.status }}</span></td>
                <td style="font-size:0.8rem;color:var(--text-muted)">{{ formatTime(r.receivedAt) }}</td>
                <td class="elapsed-time">{{ formatElapsed(r) }}</td>
                <td [innerHTML]="slaIndicatorHtml(r)"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- LC Detail Modal -->
      <div class="modal-overlay" [class.active]="!!selectedLc" (click)="selectedLc = null">
        <div class="modal-container" *ngIf="selectedLc" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>{{ selectedLc.urn }}</h3>
              <div style="font-size:0.75rem;color:var(--text-secondary)">[{{ selectedLc.transactionType }}] {{ selectedLc.subject }}</div>
            </div>
            <button class="modal-close" (click)="selectedLc = null">×</button>
          </div>
          <div class="modal-body">
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
                  <div class="timeline-title">{{ 'timeline.exception' | translate }}</div>
                  <div class="timeline-time">{{ selectedLc.exceptionStartedAt ? formatDateTime(selectedLc.exceptionStartedAt) : '—' }}</div>
                  <div class="timeline-desc">{{ selectedLc.status === 'Exception' ? (selectedLc.exceptionReason || ('timeline.desc.exception_active' | translate)) : ('timeline.desc.exception_resolved' | translate) }}{{ selectedLc.status !== 'Exception' && selectedLc.exceptionTotalMinutes ? ' (' + selectedLc.exceptionTotalMinutes + ' min total)' : '' }}</div>
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
            </div>
          </div>
        </div>
      </div>

    </div>
  `
})
export class OperationsComponent implements OnInit {
  private dataStore = inject(DataStoreService);
  private route = inject(ActivatedRoute);
  private ts = inject(TranslationService);

  type: 'Import' | 'Export' = 'Import';
  selectedLc: any = null;

  ngOnInit() {
    this.type = this.route.snapshot.data['type'] || 'Import';
  }

  filteredData = computed(() => this.dataStore.lcs().filter(r => r.transactionType === this.type));
  private sla = computed(() => this.dataStore.slaConfig());

  activeCount = computed(() => this.filteredData().filter(r => r.status !== 'Released').length);
  completedCount = computed(() => this.filteredData().filter(r => r.status === 'Released').length);
  breachCount = computed(() => {
    const sla = this.sla();
    return this.filteredData().filter(r => {
      const elapsed = this.getElapsedMinutes(r);
      return (elapsed > sla.slaMaxMinutes && r.status !== 'Released' && r.status !== 'Exception') || r.status === 'Breached';
    }).length;
  });
  avgTime = computed(() => {
    const released = this.filteredData().filter(r => r.status === 'Released' && r.releasedAt);
    if (released.length === 0) return 0;
    const totalMin = released.reduce((sum, r) => sum + Math.round((new Date(r.releasedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000), 0);
    return Math.round(totalMin / released.length);
  });

  recentEvents = computed(() => this.dataStore.events().slice(0, 8));

  stageAvgs = computed(() => {
    const records = this.filteredData();
    const inbox: number[] = [], drafting: number[] = [], checking: number[] = [], total: number[] = [];
    records.forEach(r => {
      if (r.draftingStartedAt) inbox.push((new Date(r.draftingStartedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000);
      if (r.draftingStartedAt && r.checkingStartedAt) drafting.push((new Date(r.checkingStartedAt).getTime() - new Date(r.draftingStartedAt).getTime()) / 60000);
      if (r.checkingStartedAt && r.releasedAt) checking.push((new Date(r.releasedAt).getTime() - new Date(r.checkingStartedAt).getTime()) / 60000);
      if (r.releasedAt) total.push((new Date(r.releasedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000);
    });
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    return { inbox: avg(inbox), drafting: avg(drafting), checking: avg(checking), total: avg(total) };
  });

  barPct(value: number): number {
    return Math.min(100, Math.max(5, (Math.abs(value) / 180) * 100));
  }

  formatTime(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  formatDateTime(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  formatElapsed(r: any): string {
    const mins = this.getElapsedMinutes(r);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  statusClass(status: string): string {
    const map: any = { 'Received': 'received', 'Drafting': 'drafting', 'Checking Underlying': 'checking', 'Released': 'released', 'Breached': 'breached', 'Exception': 'exception' };
    return map[status] || 'received';
  }

  slaIndicatorHtml(r: any): string {
    const sla = this.sla();
    if (r.status === 'Released') {
      const total = Math.round((new Date(r.releasedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000);
      if (total <= sla.slaMinMinutes) return `<span class="sla-indicator green">✓ ${total}m</span>`;
      if (total <= sla.slaMaxMinutes) return `<span class="sla-indicator yellow">⚠ ${total}m</span>`;
      return `<span class="sla-indicator red">✗ ${total}m</span>`;
    }
    const elapsed = this.getElapsedMinutes(r);
    if (elapsed <= sla.slaMinMinutes) return `<span class="sla-indicator green">✓ ${this.ts.translate('sla.ok')}</span>`;
    if (elapsed <= sla.slaMaxMinutes) return `<span class="sla-indicator yellow">⚠ ${this.ts.translate('sla.warning')}</span>`;
    return `<span class="sla-indicator red">✗ ${this.ts.translate('sla.breach')}</span>`;
  }

  showLcDetails(r: any) {
    this.selectedLc = r;
  }

  private getElapsedMinutes(r: any): number {
    let total = 0;
    if (r.status === 'Released' && r.releasedAt) {
      total = Math.round((new Date(r.releasedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000);
    } else if (r.status === 'Exception' && r.exceptionStartedAt) {
      total = Math.round((new Date(r.exceptionStartedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000);
    } else {
      total = Math.round((Date.now() - new Date(r.receivedAt).getTime()) / 60000);
    }
    return Math.max(0, total - (r.exceptionTotalMinutes || 0));
  }
}