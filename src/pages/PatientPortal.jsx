import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import {
  FileText,
  Download,
  Eye,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCheck,
  User,
  Receipt,
  LogOut,
} from "lucide-react";
import PatientPortalLogin from "./PatientPortalLogin";

export default function PatientPortal() {
  const { token } = useParams();

  // بررسی وضعیت احراز هویت بیمار برای توکن فعلی
  const [isVerified, setIsVerified] = useState(
    Boolean(sessionStorage.getItem(`portal_auth_${token}`)),
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const baseUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

  useEffect(() => {
    if (isVerified && token) {
      fetchPortalData();
    }
  }, [token, isVerified]);

  const fetchPortalData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${baseUrl}/portal/${token}`);

      if (response.data?.data) {
        setData(response.data.data);
      } else {
        setError("اطلاعات جوابدهی یافت نشد.");
      }
    } catch (err) {
      console.error("Portal error:", err);
      if (err.response?.status === 404) {
        setError("پرونده مورد نظر یافت نشد یا لینک دسترسی منقضی شده است.");
      } else {
        setError(
          "خطا در دریافت اطلاعات. لطفاً اتصال اینترنت خود را بررسی کنید.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(`portal_auth_${token}`);
    setIsVerified(false);
    setData(null);
  };

  const toJalaliDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      return new Intl.DateTimeFormat("fa-IR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  // دانلود مستقیم فاکتور رسمی سامانه
  const handleDownloadInvoice = () => {
    window.open(`${baseUrl}/portal/${token}/invoice-pdf`, "_blank");
  };

  // اگر بیمار هنوز کد ملی را وارد نکرده، صفحه لاگین بیمار نمایش داده می‌شود
  if (!isVerified) {
    return <PatientPortalLogin onVerified={() => setIsVerified(true)} />;
  }

  if (loading) {
    return (
      <div
        className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4"
        dir="rtl"
      >
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
        <p className="text-slate-600 font-medium">
          در حال دریافت اسناد و پرونده پزشکی...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-screen bg-slate-50 flex items-center justify-center p-4"
        dir="rtl"
      >
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">عدم دسترسی</h2>
          <p className="text-slate-600 text-sm mb-6 leading-relaxed">{error}</p>
          <div className="space-y-2">
            <button
              onClick={fetchPortalData}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-medium transition"
            >
              تلاش مجدد
            </button>
            <button
              onClick={handleLogout}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition"
            >
              ورود با کد ملی دیگر
            </button>
          </div>
        </div>
      </div>
    );
  }

  const attachments = data?.attachments || [];

  return (
    <div
      className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8"
      dir="rtl"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* هدر پرتال */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-100 text-sm font-medium mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                <span>پرتال مراجعین و خدمات آنلاین</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                اسناد، فاکتور و نتایج آزمایش
              </h1>
              <p className="text-emerald-100/90 text-sm mt-1">
                مجموعه درمانی و کلینیک تخصصی
              </p>
            </div>

            <button
              onClick={handleLogout}
              title="خروج از پرونده"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-xl backdrop-blur-sm transition border border-white/20"
            >
              <LogOut className="w-4 h-4" />
              <span>خروج</span>
            </button>
          </div>
        </div>

        {/* مشخصات بیمار */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <User className="w-5 h-5 text-emerald-600" />
            مشخصات پرونده
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50/70 p-3.5 rounded-xl">
              <span className="text-xs text-slate-500 block mb-1">
                نام و نام خانوادگی
              </span>
              <span className="text-sm font-bold text-slate-800">
                {data?.patient_name || "-"}
              </span>
            </div>
            <div className="bg-slate-50/70 p-3.5 rounded-xl">
              <span className="text-xs text-slate-500 block mb-1">کد ملی</span>
              <span className="text-sm font-bold text-slate-800 font-mono">
                {data?.national_code || "-"}
              </span>
            </div>
            <div className="bg-slate-50/70 p-3.5 rounded-xl">
              <span className="text-xs text-slate-500 block mb-1">
                تاریخ و ساعت صدور
              </span>
              <span className="text-xs font-semibold text-slate-700">
                {toJalaliDate(data?.issued_at)}
              </span>
            </div>
          </div>
        </div>

        {/* لیست فایل‌ها و اسناد */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <FileCheck className="w-5 h-5 text-emerald-600" />
            فایل‌ها و صورتحساب ممهور
          </h2>

          <div className="space-y-3">
            {/* ۱. کارت صورتحساب رسمی کلینیک */}
            <div className="flex items-center justify-between p-4 bg-emerald-50/50 hover:bg-emerald-50 rounded-2xl border border-emerald-200/70 transition">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-sm">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-emerald-950">
                    صورتحساب و فاکتور رسمی خدمات (PDF)
                  </div>
                  <div className="text-xs text-emerald-700 mt-0.5">
                    شامل ریز مبالغ، خدمات انجام‌شده و مهر الکترونیکی
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadInvoice}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                >
                  <Download className="w-4 h-4" />
                  <span>دریافت فاکتور</span>
                </button>
              </div>
            </div>

            {/* ۲. سایر فایل‌های پیوست و نتایج */}
            {attachments.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/60 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800">
                      {file.original_name}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {file.size
                        ? `${(file.size / 1024).toFixed(1)} کیلوبایت`
                        : "فایل پیوست پرونده"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {file.url && (
                    <>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-slate-600 hover:text-emerald-600 hover:bg-white rounded-lg transition"
                        title="مشاهده آنلاین"
                      >
                        <Eye className="w-5 h-5" />
                      </a>
                      <a
                        href={file.url}
                        download={file.original_name}
                        className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                      >
                        <Download className="w-4 h-4" />
                        <span>دانلود</span>
                      </a>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* فوتر */}
        <div className="text-center text-xs text-slate-400 py-4">
          این برگه و فاکتور به صورت الکترونیکی صادر شده و دارای اعتبار قانونی و
          پزشکی است.
        </div>
      </div>
    </div>
  );
}
