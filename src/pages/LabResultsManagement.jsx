import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import api from "@/services/api";
import {
  ArrowRight,
  Paperclip,
  FileText,
  Printer,
  Search,
  Loader2,
  Lock,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PDFDocument } from "pdf-lib";
import { getServiceCode } from "@/constants/services";

// تبدیل میلی‌متر به point (واحد pdf-lib)
const MM_TO_PT = 72 / 25.4;
// عرض پیش‌فرض مهر هنگام استفاده از مختصات خدمت (میلی‌متر)
const SIGNATURE_STAMP_WIDTH_MM = 50;

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

// الصاق ایمن تصویر مهر/امضا؛ نوع فایل از روی magic bytes تشخیص داده می‌شود
const embedImageSafely = async (pdfDoc, imageBytes) => {
  try {
    const bytes = new Uint8Array(imageBytes);

    const isPng =
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47;

    const isJpg = bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;

    if (isPng) return await pdfDoc.embedPng(bytes);
    if (isJpg) return await pdfDoc.embedJpg(bytes);

    console.warn(
      "[PDF] فرمت تصویر مهر پشتیبانی نمی‌شود (فقط PNG و JPG). احتمالاً آدرس مهر تصویر برنمی‌گرداند.",
    );
    return null;
  } catch (err) {
    console.warn("[PDF] امکان الصاق تصویر مهر وجود ندارد:", err);
    return null;
  }
};

// ذخیره یک آیتم صف (به‌همراه فایل‌ها و لاگ ثبت‌کننده) روی سرور
const saveDraftToServer = async ({
  patient,
  doctor,
  services,
  historyItem,
  currentUser,
  isLocked = false,
}) => {
  const fd = new FormData();

  fd.append("patient_id", String(patient.id));
  fd.append("doctor_id", doctor?.id ? String(doctor.id) : "");
  fd.append("is_locked", isLocked ? "1" : "0");

  // فایل از JSON خدمات حذف می‌شود و جداگانه داخل FormData ارسال می‌گردد.
  // is_visit را نگه می‌داریم تا Draft بعداً بتواند ویزیت را تشخیص دهد.
  const cleanServices = services.map(({ file, ...rest }) => ({
    ...rest,
    is_visit: Boolean(
      rest.is_visit ??
      rest.isVisit ??
      rest.is_base_visit ??
      rest.isBaseVisit ??
      false,
    ),
  }));

  fd.append("services", JSON.stringify(cleanServices));

  if (currentUser?.id) {
    fd.append("user_id", String(currentUser.id));
  }

  if (currentUser?.name) {
    fd.append("created_by_name", currentUser.name);
  }

  if (historyItem) {
    fd.append("history_item", JSON.stringify(historyItem));
  }

  // فایل‌های هر خدمت با index همان خدمت ارسال می‌شوند تا Laravel
  // بتواند فایل را دقیقاً روی services[index].file قرار دهد.
  services.forEach((service, index) => {
    if (!service?.file) return;

    fd.append(
      "files[]",
      service.file,
      service.file.name || `attachment-${index}`,
    );
    fd.append("file_indexes[]", String(index));
  });

  // Content-Type را دستی تعیین نکن؛ Axios/Browser باید boundary را
  // برای multipart/form-data خودش بسازد.
  const res = await api.post("/lab-drafts", fd);

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
  isLocked: Boolean(draft.is_locked || draft.locked),
  created_by_name:
    extractUserName(draft) ||
    extractUserName(draft.creator) ||
    extractUserName(draft.user) ||
    null,
  services: (draft.services || []).map((s) => ({
    ...s,
    is_visit: Boolean(
      s.is_visit ??
      s.isVisit ??
      s.is_base_visit ??
      s.isBaseVisit ??
      s.serviceCode === "visit",
    ),
    file: null,
    remoteFile: s.file || null,
  })),
  createdAt: draft.created_at
    ? new Date(draft.created_at).toLocaleTimeString("fa-IR")
    : new Date().toLocaleTimeString("fa-IR"),
});

