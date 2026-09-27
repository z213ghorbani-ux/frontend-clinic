// src/constants/services.js (یا services.jsx)

/**
 * کدهای اختصاصی و منحصر‌به‌فرد خدمات جهت صدور فاکتور، بیمه و چاپ PDF
 */
export const SERVICE_CODES = Object.freeze({
  holter_24: "-",
  holter_48: "900771",
  holter_72: "-",
  holter_weekly: "-",
  holter_monthly: "-",
  holter_bp: "900771",
  echocardiography: "900775",
  stress_echo: "900715",
  stress_TDI: "900740",
  stress_color: "900785",
  echo_contrast: "900797",
  ecg: "900710",
  visit: "-",
  consult: "-",
  other: "-",
  exercise_test: "900800",
  "analiz-p.m": "900945",
  "analiz-i.c.d": "900910",
  "pals-e.p": "901130",
  "tilt-test": "900925",
  "monitoring-l": "900770",
  "pal-e": "901125",
  "pro-test": "-",
  "cardiac-output": "-",
  stuff: "-",
});

/**
 * لیست کامل تعاریف خدمات کلینیک قلب و عروق همراه با عناوین فارسی و کد خدمت
 */
export const SERVICE_TYPES = [
  { id: "ecg", title: "نوار قلب (ECG)", code: SERVICE_CODES.ecg },
  {
    id: "echocardiography",
    title: "اکوکاردیوگرافی",
    code: SERVICE_CODES.echocardiography,
  },
  { id: "exercise_test", title: "تست ورزش", code: SERVICE_CODES.exercise_test },
  {
    id: "holter_24",
    title: "هولتر مانیتورینگ ۲۴ ساعته",
    code: SERVICE_CODES.holter_24,
  },
  {
    id: "holter_48",
    title: "هولتر مانیتورینگ نوار قلب 2 روزه",
    code: SERVICE_CODES.holter_48,
  },
  {
    id: "holter_72",
    title: "هولتر مانیتورینگ ۷۲ ساعته",
    code: SERVICE_CODES.holter_72,
  },
  {
    id: "holter_weekly",
    title: "هولتر مانیتورینگ هفتگی",
    code: SERVICE_CODES.holter_weekly,
  },
  {
    id: "holter_monthly",
    title: "هولتر مانیتورینگ ماهانه",
    code: SERVICE_CODES.holter_monthly,
  },
  {
    id: "holter_bp",
    title: "هولتر مانیتورینگ فشار خون",
    code: SERVICE_CODES.holter_bp,
  },
  {
    id: "stress_echo",
    title: "اکوکاردیوگرافی استرس",
    code: SERVICE_CODES.stress_echo,
  },
  {
    id: "stress_TDI",
    title: "اکوکاردیوگرافی نسجی(TDI)",
    code: SERVICE_CODES.stress_TDI,
  },
  {
    id: "stress_color",
    title: "اکوکاردیوگرافی رنگی",
    code: SERVICE_CODES.stress_color,
  },
  { id: "echo_contrast", title: "کنتراست", code: SERVICE_CODES.echo_contrast },
  { id: "visit", title: "ویزیت", code: SERVICE_CODES.visit },
  { id: "consult", title: "مشاوره قلبی", code: SERVICE_CODES.consult },
  {
    id: "analiz-p.m",
    title: "آنالیز پیس میکر",
    code: SERVICE_CODES["analiz-p.m"],
  },
  {
    id: "analiz-i.c.d",
    title: "آنالیز آی سی دی(I.C.D)",
    code: SERVICE_CODES["analiz-i.c.d"],
  },
  {
    id: "pals-e.p",
    title: "پالس اکسیمتری حین پروسیجر",
    code: SERVICE_CODES["pals-e.p"],
  },
  { id: "tilt-test", title: "تست تیلت", code: SERVICE_CODES["tilt-test"] },
  {
    id: "monitoring-l",
    title: "مانیتورینگ مداوم",
    code: SERVICE_CODES["monitoring-l"],
  },
  { id: "pal-e", title: "پالس اکسیمتری", code: SERVICE_CODES["pal-e"] },
  {
    id: "pro-test",
    title: "تست پروکایینامید",
    code: SERVICE_CODES["pro-test"],
  },
  {
    id: "cardiac-output",
    title: "بررسی غیرتهاجمی برون ده قلبی",
    code: SERVICE_CODES["cardiac-output"],
  },
  { id: "stuff", title: "لوازم مصرفی", code: SERVICE_CODES.stuff },
  { id: "other", title: "سایر خدمات", code: SERVICE_CODES.other },
];

