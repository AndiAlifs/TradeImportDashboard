import { Component, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DataStoreService } from '../services/data-store.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { getChartLabel } from '../utils/stage-duration';
import { LcDetailModalComponent } from '../components/lc-detail-modal/lc-detail-modal.component';

@Component({
  selector: 'app-operations',
  standalone: true,
  imports: [CommonModule, TranslatePipe, LcDetailModalComponent],
  template: `
    <div class="page-content">

      <div class="date-range-toolbar">
        <div class="date-range-presets">
          <button
            type="button"
            class="range-pill"
            *ngFor="let preset of presets"
            [class.active]="isPresetActive(preset.value)"
            (click)="usePreset(preset.value)">
            {{ preset.labelKey | translate }}
          </button>
        </div>
        <div class="date-range-custom">
          <input type="date" [value]="customFrom" (change)="customFrom = $any($event.target).value" />
          <span>{{ 'date.to' | translate }}</span>
          <input type="date" [value]="customTo" (change)="customTo = $any($event.target).value" />
          <button type="button" class="range-apply-btn" (click)="applyCustomRange()">{{ 'date.apply' | translate }}</button>
        </div>
        <div class="date-range-caption">{{ 'date.server_time' | translate }} · {{ selectedRangeLabel() }}</div>
      </div>

      <!-- KPI Cards -->
      <div class="kpi-grid">
        <div class="kpi-card accent">
          <div class="kpi-icon">📋</div>
          <div class="kpi-value">{{ activeCount() }}</div>
          <div class="kpi-label">{{ getTranslatedText('kpi.active') }}</div>
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
            <span class="bar-label">{{ getChartLabel(type, 'inbox') | translate }}</span>
            <div class="bar-track"><div class="bar-fill purple" [style.width.%]="barPct(stageAvgs().inbox)">{{ stageAvgs().inbox }} min</div></div>
          </div>
          <div class="bar-row">
            <span class="bar-label">{{ getChartLabel(type, 'drafting') | translate }}</span>
            <div class="bar-track"><div class="bar-fill amber" [style.width.%]="barPct(stageAvgs().drafting)">{{ stageAvgs().drafting }} min</div></div>
          </div>
          <div class="bar-row">
            <span class="bar-label">{{ getChartLabel(type, 'checking') | translate }}</span>
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
              @for (e of recentEvents(); track e.id || $index) {
                <tr>
                  <td style="white-space:nowrap;font-size:0.775rem;color:var(--text-muted)">{{ formatTime(e.timestamp) }}</td>
                  <td><strong>{{ e.urn }}</strong> → {{ e.to }} <span style="color:var(--text-muted);font-size:0.75rem">by {{ e.user }}</span></td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="2" style="text-align:center;color:var(--text-muted);padding:2rem">{{ getTranslatedText('recent.empty') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Summary Table -->
      <div class="data-table-wrapper" style="margin-top:1.25rem">
        <div class="table-header">
          <h3>{{ getTranslatedText('summary.title') }}</h3>
        </div>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ 'summary.col_urn' | translate }}</th>
                <th>{{ 'summary.col_subject' | translate }}</th>
                <th>{{ 'summary.col_assigned' | translate }}</th>
                <th>{{ 'summary.col_released_by' | translate }}</th>
                <th>{{ 'summary.col_status' | translate }}</th>
                <th>{{ 'summary.col_received' | translate }}</th>
                <th>{{ 'summary.col_elapsed' | translate }}</th>
                <th>{{ 'summary.col_sla' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (r of filteredData().slice(0, 15); track r.id || r.urn) {
                <tr [class.at-risk-row]="r._isAtRisk">
                  <td><a class="urn-link" (click)="showLcDetails(r)"><strong>{{ r.urn }}</strong></a></td>
                  <td style="font-size:0.8rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" [title]="r.subject">{{ r.subject }}</td>
                  <td style="font-size:0.8rem;color:var(--text-secondary)">{{ r.assignedTo || '—' }}</td>
                  <td style="font-size:0.8rem;color:var(--text-secondary)">{{ r.approvedBy || '—' }}</td>
                  <td><span class="status-badge" [ngClass]="r._statusClass"><span class="dot"></span>{{ r.status }}</span></td>
                  <td style="font-size:0.8rem;color:var(--text-muted)">{{ r._formattedTime }}</td>
                  <td class="elapsed-time">{{ r._elapsedFormatted }}</td>
                  <td [innerHTML]="r._slaIndicatorHtml"></td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem">{{ getTranslatedText('recent.empty') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <app-lc-detail-modal [lc]="selectedLc" [exceptionHistory]="[]" (closed)="selectedLc = null"></app-lc-detail-modal>

    </div>
  `
})
export class OperationsComponent implements OnInit {
  getChartLabel = getChartLabel;
  private dataStore = inject(DataStoreService);
  private route = inject(ActivatedRoute);
  private ts = inject(TranslationService);

