import React from "react";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem("token");

  // خواندن امن اطلاعات کاربر
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user") || "null");
  } catch (e) {
    user = null;
  }

  // ۱. اگر توکن نداشت، بفرست به لاگین
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // ۲. اگر برای این صفحه نقش‌های خاصی مجاز شده و نقش کاربر جزء آن‌ها نبود، بفرست به داشبورد
  if (allowedRoles && allowedRoles.length > 0) {
    if (!user || !allowedRoles.includes(user.role)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
}
