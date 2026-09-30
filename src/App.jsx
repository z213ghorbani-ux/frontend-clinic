  import React, { useState } from "react";
  import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
  import Login from "./pages/LoginTemp";
  import Dashboard from "./pages/Dashboard";
  import ProtectedRoute from "./components/ProtectedRoute";
  import DoctorsManagement from "./pages/DoctorsManagement";
  import PatientsManagement from "./pages/PatientsManagement";
  import SecretariesManagement from "@/pages/SecretariesManagement";
  import LabResultsManagement from "./pages/LabResultsManagement";
  import ArchivesManagement from "./pages/ArchivesManagement";
  import ReportsManagement from "./pages/ReportsManagement";
  import PatientPortal from "./pages/PatientPortal";
  import ServicesManagement from "@/pages/ServicesManagement";

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

          {/* جوابدهی: همه می‌بینند (در سطح ۲ دکمه ثبت نهایی غیرفعال می‌شود) */}
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
      </BrowserRouter>
    );
  }
