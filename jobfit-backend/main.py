import ipaddress
import json
import math
import os
import re
import uuid
from html import escape
from typing import Any, List, Optional
from urllib.parse import urlparse

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
from supabase import Client, create_client

app = FastAPI()

FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "https://cognitwistai.duckdns.org,http://localhost:3000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    supabase_url = supabase_url or "https://supabase.co"
    supabase_key = supabase_key or "placeholder-key"

supabase: Client = create_client(supabase_url, supabase_key)
gemini_client = genai.Client()

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_UPLOAD_EXTENSIONS = {".pdf", ".docx"}
ALLOWED_UPLOAD_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
}
ALLOWED_JOB_DOMAINS = {
    "linkedin.com",
    "indeed.com",
    "lever.co",
    "greenhouse.io",
}
PUBLIC_PDF_SHARING_ENABLED = os.getenv("PUBLIC_PDF_SHARING_ENABLED", "false").lower() == "true"


def safe_pdf_text(value: Any) -> str:
    return escape(str(value or ""), quote=True)


def safe_pdf_filename(full_name: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9._-]+", "_", full_name).strip("._-")[:80]
    return f"{normalized or 'candidate'}_Resume.pdf"


def safe_job_url(value: Any) -> Optional[str]:
    candidate = str(value or "").strip()
    if not candidate:
        return None

    try:
        parsed = urlparse(candidate)
    except ValueError:
        return None

    if parsed.scheme.lower() != "https" or not parsed.hostname:
        return None
    if parsed.username or parsed.password:
        return None

    hostname = parsed.hostname.lower().rstrip(".")
    try:
        ipaddress.ip_address(hostname)
        return None
    except ValueError:
        pass

    if not any(hostname == domain or hostname.endswith(f".{domain}") for domain in ALLOWED_JOB_DOMAINS):
        return None

    return candidate


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
            f"the remaining {hr_count} must be behavioral/HR/company culture questions relevant to this engineering target."
        )
    else:
        distribution_prompt = (
            f"Generate exactly {requested_count} question/response objects total focusing "
            f"100% strictly on HR, behavioral, core corporate values, cultural fit, and situational team management scenarios."
        )

    system_prompt = f"""You are an expert tech recruiter and automated ATS tracking system.
Analyze the candidate parameters explicitly against the provided job description requirements.
You must return a single, valid JSON object containing exactly the listed keys.
Do not wrap your output in markdown backticks or any trailing text.

REQUIRED JSON FORMAT SCHEMA EXACTLY:
{{
  "match_score": 75,
  "missing_skills": ["list", "of", "skills"],
  "tailoring_tips": ["bullet", "points"],
  "tell_me_about_yourself": "STAR structured narrative elevator pitch text statement matching the candidate background",
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

CRITICAL INSTRUCTIONS:
- interview_questions: {distribution_prompt}
- Every answer string inside the 'response' key MUST be structured clearly in the STAR framework, explicitly labeled matching this layout exactly inside the text block string:
  - Situation: [Context details]
  - Task: [Core objective/responsibility]
  - Action: [What specific engineering execution was performed]
  - Result: [Quantifiable technical metrics metrics outcome]
- follow_up_questions: Generate 3 to 5 highly intelligent questions for the candidate to ask the interviewer at the end."""

    linkedin_context = f"\nCandidate LinkedIn URL: {linkedin_profile}" if linkedin_profile else ""

    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
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

        raw_text = response.text.strip()
        if "```json" in raw_text:
            raw_text = raw_text.split("```json")[-1].split("```")[0].strip()
        elif "```" in raw_text:
            raw_text = raw_text.split("```")[-1].split("```")[0].strip()

        analysis_result = json.loads(raw_text)
    except Exception as ai_err:
        raise HTTPException(status_code=500, detail=f"AI Data Map Extraction Crash Error: {str(ai_err)}")

    resume_data = analysis_result.get("resume", {})
    if not isinstance(resume_data, dict):
        resume_data = {}

    public_url: Optional[str] = None
    pdf_filename = safe_pdf_filename(full_name)

    try:
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
            Paragraph(f"<b>{safe_pdf_text(resume_data.get('full_name', full_name))}</b>", title_style),
            Paragraph(f"Target Objective: {safe_pdf_text(target_role)}", styles["Heading3"]),
            Spacer(1, 8),
            Paragraph("<b>Professional Summary</b>", section_style),
            Paragraph(safe_pdf_text(resume_data.get("professional_summary", "")), body_style),
            Paragraph("<b>Core Competencies</b>", section_style),
        ]

        skills_list = resume_data.get("skills", [])
        skills_str = ", ".join(str(skill) for skill in skills_list) if isinstance(skills_list, list) else str(skills_list)
        story.append(Paragraph(safe_pdf_text(skills_str), body_style))
        story.append(Paragraph("<b>Professional Experience</b>", section_style))

        exp_list = resume_data.get("experience", [])
        if isinstance(exp_list, list):
            for exp in exp_list:
                if isinstance(exp, dict):
                    story.append(
                        Paragraph(
                            f"<b>{safe_pdf_text(exp.get('role', 'Engineer'))}</b> — "
                            f"{safe_pdf_text(exp.get('company', 'Company'))} "
                            f"({safe_pdf_text(exp.get('duration', 'Present'))})",
                            styles["Heading4"],
                        )
                    )
                    bullets = exp.get("bullet_points", [])
                    if isinstance(bullets, list):
                        for bullet in bullets:
                            story.append(Paragraph(f"• {safe_pdf_text(bullet)}", body_style))
                story.append(Spacer(1, 4))

        doc.build(story)

        if PUBLIC_PDF_SHARING_ENABLED:
            with open(pdf_filename, "rb") as file_handle:
                file_data = file_handle.read()

            storage_path = f"resumes/{uuid.uuid4().hex}/{pdf_filename}"
            supabase.storage.from_("updated-resumes").upload(
                path=storage_path,
                file=file_data,
                file_options={"content-type": "application/pdf", "upsert": "false"},
            )
            public_url = supabase.storage.from_("updated-resumes").get_public_url(storage_path)
    except Exception:
        public_url = None
    finally:
        if os.path.exists(pdf_filename):
            os.remove(pdf_filename)

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

    final_questions = final_questions[:requested_count]

    return {
        "match_score": int(analysis_result.get("match_score", 70)),
        "missing_skills": list(analysis_result.get("missing_skills", [])),
        "tailoring_tips": list(analysis_result.get("tailoring_tips", [])),
        "tell_me_about_yourself": str(analysis_result.get("tell_me_about_yourself", "")),
        "interview_questions": final_questions,
        "follow_up_questions": list(analysis_result.get("follow_up_questions", [])),
        "resume": resume_data,
        "shareable_url": public_url,
    }


