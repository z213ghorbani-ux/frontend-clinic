import React, { useRef, useMemo } from "react";

export default function InvoiceModal({ isOpen, onClose, invoiceData }) {
  const printAreaRef = useRef();

  // نرمال‌سازی و استخراج داینامیک دیتای دریافتی از بک‌اند لاراول
  const data = useMemo(() => {
    if (!invoiceData) return null;

    const root = invoiceData.data || invoiceData.archive || invoiceData;
    const formData = root.form_data || root.formData || {};
    const patientObj = root.patient || formData.patient || {};
    const doctorObj = root.doctor || formData.doctor || {};

    // شماره پرونده و کد رهگیری
    const fileNumber =
      root.file_number ||
      formData.file_number ||
      root.report_id ||
      formData.report_id ||
      root.id ||
      "---";

    const trackingCode =
      root.tracking_code ||
      root.invoice_number ||
      formData.invoice_number ||
      root.code ||
      formData.tracking_code ||
      `INV-${root.id || "0000"}`;

    // تاریخ و ساعت صدور
    const issueDate =
      root.issue_date ||
      formData.issue_date ||
      root.visit_date ||
      formData.visit_date ||
      root.created_at_jalali ||
      formData.date ||
      "۱۴۰۵/۰۷/۰۸";

    const issueTime =
      root.issue_time ||
      formData.issue_time ||
      root.time ||
      formData.time ||
      "۱۰:۰۹:۲۹";

    // اطلاعات بیمار
    const patientName =
      patientObj.name ||
      patientObj.full_name ||
      [patientObj.first_name, patientObj.last_name].filter(Boolean).join(" ") ||
      formData.patient_name ||
      root.patient_name ||
      "بیمار محترم";

    const nationalCode =
      patientObj.national_code ||
      patientObj.nationalCode ||
      formData.national_code ||
      root.national_code ||
      "---";

    const mobile =
      patientObj.mobile ||
      patientObj.phone ||
      formData.mobile ||
      formData.phone ||
      root.mobile ||
      "---";

    // اطلاعات پزشک معالج و مهر/امضا
    const doctorName =
      doctorObj.name ||
      doctorObj.full_name ||
      [doctorObj.first_name, doctorObj.last_name].filter(Boolean).join(" ") ||
      formData.doctor_name ||
      root.doctor_name ||
      "دکتر مهدی فتحی";

    const doctorSpecialty =
      doctorObj.specialty ||
      formData.doctor_specialty ||
      "بورد تخصصی قلب و عروق\nفلوشیپ الکتروفیزیولوژیست\nنظام پزشکی: ۱۱۹۱۰۲";

    const doctorSignatureUrl =
      doctorObj.signature_url ||
      doctorObj.signatureStampUrl ||
      formData.doctor_signature ||
      root.signature_url ||
      null;

    // استخراج و یکپارچه‌سازی لیست خدمات
    const rawServices =
      root.services ||
      formData.services ||
      root.items ||
      formData.items ||
      formData.selectedServices ||
      [];

    const servicesList = Array.isArray(rawServices)
      ? rawServices.map((item, index) => ({
          id: index + 1,
          code: item.code || item.service_code || item.tariff_code || "---",
          name: item.name || item.title || item.service_name || "خدمت درمانی",
          doctor: item.doctor_name || item.doctor || doctorName,
          price: Number(
            item.price || item.amount || item.tariff || item.cost || 0,
          ),
        }))
      : [];

    // خلاصه خدمات برای گواهی صفحه اول
    const servicesSummaryText =
      servicesList.length > 0
        ? servicesList
            .map((s) => s.name)
            .slice(0, 5)
            .join("، ") + (servicesList.length > 5 ? " و سایر خدمات..." : "")
        : "ویزیت و خدمات درمانی و بالینی";

    // محاسبات مالی
    const computedTotal = servicesList.reduce(
      (acc, curr) => acc + curr.price,
      0,
    );
    const totalAmount =
      root.total_amount || formData.total_amount || computedTotal;
    const payableAmount =
      root.payable_amount || formData.payable_amount || totalAmount;
    const discountAmount =
      root.discount_amount || formData.discount_amount || 0;
    const paymentMethod =
      root.payment_method || formData.payment_method || "نقدی / کارت‌خوان";

    return {
      fileNumber,
      trackingCode,
      issueDate,
      issueTime,
      patientName,
      nationalCode,
      mobile,
      doctorName,
      doctorSpecialty,
      doctorSignatureUrl,
      servicesList,
      servicesSummaryText,
      totalAmount,
      discountAmount,
      payableAmount,
      paymentMethod,
    };
  }, [invoiceData]);

  if (!isOpen || !data) return null;

  const handlePrint = () => {
    window.print();
  };

  const formatNumber = (num) => {
    return Number(num || 0).toLocaleString("fa-IR");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      {/* استایل‌های پرینت استاندارد ۲ صفحه‌ای A4 */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          body * {
            visibility: hidden;
          }
          #official-invoice-print-area, #official-invoice-print-area * {
            visibility: visible;
          }
          #official-invoice-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: white !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-before: always;
            break-before: page;
            height: 0;
            margin: 0;
          }
        }
      `}</style>

      {/* کانتینر مودال */}
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[94vh]">
        {/* نوار بالای مودال (غیرقابل چاپ) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-600 inline-block"></span>
            <h3 className="text-base font-bold text-gray-800">
              صورتحساب رسمی مرکز آریتمی تهران (چاپ ۲ صفحه‌ای بیمار)
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
              چاپ فاکتور (A4)
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* ناحیه محتوا و برگه چاپ */}
        <div className="overflow-y-auto p-4 md:p-8 bg-slate-100 flex justify-center">
          <div
            id="official-invoice-print-area"
            ref={printAreaRef}
            dir="rtl"
            className="w-full max-w-[210mm] bg-white p-8 rounded-lg shadow-sm text-slate-800"
            style={{ fontFamily: "'Vazirmatn', Tahoma, sans-serif" }}
          >
            {/* ========================================================================= */}
            {/* صفحه ۱: اطلاعات پرونده و تاییدیه پزشک */}
            {/* ========================================================================= */}
            <div className="min-h-[265mm] flex flex-col justify-between">
              <div>
                {/* نوار شماره صفحه */}
                <div className="bg-slate-100 text-slate-600 text-[10px] font-bold px-3 py-1 rounded flex justify-between items-center mb-4">
                  <span>صفحه ۱ از ۲ (اطلاعات پرونده و تاییدیه پزشک)</span>
                  <span>مرکز آریتمی تهران</span>
                </div>

                {/* سربرگ */}
                <div className="flex justify-between items-start border-b-2 border-cyan-700 pb-4 mb-4">
                  <div className="text-right text-[11px] leading-relaxed text-slate-600">
                    <div>
                      شماره پرونده / فاکتور:{" "}
                      <strong className="font-mono text-slate-800">
                        {data.fileNumber}
                      </strong>
                    </div>
                    <div>
                      کد رهگیری:{" "}
                      <strong className="font-mono text-slate-800">
                        {data.trackingCode}
                      </strong>
                    </div>
                    <div>
                      تاریخ صدور:{" "}
                      <span className="font-mono">{data.issueDate}</span>{" "}
                      {data.issueTime}
                    </div>
                  </div>

                  <div className="text-center flex-1 pr-4">
                    <h1 className="text-xl font-extrabold text-cyan-800 m-0">
                      مرکز آریتمی تهران
                    </h1>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                      صورتحساب رسمی خدمات تشخیصی و درمانی
                    </div>
                  </div>

                  <div className="text-left w-24">
                    <div className="text-[10px] font-black tracking-tighter text-cyan-700 leading-tight">
                      Arrhythmia
                      <br />
                      Center
                    </div>
                  </div>
                </div>

                {/* مشخصات بیمار */}
                <div className="border border-dashed border-slate-300 rounded-lg p-3 bg-slate-50/70 flex justify-between items-center text-xs mb-4">
                  <div>
                    بیمار:{" "}
                    <strong className="text-slate-900 font-bold mr-1">
                      {data.patientName}
                    </strong>
                  </div>
                  <div>
                    کد ملی:{" "}
                    <strong className="font-mono text-slate-900 mr-1">
                      {data.nationalCode}
                    </strong>
                  </div>
                  <div>
                    شماره موبایل:{" "}
                    <strong className="font-mono text-slate-900 mr-1">
                      {data.mobile}
                    </strong>
                  </div>
                </div>

                {/* متن گواهی بالینی */}
                <div className="border border-dashed border-slate-300 rounded-lg p-4 bg-white text-xs leading-loose text-justify text-slate-700 mb-8">
                  آقا/خانم{" "}
                  <strong className="text-slate-900">{data.patientName}</strong>{" "}
                  با کد ملی{" "}
                  <strong className="font-mono text-slate-900">
                    {data.nationalCode}
                  </strong>{" "}
                  در تاریخ <span className="font-mono">{data.issueDate}</span>{" "}
                  به مرکز آریتمی تهران مراجعه نموده و خدمات
                  <strong className="text-slate-900">
                    {" "}
                    «{data.servicesSummaryText}»{" "}
                  </strong>{" "}
                  برای ایشان ثبت و انجام شده است.
                </div>

                {/* امضا و مهر پزشک صفحه ۱ */}
                <div className="flex flex-col items-center justify-center text-center mt-6">
                  <div className="text-xs font-bold text-slate-700">
                    مهر و امضای پزشک:
                  </div>
                  <div className="text-xs font-bold text-slate-900 mt-2">
                    {data.doctorName}
                  </div>
                  <div className="text-[10.5px] text-slate-500 whitespace-pre-line mt-0.5 leading-relaxed">
                    {data.doctorSpecialty}
                  </div>

                  <div className="h-24 w-48 flex items-center justify-center my-2">
                    {data.doctorSignatureUrl ? (
                      <img
                        src={data.doctorSignatureUrl}
                        alt="مهر و امضای پزشک"
                        className="max-h-20 max-w-full object-contain"
                      />
                    ) : (
                      <div className="border-b border-dashed border-slate-400 w-36 my-6 text-center text-[10px] text-slate-400">
                        {data.doctorName}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* فوتر صفحه اول */}
              <div className="border-t border-cyan-700 pt-2 mt-6 flex justify-between items-center text-[10px] text-slate-500">
                <div>
                  تهران، خیابان ولیعصر، خیابان توانیر، بالاتر از بیمارستان دی،
                  ساختمان شماره ۵
                </div>
                <div>تلفن: ۸۸۸۸۷۲۷۰-۰۲۱ | وب‌سایت: www.TehranEP.center</div>
              </div>
            </div>

            {/* شکست صفحه برای پرینتر */}
            <div className="page-break" />

            {/* ========================================================================= */}
            {/* صفحه ۲: ریز اقلام خدمات و تسویه حساب */}
            {/* ========================================================================= */}
            <div className="min-h-[265mm] flex flex-col justify-between pt-6 md:pt-0">
              <div>
                {/* نوار شماره صفحه */}
                <div className="bg-slate-100 text-slate-600 text-[10px] font-bold px-3 py-1 rounded flex justify-between items-center mb-4">
                  <span>صفحه ۲ از ۲ (ریز اقلام خدمات و تسویه حساب)</span>
                  <span>مرکز آریتمی تهران</span>
                </div>

                {/* سربرگ صفحه ۲ */}
                <div className="flex justify-between items-start border-b-2 border-cyan-700 pb-3 mb-4">
                  <div className="text-right text-[11px] leading-relaxed text-slate-600">
                    <div>
                      شماره پرونده / فاکتور:{" "}
                      <strong className="font-mono text-slate-800">
                        {data.fileNumber}
                      </strong>
                    </div>
                    <div>
                      شماره فاکتور:{" "}
                      <strong className="font-mono text-slate-800">
                        {data.trackingCode}
                      </strong>
                    </div>
                    <div>
                      تاریخ صدور:{" "}
                      <span className="font-mono">{data.issueDate}</span>{" "}
                      {data.issueTime}
                    </div>
                  </div>

                  <div className="text-center flex-1 pr-4">
                    <h2 className="text-base font-bold text-slate-900 m-0">
                      ریز اقلام صورتحساب درمانی
                    </h2>
                    <div className="text-[11px] text-slate-500 mt-1">
                      بیمار: {data.patientName} | کد ملی:{" "}
                      <span className="font-mono">{data.nationalCode}</span>
                    </div>
                  </div>

                  <div className="w-24"></div>
                </div>

                {/* جدول اقلام خدمات */}
                <table className="w-full border-collapse text-[11px] text-center border border-slate-300 mb-4">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <th className="p-2 border border-slate-300 w-[6%]">#</th>
                      <th className="p-2 border border-slate-300 w-[14%]">
                        کد خدمت
                      </th>
                      <th className="p-2 border border-slate-300 text-right pr-3 w-[40%]">
                        شرح خدمت / آزمایش
                      </th>
                      <th className="p-2 border border-slate-300 w-[22%]">
                        پزشک معالج / متخصص
                      </th>
                      <th className="p-2 border border-slate-300 text-left pl-3 w-[18%]">
                        مبلغ (تومان)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.servicesList.length > 0 ? (
                      data.servicesList.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-slate-200 hover:bg-slate-50"
                        >
                          <td className="p-2 border border-slate-300 font-mono">
                            {item.id}
                          </td>
                          <td className="p-2 border border-slate-300 font-mono">
                            {item.code}
                          </td>
                          <td className="p-2 border border-slate-300 text-right pr-3 font-medium">
                            {item.name}
                          </td>
                          <td className="p-2 border border-slate-300">
                            {item.doctor}
                          </td>
                          <td className="p-2 border border-slate-300 text-left pl-3 font-mono font-bold">
                            {formatNumber(item.price)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="5"
                          className="p-4 text-slate-400 border border-slate-300"
                        >
                          هیچ ردیف خدمتی ثبت نشده است.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* خلاصه مبالغ و تسویه */}
                <div className="w-full max-w-xs mr-auto border border-slate-300 rounded-md overflow-hidden text-xs mb-6">
                  <div className="flex justify-between items-center p-2 bg-slate-50 border-b border-slate-200">
                    <span className="text-slate-600">مجموع خدمات:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {formatNumber(data.totalAmount)} تومان
                    </span>
                  </div>

                  {data.discountAmount > 0 && (
                    <div className="flex justify-between items-center p-2 bg-rose-50 border-b border-rose-100 text-rose-700">
                      <span>تخفیف:</span>
                      <span className="font-mono font-bold">
                        {formatNumber(data.discountAmount)}- تومان
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center p-2 bg-emerald-50 text-emerald-800 font-bold border-b border-slate-200">
                    <span>مبلغ نهایی پرداختی:</span>
                    <span className="font-mono">
                      {formatNumber(data.payableAmount)} تومان
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-2 bg-slate-50 text-slate-600">
                    <span>روش پرداخت:</span>
                    <span>{data.paymentMethod}</span>
                  </div>
                </div>

                {/* امضا و مهر پزشک صفحه ۲ */}
                <div className="flex flex-col items-center justify-center text-center mt-6">
                  <div className="text-xs font-bold text-slate-700">
                    مهر و امضای پزشک:
                  </div>
                  <div className="text-xs font-bold text-slate-900 mt-1">
                    {data.doctorName}
                  </div>
                  <div className="text-[10px] text-slate-500 whitespace-pre-line leading-relaxed">
                    {data.doctorSpecialty}
                  </div>
                </div>
              </div>

              {/* فوتر صفحه دوم */}
              <div className="border-t border-cyan-700 pt-2 mt-6 flex justify-between items-center text-[10px] text-slate-500">
                <div>
                  مرکز آریتمی تهران - سامانه رسمی صدور الکترونیک صورتحساب درمان
                </div>
                <div>شناسه پیگیری: {data.trackingCode}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
