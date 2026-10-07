import React, { useState, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";

// ۱. لود تنبل (Lazy Loading) تمام صفحات برای کاهش شدید حجم باندل اولیه
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DoctorsManagement = lazy(() => import("./pages/DoctorsManagement"));
const PatientsManagement = lazy(() => import("./pages/PatientsManagement"));
const SecretariesManagement = lazy(
  () => import("@/pages/SecretariesManagement"),
);
const LabResultsManagement = lazy(() => import("./pages/LabResultsManagement"));
const ArchivesManagement = lazy(() => import("./pages/ArchivesManagement"));
const ReportsManagement = lazy(() => import("./pages/ReportsManagement"));
const PatientPortal = lazy(() => import("./pages/PatientPortal"));
const ServicesManagement = lazy(() => import("@/pages/ServicesManagement"));

// اسپینر یا لودینگ ساده و سبک هنگام تغییر صفحات
function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(localStorage.getItem("token")),
  );

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setIsAuthenticated(false);
  };

  return (
    <BrowserRouter>
      {/* تمام روت‌ها داخل Suspense قرار می‌گیرند تا باندل فقط در صورت نیاز لود شود */}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route
            path="/login"
            element={<Login onLoginSuccess={handleLoginSuccess} />}
          />

          {/* داشبورد: در دسترس همه نقش‌های لاگین شده */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* فقط ادمین */}
          <Route
            path="/doctors"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <DoctorsManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/secretaries"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <SecretariesManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/archive"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <ArchivesManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/services"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <ServicesManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <ReportsManagement />
              </ProtectedRoute>
            }
          />

          {/* بیماران: ادمین و هر دو سطح منشی */}
          <Route
            path="/patients"
            element={
              <ProtectedRoute
                allowedRoles={["admin", "staff_level_1", "staff_level_2"]}
              >
                <PatientsManagement />
              </ProtectedRoute>
            }
          />

          {/* جوابدهی: همه می‌بینند */}
          <Route
            path="/results"
            element={
              <ProtectedRoute
                allowedRoles={["admin", "staff_level_1", "staff_level_2"]}
              >
                <LabResultsManagement />
              </ProtectedRoute>
            }
          />

          <Route path="/portal/:token" element={<PatientPortal />} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
