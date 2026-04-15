import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataStoreService } from '../../services/data-store.service';

interface WarningEntry {
  lcId: string | number;
  urn: string;
  transactionType: string;
  elapsed: number;
  threshold: number; // the % threshold that triggered this (75 or 90)
  thresholdMinutes: number; // absolute minutes of threshold
  maxSlaMinutes: number;
}

const SESSION_KEY = 'shila_early_warned_ids';

@Component({
  selector: 'app-early-warning-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="ew-overlay"
      [class.ew-overlay--visible]="visible()"
      [class.ew-overlay--t2]="currentEntry()?.threshold === (dataStore.slaConfig().warningThreshold2 ?? 90)"
      (click)="dismiss()"
    >
      <div class="ew-card" (click)="$event.stopPropagation()">

        <!-- Animated warning icon -->
        <div class="ew-icon-wrap">
          <div class="ew-ring ew-ring-1"></div>
          <div class="ew-ring ew-ring-2"></div>
          <div class="ew-icon">⚠️</div>
        </div>

        <!-- Header -->
        <div class="ew-header">
          <div class="ew-badge" [class.ew-badge--t2]="currentEntry()?.threshold === (dataStore.slaConfig().warningThreshold2 ?? 90)">
            {{ currentEntry()?.threshold }}% SLA Threshold Reached
          </div>
          <h2 class="ew-title">Early Warning Alert</h2>
        </div>

        <!-- Document info -->
        <div class="ew-info" *ngIf="currentEntry() as entry">
          <div class="ew-urn">{{ entry.urn }}</div>
          <div class="ew-type-badge">{{ entry.transactionType }}</div>

          <div class="ew-metrics">
            <div class="ew-metric">
              <span class="ew-metric-label">Elapsed Time</span>
              <span class="ew-metric-value">{{ entry.elapsed }} min</span>
            </div>
            <div class="ew-metric-divider"></div>
            <div class="ew-metric">
              <span class="ew-metric-label">{{ entry.threshold }}% Threshold</span>
              <span class="ew-metric-value">{{ entry.thresholdMinutes }} min</span>
            </div>
            <div class="ew-metric-divider"></div>
            <div class="ew-metric">
              <span class="ew-metric-label">SLA Limit</span>
              <span class="ew-metric-value">{{ entry.maxSlaMinutes }} min</span>
            </div>
          </div>

          <!-- Progress bar showing elapsed vs SLA -->
          <div class="ew-sla-bar-wrap">
            <div class="ew-sla-bar-label">
              <span>0</span>
              <span>SLA Progress</span>
              <span>{{ entry.maxSlaMinutes }} min</span>
            </div>
            <div class="ew-sla-bar-track">
              <div class="ew-sla-bar-fill" [style.width.%]="getSlaPercent(entry)" [class.ew-sla-bar-fill--warn]="entry.threshold < (dataStore.slaConfig().warningThreshold2 ?? 90)" [class.ew-sla-bar-fill--crit]="entry.threshold >= (dataStore.slaConfig().warningThreshold2 ?? 90)"></div>
              <!-- Threshold markers -->
              <div class="ew-threshold-marker ew-threshold-marker--t1" [style.left.%]="dataStore.slaConfig().warningThreshold1 ?? 75"></div>
              <div class="ew-threshold-marker ew-threshold-marker--t2" [style.left.%]="dataStore.slaConfig().warningThreshold2 ?? 90"></div>
            </div>
          </div>
        </div>

        <!-- Countdown -->
        <div class="ew-countdown">
          <div class="ew-countdown-ring">
            <svg viewBox="0 0 44 44" class="ew-countdown-svg">
              <circle cx="22" cy="22" r="18" class="ew-cd-track"/>
              <circle cx="22" cy="22" r="18" class="ew-cd-fill"
                [style.stroke-dashoffset]="getCountdownDash()"/>
            </svg>
            <span class="ew-countdown-num">{{ countdown() }}</span>
          </div>
          <span class="ew-countdown-label">Auto-dismissing in {{ countdown() }}s</span>
        </div>

        <!-- Dismiss hint -->
        <div class="ew-dismiss-hint" (click)="dismiss()">
          Click anywhere to dismiss
        </div>

        <!-- Queue indicator -->
        <div class="ew-queue" *ngIf="queue().length > 1">
          +{{ queue().length - 1 }} more alert{{ queue().length - 1 > 1 ? 's' : '' }} pending
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* ===== Overlay ===== */
    .ew-overlay {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    .ew-overlay--visible {
      opacity: 1;
      pointer-events: all;
    }

    /* ===== Card ===== */
    .ew-card {
      position: relative;
      background: linear-gradient(145deg, #1a1a2e, #16213e, #0f3460);
      border: 1px solid rgba(245, 158, 11, 0.4);
      border-radius: 24px;
      padding: 2.5rem 3rem;
      max-width: 540px;
      width: 90vw;
      box-shadow:
        0 0 60px rgba(245, 158, 11, 0.25),
        0 25px 50px rgba(0,0,0,0.5),
        inset 0 1px 0 rgba(255,255,255,0.08);
      text-align: center;
      animation: ew-slide-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      overflow: hidden;
    }
    .ew-overlay--t2 .ew-card {
      border-color: rgba(239, 68, 68, 0.5);
      box-shadow:
        0 0 60px rgba(239, 68, 68, 0.3),
        0 25px 50px rgba(0,0,0,0.5),
        inset 0 1px 0 rgba(255,255,255,0.08);
    }

    @keyframes ew-slide-in {
      from { transform: translateY(-30px) scale(0.94); opacity: 0; }
      to   { transform: translateY(0) scale(1);       opacity: 1; }
    }

    /* ===== Animated rings ===== */
    .ew-icon-wrap {
      position: relative;
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ew-ring {
      position: absolute;
      border-radius: 50%;
      border: 2px solid rgba(245,158,11,0.5);
      animation: ew-pulse 2s ease-in-out infinite;
    }
    .ew-overlay--t2 .ew-ring { border-color: rgba(239,68,68,0.5); }
    .ew-ring-1 { width: 80px; height: 80px; animation-delay: 0s; }
    .ew-ring-2 { width: 60px; height: 60px; animation-delay: 0.4s; }
    @keyframes ew-pulse {
      0%,100% { transform: scale(1); opacity: 0.6; }
      50%      { transform: scale(1.2); opacity: 0.1; }
    }
    .ew-icon { font-size: 2.5rem; line-height: 1; animation: ew-icon-bounce 1s ease-in-out infinite; }
    @keyframes ew-icon-bounce {
      0%,100% { transform: translateY(0); }
      50%      { transform: translateY(-4px); }
    }

    /* ===== Header ===== */
    .ew-badge {
      display: inline-block;
      padding: 0.35rem 1rem;
      border-radius: 100px;
      background: rgba(245,158,11,0.2);
      border: 1px solid rgba(245,158,11,0.5);
      color: #fbbf24;
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 0.75rem;
    }
    .ew-badge--t2 {
      background: rgba(239,68,68,0.2);
      border-color: rgba(239,68,68,0.5);
      color: #f87171;
    }
    .ew-title {
      font-size: 1.6rem;
      font-weight: 800;
      color: #fff;
      margin: 0 0 1.5rem;
      letter-spacing: -0.02em;
    }

    /* ===== Document info ===== */
    .ew-urn {
      font-size: 1.4rem;
      font-weight: 700;
      color: #fbbf24;
      letter-spacing: 0.04em;
      margin-bottom: 0.4rem;
    }
    .ew-overlay--t2 .ew-urn { color: #f87171; }
    .ew-type-badge {
      display: inline-block;
      padding: 0.2rem 0.75rem;
      border-radius: 100px;
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.6);
      font-size: 0.78rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    /* ===== Metrics row ===== */
    .ew-metrics {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0;
      margin-bottom: 1.5rem;
      background: rgba(255,255,255,0.04);
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.08);
      overflow: hidden;
    }
    .ew-metric {
      flex: 1;
      padding: 0.9rem 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }
    .ew-metric-divider {
      width: 1px;
      height: 40px;
      background: rgba(255,255,255,0.1);
      flex-shrink: 0;
    }
    .ew-metric-label {
      font-size: 0.72rem;
      color: rgba(255,255,255,0.45);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 600;
    }
    .ew-metric-value {
      font-size: 1.15rem;
      font-weight: 700;
      color: #fff;
    }

    /* ===== SLA progress bar ===== */
    .ew-sla-bar-wrap { margin-bottom: 1.75rem; }
    .ew-sla-bar-label {
      display: flex;
      justify-content: space-between;
      font-size: 0.72rem;
      color: rgba(255,255,255,0.4);
      margin-bottom: 0.4rem;
    }
    .ew-sla-bar-track {
      position: relative;
      height: 10px;
      background: rgba(255,255,255,0.08);
      border-radius: 100px;
      overflow: visible;
    }
    .ew-sla-bar-fill {
      height: 100%;
      border-radius: 100px;
      transition: width 0.6s ease;
    }
    .ew-sla-bar-fill--warn { background: linear-gradient(90deg, #10b981, #f59e0b); }
    .ew-sla-bar-fill--crit { background: linear-gradient(90deg, #f59e0b, #ef4444); }
    .ew-threshold-marker {
      position: absolute;
      top: -4px;
      width: 2px;
      height: 18px;
      border-radius: 2px;
      transform: translateX(-50%);
    }
    .ew-threshold-marker--t1 { background: #f59e0b; }
    .ew-threshold-marker--t2 { background: #ef4444; }

    /* ===== Countdown ring ===== */
    .ew-countdown {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .ew-countdown-ring {
      position: relative;
      width: 44px;
      height: 44px;
      flex-shrink: 0;
    }
    .ew-countdown-svg { width: 44px; height: 44px; transform: rotate(-90deg); }
    .ew-cd-track {
      fill: none;
      stroke: rgba(255,255,255,0.1);
      stroke-width: 3;
    }
    .ew-cd-fill {
      fill: none;
      stroke: #fbbf24;
      stroke-width: 3;
      stroke-linecap: round;
      stroke-dasharray: 113.1;
      transition: stroke-dashoffset 1s linear;
    }
    .ew-overlay--t2 .ew-cd-fill { stroke: #f87171; }
    .ew-countdown-num {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      font-weight: 700;
      color: #fff;
    }
    .ew-countdown-label {
      font-size: 0.85rem;
      color: rgba(255,255,255,0.5);
    }

    /* ===== Dismiss hint ===== */
    .ew-dismiss-hint {
      font-size: 0.78rem;
      color: rgba(255,255,255,0.3);
      cursor: pointer;
      margin-bottom: 0.5rem;
      transition: color 0.2s;
    }
    .ew-dismiss-hint:hover { color: rgba(255,255,255,0.6); }

    /* ===== Queue ===== */
    .ew-queue {
      font-size: 0.78rem;
      color: rgba(255,255,255,0.35);
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      padding: 0.4rem 0.75rem;
      display: inline-block;
      margin-top: 0.25rem;
    }
  `]
})
export class EarlyWarningModalComponent implements OnInit, OnDestroy {
  dataStore = inject(DataStoreService);

  visible = signal(false);
  countdown = signal(30);
  queue = signal<WarningEntry[]>([]);
  currentEntry = signal<WarningEntry | null>(null);

  // session-level tracking of already-shown (lcId + thresholdPct) keys
  private shownKeys = new Set<string>(
    JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]')
  );

  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private autoDismissTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // React to LC data / SLA config changes
    effect(() => {
      const lcs = this.dataStore.lcs();
      const sla = this.dataStore.slaConfig();
      this.checkLcsForWarnings(lcs, sla);
    });
  }

  ngOnInit() {}

  ngOnDestroy() {
    this.clearTimers();
  }

  private checkLcsForWarnings(lcs: any[], sla: any): void {
    const t1 = sla.warningThreshold1 ?? 75;
    const t2 = sla.warningThreshold2 ?? 90;
    const thresholds = [t1, t2].sort((a, b) => a - b);

    const skipStatuses = new Set(['Released', 'Exception', 'Breached', 'Breached with Exception']);
    const newEntries: WarningEntry[] = [];

    for (const lc of lcs) {
      if (skipStatuses.has(lc.status)) continue;

      let maxSla = sla.importSlaMaxMinutes ?? 120;
      if (lc.transactionType === 'Export') maxSla = sla.exportSlaMaxMinutes ?? 120;
      if (lc.transactionType === 'Bank Guarantee') maxSla = sla.bgSlaMaxMinutes ?? 120;

      const elapsed = this.getElapsedMinutes(lc);

      for (const pct of thresholds) {
        const thresholdMinutes = Math.floor(maxSla * pct / 100);
        const key = `${lc.id ?? lc.urn}-${pct}`;

        if (elapsed >= thresholdMinutes && !this.shownKeys.has(key)) {
          this.shownKeys.add(key);
          newEntries.push({
            lcId: lc.id ?? lc.urn,
            urn: lc.urn,
            transactionType: lc.transactionType,
            elapsed,
            threshold: pct,
            thresholdMinutes,
            maxSlaMinutes: maxSla,
          });
        }
      }
    }

    this.persistShownKeys();

    if (newEntries.length === 0) return;

    // Queue new entries
    this.queue.update(q => {
      // Deduplicate by key
      const existing = new Set(q.map(e => `${e.lcId}-${e.threshold}`));
      const filtered = newEntries.filter(e => !existing.has(`${e.lcId}-${e.threshold}`));
      return [...q, ...filtered];
    });

    // If nothing showing, start the show
    if (!this.visible()) {
      this.showNext();
    }
  }

  private showNext(): void {
    const q = this.queue();
    if (q.length === 0) {
      this.visible.set(false);
      this.currentEntry.set(null);
      return;
    }

    const [next, ...rest] = q;
    this.queue.set(rest);
    this.currentEntry.set(next);
    this.countdown.set(30);
    this.visible.set(true);

    this.clearTimers();

    // Countdown tick every second
    this.countdownTimer = setInterval(() => {
      this.countdown.update(c => {
        if (c <= 1) {
          this.dismiss();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  dismiss(): void {
    this.clearTimers();
    this.visible.set(false);

    // Small delay before showing next in queue
    setTimeout(() => this.showNext(), 350);
  }

  getSlaPercent(entry: WarningEntry): number {
    return Math.min(100, Math.round((entry.elapsed / entry.maxSlaMinutes) * 100));
  }

  getCountdownDash(): number {
    const circumference = 113.1; // 2 * pi * 18
    const fraction = this.countdown() / 30;
    return circumference * (1 - fraction);
  }

  private clearTimers(): void {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.autoDismissTimer !== null) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }
  }

  private persistShownKeys(): void {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...this.shownKeys]));
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
