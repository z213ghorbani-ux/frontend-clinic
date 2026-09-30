import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import * as echarts from "echarts";
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
  ChevronDown,
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
  BarChart3,
  Receipt,
  User,
  CreditCard,
} from "lucide-react";

import { PersianDatePicker } from "@/components/ui/persian-datepicker";
import reportService from "@/services/reportService";
import { SERVICE_TYPES, getServiceCode } from "@/constants/services";

// ==========================================
// ۱. کامپوننت داخلی نمودار میله‌ای پیک مراجعات (ECharts Peak Bar Chart)
// ==========================================
// ==========================================
// کامپوننت نمودار تحلیلی عملکرد منشی‌ها و کاربران (EChartsPeakBarChart)
// ==========================================
function EChartsPeakBarChart({ reports = [] }) {
  const chartRef = useRef(null);

  // استخراج و تفکیک دقیق دیتای واقعی لاگ‌ها
  const { chartData, peakUser, peakTotal } = useMemo(() => {
    const statsByUser = {};

    // تابع استخراج نام کاربر/منشی
    const resolveUserName = (item, parentReport) => {
      const u =
        item?.user ||
        item?.creator ||
        item?.operator ||
        item?.performed_by ||
        item?.author ||
        parentReport?.created_by_user ||
        parentReport?.creator ||
        parentReport?.user;

      if (typeof u === "object" && u !== null) {
        const fullName = [u.first_name, u.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();
        if (fullName) return fullName;
        if (u.name) return u.name;
        if (u.username) return u.username;
      } else if (typeof u === "string" && u.trim()) {
        return u.trim();
      }

      const flatName =
        item?.user_name ||
        item?.userName ||
        item?.created_by_name ||
        item?.performed_by_name ||
        parentReport?.created_by_name ||
        parentReport?.issued_by_name ||
        parentReport?.user_name;

      if (flatName && typeof flatName === "string" && flatName.trim()) {
        return flatName.trim();
      }

      return "کاربر سیستم";
    };

    // لیست نرمال پرونده‌ها
    const recordsList = Array.isArray(reports)
      ? reports
      : Array.isArray(reports?.data)
        ? reports.data
        : [];

    recordsList.forEach((report) => {
      // دریافت تمام لاگ‌های مربوط به این پرونده
      const logs =
        report?.audit_logs ||
        report?.history ||
        report?.hist_users ||
        report?.form_data?.history ||
        report?.form_data?.hist_users ||
        [];

      if (Array.isArray(logs) && logs.length > 0) {
        // برای هر کاربر در این پرونده، اکشن‌ها را بررسی می‌کنیم
        const userActionsInReport = {};

        logs.forEach((log) => {
          const userName = resolveUserName(log, report);
          if (!userActionsInReport[userName]) {
            userActionsInReport[userName] = {
              hasDraft: false,
              hasSettled: false,
            };
          }

          // متن عملیات یا اکشن ثبت‌شده
          const fullText = [
            log?.action,
            log?.description,
            log?.title,
            log?.type,
            log?.event,
            log?.status,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          // بررسی پیش‌فاکتور / موقت
          if (
            fullText.includes("موقت") ||
            fullText.includes("پیش") ||
            fullText.includes("draft") ||
            fullText.includes("create")
          ) {
            userActionsInReport[userName].hasDraft = true;
          }

          // بررسی ثبت نهایی و صدور فاکتور / تسویه
          if (
            fullText.includes("نهایی") ||
            fullText.includes("تسویه") ||
            fullText.includes("جوابدهی") ||
            fullText.includes("صورتحساب") ||
            fullText.includes("settle") ||
            fullText.includes("final") ||
            fullText.includes("paid")
          ) {
            userActionsInReport[userName].hasSettled = true;
          }
        });

        // اعمال آمار یکتا به ازای هر پرونده برای هر کاربر (جلوگیری از ۳ بار ثبت شدن برای یک پرونده)
        Object.keys(userActionsInReport).forEach((uName) => {
          if (!statsByUser[uName]) {
            statsByUser[uName] = { draft: 0, settled: 0 };
          }
          if (userActionsInReport[uName].hasDraft) {
            statsByUser[uName].draft += 1;
          }
          if (userActionsInReport[uName].hasSettled) {
            statsByUser[uName].settled += 1;
          }
          // در صورتی که اکشن نامشخص بود ولی کاربر لاگ داشت:
          if (
            !userActionsInReport[uName].hasDraft &&
            !userActionsInReport[uName].hasSettled
          ) {
            statsByUser[uName].settled += 1;
          }
        });
      } else {
        // فال‌بک پرونده‌های بدون لاگ تفصیلی
        const userName = resolveUserName(null, report);
        if (!statsByUser[userName]) {
          statsByUser[userName] = { draft: 0, settled: 0 };
        }

        const isDraft =
          report?.status === "draft" ||
          report?.is_draft === true ||
          report?.is_draft === 1 ||
          String(report?.status || "")
            .toLowerCase()
            .includes("draft");

        if (isDraft) {
          statsByUser[userName].draft += 1;
        } else {
          statsByUser[userName].settled += 1;
        }
      }
    });

    const categories = Object.keys(statsByUser);
    const draftData = categories.map((u) => statsByUser[u].draft);
    const settledData = categories.map((u) => statsByUser[u].settled);

    // محاسبه منشی/کاربر با بیشترین ثبت
    let bestUser = "بدون فعالیت";
    let maxTotal = 0;

    categories.forEach((user, index) => {
      const total = (draftData[index] || 0) + (settledData[index] || 0);
      if (total > maxTotal) {
        maxTotal = total;
        bestUser = user;
      }
    });

    if (categories.length > 0 && maxTotal === 0) {
      bestUser = categories[0];
    }

    return {
      chartData: { categories, draftData, settledData },
      peakUser: bestUser,
      peakTotal: maxTotal,
    };
  }, [reports]);

  // تنظیمات ECharts
  useEffect(() => {
    if (!chartRef.current) return;
    const chartInstance = echarts.init(chartRef.current);

    const isManyUsers = chartData.categories.length > 8;

    const option = {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderColor: "rgba(255, 255, 255, 0.15)",
        textStyle: {
          color: "#f8fafc",
          fontFamily: "Vazirmatn, Tahoma, sans-serif",
          fontSize: 12,
        },
        formatter: (params) => {
          let total = 0;
          let content = `<div style="font-weight: bold; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.2);">${params[0]?.name}</div>`;
          params.forEach((item) => {
            const val = Number(item.value) || 0;
            total += val;
            content += `
              <div style="display: flex; justify-content: space-between; gap: 16px; margin-top: 4px; font-size: 11px;">
                <span>${item.marker} ${item.seriesName}:</span>
                <span style="font-weight: 700;">${val.toLocaleString("fa-IR")} مورد</span>
              </div>
            `;
          });
          content += `
            <div style="display: flex; justify-content: space-between; gap: 16px; margin-top: 6px; padding-top: 4px; border-top: 1px dashed rgba(255,255,255,0.2); font-weight: bold; color: #38bdf8;">
              <span>مجموع عملکرد:</span>
              <span>${total.toLocaleString("fa-IR")} مورد</span>
            </div>
          `;
          return content;
        },
      },
      grid: {
        left: "2%",
        right: "3%",
        bottom: isManyUsers ? "16%" : "8%",
        top: "12%",
        containLabel: true,
      },
      dataZoom: isManyUsers
        ? [
            {
              type: "inside",
              start: 0,
              end: Math.min(
                100,
                Math.round((7 / chartData.categories.length) * 100),
              ),
              zoomOnMouseWheel: true,
              moveOnMouseMove: true,
            },
            {
              type: "slider",
              show: true,
              bottom: 4,
              height: 14,
              borderColor: "transparent",
              backgroundColor: "rgba(148, 163, 184, 0.1)",
              fillerColor: "rgba(14, 165, 233, 0.25)",
              handleStyle: { color: "#0ea5e9" },
              start: 0,
              end: Math.min(
                100,
                Math.round((7 / chartData.categories.length) * 100),
              ),
            },
          ]
        : [],
      xAxis: {
        type: "category",
        data: chartData.categories,
        axisLine: { lineStyle: { color: "#94a3b8", opacity: 0.3 } },
        axisLabel: {
          fontFamily: "Vazirmatn, Tahoma, sans-serif",
          fontSize: 11,
          interval: 0,
          rotate: chartData.categories.length > 5 ? 30 : 0,
          color: "#64748b",
        },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLabel: {
          fontFamily: "Vazirmatn, Tahoma, sans-serif",
          fontSize: 11,
          formatter: (val) => Number(val).toLocaleString("fa-IR"),
          color: "#64748b",
        },
        splitLine: {
          lineStyle: { type: "dashed", opacity: 0.2 },
        },
      },
      series: [
        {
          name: "پیش‌فاکتور / موقت",
          type: "bar",
          stack: "total",
          barMaxWidth: 20,
          barCategoryGap: "35%",
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "#a855f7" },
              { offset: 1, color: "#7c3aed" },
            ]),
            borderRadius: [0, 0, 3, 3],
          },
          data: chartData.draftData,
        },
        {
          name: "ثبت نهایی و تسویه",
          type: "bar",
          stack: "total",
          barMaxWidth: 20,
          barCategoryGap: "35%",
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "#22d3ee" },
              { offset: 1, color: "#0891b2" },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
          data: chartData.settledData,
        },
      ],
    };

    chartInstance.setOption(option, true);

    const handleResize = () => chartInstance.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chartInstance.dispose();
    };
  }, [chartData]);

  return (
    <div
      className="flex h-full w-full flex-col p-4 bg-card/60 backdrop-blur-md rounded-2xl border border-border shadow-xs mb-6"
      dir="rtl"
    >
      {/* هدر آمار و راهنمای رنگ‌ها */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/50 pb-3">
        <div className="flex flex-col gap-1 text-right">
          <span className="text-muted-foreground text-xs font-medium">
            بیشترین فعالیت ثبت پرونده
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-primary text-2xl sm:text-3xl font-bold tracking-tight">
              {peakTotal.toLocaleString("fa-IR")}
            </span>
            <span className="text-muted-foreground text-xs">
              پرونده توسط{" "}
              <span className="text-foreground font-semibold">
                «{peakUser}»
              </span>
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex shrink-0 items-center gap-4 pt-2">
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
            <span className="size-2.5 shrink-0 rounded-[3px] bg-[#0891b2] dark:bg-[#22d3ee]" />
            ثبت نهایی و تسویه
          </span>
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
            <span className="size-2.5 shrink-0 rounded-[3px] bg-[#7c3aed] dark:bg-[#a855f7]" />
            پیش‌فاکتور / موقت
          </span>
        </div>
      </div>

      {chartData.categories.length === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center text-muted-foreground text-xs">
          هنوز داده‌ای برای نمایش عملکرد منشی‌ها در این بازه ثبت نشده است.
        </div>
      ) : (
        <div className="mt-3 min-h-[260px] w-full flex-1" dir="ltr">
          <div ref={chartRef} className="w-full h-64" />
        </div>
      )}
    </div>
  );
}

