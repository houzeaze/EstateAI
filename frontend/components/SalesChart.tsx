
"use client";

import DynamicAnalyticsChart from "./DynamicAnalyticsChart";

type DataRecord = Record<string, unknown>;

type SalesChartProps = {
  data: DataRecord[];
  question: string;
};

export default function SalesChart({
  data,
  question,
}: SalesChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-[#E8E0D2] bg-[#FFFCF7] p-6 text-center">
        <p className="text-sm leading-6 text-[#8A8175]">
          No suitable data is available to visualize for this question.
        </p>
      </div>
    );
  }

  return <DynamicAnalyticsChart data={data} question={question} />;
}