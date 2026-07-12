import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import EmployeeDashboard from './pages/EmployeeDashboard';
import AdminDashboard from './pages/AdminDashboard';
import DatabaseStudio from './pages/DatabaseStudio';
import BucketStudio from './pages/BucketStudio';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';
import './App.css';

// Simple check for auth token
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('sso_token');
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
      <ConfirmProvider>
      <Router>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            
            <Route path="/dashboard" element={
              <PrivateRoute>
                <EmployeeDashboard />
              </PrivateRoute>
            } />
            
            <Route path="/admin" element={
              <PrivateRoute>
                <AdminDashboard />
              </PrivateRoute>
            } />
            
            <Route path="/studio/:id" element={
              <PrivateRoute>
                <DatabaseStudio />
              </PrivateRoute>
            } />

            <Route path="/bucket-studio/:id" element={
              <PrivateRoute>
                <BucketStudio />
              </PrivateRoute>
            } />

            <Route path="/" element={<Navigate to="/dashboard" />} />
          </Routes>
        </div>
      </Router>
      </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
