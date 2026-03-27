import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataStoreService } from '../services/data-store.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { StageDuration, computeAverageStageDurations, findLongestStage } from '../utils/stage-duration';

@Component({
  selector: 'app-exec-dashboard',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
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

      <!-- Executive KPI Cards -->
      <div class="kpi-grid exec-kpi-grid">
        <div class="kpi-card accent">
          <div class="kpi-icon">📦</div>
          <div class="kpi-value">{{ importProcessed() }}</div>
          <div class="kpi-label">{{ 'exec.import_processed' | translate }}</div>
        </div>
        <div class="kpi-card info">
          <div class="kpi-icon">🚢</div>
          <div class="kpi-value">{{ exportProcessed() }}</div>
          <div class="kpi-label">{{ 'exec.export_processed' | translate }}</div>
        </div>
        <div class="kpi-card success">
          <div class="kpi-icon">📊</div>
          <div class="kpi-value">{{ importSla() }}%</div>
          <div class="kpi-label">{{ 'exec.import_sla' | translate }}</div>
        </div>
        <div class="kpi-card success">
          <div class="kpi-icon">📈</div>
          <div class="kpi-value">{{ exportSla() }}%</div>
          <div class="kpi-label">{{ 'exec.export_sla' | translate }}</div>
        </div>
        <div class="kpi-card danger">
          <div class="kpi-icon">🚨</div>
          <div class="kpi-value">{{ totalBreaches() }}</div>
          <div class="kpi-label">{{ 'exec.total_breaches' | translate }}</div>
        </div>
        <div class="kpi-card warning">
          <div class="kpi-icon">⏱️</div>
          <div class="kpi-value">{{ avgCycleTime() }}m</div>
          <div class="kpi-label">{{ 'exec.avg_time' | translate }}</div>
        </div>
      </div>

      <div class="grid-2">
        <!-- Import vs Export Comparison Chart -->
        <div class="comparison-chart">
          <h3>{{ 'exec.comparison_title' | translate }}</h3>
          <div class="comparison-section">
            <div class="comparison-group" *ngFor="let stage of comparisonStages()">
              <div class="comparison-label">{{ stage.label | translate }}</div>
              <div class="comparison-bars">
                <div class="comparison-bar-row">
                  <span class="comp-type-label import-label">{{ 'exec.import_label' | translate }}</span>
                  <div class="bar-track"><div class="bar-fill purple" [style.width.%]="barPctByStage(stage.importVal, stage.stageMax)">{{ stage.importVal }} min</div></div>
                </div>
                <div class="comparison-bar-row">
                  <span class="comp-type-label export-label">{{ 'exec.export_label' | translate }}</span>
                  <div class="bar-track"><div class="bar-fill teal" [style.width.%]="barPctByStage(stage.exportVal, stage.stageMax)">{{ stage.exportVal }} min</div></div>
                </div>
              </div>
            </div>
          </div>

          <div class="bottleneck-panel">
            <div class="bottleneck-title">{{ 'exec.bottleneck_title' | translate }}</div>
            <div class="insight-chip-grid">
              <div class="insight-chip">
                <div class="insight-chip-label">{{ 'exec.insight_import_top' | translate }}</div>
                <div class="insight-chip-value" *ngIf="importBottleneckStage(); else noImportTop">
                  {{ importBottleneckStage()!.labelKey | translate }} · {{ importBottleneckStage()!.minutes }}m
                </div>
                <ng-template #noImportTop>
                  <div class="insight-chip-empty">{{ 'exec.bottleneck_empty' | translate }}</div>
                </ng-template>
                <div class="insight-metric" *ngIf="importTopGap() > 0">
                  <div class="insight-metric-row">
                    <span>{{ 'exec.insight_gap_next' | translate }}</span>
                    <strong>{{ importTopGap() }}m</strong>
                  </div>
                  <div class="insight-delta-track">
                    <div class="insight-delta-fill" [style.width.%]="gapPct(importTopGap(), maxTopGap())"></div>
                  </div>
                </div>
              </div>

              <div class="insight-chip">
                <div class="insight-chip-label">{{ 'exec.insight_export_top' | translate }}</div>
                <div class="insight-chip-value" *ngIf="exportBottleneckStage(); else noExportTop">
                  {{ exportBottleneckStage()!.labelKey | translate }} · {{ exportBottleneckStage()!.minutes }}m
                </div>
                <ng-template #noExportTop>
                  <div class="insight-chip-empty">{{ 'exec.bottleneck_empty' | translate }}</div>
                </ng-template>
                <div class="insight-metric" *ngIf="exportTopGap() > 0">
                  <div class="insight-metric-row">
                    <span>{{ 'exec.insight_gap_next' | translate }}</span>
                    <strong>{{ exportTopGap() }}m</strong>
                  </div>
                  <div class="insight-delta-track">
                    <div class="insight-delta-fill" [style.width.%]="gapPct(exportTopGap(), maxTopGap())"></div>
                  </div>
                </div>
              </div>

              <div class="insight-chip span-2" *ngIf="crossBottleneckDelta() as delta">
                <div class="insight-chip-label">{{ 'exec.insight_cross_delta' | translate }}</div>
                <div class="insight-metric-row">
                  <span class="insight-chip-value">{{ delta.leadingType | translate }}</span>
                  <strong class="insight-chip-value">{{ delta.minutes }}m</strong>
                </div>
                <div class="insight-delta-track">
                  <div class="insight-delta-fill strong" [style.width.%]="gapPct(delta.minutes, maxCrossDelta())"></div>
                </div>
                <div class="insight-stage-tag" *ngIf="delta.stageLabelKey">{{ delta.stageLabelKey | translate }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- AI Summary Card -->
        <div class="ai-summary-card">
          <div class="ai-summary-header">
            <h3>{{ 'exec.ai_title' | translate }}</h3>
            <div style="display:flex;align-items:center;gap:0.5rem">
              <span class="ai-tag">AI Generated</span>
            </div>
          </div>
          <div class="ai-summary-content" *ngIf="aiSummary() as ai">
            <div class="ai-insight">
              <div class="ai-health" [ngClass]="ai.healthClass">
                <span class="health-label">Overall Health:</span>
                <span class="health-value">{{ ai.healthStatus }}</span>
                <span class="health-detail">({{ ai.overallCompliance }}% SLA compliance)</span>
              </div>
            </div>
            <div class="ai-insight">
              <strong>📊 Overview:</strong> {{ ai.activeCount }} active L/Cs, {{ ai.releasedCount }} completed today. Average cycle time: <strong>{{ avgCycleTime() }} min</strong> against SLA target of {{ ai.slaTarget }}.
            </div>
            <div class="ai-insight">
              <strong>📦 Import Performance:</strong> SLA compliance at <strong>{{ importSla() }}%</strong> with {{ importBreachCount() }} breach{{ importBreachCount() !== 1 ? 'es' : '' }}. {{ ai.importBottleneckText }}
            </div>
            <div class="ai-insight">
              <strong>🚢 Export Performance:</strong> SLA compliance at <strong>{{ exportSla() }}%</strong> with {{ exportBreachCount() }} breach{{ exportBreachCount() !== 1 ? 'es' : '' }}. {{ ai.exportBottleneckText }}
            </div>
            <div class="ai-insight">
              <strong>💡 Recommendation:</strong> {{ ai.recommendation }}
            </div>
          </div>
        </div>
      </div>

      <!-- Combined Recent Activity -->
      <div class="data-table-wrapper" style="margin-top:1.25rem">
        <div class="table-header">
          <h3>{{ 'exec.combined_activity' | translate }}</h3>
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
  `
})
export class ExecDashboardComponent implements OnInit {
  private dataStore = inject(DataStoreService);
  private ts = inject(TranslationService);

  readonly presets: Array<{ value: 'today' | 'yesterday' | 'last7days' | 'last14days' | 'last1month'; labelKey: string }> = [
    { value: 'today', labelKey: 'date.today' },
    { value: 'yesterday', labelKey: 'date.yesterday' },
    { value: 'last7days', labelKey: 'date.last_7_days' },
    { value: 'last14days', labelKey: 'date.last_14_days' },
    { value: 'last1month', labelKey: 'date.last_month' },
  ];
  customFrom = '';
  customTo = '';

  range = computed(() => this.dataStore.executiveDateRange());

  private importData = computed(() => this.dataStore.lcs().filter(r => r.transactionType === 'Import'));
  private exportData = computed(() => this.dataStore.lcs().filter(r => r.transactionType === 'Export'));
  private sla = computed(() => this.dataStore.slaConfig());

  importProcessed = computed(() => this.importData().length);
  exportProcessed = computed(() => this.exportData().length);

  importBreachCount = computed(() => this.countBreaches(this.importData()));
  exportBreachCount = computed(() => this.countBreaches(this.exportData()));
  totalBreaches = computed(() => this.importBreachCount() + this.exportBreachCount());

  importSla = computed(() => {
    const total = this.importData().length;
    return total > 0 ? Math.round(((total - this.importBreachCount()) / total) * 100) : 0;
  });

  exportSla = computed(() => {
    const total = this.exportData().length;
    return total > 0 ? Math.round(((total - this.exportBreachCount()) / total) * 100) : 0;
  });

  avgCycleTime = computed(() => {
    const released = this.dataStore.lcs().filter(r => r.status === 'Released' && r.releasedAt);
    if (released.length === 0) return 0;
    const totalMin = released.reduce((sum, r) => sum + Math.round((new Date(r.releasedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000), 0);
    return Math.round(totalMin / released.length);
  });

  recentEvents = computed(() => this.dataStore.events().slice(0, 8));

  importStageAverages = computed(() => computeAverageStageDurations(this.importData()));
  exportStageAverages = computed(() => computeAverageStageDurations(this.exportData()));

  importBottleneckStage = computed(() => findLongestStage(this.importStageAverages()));
  exportBottleneckStage = computed(() => findLongestStage(this.exportStageAverages()));

  comparisonStages = computed(() => {
    const imp = this.mapStagesForComparison(this.importStageAverages());
    const exp = this.mapStagesForComparison(this.exportStageAverages());
    const stageMax = (a: number, b: number) => Math.max(1, a, b);
    return [
      { label: 'chart.inbox', importVal: imp.inbox, exportVal: exp.inbox, stageMax: stageMax(imp.inbox, exp.inbox) },
      { label: 'chart.drafting', importVal: imp.drafting, exportVal: exp.drafting, stageMax: stageMax(imp.drafting, exp.drafting) },
      { label: 'chart.checking', importVal: imp.checking, exportVal: exp.checking, stageMax: stageMax(imp.checking, exp.checking) },
      { label: 'chart.total', importVal: imp.total, exportVal: exp.total, stageMax: stageMax(imp.total, exp.total) },
    ];
  });

  importTopGap = computed(() => this.topGap(this.importStageAverages()));
  exportTopGap = computed(() => this.topGap(this.exportStageAverages()));
  maxTopGap = computed(() => Math.max(1, this.importTopGap(), this.exportTopGap()));
  maxCrossDelta = computed(() => {
    const importTop = this.importBottleneckStage()?.minutes || 0;
    const exportTop = this.exportBottleneckStage()?.minutes || 0;
    return Math.max(1, importTop, exportTop);
  });

  crossBottleneckDelta = computed(() => {
    const importTop = this.importBottleneckStage();
    const exportTop = this.exportBottleneckStage();
    if (!importTop && !exportTop) return null;
    if (!importTop) {
      return { leadingType: 'exec.export_label', minutes: exportTop!.minutes, stageLabelKey: exportTop!.labelKey };
    }
    if (!exportTop) {
      return { leadingType: 'exec.import_label', minutes: importTop.minutes, stageLabelKey: importTop.labelKey };
    }
    if (importTop.minutes === exportTop.minutes) {
      return { leadingType: 'exec.bottleneck_balanced', minutes: 0, stageLabelKey: importTop.labelKey };
    }
    const exportLeads = exportTop.minutes > importTop.minutes;
    return {
      leadingType: exportLeads ? 'exec.export_label' : 'exec.import_label',
      minutes: Math.abs(exportTop.minutes - importTop.minutes),
      stageLabelKey: exportLeads ? exportTop.labelKey : importTop.labelKey,
    };
  });

  aiSummary = computed(() => {
    const data = this.dataStore.lcs();
    const sla = this.sla();
    const totalBreaches = this.totalBreaches();
    const activeCount = data.filter(r => r.status !== 'Released').length;
    const releasedCount = data.filter(r => r.status === 'Released').length;
    const overallCompliance = data.length > 0 ? Math.round(((data.length - totalBreaches) / data.length) * 100) : 100;

    let healthStatus = '🟢 Excellent';
    let healthClass = 'health-good';
    if (overallCompliance < 90) { healthStatus = '🟡 Moderate'; healthClass = 'health-moderate'; }
    if (overallCompliance < 75) { healthStatus = '🔴 Critical'; healthClass = 'health-critical'; }

    const slaTarget = `${sla.slaMinMinutes}–${sla.slaMaxMinutes} min`;

    const importBottleneck = this.importBottleneckStage();
    const exportBottleneck = this.exportBottleneckStage();
    const importBottleneckText = importBottleneck
      ? `Primary bottleneck: ${this.stageName(importBottleneck.labelKey)} (avg ${importBottleneck.minutes} min).`
      : 'Insufficient data for bottleneck analysis.';
    const exportBottleneckText = exportBottleneck
      ? `Primary bottleneck: ${this.stageName(exportBottleneck.labelKey)} (avg ${exportBottleneck.minutes} min).`
      : 'Insufficient data for bottleneck analysis.';

    const impVol = this.importData().length;
    const expVol = this.exportData().length;
    let volumeInsight = `Processing volumes are balanced — Import: ${impVol}, Export: ${expVol}.`;
    if (impVol > expVol * 1.3) volumeInsight = `Import volume is significantly higher (${impVol} vs ${expVol}). Consider monitoring Import workload distribution.`;
    else if (expVol > impVol * 1.3) volumeInsight = `Export volume is significantly higher (${expVol} vs ${impVol}). Consider monitoring Export workload distribution.`;

    let recommendation = volumeInsight;
    if (totalBreaches > 0) {
      const focusType = this.importBreachCount() >= this.exportBreachCount() ? 'Import' : 'Export';
      const focus = focusType === 'Import' ? importBottleneck : exportBottleneck;
      const focusStage = focus ? this.stageName(focus.labelKey) : this.ts.translate('exec.bottleneck_empty');
      recommendation += ` Focus on reducing ${focusType} ${focusStage} times to improve overall SLA compliance.`;
    } else {
      recommendation += ' All operations within target — maintain current performance.';
    }

    return { healthStatus, healthClass, overallCompliance, activeCount, releasedCount, slaTarget, importBottleneckText, exportBottleneckText, recommendation };
  });

  barPct(value: number): number {
    return Math.min(100, Math.max(5, (Math.abs(value) / 180) * 100));
  }

  barPctByStage(value: number, stageMax: number): number {
    if (stageMax <= 0) return 0;
    return Math.min(100, Math.max(5, (Math.abs(value) / stageMax) * 100));
  }

  gapPct(value: number, maxValue: number): number {
    if (maxValue <= 0 || value <= 0) return 0;
    return Math.min(100, Math.max(3, (Math.abs(value) / maxValue) * 100));
  }

  formatTime(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  private countBreaches(records: any[]): number {
    const sla = this.sla();
    return records.filter(r => {
      const elapsed = this.getElapsedMinutes(r);
      return (elapsed > sla.slaMaxMinutes && r.status !== 'Released' && r.status !== 'Exception') || r.status === 'Breached';
    }).length;
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

  private mapStagesForComparison(stages: StageDuration[]) {
    const byKey: Record<string, number> = {};
    stages.forEach((stage) => {
      byKey[stage.key] = stage.minutes;
    });
    return {
      inbox: byKey['inbox'] || 0,
      drafting: byKey['drafting'] || 0,
      checking: byKey['checking'] || 0,
      total: (byKey['inbox'] || 0) + (byKey['drafting'] || 0) + (byKey['checking'] || 0) + (byKey['exception'] || 0),
    };
  }

  private topGap(stages: StageDuration[]): number {
    if (stages.length < 2) return 0;
    const sorted = [...stages].sort((a, b) => b.minutes - a.minutes);
    return Math.max(0, sorted[0].minutes - sorted[1].minutes);
  }

  private stageName(labelKey: string): string {
    return this.ts.translate(labelKey);
  }

  ngOnInit(): void {
    this.dataStore.setActiveDashboardContext('executive');
    this.syncInputsFromRange();
    void this.dataStore.refreshData();
  }

  usePreset(preset: 'today' | 'yesterday' | 'last7days' | 'last14days' | 'last1month'): void {
    const bounds = this.presetDateBounds(preset);
    this.customFrom = bounds.from;
    this.customTo = bounds.to;
    void this.dataStore.setPresetDateRange('executive', preset);
  }

  applyCustomRange(): void {
    if (!this.customFrom || !this.customTo) return;
    void this.dataStore.setCustomDateRange('executive', this.customFrom, this.customTo);
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