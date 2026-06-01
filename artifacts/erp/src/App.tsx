import React from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import Layout from "@/components/Layout";

import Login from "@/pages/Login";
import TechLogin from "@/pages/TechLogin";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";

import InvoiceList from "@/pages/sales/InvoiceList";
import InvoiceCreate from "@/pages/sales/InvoiceCreate";
import CreditNoteList from "@/pages/sales/CreditNoteList";
import CreditNoteCreate from "@/pages/sales/CreditNoteCreate";

import BillList from "@/pages/purchases/BillList";
import BillCreate from "@/pages/purchases/BillCreate";
import DebitNoteList from "@/pages/purchases/DebitNoteList";
import DebitNoteCreate from "@/pages/purchases/DebitNoteCreate";

import VoucherView from "@/pages/VoucherView";
import VoucherEditPage from "@/pages/VoucherEditPage";
import PaymentsList from "@/pages/payments/PaymentsList";
import PaymentCreate from "@/pages/payments/PaymentCreate";
import PaymentEdit from "@/pages/payments/PaymentEdit";
import Outstanding from "@/pages/payments/Outstanding";

import Inventory from "@/pages/Inventory";
import ItemLedger from "@/pages/ItemLedger";

import PartyLedger from "@/pages/accounting/PartyLedger";
import TrialBalance from "@/pages/accounting/TrialBalance";
import Receivables from "@/pages/accounting/Receivables";
import Payables from "@/pages/accounting/Payables";

import GSTR1 from "@/pages/gst/GSTR1";
import GSTR3B from "@/pages/gst/GSTR3B";

import Parties from "@/pages/masters/Parties";
import Items from "@/pages/masters/Items";
import Units from "@/pages/masters/Units";
import HsnCodes from "@/pages/masters/HsnCodes";
import TaxRates from "@/pages/masters/TaxRates";
import States from "@/pages/masters/States";

import BusinessSettings from "@/pages/settings/BusinessSettings";
import Subscription from "@/pages/settings/Subscription";
import Users from "@/pages/settings/Users";
import ImportData from "@/pages/settings/ImportData";
import BackupSettings from "@/pages/settings/BackupSettings";
import FirmProfile from "@/pages/FirmProfile";
import OfflineDrafts from "@/pages/OfflineDrafts";
import VoucherBin from "@/pages/VoucherBin";

import CashBankDashboard from "@/pages/cash-bank/CashBankDashboard";
import CashBankAccounts from "@/pages/cash-bank/CashBankAccounts";
import ExpenseHeads from "@/pages/cash-bank/ExpenseHeads";
import ExpenseList from "@/pages/cash-bank/ExpenseList";
import ExpenseCreate from "@/pages/cash-bank/ExpenseCreate";
import ExpenseEdit from "@/pages/cash-bank/ExpenseEdit";
import ContraEntry from "@/pages/cash-bank/ContraEntry";
import AccountStatement from "@/pages/cash-bank/AccountStatement";

