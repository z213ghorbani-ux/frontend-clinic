import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserPlus,
  ArrowRight,
  Trash2,
  UploadCloud,
  CheckCircle2,
  Users,
  Stethoscope,
  Loader2,
} from "lucide-react";
import api from "@/services/api";
import Pagination from "@/components/ui/Pagination";
import { toast } from "sonner";

const PAGE_SIZE = 5;

const STORAGE_BASE_URL = "http://localhost:8000";

const getImageUrl = (path) => {
  if (!path) return null;

  let value = String(path).trim().replaceAll("\\", "/");

  // اگر URL کامل از بک‌اند برگشته باشد، همان را نگه می‌داریم.
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value.replaceAll("/storage//", "/storage/");
  }

  // حذف اسلش‌های ابتدایی
  while (value.startsWith("/")) {
    value = value.slice(1);
  }

  // حذف storage/ تکراری از ابتدای مسیر
  while (value.startsWith("storage/")) {
    value = value.slice("storage/".length);
  }

  return `${STORAGE_BASE_URL}/storage/${value}`;
};

const normalizeDoctor = (doctor) => ({
  id: doctor.id,
  fullName: doctor.name || "",
  specialty: doctor.specialty || "",
  signatureData: getImageUrl(doctor.stamp_url || doctor.stamp_path),
  createdAt: doctor.created_at
    ? new Date(doctor.created_at).toLocaleDateString("fa-IR")
    : "-",
});

