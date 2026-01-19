import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { AdminLayout } from './routes/admin/AdminLayout';
import { AdminAnalyticsPage } from './routes/admin/AdminAnalyticsPage';
import { AdminAutomationPage } from './routes/admin/AdminAutomationPage';
import { AdminIndexPage } from './routes/admin/AdminIndexPage';
import { AdminAffiliatePage } from './routes/admin/AdminAffiliatePage';
import { AdminBannersHeroPage } from './routes/admin/AdminBannersHeroPage';
import { AdminDealsPage } from './routes/admin/AdminDealsPage';
import { AdminDependenciesPage } from './routes/admin/AdminDependenciesPage';
import { AdminExitPage } from './routes/admin/AdminExitPage';
import { AdminGovernancePage } from './routes/admin/AdminGovernancePage';
import { AdminHoldPage } from './routes/admin/AdminHoldPage';
import { AdminIntelligencePage } from './routes/admin/AdminIntelligencePage';
import { AdminMonetizationPage } from './routes/admin/AdminMonetizationPage';
import { AdminNetworkPage } from './routes/admin/AdminNetworkPage';
import { AdminPartnersPage } from './routes/admin/AdminPartnersPage';
import { AdminPortfolioPage } from './routes/admin/AdminPortfolioPage';
import { AdminProductsPage } from './routes/admin/AdminProductsPage';
import { AdminRevenuePage } from './routes/admin/AdminRevenuePage';
import { AdminSeoPromotionPage } from './routes/admin/AdminSeoPromotionPage';
import { AdminSignalsPage } from './routes/admin/AdminSignalsPage';
import { AdminSitesPage } from './routes/admin/AdminSitesPage';
import { AdminSystemLogsPage } from './routes/admin/AdminSystemLogsPage';
import { DealsPage } from './routes/DealsPage';
import { AffiliateDisclosurePage } from './routes/AffiliateDisclosurePage';
import { ContactPage } from './routes/ContactPage';
import { HomePage } from './routes/HomePage';
import { NotFoundPage } from './routes/NotFoundPage';
import { PrivacyPage } from './routes/PrivacyPage';
import { ProductsPage } from './routes/ProductsPage';
import { TermsPage } from './routes/TermsPage';
import { PostsPage } from './routes/PostsPage';
import { PostPage } from './routes/PostPage';
import { PostCategoryPage } from './routes/PostCategoryPage';
import { ErrorBoundary } from './components/ErrorBoundary';

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route
          index
          element={
            <ErrorBoundary fallback={<div className="p-6 text-sm text-slate-700">Something went wrong loading the homepage.</div>}>
              <HomePage />
            </ErrorBoundary>
          }
        />
        <Route path="/deals" element={<DealsPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/posts" element={<PostsPage />} />
        <Route path="/posts/category/:category" element={<PostCategoryPage />} />
        <Route path="/posts/:slug" element={<PostPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/affiliate-disclosure" element={<AffiliateDisclosurePage />} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminIndexPage />} />
        {/* Legacy route structure (Option A): restore all prior admin pages/links */}
        <Route path="sites" element={<AdminSitesPage />} />
        <Route path="deals" element={<AdminDealsPage />} />
        <Route path="products" element={<AdminProductsPage />} />

        <Route path="automation" element={<Navigate to="/admin/automation/dashboard" replace />} />
        <Route path="automation/dashboard" element={<AdminAutomationPage />} />

        <Route path="seo-promotion" element={<AdminSeoPromotionPage />} />
        <Route path="affiliate-settings" element={<AdminAffiliatePage />} />
        <Route path="banners-hero" element={<AdminBannersHeroPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="portfolio" element={<AdminPortfolioPage />} />
        <Route path="revenue" element={<AdminRevenuePage />} />
        <Route path="intelligence" element={<AdminIntelligencePage />} />
        <Route path="signals" element={<AdminSignalsPage />} />
        <Route path="monetization" element={<AdminMonetizationPage />} />
        <Route path="governance" element={<AdminGovernancePage />} />
        <Route path="network" element={<AdminNetworkPage />} />
        <Route path="dependencies" element={<AdminDependenciesPage />} />
        <Route path="partners" element={<AdminPartnersPage />} />
        <Route path="hold" element={<AdminHoldPage />} />
        <Route path="exit" element={<AdminExitPage />} />
        <Route path="system-logs" element={<AdminSystemLogsPage />} />
      </Route>
      <Route path="/admin/*" element={<Navigate to="/admin" replace />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

