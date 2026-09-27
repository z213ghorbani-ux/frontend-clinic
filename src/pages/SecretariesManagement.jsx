import React, { useEffect, useMemo, useState } from "react";
import {
  Users,
  UserPlus,
  Pencil,
  Trash2,
  Phone,
  ArrowRight,
  Loader2,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import api from "@/services/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PAGE_SIZE = 5;

const initialForm = {
  fullName: "",
  mobile: "",
  userLevel: "staff_level_1",
  password: "",
};

export default function SecretariesManagement() {
  const [secretaries, setSecretaries] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // واکشی منشی‌ها از سرور
  const fetchSecretaries = async () => {
    setLoading(true);
    try {
      const response = await api.get("/secretaries");
      if (response.data?.data) {
        setSecretaries(response.data.data);
      }
    } catch (error) {
      toast.error("خطا در دریافت لیست منشی‌ها");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecretaries();
  }, []);

  const validate = () => {
    const errs = {};
    if (!formData.fullName.trim()) {
      errs.fullName = "نام و نام خانوادگی منشی الزامی است";
    }
    if (!/^09\d{9}$/.test(formData.mobile.trim())) {
      errs.mobile = "شماره موبایل معتبر نیست (مثال: 09123456789)";
    }
    if (!formData.userLevel) {
      errs.userLevel = "نوع کاربر را انتخاب کنید";
    }
    if (formData.password && formData.password.length < 6) {
      errs.password = "رمز عبور باید حداقل ۶ کاراکتر باشد";
    }
    return errs;
  };

  const resetForm = () => {
    setFormData(initialForm);
    setErrors({});
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await api.put(`/secretaries/${editingId}`, formData);
        toast.success("اطلاعات منشی با موفقیت ویرایش شد");
      } else {
        await api.post("/secretaries", formData);
        toast.success("منشی جدید با موفقیت ثبت شد (شناسه ورود: شماره موبایل)");
      }
      resetForm();
      fetchSecretaries();
    } catch (error) {
      if (error.response?.data?.errors) {
        const backendErrors = error.response.data.errors;
        const mappedErrors = {};
        Object.keys(backendErrors).forEach((key) => {
          mappedErrors[key] = backendErrors[key][0];
        });
        setErrors(mappedErrors);
      } else {
        toast.error(
          error.response?.data?.message || "خطایی در ذخیره اطلاعات رخ داد",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item) => {
    setFormData({
      fullName: item.name || "",
      mobile: item.mobile || "",
      userLevel: item.role || "staff_level_1",
      password: "",
    });
    setErrors({});
    setEditingId(item.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await api.delete(`/secretaries/${deleteTarget.id}`);
      toast.success("منشی با موفقیت حذف شد");
      if (editingId === deleteTarget.id) {
        resetForm();
      }
      fetchSecretaries();
    } catch (error) {
      toast.error("خطا در حذف منشی");
    } finally {
      setDeleteTarget(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(secretaries.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const paginatedSecretaries = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return secretaries.slice(start, start + PAGE_SIZE);
  }, [secretaries, safePage]);

  return (
    <TooltipProvider>
      <div dir="rtl" className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              to="/dashboard"
              className="group flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-sm font-medium text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-700"
            >
              <ArrowRight className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              برگشت به داشبورد
            </Link>

            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  مدیریت منشی‌ها
                </h1>
                <p className="text-xs text-slate-500">
                  کنترل دسترسی‌ها و پرسنل پذیرش
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                <Users className="h-6 w-6" />
              </div>
            </div>

            <div className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              {secretaries.length.toLocaleString("fa-IR")} منشی ثبت‌شده
            </div>
          </div>

          <Card className="border-0 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserPlus className="h-4 w-4 text-emerald-600" />
                {editingId ? "ویرایش اطلاعات منشی" : "ثبت منشی جدید"}
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-6">
              <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 gap-5 md:grid-cols-2"
              >
                <div className="space-y-2">
                  <Label>
                    نام و نام خانوادگی منشی
                    <span className="mr-1 text-red-500">*</span>
                  </Label>
                  <Input
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        fullName: e.target.value,
                      }))
                    }
                    placeholder="مثال: سارا محمدی"
                    className={errors.fullName ? "border-red-500" : ""}
                  />
                  {errors.fullName && (
                    <p className="text-xs text-red-500">{errors.fullName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>
                    شماره موبایل (شناسه ورود)
                    <span className="mr-1 text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="tel"
                      maxLength={11}
                      value={formData.mobile}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          mobile: e.target.value.replace(/\D/g, ""),
                        }))
                      }
                      placeholder="09xxxxxxxxx"
                      className={`pr-9 ${errors.mobile ? "border-red-500" : ""}`}
                    />
                  </div>
                  {errors.mobile && (
                    <p className="text-xs text-red-500">{errors.mobile}</p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>
                    رمز عبور{" "}
                    {editingId && (
                      <span className="text-xs text-slate-400">
                        (در صورت نیاز به تغییر وارد شود)
                      </span>
                    )}
                  </Label>
                  <div className="relative">
                    <KeyRound className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      placeholder={
                        editingId ? "بدون تغییر" : "پیش‌فرض: شماره موبایل"
                      }
                      className={`pr-9 ${errors.password ? "border-red-500" : ""}`}
                    />
                  </div>
                  {errors.password && (
                    <p className="text-xs text-red-500">{errors.password}</p>
                  )}
                </div>

                <div className="space-y-3 md:col-span-2">
                  <Label>
                    نوع کاربر
                    <span className="mr-1 text-red-500">*</span>
                  </Label>
                  <RadioGroup
                    value={formData.userLevel}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, userLevel: value }))
                    }
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 md:flex-row"
                  >
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="staff_level_1" id="level-1" />
                      <Label htmlFor="level-1" className="cursor-pointer">
                        سطح یک (پذیرش و نوبت‌دهی)
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="staff_level_2" id="level-2" />
                      <Label htmlFor="level-2" className="cursor-pointer">
                        سطح دو (محدود)
                      </Label>
                    </div>
                  </RadioGroup>
                  {errors.userLevel && (
                    <p className="text-xs text-red-500">{errors.userLevel}</p>
                  )}
                </div>

                <div className="flex justify-end gap-2 md:col-span-2">
                  {editingId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetForm}
                      disabled={submitting}
                    >
                      انصراف
                    </Button>
                  )}
                  <Button type="submit" disabled={submitting}>
                    {submitting && (
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    )}
                    {editingId ? "ذخیره تغییرات" : "ثبت منشی"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-base">لیست منشی‌ها</CardTitle>
            </CardHeader>

            <CardContent className="pt-6">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="mr-2 text-sm">
                    در حال بارگذاری اطلاعات...
                  </span>
                </div>
              ) : secretaries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
                  هنوز هیچ منشی‌ای ثبت نشده است.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">
                            نام و نام خانوادگی
                          </TableHead>
                          <TableHead className="text-left">
                            شماره موبایل (شناسه ورود)
                          </TableHead>
                          <TableHead className="text-right">
                            سطح دسترسی
                          </TableHead>
                          <TableHead className="text-center">عملیات</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {paginatedSecretaries.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {item.name}
                            </TableCell>
                            <TableCell
                              dir="ltr"
                              className="font-mono text-left"
                            >
                              {item.mobile || "-"}
                            </TableCell>
                            <TableCell>
                              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                {item.role === "staff_level_1"
                                  ? "سطح یک"
                                  : "سطح دو"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="text-slate-500 hover:text-blue-600"
                                      onClick={() => handleEdit(item)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>ویرایش</p>
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="text-slate-500 hover:text-red-600"
                                      onClick={() => setDeleteTarget(item)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>حذف</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={safePage === 1}
                        onClick={() => setPage((prev) => prev - 1)}
                      >
                        قبلی
                      </Button>
                      <span className="text-sm text-slate-500">
                        صفحه {safePage.toLocaleString("fa-IR")} از{" "}
                        {totalPages.toLocaleString("fa-IR")}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={safePage === totalPages}
                        onClick={() => setPage((prev) => prev + 1)}
                      >
                        بعدی
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>حذف منشی</DialogTitle>
              <DialogDescription className="leading-6">
                {deleteTarget
                  ? `آیا از حذف "${deleteTarget.name}" مطمئن هستید؟`
                  : ""}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex-row-reverse gap-2 sm:justify-start">
              <Button variant="destructive" onClick={confirmDelete}>
                حذف
              </Button>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                انصراف
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
