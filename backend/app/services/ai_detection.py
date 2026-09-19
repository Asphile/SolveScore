"""AI content-detection provider interface.

The platform treats every result from this module as a *probabilistic indicator*
that requires human review -- never as proof, and never as something that is
allowed to automatically reject/disqualify a school or change a judging score
(see app.routers.ai_analysis and the project spec, section 14/17).

Two providers are implemented:

- StubAIDetectionProvider: a transparent, local heuristic used for development
  and demos when no external AI-detection vendor is configured. It does NOT
  perform real AI-generated-content detection; it exists so the rest of the
  system (statuses, admin review queue, audit trail) can be built and tested
  end-to-end without a paid third-party dependency.
- ExternalAIDetectionProvider: the integration point for a real vendor (e.g. an
  LLM-based classifier reached over HTTP). It is intentionally left
  unimplemented -- wire it up with real credentials before relying on it. It
  raises AIDetectionNotConfiguredError rather than faking a result.

Select the active provider via the AI_PROVIDER / AI_API_KEY environment
variables (see .env.example). Never hard-code API keys.
"""

from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.config import settings


class AIDetectionNotConfiguredError(RuntimeError):
    """Raised when a real AI-detection provider is selected but not configured."""


@dataclass
class AIDetectionResult:
    confidence: float  # 0-100 estimated likelihood indicator, NOT a certainty
    risk_level: str  # LOW | MEDIUM | HIGH
    summary: str
    detected_sections: str = ""
    provider: str = "stub"


class AIDetectionProvider(ABC):
    @abstractmethod
    def analyze_text(self, text: str) -> AIDetectionResult:
        raise NotImplementedError


class StubAIDetectionProvider(AIDetectionProvider):
    """Deterministic, local, clearly-labeled placeholder heuristic.

    This is NOT a real AI-generated-content detector. It derives a stable
    pseudo-score from simple, documented text statistics purely so the review
    workflow (statuses, admin queue, thresholds) is exercisable in dev/demo
    environments without external services.
    """

    name = "stub"

    def analyze_text(self, text: str) -> AIDetectionResult:
        cleaned = (text or "").strip()
        if not cleaned:
            return AIDetectionResult(
                confidence=0.0,
                risk_level="LOW",
                summary="No text content was available to analyze.",
                provider=self.name,
            )

        words = cleaned.split()
        avg_word_len = sum(len(w) for w in words) / max(len(words), 1)
        sentence_count = max(cleaned.count(".") + cleaned.count("!") + cleaned.count("?"), 1)
        avg_sentence_len = len(words) / sentence_count

        # Deterministic pseudo-random jitter derived from content hash, so repeated
        # analysis of identical text is stable (useful for tests/demos).
        digest = hashlib.sha256(cleaned.encode("utf-8")).hexdigest()
        jitter = (int(digest[:8], 16) % 20) - 10  # -10..+9

        score = 30 + (avg_sentence_len * 1.5) + (avg_word_len * 2) + jitter
        confidence = max(0.0, min(100.0, score))

        if confidence >= 70:
            risk = "HIGH"
        elif confidence >= 40:
            risk = "MEDIUM"
        else:
            risk = "LOW"

        summary = (
            f"Heuristic indicator only (stub provider, no external AI call). "
            f"Estimated likelihood of AI-generated/assisted content: {confidence:.0f}%. "
            f"Based on {len(words)} words across {sentence_count} sentence(s). "
            f"Requires administrator review before any decision is made."
        )

        return AIDetectionResult(
            confidence=round(confidence, 1),
            risk_level=risk,
            summary=summary,
            provider=self.name,
        )


class ExternalAIDetectionProvider(AIDetectionProvider):
    """Integration point for a real AI-content-detection vendor.

    Wire this up to call the configured vendor's API using settings.ai_api_key.
    Intentionally unimplemented so the system never silently pretends to run
    real detection when it has not been connected.
    """

    name = "external"

    def analyze_text(self, text: str) -> AIDetectionResult:
        if not settings.ai_api_key:
            raise AIDetectionNotConfiguredError(
                "AI_PROVIDER is set to an external provider but AI_API_KEY is not configured. "
                "Set AI_PROVIDER=stub for development, or supply AI_API_KEY for real detection."
            )
        # TODO: implement the real HTTP call to the configured vendor here.
        raise AIDetectionNotConfiguredError(
            f"AI provider '{settings.ai_provider}' is not yet implemented. "
            "Implement ExternalAIDetectionProvider.analyze_text to enable real detection."
        )


def get_provider() -> AIDetectionProvider:
    if settings.ai_provider.lower() == "stub":
        return StubAIDetectionProvider()
    return ExternalAIDetectionProvider()
