import io
import json
import math
import os
from typing import Any, Optional

from docx import Document
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
import httpx
from PyPDF2 import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
from supabase import Client, create_client

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    supabase_url = supabase_url or "https://supabase.co"
    supabase_key = supabase_key or "placeholder-key"

supabase: Client = create_client(supabase_url, supabase_key)
gemini_client = genai.Client()

SEARCH_MODEL = "gemini-2.5-flash"
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "https://ollama.com").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "glm-4.7")
OLLAMA_API_KEY = os.getenv("OLLAMA_API_KEY", "")


def strip_code_fences(text: str) -> str:
    cleaned = (text or "").strip()
    if "```json" in cleaned:
        cleaned = cleaned.split("```json")[-1].split("```")[0].strip()
    elif "```" in cleaned:
        cleaned = cleaned.split("```")[-1].split("```")[0].strip()
    return cleaned


def safe_json_loads(text: str) -> dict:
    try:
        return json.loads(strip_code_fences(text))
    except Exception:
        return {}


def is_quota_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return (
        "429" in message
        or "resource_exhausted" in message
        or "quota" in message
        or "rate limit" in message
    )


def is_ollama_configured() -> bool:
    return bool(OLLAMA_BASE_URL and OLLAMA_API_KEY and OLLAMA_MODEL)


def get_ollama_chat_url() -> str:
    if OLLAMA_BASE_URL.endswith("/api/chat"):
        return OLLAMA_BASE_URL
    if OLLAMA_BASE_URL.endswith("/api/generate"):
        return OLLAMA_BASE_URL.rsplit("/api/generate", 1)[0] + "/api/chat"
    return f"{OLLAMA_BASE_URL}/api/chat"


def extract_text_from_pdf(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    return "\n".join((page.extract_text() or "") for page in reader.pages).strip()


def extract_text_from_docx(file_bytes: bytes) -> str:
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip()).strip()


async def extract_resume_text(resume_file: UploadFile) -> str:
    filename = (resume_file.filename or "").lower()
    content = await resume_file.read()

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded resume file is empty.")

    if filename.endswith(".pdf"):
        return extract_text_from_pdf(content)

    if filename.endswith(".docx"):
        return extract_text_from_docx(content)

    raise HTTPException(status_code=400, detail="Unsupported file format. Upload PDF or DOCX.")


def build_candidate_context(
    target_role: str,
    location_city: str,
    resume_skills: str,
    extracted_resume_text: str,
) -> str:
    return "\n".join(
        part
        for part in [
            f"Target Role: {target_role}",
            f"Preferred Location: {location_city}",
            f"Resume Skills Summary: {resume_skills}",
            f"Extracted Resume Text: {extracted_resume_text}",
        ]
        if part.strip()
    )


def normalize_job(job: dict, fallback_location: str) -> Optional[dict]:
    if not isinstance(job, dict):
        return None

    title = str(job.get("title", "")).strip()
    company = str(job.get("company", "")).strip()
    location = str(job.get("location", fallback_location)).strip() or fallback_location
    salary = str(job.get("salary", "Not Disclosed")).strip() or "Not Disclosed"

    skills_raw = job.get("skills", [])
    if isinstance(skills_raw, list):
        skills = [str(s).strip() for s in skills_raw if str(s).strip()]
    elif skills_raw:
        skills = [str(skills_raw).strip()]
    else:
        skills = []

    link = str(job.get("link", "")).strip()
    if not link.startswith("http"):
        link = "search on company website"

    posted_date = str(job.get("posted_date", "")).strip()
    source = str(job.get("source", "")).strip()
    description = str(job.get("description", "")).strip()

    if not title or not company:
        return None

    return {
        "title": title,
        "company": company,
        "location": location,
        "salary": salary,
        "skills": skills,
        "link": link,
        "posted_date": posted_date,
        "source": source,
        "description": description,
    }


def dedupe_jobs(jobs: list[dict]) -> list[dict]:
    seen = set()
    unique = []

    for job in jobs:
        title = job.get("title", "").strip().lower()
        company = job.get("company", "").strip().lower()
        location = job.get("location", "").strip().lower()
        link = job.get("link", "").strip().lower()

        key = (title, company, location, link)
        alt_key = (title, company, location)

        if key in seen or alt_key in seen:
            continue

        seen.add(key)
        seen.add(alt_key)
        unique.append(job)

    return unique


def location_matches(job_location: str, preferred_location: str) -> bool:
    jl = (job_location or "").lower()
    pl = (preferred_location or "").lower()
    return "remote" in jl or pl in jl or jl in pl