  type: 'Import' | 'Export' | 'Bank Guarantee' = 'Import';
  selectedLc: any = null;
  readonly presets: Array<{ value: 'today' | 'yesterday' | 'last7days' | 'last14days' | 'last1month'; labelKey: string }> = [
    { value: 'today', labelKey: 'date.today' },
    { value: 'yesterday', labelKey: 'date.yesterday' },
    { value: 'last7days', labelKey: 'date.last_7_days' },
    { value: 'last14days', labelKey: 'date.last_14_days' },
    { value: 'last1month', labelKey: 'date.last_month' },
  ];
  customFrom = '';
  customTo = '';
  range = computed(() => this.dataStore.operationsDateRange());

  getDocumentName(type: string): string {
    switch (type) {
      case 'Bank Guarantee':
        return 'BG STD';
      case 'Export':
        return 'Document';
      case 'Import':
      default:
        return 'L/C';
    }
  }

  getTranslatedText(key: string, customType?: string): string {
    const targetType = customType || this.type;
    const docName = this.getDocumentName(targetType);
    let text = this.ts.translate(key);

    if (docName !== 'L/C') {
      text = text
        .replace(/L\/Cs/g, `${docName}s`)
        .replace(/L\/C/g, docName)
        .replace(/documentary credit/gi, docName)
        .replace(/kredit dokumenter/gi, docName);
    }

    return text;
  }

  ngOnInit() {
    this.type = this.route.snapshot.data['type'] || 'Import';
    this.dataStore.setActiveDashboardContext('operations');
    this.syncInputsFromRange();
    void this.dataStore.refreshData({ transactionType: this.type });
  }

  enrichedData = computed(() => {
    return this.dataStore.lcs().map(r => ({
      ...r,
      _receivedAtMillis: r.receivedAt ? new Date(r.receivedAt).getTime() : 0,
      _elapsedMinutes: this.getElapsedMinutes(r),
      _statusClass: this.statusClass(r.status),
      _formattedTime: this.formatTime(r.receivedAt),
      _elapsedFormatted: this.formatElapsed(r),
      _slaIndicatorHtml: this.slaIndicatorHtml(r),
      _isAtRisk: this.isAtRisk(r)
    }));
  });

  filteredData = computed(() => this.enrichedData().filter(r => r.transactionType === this.type));
  private sla = computed(() => this.dataStore.slaConfig());

  activeCount = computed(() => this.filteredData().filter(r => r.status !== 'Released').length);
  completedCount = computed(() => this.filteredData().filter(r => r.status === 'Released').length);
  breachCount = computed(() => {
    const sla = this.sla();
    let maxSla = sla.importSlaMaxMinutes;
    if (this.type === 'Export') maxSla = sla.exportSlaMaxMinutes;
    if (this.type === 'Bank Guarantee') maxSla = sla.bgSlaMaxMinutes;

    return this.filteredData().filter(r => {
      const elapsed = this.getElapsedMinutes(r);
      return elapsed > maxSla || r.status === 'Breached' || r.status === 'Breached with Exception';
    }).length;
  });
  avgTime = computed(() => {
    const released = this.filteredData().filter(r => r.status === 'Released' && r.releasedAt);
    if (released.length === 0) return 0;
    const totalMin = released.reduce((sum, r) => sum + this.getElapsedMinutes(r), 0);
    return Math.round(totalMin / released.length);
  });

  recentEvents = computed(() => this.dataStore.events().slice(0, 8));

