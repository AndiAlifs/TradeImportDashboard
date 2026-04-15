import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataStoreService, MockRole } from '../../services/data-store.service';

@Component({
  selector: 'app-role-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-overlay">
      <div class="login-card">
        <div class="login-brand">
          <img src="logo_mandiri.png" alt="Mandiri Logo" class="login-logo" />
          <div>
            <h1 class="login-title">Shila Dashboard</h1>
            <p class="login-subtitle">Trade Finance Ops</p>
          </div>
        </div>

        <div class="login-divider"></div>

        <h2 class="login-heading">Sign In</h2>
        <p class="login-desc">Select your role and enter the password to continue.</p>

        <div class="login-field">
          <label class="login-label">Role</label>
          <select class="login-select" [(ngModel)]="selectedRole">
            <option *ngFor="let role of dataStore.roleOptions" [value]="role.value">{{ role.label }}</option>
          </select>
        </div>

        <div class="login-field">
          <label class="login-label">Password</label>
          <input
            class="login-input"
            type="password"
            [(ngModel)]="password"
            placeholder="Enter password"
            (keyup.enter)="onSubmit()"
          />
        </div>

        <div class="login-error" *ngIf="errorMsg">{{ errorMsg }}</div>

        <button class="login-btn" (click)="onSubmit()">Sign In</button>
      </div>
    </div>
  `,
  styles: [`
    .login-overlay {
      position: fixed;
      inset: 0;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    }

    .login-card {
      background: #fff;
      border-radius: 16px;
      padding: 2.5rem 2rem;
      width: 100%;
      max-width: 380px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.35);
    }

    .login-brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }

    .login-logo {
      width: 48px;
      height: 48px;
      object-fit: contain;
      background: #f1f5f9;
      border-radius: 8px;
      padding: 4px;
    }

    .login-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }

    .login-subtitle {
      font-size: 0.75rem;
      color: #64748b;
      margin: 0;
    }

    .login-divider {
      height: 1px;
      background: #e2e8f0;
      margin-bottom: 1.25rem;
    }

    .login-heading {
      font-size: 1.35rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 0.25rem;
    }

    .login-desc {
      font-size: 0.8rem;
      color: #64748b;
      margin: 0 0 1.25rem;
    }

    .login-field {
      margin-bottom: 1rem;
    }

    .login-label {
      display: block;
      font-size: 0.8rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 0.35rem;
    }

    .login-select,
    .login-input {
      width: 100%;
      padding: 0.55rem 0.75rem;
      border: 1.5px solid #d1d5db;
      border-radius: 8px;
      font-size: 0.9rem;
      color: #0f172a;
      background: #f8fafc;
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.15s;
    }

    .login-select:focus,
    .login-input:focus {
      border-color: #2563eb;
      background: #fff;
    }

    .login-error {
      font-size: 0.8rem;
      color: #dc2626;
      margin-bottom: 0.75rem;
      padding: 0.5rem 0.75rem;
      background: #fef2f2;
      border-radius: 6px;
      border: 1px solid #fecaca;
    }

    .login-btn {
      width: 100%;
      padding: 0.65rem;
      background: #2563eb;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }

    .login-btn:hover {
      background: #1d4ed8;
    }

    .login-btn:active {
      background: #1e40af;
    }
  `]
})
export class RoleLoginComponent {
  dataStore = inject(DataStoreService);
  private router = inject(Router);

  selectedRole: MockRole = 'super_admin';
  password = '';
  errorMsg = '';

  async onSubmit() {
    this.errorMsg = '';
    const ok = this.dataStore.validateAndLogin(this.selectedRole, this.password);
    if (!ok) {
      this.errorMsg = 'Incorrect password. Please try again.';
      this.password = '';
      return;
    }
    await this.dataStore.refreshData();
    const defaultRoute = this.dataStore.defaultRouteForRole(this.selectedRole);
    this.router.navigateByUrl(defaultRoute);
  }
}
