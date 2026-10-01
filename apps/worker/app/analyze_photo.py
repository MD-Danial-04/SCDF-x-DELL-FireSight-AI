import base64
import json
import logging
import re

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

from app.config import settings
from app.schemas import (
    AnalyzePhotoContext,
    AnalyzePhotoResponse,
)

SYSTEM_PROMPT = """
You analyze fire-scene investigation photographs for a Singapore Civil Defence Force (SCDF) fire report.
Return ONLY valid JSON with this shape:
{
  "caption": "Photo showing ... (1-2 short sentences as described below)"
}

CAPTION RULES (critical):
- The caption MUST begin with the words "Photo showing ".
- Write 1-2 short sentences only. The first sentence names the object or area shown; the second (optional) briefly describes the visible burn pattern or fire effects (charring, soot, melt damage, char depth, smoke staining, heat marks).
- Keep it brief and factual. Do NOT describe overall scene context or explain the investigative significance of the photo.
- Describe ONLY observable visual facts in THIS photograph. Do NOT copy or paraphrase stop message text, incident summaries, location narratives, field notes, or prior photo descriptions into the caption.
- Do NOT include identifier metadata (image number, file name, date, time, photographer name) in the caption.
- Each photo caption must be distinct and specific to what is visible in this frame.

GOOD caption example:
"Photo showing a wall-mounted electrical outlet with a distinct 'V' burn pattern on the drywall above it. The clean burn and deep charring at the apex indicate intense localized heat at this point."

BAD caption example (do not output text like this):
"Investigation of a moderate fire incident at 7 Gull Avenue. The fire is believed to have originated in the rubbish chute..."
""".strip()

PRIOR_PHOTOS_HEADER = "Photos already logged (describe what is different in THIS image):"
LEGACY_PRIOR_PHOTOS_HEADER = "Prior photo log captions"


def _extract_json_text(content: str) -> str:
    text = content.strip()

    fence_match = re.search(
        r"```(?:json)?\s*(.*?)\s*```",
        text,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if fence_match:
        return fence_match.group(1).strip()

    start = text.find("{")
    if start == -1:
        return text

    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        char = text[i]
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]

    return text[start:]


_CAPTION_KEYS = (
    "caption",
    "description",
    "photo_caption",
    "photo_description",
    "text",
    "summary",
    "content",
    "response",
)


def _caption_from_value(value: object) -> str | None:
    if isinstance(value, str):
        caption = value.strip()
        return caption or None
    if isinstance(value, dict):
        return _extract_caption(value)
    return None


def _extract_caption(parsed: dict) -> str | None:
    for key in _CAPTION_KEYS:
        if key in parsed:
            caption = _caption_from_value(parsed[key])
            if caption:
                return caption

    lowered = {str(key).lower(): value for key, value in parsed.items()}
    for key in _CAPTION_KEYS:
        if key in lowered:
            caption = _caption_from_value(lowered[key])
            if caption:
                return caption

    for value in parsed.values():
        if isinstance(value, dict):
            caption = _extract_caption(value)
            if caption:
                return caption

    return None


def _coerce_photo_analysis(parsed: object) -> dict | None:
    if isinstance(parsed, list):
        for item in parsed:
            coerced = _coerce_photo_analysis(item)
            if coerced is not None:
                return coerced
        return None

    if isinstance(parsed, str):
        text = parsed.strip()
        if not text:
            return None
        try:
            nested = json.loads(text)
        except json.JSONDecodeError:
            return {"caption": text}
        return _coerce_photo_analysis(nested)

    if not isinstance(parsed, dict):
        return None

    caption = _extract_caption(parsed)
    if caption:
        return {"caption": caption}
    return None


def _parse_photo_analysis_json(content: str) -> dict:
    candidates: list[str] = []
    stripped = content.strip()
    if stripped:
        candidates.append(stripped)
    extracted = _extract_json_text(content)
    if extracted and extracted not in candidates:
        candidates.append(extracted)

    last_error: json.JSONDecodeError | ValueError | None = None
    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError as exc:
            last_error = exc
            continue
        coerced = _coerce_photo_analysis(parsed)
        if coerced is None:
            last_error = ValueError("missing caption key")
            continue
        return coerced

    if last_error is not None:
        raise last_error
    raise ValueError("missing caption key")


def _split_field_notes_excerpt(
    excerpt: str | None,
) -> tuple[str | None, str | None]:
    if not excerpt or not excerpt.strip():
        return None, None

    text = excerpt.strip()
    for header in (PRIOR_PHOTOS_HEADER, LEGACY_PRIOR_PHOTOS_HEADER):
        idx = text.find(header)
        if idx != -1:
            investigator_notes = text[:idx].strip() or None
            prior_block = text[idx:].strip()
            return investigator_notes, prior_block

    return text, None


