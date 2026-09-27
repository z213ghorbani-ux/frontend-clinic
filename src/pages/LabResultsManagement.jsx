import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import api from "@/services/api";
import {
  ArrowRight,
  Paperclip,
  FileText,
  Receipt,
  CheckCircle2,
  Trash2,
  Printer,
  Search,
  Loader2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import InvoiceModal from "@/components/InvoiceModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PDFDocument } from "pdf-lib";
import { SERVICE_TYPES, getServiceCode } from "@/constants/services";

// تابع کمکی جامع برای خواندن دقیق اطلاعات کاربر لاگین‌شده از LocalStorage
const getCurrentUser = () => {
  try {
    const raw =
      localStorage.getItem("user") ||
      localStorage.getItem("auth_user") ||
      localStorage.getItem("currentUser") ||
      localStorage.getItem("logged_in_user");

    if (raw) {
      let parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (parsed?.user) parsed = parsed.user;
      if (parsed?.data) parsed = parsed.data;

      const computedName =
        parsed?.name ||
        parsed?.full_name ||
        parsed?.user_name ||
        `${parsed?.first_name || ""} ${parsed?.last_name || ""}`.trim() ||
        parsed?.username ||
        "کاربر سیستم";

      return {
        id: parsed?.id || null,
        name: computedName,
        role: parsed?.role || parsed?.role_name || "",
        level:
          parsed?.level !== undefined && parsed?.level !== null
            ? Number(parsed.level)
            : null,
      };
    }
  } catch (e) {
    console.error("خطا در خواندن کاربر از localStorage:", e);
  }
  return { id: null, name: "کاربر سیستم", role: "", level: null };
};

// استخراج نام کاربر از تمام ساختارهای ممکنه دیتابیس / پاسخ API
const extractUserName = (obj) => {
  if (!obj) return null;
  if (typeof obj === "string" && obj.trim() !== "") return obj;

  return (
    obj.user_name ||
    obj.created_by_name ||
    obj.creator_name ||
    obj.performed_by ||
    obj.user?.name ||
    obj.user?.full_name ||
    obj.creator?.name ||
    obj.creator?.full_name ||
    obj.created_by_user?.name ||
    obj.created_by_user?.full_name ||
    (obj.first_name || obj.last_name
      ? `${obj.first_name || ""} ${obj.last_name || ""}`.trim()
      : null)
  );
};

// تابع کمکی برای ساخت آدرس تصویر مهر و امضا
const buildStampUrl = (stampPath) => {
  if (!stampPath) return null;

  if (typeof stampPath === "string" && stampPath.startsWith("http")) {
    if (stampPath.includes("localhost:8000")) {
      return stampPath.replace(/http:\/\/localhost:8000/g, "");
    }
    return stampPath;
  }

  const cleanPath = String(stampPath).replace(/^\/?storage\//, "");
  return `/storage/${cleanPath}`;
};

// ذخیره یک آیتم صف (به‌همراه فایل‌ها و لاگ ثبت‌کننده) روی سرور
const saveDraftToServer = async ({
  patient,
  doctor,
  services,
  historyItem,
  currentUser,
}) => {
  const fd = new FormData();
  fd.append("patient_id", patient.id);
  fd.append("doctor_id", doctor?.id || "");
  fd.append(
    "services",
    JSON.stringify(services.map(({ file, ...rest }) => rest)),
  );

  if (currentUser?.id) fd.append("user_id", currentUser.id);
  if (currentUser?.name) fd.append("created_by_name", currentUser.name);

  if (historyItem) {
    fd.append("history_item", JSON.stringify(historyItem));
  }

  services.forEach((s, i) => {
    if (s.file) {
      fd.append("files[]", s.file);
      fd.append("file_indexes[]", i);
    }
  });

  const res = await api.post("/lab-drafts", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data?.data;
};

// تبدیل پیش‌نویس دریافتی از سرور به آیتم صف موقت
const draftToQueueItem = (draft, patient, doctorsList) => ({
  tempId: draft.id,
  draftId: draft.id,
  patient,
  doctor:
    doctorsList.find((d) => String(d.id) === String(draft.doctor_id)) || null,
  doctorId: draft.doctor_id,
  created_by_name:
    extractUserName(draft) ||
    extractUserName(draft.creator) ||
    extractUserName(draft.user) ||
    null,
  services: (draft.services || []).map((s) => ({
    ...s,
    file: null,
    remoteFile: s.file || null,
  })),
  createdAt: draft.created_at
    ? new Date(draft.created_at).toLocaleTimeString("fa-IR")
    : new Date().toLocaleTimeString("fa-IR"),
});

// گرفتن فایل: اگر همین الان در حافظه هست همان، وگرنه دانلود از سرور
const resolveServiceFile = async (draftId, index, s) => {
  if (s.file) return s.file;
  if (!s.remoteFile || !draftId) return null;

  const res = await api.get(`/lab-drafts/${draftId}/files/${index}`, {
    responseType: "blob",
  });
  return new File([res.data], s.remoteFile.name, {
    type: res.data.type || s.remoteFile.mime || "application/pdf",
  });
};

// تابع کمکی الصاق مهر پزشک روی فایل PDF
const sealPdfFileWithDoctorStamp = async (pdfFile, doctor, options = {}) => {
  const {
    stampWidth = 130,
    marginX = 50,
    marginY = 50,
    opacity = 0.9,
    position = "bottom-left",
  } = options;

  try {
    if (!pdfFile) return pdfFile;

    const isPdf =
      pdfFile.type === "application/pdf" ||
      pdfFile.name?.toLowerCase().endsWith(".pdf");

    if (!isPdf) return pdfFile;

    const stampPath =
      doctor?.stamp_path ||
      doctor?.signature_path ||
      doctor?.signature ||
      doctor?.signature_url;

    if (!stampPath) {
      return pdfFile;
    }

    const stampUrl = buildStampUrl(stampPath);
    if (!stampUrl) return pdfFile;

    const stampRes = await fetch(stampUrl);
    if (!stampRes.ok) {
      console.warn("خطا در دریافت مهر:", stampRes.status, stampUrl);
      return pdfFile;
    }
    const stampImageBytes = await stampRes.arrayBuffer();

    const existingPdfBytes = await pdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    let stampImage = null;
    try {
      stampImage = await pdfDoc.embedPng(stampImageBytes);
    } catch (e) {
      try {
        stampImage = await pdfDoc.embedJpg(stampImageBytes);
      } catch (embedErr) {
        console.error("فرمت مهر پشتیبانی نشد (نه PNG و نه JPG):", embedErr);
        return pdfFile;
      }
    }

    const pages = pdfDoc.getPages();
    if (!pages || pages.length === 0) return pdfFile;

    const lastPage = pages[pages.length - 1];
    const { width, height } = lastPage.getSize();

    const computedStampHeight =
      (stampImage.height / stampImage.width) * stampWidth;

    let x = marginX;
    let y = marginY;

    if (position === "bottom-right") {
      x = Math.max(0, width - stampWidth - marginX);
      y = marginY;
    } else {
      x = marginX;
      y = marginY;
    }

    x = Math.min(Math.max(0, x), Math.max(0, width - stampWidth));
    y = Math.min(Math.max(0, height - computedStampHeight), Math.max(0, y));

    lastPage.drawImage(stampImage, {
      x,
      y,
      width: stampWidth,
      height: computedStampHeight,
      opacity,
    });

    const modifiedPdfBytes = await pdfDoc.save();

    return new File([modifiedPdfBytes], pdfFile.name, {
      type: "application/pdf",
      lastModified: Date.now(),
    });
  } catch (err) {
    console.error("خطا در اعمال مهر روی PDF:", err);
    return pdfFile;
  }
};

export default function LabResultsManagement() {
  const [doctorsList, setDoctorsList] = useState([]);
  const [patientsSearchResults, setPatientsSearchResults] = useState([]);
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // استیت‌های فرم
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedServices, setSelectedServices] = useState([]);

  // صف موقت و تاریخچه
  const [temporaryQueue, setTemporaryQueue] = useState([]);
  const [histUsers, setHistUsers] = useState([]);
  const [invoiceCreated, setInvoiceCreated] = useState(false);
  const [finalRecords, setFinalRecords] = useState([]);

  // مودال فاکتور
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);

  // جلوگیری از کلیک مضاعف و ثبت تکراری (Double Submit Protection)
  const isSubmittingRef = useRef(false);

  // دسترسی صدور فاکتور: فقط ادمین و منشی سطح ۱
  // دسترسی صدور فاکتور و ثبت نهایی: ادمین و منشی سطح یک
  const currentUser = getCurrentUser();
  const isStaffLevel1 =
    currentUser.role === "staff_level_1" ||
    (currentUser.role === "secretary" && currentUser.level === 1) ||
    currentUser.level === 1;

  const canCreateInvoice = currentUser.role === "admin" || isStaffLevel1;

  // بازیابی صف موقت (پیش‌نویس‌ها) از سرور هنگام تغییر بیمار + بازسازی لاگ‌های کاربران قبلی
  useEffect(() => {
    const patientId = selectedPatient?.id;

    if (!patientId) {
      setTemporaryQueue([]);
      return;
    }

    let cancelled = false;

    const loadDrafts = async () => {
      try {
        const res = await api.get("/lab-drafts", {
          params: { patient_id: patientId },
        });
        if (cancelled) return;

        const drafts = res.data?.data || [];
        const queueItems = drafts.map((d) =>
          draftToQueueItem(d, selectedPatient, doctorsList),
        );
        setTemporaryQueue(queueItems);

        // بازیابی تاریخچه‌های ثبت موقت توسط کاربران قبلی با extractUserName
        // بازیابی تاریخچه‌های ثبت موقت توسط کاربران قبلی
        const recoveredLogs = drafts.map((d) => {
          const doc = doctorsList.find(
            (docItem) => String(docItem.id) === String(d.doctor_id),
          );
          const docName =
            doc?.name ||
            doc?.full_name ||
            `${doc?.first_name || ""} ${doc?.last_name || ""}`.trim() ||
            "نامشخص";

          const sNames = (d.services || [])
            .map((s) =>
              s.serviceId === "other"
                ? s.customName || "سایر"
                : s.serviceTitle || s.title || "خدمت",
            )
            .join("، ");

          // اگر history_item به صورت json ذخیره شده بود، مستقیماً از آن بخواند
          let parsedHistItem = null;
          if (d.history_item) {
            try {
              parsedHistItem =
                typeof d.history_item === "string"
                  ? JSON.parse(d.history_item)
                  : d.history_item;
            } catch (e) {}
          }

          const creatorName =
            parsedHistItem?.user_name ||
            parsedHistItem?.user ||
            d.created_by_name ||
            d.user_name ||
            extractUserName(d) ||
            extractUserName(d.creator) ||
            extractUserName(d.user) ||
            "منشی پذیرش";

          return {
            user: creatorName,
            user_name: creatorName, // برای سازگاری کامل با هر دو ساختار
            action: "ثبت موقت خدمات",
            action_description: `ثبت موقت خدمات: ${sNames || "ثبت‌شده"} (پزشک: ${docName})`,
            created_at: d.created_at || new Date().toISOString(),
          };
        });

        if (recoveredLogs.length > 0) {
          setHistUsers((prev) => {
            const safePrev = Array.isArray(prev) ? prev : [];
            const nonDraftLogs = safePrev.filter(
              (h) => h.action !== "ثبت موقت خدمات",
            );
            return [...recoveredLogs, ...nonDraftLogs];
          });
        }

        if (drafts.length > 0) {
          toast.info(
            `پیش‌نویس خدمات ناتمام این بیمار بازیابی شد (${drafts.length} رکورد).`,
          );
        }
      } catch (e) {
        console.error("خطا در بازیابی پیش‌نویس:", e);
        if (!cancelled) setTemporaryQueue([]);
      }
    };

    loadDrafts();

    return () => {
      cancelled = true;
    };
  }, [selectedPatient?.id, doctorsList]);

  // دریافت لیست پزشکان
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        setIsLoadingDoctors(true);
        const response = await api.get("/doctors");

        const res = response.data;
        const list = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.data?.data)
              ? res.data.data
              : Array.isArray(res?.doctors)
                ? res.doctors
                : [];

        setDoctorsList(list);

        if (list.length === 0) {
          toast.warning("لیست پزشکان خالی است");
        }
      } catch (error) {
        console.error("خطای دریافت پزشکان:", error);
        setDoctorsList([]);
        toast.error("خطا در دریافت لیست پزشکان از سرور");
      } finally {
        setIsLoadingDoctors(false);
      }
    };

    fetchDoctors();
  }, []);

  // جستجوی زنده بیماران با Debounce
  useEffect(() => {
    if (!patientSearch.trim() || selectedPatient?.full_name === patientSearch) {
      setPatientsSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        setIsSearchingPatients(true);
        const response = await api.get(
          `/patients?search=${encodeURIComponent(patientSearch)}`,
        );
        const res = response.data;

        const data = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.data?.data)
              ? res.data.data
              : Array.isArray(res?.patients)
                ? res.patients
                : [];

        setPatientsSearchResults(data);
        setShowPatientDropdown(true);
      } catch (error) {
        console.error("خطا در سرچ بیماران:", error);
      } finally {
        setIsSearchingPatients(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [patientSearch, selectedPatient]);

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setPatientSearch(
      patient.full_name ||
        `${patient.first_name || ""} ${patient.last_name || ""}`.trim(),
    );
    setShowPatientDropdown(false);
  };

  const handleToggleService = (service) => {
    const exists = selectedServices.find((s) => s.serviceId === service.id);

    if (exists) {
      setSelectedServices(
        selectedServices.filter((s) => s.serviceId !== service.id),
      );
    } else {
      setSelectedServices([
        ...selectedServices,
        {
          serviceId: service.id,
          serviceCode: getServiceCode(service.id),
          serviceTitle: service.title,
          file: null,
          customName: "",
        },
      ]);
    }
  };

  const handleCustomNameChange = (val) => {
    setSelectedServices((prev) =>
      prev.map((s) =>
        s.serviceId === "other" ? { ...s, customName: val } : s,
      ),
    );
  };

  const handleServiceFileChange = (serviceId, file) => {
    setSelectedServices((prev) =>
      prev.map((s) => (s.serviceId === serviceId ? { ...s, file } : s)),
    );
  };

  // افزودن به صف موقت (ذخیره روی سرور با ثبت دقیق لاگ کاربر جاری)
  const handleAddToTemporaryQueue = async (e) => {
    e.preventDefault();
    if (!selectedPatient) {
      toast.warning("لطفاً ابتدا بیمار را جستجو و از لیست انتخاب کنید");
      return;
    }
    if (!selectedDoctorId) {
      toast.warning("لطفاً پزشک معالج را انتخاب کنید");
      return;
    }
    if (selectedServices.length === 0) {
      toast.warning("حداقل یک نوع جوابدهی انتخاب نمایید");
      return;
    }

    const doctor = doctorsList.find(
      (d) => String(d.id) === String(selectedDoctorId),
    );
    const loggedUser = getCurrentUser();

    const serviceNames = selectedServices
      .map((s) =>
        s.serviceId === "other" ? s.customName || "سایر" : s.serviceTitle,
      )
      .join("، ");

    const doctorDisplayName =
      doctor?.name ||
      doctor?.full_name ||
      doctor?.user?.name ||
      `${doctor?.first_name || ""} ${doctor?.last_name || ""}`.trim() ||
      "نامشخص";

    const newHistoryEntry = {
      user: loggedUser.name,
      user_name: loggedUser.name,
      user_id: loggedUser.id,
      action: "ثبت موقت خدمات",
      action_description: `ثبت موقت خدمات: ${serviceNames} (پزشک: ${doctorDisplayName})`,
      created_at: new Date().toISOString(),
    };

    try {
      setIsSavingDraft(true);

      const draft = await saveDraftToServer({
        patient: selectedPatient,
        doctor,
        services: selectedServices,
        historyItem: newHistoryEntry,
        currentUser: loggedUser,
      });

      const baseItem = draftToQueueItem(draft, selectedPatient, doctorsList);
      const newItem = {
        ...baseItem,
        created_by_name: loggedUser.name,
        addedBy: loggedUser,
        services: baseItem.services.map((s, i) => ({
          ...s,
          file: selectedServices[i]?.file || null,
        })),
      };

      setTemporaryQueue((prev) => [...prev, newItem]);
      setHistUsers((prev) => [
        ...(Array.isArray(prev) ? prev : []),
        newHistoryEntry,
      ]);

      toast.success("اطلاعات به لیست موقت اضافه شد");
      setSelectedServices([]);
    } catch (error) {
      console.error("خطا در ذخیره پیش‌نویس:", error);
      toast.error(
        error.response?.data?.message || "خطا در ذخیره پیش‌نویس روی سرور",
      );
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleRemoveFromQueue = async (tempId) => {
    const target = temporaryQueue.find((item) => item.tempId === tempId);
    try {
      if (target?.draftId) {
        await api.delete(`/lab-drafts/${target.draftId}`);
      }
      setTemporaryQueue((prev) =>
        prev.filter((item) => item.tempId !== tempId),
      );
      toast.info("مورد از لیست موقت حذف شد");
    } catch (error) {
      console.error("خطا در حذف پیش‌نویس:", error);
      toast.error("خطا در حذف از سرور");
    }
  };

  const handleConfirmInvoice = (invoice) => {
    setInvoiceData(invoice);
    setInvoiceCreated(true);

    const loggedUser = getCurrentUser();
    const invoiceLog = {
      user: loggedUser.name,
      user_name: loggedUser.name,
      user_id: loggedUser.id,
      action: "صدور صورتحساب",
      action_description: `صدور فاکتور شماره ${invoice.invoiceNumber || "-"} به مبلغ ${invoice.payableAmount?.toLocaleString("fa-IR") || 0} تومان`,
      created_at: new Date().toISOString(),
    };

    setHistUsers((prev) => [
      ...(Array.isArray(prev)
        ? prev.filter((h) => h.action !== "صدور صورتحساب")
        : []),
      invoiceLog,
    ]);

    toast.success(
      `فاکتور ${invoice.invoiceNumber} با مبلغ ${invoice.payableAmount?.toLocaleString("fa-IR")} تومان ثبت شد`,
    );
  };

  // ثبت نهایی و ارسال به سرور
  const handleFinalSubmit = async () => {
    if (isSubmittingRef.current) return;

    if (!temporaryQueue || temporaryQueue.length === 0) {
      toast.warning("لیست موقت خالی است");
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const primaryPatient = temporaryQueue[0].patient;
      const patientName =
        primaryPatient.full_name ||
        `${primaryPatient.first_name || ""} ${primaryPatient.last_name || ""}`.trim();
      const nationalCode =
        primaryPatient.national_id ||
        primaryPatient.national_code ||
        primaryPatient.nationalId ||
        "0000000000";

      const formData = new FormData();
      formData.append("patient_id", primaryPatient.id || "");
      formData.append("patient_name", patientName);
      formData.append("national_code", nationalCode);
      formData.append("file_number", primaryPatient.file_number || "");
      formData.append(
        "mobile",
        primaryPatient.mobile || primaryPatient.phone || "",
      );
      formData.append("issued_at", new Date().toISOString());

      const allServices = [];
      const processedFiles = [];

      for (const queueItem of temporaryQueue) {
        const itemDoctorId = queueItem.doctor?.id || queueItem.doctorId || "";

        for (const [idx, s] of queueItem.services.entries()) {
          const serviceItem = {
            service_code: s.serviceCode || getServiceCode(s.serviceId),
            serviceCode: s.serviceCode || getServiceCode(s.serviceId),
            serviceId: s.serviceId,
            serviceTitle:
              s.serviceId === "other" ? s.customName || "سایر" : s.serviceTitle,
            doctorName:
              queueItem.doctor?.name || queueItem.doctor?.full_name || "نامشخص",
            doctorId: itemDoctorId,
          };

          allServices.push(serviceItem);

          const rawFile = await resolveServiceFile(queueItem.draftId, idx, s);

          if (rawFile) {
            const sealedFile = await sealPdfFileWithDoctorStamp(
              rawFile,
              queueItem.doctor,
              {
                position: "bottom-left",
                stampWidth: 130,
                marginX: 50,
                marginY: 50,
                opacity: 0.9,
              },
            );

            processedFiles.push(sealedFile);
            formData.append("files[]", sealedFile);
            formData.append("file_doctors[]", itemDoctorId);
          }
        }
      }

      const loggedUser = getCurrentUser();

      // فیلتر هرگونه لاگ قبلی ثبت نهایی
      const cleanHistory = (Array.isArray(histUsers) ? histUsers : []).filter(
        (h) => h?.action && !String(h.action).includes("ثبت نهایی"),
      );

      // ثبت نهایی با نام صریح کاربر لاگین‌شده فعلی
      const completeHistory = [
        ...cleanHistory,
        {
          user: loggedUser.name,
          user_name: loggedUser.name,
          user_id: loggedUser.id,
          action: "ثبت نهایی و صدور جوابدهی",
          action_description: "پرونده نهایی ثبت، ممهور و بایگانی گردید.",
          created_at: new Date().toISOString(),
        },
      ];

      const payloadData = {
        hasInvoice: invoiceCreated,
        invoiceDetails: invoiceData,
        services: allServices,
        totalItemsCount: allServices.length,
        submittedAt: new Date().toISOString(),
        hist_users: completeHistory,
        history: completeHistory,
        final_submitted_by: {
          ...loggedUser,
          at: new Date().toISOString(),
        },
      };

      formData.append("history", JSON.stringify(completeHistory));
      formData.append("form_data", JSON.stringify(payloadData));

      const response = await api.post("/archives", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const createdArchiveId = response.data?.data?.id || response.data?.id;

      const uniqueDoctors = Array.from(
        new Set(
          temporaryQueue.map(
            (item) => item.doctor?.name || item.doctor?.full_name,
          ),
        ),
      )
        .filter(Boolean)
        .join(" - ");

      const newFinalRecord = {
        id: createdArchiveId || Date.now(),
        archiveId: createdArchiveId,
        patientName: patientName,
        patientNationalId: nationalCode,
        doctors: uniqueDoctors,
        date: new Date().toLocaleDateString("fa-IR"),
        time: new Date().toLocaleTimeString("fa-IR"),
        itemsCount: allServices.length,
        hasInvoice: invoiceCreated,
        attachedPdfFiles: processedFiles,
      };

      // پاک کردن درفت‌های سرور
      await Promise.allSettled(
        temporaryQueue
          .filter((item) => item.draftId)
          .map((item) => api.delete(`/lab-drafts/${item.draftId}`)),
      );

      setFinalRecords((prev) => [...prev, newFinalRecord]);
      setTemporaryQueue([]);
      setHistUsers([]);
      setSelectedPatient(null);
      setPatientSearch("");
      setSelectedDoctorId("");
      setInvoiceCreated(false);
      setInvoiceData(null);

      toast.success(
        response.data?.message || "پرونده جوابدهی با موفقیت در سیستم ثبت شد",
      );
    } catch (error) {
      console.error("خطا در ثبت نهایی:", error);
      const serverMessage =
        error.response?.data?.message ||
        "خطا در ثبت اطلاعات در سرور. لطفاً دوباره تلاش کنید.";
      toast.error(serverMessage);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // تابع چاپ فایل‌های یک رکورد نهایی
  const printRecordPdfs = async (record) => {
    try {
      const files = record?.attachedPdfFiles || [];
      if (files.length === 0) {
        toast.info(
          "برای این پرونده فایل پیوست مستقیمی در حافظه یافت نشد. می‌توانید از بخش بایگانی پرونده را مشاهده فرمایید.",
        );
        return;
      }

      const toastId = toast.loading("در حال ارسال به پرینتر...");
      for (const pdfFile of files) {
        const arrayBuf = await pdfFile.arrayBuffer();
        const blob = new Blob([arrayBuf], { type: "application/pdf" });
        const blobUrl = URL.createObjectURL(blob);

        const printIframe = document.createElement("iframe");
        printIframe.style.position = "fixed";
        printIframe.style.right = "0";
        printIframe.style.bottom = "0";
        printIframe.style.width = "0";
        printIframe.style.height = "0";
        printIframe.style.border = "0";
        printIframe.src = blobUrl;

        document.body.appendChild(printIframe);

        printIframe.onload = () => {
          setTimeout(() => {
            toast.dismiss(toastId);
            printIframe.contentWindow?.focus();
            printIframe.contentWindow?.print();

            setTimeout(() => {
              try {
                URL.revokeObjectURL(blobUrl);
                document.body.removeChild(printIframe);
              } catch {}
            }, 1500);
          }, 300);
        };
      }
    } catch (err) {
      console.error("خطا در پرینت:", err);
      toast.error("خطا در پرینت پرونده");
    }
  };

  // صدور و پرینت آخرین پرونده ثبت‌شده
  const handleExportResult = async () => {
    if (finalRecords.length === 0) {
      toast.warning("هنوز پرونده‌ای برای چاپ ثبت نشده است");
      return;
    }

    const lastRecord = finalRecords[finalRecords.length - 1];
    await printRecordPdfs(lastRecord);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900" dir="rtl">
      {/* هدر */}
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            داشبورد
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="text-xl font-bold">ثبت جوابدهی کلینیک</h1>
        </div>

        <Link to="/archive">
          <Button
            variant="outline"
            className="flex items-center gap-2 border-primary/30 text-primary hover:bg-primary/5"
          >
            <Paperclip className="w-4 h-4" />
            مشاهده بایگانی پرونده‌ها
          </Button>
        </Link>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* ۱. فرم ورود اطلاعات */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-base font-semibold border-b pb-3 mb-5 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            ورود اطلاعات و انتخاب خدمات بیمار
          </h2>

          <form onSubmit={handleAddToTemporaryQueue} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* نام بیمار */}
              <div className="relative">
                <label className="block text-sm font-medium mb-2">
                  نام و نام خانوادگی بیمار
                </label>
                <div className="relative">
                  <Input
                    placeholder="جستجوی نام، فامیلی یا کد ملی بیمار..."
                    value={patientSearch}
                    onChange={(e) => {
                      setPatientSearch(e.target.value);
                      if (
                        selectedPatient &&
                        (selectedPatient.full_name ||
                          selectedPatient.first_name) !== e.target.value
                      ) {
                        setSelectedPatient(null);
                      }
                    }}
                    onFocus={() => {
                      if (patientsSearchResults.length > 0)
                        setShowPatientDropdown(true);
                    }}
                  />
                  <div className="absolute left-3 top-3 text-slate-400">
                    {isSearchingPatients ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </div>
                </div>

                {showPatientDropdown && patientSearch.trim().length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {Array.isArray(patientsSearchResults) &&
                    patientsSearchResults.length > 0
                      ? patientsSearchResults.map((patient) => {
                          const displayName =
                            patient.full_name ||
                            `${patient.first_name || ""} ${patient.last_name || ""}`.trim();
                          const nationalCode =
                            patient.national_id ||
                            patient.national_code ||
                            patient.nationalId;
                          const phone = patient.mobile || patient.phone;

                          return (
                            <div
                              key={patient.id}
                              className="p-3 hover:bg-slate-50 cursor-pointer border-b last:border-b-0 flex justify-between items-center text-sm"
                              onClick={() => handleSelectPatient(patient)}
                            >
                              <div>
                                <span className="font-semibold text-slate-800">
                                  {displayName}
                                </span>
                                {nationalCode && (
                                  <span className="text-xs text-slate-500 mr-2 font-mono">
                                    ({nationalCode})
                                  </span>
                                )}
                              </div>
                              {phone && (
                                <span className="text-xs font-mono text-slate-500">
                                  {phone}
                                </span>
                              )}
                            </div>
                          );
                        })
                      : !isSearchingPatients && (
                          <div className="p-3 text-sm text-slate-500 text-center">
                            بیماری در سامانه یافت نشد (ابتدا در مدیریت بیماران
                            ثبت کنید)
                          </div>
                        )}
                  </div>
                )}
              </div>

              {/* پزشک معالج */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  پزشک معالج
                </label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  disabled={isLoadingDoctors}
                  className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-slate-100"
                >
                  <option value="">
                    {isLoadingDoctors
                      ? "در حال دریافت لیست پزشکان..."
                      : "-- انتخاب پزشک معالج --"}
                  </option>
                  {(Array.isArray(doctorsList) ? doctorsList : []).map(
                    (doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name ||
                          doc.full_name ||
                          doc.user?.name ||
                          `${doc.first_name || ""} ${doc.last_name || ""}`.trim() ||
                          ""}{" "}
                        {doc.specialty ? `(${doc.specialty})` : ""}
                      </option>
                    ),
                  )}
                </select>

                {selectedDoctorId &&
                  (() => {
                    const doc = doctorsList.find(
                      (d) => String(d.id) === String(selectedDoctorId),
                    );
                    const hasSig =
                      doc?.stamp_path ||
                      doc?.signature ||
                      doc?.signature_url ||
                      doc?.signature_path;
                    return (
                      <p
                        className={`text-xs mt-1 ${hasSig ? "text-emerald-600" : "text-amber-600"}`}
                      >
                        {hasSig
                          ? "✓ مهر و امضای ثبت‌شده پزشک ضمیمه خواهد شد."
                          : "⚠ پزشک مهر یا امضای ثبت‌شده در سیستم ندارد."}
                      </p>
                    );
                  })()}
              </div>
            </div>

            {/* لیست خدمات */}
            <div>
              <label className="block text-sm font-medium mb-3">
                نوع جوابدهی (امکان انتخاب همزمان):
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 border rounded-lg p-4 bg-slate-50/50">
                {SERVICE_TYPES.map((service) => {
                  const isChecked = selectedServices.some(
                    (s) => s.serviceId === service.id,
                  );
                  return (
                    <div
                      key={service.id}
                      className={`p-3 rounded-lg border transition-all ${
                        isChecked
                          ? "bg-white border-primary shadow-sm"
                          : "bg-white/60 border-slate-200"
                      }`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer mb-2">
                        <input
                          type="checkbox"
                          className="rounded text-primary focus:ring-primary w-4 h-4"
                          checked={isChecked}
                          onChange={() => handleToggleService(service)}
                        />
                        <span className="text-sm font-medium">
                          {service.title}
                        </span>
                      </label>

                      {isChecked && (
                        <div className="mt-2 space-y-2">
                          <input
                            type="file"
                            accept="application/pdf,image/*"
                            onChange={(e) =>
                              handleServiceFileChange(
                                service.id,
                                e.target.files[0],
                              )
                            }
                            className="text-xs block w-full file:mr-0 file:ml-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                          />

                          {service.id === "other" && (
                            <Input
                              placeholder="عنوان خدمت را وارد کنید..."
                              className="h-8 text-xs mt-1"
                              onChange={(e) =>
                                handleCustomNameChange(e.target.value)
                              }
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" className="gap-2" disabled={isSavingDraft}>
                {isSavingDraft ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    در حال ذخیره...
                  </>
                ) : (
                  "افزودن به لیست موقت"
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* ۲. جدول صف موقت */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-4 border-b pb-3">
            <h3 className="font-semibold text-base">
              لیست موقت خدمات پذیرش‌شده
            </h3>
            <Badge variant="outline" className="font-mono">
              {temporaryQueue.length} رکورد
            </Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">نام بیمار</TableHead>
                <TableHead className="text-right">پزشک</TableHead>
                <TableHead className="text-right">خدمات انتخاب‌شده</TableHead>
                <TableHead className="text-center">وضعیت فایل‌ها</TableHead>
                <TableHead className="text-center">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {temporaryQueue.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-6 text-slate-400"
                  >
                    موردی در لیست موقت وجود ندارد.
                  </TableCell>
                </TableRow>
              ) : (
                temporaryQueue.map((item) => (
                  <TableRow key={item.tempId}>
                    <TableCell className="font-medium">
                      {item.patient.full_name ||
                        `${item.patient.first_name || ""} ${item.patient.last_name || ""}`}
                    </TableCell>
                    <TableCell>
                      {item.doctor?.name || item.doctor?.full_name || "---"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        {item.services.map((s, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {s.serviceId === "other"
                                ? s.customName || "سایر"
                                : s.serviceTitle}
                            </Badge>

                            {s.file || s.remoteFile ? (
                              <span className="text-[11px] text-emerald-600 font-mono">
                                ({(s.file || s.remoteFile).name})
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs">
                      {
                        item.services.filter((s) => s.file || s.remoteFile)
                          .length
                      }{" "}
                      از {item.services.length} فایل
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleRemoveFromQueue(item.tempId)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* صدور فاکتور و ثبت نهایی */}
          <div className="mt-6 p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {canCreateInvoice ? (
                <Button
                  variant={invoiceCreated ? "secondary" : "default"}
                  onClick={() => {
                    if (temporaryQueue.length === 0) {
                      toast.warning(
                        "ابتدا باید حداقل یک مورد در لیست موقت وجود داشته باشد",
                      );
                      return;
                    }
                    setIsInvoiceModalOpen(true);
                  }}
                  className="gap-2"
                >
                  <Receipt className="w-4 h-4" />
                  {invoiceCreated ? "فاکتور صادر شد ✓" : "ساخت فاکتور"}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled
                  title="دسترسی صدور فاکتور فقط مخصوص منشی سطح یک و مدیر سیستم است"
                  className="gap-2 text-slate-400 border-slate-200 cursor-not-allowed bg-slate-100/70"
                >
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span>ساخت فاکتور (نیازمند سطح 1)</span>
                </Button>
              )}

              {invoiceCreated && (
                <span className="text-xs text-emerald-600 font-medium">
                  آماده ثبت نهایی
                </span>
              )}
            </div>

            <Button
              variant="default"
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  در حال ثبت و آپلود...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  ثبت نهایی
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ۳. لیست نهایی پرونده‌ها */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-4 border-b pb-3">
            <h3 className="font-semibold text-base">لیست نهایی ثبت‌شده‌ها</h3>
            <Badge variant="secondary" className="font-mono">
              {finalRecords.length} پرونده
            </Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right w-[25%]">نام بیمار</TableHead>
                <TableHead className="text-right w-[25%]">
                  پزشکان معالج
                </TableHead>
                <TableHead className="text-center w-[20%]">
                  تاریخ و زمان ثبت
                </TableHead>
                <TableHead className="text-center w-[15%]">
                  وضعیت فاکتور
                </TableHead>
                <TableHead className="text-center w-[15%]">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finalRecords.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-6 text-slate-400"
                  >
                    هنوز پرونده‌ای به ثبت نهایی نرسیده است.
                  </TableCell>
                </TableRow>
              ) : (
                finalRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {record.patientName}
                      <span className="text-xs text-slate-400 mr-2 font-mono">
                        ({record.patientNationalId})
                      </span>
                    </TableCell>
                    <TableCell>{record.doctors}</TableCell>
                    <TableCell
                      className="text-center font-mono whitespace-nowrap"
                      dir="ltr"
                    >
                      {record.date} - {record.time}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">
                        {record.hasInvoice ? "فاکتور دارد" : "بدون فاکتور"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => printRecordPdfs(record)}
                        className="gap-1 border-blue-200 text-blue-600 hover:bg-blue-50"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        چاپ
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* دکمه کلی صدور و چاپ آخرین جوابدهی */}
          {finalRecords.length > 0 && (
            <div className="mt-6 flex justify-end">
              <Button
                size="lg"
                onClick={handleExportResult}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                <Printer className="w-5 h-5" />
                صدور و چاپ جوابدهی
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* فقط اگر دسترسی وجود دارد مودال اجازه رندر و باز شدن دارد */}
      {canCreateInvoice && (
        <InvoiceModal
          isOpen={isInvoiceModalOpen}
          onClose={() => setIsInvoiceModalOpen(false)}
          queueItems={temporaryQueue}
          onConfirmInvoice={handleConfirmInvoice}
        />
      )}
    </div>
  );
}
