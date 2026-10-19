interface SummaryItem {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "info";
}

const toneClass: Record<NonNullable<SummaryItem["tone"]>, string> = {
  default: "text-white",
  success: "text-green-300",
  warning: "text-amber-200",
  info: "text-blue-200",
};

export function HistorySummaryStrip({ items }: { items: SummaryItem[] }) {
  return (
    <div className="grid grid-cols-2 border-b border-gray-800 bg-[#121417] md:grid-cols-3 xl:grid-cols-5">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`min-w-0 px-4 py-4 ${index > 0 ? "border-l border-gray-800" : ""}`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
          <p className={`mt-1 truncate text-lg font-black ${toneClass[item.tone || "default"]}`} title={item.value}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

