import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { PersianDatePicker } from "@/components/ui/persian-datepicker";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  Eye,
  Trash2,
  Archive,
  X,
  ArrowRight,
  Loader2,
  Download,
  Stethoscope,
  FileText,
} from "lucide-react";

export default function ArchivesManagement() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [archives, setArchives] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [downloadingIndex, setDownloadingIndex] = useState(null);

  const [detailItem, setDetailItem] = useState(null);

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFrom, setBulkFrom] = useState("");
  const [bulkTo, setBulkTo] = useState("");
  const [bulkError, setBulkError] = useState("");

  // استخراج نام فایل پیوست
  const extractFileName = (attachment, index) => {
    if (!attachment) return `فایل-${index + 1}`;
    if (typeof attachment === "string")
      return attachment.split("/").pop() || `فایل-${index + 1}`;
    if (typeof attachment === "object") {
      return (
        attachment.original_name ||
        attachment.name ||
        attachment.file_name ||
        (attachment.path
          ? attachment.path.split("/").pop()
          : `فایل-${index + 1}`)
      );
    }
    return `فایل-${index + 1}`;
  };

  const fetchArchives = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = {
          page,
          search: search || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        };

        const res = await api.get("/archives", { params });
        const resData = res.data;

        let list = [];
        let curPage = 1;
        let lPage = 1;
        let totalCount = 0;

        if (Array.isArray(resData)) {
          list = resData;
          totalCount = resData.length;
        } else if (resData?.data && Array.isArray(resData.data)) {
          list = resData.data;
          curPage = resData.current_page || 1;
          lPage = resData.last_page || 1;
          totalCount = resData.total || resData.data.length;
        } else if (resData?.archives) {
          list = Array.isArray(resData.archives)
            ? resData.archives
            : resData.archives.data || [];
          curPage = resData.archives.current_page || 1;
          lPage = resData.archives.last_page || 1;
          totalCount = resData.archives.total || list.length;
        }

        setArchives(list);
        setCurrentPage(curPage);
        setLastPage(lPage);
        setTotal(totalCount);
      } catch (err) {
        console.error("خطا در دریافت بایگانی:", err);
        setArchives([]);
      } finally {
        setLoading(false);
      }
    },
    [search, fromDate, toDate],
  );

  useEffect(() => {
    fetchArchives(1);
  }, [fromDate, toDate]);

  const handleDownloadAttachment = async (
    archiveId,
    attachmentIndex,
    originalFileName = "download",
  ) => {
    try {
      setDownloadingIndex(attachmentIndex);
      const response = await api.get(
        `/archives/${archiveId}/attachments/${attachmentIndex}`,
        {
          responseType: "blob",
        },
      );

      const blob = new Blob([response.data], {
        type: response.headers["content-type"] || "application/octet-stream",
      });

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", originalFileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("خطا در دانلود پیوست:", error);
      alert(error.response?.data?.message || "خطا در دانلود فایل پیوست.");
    } finally {
      setDownloadingIndex(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("آیا از حذف این رکورد بایگانی مطمئن هستید؟")) return;
    try {
      await api.delete(`/archives/${id}`);
      fetchArchives(currentPage);
    } catch (err) {
      console.error("خطا در حذف رکورد:", err);
      alert(err.response?.data?.message || "خطا در حذف رکورد");
    }
  };

  const handleBulkDelete = async () => {
    if (!bulkFrom || !bulkTo) {
      setBulkError("هر دو فیلد تاریخ باید وارد شوند.");
      return;
    }
    try {
      const res = await api.post("/archives/bulk-delete", {
        from_date: bulkFrom,
        to_date: bulkTo,
      });
      alert(res.data?.message || "حذف با موفقیت انجام شد");
      setShowBulkModal(false);
      setBulkFrom("");
      setBulkTo("");
      setBulkError("");
      fetchArchives(1);
    } catch (err) {
      console.error("خطا در حذف گروهی:", err);
      setBulkError(err.response?.data?.message || "خطا در حذف بایگانی‌ها.");
    }
  };

  const getAttachments = (item) => {
    const a = item?.attachments;
    if (Array.isArray(a)) return a;
    try {
      return JSON.parse(a || "[]");
    } catch {
      return [];
    }
  };

  const formatFaDateTime = (v) => {
    if (!v) return "—";

    let dateStr = typeof v === "string" ? v.replace(" ", "T") : v;
    if (
      typeof dateStr === "string" &&
      !dateStr.endsWith("Z") &&
      !dateStr.includes("+")
    ) {
      dateStr += "Z";
    }

    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(v);

    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  };

  // تابع کمکی برای پارس ایمن JSON فرم دیتا
  const getParsedFormData = (item) => {
    if (!item?.form_data) return null;
    let data = item.form_data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch (e) {
        return null;
      }
    }
    return data;
  };

  // تابع کمکی برای پارس ایمن فیلد history
  const getParsedHistory = (item) => {
    if (!item?.history) return null;
    let data = item.history;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch (e) {
        return null;
      }
    }
    return Array.isArray(data) ? data : null;
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-6 space-y-6" dir="rtl">
        <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 border-slate-300 hover:bg-slate-100"
            >
              <ArrowRight className="w-4 h-4" />
              <span>بازگشت به داشبورد</span>
            </Button>
            <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800">
              <Archive className="w-6 h-6 text-teal-600" />
              بایگانی و سوابق
            </h1>
          </div>

          <Button
            variant="destructive"
            onClick={() => {
              setShowBulkModal(true);
              setBulkError("");
            }}
          >
            <Trash2 className="w-4 h-4 ml-1" />
            حذف بایگانی‌ها
          </Button>
        </div>

        <Card className="shadow-2xs border-slate-200">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-700">
              جستجو و فیلتر
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600">
                  جستجو (نام / کد ملی / پرونده / موبایل)
                </Label>
                <div className="relative">
                  <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-400" />
                  <Input
                    className="pr-8 h-10 border-slate-300"
                    placeholder="جستجو..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && fetchArchives(1)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600">
                  از تاریخ
                </Label>
                <PersianDatePicker value={fromDate} onChange={setFromDate} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600">
                  تا تاریخ
                </Label>
                <PersianDatePicker value={toDate} onChange={setToDate} />
              </div>
              <Button
                onClick={() => fetchArchives(1)}
                disabled={loading}
                className="h-10 bg-teal-600 hover:bg-teal-700 text-white"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "اعمال فیلتر"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-2xs border-slate-200">
          <CardContent className="p-0">
            <div className="overflow-x-auto min-h-[250px] relative">
              {loading && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-10">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                </div>
              )}

              <Table>
                <TableHeader className="bg-slate-50 border-b border-slate-200">
                  <TableRow>
                    <TableHead className="text-right font-bold">
                      نام بیمار
                    </TableHead>
                    <TableHead className="text-center font-bold">
                      کد ملی
                    </TableHead>
                    <TableHead className="text-center font-bold">
                      شماره پرونده
                    </TableHead>
                    <TableHead className="text-center font-bold">
                      موبایل
                    </TableHead>
                    <TableHead className="text-center font-bold">
                      صدورکننده جواب
                    </TableHead>
                    <TableHead className="text-center font-bold">
                      تاریخ ثبت صدور
                    </TableHead>
                    <TableHead className="text-center font-bold">
                      عملیات
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archives.length === 0 && !loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-10 text-slate-400"
                      >
                        رکوردی یافت نشد
                      </TableCell>
                    </TableRow>
                  ) : (
                    archives.map((item) => (
                      <TableRow key={item.id} className="hover:bg-slate-50/70">
                        <TableCell className="font-semibold text-slate-800">
                          {item.patient_name || item.patient?.name || "—"}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs text-slate-600">
                          {item.national_code ||
                            item.patient?.national_code ||
                            "—"}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs text-slate-600">
                          {item.file_number || item.patient?.case_number || "—"}
                        </TableCell>
                        <TableCell
                          className="text-center font-mono text-xs text-slate-600"
                          dir="ltr"
                        >
                          {item.mobile || item.patient?.phone || "—"}
                        </TableCell>
                        <TableCell className="text-center text-slate-700">
                          {item.issued_by_name || item.issuer?.name || "—"}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs text-slate-500">
                          {formatFaDateTime(item.issued_at || item.created_at)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 text-teal-600 border-slate-300"
                                  onClick={() => setDetailItem(item)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>مشاهده جزئیات</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="h-8 w-8 bg-rose-600 hover:bg-rose-700"
                                  onClick={() => handleDelete(item.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>حذف رکورد</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between p-2">
          <span className="text-xs text-slate-500">
            مجموع: {total} رکورد — صفحه {currentPage} از {lastPage}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || loading}
              onClick={() => fetchArchives(currentPage - 1)}
            >
              قبلی
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= lastPage || loading}
              onClick={() => fetchArchives(currentPage + 1)}
            >
              بعدی
            </Button>
          </div>
        </div>

        {/* مودال مشاهده جزئیات */}
        {detailItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 border border-slate-200">
              <div className="flex items-center justify-between border-b pb-3">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-teal-600" />
                  جزئیات پرونده بایگانی
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDetailItem(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* لینک پرتال آنلاین بیمار */}
              <div className="mt-4 p-3 bg-teal-50 border border-teal-100 rounded-lg">
                <h3 className="font-bold text-xs text-teal-800 mb-2">
                  لینک پرتال آنلاین بیمار:
                </h3>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/portal/${detailItem.tracking_token || "بدون توکن"}`}
                    className="text-xs font-mono h-8 bg-white"
                  />
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-teal-600 hover:bg-teal-700"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/portal/${detailItem.tracking_token}`,
                      );
                      alert("لینک کپی شد");
                    }}
                  >
                    کپی
                  </Button>
                </div>
              </div>

              {/* مشخصات اصلی بیمار */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <p>
                  <b className="text-slate-600">نام بیمار:</b>{" "}
                  <span className="font-semibold text-slate-800">
                    {detailItem.patient_name || detailItem.patient?.name || "—"}
                  </span>
                </p>
                <p>
                  <b className="text-slate-600">کد ملی:</b>{" "}
                  <span className="font-mono">
                    {detailItem.national_code ||
                      detailItem.patient?.national_code ||
                      "—"}
                  </span>
                </p>
                <p>
                  <b className="text-slate-600">شماره پرونده:</b>{" "}
                  <span className="font-mono">
                    {detailItem.file_number ||
                      detailItem.patient?.case_number ||
                      "—"}
                  </span>
                </p>
                <p>
                  <b className="text-slate-600">موبایل:</b>{" "}
                  <span className="font-mono" dir="ltr">
                    {detailItem.mobile || detailItem.patient?.phone || "—"}
                  </span>
                </p>
                <p>
                  <b className="text-slate-600">صدورکننده:</b>{" "}
                  <span>
                    {detailItem.issued_by_name ||
                      detailItem.issuer?.name ||
                      "—"}
                  </span>
                </p>
                <p>
                  <b className="text-slate-600">تاریخ صدور:</b>{" "}
                  <span>
                    {formatFaDateTime(
                      detailItem.issued_at || detailItem.created_at,
                    )}
                  </span>
                </p>
              </div>

              {/* اطلاعات فرم، خدمات و تاریخچه فعالیت‌ها */}
              {(() => {
                const formData = getParsedFormData(detailItem);
                const directHistory = getParsedHistory(detailItem);

                // استخراج تاریخچه از تمام منابع احتمالی با اولویت داده‌های معتبر
                const auditTrail =
                  (Array.isArray(directHistory) && directHistory.length > 0
                    ? directHistory
                    : null) ||
                  (Array.isArray(formData?.hist_users) &&
                  formData.hist_users.length > 0
                    ? formData.hist_users
                    : null) ||
                  (Array.isArray(formData?.history) &&
                  formData.history.length > 0
                    ? formData.history
                    : null) ||
                  [];

                // لیست خدمات
                const services = Array.isArray(formData?.services)
                  ? formData.services
                  : [];

                // فاکتور
                const invoice = formData?.invoiceDetails || null;

                return (
                  <div className="space-y-4">
                    {/* بخش خدمات ارائه شده */}
                    {services.length > 0 && (
                      <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
                        <h3 className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                          <Stethoscope className="w-4 h-4 text-teal-600" />
                          خدمات ارائه شده ({services.length} خدمت)
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {services.map((srv, idx) => {
                            const srvCode =
                              srv.service_code ||
                              srv.serviceCode ||
                              srv.code ||
                              "—";
                            return (
                              <div
                                key={idx}
                                className="text-xs bg-slate-50 border border-slate-100 p-2.5 rounded flex justify-between items-center"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[11px] bg-teal-50 text-teal-700 font-bold px-1.5 py-0.5 rounded border border-teal-200">
                                    {srvCode}
                                  </span>
                                  <span className="font-medium text-slate-800">
                                    {srv.serviceTitle ||
                                      srv.title ||
                                      srv.serviceId ||
                                      "خدمت"}
                                  </span>
                                </div>
                                <span className="text-slate-500 text-[11px]">
                                  پزشک:{" "}
                                  {srv.doctorName || srv.doctor?.name || "—"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* خلاصه وضعیت فاکتور و اطلاعات کلی */}
                    {formData && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                        <div>
                          <span className="text-slate-500">تعداد خدمات: </span>
                          <span className="font-bold font-mono">
                            {formData.totalItemsCount || services.length || "0"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">صدور فاکتور: </span>
                          <span className="font-bold">
                            {formData.hasInvoice ? "دارد" : "ندارد"}
                          </span>
                        </div>
                        {invoice?.totalPrice && (
                          <div>
                            <span className="text-slate-500">مبلغ کل: </span>
                            <span className="font-bold font-mono text-teal-700">
                              {Number(invoice.totalPrice).toLocaleString(
                                "fa-IR",
                              )}{" "}
                              ریال
                            </span>
                          </div>
                        )}
                        {formData.submittedAt && (
                          <div>
                            <span className="text-slate-500">
                              زمان ثبت نهایی:{" "}
                            </span>
                            <span className="font-mono">
                              {formatFaDateTime(formData.submittedAt)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* بخش تاریخچه فعالیت کاربران (Audit Trail) */}
                    {auditTrail.length > 0 && (
                      <div className="pt-2 border-t border-slate-200">
                        <h3 className="font-bold text-xs text-slate-700 mb-2">
                          تاریخچه فعالیت کاربران (Audit Trail)
                        </h3>
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                          <Table className="text-xs">
                            <TableHeader className="bg-slate-50">
                              <TableRow>
                                <TableHead className="text-right">
                                  کاربر
                                </TableHead>
                                <TableHead className="text-right">
                                  عملیات
                                </TableHead>
                                <TableHead className="text-center">
                                  زمان
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {auditTrail.map((log, idx) => {
                                // استخراج جامع نام کاربر
                                const userName =
                                  (typeof log === "string" ? log : null) ||
                                  log.user_name ||
                                  log.userName ||
                                  log.actor_name ||
                                  log.created_by_name ||
                                  log.author ||
                                  log.user?.name ||
                                  log.user?.full_name ||
                                  log.user?.username ||
                                  (typeof log.user === "string"
                                    ? log.user
                                    : null) ||
                                  log.name ||
                                  (log.action?.includes("ثبت نهایی")
                                    ? detailItem.issued_by_name ||
                                      detailItem.issuer?.name
                                    : null) ||
                                  "کاربر سیستم";

                                // استخراج عنوان عملیات
                                const actionTitle =
                                  log.action ||
                                  log.action_title ||
                                  log.action_description ||
                                  log.description ||
                                  log.title ||
                                  "ثبت خدمت موقت";

                                // استخراج زمان ثبت
                                const logTime =
                                  log.created_at ||
                                  log.at ||
                                  log.time ||
                                  log.timestamp ||
                                  log.date ||
                                  detailItem.issued_at ||
                                  detailItem.created_at;

                                return (
                                  <TableRow
                                    key={idx}
                                    className="hover:bg-slate-50/50"
                                  >
                                    <TableCell className="font-medium text-slate-800">
                                      <span className="inline-flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                                        {userName}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-slate-600">
                                      {actionTitle}
                                    </TableCell>
                                    <TableCell
                                      className="text-center font-mono text-slate-600"
                                      dir="ltr"
                                    >
                                      {formatFaDateTime(logTime)}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* فایل‌های پیوست */}
              <div className="border-t border-slate-200 pt-3">
                <h3 className="font-bold text-xs text-slate-700 mb-2">
                  فایل‌های پیوست
                </h3>
                {getAttachments(detailItem).length === 0 ? (
                  <p className="text-xs text-slate-400">
                    فایلی پیوست نشده است.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {getAttachments(detailItem).map((attachment, i) => {
                      const fileName = extractFileName(attachment, i);
                      return (
                        <li key={i}>
                          <button
                            type="button"
                            disabled={downloadingIndex === i}
                            onClick={() =>
                              handleDownloadAttachment(
                                detailItem.id,
                                i,
                                fileName,
                              )
                            }
                            className="text-teal-600 hover:underline text-xs flex items-center gap-1.5 font-mono cursor-pointer bg-transparent border-0 p-0 disabled:opacity-50"
                          >
                            {downloadingIndex === i ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            <span>
                              دانلود فایل {i + 1} ({fileName})
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* مودال حذف گروهی */}
        {showBulkModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
              <div className="flex items-center justify-between border-b pb-3">
                <h2 className="text-base font-bold text-rose-600">
                  حذف گروهی بایگانی‌ها
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowBulkModal(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                تمام رکوردهای بایگانی در بازه تاریخ انتخابی به‌طور کامل حذف
                خواهند شد. این عمل قابل بازگشت نیست.
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    از تاریخ
                  </Label>
                  <PersianDatePicker value={bulkFrom} onChange={setBulkFrom} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    تا تاریخ
                  </Label>
                  <PersianDatePicker value={bulkTo} onChange={setBulkTo} />
                </div>
              </div>
              {bulkError && (
                <p className="text-xs text-rose-600">{bulkError}</p>
              )}
              <Button
                variant="destructive"
                className="w-full bg-rose-600 hover:bg-rose-700 text-xs h-10"
                onClick={handleBulkDelete}
              >
                <Trash2 className="w-4 h-4 ml-1.5" />
                تایید و حذف بایگانی‌ها
              </Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
