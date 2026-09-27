import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  Plus,
  Trash2,
  UserPlus,
  Phone,
  X,
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

const PAGE_SIZE = 5;

const normalizePatient = (p) => ({
  id: p.id,
  fullName: p.full_name || "",
  fileNumber: p.file_number || "",
  nationalId: p.national_code || "",
  gender: p.gender || "",
  birthDate: p.birth_date || "",
  phones: p.mobile ? [p.mobile] : [],
  registeredAt: p.created_at ? new Date(p.created_at).getTime() : p.id,
});

export default function PatientsManagement() {
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    fileNumber: "",
    nationalId: "",
    gender: "",
    birthDate: null,
  });

  const [phones, setPhones] = useState([""]);
  const [errors, setErrors] = useState({});
  const [search, setSearch] = useState("");
  const [registeredFrom, setRegisteredFrom] = useState(null);
  const [registeredTo, setRegisteredTo] = useState(null);
  const [page, setPage] = useState(1);
  const [totalFromServer, setTotalFromServer] = useState(0);

  const formatDate = (d) => {
    if (!d) return "";
    try {
      const dateObj = d instanceof Date ? d : new Date(d);
      if (isNaN(dateObj.getTime())) return "";
      return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(dateObj);
    } catch {
      return "";
    }
  };

  // دریافت لیست بیماران از سرور (با پشتیبانی از جستجو)
  const fetchPatients = useCallback(async (searchTerm = "") => {
    try {
      setIsLoading(true);
      const response = await api.get("/patients", {
        params: searchTerm ? { search: searchTerm } : {},
      });
      const res = response.data;

      const rawList = Array.isArray(res?.data?.data)
        ? res.data.data // ساختار paginate لاراول
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

  // دیبانس جستجو: با تایپ کاربر، بعد از ۴۰۰ میلی‌ثانیه از سرور می‌گیریم
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

    if (!/^\d{10}$/.test(formData.nationalId.trim())) {
      errs.nationalId = "کد ملی باید ۱۰ رقم باشد";
    }

    const validPhones = phones.filter((p) => p.trim());
    if (validPhones.length === 0) {
      errs.phones = "حداقل یک شماره موبایل وارد کنید";
    } else if (validPhones.some((p) => !/^09\d{9}$/.test(p.trim()))) {
      errs.phones = "شماره موبایل معتبر نیست (مثال: 09121234567)";
    }

    if (!formData.birthDate) {
      errs.birthDate = "تاریخ تولد الزامی است";
    }

    if (!formData.gender) {
      errs.gender = "جنسیت را انتخاب کنید";
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
      const validPhones = phones.map((p) => p.trim()).filter(Boolean);

      const payload = {
        full_name: formData.fullName.trim(),
        file_number: formData.fileNumber.trim() || null,
        national_code: formData.nationalId.trim(),
        gender: formData.gender,
        birth_date: formatDate(formData.birthDate),
        mobile: validPhones[0], // بک‌اند فعلاً فقط یک شماره موبایل ذخیره می‌کند
      };

      await api.post("/patients", payload);

      toast.success("بیمار با موفقیت ثبت شد");
      setFormData({
        fullName: "",
        fileNumber: "",
        nationalId: "",
        gender: "",
        birthDate: null,
      });
      setPhones([""]);
      setErrors({});
      setPage(1);
      fetchPatients(search);
    } catch (error) {
      console.error("خطای ثبت بیمار:", error);
      const errObj = error.response?.data?.errors;
      const serverMessage =
        errObj?.full_name?.[0] ||
        errObj?.national_code?.[0] ||
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

  // فیلتر تاریخ ثبت روی داده‌ی همین صفحه انجام می‌شود (فیلتر محلی روی نتایج دریافتی)
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

        <Card>
          <CardHeader className="flex-row items-center justify-between border-b border-slate-100">
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-emerald-600" />
              ثبت پرونده بیمار جدید
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 gap-4 md:grid-cols-3"
            >
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

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  شماره پرونده
                </label>
                <Input
                  value={formData.fileNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, fileNumber: e.target.value })
                  }
                  placeholder="مثال: 1403-001"
                  disabled={isSubmitting}
                />
              </div>

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
                  placeholder="۱۰ رقم بدون خط تیره"
                  disabled={isSubmitting}
                  className={errors.nationalId ? "border-red-400" : ""}
                />
                {errors.nationalId && (
                  <p className="mt-1 text-[11px] text-red-500">
                    {errors.nationalId}
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  شماره موبایل <span className="text-red-500">*</span>
                </label>

                <div className="space-y-2">
                  {phones.map((phone, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Phone className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          type="tel"
                          maxLength={11}
                          value={phone}
                          disabled={isSubmitting}
                          onChange={(e) => {
                            const next = [...phones];
                            next[idx] = e.target.value.replace(/\D/g, "");
                            setPhones(next);
                          }}
                          placeholder="09xxxxxxxxx"
                          className={`pr-9 ${errors.phones ? "border-red-400" : ""}`}
                        />
                      </div>

                      {phones.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setPhones(phones.filter((_, i) => i !== idx))
                          }
                          className="text-slate-400 hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPhones([...phones, ""])}
                  className="mt-2 px-2 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <Plus className="ml-1 h-3.5 w-3.5" />
                  افزودن شماره تماس دیگر
                </Button>

                {errors.phones && (
                  <p className="mt-1 text-[11px] text-red-500">
                    {errors.phones}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  تاریخ تولد <span className="text-red-500">*</span>
                </label>
                <PersianDatePicker
                  value={formData.birthDate}
                  onChange={(d) => setFormData({ ...formData, birthDate: d })}
                  placeholder="انتخاب تاریخ تولد"
                  error={Boolean(errors.birthDate)}
                />
                {errors.birthDate && (
                  <p className="mt-1 text-[11px] text-red-500">
                    {errors.birthDate}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  جنسیت <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  {[
                    { val: "male", lbl: "مرد" },
                    { val: "female", lbl: "زن" },
                  ].map((g) => (
                    <Button
                      key={g.val}
                      type="button"
                      variant={
                        formData.gender === g.val ? "default" : "outline"
                      }
                      className="flex-1"
                      disabled={isSubmitting}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          gender: formData.gender === g.val ? "" : g.val,
                        })
                      }
                    >
                      {g.lbl}
                    </Button>
                  ))}
                </div>

                {errors.gender && (
                  <p className="mt-1 text-[11px] text-red-500">
                    {errors.gender}
                  </p>
                )}
              </div>

              <div className="flex justify-end pt-2 md:col-span-3">
                <Button type="submit" size="lg" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  )}
                  {isSubmitting ? "در حال ثبت..." : "ثبت پرونده بیمار"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="relative md:col-span-1">
                <Search className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="جستجو بر اساس نام، کد ملی، شماره موبایل یا پرونده..."
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

        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="flex items-center gap-2">
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
                      <th className="px-2 pb-3">تاریخ تولد</th>
                      <th className="px-2 pb-3 text-center">جنسیت</th>
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
                          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                            {p.fileNumber || "—"}
                          </span>
                        </td>

                        <td
                          className="px-2 py-3 font-mono text-slate-500"
                          dir="ltr"
                        >
                          {p.nationalId}
                        </td>

                        <td className="px-2 py-3 font-mono" dir="ltr">
                          {p.phones.join(" ، ")}
                        </td>

                        <td className="px-2 py-3 text-slate-500">
                          {p.birthDate}
                        </td>

                        <td className="px-2 py-3 text-center">
                          {(() => {
                            const isMale =
                              p.gender === "male" || p.gender === "مرد";
                            const isFemale =
                              p.gender === "female" || p.gender === "زن";

                            if (isMale) {
                              return (
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                                  مرد
                                </span>
                              );
                            }

                            if (isFemale) {
                              return (
                                <span className="rounded-full bg-pink-50 px-2 py-0.5 text-[10px] font-medium text-pink-600">
                                  زن
                                </span>
                              );
                            }

                            return <span className="text-slate-400">—</span>;
                          })()}
                        </td>

                        <td className="py-3 pl-2 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(p.id)}
                            className="h-8 w-8 text-slate-400 hover:text-red-600"
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