def filter_jobs(jobs: list[dict], location_city: str) -> list[dict]:
    filtered = []
    for job in jobs:
        if not location_matches(job.get("location", ""), location_city):
            continue
        filtered.append(job)
    return filtered


async def generate_builder_response_with_ollama(system_prompt: str, user_prompt: str) -> dict:
    if not is_ollama_configured():
        raise HTTPException(
            status_code=500,
            detail="Ollama is not configured. Please set OLLAMA_BASE_URL, OLLAMA_API_KEY, and OLLAMA_MODEL.",
        )

    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
        "format": "json",
    }
    headers = {
        "Authorization": f"Bearer {OLLAMA_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(get_ollama_chat_url(), headers=headers, json=payload)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Ollama connection error: {str(exc)}") from exc

    if response.status_code == 401:
        raise HTTPException(status_code=500, detail="Ollama authentication failed. Check OLLAMA_API_KEY.")
    if response.status_code == 429:
        raise HTTPException(status_code=429, detail="Ollama cloud quota is exhausted right now. Please try again later.")
    if response.status_code >= 400:
        raise HTTPException(status_code=500, detail=f"Ollama request failed: {response.text}")

    raw = response.json()
    parsed = safe_json_loads(raw.get("message", {}).get("content", ""))
    if not parsed:
        raise HTTPException(status_code=500, detail="Ollama returned invalid JSON for build-resume.")
    return parsed


