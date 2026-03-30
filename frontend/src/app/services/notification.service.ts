import { Injectable, computed, inject } from '@angular/core';
import { DataStoreService } from './data-store.service';
import { TranslationService } from './translation.service';

export interface AppNotification {
  id: string;
  type: 'alert' | 'info' | 'system';
  titleKey: string;
  messageKey: string;
  messageParams?: Record<string, any>;
  timestamp: string;
  isRead: boolean;
  link?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private dataStore = inject(DataStoreService);
  private ts = inject(TranslationService);

  // A local set of dismissed notification IDs to allow basic "mark as read" capability.
  // In a real app with no DB, this can live in memory or localStorage.
  private dismissedIds: Set<string> = new Set(JSON.parse(localStorage.getItem('shila_dismissed_notifications') || '[]'));

  public notifications = computed<AppNotification[]>(() => {
    const notifs: AppNotification[] = [];
    const slaConfig = this.dataStore.slaConfig();
    const lcs = this.dataStore.lcs();
    const events = this.dataStore.events();
    // 1. Early Warnings
    lcs.forEach(lc => {
      let maxSla = slaConfig.importSlaMaxMinutes;
      if (lc.transactionType === 'Export') maxSla = slaConfig.exportSlaMaxMinutes;
      if (lc.transactionType === 'Bank Guarantee') maxSla = slaConfig.bgSlaMaxMinutes;
      const warningThreshold = Math.floor(maxSla * 0.75);

      const elapsed = this.getElapsedMinutes(lc);
      if (
        elapsed >= warningThreshold && 
        elapsed <= maxSla && 
        lc.status !== 'Released' && 
        lc.status !== 'Exception' &&
        lc.status !== 'Breached' &&
        lc.status !== 'Breached with Exception'
      ) {
        const id = `warning-${lc.id || lc.urn}-${lc.status}`;
        if (!this.dismissedIds.has(id)) {
          notifs.push({
            id,
            type: 'alert',
            titleKey: 'notif.warning_title',
            messageKey: 'notif.warning_desc',
            messageParams: { urn: lc.urn, mins: elapsed, threshold: maxSla },
            timestamp: new Date().toISOString(), // approximated for dynamic
            isRead: false,
          });
        }
      }
    });

    // 2. New L/Cs (last 24 hours) based on events
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentCreations = events.filter(e => e.action === 'Create Order' || e.action === 'Seed Data');
    
    // Sort descending by time
    const sortedEvents = [...recentCreations].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Show top 3 recent new L/Cs
    sortedEvents.slice(0, 3).forEach(e => {
      const eventTime = new Date(e.timestamp).getTime();
      if (eventTime > oneDayAgo) {
        const id = `new-lc-${e.id || e.urn}`;
        if (!this.dismissedIds.has(id)) {
          notifs.push({
            id,
            type: 'info',
            titleKey: 'notif.new_lc_title',
            messageKey: 'notif.new_lc_desc',
            messageParams: { urn: e.urn },
            timestamp: e.timestamp,
            isRead: false,
          });
        }
      }
    });

    // 3. System Announcement
    const sysId = 'sys-cutoff';
    if (!this.dismissedIds.has(sysId)) {
      notifs.push({
        id: sysId,
        type: 'system',
        titleKey: 'notif.system_title',
        messageKey: 'notif.system_cutoff_desc',
        timestamp: new Date().toISOString(),
        isRead: false,
      });
    }

    // Sort all by timestamp descending
    return notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  });

  public unreadCount = computed(() => this.notifications().filter(n => !n.isRead).length);

  public markAsRead(id: string): void {
    this.dismissedIds.add(id);
    this.saveDismissed();
  }

  public markAllAsRead(): void {
    this.notifications().forEach(n => this.dismissedIds.add(n.id));
    this.saveDismissed();
  }

  private saveDismissed(): void {
    localStorage.setItem('shila_dismissed_notifications', JSON.stringify(Array.from(this.dismissedIds)));
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