def _truncate_background(text: str, max_length: int = 120) -> str:
    trimmed = text.strip()
    if len(trimmed) <= max_length:
        return trimmed
    return f"{trimmed[:max_length]}…"


def _build_user_prompt(context: AnalyzePhotoContext | None) -> str:
    lines = [
        "Describe ONLY what is visible in this photograph.",
        'Write the caption as 1-2 short sentences beginning with "Photo showing ", naming the object or area then briefly describing the visible burn pattern or fire damage.',
        "Focus on observable fire effects: charring, soot deposition, smoke staining, melt damage, burn patterns, calcination, char depth, heat marks, and physical evidence visible in the frame.",
        "Keep it brief: do not describe overall scene context or the investigative significance of the photo.",
        "Do not restate stop message, incident summary, or prior photo descriptions in the caption, and do not include identifier metadata (image number, file name, date, time, photographer).",
    ]

    if not context:
        return "\n".join(lines)

    context_hints: list[str] = []
    if context.location_of_fire:
        context_hints.append(f"- Location: {context.location_of_fire}")
    if context.incident_type_name:
        context_hints.append(f"- Incident: {context.incident_type_name}")

    if context_hints:
        lines.append("")
        lines.append(
            "CONTEXT (background only — do not repeat in caption):",
        )
        lines.extend(context_hints)

    investigator_notes, prior_photos = _split_field_notes_excerpt(context.field_notes_excerpt)

    if investigator_notes:
        lines.append("")
        lines.append("INVESTIGATOR NOTES (background only — do not repeat in caption):")
        lines.append(investigator_notes)

    if prior_photos:
        lines.append("")
        lines.append(prior_photos)

    if context.stop_message_excerpt:
        lines.append("")
        lines.append("BACKGROUND (do not copy into caption):")
        lines.append(_truncate_background(context.stop_message_excerpt))

    return "\n".join(lines)


def fake_analyze_photo(_context: AnalyzePhotoContext | None = None) -> AnalyzePhotoResponse:
    return AnalyzePhotoResponse(
        caption=(
            "Photo showing the ceiling lining above the seating area with charring and "
            "heavy smoke staining. The upward heat damage and char depth indicate intense "
            "fire effects at ceiling level."
        ),
        source="fake",
    )


def _ollama_base_url() -> str:
    return settings.llm_base_url.rstrip("/").removesuffix("/v1")


async def llm_analyze_photo(
    image_bytes: bytes,
    context: AnalyzePhotoContext | None = None,
) -> AnalyzePhotoResponse:
    image_b64 = base64.standard_b64encode(image_bytes).decode("ascii")
    user_prompt = _build_user_prompt(context)

    payload = {
        "model": settings.vision_model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt, "images": [image_b64]},
        ],
        "format": "json",
        "stream": False,
        "options": {"temperature": 0},
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{_ollama_base_url()}/api/chat",
                json=payload,
            )
            response.raise_for_status()
            content = response.json()["message"]["content"]
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Vision model unavailable: HTTP {exc.response.status_code}",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Vision model unavailable: {exc}",
        ) from exc
    except (KeyError, TypeError) as exc:
        raise HTTPException(
            status_code=502,
            detail="Vision model returned an unexpected response",
        ) from exc

    try:
        parsed = _parse_photo_analysis_json(content)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning(
            "Vision model returned unparseable photo analysis: %s; content=%r",
            exc,
            content[:500],
        )
        raise HTTPException(
            status_code=502,
            detail="Vision model returned invalid JSON",
        ) from exc

    caption = str(parsed.get("caption", "")).strip()
    if not caption:
        raise HTTPException(status_code=502, detail="Vision model returned empty caption")

    return AnalyzePhotoResponse(
        caption=caption,
        source="ollama",
    )


async def analyze_photo(
    image_bytes: bytes,
    context: AnalyzePhotoContext | None = None,
) -> AnalyzePhotoResponse:
    if settings.use_fake_photo_analysis:
        return fake_analyze_photo(context)
    return await llm_analyze_photo(image_bytes, context)


async def analyze_photo_for_worker(
    image_bytes: bytes,
    context: AnalyzePhotoContext | None = None,
) -> AnalyzePhotoResponse:
    try:
        return await analyze_photo(image_bytes, context)
    except HTTPException as exc:
        raise RuntimeError(exc.detail) from exc