@app.get("/health/")
@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/build-resume/")
@app.post("/build-resume")
async def build_and_compare_resume(
    full_name: str = Form(...),
    target_role: str = Form(...),
    career_history: str = Form(...),
    job_description: str = Form(...),
    linkedin_profile: Optional[str] = Form(None),
    interview_duration: Any = Form("30 minutes"),
    total_questions_requested: Any = Form(5),
    interview_type: Optional[str] = Form("technical"),
):
    if "placeholder" in supabase_url or "placeholder" in supabase_key:
        raise HTTPException(
            status_code=500,
            detail="Configuration Error: Missing SUPABASE_URL variables on Render.",
        )

    try:
        requested_count = int(total_questions_requested)
        requested_count = max(5, min(25, requested_count))
    except (ValueError, TypeError):
        requested_count = 5

    current_type = str(interview_type).lower() if interview_type else "technical"

    if current_type == "technical":
        tech_count = math.ceil(requested_count / 2)
        hr_count = math.floor(requested_count / 2)
        distribution_prompt = (
            f"Generate exactly {requested_count} question/response objects total: "
            f"the first {tech_count} must be deep technical coding or system design questions, and "
            f"the remaining {hr_count} must be HR/company culture questions relevant to this engineering target."
        )
    else:
        distribution_prompt = (
            f"Generate exactly {requested_count} question/response objects total focusing "
            f"100% on HR, behavioral, corporate values, cultural fit, and situational team scenarios."
        )

    system_prompt = f"""You are an expert tech recruiter and ATS evaluator.
Analyze the candidate against the job description.
Return one valid JSON object only.

REQUIRED JSON:
{{
  "match_score": 75,
  "missing_skills": ["list", "of", "skills"],
  "tailoring_tips": ["bullet", "points"],
  "tell_me_about_yourself": "STAR structured elevator pitch",
  "interview_questions": [ {{
     "question": "string text",
     "response": "- Situation: ...\\n- Task: ...\\n- Action: ...\\n- Result: ..."
  }} ],
  "follow_up_questions": ["question 1", "question 2"],
  "resume": {{
    "full_name": "string",
    "professional_summary": "string",
    "skills": ["skill1", "skill2"],
    "experience": [ {{"company": "str", "role": "str", "duration": "str", "bullet_points": ["bullet"]}} ]
  }}
}}

CRITICAL:
- interview_questions: {distribution_prompt}
- Every response must use STAR format exactly.
- Generate 3 to 5 follow_up_questions.
"""

    linkedin_context = f"\nCandidate LinkedIn URL: {linkedin_profile}" if linkedin_profile else ""

    user_prompt = (
        f"Candidate Name: {full_name}\nTarget: {target_role}{linkedin_context}\n"
        f"History: {career_history}\nJD:\n{job_description}"
    )

    try:
        analysis_result = await generate_builder_response_with_ollama(system_prompt, user_prompt)
        if not analysis_result:
            raise ValueError("Model returned invalid JSON.")
    except HTTPException:
        raise
    except Exception as ai_err:
        if is_quota_error(ai_err):
            raise HTTPException(
                status_code=429,
                detail="Ollama cloud quota is currently exhausted for resume generation. Please wait a few minutes and try again.",
            )
        raise HTTPException(status_code=500, detail=f"AI Data Map Extraction Crash Error: {str(ai_err)}")

    resume_data = analysis_result.get("resume", {})
    if not isinstance(resume_data, dict):
        resume_data = {}

    public_url = "Cloud Storage Connection Mismatch"

    try:
        pdf_filename = f"{full_name.replace(' ', '_')}_Resume.pdf"
        doc = SimpleDocTemplate(
            pdf_filename,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle("TStyle", parent=styles["Heading1"], fontSize=22, leading=26, spaceAfter=10)
        section_style = ParagraphStyle(
            "SStyle",
            parent=styles["Heading2"],
            fontSize=13,
            leading=17,
            spaceBefore=10,
            spaceAfter=4,
            textColor=colors.HexColor("#8B5A2B"),
        )
        body_style = styles["Normal"]

        story = [
            Paragraph(f"<b>{resume_data.get('full_name', full_name)}</b>", title_style),
            Paragraph(f"Target Objective: {target_role}", styles["Heading3"]),
            Spacer(1, 8),
            Paragraph("<b>Professional Summary</b>", section_style),
            Paragraph(str(resume_data.get("professional_summary", "")), body_style),
            Paragraph("<b>Core Competencies</b>", section_style),
        ]

        skills_list = resume_data.get("skills", [])
        skills_str = ", ".join(skills_list) if isinstance(skills_list, list) else str(skills_list)
        story.append(Paragraph(skills_str, body_style))
        story.append(Paragraph("<b>Professional Experience</b>", section_style))

        exp_list = resume_data.get("experience", [])
        if isinstance(exp_list, list):
            for exp in exp_list:
                if isinstance(exp, dict):
                    story.append(
                        Paragraph(
                            f"<b>{str(exp.get('role', 'Engineer'))}</b> — "
                            f"{str(exp.get('company', 'Company'))} ({str(exp.get('duration', 'Present'))})",
                            styles["Heading4"],
                        )
                    )
                    bullets = exp.get("bullet_points", [])
                    if isinstance(bullets, list):
                        for bullet in bullets:
                            story.append(Paragraph(f"• {str(bullet)}", body_style))
                story.append(Spacer(1, 4))

        doc.build(story)

        with open(pdf_filename, "rb") as f:
            file_data = f.read()

        storage_path = f"resumes/{pdf_filename}"

        try:
            supabase.storage.from_("updated-resumes").upload(
                path=storage_path,
                file=file_data,
                file_options={"content-type": "application/pdf"},
            )
            public_url = supabase.storage.from_("updated-resumes").get_public_url(storage_path)
        except Exception:
            pass

        if os.path.exists(pdf_filename):
            os.remove(pdf_filename)

    except Exception:
        pass

    raw_questions = analysis_result.get("interview_questions", analysis_result.get("questions", []))
    if not isinstance(raw_questions, list):
        raw_questions = []

    final_questions = []
    for item in raw_questions:
        if isinstance(item, dict):
            final_questions.append(
                {
                    "question": str(item.get("question", "")),
                    "response": str(item.get("response", "")),
                }
            )

    return {
        "match_score": int(analysis_result.get("match_score", 70)),
        "missing_skills": list(analysis_result.get("missing_skills", [])),
        "tailoring_tips": list(analysis_result.get("tailoring_tips", [])),
        "tell_me_about_yourself": str(analysis_result.get("tell_me_about_yourself", "")),
        "interview_questions": final_questions[:requested_count],
        "follow_up_questions": list(analysis_result.get("follow_up_questions", [])),
        "resume": resume_data,
        "shareable_url": public_url,
    }


def grounded_search_pass(query: str, candidate_context: str) -> list[dict]:
    system_prompt = """You are a job listing discovery tool.
Use web search to find real current job openings.
Return valid raw JSON only with this shape:

{
  "jobs": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, State or Remote",
      "salary": "$Range or Not Disclosed",
      "skills": ["skill1", "skill2"],
      "link": "real apply url or 'search on company website'",
      "posted_date": "date string if visible",
      "source": "linkedin|indeed|greenhouse|lever|workday|company",
      "description": "short snippet"
    }
  ]
}

Rules:
- Return only real job openings you can infer from search results.
- Prefer active jobs posted in the last 10 days.
- Never invent links.
- If a reliable application link is not visible, use exactly "search on company website".
- Do not return markdown fences or commentary.
"""

    response = gemini_client.models.generate_content(
        model=SEARCH_MODEL,
        contents=f"Search Query: {query}\nCandidate Context:\n{candidate_context}",
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            tools=[types.Tool(google_search=types.GoogleSearch())],
            temperature=0.2,
        ),
    )

    parsed = safe_json_loads(response.text or "")
    jobs = parsed.get("jobs", [])
    if not isinstance(jobs, list):
        return []
    return jobs


