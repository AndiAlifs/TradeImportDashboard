import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataStoreService } from '../services/data-store.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';

@Component({
  selector: 'app-exec-dashboard',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="page-content">

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
                  <div class="bar-track"><div class="bar-fill purple" [style.width.%]="barPct(stage.importVal)">{{ stage.importVal }} min</div></div>
                </div>
                <div class="comparison-bar-row">
                  <span class="comp-type-label export-label">{{ 'exec.export_label' | translate }}</span>
                  <div class="bar-track"><div class="bar-fill teal" [style.width.%]="barPct(stage.exportVal)">{{ stage.exportVal }} min</div></div>
                </div>
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
export class ExecDashboardComponent {
  private dataStore = inject(DataStoreService);
  private ts = inject(TranslationService);

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

  comparisonStages = computed(() => {
    const imp = this.computeStageAvgs(this.importData());
    const exp = this.computeStageAvgs(this.exportData());
    return [
      { label: 'chart.inbox', importVal: imp.inbox, exportVal: exp.inbox },
      { label: 'chart.drafting', importVal: imp.drafting, exportVal: exp.drafting },
      { label: 'chart.checking', importVal: imp.checking, exportVal: exp.checking },
      { label: 'chart.total', importVal: imp.total, exportVal: exp.total },
    ];
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

    const importBottleneck = this.findBottleneck(this.importData());
    const exportBottleneck = this.findBottleneck(this.exportData());
    const importBottleneckText = importBottleneck.avg > 0
      ? `Primary bottleneck: ${importBottleneck.name} (avg ${importBottleneck.avg} min).`
      : 'Insufficient data for bottleneck analysis.';
    const exportBottleneckText = exportBottleneck.avg > 0
      ? `Primary bottleneck: ${exportBottleneck.name} (avg ${exportBottleneck.avg} min).`
      : 'Insufficient data for bottleneck analysis.';

    const impVol = this.importData().length;
    const expVol = this.exportData().length;
    let volumeInsight = `Processing volumes are balanced — Import: ${impVol}, Export: ${expVol}.`;
    if (impVol > expVol * 1.3) volumeInsight = `Import volume is significantly higher (${impVol} vs ${expVol}). Consider monitoring Import workload distribution.`;
    else if (expVol > impVol * 1.3) volumeInsight = `Export volume is significantly higher (${expVol} vs ${impVol}). Consider monitoring Export workload distribution.`;

    let recommendation = volumeInsight;
    if (totalBreaches > 0) {
      const focusType = this.importBreachCount() >= this.exportBreachCount() ? 'Import' : 'Export';
      const focusStage = focusType === 'Import' ? importBottleneck.name : exportBottleneck.name;
      recommendation += ` Focus on reducing ${focusType} ${focusStage} times to improve overall SLA compliance.`;
    } else {
      recommendation += ' All operations within target — maintain current performance.';
    }

    return { healthStatus, healthClass, overallCompliance, activeCount, releasedCount, slaTarget, importBottleneckText, exportBottleneckText, recommendation };
  });

  barPct(value: number): number {
    return Math.min(100, Math.max(5, (Math.abs(value) / 180) * 100));
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

  private computeStageAvgs(records: any[]) {
    const inbox: number[] = [], drafting: number[] = [], checking: number[] = [], total: number[] = [];
    records.forEach(r => {
      if (r.draftingStartedAt) inbox.push((new Date(r.draftingStartedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000);
      if (r.draftingStartedAt && r.checkingStartedAt) drafting.push((new Date(r.checkingStartedAt).getTime() - new Date(r.draftingStartedAt).getTime()) / 60000);
      if (r.checkingStartedAt && r.releasedAt) checking.push((new Date(r.releasedAt).getTime() - new Date(r.checkingStartedAt).getTime()) / 60000);
      if (r.releasedAt) total.push((new Date(r.releasedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000);
    });
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    return { inbox: avg(inbox), drafting: avg(drafting), checking: avg(checking), total: avg(total) };
  }

  private findBottleneck(records: any[]) {
    const inbox: number[] = [], drafting: number[] = [], checking: number[] = [];
    records.forEach(r => {
      if (r.draftingStartedAt) inbox.push((new Date(r.draftingStartedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000);
      if (r.draftingStartedAt && r.checkingStartedAt) drafting.push((new Date(r.checkingStartedAt).getTime() - new Date(r.draftingStartedAt).getTime()) / 60000);
      if (r.checkingStartedAt && r.releasedAt) checking.push((new Date(r.releasedAt).getTime() - new Date(r.checkingStartedAt).getTime()) / 60000);
    });
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const stages = [
      { name: 'Inbox Wait', avg: avg(inbox) },
      { name: 'Drafting', avg: avg(drafting) },
      { name: 'Checking Underlying', avg: avg(checking) },
    ];
    return stages.sort((a, b) => b.avg - a.avg)[0];
  }
}