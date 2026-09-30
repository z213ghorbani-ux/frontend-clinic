import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  UserCheck,
  FolderArchive,
  BarChart3,
  UserPlus,
  FileText,
  LogOut,
  Clock,
  Calendar,
  ChevronLeft,
  Lock,
  Layers,
} from "lucide-react";

export default function Dashboard({ onLogout }) {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [accessDeniedMsg, setAccessDeniedMsg] = useState("");

  const user = JSON.parse(
    localStorage.getItem("user") || '{"name": "کاربر سیستم", "role": "admin"}',
  );

  const isAdmin = user.role === "admin";
  const isSecretary2 = user.role === "staff_level_2";

  const getRoleTitle = (role) => {
    switch (role) {
      case "admin":
        return "مدیر سیستم";
      case "staff_level_1":
        return "منشی (سطح یک)";
      case "staff_level_2":
        return "منشی (سطح دو)";
      default:
        return role || "کاربر سیستم";
    }
  };

  const handleAdminOnlyClick = (path, title) => {
    if (isAdmin) {
      navigate(path);
    } else {
      setAccessDeniedMsg(
        `شما به بخش «${title}» دسترسی ندارید. این بخش فقط برای مدیر سیستم تعریف شده است.`,
      );
      setTimeout(() => setAccessDeniedMsg(""), 4000);
    }
  };

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const timeStr = new Intl.DateTimeFormat("fa-IR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(now);

      const dateStr = new Intl.DateTimeFormat("fa-IR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(now);

      setCurrentTime(timeStr);
      setCurrentDate(dateStr);
    };

    updateDateTime();
    const timer = setInterval(updateDateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    if (onLogout) onLogout();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div
      className="min-h-screen bg-slate-50/60 text-slate-800 antialiased font-['Vazirmatn']"
      dir="rtl"
    >
      {/* پیام هشدار عدم دسترسی شناور */}
      {accessDeniedMsg && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-bounce">
          <Lock className="w-5 h-5 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">
            {accessDeniedMsg}
          </span>
        </div>
      )}

      {/* هدر بالای صفحه */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-semibold text-sm">
              {user.name ? user.name[0] : "U"}
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {user.name}
              </div>
              <div className="text-xs text-slate-400 font-normal">
                {getRoleTitle(user.role)}
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4 bg-slate-100/70 border border-slate-200/60 px-4 py-1.5 rounded-full text-xs text-slate-600 font-medium">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{currentDate}</span>
            </div>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-700">
                {currentTime}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>خروج</span>
          </button>
        </div>
      </header>

      {/* محتوای اصلی */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-9">
        {/* مدیریت سیستم */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4 bg-indigo-600 rounded-full"></span>
              <h2 className="text-sm font-bold text-slate-800">مدیریت سیستم</h2>
            </div>
            {!isAdmin && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-full flex items-center gap-1">
                <Lock className="w-3 h-3" />
                دسترسی مدیر لازم است
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* پزشکان */}
            <div
              onClick={() => handleAdminOnlyClick("/doctors", "مدیریت پزشکان")}
              className={`group bg-white p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                isAdmin
                  ? "border-slate-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/10"
                  : "border-slate-200/70 opacity-80"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                {!isAdmin ? (
                  <Lock className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">
                  مدیریت پزشکان
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-1">
                  مشاهده، ویرایش و ثبت پزشکان
                </p>
              </div>
            </div>

            {/* منشی‌ها */}
            <div
              onClick={() =>
                handleAdminOnlyClick("/secretaries", "مدیریت منشی‌ها")
              }
              className={`group bg-white p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                isAdmin
                  ? "border-slate-100 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/10"
                  : "border-slate-200/70 opacity-80"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                {!isAdmin ? (
                  <Lock className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-blue-500" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">
                  مدیریت منشی‌ها
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-1">
                  کنترل دسترسی‌ها و پرسنل پذیرش
                </p>
              </div>
            </div>

            {/* خدمات و تعرفه‌ها */}
            <div
              onClick={() =>
                handleAdminOnlyClick("/services", "مدیریت خدمات و تعرفه‌ها")
              }
              className={`group bg-white p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                isAdmin
                  ? "border-slate-100 hover:border-cyan-200 hover:shadow-lg hover:shadow-cyan-500/10"
                  : "border-slate-200/70 opacity-80"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                {!isAdmin ? (
                  <Lock className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-cyan-500" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">
                  خدمات و تعرفه‌ها
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-1">
                  تعریف اقلام، قیمت‌ها و کدینگ
                </p>
              </div>
            </div>

            {/* بایگانی و سوابق */}
            <div
              onClick={() =>
                handleAdminOnlyClick("/archive", "بایگانی و سوابق")
              }
              className={`group bg-white p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                isAdmin
                  ? "border-slate-100 hover:border-amber-200 hover:shadow-lg hover:shadow-amber-500/10"
                  : "border-slate-200/70 opacity-80"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <FolderArchive className="w-5 h-5" />
                </div>
                {!isAdmin ? (
                  <Lock className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-amber-500" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">
                  بایگانی و سوابق
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-1">
                  سوابق پزشکی، پرونده‌ها و فاکتورها
                </p>
              </div>
            </div>

            {/* گزارش‌ها و آمار */}
            <div
              onClick={() =>
                handleAdminOnlyClick("/reports", "گزارش‌ها و آمار")
              }
              className={`group bg-white p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                isAdmin
                  ? "border-slate-100 hover:border-purple-200 hover:shadow-lg hover:shadow-purple-500/10"
                  : "border-slate-200/70 opacity-80"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>
                {!isAdmin ? (
                  <Lock className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-purple-500" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">
                  گزارش‌ها و آمار
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-1">
                  گزارش‌های مالی و عملکرد درمانگاه
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* عملیات پذیرش و درمان */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1.5 h-4 bg-emerald-600 rounded-full"></span>
            <h2 className="text-sm font-bold text-slate-800">
              عملیات پذیرش و درمان
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* مدیریت بیماران */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 hover:border-emerald-100 hover:shadow-lg hover:shadow-emerald-500/5 transition-all flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 mb-1">
                    مدیریت بیماران
                  </h3>
                  <p className="text-xs text-slate-400 mb-3">
                    پرونده‌ها و مشخصات بیماران
                  </p>
                  <button
                    onClick={() => navigate("/patients")}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition-colors"
                  >
                    <span>مشاهده اطلاعات</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* ثبت جوابدهی */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 hover:border-teal-100 hover:shadow-lg hover:shadow-teal-500/5 transition-all flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 mb-1">
                    ثبت جوابدهی
                  </h3>
                  <p className="text-xs text-slate-400 mb-3">
                    ثبت نتایج آزمایش‌ها، عکس‌ها و فایل‌های ضمیمه
                  </p>
                  <button
                    onClick={() => navigate("/results")}
                    className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition-colors"
                  >
                    <span>
                      {isSecretary2
                        ? "مشاهده و ثبت پیش‌نویس"
                        : "ثبت و ویرایش جواب"}
                    </span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
