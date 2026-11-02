"""Helpers shared by the PDF and CSV question flows."""
import json
import re

GRAPH_PATTERN = re.compile(
    r"\b(graphs?|charts?|plots?|visualize|visualise"
    r"|visualization|visualisation)\b",
    re.IGNORECASE,
)

VALID_CHART_TYPES = {"bar", "line", "pie"}


def is_graph_requested(question: str) -> bool:
    return bool(GRAPH_PATTERN.search(question))


def strip_code_fences(text: str) -> str:
    return re.sub(
        r"^\s*```(?:json)?\s*|\s*```\s*$",
        "",
        text,
        flags=re.IGNORECASE,
    ).strip()


def text_result(answer: str) -> dict:
    """A reply that has no chart."""
    return {
        "answer": answer,
        "chart_data": None,
        "chart_title": None,
        "chart_type": None,
    }


def _clean_chart_data(chart_data):
    """Return chart rows only if they are usable, else None."""
    if (
        not isinstance(chart_data, list)
        or not chart_data
        or not all(isinstance(row, dict) for row in chart_data)
    ):
        return None

    has_numeric_value = any(
        isinstance(value, (int, float)) and not isinstance(value, bool)
        for row in chart_data
        for value in row.values()
    )

    return chart_data if has_numeric_value else None


def build_graph_result(
    raw_text: str,
    source_label: str,
    parse_failure_message: str,
) -> dict:
    """Parse Gemini's JSON reply and validate the chart it describes.

    source_label is "PDF" or "CSV" and is used in default titles/errors.
    """
    try:
        result = json.loads(strip_code_fences(raw_text))
    except json.JSONDecodeError:
        # Don't crash the whole request if the model breaks the format.
        return text_result(parse_failure_message)

    if not isinstance(result, dict):
        raise ValueError(
            f"Gemini returned an unexpected {source_label} response format."
        )

    answer = result.get("answer")
    if not isinstance(answer, str) or not answer.strip():
        answer = "No answer returned."

    chart_data = _clean_chart_data(result.get("chart_data"))

    if chart_data is None:
        return text_result(answer.strip())

    chart_title = result.get("chart_title")
    if not isinstance(chart_title, str) or not chart_title.strip():
        chart_title = f"Graph from your {source_label}"

    chart_type = result.get("chart_type")
    if chart_type not in VALID_CHART_TYPES:
        chart_type = "bar"

    return {
        "answer": answer.strip(),
        "chart_data": chart_data,
        "chart_title": chart_title,
        "chart_type": chart_type,
    }
