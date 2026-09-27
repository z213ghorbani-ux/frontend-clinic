import * as React from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function PersianDatePicker({
  value,
  onChange,
  placeholder = "انتخاب تاریخ",
  error = false,
  className,
}) {
  const [open, setOpen] = React.useState(false);

  // فرمت تاریخ شمسی با Intl بومی جاوااسکریپت بدون نیاز به پکیج خارجی
  const formattedValue = React.useMemo(() => {
    if (!value) return "";
    try {
      const dateObj = value instanceof Date ? value : new Date(value);
      if (isNaN(dateObj.getTime())) return String(value);
      return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(dateObj);
    } catch {
      return String(value);
    }
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-between text-right font-normal bg-white h-10 px-3",
            !value && "text-muted-foreground",
            error && "border-red-500 ring-1 ring-red-500",
            className,
          )}
        >
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-slate-400 shrink-0" />
            <span>{formattedValue || placeholder}</span>
          </div>
          {value && (
            <X
              className="h-3.5 w-3.5 text-slate-400 hover:text-slate-700 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border shadow-lg" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(selectedDate) => {
            onChange(selectedDate);
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
