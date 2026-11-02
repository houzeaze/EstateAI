export type AIResponse = {
  answer?: string;
  message?: string;
  data?: Record<string, unknown>[];
  metrics?: {
    records_returned?: number;
    truncated?: boolean;
  };
  intent?: string;
};

export type PDFResponse = {
  answer: string;
  filename: string;
  chart_data: Record<string, unknown>[] | null;
  chart_title: string | null;
  chart_type: "bar" | "line" | "pie" | null;
};

// Ask questions about your business database
export async function askAI(question: string): Promise<AIResponse> {
  const response = await fetch("http://127.0.0.1:8000/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    console.error("AI API ERROR:", response.status, errorText);

    throw new Error(
      `AI request failed (${response.status}): ${errorText}`
    );
  }

  return response.json() as Promise<AIResponse>;
}

// Ask questions about an uploaded PDF document
export async function askPDF(
  file: File,
  question: string
): Promise<PDFResponse> {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("question", question);

  const response = await fetch("http://127.0.0.1:8000/ask-pdf", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();

    console.error("PDF API ERROR:", response.status, errorText);

    let message = `PDF request failed (${response.status})`;

    try {
      const errorData = JSON.parse(errorText);
      message = errorData.detail || message;
    } catch {
      // Keep the fallback message if the response isn't JSON.
    }

    throw new Error(message);
  }

  return response.json() as Promise<PDFResponse>;
}