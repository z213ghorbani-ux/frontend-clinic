import React, { useEffect, useRef, useMemo } from "react";
import * as echarts from "echarts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

export function SecretaryPerformanceChart({ reports = [] }) {
  const chartRef = useRef(null);

  // استخراج و پردازش عملکرد منشی‌ها بر اساس audit_logs و لاگ‌های ثبت
  const chartData = useMemo(() => {
    const statsByUser = {};

    reports.forEach((report) => {
      // بررسی لاگ‌های حسابرسی (audit_logs)
      if (Array.isArray(report?.audit_logs) && report.audit_logs.length > 0) {
        report.audit_logs.forEach((log) => {
          const userName = log?.user?.name || log?.user_name || "نامشخص";
          if (!statsByUser[userName]) {
            statsByUser[userName] = { draft: 0, final: 0 };
          }

          const action = (log?.action || "").toLowerCase();
          const desc = (log?.description || "").toLowerCase();

          if (
            action.includes("draft") ||
            action.includes("create") ||
            desc.includes("موقت")
          ) {
            statsByUser[userName].draft += 1;
          } else if (
            action.includes("final") ||
            action.includes("complete") ||
            desc.includes("نهایی")
          ) {
            statsByUser[userName].final += 1;
          } else {
            // در صورت نامشخص بودن، پیش‌فرض روی ثبت نهایی
            statsByUser[userName].final += 1;
          }
        });
      } else {
        // فال‌بک در صورت عدم وجود audit_logs (استفاده از سازنده گزارش یا وضعیت)
        const creatorName =
          report?.creator?.name || report?.user?.name || "کاربر سیستم";
        if (!statsByUser[creatorName]) {
          statsByUser[creatorName] = { draft: 0, final: 0 };
        }

        if (report?.status === "draft" || report?.is_draft) {
          statsByUser[creatorName].draft += 1;
        } else {
          statsByUser[creatorName].final += 1;
        }
      }
    });

    const categories = Object.keys(statsByUser);
    const draftData = categories.map((user) => statsByUser[user].draft);
    const finalData = categories.map((user) => statsByUser[user].final);

    return { categories, draftData, finalData };
  }, [reports]);

  useEffect(() => {
    if (!chartRef.current) return;

    const chartInstance = echarts.init(chartRef.current);

    const option = {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        textStyle: {
          fontFamily: "Vazirmatn, Tahoma, sans-serif",
          fontSize: 12,
        },
        formatter: (params) => {
          let result = `<div class="font-bold mb-1">${params[0].name}</div>`;
          params.forEach((item) => {
            result += `
              <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 4px;">
                <span>${item.marker} ${item.seriesName}:</span>
                <span style="font-weight: bold;">${item.value.toLocaleString("fa-IR")} مورد</span>
              </div>
            `;
          });
          return result;
        },
      },
      legend: {
        data: ["ثبت موقت", "ثبت نهایی"],
        bottom: 0,
        textStyle: { fontFamily: "Vazirmatn, Tahoma, sans-serif" },
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "15%",
        top: "10%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data:
          chartData.categories.length > 0
            ? chartData.categories
            : ["داده‌ای یافت نشد"],
        axisLabel: {
          fontFamily: "Vazirmatn, Tahoma, sans-serif",
          interval: 0,
          rotate: chartData.categories.length > 5 ? 25 : 0,
        },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLabel: {
          fontFamily: "Vazirmatn, Tahoma, sans-serif",
          formatter: (value) => value.toLocaleString("fa-IR"),
        },
        splitLine: {
          lineStyle: { type: "dashed", opacity: 0.3 },
        },
      },
      series: [
        {
          name: "ثبت موقت",
          type: "bar",
          stack: "total",
          barWidth: "40%",
          itemStyle: {
            color: "#f59e0b", // کهربایی / Amber
            borderRadius: [0, 0, 4, 4],
          },
          data: chartData.draftData,
        },
        {
          name: "ثبت نهایی",
          type: "bar",
          stack: "total",
          barWidth: "40%",
          itemStyle: {
            color: "#10b981", // سبز / Emerald
            borderRadius: [4, 4, 0, 0],
          },
          data: chartData.finalData,
        },
      ],
    };

    chartInstance.setOption(option);

    const handleResize = () => chartInstance.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chartInstance.dispose();
    };
  }, [chartData]);

  return (
    <Card className="border border-slate-200 dark:border-slate-800 shadow-sm mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-100">
          <Users className="w-5 h-5 text-indigo-500" />
          نمودار تحلیلی عملکرد منشی‌ها (تفکیک ثبت موقت و نهایی)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={chartRef} className="w-full h-72" />
      </CardContent>
    </Card>
  );
}