@app.post("/search-jobs/")
@app.post("/search-jobs")
async def search_jobs(
    target_role: str = Form(...),
    location_city: str = Form(...),
    resume_skills: Optional[str] = Form(None),
    resume_file: Optional[UploadFile] = File(None),
):
    candidate_profile_context = ""

    if resume_file:
        filename = resume_file.filename or ""
        extension = os.path.splitext(filename.lower())[1]
        if extension not in ALLOWED_UPLOAD_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Only PDF and DOCX files are accepted.")
        if resume_file.content_type not in ALLOWED_UPLOAD_TYPES:
            raise HTTPException(status_code=400, detail="Unsupported upload content type.")

        file_bytes = await resume_file.read(MAX_UPLOAD_BYTES + 1)
        if len(file_bytes) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Uploaded CV must be 5 MB or smaller.")

        candidate_profile_context = file_bytes.decode("utf-8", errors="ignore")[:20000]
    else:
        candidate_profile_context = (resume_skills or "")[:20000]

    search_query = (
        f'"{target_role}" openings in "{location_city}" posted last 10 days '
        "site:linkedin.com OR site:indeed.com OR site:lever.co OR site:greenhouse.io"
    )

    search_prompt = (
        "Perform an active live web search using the query constraint provided below.\n"
        "Locate actual, real, current job openings matching these parameters.\n"
        f"Query Constraint: {search_query}"
    )

    try:
        search_response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=search_prompt,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                temperature=0.2,
            ),
        )
        raw_web_data = getattr(search_response, "text", "") or str(search_response)
    except Exception as search_error:
        raise HTTPException(status_code=500, detail=f"Web Grounding Compilation Exception: {str(search_error)}")

    system_prompt = """You are an automated live job matching extraction tool.
Analyze the provided raw web search data text against the candidate's background profile data to extract up to 40 active, real job listings.

REQUIRED OUTPUT JSON STRUCTURE EXACTLY:
{
  "jobs": [
    {
      "title": "Job Title String",
      "company": "Company Name String",
      "location": "City, State or Remote String",
      "salary": "$Range or Not Disclosed String",
      "skills": ["skill1", "skill2"],
      "link": "An HTTPS URL on linkedin.com, indeed.com, lever.co, or greenhouse.io, or 'search on company website'"
    }
  ],
  "best_match_summary": "A high-density one-line statement analyzing which 3 jobs are top matches for this user based on their parsed skills/file parameters and why."
}

CRITICAL DATA RETRIEVAL RULES:
1. Compile up to 40 unique listings matching the parameters found in the raw web data text.
2. Cross-reference listings critically against the candidate background profile context text to isolate relevant alignments.
3. Include only HTTPS job links on linkedin.com, indeed.com, lever.co, or greenhouse.io. Otherwise write 'search on company website'.
4. Never guess, fabricate, shorten, or transform a link.
5. Your output must be pure raw valid JSON string content only. Do not wrap in markdown or backticks."""

    try:
        formatting_response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=(
                f"Raw Web Search Data to Filter:\n{raw_web_data}\n\n"
                f"Candidate Background Profile Data Context:\n{candidate_profile_context}\n\n"
                f"Target Role Objective Fit:\n{target_role}"
            ),
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )

        clean_text = formatting_response.text.strip()
        if "```json" in clean_text:
            clean_text = clean_text.split("```json")[-1].split("```")[0].strip()
        elif "```" in clean_text:
            clean_text = clean_text.split("```")[-1].split("```")[0].strip()

        jobs_result = json.loads(clean_text)
    except Exception as parsing_error:
        raise HTTPException(status_code=500, detail=f"Data Schema Extraction Exception: {str(parsing_error)}")

    raw_jobs = jobs_result.get("jobs", [])
    if not isinstance(raw_jobs, list):
        raw_jobs = []

    sanitized_jobs = []
    for job in raw_jobs:
        if not isinstance(job, dict):
            continue

        skills_raw = job.get("skills", [])
        skills_arr = skills_raw if isinstance(skills_raw, list) else [str(skills_raw)]
        validated_link = safe_job_url(job.get("link"))

        sanitized_jobs.append(
            {
                "title": str(job.get("title", "Opportunities Tracker"))[:240],
                "company": str(job.get("company", "Enterprise Resource"))[:240],
                "location": str(job.get("location", location_city))[:240],
                "salary": str(job.get("salary", "Not Disclosed"))[:240],
                "skills": [str(skill)[:160] for skill in skills_arr[:30]],
                "link": validated_link or "search on company website",
            }
        )

    return {
        "jobs": sanitized_jobs[:40],
        "best_match_summary": str(
            jobs_result.get(
                "best_match_summary",
                "Review the table matrix results above to locate best technical alignments.",
            )
        )[:2000],
    }
