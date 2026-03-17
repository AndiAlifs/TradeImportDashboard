import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { TopbarComponent } from './components/topbar/topbar.component';
import { DataStoreService } from './services/data-store.service';
import { TranslatePipe } from './pipes/translate.pipe';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, TopbarComponent, TranslatePipe],
  template: `
    <app-sidebar></app-sidebar>
    <div class="sidebar-overlay" id="sidebar-overlay" (click)="closeSidebar()"></div>

    <main class="main-content" style="display: flex; flex-direction: column;">
      <app-topbar></app-topbar>
      <div class="view active" style="overflow-y: auto; flex: 1; display: block; position: relative;">
        <router-outlet></router-outlet>
      </div>
    </main>

    <div id="toast-container"></div>
  `,
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  dataStore = inject(DataStoreService);

  ngOnInit() {
    this.dataStore.refreshData().then(() => {
      if (!this.dataStore.isBackendOnline()) {
        this.showToast('info', 'Backend not reachable. Showing cached data.');
      }
    });
  }

  closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('active');
  }

  showToast(type: 'success' | 'info', message: string): void {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <div class="toast-icon">${type === 'success' ? 'OK' : 'i'}</div>
    <span>${message}</span>
  `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}
