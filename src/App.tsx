
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Pages
import { Auth } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { CreateAuction } from "./pages/CreateAuction";
import { ManageAuction } from "./pages/ManageAuction";
import { MonitorAuction } from "./pages/MonitorAuction";
import { CollectionDetail } from "./pages/CollectionDetail";
import { BidderForm } from "./pages/BidderForm";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/auction/:slug/bid" element={<BidderForm />} />
            
            {/* Protected Routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/create-auction" element={
              <ProtectedRoute>
                <CreateAuction />
              </ProtectedRoute>
            } />
            <Route path="/auction/:slug/manage" element={
              <ProtectedRoute>
                <ManageAuction />
              </ProtectedRoute>
            } />
            <Route path="/auction/:slug/monitor" element={
              <ProtectedRoute>
                <MonitorAuction />
              </ProtectedRoute>
            } />
            <Route path="/auction/:slug/collection/:collectionId" element={
              <ProtectedRoute>
                <CollectionDetail />
              </ProtectedRoute>
            } />
            
            {/* Redirects */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
