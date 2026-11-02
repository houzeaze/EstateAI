
"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type RecordRow = Record<string, unknown>;

type Props = {
  data: RecordRow[];
  question: string;
};

const GOLD = "#E9A817";
const GREEN = "#65A982";
const COLORS = ["#E9A817", "#65A982", "#8C83D6", "#E99573", "#6EA7C8"];

function isNumeric(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string" || value.trim() === "") return false;
  return Number.isFinite(Number(value));
}

function formatValue(value: unknown): string {
  const number = Number(value);

  if (!Number.isFinite(number)) return String(value ?? "—");

  return number.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

function formatTooltip(value: unknown, key: string): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return String(value ?? "—");

  if (/sales|amount|revenue|price|value/i.test(key)) {
    return `₹${numericValue.toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    })}`;
  }

  if (/rate|percentage|conversion/i.test(key)) {
    return `${numericValue.toLocaleString("en-IN")}%`;
  }

  return formatValue(numericValue);
}

function getDisplayName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function DynamicAnalyticsChart({
  data,
  question,
}: Props) {
  if (!Array.isArray(data) || data.length === 0) return null;

  const validRows = data.filter(
    (row) => row && typeof row === "object" && !Array.isArray(row)
  );

  if (validRows.length === 0) return null;

  const columns = Object.keys(validRows[0]);
  const normalizedQuestion = question.toLowerCase();

  const labelCandidates = [
    "month",
    "date",
    "booking_date",
    "telecaller",
    "telecaller_name",
    "property",
    "property_name",
    "name",
    "status",
    "source",
    "location",
    "team",
    "category",
  ];

  const labelKey =
    labelCandidates.find((key) =>
      columns.some((column) => column.toLowerCase() === key)
    ) ??
    columns.find((column) =>
      validRows.some(
        (row) =>
          row[column] != null &&
          !isNumeric(row[column]) &&
          typeof row[column] !== "object"
      )
    );

  if (!labelKey) return null;

  const numericKeys = columns.filter((column) =>
    validRows.some((row) => isNumeric(row[column]))
  );

  if (numericKeys.length === 0) return null;

  const metricPriority = normalizedQuestion.includes("conversion")
    ? ["conversion_rate"]
    : normalizedQuestion.includes("lead")
      ? ["total_leads", "qualified_leads", "total", "count"]
      : normalizedQuestion.includes("booking")
        ? ["total_bookings", "bookings", "count", "total"]
        : normalizedQuestion.includes("sales") ||
            normalizedQuestion.includes("sell") ||
            normalizedQuestion.includes("revenue")
          ? ["total_sales", "sales", "booking_amount", "revenue", "amount"]
          : normalizedQuestion.includes("price") ||
              normalizedQuestion.includes("value")
            ? ["price", "property_value", "booking_amount", "total_sales"]
            : [
                "total_sales",
                "total_bookings",
                "total_leads",
                "qualified_leads",
                "total",
                "count",
                "booking_amount",
                "price",
                "conversion_rate",
              ];

  const valueKey =
    metricPriority.find((preferred) =>
      numericKeys.some(
        (column) => column.toLowerCase() === preferred
      )
    ) ??
    numericKeys.find((column) =>
      /sales|revenue|amount|bookings|leads|count|total|price|rate|value/i.test(
        column
      )
    ) ??
    numericKeys[0];

  if (!valueKey) return null;

  const chartData = validRows
    .filter((row) => row[labelKey] != null && isNumeric(row[valueKey]))
    .map((row) => ({
      ...row,
      [labelKey]: String(row[labelKey]),
      [valueKey]: Number(row[valueKey]),
    }));

  if (chartData.length === 0) return null;

  const isLeadDistribution =
    /lead.*(status|distribution|breakdown)|status.*(lead|distribution)|distribution.*status/i.test(
      normalizedQuestion
    ) ||
    (labelKey.toLowerCase() === "status" &&
      /lead|status|distribution/i.test(normalizedQuestion));

  const isTimeSeries =
    /month|monthly|trend|over time|by date|daily|weekly|yearly/i.test(
      normalizedQuestion
    ) ||
    /^(month|date|booking_date)$/i.test(labelKey);

  const chartType = isLeadDistribution
    ? "pie"
    : isTimeSeries
      ? "line"
      : "bar";

  const title = isLeadDistribution
    ? "Lead status distribution"
    : isTimeSeries
      ? `${getDisplayName(valueKey)} over time`
      : `${getDisplayName(valueKey)} by ${getDisplayName(labelKey).toLowerCase()}`;

  const hasCurrency = /sales|revenue|amount|price|value/i.test(valueKey);
  const hasPercentage = /rate|percentage|conversion/i.test(valueKey);

  const axisFormatter = (value: number) => {
    if (hasCurrency) {
      if (Math.abs(value) >= 10000000) {
        return `₹${(value / 10000000).toFixed(1)}Cr`;
      }

      if (Math.abs(value) >= 100000) {
        return `₹${(value / 100000).toFixed(1)}L`;
      }

      if (Math.abs(value) >= 1000) {
        return `₹${(value / 1000).toFixed(1)}K`;
      }

      return `₹${value}`;
    }

    return hasPercentage ? `${value}%` : formatValue(value);
  };

  return (
    <section className="mt-8 rounded-2xl border border-[#EEE6D8] bg-[#FFFEFC] p-5 sm:p-7">
      <div className="mb-6">
        <p className="text-lg font-semibold tracking-tight text-[#29251F]">
          {title}
        </p>
        <p className="mt-1 text-sm text-[#8A8175]">
          Based on the records returned for your question
        </p>
      </div>

      <div className="h-[300px] w-full sm:h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "pie" ? (
            <PieChart>
              <Pie
                data={chartData}
                dataKey={valueKey}
                nameKey={labelKey}
                cx="50%"
                cy="46%"
                outerRadius="75%"
                innerRadius="48%"
                paddingAngle={3}
                cornerRadius={4}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`slice-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatTooltip(value, valueKey)}
              />
              <Legend />
            </PieChart>
          ) : chartType === "line" ? (
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 12, left: 8, bottom: 8 }}
            >
              <CartesianGrid
                stroke="#F0E9DD"
                strokeDasharray="4 4"
                vertical={false}
              />
              <XAxis
                dataKey={labelKey}
                tick={{ fill: "#8A8175", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                minTickGap={20}
              />
              <YAxis
                tickFormatter={axisFormatter}
                tick={{ fill: "#8A8175", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={hasCurrency ? 76 : 48}
              />
              <Tooltip
                formatter={(value) => formatTooltip(value, valueKey)}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #EEE6D8",
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey={valueKey}
                name={getDisplayName(valueKey)}
                stroke={GOLD}
                strokeWidth={3}
                dot={{ r: 4, fill: GOLD, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          ) : (
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 12, left: 8, bottom: 8 }}
            >
              <CartesianGrid
                stroke="#F0E9DD"
                strokeDasharray="4 4"
                vertical={false}
              />
              <XAxis
                dataKey={labelKey}
                tick={{ fill: "#8A8175", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={chartData.length > 5 ? -20 : 0}
                textAnchor={chartData.length > 5 ? "end" : "middle"}
                height={chartData.length > 5 ? 65 : 35}
              />
              <YAxis
                tickFormatter={axisFormatter}
                tick={{ fill: "#8A8175", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={hasCurrency ? 76 : 48}
              />
              <Tooltip
                formatter={(value) => formatTooltip(value, valueKey)}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #EEE6D8",
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey={valueKey}
                name={getDisplayName(valueKey)}
                fill={GREEN}
                radius={[6, 6, 0, 0]}
                maxBarSize={56}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  );
}