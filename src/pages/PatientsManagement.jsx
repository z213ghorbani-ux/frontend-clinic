import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Users,
  Search,
  Trash2,
  UserPlus,
  Phone,
  ClipboardList,
  ArrowRight,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PersianDatePicker } from "@/components/ui/persian-datepicker";
import api from "@/services/api";
import { toast } from "sonner";

const PAGE_SIZE = 7;

const normalizePatient = (p) => ({
  id: p.id,
  fullName: p.full_name || "",
  fileNumber: p.file_number || "",
  nationalId: p.national_code || "",
  mobile: p.mobile || "",
  registeredAt: p.created_at ? new Date(p.created_at).getTime() : p.id,
  registeredAtFormatted: p.created_at
    ? new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(p.created_at))
    : "—",
});

export default function PatientsManagement() {
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // فرم تمیزشده: فقط فیلدهای معتبر و لازم
  const [formData, setFormData] = useState({
    fullName: "",
    fileNumber: "",
    nationalId: "",
    mobile: "",
  });

  const [errors, setErrors] = useState({});
  const [search, setSearch] = useState("");
  const [registeredFrom, setRegisteredFrom] = useState(null);
  const [registeredTo, setRegisteredTo] = useState(null);
  const [page, setPage] = useState(1);
  const [totalFromServer, setTotalFromServer] = useState(0);

  // دریافت لیست بیماران از سرور
  const fetchPatients = useCallback(async (searchTerm = "") => {
    try {
      setIsLoading(true);
      const response = await api.get("/patients", {
        params: searchTerm ? { search: searchTerm } : {},
      });
      const res = response.data;

      const rawList = Array.isArray(res?.data?.data)
        ? res.data.data
        : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
            ? res
            : [];

      setPatients(rawList.map(normalizePatient));
      setTotalFromServer(res?.data?.total ?? rawList.length);
    } catch (error) {
      console.error("خطا در دریافت لیست بیماران:", error);
      toast.error("خطا در دریافت لیست بیماران از سرور");
      setPatients([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // دیبانس جستجو
  useEffect(() => {
    const delay = setTimeout(() => {
      fetchPatients(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(delay);
  }, [search, fetchPatients]);

  const validate = () => {
    const errs = {};

    if (!formData.fullName.trim()) {
      errs.fullName = "نام و نام خانوادگی الزامی است";
    }

    if (!formData.fileNumber.trim()) {
      errs.fileNumber = "شماره پرونده الزامی است";
    }

    if (!/^\d{10}$/.test(formData.nationalId.trim())) {
      errs.nationalId = "کد ملی باید ۱۰ رقم باشد";
    }

    // موبایل اختیاری است؛ اما اگر وارد شد باید معتبر باشد
    if (formData.mobile.trim() && !/^09\d{9}$/.test(formData.mobile.trim())) {
      errs.mobile = "فرمت موبایل نامعتبر است (مثال: 09121234567)";
    }

    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        full_name: formData.fullName.trim(),
        file_number: formData.fileNumber.trim(),
        national_code: formData.nationalId.trim(),
        mobile: formData.mobile.trim() || null,
      };

      await api.post("/patients", payload);

      toast.success("بیمار با موفقیت ثبت شد");
      setFormData({
        fullName: "",
        fileNumber: "",
        nationalId: "",
        mobile: "",
      });
      setErrors({});
      setPage(1);
      fetchPatients(search);
    } catch (error) {
      console.error("خطای ثبت بیمار:", error);
      const errObj = error.response?.data?.errors;
      const serverMessage =
        errObj?.file_number?.[0] ||
        errObj?.national_code?.[0] ||
        errObj?.full_name?.[0] ||
        errObj?.mobile?.[0] ||
        error.response?.data?.message;
      toast.error(serverMessage || "خطا در ثبت بیمار");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("آیا از حذف این بیمار مطمئن هستید؟")) return;
    try {
      await api.delete(`/patients/${id}`);
      setPatients((prev) => prev.filter((p) => p.id !== id));
      toast.success("بیمار حذف شد");
    } catch (error) {
      console.error("خطای حذف بیمار:", error);
      toast.error("خطا در حذف بیمار");
    }
  };

  // فیلتر بازه تاریخ ثبت
  const filtered = patients.filter((p) => {
    if (!registeredFrom && !registeredTo) return true;
    const fromTs = registeredFrom
      ? new Date(registeredFrom).setHours(0, 0, 0, 0)
      : null;
    const toTs = registeredTo
      ? new Date(registeredTo).setHours(23, 59, 59, 999)
      : null;
    const ts = p.registeredAt;
    return (!fromTs || ts >= fromTs) && (!toTs || ts <= toTs);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagePatients = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        {/* نوار سربرگ */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="h-10 w-10 shrink-0"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                مدیریت بیماران
              </h1>
              <p className="text-xs text-slate-500">
                ثبت، جستجو و مدیریت پرونده بیماران
              </p>
            </div>
          </div>

          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            {totalFromServer.toLocaleString("fa-IR")} بیمار ثبت‌شده
          </span>
        </div>

        {/* فرم ثبت پرونده بیمار جدید */}
        <Card>
          <CardHeader className="flex-row items-center justify-between border-b border-slate-100">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4 text-emerald-600" />
              ثبت پرونده بیمار جدید
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                {/* نام و نام خانوادگی */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    نام و نام خانوادگی <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    placeholder="مثال: علی محمدی"
                    disabled={isSubmitting}
                    className={errors.fullName ? "border-red-400" : ""}
                  />
                  {errors.fullName && (
                    <p className="mt-1 text-[11px] text-red-500">
                      {errors.fullName}
                    </p>
                  )}
                </div>

                {/* شماره پرونده (اجباری) */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    شماره پرونده <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.fileNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, fileNumber: e.target.value })
                    }
                    placeholder="مثال: 1403-001"
                    disabled={isSubmitting}
                    className={errors.fileNumber ? "border-red-400" : ""}
                  />
                  {errors.fileNumber && (
                    <p className="mt-1 text-[11px] text-red-500">
                      {errors.fileNumber}
                    </p>
                  )}
                </div>

                {/* کد ملی */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    کد ملی <span className="text-red-500">*</span>
                  </label>
                  <Input
                    maxLength={10}
                    value={formData.nationalId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        nationalId: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    placeholder="۱۰ رقم کد ملی"
                    disabled={isSubmitting}
                    className={errors.nationalId ? "border-red-400" : ""}
                  />
                  {errors.nationalId && (
                    <p className="mt-1 text-[11px] text-red-500">
                      {errors.nationalId}
                    </p>
                  )}
                </div>

                {/* شماره موبایل (اختیاری) */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    شماره موبایل{" "}
                    <span className="text-slate-400 font-normal">
                      (اختیاری)
                    </span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="tel"
                      maxLength={11}
                      value={formData.mobile}
                      disabled={isSubmitting}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          mobile: e.target.value.replace(/\D/g, ""),
                        })
                      }
                      placeholder="09121234567"
                      className={`pr-9 ${errors.mobile ? "border-red-400" : ""}`}
                    />
                  </div>
                  {errors.mobile && (
                    <p className="mt-1 text-[11px] text-red-500">
                      {errors.mobile}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  size="default"
                  disabled={isSubmitting}
                  className="min-w-[130px]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      در حال ثبت...
                    </>
                  ) : (
                    "ثبت پرونده بیمار"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* فیلتر و جستجو */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="relative md:col-span-1">
                <Search className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="جستجو با نام، پرونده، کد ملی یا موبایل..."
                  className="bg-white pr-10"
                />
              </div>

              <div>
                <PersianDatePicker
                  value={registeredFrom}
                  onChange={setRegisteredFrom}
                  placeholder="از تاریخ ثبت"
                />
              </div>

              <div>
                <PersianDatePicker
                  value={registeredTo}
                  onChange={setRegisteredTo}
                  placeholder="تا تاریخ ثبت"
                />
              </div>
            </div>

            {(search || registeredFrom || registeredTo) && (
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setRegisteredFrom(null);
                    setRegisteredTo(null);
                  }}
                >
                  پاک کردن فیلترها
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* جدول لیست بیماران */}
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-slate-500" />
              لیست بیماران ثبت‌شده
            </CardTitle>

            <span className="rounded-full bg-slate-200/70 px-2.5 py-0.5 text-xs font-medium text-slate-700">
              {filtered.length.toLocaleString("fa-IR")} نفر
            </span>
          </CardHeader>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 className="mb-3 h-6 w-6 animate-spin text-emerald-600" />
              <p className="text-sm text-slate-500">
                در حال دریافت لیست بیماران...
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              هیچ بیماری یافت نشد.
            </div>
          ) : (
            <div className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 font-medium text-slate-400">
                      <th className="pb-3 pr-2">نام و نام خانوادگی</th>
                      <th className="px-2 pb-3">شماره پرونده</th>
                      <th className="px-2 pb-3">کد ملی</th>
                      <th className="px-2 pb-3">موبایل</th>
                      <th className="px-2 pb-3">تاریخ ثبت پرونده</th>
                      <th className="pb-3 pl-2 text-center">عملیات</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {pagePatients.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/60">
                        <td className="py-3 pr-2 font-bold text-slate-900">
                          {p.fullName}
                        </td>

                        <td className="px-2 py-3">
                          <span className="rounded bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                            {p.fileNumber}
                          </span>
                        </td>

                        <td
                          className="px-2 py-3 font-mono text-slate-600"
                          dir="ltr"
                        >
                          {p.nationalId}
                        </td>

                        <td
                          className="px-2 py-3 font-mono text-slate-600"
                          dir="ltr"
                        >
                          {p.mobile || (
                            <span className="text-slate-300 font-sans">
                              ندارد
                            </span>
                          )}
                        </td>

                        <td className="px-2 py-3 text-slate-500">
                          {p.registeredAtFormatted}
                        </td>

                        <td className="py-3 pl-2 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(p.id)}
                            className="h-8 w-8 text-slate-400 hover:text-red-600"
                            title="حذف بیمار"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage === 1}
                    onClick={() => setPage(safePage - 1)}
                  >
                    قبلی
                  </Button>

                  <span className="px-2 text-xs text-slate-500">
                    صفحه {safePage.toLocaleString("fa-IR")} از{" "}
                    {totalPages.toLocaleString("fa-IR")}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage === totalPages}
                    onClick={() => setPage(safePage + 1)}
                  >
                    بعدی
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
