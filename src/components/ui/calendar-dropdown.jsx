import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function CalendarDropdown({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef(null);
  const listRef = React.useRef(null);
  const selected = options?.find((o) => String(o.value) === String(value));

  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside, true);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside, true);
  }, [open]);

  React.useEffect(() => {
    if (open && listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]');
      activeEl?.scrollIntoView({ block: "center" });
    }
  }, [open]);

  const handleSelect = (val) => {
    onChange?.({ target: { value: String(val) } });
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-emerald-400 hover:bg-emerald-50"
      >
        {selected?.label}
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 max-h-64 min-w-[6rem] overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          <div className="flex flex-col">
            {options?.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={opt.disabled}
                data-active={String(opt.value) === String(value)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(opt.value);
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-right text-sm transition-colors hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40",
                  String(opt.value) === String(value) &&
                    "bg-emerald-600 text-white hover:bg-emerald-600 hover:text-white",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