def rank_jobs_with_gemini(candidate_context: str, jobs: list[dict]) -> dict:
    ranking_prompt = """You are an expert recruiting analyst.
Given a candidate profile and a list of jobs, choose the best matches.

Return valid JSON only:
{
  "jobs": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, State or Remote",
      "salary": "$Range or Not Disclosed",
      "skills": ["skill1", "skill2"],
      "link": "real link or 'search on company website'"
    }
  ],
  "best_match_summary": "One-line summary of the 3 best jobs and why."
}

Rules:
- Keep only genuinely relevant jobs.
- Prefer jobs that best match role, seniority, domain, and skills.
- Keep up to 40 jobs.
- Preserve real links if present.
- Never invent fields.
"""

    response = gemini_client.models.generate_content(
        model=SEARCH_MODEL,
        contents=f"Candidate Context:\n{candidate_context}\n\nJobs:\n{json.dumps(jobs[:60], ensure_ascii=False)}",
        config=types.GenerateContentConfig(
            system_instruction=ranking_prompt,
            response_mime_type="application/json",
            temperature=0.1,
        ),
    )

    ranked = safe_json_loads(response.text or "")
    if not ranked:
        return {
            "jobs": jobs[:40],
            "best_match_summary": "Top matches were selected based on closest role and skill overlap.",
        }
    return ranked


@app.post("/search-jobs/")
@app.post("/search-jobs")
async def search_jobs(
    target_role: str = Form(...),
    location_city: str = Form(...),
    resume_skills: str = Form(""),
    resume_file: Optional[UploadFile] = File(None),
):
    extracted_resume_text = ""

    if resume_file is not None:
        extracted_resume_text = await extract_resume_text(resume_file)

    candidate_context = build_candidate_context(
        target_role=target_role,
        location_city=location_city,
        resume_skills=resume_skills,
        extracted_resume_text=extracted_resume_text,
    )

    search_queries = [
        f'"{target_role}" jobs in "{location_city}" site:linkedin.com/jobs OR site:indeed.com',
        f'"{target_role}" jobs in "{location_city}" site:greenhouse.io OR site:lever.co OR site:workdayjobs.com',
        f'"{target_role}" remote jobs site:linkedin.com/jobs OR site:indeed.com',
        f'"{target_role}" remote jobs site:greenhouse.io OR site:lever.co OR site:workdayjobs.com',
    ]

    collected_jobs = []

    try:
        for query in search_queries:
            raw_jobs = grounded_search_pass(query, candidate_context)
            for raw_job in raw_jobs:
                normalized = normalize_job(raw_job, location_city)
                if normalized:
                    collected_jobs.append(normalized)

        collected_jobs = dedupe_jobs(collected_jobs)
        filtered_jobs = filter_jobs(collected_jobs, location_city)

        if not filtered_jobs:
            return {
                "jobs": [],
                "best_match_summary": "No verified matching jobs were found from the current search sources.",
            }

        final_ranked = rank_jobs_with_gemini(candidate_context, filtered_jobs[:60])
        final_jobs = final_ranked.get("jobs", [])
        best_match_summary = str(
            final_ranked.get(
                "best_match_summary",
                "Top matches were selected based on closest role, domain, and skill alignment.",
            )
        )

        sanitized_final_jobs = []
        if isinstance(final_jobs, list):
            for job in final_jobs:
                normalized = normalize_job(job, location_city)
                if normalized:
                    sanitized_final_jobs.append(normalized)

        sanitized_final_jobs = dedupe_jobs(sanitized_final_jobs)[:40]

        if not sanitized_final_jobs:
            sanitized_final_jobs = filtered_jobs[:40]

        return {
            "jobs": sanitized_final_jobs,
            "best_match_summary": best_match_summary,
        }

    except Exception as search_error:
        if is_quota_error(search_error):
            raise HTTPException(
                status_code=429,
                detail="Gemini free-tier quota is exhausted for job search right now. Please wait a few minutes and try again, or reduce repeated searches.",
            )
        raise HTTPException(status_code=500, detail=f"Web Grounding Compilation Exception: {str(search_error)}")
