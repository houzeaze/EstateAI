"""The single Gemini client and a tiny helper around it."""
from google import genai

from config import GEMINI_API_KEY, GEMINI_MODEL

_client = genai.Client(api_key=GEMINI_API_KEY)


def generate(contents, **config) -> str:
    """Send contents to Gemini and return the stripped text reply.

    Extra keyword arguments become the generation config, e.g.
    generate(prompt, response_mime_type="application/json", temperature=0)
    """
    response = _client.models.generate_content(
        model=GEMINI_MODEL,
        contents=contents,
        config=config or None,
    )
    return (response.text or "").strip()