export default function DoctorsManagement() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [doctors, setDoctors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    specialty: "",
    medicalCouncilCode: "",
    signature: null,
  });
  const [errors, setErrors] = useState({});
  const [previewUrl, setPreviewUrl] = useState(null);
  const [page, setPage] = useState(1);

  const fetchDoctors = async () => {
    try {
      setIsLoading(true);
      const response = await api.get("/doctors");
      const res = response.data;

      const rawList = Array.isArray(res?.data?.data)
        ? res.data.data // ← حالت paginate واقعی بک‌اند شما
        : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
            ? res
            : [];

      setDoctors(rawList.map(normalizeDoctor));
    } catch (error) {
      console.error("خطا در دریافت لیست پزشکان:", error);
      toast.error("خطا در دریافت لیست پزشکان از سرور");
      setDoctors([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const totalPages = Math.max(1, Math.ceil(doctors.length / PAGE_SIZE));
  const pageDoctors = useMemo(
    () => doctors.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [doctors, page],
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      setErrors((prev) => ({ ...prev, signature: "فرمت مجاز: PNG یا JPG" }));
      e.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, signature: "حداکثر حجم ۲ مگابایت است" }));
      e.target.value = "";
      return;
    }

    setFormData((prev) => ({ ...prev, signature: file }));
    setErrors((prev) => ({ ...prev, signature: undefined }));

    const reader = new FileReader();
    reader.onload = (ev) => setPreviewUrl(ev.target.result);
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.fullName.trim()) newErrors.fullName = "نام پزشک الزامی است";
    if (!formData.specialty.trim()) newErrors.specialty = "تخصص الزامی است";
    if (!formData.medicalCouncilCode.trim())
      newErrors.medicalCouncilCode = "کد نظام پزشکی الزامی است";
    if (!formData.signature)
      newErrors.signature = "آپلود مهر و امضا الزامی است";
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = new FormData();
      payload.append("name", formData.fullName.trim());
      payload.append("specialty", formData.specialty.trim());
      payload.append(
        "medical_council_code",
        formData.medicalCouncilCode.trim(),
      );
      payload.append("stamp", formData.signature); // به جای "signature"

      await api.post("/doctors", payload); // بدون هدر دستی Content-Type

      toast.success("پزشک با موفقیت ثبت شد");
      setFormData({
        fullName: "",
        specialty: "",
        medicalCouncilCode: "",
        signature: null,
      });
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setPage(1);
      fetchDoctors();
    } catch (error) {
      console.error("خطای ثبت پزشک:", error);
      const serverMessage =
        error.response?.data?.message ||
        error.response?.data?.errors?.full_name?.[0] ||
        error.response?.data?.errors?.specialty?.[0] ||
        error.response?.data?.errors?.signature?.[0];
      toast.error(serverMessage || "خطا در ثبت پزشک");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("آیا از حذف این پزشک مطمئن هستید؟")) return;

    try {
      await api.delete(`/doctors/${id}`);
      setDoctors((prev) => prev.filter((d) => d.id !== id));
      toast.success("پزشک حذف شد");
    } catch (error) {
      console.error("خطای حذف پزشک:", error);
      toast.error("خطا در حذف پزشک");
    }
  };

  return (
    <div
      className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 md:p-8"
      dir="rtl"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* نوار هدر مینیمال */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                مدیریت پزشکان
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                ثبت و مدیریت اسامی و امضای رسمی کادر درمان
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            بازگشت به داشبورد
          </button>
        </div>

        {/* بخش اصلی در دو ستون */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* فرم ثبت پزشک */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-600" />
                ثبت پزشک جدید
              </span>
              <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                فرم ثبت
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  نام و نام خانوادگی <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="مثال: دکتر علی قربانی"
                  disabled={isSubmitting}
                  className={`w-full px-3.5 py-2 text-sm bg-slate-50 border rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all ${
                    errors.fullName
                      ? "border-red-400 bg-red-50/20"
                      : "border-slate-200"
                  }`}
                />
                {errors.fullName && (
                  <p className="text-[11px] text-red-500 mt-1">
                    {errors.fullName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  تخصص <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="specialty"
                  value={formData.specialty}
                  onChange={handleChange}
                  placeholder="مثال: متخصص قلب و عروق"
                  disabled={isSubmitting}
                  className={`w-full px-3.5 py-2 text-sm bg-slate-50 border rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all ${
                    errors.specialty
                      ? "border-red-400 bg-red-50/20"
                      : "border-slate-200"
                  }`}
                />
                {errors.specialty && (
                  <p className="text-[11px] text-red-500 mt-1">
                    {errors.specialty}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  کد نظام پزشکی <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="medicalCouncilCode"
                  value={formData.medicalCouncilCode}
                  onChange={handleChange}
                  placeholder="مثال: 123456"
                  disabled={isSubmitting}
                  className={`w-full px-3.5 py-2 text-sm bg-slate-50 border rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all ${
                    errors.medicalCouncilCode
                      ? "border-red-400 bg-red-50/20"
                      : "border-slate-200"
                  }`}
                />
                {errors.medicalCouncilCode && (
                  <p className="text-[11px] text-red-500 mt-1">
                    {errors.medicalCouncilCode}
                  </p>
                )}
              </div>
              {/* آپلودر سفارشی به جای فایل اینپوت زشت پیش‌فرض */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  مهر و امضا <span className="text-red-500">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  id="doctor-signature"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handleFileChange}
                  disabled={isSubmitting}
                  className="hidden"
                />
                <label
                  htmlFor="doctor-signature"
                  className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    previewUrl
                      ? "border-emerald-300 bg-emerald-50/30"
                      : errors.signature
                        ? "border-red-300 bg-red-50/30"
                        : "border-slate-200 bg-slate-50 hover:bg-slate-100/70"
                  }`}
                >
                  {previewUrl ? (
                    <div className="flex flex-col items-center gap-2">
                      <img
                        src={previewUrl}
                        alt="پیش‌نمایش"
                        className="h-14 object-contain rounded border border-slate-200 bg-white p-1"
                      />
                      <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> تصویر انتخاب شد
                        (کلیک برای تغییر)
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-center">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                        <UploadCloud className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-medium text-slate-700">
                        کلیک جهت بارگذاری تصویر مهر
                      </span>
                      <span className="text-[10px] text-slate-400">
                        فرمت PNG یا JPG (حداکثر ۲MB)
                      </span>
                    </div>
                  )}
                </label>
                {errors.signature && (
                  <p className="text-[11px] text-red-500 mt-1">
                    {errors.signature}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-blue-500/25 mt-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting ? "در حال ثبت..." : "ثبت پزشک"}
              </button>
            </form>
          </div>

          {/* جدول لیست پزشکان */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 px-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-bold text-slate-800">
                  لیست پزشکان فعال
                </h2>
              </div>
              <span className="text-xs bg-slate-200/70 text-slate-700 font-medium px-2.5 py-0.5 rounded-full">
                {doctors.length.toLocaleString("fa-IR")} نفر
              </span>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin mb-3" />
                <p className="text-sm font-medium text-slate-500">
                  در حال دریافت لیست پزشکان...
                </p>
              </div>
            ) : doctors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-slate-600">
                  پزشکی در سیستم ثبت نشده است
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  از طریق فرم روبرو می‌توانید اولین پزشک را ثبت نمایید.
                </p>
              </div>
            ) : (
              <div className="p-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-[11px] font-semibold">
                        <th className="pb-3 pr-2">پزشک</th>
                        <th className="pb-3 px-2">تخصص</th>
                        <th className="pb-3 px-2 text-center">مهر و امضا</th>
                        <th className="pb-3 px-2">تاریخ ثبت</th>
                        <th className="pb-3 pl-2 text-center">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {pageDoctors.map((doc) => (
                        <tr
                          key={doc.id}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-3 pr-2 font-semibold text-slate-900">
                            {doc.fullName}
                          </td>
                          <td className="py-3 px-2">
                            <span className="inline-block bg-slate-100 text-slate-700 text-[11px] px-2.5 py-1 rounded-md font-medium">
                              {doc.specialty}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            {doc.signatureData ? (
                              <img
                                src={doc.signatureData}
                                alt="مهر"
                                className="h-9 max-w-[80px] object-contain mx-auto rounded border border-slate-200 bg-white p-0.5 shadow-xs"
                              />
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-slate-400 text-[11px]">
                            {doc.createdAt || "—"}
                          </td>
                          <td className="py-3 pl-2 text-center">
                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 pt-2">
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