// گرفتن فایل: اگر در حافظه هست همان، وگرنه دانلود از سرور
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

/**
 * الصاق مهر پزشک روی فایل PDF
 *
 * options.signature (اختیاری) - تنظیمات مهر از تعریف خدمت:
 *   { x, y, page }
 *   x و y بر حسب میلی‌متر، مبدأ: گوشه بالا-چپ صفحه
 *   page: "first" یا "last"
 *
 * اگر signature داده نشود یا مختصاتش خالی باشد، مهر با مقادیر پیش‌فرض
 * (پایین-چپ صفحه آخر، بر حسب point) درج می‌شود.
 */
const sealPdfFileWithDoctorStamp = async (pdfFile, doctor, options = {}) => {
  const {
    stampWidth = 130,
    marginX = 50,
    marginY = 50,
    opacity = 0.9,
    signature = null,
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

    if (!doctor?.id) return pdfFile;

    // دریافت مهر از طریق API احرازهویت‌شده (بدون وابستگی به سیم‌لینک storage)
    const stampRes = await api.get(`/doctors/${doctor.id}/stamp`, {
      responseType: "arraybuffer",
    });
    const stampImageBytes = stampRes.data;

    const existingPdfBytes = await pdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    const stampImage = await embedImageSafely(pdfDoc, stampImageBytes);
    if (!stampImage) return pdfFile;

    const pages = pdfDoc.getPages();
    if (!pages || pages.length === 0) return pdfFile;

    const hasCustomPosition =
      signature &&
      signature.x !== null &&
      signature.x !== undefined &&
      signature.y !== null &&
      signature.y !== undefined &&
      !Number.isNaN(Number(signature.x)) &&
      !Number.isNaN(Number(signature.y));

    // صفحه هدف: اولین یا آخرین صفحه
    const targetPage =
      signature?.page === "first" ? pages[0] : pages[pages.length - 1];
    const { width, height } = targetPage.getSize();

    const drawWidth = hasCustomPosition
      ? SIGNATURE_STAMP_WIDTH_MM * MM_TO_PT
      : stampWidth;
    const drawHeight = (stampImage.height / stampImage.width) * drawWidth;

    let x = marginX;
    let y = marginY;

    if (hasCustomPosition) {
      // X از لبه چپ (میلی‌متر)، Y از لبه بالا (میلی‌متر)
      // pdf-lib مبدأ را پایین-چپ می‌گیرد، پس Y باید برعکس شود.
      x = Number(signature.x) * MM_TO_PT;
      y = height - Number(signature.y) * MM_TO_PT - drawHeight;
    }

    // جلوگیری از بیرون زدن مهر از صفحه
    x = Math.min(Math.max(0, x), Math.max(0, width - drawWidth));
    y = Math.min(Math.max(0, y), Math.max(0, height - drawHeight));

    targetPage.drawImage(stampImage, {
      x,
      y,
      width: drawWidth,
      height: drawHeight,
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

  // استیت خدمات پویا - واکشی از دیتابیس
  const [servicesList, setServicesList] = useState([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);

  // استیت‌های بررسی و قفل ویزیت
  const [isVisitLocked, setIsVisitLocked] = useState(false);
  const [hasConfirmedVisit, setHasConfirmedVisit] = useState(false);
  const [visitLockReason, setVisitLockReason] = useState("");
  const [isCheckingVisitStatus, setIsCheckingVisitStatus] = useState(false);

  // استیت‌های فرم
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedServices, setSelectedServices] = useState([]);

  // صف موقت، تاریخچه و لیست نهایی
  const [temporaryQueue, setTemporaryQueue] = useState([]);
  const [histUsers, setHistUsers] = useState([]);
  const [finalRecords, setFinalRecords] = useState([]);

  // جلوگیری از کلیک مضاعف
  const isSubmittingRef = useRef(false);

  // ۱. دریافت پویا لیست خدمات از سرور
  useEffect(() => {
    const fetchServices = async () => {
      try {
        setIsLoadingServices(true);
        const response = await api.get("/services");
        const res = response.data;
        const list = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.services)
              ? res.services
              : [];

        if (list.length > 0) {
          const formatted = list.map((item) => ({
            id: item.code || item.id || item.slug,
            code: item.code || item.slug || item.id,
            slug: item.slug || "",
            title: item.name || item.title,
            description: item.description || "",
            price: Number(item.price || item.tariff || 0),
            is_visit: Boolean(
              item.is_visit ??
              item.isVisit ??
              item.is_base_visit ??
              item.isBaseVisit ??
              false,
            ),
            type: item.type || item.service_type || "",
            category: item.category || item.service_category || "",
            // تنظیمات مهر و امضا از تعریف خدمت
            has_signature: Boolean(item.has_signature),
            signature_x:
              item.signature_x !== undefined && item.signature_x !== null
                ? Number(item.signature_x)
                : null,
            signature_y:
              item.signature_y !== undefined && item.signature_y !== null
                ? Number(item.signature_y)
                : null,
            signature_page: item.signature_page || "last",
          }));

          setServicesList(formatted);
        } else {
          setServicesList([]);
        }
      } catch (err) {
        console.error("خطا در واکشی لیست خدمات از بک‌اند:", err);
        setServicesList([]);
      } finally {
        setIsLoadingServices(false);
      }
    };

    fetchServices();
  }, []);

  // ۲. بررسی وضعیت قفل پرونده و ویزیت بیمار (منطق امنیتی و Fail-Closed)
  useEffect(() => {
    if (!selectedPatient?.id) {
      setIsVisitLocked(false);
      setHasConfirmedVisit(false);
      setVisitLockReason("");
      setIsCheckingVisitStatus(false);
      return;
    }

    let isMounted = true;

    const checkVisitStatus = async () => {
      setIsCheckingVisitStatus(true);

      try {
        // ۱. بررسی وضعیت پرونده بیمار
        const patientLocked =
          selectedPatient.is_locked ||
          selectedPatient.status === "completed" ||
          selectedPatient.status === "archived";

        if (patientLocked) {
          if (isMounted) {
            setIsVisitLocked(true);
            setVisitLockReason(
              "پرونده این بیمار در وضعیت نهایی/بایگانی شده قرار دارد و قفل است.",
            );
          }
          return;
        }

        // ۲. استعلام وضعیت ویزیت جاری از بک‌اند
        const res = await api.get(
          `/visits/status?patient_id=${selectedPatient.id}`,
        );
        const visitData = res.data?.data || res.data;

        if (!isMounted) return;

        // وضعیت ویزیت پایه تاییدشده از پاسخ جدید بک‌اند
        const confirmedVisit = Boolean(
          res.data?.has_confirmed_visit ??
          res.data?.data?.has_confirmed_visit ??
          visitData?.has_confirmed_visit ??
          false,
        );
        setHasConfirmedVisit(confirmedVisit);

        // اگر ویزیت قفل، خاتمه‌یافته یا فاقد پذیرش فعال باشد
        if (
          visitData?.is_locked ||
          visitData?.status === "locked" ||
          visitData?.status === "completed" ||
          visitData?.status === "archived"
        ) {
          setIsVisitLocked(true);
          setVisitLockReason(
            visitData?.lock_reason ||
              "ویزیت جاری بیمار قفل شده و امکان ویرایش یا افزودن خدمت وجود ندارد.",
          );
        } else {
          // ویزیت معتبر و فعال است
          setIsVisitLocked(false);
          setVisitLockReason("");
        }
      } catch (e) {
        console.error("خطا در استعلام وضعیت ویزیت:", e);
        if (isMounted) {
          // امنیت Fail-Closed: در صورت بروز خطا، ویزیت و تایید ویزیت پایه
          // معتبر در نظر گرفته نمی‌شوند.
          setHasConfirmedVisit(false);
          setIsVisitLocked(true);
          setVisitLockReason(
            "عدم امکان استعلام وضعیت ویزیت از سرور. به دلایل امنیتی امکان ثبت مسدود شد.",
          );
          toast.error(
            "خطا در بررسی وضعیت ویزیت بیمار. جهت اطمینان، دسترسی ثبت موقتاً مسدود گردید.",
          );
        }
      } finally {
        if (isMounted) {
          setIsCheckingVisitStatus(false);
        }
      }
    };

    checkVisitStatus();

    return () => {
      isMounted = false;
    };
  }, [selectedPatient]);

  // ۳. بازیابی صف موقت (پیش‌نویس‌ها)
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
            user_name: creatorName,
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

  // ۴. دریافت لیست پزشکان
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

  // ۵. جستجوی زنده بیماران
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

  // تشخیص خدمت ویزیت پایه از ساختارهای مختلفی که ممکن است از بک‌اند برگردد.
  const isBaseVisitService = (service) =>
    Boolean(
      service?.is_visit ||
      service?.isVisit ||
      service?.is_base_visit ||
      service?.isBaseVisit ||
      service?.code === "visit" ||
      service?.id === "visit" ||
      service?.serviceId === "visit" ||
      service?.serviceCode === "visit",
    );

  // ۱. آیا ویزیتی در فرم بالا انتخاب شده است؟
  const hasSelectedVisitInForm = selectedServices.some((s) =>
    isBaseVisitService(s),
  );

  // ۲. آیا ویزیتی قبلاً به لیست موقت پایین اضافه شده است؟
  const hasVisitInTemporaryQueue = temporaryQueue.some(
    (item) =>
      Array.isArray(item?.services) &&
      item.services.some((s) => isBaseVisitService(s)),
  );

  // ۳. وجود ویزیت در هر یک از حالت‌های مجاز
  const hasAnyVisit =
    hasSelectedVisitInForm || hasVisitInTemporaryQueue || hasConfirmedVisit;

  const handleToggleService = (service) => {
    if (isVisitLocked) {
      toast.error("پرونده قفل شده است و امکان تغییر خدمات وجود ندارد.");
      return;
    }

    const isVisit = isBaseVisitService(service);
    const isAlreadySelected = selectedServices.some(
      (s) => s.serviceId === service.id,
    );

    // حالت حذف تیک
    if (isAlreadySelected) {
      setSelectedServices((prev) =>
        prev.filter((s) => s.serviceId !== service.id),
      );
      return;
    }

    // حالت افزودن تیک
    if (isVisit) {
      // اگر قبلاً در فرم بالا یا لیست موقت پایین ویزیت ثبت شده باشد،
      // اجازه ثبت ویزیت دوم نداریم.
      if (hasSelectedVisitInForm || hasVisitInTemporaryQueue) {
        toast.warning("برای این پذیرش قبلاً یک ویزیت پایه ثبت/انتخاب شده است.");
        return;
      }
    } else {
      // خدمت جانبی فقط وقتی فعال است که ویزیت در فرم، صف موقت
      // یا سابقه تاییدشده وجود داشته باشد.
      if (!hasAnyVisit) {
        toast.warning("ابتدا باید یک ویزیت پایه انتخاب یا ثبت کنید.");
        return;
      }
    }

    setSelectedServices((prev) => [
      ...prev,
      {
        serviceId: service.id,
        serviceCode: service.code || "",
        serviceTitle: service.name || service.title,
        price: service.price || 0,
        is_visit: isVisit,
        code: service.code,
        file: null,
        customName: "",
      },
    ]);
  };

  const handleServiceFileChange = (serviceId, file) => {
    setSelectedServices((prev) =>
      prev.map((service) =>
        String(service.serviceId) === String(serviceId)
          ? {
              ...service,
              file: file || null,
            }
          : service,
      ),
    );
  };

  // تغییر عنوان دستی برای خدمت «سایر»
  const handleCustomNameChange = (serviceId, value) => {
    setSelectedServices((prev) =>
      prev.map((service) =>
        String(service.serviceId) === String(serviceId)
          ? {
              ...service,
              customName: value,
            }
          : service,
      ),
    );
  };

  // افزودن به صف موقت
  const handleAddToTemporaryQueue = async (e) => {
    e.preventDefault();

    if (isCheckingVisitStatus) {
      toast.warning(
        "سیستم در حال بررسی وضعیت ویزیت بیمار است؛ لطفاً شکیبا باشید.",
      );
      return;
    }

    if (isVisitLocked) {
      toast.error(
        visitLockReason ||
          "پرونده این بیمار قفل شده و امکان ثبت خدمت جدید وجود ندارد.",
      );
      return;
    }

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

    // گارد نهایی قبل از ذخیره Draft: ویزیت می‌تواند در فرم بالا،
    // لیست موقت پایین یا از قبل به‌صورت تاییدشده وجود داشته باشد.
    if (!hasAnyVisit) {
      toast.error("ابتدا باید یک ویزیت پایه انتخاب یا ثبت کنید.");
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
        isLocked: isVisitLocked,
      });

      const baseItem = draftToQueueItem(draft, selectedPatient, doctorsList);
      const newItem = {
        ...baseItem,
        created_by_name: loggedUser.name,
        addedBy: loggedUser,
        services: baseItem.services.map((s, i) => ({
          ...s,
          price: selectedServices[i]?.price || 0,
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
    if (isVisitLocked) {
      toast.error("پرونده قفل است و امکان حذف موارد وجود ندارد.");
      return;
    }

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

  // چاپ فایل‌های یک رکورد با Iframe
  const printRecordPdfs = async (record) => {
    try {
      const files = record?.attachedPdfFiles || [];
      if (files.length === 0) {
        toast.info(
          "فایل پیوست آماده چاپ برای این رکورد یافت نشد (پرونده در بایگانی ذخیره شد).",
        );
        return;
      }

      const toastId = toast.loading("در حال آماده‌سازی و ارسال به پرینتر...");
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
      toast.error("خطا در باز کردن دیالوگ پرینت");
    }
  };

  // ساخت خودکار و پشت‌صحنه دیتای فاکتور از اقلام صف موقت
  const generateAutoInvoiceData = () => {
    const items = [];
    let totalAmount = 0;

    temporaryQueue.forEach((qItem) => {
      (qItem.services || []).forEach((s) => {
        const foundDef = servicesList.find((srv) => srv.id === s.serviceId);
        const itemPrice = Number(s.price || foundDef?.price || 0);
        totalAmount += itemPrice;

        items.push({
          serviceId: s.serviceId,
          serviceTitle:
            s.serviceId === "other" ? s.customName || "سایر" : s.serviceTitle,
          price: itemPrice,
          count: 1,
          total: itemPrice,
        });
      });
    });

    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    return {
      invoiceNumber,
      items,
      totalAmount,
      payableAmount: totalAmount,
      discount: 0,
      paymentMethod: "cash",
      status: "paid",
      created_at: new Date().toISOString(),
    };
  };

  // کلید عملیات جامع (Master Action): ساخت فاکتور -> ثبت نهایی -> پرینت خودکار
  const handleMasterSubmitAndPrint = async () => {
    if (isSubmittingRef.current) return;

    if (isVisitLocked) {
      toast.error("این پرونده در وضعیت قفل قرار دارد و امکان ثبت ندارد.");
      return;
    }

    if (!temporaryQueue || temporaryQueue.length === 0) {
      toast.warning("لیست موقت خالی است؛ ابتدا حداقل یک خدمت اضافه کنید");
      return;
    }

    // گارد نهایی ثبت پرونده: حداقل یک ویزیت باید در فرم،
    // لیست موقت یا سابقه تاییدشده وجود داشته باشد.
    if (!hasAnyVisit) {
      toast.error("برای ثبت نهایی ابتدا باید یک ویزیت پایه انتخاب یا ثبت شود.");
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const loggedUser = getCurrentUser();
      const primaryPatient = temporaryQueue[0].patient;
      const patientName =
        primaryPatient.full_name ||
        `${primaryPatient.first_name || ""} ${primaryPatient.last_name || ""}`.trim();
      const nationalCode =
        primaryPatient.national_id ||
        primaryPatient.national_code ||
        primaryPatient.nationalId ||
        "0000000000";

      // ۱. صدور خودکار و پشت صحنه فاکتور
      const autoInvoice = generateAutoInvoiceData();
      const invoiceLog = {
        user: loggedUser.name,
        user_name: loggedUser.name,
        user_id: loggedUser.id,
        action: "صدور صورتحساب",
        action_description: `صدور خودکار فاکتور شماره ${autoInvoice.invoiceNumber} به مبلغ ${autoInvoice.payableAmount.toLocaleString("fa-IR")} تومان`,
        created_at: new Date().toISOString(),
      };

      // ۲. ساخت فرم دیتا و آماده‌سازی فایل‌ها
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
      formData.append("is_locked", "1");

      const allServices = [];
      const processedFiles = [];

      for (const queueItem of temporaryQueue) {
        const itemDoctorId = queueItem.doctor?.id || queueItem.doctorId || "";

        for (const [idx, s] of queueItem.services.entries()) {
          const serviceItem = {
            service_code:
              s.serviceCode ||
              (getServiceCode ? getServiceCode(s.serviceId) : s.serviceId),
            serviceCode:
              s.serviceCode ||
              (getServiceCode ? getServiceCode(s.serviceId) : s.serviceId),
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
            // تنظیمات مهر همین خدمت (از تعریف خدمت در «مدیریت خدمات»)
            const svc = servicesList.find(
              (sv) => String(sv.id) === String(s.serviceId),
            );

            let sealedFile = rawFile;

            // فقط خدماتی که تیک «درج خودکار مهر و امضا» دارند مهر می‌خورند
            if (svc?.has_signature) {
              sealedFile = await sealPdfFileWithDoctorStamp(
                rawFile,
                queueItem.doctor,
                {
                  opacity: 0.9,
                  signature:
                    svc.signature_x !== null && svc.signature_y !== null
                      ? {
                          x: svc.signature_x,
                          y: svc.signature_y,
                          page: svc.signature_page,
                        }
                      : { x: null, y: null, page: svc.signature_page },
                },
              );
            }

            processedFiles.push(sealedFile);
            formData.append("files[]", sealedFile);
            formData.append("file_doctors[]", itemDoctorId);
          }
        }
      }

      // تاریخچه لاگ‌ها
      const cleanHistory = (Array.isArray(histUsers) ? histUsers : []).filter(
        (h) => h?.action && !String(h.action).includes("ثبت نهایی"),
      );

      const completeHistory = [
        ...cleanHistory,
        invoiceLog,
        {
          user: loggedUser.name,
          user_name: loggedUser.name,
          user_id: loggedUser.id,
          action: "ثبت نهایی و صدور جوابدهی",
          action_description:
            "پرونده نهایی ثبت، صورتحساب صادر، ممهور و قفل بایگانی گردید.",
          created_at: new Date().toISOString(),
        },
      ];

      const payloadData = {
        hasInvoice: true,
        invoiceDetails: autoInvoice,
        services: allServices,
        totalItemsCount: allServices.length,
        submittedAt: new Date().toISOString(),
        hist_users: completeHistory,
        history: completeHistory,
        is_locked: true,
        final_submitted_by: {
          ...loggedUser,
          at: new Date().toISOString(),
        },
      };

      formData.append("history", JSON.stringify(completeHistory));
      formData.append("form_data", JSON.stringify(payloadData));

      // ۳. ارسال نهایی به سرور
      // Content-Type را دستی تعیین نمی‌کنیم تا boundary صحیح multipart توسط
      // Axios/Browser ساخته شود و فایل‌های پیوست بدون مشکل به Laravel برسند.
      const response = await api.post("/archives", formData);

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
        hasInvoice: true,
        isLocked: true,
        attachedPdfFiles: processedFiles,
      };

      // ۴. چاپ فوری و خودکار جوابدهی بلافاصله بعد از ثبت موفقیت‌آمیز
      if (processedFiles.length > 0) {
        printRecordPdfs(newFinalRecord);
      }

      // ۵. پاکسازی درفت‌های موقت
      await Promise.allSettled(
        temporaryQueue
          .filter((item) => item.draftId)
          .map((item) => api.delete(`/lab-drafts/${item.draftId}`)),
      );

      // ۶. به‌روزرسانی استیت‌ها
      setFinalRecords((prev) => [...prev, newFinalRecord]);
      setTemporaryQueue([]);
      setHistUsers([]);
      setSelectedPatient(null);
      setPatientSearch("");
      setSelectedDoctorId("");
      setIsVisitLocked(false);
      setHasConfirmedVisit(false);
      setVisitLockReason("");

      toast.success(
        "پرونده با موفقیت ثبت نهایی شد، صورتحساب خودکار صادر گردید و دستور چاپ ارسال شد.",
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
        {/* هشدار قفل پرونده */}
        {isVisitLocked && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center gap-3 text-amber-800 animate-in fade-in">
            <Lock className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-bold">پرونده قفل است: </span>
              {visitLockReason ||
                "این ویزیت نهایی شده و امکان ویرایش یا افزودن خدمات جدید وجود ندارد."}
            </div>
          </div>
        )}

        {/* ۱. فرم ورود اطلاعات */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center border-b pb-3 mb-5">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              ورود اطلاعات و انتخاب خدمات بیمار
            </h2>
            {selectedPatient && (
              <Badge
                variant={
                  isCheckingVisitStatus
                    ? "secondary"
                    : isVisitLocked
                      ? "destructive"
                      : "outline"
                }
                className="gap-1.5"
              >
                {isCheckingVisitStatus ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                    در حال استعلام ویزیت...
                  </>
                ) : isVisitLocked ? (
                  <>
                    <Lock className="w-3 h-3" />
                    ویزیت قفل‌شده / غیرفعال
                  </>
                ) : hasConfirmedVisit ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    ویزیت پایه: تایید و تسویه شده
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 text-amber-500" />
                    ویزیت پایه: نیازمند ثبت و تسویه
                  </>
                )}
              </Badge>
            )}
          </div>

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
                  disabled={
                    isLoadingDoctors || isVisitLocked || isCheckingVisitStatus
                  }
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
              <div className="flex justify-between items-center mb-3 gap-3">
                <label className="block text-sm font-medium">
                  نوع جوابدهی (امکان انتخاب همزمان):
                </label>

                {selectedPatient && !isCheckingVisitStatus && (
                  <Badge
                    variant={hasConfirmedVisit ? "outline" : "secondary"}
                    className={
                      hasConfirmedVisit
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }
                  >
                    {hasConfirmedVisit
                      ? "ویزیت پایه تایید شده؛ سایر خدمات فعال هستند"
                      : hasAnyVisit
                        ? "ویزیت پایه انتخاب/ثبت شده؛ سایر خدمات فعال هستند"
                        : "ابتدا یک ویزیت پایه انتخاب کنید"}
                  </Badge>
                )}
              </div>

              {isLoadingServices ? (
                <div className="p-4 text-center text-sm text-gray-500 border rounded-lg bg-slate-50/50 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  در حال بارگذاری لیست خدمات از سامانه...
                </div>
              ) : servicesList.length === 0 ? (
                <div className="p-4 text-center text-sm text-amber-700 bg-amber-50 rounded-lg border border-amber-200">
                  هیچ خدمتی در سامانه تعریف نشده است. لطفاً ابتدا از بخش مدیریت
                  خدمات، خدمات مورد نظر را ثبت کنید.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 border rounded-lg p-4 bg-slate-50/50">
                  {servicesList.map((service) => {
                    const isVisit = isBaseVisitService(service);
                    const isChecked = selectedServices.some(
                      (s) => s.serviceId === service.id,
                    );

                    // ویزیت قفل است اگر پرونده قفل باشد یا قبلاً
                    // ویزیتی در فرم/لیست موقت ثبت شده باشد.
                    // خدمات غیر ویزیت نیز فقط با وجود یک ویزیت فعال می‌شوند.
                    const isDisabled =
                      isVisitLocked ||
                      (isVisit &&
                        (hasSelectedVisitInForm || hasVisitInTemporaryQueue) &&
                        !isChecked) ||
                      (!isVisit && !hasAnyVisit);

                    return (
                      <div
                        key={service.id}
                        className={`p-3 rounded-lg border transition-all ${
                          isChecked
                            ? "bg-white border-primary shadow-sm"
                            : "bg-white/60 border-slate-200"
                        } ${isDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
                        title={
                          !isVisit && !hasAnyVisit
                            ? "ابتدا یک ویزیت پایه انتخاب یا ثبت کنید."
                            : undefined
                        }
                      >
                        <label
                          className={`flex items-center gap-2 mb-2 ${
                            isDisabled ? "cursor-not-allowed" : "cursor-pointer"
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isDisabled}
                            className="rounded text-primary focus:ring-primary w-4 h-4 disabled:opacity-50"
                            checked={isChecked}
                            onChange={() => handleToggleService(service)}
                          />
                          <span className="text-sm font-medium">
                            {service.title}
                          </span>
                          {isVisit && (
                            <Badge
                              variant="outline"
                              className="mr-auto text-[10px] border-emerald-200 text-emerald-700"
                            >
                              ویزیت پایه
                            </Badge>
                          )}
                        </label>

                        {!isVisit && !hasAnyVisit && (
                          <p className="text-[11px] text-amber-600 mt-1">
                            پس از انتخاب یا ثبت ویزیت پایه فعال می‌شود.
                          </p>
                        )}

                        {isChecked && (
                          <div className="mt-2 space-y-2">
                            <input
                              type="file"
                              disabled={isVisitLocked}
                              accept="application/pdf,image/*"
                              onChange={(e) =>
                                handleServiceFileChange(
                                  service.id,
                                  e.target.files[0],
                                )
                              }
                              className="text-xs block w-full file:mr-0 file:ml-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 disabled:opacity-50"
                            />

                            {service.id === "other" && (
                              <Input
                                placeholder="عنوان خدمت را وارد کنید..."
                                disabled={isVisitLocked}
                                className="h-8 text-xs mt-1"
                                onChange={(e) =>
                                  handleCustomNameChange(
                                    service.id,
                                    e.target.value,
                                  )
                                }
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                className="gap-2"
                disabled={
                  isSavingDraft ||
                  isVisitLocked ||
                  isCheckingVisitStatus ||
                  !selectedPatient
                }
              >
                {isSavingDraft ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    در حال ذخیره...
                  </>
                ) : isCheckingVisitStatus ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    در حال تایید ویزیت...
                  </>
                ) : isVisitLocked ? (
                  <>
                    <Lock className="w-4 h-4" />
                    پرونده قفل است
                  </>
                ) : (
                  "افزودن به لیست موقت"
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* ۲. جدول صف موقت و دکمه واحد عملیات */}
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
                        disabled={isVisitLocked}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-30"
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

          {/* دکمه یکپارچه Master Action: ثبت نهایی، صدور خودکار فاکتور و پرینت */}
          <div className="mt-6 p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              با کلیک روی دکمه ثبت نهایی، صورتحساب به صورت خودکار صادر شده و
              دستور چاپ پرونده ممهور ارسال خواهد شد.
            </div>

            <Button
              variant="default"
              size="lg"
              onClick={handleMasterSubmitAndPrint}
              disabled={
                isSubmitting ||
                isVisitLocked ||
                isCheckingVisitStatus ||
                temporaryQueue.length === 0
              }
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm font-semibold disabled:bg-slate-400"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  در حال ثبت، صدور فاکتور و ارسال به پرینتر...
                </>
              ) : isVisitLocked ? (
                <>
                  <Lock className="w-4 h-4" />
                  پرونده قفل است
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  ثبت نهایی، صدور صورتحساب و چاپ جوابدهی
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
                <TableHead className="text-center w-[15%]">چاپ مجدد</TableHead>
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
                        {record.hasInvoice ? "صادر شد ✓" : "بدون فاکتور"}
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
        </div>
      </div>
    </div>
  );
}
