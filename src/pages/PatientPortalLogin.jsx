import React, { useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { ShieldCheck, UserCheck, AlertCircle, Loader2 } from "lucide-react";

export default function PatientPortalLogin({ onVerified }) {
  const { token } = useParams();
  const [nationalCode, setNationalCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const baseUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nationalCode.trim()) {
      setError("لطفاً کد ملی خود را وارد نمایید.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await axios.post(`${baseUrl}/portal/${token}/verify`, {
        national_code: nationalCode.trim(),
      });

      if (response.data.status === "success") {
        sessionStorage.setItem(`portal_auth_${token}`, nationalCode.trim());
        if (onVerified) {
          onVerified();
        }
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "کد ملی وارد شده با این پرونده مطابقت ندارد.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans"
      dir="rtl"
    >
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-blue-600 mb-4 shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            پرتال مراجعین درمانگاه
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            جهت مشاهده جواب آزمایش و صورتحساب، کد ملی بیمار را وارد فرمایید.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              کد ملی بیمار
            </label>
            <div className="relative">
              <input
                type="text"
                value={nationalCode}
                onChange={(e) => setNationalCode(e.target.value)}
                placeholder="مثال: 0250698404"
                maxLength={10}
                className="w-full pl-4 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-center tracking-widest text-lg font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                autoFocus
              />
              <UserCheck className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>در حال بررسی هویت...</span>
              </>
            ) : (
              <span>ورود و مشاهده پرونده</span>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center text-xs text-slate-400">
          سامانه امن دسترسی آنلاین به پرونده‌های درمانی و صورتحساب
        </div>
      </div>
    </div>
  );
}
