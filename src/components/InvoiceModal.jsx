import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Printer, Check, FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getServiceCode } from "@/constants/services";

// تابع کمکی برای حل دقیق آدرس مهر پزشک با اولویت stamp_url ارسالی از لاراول
const resolveStampUrl = (doctorObj, rawStamp) => {
  if (doctorObj?.stamp_url) {
    return doctorObj.stamp_url;
  }

  const target = rawStamp || doctorObj?.stamp_path || doctorObj?.stamp;
  if (!target || typeof target !== "string") return null;
  const trimmed = target.trim();
  if (trimmed === "" || trimmed === "null" || trimmed === "undefined")
    return null;

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }

  const cleanPath = trimmed.replace(/^\/?(storage\/)?/, "");
  return `/storage/${cleanPath}`;
};

export default function InvoiceModal({
  isOpen,
  onClose,
  queueItems = [],
  onConfirmInvoice,
}) {
  const [itemPrices, setItemPrices] = useState({});
  const [discount, setDiscount] = useState(0);

  // استخراج خدمات به همراه اطلاعات کامل بیمار، پزشک و کد خدمت
  const flattenedServices = (queueItems || []).flatMap((q, qIdx) =>
    (q.services || []).map((s, sIdx) => {
      const patientFullName =
        q.patient?.full_name ||
        `${q.patient?.first_name || ""} ${q.patient?.last_name || ""}`.trim() ||
        q.patientName ||
        "نامشخص";

      const nationalId =
        q.patient?.national_id ||
        q.patient?.national_code ||
        q.nationalCode ||
        "---";

      const doctorFullName =
        q.doctor?.name ||
        q.doctor?.full_name ||
        s.doctor?.name ||
        s.doctorName ||
        q.doctorName ||
        "---";

      const doctorObject = q.doctor || s.doctor || null;
      const rawStamp =
        q.doctor?.stamp_url ||
        q.doctor?.stamp_path ||
        s.doctor?.stamp_url ||
        s.doctor?.stamp_path ||
        s.stampUrl ||
        s.stamp_url ||
        null;

      const doctorStampUrl = resolveStampUrl(doctorObject, rawStamp);

      const serviceName =
        s.serviceId === "other"
          ? s.customName || "سایر خدمات"
          : s.serviceTitle || s.name || s.title || s.serviceId || "خدمت درمانی";

      const serviceCode =
        s.service_code || s.serviceCode || getServiceCode(s.serviceId || s.id);

      return {
        uniqueKey: `${q.tempId || q.id || qIdx}-${s.serviceId || s.id || sIdx}`,
        tempId: q.tempId || q.id,
        serviceId: s.serviceId || s.id,
        serviceCode: serviceCode,
        patientName: patientFullName,
        nationalCode: nationalId,
        doctorName: doctorFullName,
        doctorStamp: doctorStampUrl,
        serviceTitle: serviceName,
        defaultPrice: Number(s.price) || 0,
      };
    }),
  );

  // هماهنگ‌سازی قیمت‌ها هنگام باز شدن مدال یا تغییر آیتم‌های صف
  useEffect(() => {
    if (isOpen) {
      const initialPrices = {};
      flattenedServices.forEach((item) => {
        initialPrices[item.uniqueKey] = item.defaultPrice;
      });
      setItemPrices(initialPrices);
      setDiscount(0);
    }
  }, [isOpen, queueItems]);

  const handlePriceChange = (uniqueKey, value) => {
    setItemPrices((prev) => ({
      ...prev,
      [uniqueKey]: value === "" ? "" : Number(value),
    }));
  };

  // محاسبات مالی
  const totalPrice = flattenedServices.reduce(
    (sum, item) => sum + (Number(itemPrices[item.uniqueKey]) || 0),
    0,
  );
  const discountValue = Number(discount) || 0;
  const payableAmount = Math.max(0, totalPrice - discountValue);

  // تابع پرینت
  const handlePrint = () => {
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const invoiceDate = new Intl.DateTimeFormat("fa-IR").format(new Date());
    const invoiceTime = new Date().toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // استخراج تمام پزشکان یکتا به همراه مهرشان (رفع مشکل نمایش فقط یک مهر)
    const uniqueDoctorsForPrint = [];
    const seenDoctorNames = new Set();
    flattenedServices.forEach((item) => {
      if (
        item.doctorName &&
        item.doctorName !== "---" &&
        !seenDoctorNames.has(item.doctorName)
      ) {
        seenDoctorNames.add(item.doctorName);
        uniqueDoctorsForPrint.push({
          name: item.doctorName,
          stamp: item.doctorStamp || null,
        });
      }
    });
    if (uniqueDoctorsForPrint.length === 0) {
      uniqueDoctorsForPrint.push({ name: "پزشک معالج", stamp: null });
    }

    let rowsHtml = "";
    flattenedServices.forEach((item, idx) => {
      const price = Number(itemPrices[item.uniqueKey]) || 0;
      rowsHtml += `
      <tr>
        <td style="text-align:center;border:1px solid #cbd5e1;padding:8px;">${idx + 1}</td>
        <td style="text-align:center;border:1px solid #cbd5e1;padding:8px;font-family:monospace;font-weight:bold;color:#0f766e;" dir="ltr">${item.serviceCode}</td>
        <td style="border:1px solid #cbd5e1;padding:8px;font-weight:bold;">${item.serviceTitle}</td>
        <td style="border:1px solid #cbd5e1;padding:8px;">${item.patientName} (${item.nationalCode})</td>
        <td style="border:1px solid #cbd5e1;padding:8px;">${item.doctorName}</td>
        <td style="text-align:center;border:1px solid #cbd5e1;padding:8px;font-family:Tahoma,sans-serif;">
          ${price.toLocaleString("fa-IR")} تومان
        </td>
      </tr>
    `;
    });

    // ساخت یک کادر امضا برای هر پزشک یکتا (رفع مشکل نمایش فقط یک مهر)
    let doctorSignatureBoxesHtml = "";
    uniqueDoctorsForPrint.forEach((doc) => {
      doctorSignatureBoxesHtml += `
    <div class="signature-box">
      <p class="signature-title">مهر و امضای ${doc.name}</p>
      <div class="stamp-space">
        ${
          doc.stamp
            ? `<img class="doctor-stamp-img" src="${doc.stamp}" alt="مهر پزشک" />
               <span class="stamp-placeholder" style="display:none;">محل درج مهر و امضا</span>`
            : `<span class="stamp-placeholder">محل درج مهر و امضا</span>`
        }
      </div>
      <div class="signature-line"></div>
    </div>`;
    });

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      alert("خطا در آماده‌سازی چاپ. لطفاً دوباره تلاش کنید.");
      document.body.removeChild(iframe);
      return;
    }

    const htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8" />
  <title>صورت‌حساب - ${invoiceNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    * { box-sizing: border-box; }
    body { font-family: Tahoma, 'Segoe UI', Arial, sans-serif; direction: rtl; margin: 0; padding: 20px; color: #1e293b; font-size: 13px; }
    .header { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 10px; margin-bottom: 15px; }
    .header h2 { margin: 0 0 5px; color: #0f766e; font-size: 20px; }
    .meta-box { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 6px; margin-bottom: 15px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background-color: #f1f5f9; color: #334155; padding: 10px; border: 1px solid #cbd5e1; text-align: right; font-size: 13px; }
    td { font-size: 13px; }
    .summary-wrap { display: flex; justify-content: flex-end; margin-bottom: 30px; page-break-inside: avoid; }
    .summary-table { width: 320px; border-collapse: collapse; }
    .summary-table td { padding: 8px 12px; border: 1px solid #e2e8f0; }
    .total-row { background: #0f766e; color: #fff; font-weight: bold; }
    .signatures-container { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 20px; margin-top: 40px; padding: 0 20px; page-break-inside: avoid; }
    .signature-box { text-align: center; min-width: 180px; max-width: 220px; display: flex; flex-direction: column; align-items: center; }
    .signature-title { margin: 0 0 10px; font-weight: bold; color: #334155; font-size: 13px; }
    .stamp-space { height: 90px; width: 100%; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
    .stamp-space img { max-height: 85px; max-width: 170px; object-fit: contain; }
    .stamp-placeholder { color: #94a3b8; font-size: 12px; border: 1px dashed #cbd5e1; padding: 6px 14px; border-radius: 4px; }
    .signature-line { border-top: 1px dashed #64748b; width: 180px; margin: 0 auto; }
    .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 10px; page-break-inside: avoid; }
  </style>
</head>
<body>
  <div class="header">
    <h2>صورت‌حساب خدمات درمانی کلینیک آریتمی</h2>
    <p style="margin: 0; color: #64748b; font-size: 13px;">سیستم مدیریت یکپارچه درمانگاه</p>
  </div>

  <div class="meta-box">
    <span><strong>شماره فاکتور:</strong> ${invoiceNumber}</span>
    <span><strong>تاریخ و ساعت:</strong> ${invoiceDate} - ${invoiceTime}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 35px; text-align: center;">#</th>
        <th style="width: 100px; text-align: center;">کد خدمت</th>
        <th>عنوان خدمت</th>
        <th>بیمار (کد ملی)</th>
        <th>پزشک</th>
        <th style="width: 140px; text-align: center;">مبلغ</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="summary-wrap">
    <table class="summary-table">
      <tr>
        <td>جمع کل:</td>
        <td style="text-align: left;">${totalPrice.toLocaleString("fa-IR")} تومان</td>
      </tr>
      <tr>
        <td>تخفیف:</td>
        <td style="text-align: left;">${discountValue.toLocaleString("fa-IR")} تومان</td>
      </tr>
      <tr class="total-row">
        <td style="border-color: #0f766e;">مبلغ قابل پرداخت:</td>
        <td style="text-align: left; border-color: #0f766e;">${payableAmount.toLocaleString("fa-IR")} تومان</td>
      </tr>
    </table>
  </div>

  <div class="signatures-container">
    <div class="signature-box">
      <p class="signature-title">امضا و تایید پذیرش / صندوق</p>
      <div class="stamp-space"></div>
      <div class="signature-line"></div>
    </div>

    ${doctorSignatureBoxesHtml}
  </div>

  <div class="footer">
    این برگه به عنوان تاییدیه مالی و پذیرش خدمات درمانی صادر شده است.
  </div>

  <script>
    (function () {
      function cleanup() {
        setTimeout(function () {
          try { parent.document.body.removeChild(frameElement); } catch (e) {}
        }, 500);
      }

      function doPrint() {
        try {
          window.focus();
          window.print();
        } finally {
          cleanup();
        }
      }

      window.onload = function () {
        var imgs = Array.prototype.slice.call(document.querySelectorAll('.doctor-stamp-img'));

        if (imgs.length === 0) {
          doPrint();
          return;
        }

        var remaining = imgs.length;
        function settled() {
          remaining -= 1;
          if (remaining <= 0) doPrint();
        }

        imgs.forEach(function (img) {
          if (img.complete && img.naturalWidth > 0) {
            settled();
            return;
          }

          img.onerror = function () {
            try {
              img.style.display = 'none';
              var ph = img.parentElement.querySelector('.stamp-placeholder');
              if (ph) ph.style.display = 'inline-block';
            } catch (e) {}
            settled();
          };

          img.onload = settled;
        });
      };
    })();
  </script>
</body>
</html>`;

    doc.open();
    doc.write(htmlContent);
    doc.close();
  };

  // تایید و اعمال نهایی
  const handleConfirm = () => {
    const updatedQueue = queueItems.map((q, qIdx) => {
      const updatedServices = (q.services || []).map((s, sIdx) => {
        const key = `${q.tempId || q.id || qIdx}-${s.serviceId || s.id || sIdx}`;
        const code =
          s.service_code ||
          s.serviceCode ||
          getServiceCode(s.serviceId || s.id);

        return {
          ...s,
          service_code: code,
          serviceCode: code,
          price: Number(itemPrices[key]) || 0,
        };
      });

      return {
        ...q,
        services: updatedServices,
      };
    });

    if (typeof onConfirmInvoice === "function") {
      onConfirmInvoice({
        updatedQueue,
        totalPrice,
        discount: discountValue,
        payableAmount,
      });
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-4xl w-[95vw] lg:max-w-5xl max-h-[90vh] overflow-y-auto p-6"
        dir="rtl"
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center justify-between border-b pb-3 text-slate-800">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-600" />
              <span>پیش‌فاکتور و تسویه خدمات ثبت‌شده</span>
            </div>
            <span className="text-xs font-normal text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              تعداد ردیف‌ها: {flattenedServices.length}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead className="w-28 text-center font-bold">
                    کد خدمت
                  </TableHead>
                  <TableHead className="text-right font-bold">خدمت</TableHead>
                  <TableHead className="text-right font-bold">بیمار</TableHead>
                  <TableHead className="text-right font-bold">پزشک</TableHead>
                  <TableHead className="text-center w-44 font-bold">
                    تعرفه / مبلغ (تومان)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flattenedServices.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-6 text-slate-400"
                    >
                      هیچ آیتمی برای صدور فاکتور در صف وجود ندارد.
                    </TableCell>
                  </TableRow>
                ) : (
                  flattenedServices.map((item, idx) => (
                    <TableRow
                      key={item.uniqueKey}
                      className="hover:bg-slate-50/60"
                    >
                      <TableCell className="text-center text-slate-500">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="text-center font-mono font-semibold text-teal-700 bg-teal-50/50 rounded-md">
                        {item.serviceCode}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-800">
                        {item.serviceTitle}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {item.patientName}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {item.doctorName}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={itemPrices[item.uniqueKey] ?? ""}
                          placeholder="0"
                          onChange={(e) =>
                            handlePriceChange(item.uniqueKey, e.target.value)
                          }
                          className="h-9 text-center font-mono font-medium text-sm border-slate-300 focus:border-teal-500"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">جمع خدمات:</span>
              <span className="font-bold text-slate-800 font-mono">
                {totalPrice.toLocaleString("fa-IR")} تومان
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">تخفیف کل:</span>
              <Input
                type="number"
                value={discount === 0 ? "" : discount}
                placeholder="0"
                onChange={(e) =>
                  setDiscount(e.target.value === "" ? 0 : e.target.value)
                }
                className="w-28 h-9 text-center font-mono text-sm bg-white"
              />
              <span className="text-xs text-slate-500">تومان</span>
            </div>

            <div className="flex items-center gap-2 font-bold text-teal-900 bg-teal-100/70 px-4 py-2 rounded-lg border border-teal-200">
              <span className="text-sm">مبلغ نهایی:</span>
              <span className="font-mono text-base">
                {payableAmount.toLocaleString("fa-IR")} تومان
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-row justify-between items-center gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrint}
            disabled={flattenedServices.length === 0}
            className="gap-2 border-slate-300"
          >
            <Printer className="w-4 h-4 text-slate-700" />
            چاپ فاکتور / PDF
          </Button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              انصراف
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={flattenedServices.length === 0}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2 px-6"
            >
              <Check className="w-4 h-4" />
              تایید و اعمال قیمت‌ها
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
