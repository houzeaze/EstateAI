"""Answer questions about an uploaded PDF or CSV (with optional charts)."""
from google.genai import types

from ai import prompts
from ai.chart_utils import build_graph_result, is_graph_requested, text_result
from ai.client import generate


def _require_question(question: str) -> str:
    if not question or not question.strip():
        raise ValueError("Question cannot be empty.")
    return question.strip()


def answer_pdf_question(pdf_bytes: bytes, question: str) -> dict:
    question = _require_question(question)
    pdf_part = types.Part.from_bytes(
        data=pdf_bytes,
        mime_type="application/pdf",
    )

    if not is_graph_requested(question):
        answer = generate([pdf_part, prompts.pdf_text_prompt(question)])

        if not answer:
            raise RuntimeError("Gemini returned an empty PDF answer.")

        return text_result(answer)

    raw_text = generate([pdf_part, prompts.pdf_graph_prompt(question)])

    if not raw_text:
        raise RuntimeError(
            "Gemini returned an empty response for the graph request."
        )

    return build_graph_result(
        raw_text,
        source_label="PDF",
        parse_failure_message=(
            "I could answer the document question, but couldn't "
            "format the graph data correctly. Please try a more "
            "specific request, such as 'Create a bar chart of "
            "monthly sales from this report.'"
        ),
    )


def answer_csv_question(csv_text: str, question: str) -> dict:
    question = _require_question(question)

    if not is_graph_requested(question):
        answer = generate(prompts.csv_text_prompt(question, csv_text))

        if not answer:
            raise RuntimeError("Gemini returned an empty CSV answer.")

        return text_result(answer)

    raw_text = generate(prompts.csv_graph_prompt(question, csv_text))

    if not raw_text:
        raise RuntimeError(
            "Gemini returned an empty response for the CSV graph request."
        )

    return build_graph_result(
        raw_text,
        source_label="CSV",
        parse_failure_message=(
            "I couldn't format the CSV data into a graph. "
            "Please try a more specific graph request."
        ),
    )