// ==========================================
// ۲. کامپوننت داخلی آکاردئون لیست فاکتورها (Invoices Accordion Section)
// ==========================================
function InvoicesAccordionSection({
  reports = [],
  handleDownloadInvoice,
  formatPersianDateTime,
}) {
  const [isOpen, setIsOpen] = useState(false);

  // فیلتر کردن ردیف‌هایی که دارای صورت‌حساب معتبر هستند
  const invoiceReports = useMemo(() => {
    return reports.filter((r) => Boolean(r?.invoice));
  }, [reports]);

  return (
    <Card className="shadow-xs border-teal-100 overflow-hidden bg-white">
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-4 bg-teal-50/50 hover:bg-teal-50 cursor-pointer flex items-center justify-between transition-colors border-b border-teal-100"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-600 text-white rounded-lg">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-teal-900">
              لیست سریع و آکاردئونی فاکتورها
            </h3>
            <p className="text-xs text-teal-700/80">
              دسترسی سریع به فاکتورهای دارای ثبت مالی جهت چاپ مجدد و دانلود
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="bg-white text-teal-800 border-teal-200 text-xs font-mono"
          >
            {invoiceReports.length.toLocaleString("fa-IR")} فاکتور
          </Badge>
          <div
            className={`text-teal-700 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          >
            <ChevronDown className="w-5 h-5" />
          </div>
        </div>
      </div>

      {isOpen && (
        <CardContent className="p-0">
          {invoiceReports.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              در داده‌های این صفحه هیچ فاکتوری یافت نشد.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {invoiceReports.map((row) => {
                const inv = row.invoice || {};
                const amount = Number(
                  inv.final_amount ?? inv.total_amount ?? 0,
                );
                const discount = Number(inv.discount || 0);

                return (
                  <div
                    key={`inv-acc-${row.id}`}
                    className="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-4 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                        <User className="w-4 h-4 text-slate-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-800">
                            {row.patient?.name || "بیمار نامشخص"}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            ({row.patient?.national_code || "-"})
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                          <span>
                            پرونده:{" "}
                            <span className="font-mono font-medium">
                              {row.patient?.case_number || row.id}
                            </span>
                          </span>
                          <span>•</span>
                          <span>
                            {formatPersianDateTime(row.created_at)?.date || "-"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-left">
                        <div className="text-xs font-bold text-teal-700 font-mono">
                          {amount.toLocaleString("fa-IR")} تومان
                        </div>
                        {discount > 0 && (
                          <div className="text-[10px] text-rose-500 font-mono">
                            تخفیف: {discount.toLocaleString("fa-IR")} تومان
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-xs gap-1 border-teal-200 text-teal-700 bg-white hover:bg-teal-50"
                          title="دانلود فایل فاکتور"
                          onClick={() => handleDownloadInvoice(row, false)}
                        >
                          <Download className="w-3.5 h-3.5 text-teal-600" />
                          <span className="hidden sm:inline">دانلود</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-600 hover:text-teal-700 hover:bg-teal-50"
                          title="چاپ مستقیم فاکتور"
                          onClick={() => handleDownloadInvoice(row, true)}
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ==========================================
// ۳. کامپوننت اصلی ReportsManagement
// ==========================================
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

  // تابع کمکی برای فرمت تاریخ در فاکتور چاپی
  const formatInvoiceJalaliDate = (dateString) => {
    if (!dateString) return "-";
    try {
      const normalized =
        dateString.includes("T") || dateString.includes("Z")
          ? dateString
          : dateString.replace(" ", "T");
      const d = new Date(normalized);
      if (isNaN(d.getTime())) return String(dateString).substring(0, 10);
      return new Intl.DateTimeFormat("fa-IR", {
        calendar: "persian",
        numberingSystem: "arabext",
        timeZone: "Asia/Tehran",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    } catch {
      return String(dateString).substring(0, 10);
    }
  };

  // استخراج هوشمند نام دقیق کاربر ثبت‌کننده هر رویداد
  const extractLogUserName = (log, row) => {
    if (!log) return "کاربر سیستم";

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

  const API_BASE_URL = "http://127.0.0.1:8000";

  // تابع حل آدرس مهر پزشک
  const resolveDoctorStamp = (doctor) => {
    if (!doctor) return null;
    if (doctor.stamp_url) return doctor.stamp_url;
    const raw = doctor.stamp_path || doctor.stamp;
    if (!raw) return null;
    return `${API_BASE_URL}/storage/${raw}`;
  };

  // دانلود و پرینت مستقیم فاکتور نهایی همراه با کد خدمت و مهر و امضای همه پزشکان دخیل
  const handleDownloadInvoice = (row, autoPrint = false) => {
    // ۱. بررسی فایل پیوست تولید شده در پرونده
    const attachments = Array.isArray(row?.attachments) ? row.attachments : [];
    const invoicePdfAttachment = attachments.find(
      (a) =>
        (a?.original_name && a.original_name.includes("صورتحساب")) ||
        (a?.path && a.path.toLowerCase().endsWith(".pdf")),
    );

    // ۲. استخراج شناسه پرونده
    const recordId = row?.id || row?.invoice?.id;

    if (!recordId) {
      alert("شناسه پرونده جهت دریافت فاکتور یافت نشد.");
      return;
    }

    // ۳. تعیین آدرس اندپوینت نهایی PDF فاکتور
    // در صورتی که فایل از قبل ایجاد شده باشد یا تولید مستقیم روی سرور مدنظر باشد
    let pdfUrl = `${API_BASE_URL}/api/portal/${recordId}/invoice-pdf`;

    if (autoPrint) {
      // باز کردن مستقیم فاکتور رسمی در تب جدید جهت مشاهده و پرینت
      window.open(pdfUrl, "_blank", "noopener,noreferrer");
    } else {
      // دانلود مستقیم فایل فاکتور PDF
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.setAttribute("download", `invoice-${recordId}.pdf`);
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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
              سوابق اقدامات کاربران، چرخه خدمات، آمار تردد و دانلود فاکتورها
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

      {/* ۱. بخش نمودار پیک مراجعات (ECharts) */}
      <EChartsPeakBarChart reports={reports} />

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

      {/* ۲. بخش آکاردئونی فاکتورها */}
      <InvoicesAccordionSection
        reports={reports}
        handleDownloadInvoice={handleDownloadInvoice}
        formatPersianDateTime={formatPersianDateTime}
      />

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
                            let logs =
                              row.audit_logs ||
                              row.history ||
                              row.form_data?.history ||
                              row.form_data?.hist_users ||
                              row.hist_users ||
                              [];

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
                                        const userName = extractLogUserName(
                                          log,
                                          row,
                                        );

                                        const actionTitle =
                                          log.action || "اقدام سیستمی";
                                        const actionDesc =
                                          log.action_description ||
                                          log.details ||
                                          log.description ||
                                          "";

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
