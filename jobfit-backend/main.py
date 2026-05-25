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


def generate_resume_analysis(
    *,
    full_name: str,
    target_role: str,
    career_history: str,
    job_description: str,
    linkedin_profile: Optional[str],
    total_questions_requested: Any,
    interview_type: Optional[str],
) -> dict:
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
    "headline": "one-line title aligned to the target role",
    "contact": {{
      "linkedin": "string",
      "location": "string"
    }},
    "professional_summary": "string",
    "skills": ["skill1", "skill2"],
    "experience": [ {{"company": "str", "role": "str", "duration": "str", "bullet_points": ["bullet"]}} ],
    "education": [{{"institution": "str", "qualification": "str", "duration": "str"}}],
    "certifications": ["certification 1", "certification 2"],
    "projects": [{{"name": "str", "description": "str", "impact": "str"}}],
    "achievements": ["achievement 1", "achievement 2"]
  }}
}}

CRITICAL:
- interview_questions: {distribution_prompt}
- Every response must use STAR format exactly.
- Generate 3 to 5 follow_up_questions.
- The resume must be fully tailored to the target role and job description, using the candidate history as source material.
- Do not leave the resume shallow. Return enough detail to read like a complete tailored resume draft.
"""

    linkedin_context = f"\nCandidate LinkedIn URL: {linkedin_profile}" if linkedin_profile else ""

    try:
        response = gemini_client.models.generate_content(
            model=SEARCH_MODEL,
            contents=(
                f"Candidate Name: {full_name}\nTarget: {target_role}{linkedin_context}\n"
                f"History: {career_history}\nJD:\n{job_description}"
            ),
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )

        analysis_result = safe_json_loads(response.text or "")
        if not analysis_result:
            raise ValueError("Model returned invalid JSON.")
    except Exception as ai_err:
        if is_quota_error(ai_err):
            raise HTTPException(
                status_code=429,
                detail="Gemini free-tier quota is currently exhausted for resume generation. Please wait a few minutes and try again.",
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
            Paragraph(str(resume_data.get("headline", f"Target Objective: {target_role}")), styles["Heading3"]),
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

        education_list = resume_data.get("education", [])
        if isinstance(education_list, list) and education_list:
            story.append(Paragraph("<b>Education</b>", section_style))
            for edu in education_list:
                if isinstance(edu, dict):
                    story.append(
                        Paragraph(
                            f"{str(edu.get('qualification', ''))} — {str(edu.get('institution', ''))} ({str(edu.get('duration', ''))})",
                            body_style,
                        )
                    )

        certifications = resume_data.get("certifications", [])
        if isinstance(certifications, list) and certifications:
            story.append(Paragraph("<b>Certifications</b>", section_style))
            for cert in certifications:
                story.append(Paragraph(f"• {str(cert)}", body_style))

        projects = resume_data.get("projects", [])
        if isinstance(projects, list) and projects:
            story.append(Paragraph("<b>Selected Projects</b>", section_style))
            for project in projects:
                if isinstance(project, dict):
                    project_text = (
                        f"<b>{str(project.get('name', 'Project'))}</b>: "
                        f"{str(project.get('description', ''))} "
                        f"{str(project.get('impact', ''))}"
                    )
                    story.append(Paragraph(project_text, body_style))

        achievements = resume_data.get("achievements", [])
        if isinstance(achievements, list) and achievements:
            story.append(Paragraph("<b>Achievements</b>", section_style))
            for achievement in achievements:
                story.append(Paragraph(f"• {str(achievement)}", body_style))

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


def extract_candidate_profile(
    *,
    full_name: str,
    target_role: str,
    location_city: str,
    resume_skills: str,
    career_history: str,
    linkedin_profile: Optional[str],
    extracted_resume_text: str,
) -> dict:
    profile_prompt = """You are an expert career strategist.
Convert the candidate information into a compact structured profile.
Return valid JSON only:
{
  "full_name": "string",
  "target_role": "string",
  "location_preference": "string",
  "seniority": "string",
  "summary": "string",
  "skills": ["skill1", "skill2"],
  "focus_areas": ["domain1", "domain2"],
  "search_query_hint": "short query hint"
}
"""

    payload = (
        f"Full Name: {full_name}\n"
        f"Target Role: {target_role}\n"
        f"Preferred Location: {location_city}\n"
        f"Resume Skills: {resume_skills}\n"
        f"Career History: {career_history}\n"
        f"LinkedIn: {linkedin_profile or ''}\n"
        f"Extracted Resume Text: {extracted_resume_text}"
    )

    try:
        response = gemini_client.models.generate_content(
            model=SEARCH_MODEL,
            contents=payload,
            config=types.GenerateContentConfig(
                system_instruction=profile_prompt,
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )
        profile = safe_json_loads(response.text or "")
    except Exception:
        profile = {}

    if not isinstance(profile, dict):
        profile = {}

    skills = profile.get("skills", [])
    if not isinstance(skills, list):
        skills = [str(skills)] if skills else []

    focus_areas = profile.get("focus_areas", [])
    if not isinstance(focus_areas, list):
        focus_areas = [str(focus_areas)] if focus_areas else []

    return {
        "full_name": profile.get("full_name") or full_name,
        "target_role": profile.get("target_role") or target_role,
        "location_preference": profile.get("location_preference") or location_city,
        "seniority": profile.get("seniority") or "",
        "summary": profile.get("summary") or "",
        "skills": [str(item) for item in skills if str(item).strip()],
        "focus_areas": [str(item) for item in focus_areas if str(item).strip()],
        "search_query_hint": profile.get("search_query_hint") or "",
    }


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

    raw_link = (
        job.get("link")
        or job.get("application_link")
        or job.get("apply_link")
        or job.get("apply_url")
        or job.get("job_url")
        or job.get("url")
        or ""
    )
    link = str(raw_link).strip()
    if link.startswith("www."):
        link = f"https://{link}"
    if link and not link.startswith(("http://", "https://")) and "." in link and " " not in link:
        link = f"https://{link}"
    if not link.startswith(("http://", "https://")):
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
    return generate_resume_analysis(
        full_name=full_name,
        target_role=target_role,
        career_history=career_history,
        job_description=job_description,
        linkedin_profile=linkedin_profile,
        total_questions_requested=total_questions_requested,
        interview_type=interview_type,
    )


def grounded_search_pass(query: str, candidate_context: str) -> list[dict]:
    system_pro
