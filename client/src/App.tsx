import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import NotificationProvider from './components/NotificationProvider';
import ErrorBoundary from './components/ErrorBoundary';
import PrivateRoute from './components/PrivateRoute';

// Eagerly load landing and login pages (first pages users see)
import Landing from './pages/Landing';
import Login from './pages/Login';

// Lazy load other pages for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Calendar = lazy(() => import('./pages/Calendar'));
const PlaceOrder = lazy(() => import('./pages/PlaceOrder'));
const Profile = lazy(() => import('./pages/Profile'));
const AcceptInvitation = lazy(() => import('./pages/AcceptInvitation'));
const TeamManagement = lazy(() => import('./pages/TeamManagement'));
const Clients = lazy(() => import('./pages/Clients'));
const Suppliers = lazy(() => import('./pages/Suppliers'));

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <NotificationProvider>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/accept-invitation/:invitationId" element={<AcceptInvitation />} />
                <Route
                  path="/dashboard"
                  element={
                    <PrivateRoute>
                      <Dashboard />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/calendar"
                  element={
                    <PrivateRoute>
                      <Calendar />
                    </PrivateRoute>
                  }
                />
                <Route path="/place-order" element={<PlaceOrder />} />
                <Route
                  path="/profile"
                  element={
                    <PrivateRoute>
                      <Profile />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/team"
                  element={
                    <PrivateRoute>
                      <TeamManagement />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/clients"
                  element={
                    <PrivateRoute>
                      <Clients />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/suppliers"
                  element={
                    <PrivateRoute>
                      <Suppliers />
                    </PrivateRoute>
                  }
                />
              </Routes>
            </Suspense>
          </NotificationProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
