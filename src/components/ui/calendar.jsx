import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { getDefaultClassNames } from "react-day-picker";
import { DayPicker } from "@daypicker/persian";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { CalendarDropdown } from "@/components/ui/calendar-dropdown";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "dropdown",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 bg-white rounded-md border shadow-sm", className)}
      captionLayout={captionLayout}
      startMonth={new Date(1930, 0)}
      endMonth={new Date(2035, 11)}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("fa-IR", { month: "long" }),
        formatYearDropdown: (date) =>
          date.toLocaleString("fa-IR-u-ca-persian", { year: "numeric" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "relative flex flex-col gap-4 sm:flex-row",
          defaultClassNames.months,
        ),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          "flex h-7 w-full items-center justify-center gap-1.5 font-medium text-sm",
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          "flex items-center gap-1.5 text-sm font-medium",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          "relative rounded-md border border-slate-200 bg-white px-1.5 py-0.5 hover:bg-slate-50",
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn("bg-white", defaultClassNames.dropdown),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-slate-500 rounded-md w-9 font-normal text-[0.8rem] text-center",
          defaultClassNames.weekday,
        ),
        week: cn("flex w-full mt-2", defaultClassNames.week),
        day: cn(
          "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
          defaultClassNames.day,
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-emerald-50 hover:text-emerald-600",
        ),
        selected:
          "bg-emerald-600 text-white hover:bg-emerald-600 hover:text-white focus:bg-emerald-600 focus:text-white rounded-md",
        today: "bg-slate-100 text-slate-900 rounded-md font-bold",
        outside: "text-slate-400 opacity-50",
        disabled: "text-slate-400 opacity-50",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...iconProps }) => {
          if (orientation === "left") {
            return <ChevronLeft className="h-4 w-4" {...iconProps} />;
          }
          if (orientation === "right") {
            return <ChevronRight className="h-4 w-4" {...iconProps} />;
          }
          return <ChevronDown className="h-4 w-4" {...iconProps} />;
        },
        Dropdown: CalendarDropdown,
        ...components,
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
