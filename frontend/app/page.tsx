"use client";

import { useState, type ReactNode, type ChangeEvent } from "react";
import {
  ArrowUp,
  BarChart3,
  Building2,
  ChevronDown,
  Clock3,
  Command,
  FileText,
  IndianRupee,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  Users,
  X,
} from "lucide-react";

import SalesChart from "@/components/SalesChart";
import { askAI, askPDF } from "@/lib/api";
// import { useState, type ReactNode } from "react";

type ActiveTab = "database" | "pdf";
type DataRecord = Record<string, unknown>;

type AIResponse = {
  answer?: string;
  message?: string;
  data?: DataRecord[];
  metrics?: {
    records_returned?: number;
    truncated?: boolean;
  };
  intent?: string;
};

const suggestions = [
  {
    title: "Who is performing best?",
    shortTitle: "Top performer",
    question: "Which telecaller performed best this month?",
    icon: TrendingUp,
    description: "See your strongest team members",
  },
  {
    title: "How are sales doing?",
    shortTitle: "Sales overview",
    question: "How much did we sell this month?",
    icon: IndianRupee,
    description: "Understand your sales performance",
  },
  {
    title: "Which property is winning?",
    shortTitle: "Top property",
    question: "Which property has the most bookings?",
    icon: Building2,
    description: "Find your best-selling properties",
  },
];

const recentQuestions = [
  "Which telecaller performed best this month?",
  "How much did we sell this month?",
  "Which property has the most bookings?",
];

function SidebarItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[11px] font-medium transition ${
        active
          ? "bg-[#FFEFC7] font-bold text-[#55462D]"
          : "text-[#81786C] hover:bg-[#FFF5E2] hover:text-[#4E4539]"
      }`}
    >
      <span className={active ? "text-[#D99A20]" : "text-[#B3A99B]"}>
        {icon}
      </span>
      {label}
    </button>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("database");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Database assistant state
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [aiData, setAiData] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // PDF assistant state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfQuestion, setPdfQuestion] = useState("");
  const [pdfAnswer, setPdfAnswer] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");

  // PDF chart state — kept separate from database chart state
  const [pdfChartData, setPdfChartData] = useState<DataRecord[] | null>(null);
  const [pdfChartTitle, setPdfChartTitle] = useState<string | null>(null);
  const [pdfChartType, setPdfChartType] = useState<
    "bar" | "line" | "pie" | null
  >(null);

  // Database question handler
  const handleAskAI = async () => {
    if (!question.trim() || loading) return;

    try {
      setLoading(true);
      setAnswer("");
      setAiData(null);

      const result: AIResponse = await askAI(question);

      console.log("AI RESPONSE:", result);

      setAnswer(result.answer || result.message || "No answer returned.");
      setAiData(result);
    } catch (error) {
      console.error("AI ERROR:", error);

      setAnswer(
        "I couldn't connect to your business data right now. Please make sure the analytics service is running.",
      );
    } finally {
      setLoading(false);
    }
  };

  // PDF question handler
  const handleAskPDF = async () => {
    if (!pdfFile || !pdfQuestion.trim() || pdfLoading) return;

    try {
      setPdfLoading(true);
      setPdfError("");
      setPdfAnswer("");

      // Clear any graph from the previous PDF question.
      setPdfChartData(null);
      setPdfChartTitle(null);
      setPdfChartType(null);

      const result = await askPDF(pdfFile, pdfQuestion);

      setPdfAnswer(result.answer || "No answer returned.");

      // Display a graph only when the backend provides chart data.
      if (Array.isArray(result.chart_data) && result.chart_data.length > 0) {
        setPdfChartData(result.chart_data);
        setPdfChartTitle(result.chart_title);
        setPdfChartType(result.chart_type);
      }
    } catch (error) {
      console.error("PDF QUESTION ERROR:", error);

      setPdfError(
        error instanceof Error
          ? error.message
          : "Unable to answer your PDF question. Please try again.",
      );
    } finally {
      setPdfLoading(false);
    }
  };

  // Clear database conversation
  const clearConversation = () => {
    setQuestion("");
    setAnswer("");
    setAiData(null);
    setActiveTab("database");
    setSidebarOpen(false);
  };

  // Switch sidebar tabs
  const openTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  // Fill the database question box from a suggestion
  const handleSuggestion = (text: string) => {
    setQuestion(text);

    setTimeout(() => {
      document.getElementById("ask-box")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);
  };

  // Validate a selected PDF and clear previous results.
  const handlePDFFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;

    setPdfFile(null);
    setPdfAnswer("");
    setPdfError("");
    setPdfQuestion("");
    setPdfChartData(null);
    setPdfChartTitle(null);
    setPdfChartType(null);

    if (!selectedFile) return;

    const filename = selectedFile.name.toLowerCase();

    const isPDF = filename.endsWith(".pdf");
    const isCSV = filename.endsWith(".csv");
    const isExcel = filename.endsWith(".xlsx");

    if (!isPDF && !isCSV && !isExcel) {
      setPdfError("Please select a PDF, CSV, or Excel (.xlsx) file.");
      event.target.value = "";
      return;
    }

    if (isPDF && selectedFile.type && selectedFile.type !== "application/pdf") {
      setPdfError("Please select a valid PDF file.");
      event.target.value = "";
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setPdfError("The file must be 10 MB or smaller.");
      event.target.value = "";
      return;
    }

    setPdfFile(selectedFile);
  };

  const records = Array.isArray(aiData?.data) ? aiData.data : [];
  const columns = records.length > 0 ? Object.keys(records[0]) : [];

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#FFFCF7] text-[#29251F]">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-40 h-[550px] w-[550px] rounded-full bg-[#FFE7A8]/35 blur-[130px]" />
        <div className="absolute right-[-160px] top-[80px] h-[500px] w-[500px] rounded-full bg-[#EDE0FF]/35 blur-[140px]" />
        <div className="absolute bottom-[-200px] left-[35%] h-[500px] w-[500px] rounded-full bg-[#DDF4E8]/30 blur-[140px]" />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-stone-900/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col border-r border-[#EEE6D8] bg-[#FFFDF9]/95 px-5 py-6 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-gradient-to-br from-[#F8B938] to-[#F59E0B] text-white shadow-[0_8px_22px_rgba(245,158,11,0.25)]">
              <Sparkles className="h-5 w-5" />
            </div>

            <div>
              <p className="text-[18px] font-extrabold tracking-[-0.04em] text-[#29251F]">
                Estate<span className="text-[#E99B12]">AI</span>
              </p>
              <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.22em] text-[#A79D8C]">
                Business Intelligence
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-xl p-1.5 text-stone-400 hover:bg-amber-50 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* New conversation */}
        <button
          type="button"
          onClick={clearConversation}
          className="mt-9 flex items-center gap-3 rounded-2xl border border-[#F0D9A8] bg-gradient-to-r from-[#FFF7E5] to-[#FFF1CF] px-4 py-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5B52E] text-white shadow-sm">
            <Plus className="h-4 w-4 stroke-[2.5]" />
          </div>

          <div>
            <p className="text-[11px] font-bold text-[#55462D]">
              Start a new question
            </p>
            <p className="mt-0.5 text-[9px] text-[#A28E69]">
              Ask about your business
            </p>
          </div>

          <span className="ml-auto rounded-lg border border-[#EFDDBA] bg-white px-1.5 py-0.5 text-[8px] font-medium text-[#A28E69]">
            ⌘ K
          </span>
        </button>

        {/* Navigation */}
        <div className="mt-9">
          <p className="mb-3 px-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[#AAA091]">
            Your workspace
          </p>

          <nav className="space-y-1.5">
            <SidebarItem
              icon={<Sparkles className="h-4 w-4" />}
              label="Ask EstateAI"
              active={activeTab === "database"}
              onClick={() => openTab("database")}
            />

            <SidebarItem
              icon={<FileText className="h-4 w-4" />}
              label="PDF Assistant"
              active={activeTab === "pdf"}
              onClick={() => openTab("pdf")}
            />

            <SidebarItem
              icon={<BarChart3 className="h-4 w-4" />}
              label="Sales overview"
              onClick={() => {
                openTab("database");
                setQuestion("How much did we sell this month?");
              }}
            />

            <SidebarItem
              icon={<Users className="h-4 w-4" />}
              label="Team performance"
              onClick={() => {
                openTab("database");
                setQuestion("Which telecaller performed best this month?");
              }}
            />

            <SidebarItem
              icon={<Building2 className="h-4 w-4" />}
              label="Properties"
              onClick={() => {
                openTab("database");
                setQuestion("Which property has the most bookings?");
              }}
            />
          </nav>
        </div>

        {/* Sidebar tip */}
        <div className="mt-9 rounded-2xl border border-[#EDE5D8] bg-white/70 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFF1CF]">
              <MessageSquare className="h-3.5 w-3.5 text-[#D99A20]" />
            </div>

            <p className="text-[10px] font-bold text-[#5A5144]">
              You can simply ask
            </p>
          </div>

          <p className="mt-3 text-[9px] leading-5 text-[#968D80]">
            {activeTab === "database"
              ? "Ask about your sales, leads, telecallers, and properties."
              : "Upload a PDF report and ask questions about its contents."}
          </p>
        </div>

        {/* Recent questions */}
        {activeTab === "database" && (
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between px-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#AAA091]">
                Recent questions
              </p>
              <Clock3 className="h-3.5 w-3.5 text-[#BDB4A6]" />
            </div>

            <div className="space-y-1">
              {recentQuestions.map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => {
                    setQuestion(item);
                    setSidebarOpen(false);
                  }}
                  className="w-full truncate rounded-xl px-3 py-2.5 text-left text-[10px] font-medium text-[#82796C] transition hover:bg-[#FFF5E2] hover:text-[#4E4539]"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sidebar footer */}
        <div className="mt-auto border-t border-[#EEE6D8] pt-4">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-[10px] font-medium text-[#81786C] hover:bg-[#FFF5E2]"
          >
            <Command className="h-4 w-4 text-[#B3A99B]" />
            Keyboard shortcuts
          </button>

          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[#F0E6D5] bg-white p-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#F8B938] to-[#F59E0B] text-xs font-bold text-white">
              M
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-bold text-[#40392F]">
                Maanvi Gupta
              </p>
              <p className="truncate text-[9px] text-[#AAA092]">
                Administrator
              </p>
            </div>

            <ChevronDown className="h-4 w-4 text-[#AFA699]" />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="relative min-h-screen lg:pl-[270px]">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-[70px] items-center justify-between border-b border-[#EEE8DC] bg-[#FFFCF7]/85 px-5 backdrop-blur-xl sm:px-9 lg:px-12">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl p-2 text-stone-500 hover:bg-amber-50 lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="hidden items-center gap-2 text-[10px] font-medium sm:flex">
              <span className="text-[#A9A093]">Workspace</span>
              <span className="text-[#D2C9BA]">/</span>
              <span className="font-bold text-[#5E5549]">
                {activeTab === "database" ? "Ask EstateAI" : "PDF Assistant"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-[#CFE8D9] bg-[#F1FAF4] px-3.5 py-1.5 sm:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#55AD7B] opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4B9D6E]" />
              </span>

              <span className="text-[9px] font-bold text-[#4C8062]">
                Your data is connected
              </span>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#F8B938] to-[#F59E0B] text-xs font-bold text-white shadow-sm">
              M
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1120px] px-5 pb-20 pt-14 sm:px-8 sm:pt-18 lg:px-12 lg:pt-20">
          {/* Page heading */}
          <section className="mx-auto max-w-[800px] text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#F1D79D] bg-[#FFF4D8] px-4 py-2 shadow-sm">
              {activeTab === "database" ? (
                <Sparkles className="h-3.5 w-3.5 text-[#E2A21D]" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-[#E2A21D]" />
              )}

              <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#9C711E]">
                {activeTab === "database"
                  ? "Your business, made simple"
                  : "Your documents, made simple"}
              </span>
            </div>

            <h1 className="text-[40px] font-extrabold leading-[1.08] tracking-[-0.055em] text-[#29251F] sm:text-[52px] lg:text-[60px]">
              {activeTab === "database" ? (
                <>
                  What would you like
                  <br />
                  <span className="bg-gradient-to-r from-[#E5A321] via-[#F0B82F] to-[#E98B2A] bg-clip-text text-transparent">
                    to know today?
                  </span>
                </>
              ) : (
                <>
                  Ask your
                  <br />
                  <span className="bg-gradient-to-r from-[#E5A321] via-[#F0B82F] to-[#E98B2A] bg-clip-text text-transparent">
                    documents anything.
                  </span>
                </>
              )}
            </h1>

            <p className="mx-auto mt-6 max-w-[610px] text-[13px] font-medium leading-7 text-[#8A8175] sm:text-[14px]">
              {activeTab === "database"
                ? "Ask EstateAI about your sales, team, leads or properties. You don't need to know anything technical — just ask normally."
                : "Upload a PDF report and ask questions about its contents. Your database chat stays in its own tab."}
            </p>
          </section>

          {/* DATABASE ASSISTANT TAB */}
          {activeTab === "database" && (
            <>
              {/* Database question box */}
              <section id="ask-box" className="mx-auto mt-12 max-w-[850px]">
                <div className="rounded-[27px] border border-[#EBD8AE] bg-white p-2.5 shadow-[0_18px_60px_rgba(179,131,38,0.10)] transition-all focus-within:border-[#E9B94C]">
                  <div className="rounded-[20px] border border-[#F2E7D0] bg-[#FFFDF8] px-5 py-5 sm:px-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-[#F8BC3F] to-[#F39E0B] text-white">
                        <Sparkles className="h-4 w-4" />
                      </div>

                      <textarea
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void handleAskAI();
                          }
                        }}
                        rows={2}
                        placeholder="For example: Which telecaller brought the most sales this month?"
                        aria-label="Ask a question about your business database"
                        className="min-h-[75px] w-full resize-none bg-transparent pt-1 text-[14px] font-medium leading-7 text-[#453F36] outline-none placeholder:text-[#B1A89C]"
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-[#F1E8D8] pt-3">
                      <div className="flex items-center gap-2 text-[9px] font-semibold text-[#A19789]">
                        <MessageSquare className="h-3.5 w-3.5 text-[#D9A12A]" />
                        <span>Ask questions about your business data</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleAskAI()}
                        disabled={loading || !question.trim()}
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-[#F7B936] to-[#F39A0A] text-white shadow-sm transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="Ask EstateAI"
                      >
                        {loading ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : (
                          <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Database question suggestions */}
                <div className="mt-6">
                  <p className="mb-3 text-center text-[9px] font-bold uppercase tracking-[0.18em] text-[#AAA092]">
                    Try asking one of these
                  </p>

                  <div className="flex flex-wrap justify-center gap-2.5">
                    {suggestions.map((item) => {
                      const Icon = item.icon;

                      return (
                        <button
                          key={item.question}
                          type="button"
                          onClick={() => handleSuggestion(item.question)}
                          className="group flex items-center gap-2.5 rounded-full border border-[#E8E1D6] bg-white px-4 py-2.5 text-[10px] font-bold text-[#70685D] shadow-sm transition hover:-translate-y-0.5 hover:border-[#E7C77F] hover:bg-[#FFF9EC]"
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#FFF2D2] text-[#D89A1D]">
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          {item.shortTitle}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* Database loading */}
              {loading && (
                <section className="mx-auto mt-14 max-w-[850px]">
                  <div className="rounded-[25px] border border-[#EBDDBF] bg-white p-7 shadow-[0_10px_35px_rgba(180,140,50,0.08)]">
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#F8BC3F] to-[#F39E0B] text-white shadow-sm">
                        <Sparkles className="h-5 w-5 animate-pulse" />
                      </div>

                      <div>
                        <p className="text-[12px] font-bold text-[#453E34]">
                          Looking through your business data...
                        </p>
                        <p className="mt-1 text-[10px] text-[#A39A8E]">
                          Finding the numbers that answer your question
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#FFF4D9]">
                      <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-[#F4B52D] to-[#F39A0A]" />
                    </div>
                  </div>
                </section>
              )}

              {/* Database answer and results */}
              {answer && !loading && (
                <section className="mx-auto mt-14 max-w-[850px] space-y-5">
                  <div className="overflow-hidden rounded-[27px] border border-[#EADDBF] bg-white shadow-[0_15px_45px_rgba(170,130,50,0.08)]">
                    <div className="flex items-center justify-between border-b border-[#F1E9DA] bg-[#FFF9EC] px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-gradient-to-br from-[#F8BC3F] to-[#F39E0B] text-white shadow-sm">
                          <Sparkles className="h-4 w-4" />
                        </div>

                        <div>
                          <p className="text-[12px] font-bold text-[#443D33]">
                            Here's what I found
                          </p>
                          <p className="mt-0.5 text-[9px] text-[#A49A8D]">
                            Based on your business data
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={clearConversation}
                        className="rounded-xl p-2 text-[#ADA397] hover:bg-[#F9EFD9]"
                        aria-label="Clear result"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="p-7 sm:p-9">
                      <p className="whitespace-pre-wrap text-[14px] font-medium leading-8 text-[#554D42]">
                        {answer}
                      </p>

                      {aiData?.intent && (
                        <div className="mt-7 flex items-center gap-2 border-t border-[#F1EBDD] pt-5">
                          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#AAA092]">
                            Analysis
                          </span>
                          <span className="rounded-full border border-[#F0DCA9] bg-[#FFF5D9] px-3 py-1.5 text-[9px] font-bold text-[#A1751F]">
                            {aiData.intent}
                          </span>
                        </div>
                      )}

                      {/* Database results table */}
                      {records.length > 0 && (
                        <div className="mt-8 border-t border-[#F1EBDD] pt-6">
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="text-[13px] font-bold text-[#443D33]">
                                Matching records
                              </h3>
                              <p className="mt-1 text-[10px] text-[#A49A8D]">
                                Actual results retrieved from your database
                              </p>
                            </div>

                            <span className="rounded-full border border-[#CFE8D9] bg-[#F1FAF4] px-3 py-1.5 text-[10px] font-bold text-[#4C8062]">
                              {aiData?.metrics?.records_returned ??
                                records.length}{" "}
                              records
                            </span>
                          </div>

                          <div className="overflow-x-auto rounded-xl border border-[#EEE6D8]">
                            <table className="w-full border-collapse text-left">
                              <thead className="bg-[#FFF9EC]">
                                <tr>
                                  {columns.map((column) => (
                                    <th
                                      key={column}
                                      className="whitespace-nowrap border-b border-[#EEE6D8] px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#8A7960]"
                                    >
                                      {column.replace(/_/g, " ")}
                                    </th>
                                  ))}
                                </tr>
                              </thead>

                              <tbody>
                                {records.map((record, index) => (
                                  <tr
                                    key={index}
                                    className="transition hover:bg-[#FFFCF7]"
                                  >
                                    {columns.map((column) => {
                                      const value = record[column];

                                      return (
                                        <td
                                          key={column}
                                          className="whitespace-nowrap border-b border-[#F2EDE4] px-4 py-3 text-[11px] text-[#554D42] last:border-b-0"
                                        >
                                          {value == null
                                            ? "—"
                                            : typeof value === "object"
                                              ? JSON.stringify(value)
                                              : String(value)}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {aiData?.metrics?.truncated && (
                            <p className="mt-3 text-[10px] text-[#9B8060]">
                              Showing {records.length} returned records.
                              Additional matching records may exist.
                            </p>
                          )}
                        </div>
                      )}

                      {Array.isArray(aiData?.data) && records.length === 0 && (
                        <div className="mt-6 rounded-xl border border-[#EEE6D8] bg-[#FFFCF7] px-4 py-4">
                          <p className="text-[11px] text-[#8A8175]">
                            No matching database records were returned.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Existing database performance chart */}
                  <div className="rounded-[27px] border border-[#EADFCB] bg-white p-6 shadow-[0_10px_35px_rgba(100,80,40,0.05)] sm:p-8">
                    <div className="mb-7 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF7EF]">
                            <BarChart3 className="h-3.5 w-3.5 text-[#4E9A70]" />
                          </div>
                          <h3 className="text-[12px] font-bold text-[#40392F]">
                            Performance overview
                          </h3>
                        </div>

                        <p className="mt-2 text-[9px] text-[#A39A8E]">
                          A visual view of your business performance
                        </p>
                      </div>

                      <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-xl border border-[#E8E0D2] bg-[#FFFCF7] px-3 py-2 text-[9px] font-bold text-[#766D60]"
                      >
                        This month
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>

                    <SalesChart data={records} question={question} />
                  </div>
                </section>
              )}

              {/* Database empty state */}
              {!answer && !loading && (
                <section className="mx-auto mt-20 max-w-[980px]">
                  <div className="mb-6 text-center">
                    <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF1CE]">
                      <Target className="h-4 w-4 text-[#D89C20]" />
                    </div>

                    <h2 className="text-[15px] font-bold text-[#4A4238]">
                      Here's what you can ask
                    </h2>
                    <p className="mt-1.5 text-[10px] text-[#A49B8F]">
                      No special commands. Just ask about the things you care
                      about.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {suggestions.map((item) => {
                      const Icon = item.icon;

                      return (
                        <button
                          key={item.question}
                          type="button"
                          onClick={() => handleSuggestion(item.question)}
                          className="group relative overflow-hidden rounded-[24px] border border-[#E9E1D4] bg-white p-6 text-left shadow-[0_5px_20px_rgba(100,80,40,0.035)] transition duration-300 hover:-translate-y-1 hover:border-[#E6C979] hover:shadow-[0_15px_35px_rgba(130,100,40,0.09)]"
                        >
                          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#FFF4D4] opacity-70 blur-2xl" />

                          <div className="relative">
                            <div className="flex items-center justify-between">
                              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF2D2] text-[#D89A1D] shadow-sm transition group-hover:scale-110">
                                <Icon className="h-5 w-5" />
                              </div>
                            </div>

                            <p className="mt-5 text-[13px] font-bold text-[#453E34]">
                              {item.title}
                            </p>
                            <p className="mt-1.5 text-[10px] leading-relaxed text-[#92887A]">
                              {item.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}

          {/* PDF ASSISTANT TAB */}
          {activeTab === "pdf" && (
            <section className="mx-auto mt-12 max-w-[850px]">
              <div className="rounded-[27px] border border-[#EBD8AE] bg-white p-7 shadow-[0_18px_60px_rgba(179,131,38,0.10)] sm:p-9">
                {/* PDF heading */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-gradient-to-br from-[#F8BC3F] to-[#F39E0B] text-white">
                    <FileText className="h-4 w-4" />
                  </div>

                  <div>
                    <h2 className="text-[14px] font-bold text-[#443D33]">
                      Upload a PDF or CSV Document
                    </h2>
                    <p className="text-[10px] text-[#A49A8D]">
                      Ask questions and extract insights directly from your
                      files
                    </p>
                  </div>
                </div>

                {/* PDF file selection */}
                <div className="mt-6">
                  <label
                    htmlFor="pdf-upload"
                    className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#E5DAC4] bg-[#FFFDF9] px-6 py-8 text-center transition hover:border-[#D89A1D]"
                  >
                    <Upload className="h-8 w-8 text-[#D89A1D]" />

                    <span className="mt-3 break-all text-[12px] font-bold text-[#554D42]">
                      {pdfFile
                        ? pdfFile.name
                        : "Click to upload a PDF document"}
                    </span>

                    <span className="mt-1 text-[10px] text-[#A49A8D]">
                      PDF files up to 10 MB
                    </span>

                    <input
                      id="pdf-upload"
                      type="file"
                      accept=".pdf,.csv,.xlsx,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="sr-only"
                      onChange={handlePDFFileChange}
                    />
                  </label>

                  {pdfFile && (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[#D8EBDD] bg-[#F5FBF6] p-3">
                      <p className="break-all text-[10px] font-medium text-[#416B50]">
                        Selected: {pdfFile.name}
                      </p>

                      <button
                        type="button"
                        onClick={() => {
                          setPdfFile(null);
                          setPdfQuestion("");
                          setPdfAnswer("");
                          setPdfError("");

                          setPdfChartData(null);
                          setPdfChartTitle(null);
                          setPdfChartType(null);

                          const input = document.getElementById(
                            "pdf-upload",
                          ) as HTMLInputElement | null;

                          if (input) input.value = "";
                        }}
                        className="flex-shrink-0 rounded-lg p-1 text-[#7E9584] hover:bg-[#E8F4EB]"
                        aria-label="Remove selected PDF"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* PDF question */}
                {pdfFile && (
                  <div className="mt-6 space-y-4">
                    <label
                      htmlFor="pdf-question"
                      className="block text-[11px] font-bold text-[#554D42]"
                    >
                      Ask a question about this document
                    </label>

                    <textarea
                      id="pdf-question"
                      value={pdfQuestion}
                      onChange={(event) => {
                        setPdfQuestion(event.target.value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void handleAskPDF();
                        }
                      }}
                      rows={3}
                      placeholder="Summarize this report, find a figure, or ask for a graph of the data..."
                      className="min-h-[75px] w-full resize-y rounded-2xl border border-[#F2E7D0] bg-[#FFFDF8] p-4 text-[13px] font-medium leading-7 text-[#453F36] outline-none placeholder:text-[#B1A89C] focus:border-[#E9B94C]"
                    />

                    <p className="text-[10px] leading-5 text-[#A49A8D]">
                      Graphs are generated only when you explicitly ask for a
                      graph, chart, plot, or visualization and the document
                      contains suitable numerical data.
                    </p>

                    <button
                      type="button"
                      onClick={() => void handleAskPDF()}
                      disabled={pdfLoading || !pdfQuestion.trim()}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#F7B936] to-[#F39E0B] px-5 py-3 text-[12px] font-bold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {pdfLoading ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Analyzing document...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Ask PDF Assistant
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* PDF error */}
                {pdfError && (
                  <div
                    role="alert"
                    className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-[11px] text-red-600"
                  >
                    {pdfError}
                  </div>
                )}

                {/* PDF written answer and optional graph */}
                {pdfAnswer && !pdfLoading && (
                  <div className="mt-8 rounded-2xl border border-[#EADDBF] bg-[#FFF9EC] p-6">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[#D89C20]" />
                      <h3 className="text-[12px] font-bold text-[#443D33]">
                        Answer from PDF
                      </h3>
                    </div>

                    <p className="mt-2 whitespace-pre-wrap break-words text-[13px] font-medium leading-7 text-[#554D42]">
                      {pdfAnswer}
                    </p>

                    {/* Show a graph only when the backend returns chart data */}
                    {pdfChartData && pdfChartData.length > 0 && (
                      <div className="mt-8 rounded-2xl border border-[#EADFCB] bg-white p-5 sm:p-6">
                        <div className="mb-5 flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-[#4E9A70]" />

                          <h3 className="text-[13px] font-bold text-[#443D33]">
                            {pdfChartTitle || "Graph from your PDF"}
                          </h3>
                        </div>

                        <SalesChart
                          data={pdfChartData}
                          question={`${pdfQuestion}. Display this as a ${pdfChartType || "bar"} chart using the supplied PDF data.`}
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setPdfQuestion("");
                        setPdfAnswer("");
                        setPdfError("");

                        setPdfChartData(null);
                        setPdfChartTitle(null);
                        setPdfChartType(null);
                      }}
                      className="mt-6 rounded-xl border border-[#E8E0D2] bg-white px-4 py-2.5 text-[10px] font-bold text-[#766D60] transition hover:bg-[#FFF9EC]"
                    >
                      Ask another question
                    </button>
                  </div>
                )}
              </div>

              {/* Switch back to database */}
              <div className="mt-5 rounded-2xl border border-[#E9E1D4] bg-white/80 p-5">
                <div className="flex items-start gap-3">
                  <MessageSquare className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#C09026]" />

                  <div>
                    <h3 className="text-[11px] font-bold text-[#51483B]">
                      Need your business data instead?
                    </h3>

                    <p className="mt-1 text-[10px] leading-5 text-[#948979]">
                      Your database assistant remains separate. Switch back to
                      Ask EstateAI whenever you need sales or telecaller
                      analytics.
                    </p>

                    <button
                      type="button"
                      onClick={() => openTab("database")}
                      className="mt-3 inline-flex items-center gap-2 text-[10px] font-bold text-[#B78317] hover:text-[#91660C]"
                    >
                      <ArrowUp className="h-3 w-3 -rotate-45" />
                      Go to database chat
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Footer */}
          <footer className="mt-12 text-center">
            <p className="text-[9px] text-[#B3AA9D]">
              EstateAI • Your business, understood simply
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}