  stageAvgs = computed(() => {
    const records = this.filteredData();
    const inbox: number[] = [], drafting: number[] = [], checking: number[] = [], total: number[] = [];
    records.forEach(r => {
      const exDeduction = Math.max(0, r.exceptionTotalMinutes || 0);
      if (r.draftingStartedAt) inbox.push((new Date(r.draftingStartedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000);
      if (r.draftingStartedAt && r.checkingStartedAt) drafting.push((new Date(r.checkingStartedAt).getTime() - new Date(r.draftingStartedAt).getTime()) / 60000);
      // Subtract exception deduction from checking (last stage) so only true working time is counted.
      if (r.checkingStartedAt && r.releasedAt) checking.push(Math.max(0, (new Date(r.releasedAt).getTime() - new Date(r.checkingStartedAt).getTime()) / 60000 - exDeduction));
      if (r.releasedAt) total.push(Math.max(0, (new Date(r.releasedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000 - exDeduction));
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

  formatElapsed(r: any): string {
    const mins = this.getElapsedMinutes(r);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  statusClass(status: string): string {
    const map: any = {
      'Received': 'received',
      'Drafting': 'drafting',
      'Checking Underlying': 'checking',
      'Released': 'released',
      'Breached': 'breached',
      'Breached with Exception': 'breached',
      'Exception': 'exception'
    };
    return map[status] || 'received';
  }

  isAtRisk(r: any): boolean {
    if (r.status === 'Released' || r.status === 'Breached' || r.status === 'Breached with Exception') return false;
    const elapsed = this.getElapsedMinutes(r);
    let maxSla = this.sla().importSlaMaxMinutes;
    if (this.type === 'Export') maxSla = this.sla().exportSlaMaxMinutes;
    if (this.type === 'Bank Guarantee') maxSla = this.sla().bgSlaMaxMinutes;
    return elapsed >= (maxSla * 0.75) && elapsed <= maxSla;
  }

  slaIndicatorHtml(r: any): string {
    const sla = this.sla();
    let maxSla = sla.importSlaMaxMinutes;
    if (this.type === 'Export') maxSla = sla.exportSlaMaxMinutes;
    if (this.type === 'Bank Guarantee') maxSla = sla.bgSlaMaxMinutes;
    const warningThreshold = Math.floor(maxSla * 0.75);
    if (r.status === 'Released') {
      const total = Math.round((new Date(r.releasedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000);
      if (total <= warningThreshold) return `<span class="sla-indicator green">✓ ${total}m</span>`;
      if (total <= maxSla) return `<span class="sla-indicator yellow">⚠ ${total}m</span>`;
      return `<span class="sla-indicator red">✗ ${total}m</span>`;
    }
    if (r.status === 'Breached with Exception') {
      const elapsed = this.getElapsedMinutes(r);
      return `<span class="sla-indicator orange">⚠ ${this.ts.translate('sla.breached_exception')} (${elapsed}m)</span>`;
    }
    const elapsed = this.getElapsedMinutes(r);
    if (elapsed <= warningThreshold) return `<span class="sla-indicator green">✓ ${this.ts.translate('sla.ok')}</span>`;
    if (elapsed <= maxSla) return `<span class="sla-indicator yellow">⚠ ${this.ts.translate('sla.warning')}</span>`;
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

  usePreset(preset: 'today' | 'yesterday' | 'last7days' | 'last14days' | 'last1month'): void {
    const bounds = this.presetDateBounds(preset);
    this.customFrom = bounds.from;
    this.customTo = bounds.to;
    void this.dataStore.setPresetDateRange('operations', preset, false).then(() => this.dataStore.refreshData({ transactionType: this.type }));
  }

  applyCustomRange(): void {
    if (!this.customFrom || !this.customTo) return;
    void this.dataStore.setCustomDateRange('operations', this.customFrom, this.customTo, false)
      .then(() => this.dataStore.refreshData({ transactionType: this.type }));
  }

  isPresetActive(preset: 'today' | 'yesterday' | 'last7days' | 'last14days' | 'last1month'): boolean {
    return this.range().preset === preset;
  }

  selectedRangeLabel(): string {
    const selectedRange = this.range();
    if (selectedRange.preset === 'custom') {
      if (!selectedRange.fromDate || !selectedRange.toDate) {
        return this.ts.translate('date.custom');
      }
      return `${selectedRange.fromDate} ${this.ts.translate('date.to')} ${selectedRange.toDate}`;
    }
    if (selectedRange.preset === 'yesterday') return this.ts.translate('date.yesterday');
    if (selectedRange.preset === 'last7days') return this.ts.translate('date.last_7_days');
    if (selectedRange.preset === 'last14days') return this.ts.translate('date.last_14_days');
    if (selectedRange.preset === 'last1month') return this.ts.translate('date.last_month');
    return this.ts.translate('date.today');
  }

  private syncInputsFromRange(): void {
    const selectedRange = this.range();
    if (selectedRange.preset === 'custom') {
      this.customFrom = selectedRange.fromDate;
      this.customTo = selectedRange.toDate;
      return;
    }
    const bounds = this.presetDateBounds(selectedRange.preset);
    this.customFrom = bounds.from;
    this.customTo = bounds.to;
  }

  private presetDateBounds(preset: 'today' | 'yesterday' | 'last7days' | 'last14days' | 'last1month'): { from: string; to: string } {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (preset === 'today') {
      const day = this.toDateInputValue(startOfToday);
      return { from: day, to: day };
    }

    if (preset === 'yesterday') {
      const yesterday = new Date(startOfToday);
      yesterday.setDate(yesterday.getDate() - 1);
      const day = this.toDateInputValue(yesterday);
      return { from: day, to: day };
    }

    if (preset === 'last7days') {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 6);
      return { from: this.toDateInputValue(from), to: this.toDateInputValue(startOfToday) };
    }

    if (preset === 'last14days') {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 13);
      return { from: this.toDateInputValue(from), to: this.toDateInputValue(startOfToday) };
    }

    const from = new Date(startOfToday);
    from.setMonth(from.getMonth() - 1);
    from.setDate(from.getDate() + 1);
    return { from: this.toDateInputValue(from), to: this.toDateInputValue(startOfToday) };
  }

  private toDateInputValue(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}