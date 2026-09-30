"use client";

import React, { useMemo } from "react";
import { EChartsBarChart } from "@/components/evilcharts/charts/echarts-bar-chart";
import { cn } from "@/lib/utils";

const chartConfig = {
  settled: {
    label: "ثبت نهایی و تسویه",
    colors: { light: ["#0891b2"], dark: ["#22d3ee"] }, // فیروزه‌ای نئونی
  },
  draft: {
    label: "پیش‌فاکتور / موقت",
    colors: { light: ["#7c3aed"], dark: ["#a78bfa"] }, // بنفش نئونی
  },
};

const LEGEND = [
  {
    key: "settled",
    label: "ثبت نهایی و تسویه",
    swatch: "bg-[#0891b2] dark:bg-[#22d3ee]",
  },
  {
    key: "draft",
    label: "پیش‌فاکتور / موقت",
    swatch: "bg-[#7c3aed] dark:bg-[#a78bfa]",
  },
];

export function EChartsPeakBarChart({
  data = [],
  title = "بیشترین فعالیت ثبت پرونده",
  subtitle = "پرونده توسط",
}) {
  // داده‌های پیش‌فرض در صورت نبود داده
  const fallbackData = [
    { userName: "علی حسینی", settled: 24, draft: 8 },
    { userName: "خانم محمدی", settled: 18, draft: 5 },
    { userName: "دکتر حسینی", settled: 31, draft: 4 },
    { userName: "پذیرش عصر", settled: 12, draft: 9 },
  ];

  const actualData = data && data.length > 0 ? data : fallbackData;

  // محاسبه کاربر برتر (Peak)
  const peak = useMemo(() => {
    return actualData.reduce(
      (best, row) =>
        (row.settled || 0) + (row.draft || 0) >
        (best.settled || 0) + (best.draft || 0)
          ? row
          : best,
      actualData[0],
    );
  }, [actualData]);

  const peakTotal = (peak?.settled || 0) + (peak?.draft || 0);

  return (
    <div
      className="flex h-full w-full flex-col p-4 bg-card/60 backdrop-blur-md rounded-2xl border border-border shadow-sm"
      dir="rtl"
    >
      {/* هدر آمار و کاربر برتر */}
      <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-3">
        <div className="flex flex-col gap-1 text-right">
          <span className="text-muted-foreground text-xs font-medium">
            {title}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-primary text-2xl sm:text-3xl font-bold tracking-tight">
              {peakTotal.toLocaleString("fa-IR")}
            </span>
            <span className="text-muted-foreground text-xs">
              {subtitle}{" "}
              <span className="text-foreground font-semibold">
                «{peak?.userName}»
              </span>
            </span>
          </div>
        </div>

        {/* نشانگر رنگ‌ها */}
        <div className="flex shrink-0 flex-col items-start gap-1.5 pt-1">
          {LEGEND.map(({ key, label, swatch }) => (
            <span
              key={key}
              className="text-muted-foreground flex items-center gap-2 text-[11px] sm:text-xs font-medium"
            >
              <span className={cn("size-2.5 shrink-0 rounded-[3px]", swatch)} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* چارت */}
      <div className="mt-3 min-h-[260px] w-full flex-1" dir="ltr">
        <EChartsBarChart
          data={actualData}
          config={chartConfig}
          xDataKey="userName"
          className="h-full w-full"
          stackType="stacked"
          enableMaxValueHighlight
        >
          <EChartsBarChart.XAxis dataKey="userName" hideDots />
          <EChartsBarChart.Tooltip />
          <EChartsBarChart.Bar dataKey="draft" radius={6} />
          <EChartsBarChart.Bar dataKey="settled" radius={6} />
        </EChartsBarChart>
      </div>
    </div>
  );
}
