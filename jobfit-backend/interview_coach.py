import json
import math
import os
from typing import Literal

from fastapi import APIRouter, HTTPException
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

router = APIRouter(prefix="/interview-coach", tags=["interview-coach"])

DEFAULT_MODEL = "gemini-2.5-flash"
MAX_HISTORY = 8


class InterviewHistoryTurn(BaseModel):
    question: str = Field(min_length=1, max_length=900)
    answer: str = Field(min_length=1, max_length=6000)
    score: int | None = Field(default=None, ge=0, le=100)


class InterviewCoachTurnRequest(BaseModel):
    role: str = Field(min_length=1, max_length=240)
    company: str = Field(default="", max_length=240)
    job_description: str = Field(default="", max_length=12000)
    interview_type: Literal["hr", "behavioural", "technical"] = "behavioural"
    question: str = Field(min_length=1, max_length=900)
    answer: str = Field(min_length=1, max_length=6000)
    candidate_evidence: list[str] = Field(default_factory=list, max_length=30)
    history: list[InterviewHistoryTurn] = Field(default_factory=list, max_length=MAX_HISTORY)


class CoachDimension(BaseModel):
    key: str = Field(min_length=1, max_length=60)
    label: str = Field(min_length=1, max_length=100)
    score: int = Field(ge=0, le=20)
    rationale: str = Field(min_length=1, max_length=700)


class EvidenceFinding(BaseModel):
    status: Literal["confirmed", "partial", "unsupported", "unknown"]
    claim: str = Field(min_length=1, max_length=600)
    evidence: str = Field(default="", max_length=900)


class ModelCoachOutput(BaseModel):
    dimensions: list[CoachDimension] = Field(min_length=5, max_length=5)
    strengths: list[str] = Field(min_length=1, max_length=4)
    improvements: list[str] = Field(min_length=1, max_length=4)
    evidence_findings: list[EvidenceFinding] = Field(default_factory=list, max_length=8)
    credibility_flags: list[str] = Field(default_factory=list, max_length=5)
    follow_up: str = Field(min_length=1, max_length=700)
    next_question: str = Field(min_length=1, max_length=700)
    coaching_message: str = Field(min_length=1, max_length=900)
    revised_answer: str = Field(min_length=1, max_length=6000)


SYSTEM_INSTRUCTION = """
You are CogniTwist Interview Coach, an adaptive coach for MOCK INTERVIEW PRACTICE.

Your job is to assess the candidate's current answer against the exact question, target role,
job description and prior practice turns, then choose the most useful follow-up and next question.

NON-NEGOTIABLE EVIDENCE RULES:
- Never invent experience, metrics, employers, technologies, dates, responsibilities or outcomes.
- A revised answer may only reuse facts explicitly present in the current answer, candidate_evidence,
  or earlier candidate answers supplied in history.
- If an important fact is missing, use a visible placeholder such as [add a verified metric] or
  [state your verified responsibility]. Do not fill the placeholder yourself.
- Do not turn "unknown" into a gap unless the question or vacancy explicitly requires the evidence.
- Do not claim the candidate has a capability merely because the job description mentions it.

COACHING BEHAVIOUR:
- Evaluate whether the candidate actually answered the interviewer's intent, not just keyword overlap.
- Prefer one precise adaptive follow-up over generic advice.
- Do not repeat a question already covered in history unless the previous answer left a material gap.
- The next_question should test an important competency not yet demonstrated, using the job description
  when one is available.
- Keep feedback direct, constructive and suitable for a senior professional.
- This is practice coaching, not covert assistance during a live employer interview.

SCORING:
Return exactly five dimensions, each scored 0-20. Choose labels appropriate to interview_type.
For behavioural interviews cover relevance, STAR/structure, personal ownership, evidence/outcomes,
and judgement/stakeholder leadership. For technical interviews cover relevance, technical depth,
design/trade-offs, controls/operational readiness, and evidence/outcomes. For HR interviews cover
relevance, motivation/fit, credibility, communication, and readiness/expectations.
""".strip()


def _clean_list(values: list[str], item_limit: int = 1200, limit: int = 30) -> list[str]:
    result: list[str] = []
    for value in values[:limit]:
        cleaned = " ".join(str(value or "").split()).strip()[:item_limit]
        if cleaned:
            result.append(cleaned)
    return result


def _payload(request: InterviewCoachTurnRequest) -> dict:
    history = [
        {
            "question": turn.question.strip()[:900],
            "answer": turn.answer.strip()[:6000],
            "score": turn.score,
        }
        for turn in request.history[-MAX_HISTORY:]
    ]
    return {
        "role": request.role.strip()[:240],
        "company": request.company.strip()[:240],
        "job_description": request.job_description.strip()[:12000],
        "interview_type": request.interview_type,
        "current_question": request.question.strip()[:900],
        "current_answer": request.answer.strip()[:6000],
        "candidate_evidence": _clean_list(request.candidate_evidence),
        "history": history,
    }


def _label(total: int) -> str:
    if total >= 90:
        return "Outstanding"
    if total >= 80:
        return "Strong"
    if total >= 70:
        return "Good"
    if total >= 60:
        return "Developing"
    return "Needs stronger evidence"


@router.get("/health")
async def interview_coach_health() -> dict:
    configured = bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))
    return {
        "status": "ready" if configured else "provider_not_configured",
        "provider": "google-genai",
        "model": os.getenv("INTERVIEW_COACH_MODEL", DEFAULT_MODEL),
        "adaptive": True,
        "structured_output": True,
        "version": "agent-v1",
    }


@router.post("/turn")
async def interview_coach_turn(request: InterviewCoachTurnRequest) -> dict:
    if not (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")):
        raise HTTPException(status_code=503, detail="Interview coach AI provider is not configured.")

    prompt = (
        "Assess this mock-interview turn. Return only the structured response requested by the schema.\n\n"
        + json.dumps(_payload(request), ensure_ascii=False)
    )

    try:
        client = genai.Client()
        model = os.getenv("INTERVIEW_COACH_MODEL", DEFAULT_MODEL)
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                response_mime_type="application/json",
                response_schema=ModelCoachOutput,
                temperature=0.25,
                max_output_tokens=3500,
            ),
        )
        parsed = ModelCoachOutput.model_validate_json(response.text or "{}")
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Adaptive interview coaching is temporarily unavailable.") from exc

    dimensions = [item.model_dump() for item in parsed.dimensions]
    total = max(0, min(100, sum(item["score"] for item in dimensions)))
    rating = max(1, min(5, math.ceil(total / 20)))

    return {
        "mode": "ai",
        "agent": {
            "provider": "google-genai",
            "model": os.getenv("INTERVIEW_COACH_MODEL", DEFAULT_MODEL),
            "version": "agent-v1",
            "adaptive": True,
            "evidence_guard": True,
        },
        "assessment": {
            "question": request.question.strip()[:900],
            "answer": request.answer.strip()[:6000],
            "total": total,
            "rating": rating,
            "label": _label(total),
            "dimensions": dimensions,
            "strengths": _clean_list(parsed.strengths, 800, 4),
            "improvements": _clean_list(parsed.improvements, 800, 4),
            "evidence_findings": [item.model_dump() for item in parsed.evidence_findings],
            "credibility_flags": _clean_list(parsed.credibility_flags, 800, 5),
            "follow_up": parsed.follow_up.strip()[:700],
            "next_question": parsed.next_question.strip()[:700],
            "coaching_message": parsed.coaching_message.strip()[:900],
            "revised_answer": parsed.revised_answer.strip()[:6000],
        },
    }
