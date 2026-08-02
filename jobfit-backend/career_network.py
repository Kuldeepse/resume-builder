import os
import re
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from enum import Enum
from typing import Deque, Dict, Optional

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator

from main import supabase, supabase_key, supabase_url

router = APIRouter(prefix="/career-network", tags=["career-network"])

_EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_RATE_LIMIT_WINDOW_SECONDS = 60 * 60
_RATE_LIMIT_MAX_REQUESTS = 5
_request_times: Dict[str, Deque[float]] = defaultdict(deque)


class NetworkRole(str, Enum):
    candidate = "candidate"
    referrer = "referrer"
    mentor = "mentor"


class NetworkRegistration(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=254)
    role: NetworkRole
    linkedin_profile: Optional[str] = Field(default=None, max_length=500)
    current_company: Optional[str] = Field(default=None, max_length=160)
    professional_area: Optional[str] = Field(default=None, max_length=160)
    privacy_notice_version: str = Field(default="2026-08-02", max_length=40)
    terms_accepted: bool
    age_confirmed: bool
    marketing_opt_in: bool = False
    website: Optional[str] = Field(default=None, max_length=200)

    @field_validator("full_name", "current_company", "professional_area", mode="before")
    @classmethod
    def clean_text(cls, value):
        if value is None:
            return None
        return " ".join(str(value).strip().split())

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalised = value.strip().lower()
        if not _EMAIL_PATTERN.match(normalised):
            raise ValueError("Enter a valid email address.")
        return normalised

    @field_validator("linkedin_profile")
    @classmethod
    def validate_linkedin(cls, value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        cleaned = value.strip()
        if not cleaned.startswith(("https://www.linkedin.com/", "https://linkedin.com/")):
            raise ValueError("LinkedIn profile must use a linkedin.com URL.")
        return cleaned


def _check_rate_limit(request: Request) -> None:
    client_key = request.client.host if request.client else "unknown"
    now = time.time()
    bucket = _request_times[client_key]
    while bucket and now - bucket[0] > _RATE_LIMIT_WINDOW_SECONDS:
        bucket.popleft()
    if len(bucket) >= _RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many registration attempts. Please try again later.",
        )
    bucket.append(now)


def _ensure_private_storage_ready() -> None:
    if "placeholder" in supabase_url or "placeholder" in supabase_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Private registration storage is not configured.",
        )


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_for_network(payload: NetworkRegistration, request: Request):
    _check_rate_limit(request)
    _ensure_private_storage_ready()

    # Honeypot: legitimate users never see or complete this field.
    if payload.website:
        return {"status": "received"}

    if not payload.terms_accepted or not payload.age_confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Terms acceptance and age confirmation are required.",
        )

    if payload.role == NetworkRole.referrer and not payload.current_company:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current company is required for referrer registration.",
        )

    now = datetime.now(timezone.utc).isoformat()
    record = {
        "full_name": payload.full_name,
        "email": payload.email,
        "role": payload.role.value,
        "linkedin_profile": payload.linkedin_profile,
        "current_company": payload.current_company,
        "professional_area": payload.professional_area,
        "privacy_notice_version": payload.privacy_notice_version,
        "terms_accepted": payload.terms_accepted,
        "age_confirmed": payload.age_confirmed,
        "marketing_opt_in": payload.marketing_opt_in,
        "status": "pending_verification",
        "updated_at": now,
    }

    try:
        result = (
            supabase.table("career_network_registrations")
            .upsert(record, on_conflict="email,role")
            .execute()
        )
    except Exception as exc:
        # Never return database internals or personal data to the browser.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Registration could not be stored securely. Please try again later.",
        ) from exc

    registration_id = None
    if getattr(result, "data", None) and isinstance(result.data, list):
        registration_id = result.data[0].get("id")

    return {
        "status": "pending_verification",
        "registration_id": registration_id,
        "message": "Registration received. Your details remain private and will not appear in a public directory.",
    }