/**
 * دریافت کد خدمت بر اساس شناسه یا عنوان فارسی خدمت
 * @param {string} identifier شناسه (مثل ecg) یا عنوان فارسی (مثل "نوار قلب")
 * @returns {string} کد خدمت (مثل 900710)
 */
export const getServiceCode = (identifier) => {
  if (!identifier) return "-";

  const raw = String(identifier).trim();

  // ۱. بررسی مستقیم شناسه انگلیسی در SERVICE_CODES
  if (SERVICE_CODES[raw] && SERVICE_CODES[raw] !== "-") {
    return SERVICE_CODES[raw];
  }

  // ۲. جستجو در SERVICE_TYPES بر اساس id یا title دقیق
  const found = SERVICE_TYPES.find(
    (s) => s.id.toLowerCase() === raw.toLowerCase() || s.title.trim() === raw,
  );
  if (found && found.code && found.code !== "-") {
    return found.code;
  }

  // ۳. جستجوی منعطف بر اساس کلمات کلیدی فارسی (برای مواردی که عنوان با کمی تغییر ذخیره شده)
  const lower = raw.toLowerCase();
  if (lower.includes("نوار") || lower.includes("ecg")) return SERVICE_CODES.ecg;
  if (lower.includes("ورزش")) return SERVICE_CODES.exercise_test;
  if (lower.includes("رنگی")) return SERVICE_CODES.stress_color;
  if (lower.includes("نسجی") || lower.includes("tdi"))
    return SERVICE_CODES.stress_TDI;
  if (lower.includes("استرس")) return SERVICE_CODES.stress_echo;
  if (lower.includes("کنتراست")) return SERVICE_CODES.echo_contrast;
  if (lower.includes("اکو")) return SERVICE_CODES.echocardiography;
  if (lower.includes("فشار")) return SERVICE_CODES.holter_bp;
  if (lower.includes("هولتر") || lower.includes("holter"))
    return SERVICE_CODES.holter_48;
  if (lower.includes("تیلت")) return SERVICE_CODES["tilt-test"] || "900925";
  if (lower.includes("پیس")) return SERVICE_CODES["analiz-p.m"] || "900945";
  if (lower.includes("آی سی دی") || lower.includes("icd"))
    return SERVICE_CODES["analiz-i.c.d"] || "900910";
  if (lower.includes("مانیتورینگ"))
    return SERVICE_CODES["monitoring-l"] || "900770";
  if (lower.includes("پالس")) return SERVICE_CODES["pal-e"] || "901125";

  return "-";
};

/**
 * دریافت عنوان فارسی خدمت بر اساس شناسه
 * @param {string} serviceId
 * @param {string} [customName=""] نام سفارشی در صورت انتخاب 'other'
 * @returns {string} عنوان خدمت
 */
export const getServiceTitle = (serviceId, customName = "") => {
  if (serviceId === "other") {
    return customName?.trim() || "سایر خدمات";
  }
  const found = SERVICE_TYPES.find((s) => s.id === serviceId);
  return found ? found.title : customName || serviceId || "خدمت درمانی";
};

export default {
  SERVICE_CODES,
  SERVICE_TYPES,
  getServiceCode,
  getServiceTitle,
};