import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminBusinesses from "@/pages/admin/AdminBusinesses";
import AdminPlans from "@/pages/admin/AdminPlans";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminSuperAdmins from "@/pages/admin/AdminSuperAdmins";
import AdminVouchers from "@/pages/admin/AdminVouchers";
import AdminBuyers from "@/pages/admin/AdminBuyers";
import AdminActivity from "@/pages/admin/AdminActivity";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminImport from "@/pages/admin/AdminImport";
import AdminSupportMessages from "@/pages/admin/AdminSupportMessages";
import ReportTemplatesList from "@/pages/report-templates/ReportTemplatesList";
import ReportPreview from "@/pages/report-templates/ReportPreview";
import ReportDesigner from "@/pages/report-templates/ReportDesigner";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5 * 60 * 1000 } },
});

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string; stack: string; showDetail: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "", stack: "", showDetail: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message, stack: error.stack || "" };
  }
  render() {
    if (this.state.hasError) {
      const { error, stack, showDetail } = this.state;
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <h2 className="text-lg font-bold text-gray-800">Kuch galat ho gaya</h2>
            <p className="text-sm text-red-600 font-medium break-words">{error}</p>
            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Refresh Karo
              </button>
              <button
                onClick={() => this.setState(s => ({ showDetail: !s.showDetail }))}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                {showDetail ? "Hide" : "Error Detail"}
              </button>
            </div>
            {showDetail && (
              <pre className="text-left text-xs bg-gray-900 text-green-400 p-3 rounded-xl overflow-auto max-h-48 whitespace-pre-wrap break-all">
                {stack || error}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Redirect to={isTechDomain() ? "/tech-login" : "/login"} />;
  return <Layout><ErrorBoundary>{children}</ErrorBoundary></Layout>;
}

const isTechDomain = () => window.location.hostname === "erpa.naewtgroup.com";

function AppRoutes() {
  const { user, isSuperAdmin } = useAuth();

  return (
    <Switch>
      <Route path="/login">
        {isTechDomain() ? <Redirect to="/tech-login" /> : <Login />}
      </Route>
      <Route path="/tech-login" component={TechLogin} />
      <Route path="/register" component={Register} />

      <Route path="/">
        <ProtectedRoute>
          {isSuperAdmin() ? <AdminDashboard /> : <Dashboard />}
        </ProtectedRoute>
      </Route>

      {/* Sales */}
      <Route path="/sales/invoices">
        <ProtectedRoute><InvoiceList /></ProtectedRoute>
      </Route>
      <Route path="/sales/invoices/new">
        <ProtectedRoute><InvoiceCreate /></ProtectedRoute>
      </Route>
      <Route path="/sales/invoices/:id/edit">
        {() => <ProtectedRoute><VoucherEditPage voucherType="sales/invoices" title="Sales Invoice" listHref="/sales/invoices" /></ProtectedRoute>}
      </Route>
      <Route path="/sales/invoices/:id">
        {() => <ProtectedRoute><VoucherView voucherType="sales/invoices" listHref="/sales/invoices" /></ProtectedRoute>}
      </Route>
      <Route path="/sales/credit-notes">
        <ProtectedRoute><CreditNoteList /></ProtectedRoute>
      </Route>
      <Route path="/sales/credit-notes/new">
        <ProtectedRoute><CreditNoteCreate /></ProtectedRoute>
      </Route>
      <Route path="/sales/credit-notes/:id/edit">
        {() => <ProtectedRoute><VoucherEditPage voucherType="sales/credit-notes" title="Credit Note" listHref="/sales/credit-notes" /></ProtectedRoute>}
      </Route>
      <Route path="/sales/credit-notes/:id">
        {() => <ProtectedRoute><VoucherView voucherType="sales/credit-notes" listHref="/sales/credit-notes" /></ProtectedRoute>}
      </Route>

      {/* Purchases */}
      <Route path="/purchases/bills">
        <ProtectedRoute><BillList /></ProtectedRoute>
      </Route>
      <Route path="/purchases/bills/new">
        <ProtectedRoute><BillCreate /></ProtectedRoute>
      </Route>
      <Route path="/purchases/bills/:id/edit">
        {() => <ProtectedRoute><VoucherEditPage voucherType="purchases/bills" title="Purchase Bill" listHref="/purchases/bills" /></ProtectedRoute>}
      </Route>
      <Route path="/purchases/bills/:id">
        {() => <ProtectedRoute><VoucherView voucherType="purchases/bills" listHref="/purchases/bills" /></ProtectedRoute>}
      </Route>
      <Route path="/purchases/debit-notes">
        <ProtectedRoute><DebitNoteList /></ProtectedRoute>
      </Route>
      <Route path="/purchases/debit-notes/new">
        <ProtectedRoute><DebitNoteCreate /></ProtectedRoute>
      </Route>
      <Route path="/purchases/debit-notes/:id/edit">
        {() => <ProtectedRoute><VoucherEditPage voucherType="purchases/debit-notes" title="Debit Note" listHref="/purchases/debit-notes" /></ProtectedRoute>}
      </Route>
      <Route path="/purchases/debit-notes/:id">
        {() => <ProtectedRoute><VoucherView voucherType="purchases/debit-notes" listHref="/purchases/debit-notes" /></ProtectedRoute>}
      </Route>

      {/* Payments */}
      <Route path="/payments/receipts">
        <ProtectedRoute><PaymentsList type="receipt" /></ProtectedRoute>
      </Route>
      <Route path="/payments/receipts/new">
        <ProtectedRoute><PaymentCreate type="receipt" /></ProtectedRoute>
      </Route>
      <Route path="/payments/receipts/:id/edit">
        {() => <ProtectedRoute><PaymentEdit type="receipt" /></ProtectedRoute>}
      </Route>
      <Route path="/payments/payments">
        <ProtectedRoute><PaymentsList type="payment" /></ProtectedRoute>
      </Route>
      <Route path="/payments/payments/new">
        <ProtectedRoute><PaymentCreate type="payment" /></ProtectedRoute>
      </Route>
      <Route path="/payments/payments/:id/edit">
        {() => <ProtectedRoute><PaymentEdit type="payment" /></ProtectedRoute>}
      </Route>
      <Route path="/payments/outstanding">
        <ProtectedRoute><Outstanding /></ProtectedRoute>
      </Route>

      {/* Inventory */}
      <Route path="/inventory">
        <ProtectedRoute><Inventory /></ProtectedRoute>
      </Route>
      <Route path="/inventory/:id">
        {() => <ProtectedRoute><ItemLedger /></ProtectedRoute>}
      </Route>

      {/* Accounting */}
      <Route path="/accounting/ledger">
        <ProtectedRoute><PartyLedger /></ProtectedRoute>
      </Route>
      <Route path="/accounting/trial-balance">
        <ProtectedRoute><TrialBalance /></ProtectedRoute>
      </Route>
      <Route path="/accounting/receivables">
        <ProtectedRoute><Receivables /></ProtectedRoute>
      </Route>
      <Route path="/accounting/payables">
        <ProtectedRoute><Payables /></ProtectedRoute>
      </Route>

      {/* GST */}
      <Route path="/gst/gstr1">
        <ProtectedRoute><GSTR1 /></ProtectedRoute>
      </Route>
      <Route path="/gst/gstr3b">
        <ProtectedRoute><GSTR3B /></ProtectedRoute>
      </Route>

      {/* Masters */}
      <Route path="/masters/customers">
        <ProtectedRoute><Parties defaultType="customer" /></ProtectedRoute>
      </Route>
      <Route path="/masters/suppliers">
        <ProtectedRoute><Parties defaultType="supplier" /></ProtectedRoute>
      </Route>
      <Route path="/masters/parties">
        <ProtectedRoute><Parties /></ProtectedRoute>
      </Route>
      <Route path="/masters/items">
        <ProtectedRoute><Items /></ProtectedRoute>
      </Route>
      <Route path="/masters/units">
        <ProtectedRoute><Units /></ProtectedRoute>
      </Route>
      <Route path="/masters/hsn">
        <ProtectedRoute><HsnCodes /></ProtectedRoute>
      </Route>
      <Route path="/masters/states">
        <ProtectedRoute><States /></ProtectedRoute>
      </Route>
      <Route path="/masters/tax-rates">
        <ProtectedRoute><TaxRates /></ProtectedRoute>
      </Route>

      {/* Cash & Bank */}
      <Route path="/cash-bank">
        <ProtectedRoute><CashBankDashboard /></ProtectedRoute>
      </Route>
      <Route path="/cash-bank/accounts">
        <ProtectedRoute><CashBankAccounts /></ProtectedRoute>
      </Route>
      <Route path="/cash-bank/expense-heads">
        <ProtectedRoute><ExpenseHeads /></ProtectedRoute>
      </Route>
      <Route path="/cash-bank/expenses">
        <ProtectedRoute><ExpenseList /></ProtectedRoute>
      </Route>
      <Route path="/cash-bank/expenses/new">
        <ProtectedRoute><ExpenseCreate /></ProtectedRoute>
      </Route>
      <Route path="/cash-bank/expenses/:id/edit">
        <ProtectedRoute><ExpenseEdit /></ProtectedRoute>
      </Route>
      <Route path="/cash-bank/contra">
        <ProtectedRoute><ContraEntry /></ProtectedRoute>
      </Route>
      <Route path="/cash-bank/statement">
        <ProtectedRoute><AccountStatement /></ProtectedRoute>
      </Route>

      {/* Profile & Offline Drafts */}
      <Route path="/profile">
        <ProtectedRoute><FirmProfile /></ProtectedRoute>
      </Route>
      <Route path="/offline-drafts">
        <ProtectedRoute><OfflineDrafts /></ProtectedRoute>
      </Route>
      <Route path="/vouchers/bin">
        <ProtectedRoute><VoucherBin /></ProtectedRoute>
      </Route>

      {/* Settings */}
      <Route path="/settings/business">
        <ProtectedRoute><BusinessSettings /></ProtectedRoute>
      </Route>
      <Route path="/settings/subscription">
        <ProtectedRoute><Subscription /></ProtectedRoute>
      </Route>
      <Route path="/settings/users">
        <ProtectedRoute><Users /></ProtectedRoute>
      </Route>
      <Route path="/settings/import">
        <ProtectedRoute><ImportData /></ProtectedRoute>
      </Route>
      <Route path="/settings/backup">
        <ProtectedRoute><BackupSettings /></ProtectedRoute>
      </Route>

      {/* Super Admin / Tech Support */}
      <Route path="/admin/businesses">
        <ProtectedRoute><AdminBusinesses /></ProtectedRoute>
      </Route>
      <Route path="/admin/plans">
        <ProtectedRoute><AdminPlans /></ProtectedRoute>
      </Route>
      <Route path="/admin/super-admins">
        <ProtectedRoute><AdminSuperAdmins /></ProtectedRoute>
      </Route>
      <Route path="/admin/settings">
        <ProtectedRoute><AdminSettings /></ProtectedRoute>
      </Route>
      <Route path="/admin/vouchers">
        <ProtectedRoute><AdminVouchers /></ProtectedRoute>
      </Route>
      <Route path="/admin/buyers">
        <ProtectedRoute><AdminBuyers /></ProtectedRoute>
      </Route>
      <Route path="/admin/activity">
        <ProtectedRoute><AdminActivity /></ProtectedRoute>
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute><AdminUsers /></ProtectedRoute>
      </Route>
      <Route path="/admin/import">
        <ProtectedRoute><AdminImport /></ProtectedRoute>
      </Route>
      <Route path="/admin/support-messages">
        <ProtectedRoute><AdminSupportMessages /></ProtectedRoute>
      </Route>

      {/* Report Templates */}
      <Route path="/report-templates">
        <ProtectedRoute><ReportTemplatesList /></ProtectedRoute>
      </Route>
      <Route path="/report-templates/new">
        <ProtectedRoute><ReportDesigner /></ProtectedRoute>
      </Route>
      <Route path="/report-templates/:id/edit">
        <ProtectedRoute><ReportDesigner /></ProtectedRoute>
      </Route>
      <Route path="/report-templates/:id/preview">
        <ProtectedRoute><ReportPreview /></ProtectedRoute>
      </Route>

      <Route>
        <ProtectedRoute>
          <div className="flex items-center justify-center h-64 text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-3">404</div>
              <div className="font-medium">Page not found</div>
            </div>
          </div>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppRoutes />
            </WouterRouter>
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
