import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Layers,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Loader2,
  Stethoscope,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import api from "@/services/api";

export default function ServicesManagement() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    price: "",
    is_visit: false,
    parent_id: null,
  });

  // دریافت ساختار درختی خدمات از بک‌اند
  const fetchServices = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      const res = await api.get("/services");
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setCategories(data);
    } catch (err) {
      console.error(err);
      setErrorMsg("خطا در دریافت لیست خدمات و تعرفه‌ها");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // باز کردن فرم برای تعریف خدمت والد (دسته‌بندی اصلی)
  const handleOpenParentForm = () => {
    setEditingItem(null);
    setSelectedParent(null);
    setFormData({
      name: "",
      code: "",
      price: "0",
      is_visit: false,
      parent_id: null,
    });
    setIsFormOpen(true);
    setErrorMsg("");
    setSuccessMsg("");
  };

  // باز کردن فرم برای افزودن زیرخدمت به یک والد مشخص
  const handleOpenChildForm = (parent) => {
    setEditingItem(null);
    setSelectedParent(parent);
    setFormData({
      name: "",
      code: "",
      price: "",
      is_visit: false,
      parent_id: parent.id,
    });
    setIsFormOpen(true);
    setErrorMsg("");
    setSuccessMsg("");
  };

  // باز کردن فرم در حالت ویرایش یک رکورد
  const handleOpenEditForm = (item) => {
    setEditingItem(item);
    const parent = item.parent_id
      ? categories.find((c) => c.id === item.parent_id) || null
      : null;
    setSelectedParent(parent);
    setFormData({
      name: item.name || "",
      code: item.code || "",
      price:
        item.price !== undefined && item.price !== null
          ? String(item.price)
          : "0",
      is_visit: Boolean(item.is_visit),
      parent_id: item.parent_id || null,
    });
    setIsFormOpen(true);
    setErrorMsg("");
    setSuccessMsg("");
  };

  // بستن فرم
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingItem(null);
    setSelectedParent(null);
    setFormData({
      name: "",
      code: "",
      price: "",
      is_visit: false,
      parent_id: null,
    });
  };

  // ارسال فرم (ثبت یا ویرایش) با اعتبارسنجی دقیق خطای ولیدیشن ۴۲۲
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg("نام خدمت الزامی است.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code?.trim() || null,
        price: parseInt(formData.price || 0, 10),
        is_visit: Boolean(formData.is_visit),
        parent_id: formData.parent_id || null,
      };

      if (editingItem) {
        await api.put(`/services/${editingItem.id}`, payload);
        setSuccessMsg("خدمت با موفقیت ویرایش شد.");
      } else {
        await api.post("/services", payload);
        setSuccessMsg("خدمت جدید با موفقیت ثبت شد.");
      }

      handleCloseForm();
      fetchServices();
    } catch (err) {
      console.error(err);
      const resErrors = err.response?.data?.errors;
      if (resErrors && typeof resErrors === "object") {
        const firstField = Object.keys(resErrors)[0];
        const firstErrorMessage = resErrors[firstField]?.[0];
        setErrorMsg(firstErrorMessage || "خطا در اعتبارسنجی داده‌ها");
      } else {
        setErrorMsg(err.response?.data?.message || "خطا در ذخیره‌سازی اطلاعات");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // تغییر وضعیت فعال / غیرفعال
  const handleToggleStatus = async (item) => {
    try {
      await api.patch(`/services/${item.id}/toggle-status`);
      fetchServices();
    } catch (err) {
      console.error(err);
      setErrorMsg("خطا در تغییر وضعیت خدمت");
    }
  };

  // حذف خدمت
  const handleDelete = async (item) => {
    if (!window.confirm(`آیا از حذف «${item.name}» اطمینان دارید؟`)) return;

    try {
      await api.delete(`/services/${item.id}`);
      fetchServices();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || "خطا در حذف خدمت");
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* نوار سربرگ */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">
                مدیریت خدمات و تعرفه‌ها
              </h1>
              <p className="text-xs text-slate-500">
                تعریف دسته‌بندی‌ها، تعرفه اقلام، کدینگ فاکتور و خدمات ویزیت
              </p>
            </div>
          </div>

          <Button
            onClick={handleOpenParentForm}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
          >
            <Plus className="h-4 w-4" />
            تعریف خدمت والد (اصلی)
          </Button>
        </div>

        {/* پیام‌های خطا و موفقیت */}
        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-50 text-emerald-600 text-xs rounded-xl border border-emerald-100 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* فرم ثبت / ویرایش */}
        {isFormOpen && (
          <Card className="border-indigo-200 bg-indigo-50/30 shadow-sm">
            <CardHeader className="border-b border-indigo-100 py-3">
              <CardTitle className="text-sm font-bold text-indigo-900">
                {editingItem
                  ? `ویرایش خدمت: ${editingItem.name}`
                  : selectedParent
                    ? `افزودن زیرخدمت به: ${selectedParent.name}`
                    : "تعریف خدمت اصلی جدید (دسته‌بندی والد)"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4"
              >
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    نام خدمت *
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="مثال: اکوکاردیوگرافی"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    کد خدمت (اختیاری)
                  </label>
                  <Input
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    placeholder="مثال: ECO-01"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    تعرفه (تومان)
                  </label>
                  <Input
                    type="number"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                    placeholder="مثال: 500000"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.is_visit}
                      onChange={(e) =>
                        setFormData({ ...formData, is_visit: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <Stethoscope className="h-4 w-4 text-emerald-600" />
                    خدمت از نوع ویزیت است
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 md:col-span-4 pt-2 border-t border-indigo-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCloseForm}
                    disabled={isSubmitting}
                  >
                    انصراف
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    disabled={isSubmitting}
                  >
                    {isSubmitting && (
                      <Loader2 className="h-4 w-4 animate-spin ml-1" />
                    )}
                    ذخیره
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* لیست درختی ساختار خدمات */}
        <Card className="border-slate-100 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-3">
            <CardTitle className="text-sm font-bold text-slate-700">
              ساختار خدمات تعریف‌شده
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                <p className="mt-2 text-xs text-slate-400">
                  در حال بارگذاری اطلاعات...
                </p>
              </div>
            ) : categories.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                هنوز هیچ خدمتی تعریف نشده است. برای شروع روی دکمه «تعریف خدمت
                والد» کلیک کنید.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-4 transition hover:bg-slate-50/40"
                  >
                    {/* ردیف والد */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs">
                          {cat.children?.length || 0}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-800">
                              {cat.name}
                            </h3>
                            {cat.is_visit && (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                                ویزیت
                              </span>
                            )}
                            {cat.code && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                                {cat.code}
                              </span>
                            )}
                          </div>
                          {Number(cat.price) > 0 && (
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              تعرفه پایه:{" "}
                              {Number(cat.price).toLocaleString("fa-IR")} تومان
                            </p>
                          )}
                        </div>
                      </div>

                      {/* دکمه‌های عملیات روی والد */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenChildForm(cat)}
                          className="h-8 text-xs text-indigo-600 hover:bg-indigo-50"
                        >
                          <Plus className="h-3.5 w-3.5 ml-1" />
                          افزودن زیرخدمت
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleStatus(cat)}
                          title={cat.is_active ? "غیرفعال‌سازی" : "فعال‌سازی"}
                          className={`h-8 w-8 ${cat.is_active ? "text-emerald-600" : "text-slate-300"}`}
                        >
                          {cat.is_active ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEditForm(cat)}
                          title="ویرایش"
                          className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(cat)}
                          title="حذف"
                          className="h-8 w-8 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* لیست زیرخدمت‌ها (فرزندان) */}
                    {cat.children && cat.children.length > 0 && (
                      <div className="mr-8 mt-3 space-y-2 border-r-2 border-indigo-100 pr-3">
                        {cat.children.map((child) => (
                          <div
                            key={child.id}
                            className="flex flex-wrap items-center justify-between rounded-xl bg-slate-50 p-2.5 text-xs text-slate-700"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-slate-800">
                                {child.name}
                              </span>
                              {child.code && (
                                <span className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                  {child.code}
                                </span>
                              )}
                              {child.is_visit && (
                                <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 border border-emerald-200">
                                  ویزیت
                                </span>
                              )}
                              <span className="font-bold text-indigo-600">
                                {Number(child.price).toLocaleString("fa-IR")}{" "}
                                تومان
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleStatus(child)}
                                title={
                                  child.is_active ? "غیرفعال‌سازی" : "فعال‌سازی"
                                }
                                className={`h-7 w-7 ${child.is_active ? "text-emerald-600" : "text-slate-300"}`}
                              >
                                {child.is_active ? (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEditForm(child)}
                                title="ویرایش"
                                className="h-7 w-7 text-slate-400 hover:text-indigo-600"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(child)}
                                title="حذف"
                                className="h-7 w-7 text-slate-400 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
