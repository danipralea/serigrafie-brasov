import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import NotificationProvider from './components/NotificationProvider';
import PrivateRoute from './components/PrivateRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PlaceOrder from './pages/PlaceOrder';
import Profile from './pages/Profile';
import AcceptInvitation from './pages/AcceptInvitation';
import TeamManagement from './pages/TeamManagement';
import Clients from './pages/Clients';

function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationProvider>
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
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
