/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { Toast } from './components/Toast';
import { ReceiptModal } from './components/ReceiptModal';
import { DashboardView } from './views/DashboardView';
import { ProductEntryView } from './views/ProductEntryView';
import { SalesBillEntryView } from './views/SalesBillEntryView';
import { CreditBillManagementView } from './views/CreditBillManagementView';
import { DailySalesManagementView } from './views/DailySalesManagementView';
import { ExpenseManagementView } from './views/ExpenseManagementView';
import { PurchaseBillEntryView } from './views/PurchaseBillEntryView';
import { PartyLedgerManagementView } from './views/PartyLedgerManagementView';
import { ReportsProfitView } from './views/ReportsProfitView';
import { LoginView } from './views/LoginView';
import { CouponsView } from './views/CouponsView';

const MainLayout: React.FC = () => {
  const { activeScreen, authSession } = useApp();

  if (!authSession) return <LoginView />;

  const renderActiveScreen = () => {
    switch (activeScreen) {
      case 'dashboard':
        return <DashboardView />;
      case 'product-entry':
        return <ProductEntryView />;
      case 'sales-bill-entry':
        return <SalesBillEntryView />;
      case 'credit-bill-management':
        return <CreditBillManagementView />;
      case 'coupons':
        return <CouponsView />;
      case 'daily-sales-management':
        return <DailySalesManagementView />;
      case 'expense-management':
        return <ExpenseManagementView />;
      case 'purchase-bill-entry':
        return <PurchaseBillEntryView />;
      case 'party-ledger-management':
        return <PartyLedgerManagementView />;
      case 'reports-and-profit-calculation':
        return <ReportsProfitView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-surface font-body-md text-body-md text-on-surface antialiased flex">
      {/* Fixed Sidebar */}
      <Sidebar />

      {/* Main Container Area */}
      <div className="min-w-0 flex-1 flex flex-col pl-[190px]">
        {/* Top Fixed Header */}
        <Header />

        {/* Primary Page Canvas */}
        <main className={`relative min-h-screen bg-[#f8f5f0] px-3 pb-6 pt-[68px] sm:px-3 sm:pb-8 ${activeScreen === 'dashboard' ? 'dashboard-canvas' : ''}`}>
          <div className={`${activeScreen === 'dashboard' ? 'w-full' : 'mx-auto w-full max-w-7xl'}`}>
            {renderActiveScreen()}
          </div>
        </main>
      </div>

      {/* Overlays & Utilities */}
      <GlobalSearchModal />
      <ReceiptModal />
      <Toast />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
