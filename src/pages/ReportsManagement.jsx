import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Trash2,
  FileText,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Download,
  Printer,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  Stethoscope,
  ClipboardList,
  History,
  Info,
} from "lucide-react";

import { PersianDatePicker } from "@/components/ui/persian-datepicker";
import reportService from "@/services/reportService";
import { SERVICE_TYPES, getServiceCode } from "@/constants/services";

export default function ReportsManagement() {
  const navigate = useNavigate();

  // استیت‌های داده و صفحه‌بندی
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    total: 0,
  });

  // فیلترها
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // حذف گروهی
  const [deleteFromDate, setDeleteFromDate] = useState("");
  const [deleteToDate, setDeleteToDate] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // تبدیل خروجی PersianDatePicker به رشته مناسب
  const toDateInputString = (value) => {
    if (!value) return "";
    if (value instanceof Date) {
      if (isNaN(value.getTime())) return "";
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, "0");
      const d = String(value.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    if (typeof value === "object") {
      if (value.value) return toDateInputString(value.value);
      if (typeof value.toString === "function") {
        const asString = value.toString();
        return asString === "[object Object]" ? "" : asString;
      }
      return "";
    }
    return String(value);
  };

  // واکشی داده‌ها از سرور
  const fetchReports = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const response = await reportService.getReports({
          page: page,
          search: searchTerm,
          from_date: fromDate,
          to_date: toDate,
        });

        let list = [];
        let currentPage = 1;
        let lastPage = 1;
        let totalRecords = 0;

        if (Array.isArray(response)) {
          list = response;
          totalRecords = response.length;
        } else if (Array.isArray(response?.data?.data)) {
          list = response.data.data;
          currentPage = response.data.current_page ?? 1;
          lastPage = response.data.last_page ?? 1;
          totalRecords = response.data.total ?? list.length;
        } else if (Array.isArray(response?.data)) {
          list = response.data;
          currentPage = response.current_page ?? 1;
          lastPage = response.last_page ?? 1;
          totalRecords = response.total ?? list.length;
        } else if (Array.isArray(response?.reports?.data)) {
          list = response.reports.data;
          currentPage = response.reports.current_page ?? 1;
          lastPage = response.reports.last_page ?? 1;
          totalRecords = response.reports.total ?? list.length;
        }

        setReports(list);
        setPagination({
          currentPage,
          lastPage,
          total: totalRecords,
        });
      } catch (error) {
        console.error("خطا در دریافت گزارش‌ها:", error);
        setReports([]);
        setPagination({
          currentPage: 1,
          lastPage: 1,
          total: 0,
        });
      } finally {
        setLoading(false);
      }
    },
    [searchTerm, fromDate, toDate],
  );

  useEffect(() => {
    fetchReports(pagination.currentPage);
  }, [pagination.currentPage, fetchReports]);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    if (pagination.currentPage === 1) {
      fetchReports(1);
    } else {
      setPagination((prev) => ({ ...prev, currentPage: 1 }));
    }
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setFromDate("");
    setToDate("");
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  };

  // تبدیل تاریخ و ساعت به شمسی با تایم‌زون تهران
  const formatPersianDateTime = (dateString) => {
    if (!dateString) return "-";
    try {
      let normalized = dateString;
      const hasTimezoneInfo = /Z$|[+-]\d{2}:?\d{2}$/.test(dateString);
      if (!hasTimezoneInfo) {
        normalized = dateString.replace(" ", "T") + "Z";
      }

      const date = new Date(normalized);
      if (isNaN(date.getTime())) return dateString;

      const datePart = new Intl.DateTimeFormat("fa-IR", {
        calendar: "persian",
        numberingSystem: "arabext",
        timeZone: "Asia/Tehran",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);

      const timePart = new Intl.DateTimeFormat("fa-IR", {
        numberingSystem: "arabext",
        timeZone: "Asia/Tehran",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date);

      return { date: datePart, time: timePart };
    } catch {
      return dateString;
    }
  };

  // تابع جامع برای استخراج نام دقیق کاربر ثبت‌کننده هر رویداد
  const extractLogUserName = (log, row) => {
    if (!log) return "کاربر سیستم";

    // ۱. بررسی شیء یا فیلد کاربر درون لاگ
    const u = log.user || log.creator || log.operator || log.performed_by;
    if (typeof u === "object" && u !== null) {
      const compositeName = [u.first_name, u.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (compositeName) return compositeName;
      if (u.name) return u.name;
      if (u.full_name) return u.full_name;
      if (u.username) return u.username;
    } else if (typeof u === "string" && u.trim()) {
      return u.trim();
    }

    // ۲. بررسی فیلدهای مسطح نام کاربر در رکورد لاگ
    const flatName =
      log.user_name ||
      log.userName ||
      log.created_by_name ||
      log.creator_name ||
      log.operator_name ||
      log.username;
    if (flatName && typeof flatName === "string" && flatName.trim()) {
      return flatName.trim();
    }

    // ۳. بررسی اطلاعات موجود در رکورد ردیف اصلی به عنوان منبع تکمیلی
    const rowUser =
      row?.issued_by_name ||
      row?.creator?.name ||
      row?.created_by_name ||
      row?.user?.name ||
      row?.form_data?.issued_by_name;
    if (rowUser && typeof rowUser === "string" && rowUser.trim()) {
      return rowUser.trim();
    }

    return "کاربر سیستم";
  };

  // استخراج هوشمند کد خدمت
  const resolveServiceCode = (service) => {
    const sName =
      typeof service === "string"
        ? service
        : service?.serviceTitle ||
          service?.service_name ||
          service?.title ||
          service?.name ||
          "";

    try {
      if (typeof getServiceCode === "function") {
        const code = getServiceCode(sName);
        if (code && code !== "---") return code;
      }
    } catch (_) {}

    const directCode =
      service?.service_code ||
      service?.serviceCode ||
      service?.code ||
      service?.service_id;
    if (directCode) return String(directCode);

    // نگاشت نامی پشتیبان
    const nameStr = String(sName).trim();
    if (nameStr.includes("اکو") || nameStr.includes("اکوکاردیوگرافی"))
      return "7001";
    if (
      nameStr.includes("نوار") ||
      nameStr.includes("تست ورزش") ||
      nameStr.includes("ECG")
    )
      return "7002";
    if (nameStr.includes("ویزیت")) return "1001";
    if (nameStr.includes("هولتر")) return "7003";

    return "---";
  };

  // آدرس سرور برای بارگذاری تصویر مهر
  const API_BASE_URL = "http://127.0.0.1:8000";

  // تابع کمکی برای حل آدرس مهر یک پزشک
  const resolveDoctorStamp = (doctor) => {
    if (!doctor) return null;
    if (doctor.stamp_url) return doctor.stamp_url;
    const raw = doctor.stamp_path || doctor.stamp;
    if (!raw) return null;
    return `${API_BASE_URL}/storage/${raw}`;
  };

  // دانلود و پرینت مستقیم فاکتور نهایی همراه با کد خدمت و مهر و امضای همه پزشکان دخیل
  const handleDownloadInvoice = (row, autoPrint = false) => {
    const invoice = row?.invoice || {};
    const patient = row?.patient || {};
    const queueItems = Array.isArray(invoice?.queueItems)
      ? invoice.queueItems
      : [];

    const rows = [];
    const uniqueDoctorsMap = new Map();

    if (queueItems.length > 0) {
      queueItems.forEach((q) => {
        const doctor = q?.doctor || {};
        const doctorName = doctor?.name || q?.doctorName || "پزشک معالج";
        const services = Array.isArray(q?.services) ? q.services : [];

        if (!uniqueDoctorsMap.has(doctorName)) {
          uniqueDoctorsMap.set(doctorName, resolveDoctorStamp(doctor));
        }

        services.forEach((s) => {
          rows.push({
            code: resolveServiceCode(s),
            name:
              typeof s === "string"
                ? s
                : s?.serviceTitle ||
                  s?.service_name ||
                  s?.title ||
                  s?.name ||
                  "خدمت درمانی",
            doctor: doctorName,
            price: Number(s?.price || s?.amount || 0),
          });
        });
      });
    } else {
      const services = Array.isArray(invoice?.services) ? invoice.services : [];
      const fallbackDoctor = row?.doctor?.name || "پزشک معالج";
      uniqueDoctorsMap.set(fallbackDoctor, resolveDoctorStamp(row?.doctor));
      services.forEach((s) => {
        rows.push({
          code: resolveServiceCode(s),
          name:
            typeof s === "string"
              ? s
              : s?.serviceTitle ||
                s?.service_name ||
                s?.title ||
                s?.name ||
                "خدمت درمانی",
          doctor: fallbackDoctor,
          price: Number(s?.price || s?.amount || 0),
        });
      });
    }

    const totalAmount = Number(
      invoice?.total_amount || rows.reduce((sum, r) => sum + r.price, 0) || 0,
    );
    const discount = Number(invoice?.discount || 0);
    const finalAmount = Number(invoice?.final_amount ?? totalAmount - discount);

    const printWin = window.open("", "_blank", "width=850,height=900");
    if (!printWin) {
      alert("لطفاً در مرورگر اجازه باز شدن پنجره Pop-up را بدهید.");
      return;
    }

    let serviceRowsHtml = "";
    if (rows.length > 0) {
      serviceRowsHtml = rows
        .map(
          (r, idx) => `
          <tr>
            <td style="text-align:center; padding: 8px; border: 1px solid #cbd5e1;">${idx + 1}</td>
            <td style="text-align:center; padding: 8px; border: 1px solid #cbd5e1;">
              <span style="background: #e6f4ea; color: #137333; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">
                ${r.code}
              </span>
            </td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">${r.name}</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1;">${r.doctor}</td>
            <td style="text-align:left; padding: 8px; border: 1px solid #cbd5e1;">${r.price.toLocaleString("fa-IR")} تومان</td>
          </tr>`,
        )
        .join("");
    } else {
      serviceRowsHtml = `
        <tr>
          <td style="text-align:center; padding: 8px; border: 1px solid #cbd5e1;">۱</td>
          <td style="text-align:center; padding: 8px; border: 1px solid #cbd5e1;">
            <span style="background: #e6f4ea; color: #137333; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">1001</span>
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">خدمات ثبت‌شده پرونده</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">پزشک معالج</td>
          <td style="text-align:left; padding: 8px; border: 1px solid #cbd5e1;">${totalAmount.toLocaleString("fa-IR")} تومان</td>
        </tr>`;
    }

    let stampBoxesHtml = "";
    uniqueDoctorsMap.forEach((stampUrl, doctorName) => {
      stampBoxesHtml += `
        <div class="stamp-box">
          ${
            stampUrl
              ? `<img class="doctor-stamp-img" src="${stampUrl}" alt="مهر پزشک" onerror="this.style.display='none'" />`
              : `<div style="height: 35px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 10px;">(محل مهر و امضا)</div>`
          }
          <div style="font-weight: bold; color: #1e293b; font-size: 11px;">مهر و امضای پزشک</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${doctorName}</div>
        </div>`;
    });

    const htmlDoc = `
      <!DOCTYPE html>
      <html lang="fa" dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <title>فاکتور_${patient.name || "بیمار"}_${row.id}</title>
        <style>
          @page { size: A5 landscape; margin: 10mm; }
          body { font-family: Tahoma, sans-serif; direction: rtl; padding: 15px; margin: 0; font-size: 12px; color: #1e293b; }
          .card { border: 2px solid #0d9488; border-radius: 8px; padding: 16px; position: relative; }
          .head { display: flex; justify-content: space-between; border-bottom: 2px solid #ccfbf1; padding-bottom: 8px; margin-bottom: 12px; font-weight: bold; font-size: 14px; color: #0f766e; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #f8fafc; padding: 10px; border-radius: 6px; margin-bottom: 12px; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
          th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; text-align: right; }
          .footer-section { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 12px; margin-top: 10px; }
          .stamp-box {
            min-width: 150px;
            text-align: center;
            border: 1px dashed #0d9488;
            padding: 8px;
            border-radius: 6px;
            background: #fafafa;
          }
          .stamp-box img {
            max-height: 60px;
            max-width: 120px;
            object-fit: contain;
            margin-bottom: 4px;
            display: block;
            margin-left: auto;
            margin-right: auto;
          }
          .totals-box { width: 250px; background: #f0fdfa; border: 1px solid #99f6e4; padding: 8px 12px; border-radius: 6px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .final { font-weight: bold; color: #0f766e; border-top: 1px dashed #0d9488; padding-top: 4px; font-size: 13px; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="head">
            <span>صورت‌حساب رسمی درمانگاه</span>
            <span style="font-size: 12px; color: #475569;">شماره: ${row.id} | تاریخ: ${(row.created_at || "").substring(0, 10)}</span>
          </div>

          <div class="grid">
            <div>نام بیمار: <b>${patient.name || "-"}</b></div>
            <div>کد ملی: <b>${patient.national_code || "-"}</b></div>
            <div>شماره پرونده: <b>${patient.case_number || row.id}</b></div>
            <div>تعداد خدمات: <b>${rows.length || 1}</b></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 35px; text-align: center;">#</th>
                <th style="width: 80px; text-align: center;">کد خدمت</th>
                <th>شرح خدمت / آزمایش</th>
                <th style="width: 130px;">پزشک</th>
                <th style="width: 120px; text-align: left;">مبلغ</th>
              </tr>
            </thead>
            <tbody>${serviceRowsHtml}</tbody>
          </table>

          <div class="footer-section">
            ${stampBoxesHtml}

            <!-- جدول مبالغ -->
            <div class="totals-box">
              <div class="row"><span>جمع کل:</span><span>${totalAmount.toLocaleString("fa-IR")} تومان</span></div>
              <div class="row"><span>تخفیف:</span><span>${discount.toLocaleString("fa-IR")} تومان</span></div>
              <div class="row final"><span>مبلغ قابل پرداخت:</span><span>${finalAmount.toLocaleString("fa-IR")} تومان</span></div>
            </div>
          </div>

          <div style="margin-top: 15px; text-align: left;" class="no-print">
            <button onclick="window.print()" style="padding: 6px 14px; background: #0d9488; color: #fff; border: none; border-radius: 4px; cursor: pointer;">چاپ / ذخیره PDF</button>
          </div>
        </div>

        <script>
          ${autoPrint ? "window.onload = function() { window.print(); };" : ""}
        </script>
      </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(htmlDoc);
    printWin.document.close();
  };

  const getActionIcon = (actionText = "") => {
    if (actionText.includes("پذیرش"))
      return <ClipboardList className="w-3.5 h-3.5 text-blue-600" />;
    if (actionText.includes("خدمت") || actionText.includes("ویزیت"))
      return <Stethoscope className="w-3.5 h-3.5 text-amber-600" />;
    return <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />;
  };

  const handleConfirmBatchDelete = async () => {
    if (!deleteFromDate || !deleteToDate) {
      alert("لطفاً هر دو تاریخ شروع و پایان را انتخاب کنید.");
      return;
    }

    setDeleting(true);
    try {
      const res = await reportService.batchDeleteReports(
        deleteFromDate,
        deleteToDate,
      );
      alert(res.message || "سوابق بازه انتخابی با موفقیت حذف شدند.");
      setIsDeleteDialogOpen(false);
      setDeleteFromDate("");
      setDeleteToDate("");
      fetchReports(1);
    } catch (error) {
      alert(error.response?.data?.message || "خطا در انجام عملیات حذف.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* هدر صفحه */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-50 text-teal-600 rounded-lg">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">
              گزارش‌ها و آمار مراجعین
            </h1>
            <p className="text-xs text-slate-500">
              سوابق اقدامات کاربران، چرخه خدمات و دانلود فاکتورها
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>بازگشت</span>
        </Button>
      </div>

      {/* فیلترها */}
      <Card className="shadow-xs border-slate-200">
        <CardContent className="pt-6">
          <form
            onSubmit={handleSearch}
            className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
          >
            <div className="md:col-span-4 space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">
                جستجوی سوابق
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                <Input
                  type="text"
                  placeholder="نام بیمار، کدملی، موبایل یا پرونده..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-9 h-10 border-slate-300"
                />
              </div>
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">
                از تاریخ:
              </label>
              <PersianDatePicker
                value={fromDate}
                onChange={(date) => setFromDate(toDateInputString(date))}
                placeholder="انتخاب تاریخ شروع"
              />
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">
                تا تاریخ:
              </label>
              <PersianDatePicker
                value={toDate}
                onChange={(date) => setToDate(toDateInputString(date))}
                placeholder="انتخاب تاریخ پایان"
              />
            </div>

            <div className="md:col-span-2 flex gap-2">
              <Button
                type="submit"
                className="flex-1 h-10 bg-teal-600 hover:bg-teal-700 text-xs"
              >
                اعمال فیلتر
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleResetFilters}
                className="h-10 px-3 border-slate-300 text-slate-600 hover:bg-slate-100"
                title="پاکسازی فیلترها"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* جدول داده‌ها */}
      <Card className="shadow-xs border-slate-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-right font-bold text-slate-700">
                    نام بیمار
                  </TableHead>
                  <TableHead className="text-center font-bold text-slate-700">
                    کد ملی
                  </TableHead>
                  <TableHead className="text-center font-bold text-slate-700">
                    موبایل
                  </TableHead>
                  <TableHead className="text-center font-bold text-slate-700">
                    شماره پرونده
                  </TableHead>
                  <TableHead className="text-center font-bold text-slate-700">
                    سوابق و اقدامات
                  </TableHead>
                  <TableHead className="text-center font-bold text-slate-700">
                    فاکتور و تسویه
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-12 text-slate-500"
                    >
                      در حال دریافت اطلاعات...
                    </TableCell>
                  </TableRow>
                ) : reports.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-12 text-slate-400"
                    >
                      هیچ رکوردی برای نمایش یافت نشد.
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.map((row) => {
                    return (
                      <TableRow
                        key={row.id}
                        className="hover:bg-slate-50/70 border-b"
                      >
                        <TableCell className="font-semibold text-slate-800">
                          {row.patient?.name || "نامشخص"}
                          <span className="block text-[11px] text-slate-400 font-normal mt-0.5">
                            {formatPersianDateTime(row.created_at)?.date || "-"}
                          </span>
                        </TableCell>

                        <TableCell className="text-center font-mono text-xs text-slate-600">
                          {row.patient?.national_code || "-"}
                        </TableCell>

                        <TableCell className="text-center font-mono text-xs text-slate-600">
                          {row.patient?.phone || "-"}
                        </TableCell>

                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className="font-mono text-xs text-slate-700 bg-slate-50"
                          >
                            {row.patient?.case_number || row.id}
                          </Badge>
                        </TableCell>

                        {/* سوابق و لاگ‌ها */}
                        <TableCell className="text-center">
                          {(() => {
                            // پشتیبانی از همه منابع احتمالی لاگ
                            let logs =
                              row.audit_logs ||
                              row.history ||
                              row.form_data?.history ||
                              row.form_data?.hist_users ||
                              row.hist_users ||
                              [];

                            // اگر history به صورت json string برگشته باشد، parse شود
                            if (typeof logs === "string") {
                              try {
                                logs = JSON.parse(logs);
                              } catch (_) {
                                logs = [];
                              }
                            }

                            const count = Array.isArray(logs) ? logs.length : 0;

                            if (count === 0) {
                              return (
                                <span className="text-xs text-slate-400">
                                  -
                                </span>
                              );
                            }

                            return (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs gap-1.5 border-teal-200 text-teal-700 bg-teal-50/60 hover:bg-teal-100 transition-colors"
                                  >
                                    <History className="w-3.5 h-3.5" />
                                    <span>{count} اقدام ثبت‌شده</span>
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                  className="w-84 p-3 bg-white shadow-xl border-slate-200 rounded-xl"
                                  align="center"
                                  dir="rtl"
                                >
                                  <div className="space-y-2.5">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 font-bold text-xs text-slate-800">
                                      <span className="flex items-center gap-1.5">
                                        <Info className="w-4 h-4 text-teal-600" />
                                        <span>
                                          چرخه اقدامات و کاربران ثبت‌کننده
                                        </span>
                                      </span>
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px] font-mono px-1.5 py-0"
                                      >
                                        {count} رکورد
                                      </Badge>
                                    </div>

                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                      {logs.map((log, index) => {
                                        // استخراج نام کاربر با تابع کمکی جامع
                                        const userName = extractLogUserName(
                                          log,
                                          row,
                                        );

                                        // عنوان و توضیحات اقدام
                                        const actionTitle =
                                          log.action || "اقدام سیستمی";
                                        const actionDesc =
                                          log.action_description ||
                                          log.details ||
                                          log.description ||
                                          "";

                                        // مدیریت نمایش تاریخ و ساعت
                                        const rawDate =
                                          log.created_at ||
                                          log.date ||
                                          log.time ||
                                          "";
                                        let dateDisplay = "-";

                                        if (rawDate) {
                                          if (
                                            typeof rawDate === "string" &&
                                            rawDate.includes("/")
                                          ) {
                                            dateDisplay = rawDate;
                                          } else {
                                            const formatted =
                                              formatPersianDateTime(rawDate);
                                            dateDisplay =
                                              typeof formatted === "object"
                                                ? `${formatted.date} ${formatted.time}`
                                                : formatted;
                                          }
                                        }

                                        return (
                                          <div
                                            key={log.id || index}
                                            className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-slate-100/60 transition-colors text-xs text-right space-y-1.5"
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                                {getActionIcon(
                                                  actionTitle +
                                                    " " +
                                                    actionDesc,
                                                )}
                                                <span className="text-teal-900">
                                                  {userName}
                                                </span>
                                              </span>
                                              <span
                                                className="text-[10px] text-slate-400 font-mono flex items-center gap-1"
                                                dir="ltr"
                                              >
                                                <Clock className="w-3 h-3 text-slate-400" />
                                                {dateDisplay}
                                              </span>
                                            </div>

                                            <div className="text-[11px] font-medium text-slate-700">
                                              {actionTitle}
                                            </div>

                                            {actionDesc &&
                                              actionDesc !== actionTitle && (
                                                <div className="text-[10px] text-slate-500 bg-white/70 p-1.5 rounded border border-slate-100 leading-relaxed">
                                                  {actionDesc}
                                                </div>
                                              )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            );
                          })()}
                        </TableCell>

                        {/* دانلود و چاپ فاکتور */}
                        <TableCell className="text-center">
                          {row.invoice ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-mono text-xs font-bold text-slate-800">
                                {Number(
                                  row.invoice.final_amount ||
                                    row.invoice.total_amount ||
                                    0,
                                ).toLocaleString("fa-IR")}{" "}
                                تومان
                              </span>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2.5 text-xs gap-1 border-teal-300 text-teal-700 bg-white hover:bg-teal-50"
                                  title="دانلود فایل فاکتور"
                                  onClick={() =>
                                    handleDownloadInvoice(row, false)
                                  }
                                >
                                  <Download className="w-3.5 h-3.5 text-teal-600" />
                                  <span>دانلود فاکتور</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-slate-600 hover:text-teal-700 hover:bg-teal-50"
                                  title="چاپ مستقیم"
                                  onClick={() =>
                                    handleDownloadInvoice(row, true)
                                  }
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">
                              فاقد فاکتور
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* صفحه‌بندی */}
          <div className="p-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              مجموع سوابق: {pagination.total} رکورد
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={pagination.currentPage <= 1}
                onClick={() =>
                  setPagination((p) => ({
                    ...p,
                    currentPage: p.currentPage - 1,
                  }))
                }
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <span className="text-xs font-mono">
                {pagination.currentPage} از {pagination.lastPage}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={pagination.currentPage >= pagination.lastPage}
                onClick={() =>
                  setPagination((p) => ({
                    ...p,
                    currentPage: p.currentPage + 1,
                  }))
                }
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* حذف گروهی */}
      <Card className="border-rose-200 bg-rose-50/40 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-rose-800 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>مدیریت و حذف گروهی سوابق گزارش‌ها</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-4 space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                از تاریخ:
              </label>
              <PersianDatePicker
                value={deleteFromDate}
                onChange={(date) => setDeleteFromDate(toDateInputString(date))}
                placeholder="شروع بازه حذف"
              />
            </div>
            <div className="md:col-span-4 space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                تا تاریخ:
              </label>
              <PersianDatePicker
                value={deleteToDate}
                onChange={(date) => setDeleteToDate(toDateInputString(date))}
                placeholder="پایان بازه حذف"
              />
            </div>
            <div className="md:col-span-4">
              <Button
                variant="destructive"
                className="w-full h-10 gap-2 bg-rose-600 hover:bg-rose-700 text-xs"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4" />
                حذف سوابق این بازه
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* مودال تایید حذف گروهی */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-rose-700 flex items-center gap-2 text-base">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              تایید عملیات حذف سوابق
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-600 leading-relaxed py-2">
            آیا از حذف کلیه گزارش‌ها و مراجعات ثبت‌شده از تاریخ{" "}
            <span className="font-bold text-slate-800">
              {toDateInputString(deleteFromDate) || deleteFromDate}
            </span>{" "}
            تا{" "}
            <span className="font-bold text-slate-800">
              {toDateInputString(deleteToDate) || deleteToDate}
            </span>{" "}
            اطمینان دارید؟ این عملیات غیرقابل بازگشت است.
          </p>
          <DialogFooter className="gap-2 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              انصراف
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleting}
              onClick={handleConfirmBatchDelete}
            >
              {deleting ? "در حال حذف..." : "بله، حذف شود"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
