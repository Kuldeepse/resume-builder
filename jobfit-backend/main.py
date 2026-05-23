import os
import json
import math
from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel
from typing import List, Optional
from supabase import create_client, Client
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors  # ✅ FIXED: Added required colors module

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔐 SAFE CLOUD STORAGE CONNECTION
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

# ✅ FIXED: Fail gracefully with placeholder keys so initialization doesn't kill the worker thread
if not supabase_url or not supabase_key:
    print("⚠️ WARNING: Missing Supabase configurations. Using fallbacks.")
    supabase_url = supabase_url or "https://supabase.co"
    supabase_key = supabase_key or "placeholder-key"

supabase: Client = create_client(supabase_url, supabase_key)

# 🚀 INITIALIZE THE GOOGLE GENAI CLIENT
gemini_client = genai.Client()

# 📋 Pydantic Architectural Blueprints
class ExperienceItem(BaseModel):
    company: str
    role: str
    duration: str
    bullet_points: List[str]

class ResumeData(BaseModel):
    full_name: str
    professional_summary: str
    skills: List[str]
    experience: List[ExperienceItem]

class InterviewItem(BaseModel):
    question: str
    response: str

class CareerDashboardSchema(BaseModel):
    match_score: int
    missing_skills: List[str]
    tailoring_tips: List[str]
    tell_me_about_yourself: str
    interview_questions: List[InterviewItem]
    follow_up_questions: List[str]
    resume: ResumeData


@app.get("/health/")
async def health_check():
    return {"status": "healthy"}

@app.post("/build-resume")
async def build_and_compare_resume(
    full_name: str = Form(...),
    target_role: str = Form(...),
    career_history: str = Form(...),
    job_description: str = Form(...),
    linkedin_profile: Optional[str] = Form(None),
    interview_duration: str = Form("30 minutes"),
    total_questions_requested: str = Form("5"),
    interview_type: Optional[str] = Form("technical") 
):
    # Ensure environment validation happens locally during live execution lifecycle
    if "placeholder" in supabase_url or "placeholder" in supabase_key:
        raise HTTPException(
            status_code=500, 
            detail="Deployment Configuration Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on hosting manager."
        )

    try:
        requested_count = int(total_questions_requested)
        requested_count = max(5, min(25, requested_count))
    except ValueError:
        requested_count = 5

    current_type = str(interview_type).lower() if interview_type else "technical"

    if current_type == "technical":
        tech_count = math.ceil(requested_count / 2)
        hr_count = math.floor(requested_count / 2)
        distribution_prompt = (
            f"Generate exactly {requested_count} question/response objects total: "
            f"the first {tech_count} must be deep high-impact coding/technical/system design questions, and "
            f"the remaining {hr_count} must be behavioral/HR/company culture questions relevant to this engineering target."
        )
    else:
        distribution_prompt = (
            f"Generate exactly {requested_count} question/response objects total focusing "
            f"100% strictly on HR, behavioral, core corporate values, cultural fit, and situational team management scenarios."
        )

    system_prompt = (
        f"You are an expert tech recruiter and automated ATS tracking system script.\n"
        f"Analyze the candidate parameters explicitly against the provided job description requirements.\n"
        f"CRITICAL COMPLIANCE TARGETS:\n"
        f"1. match_score: Grade technical fit critically from 0 to 100 based strictly on overlap.\n"
        f"2. missing_skills: Isolate explicit hard tools/languages omitted in the experience profile text.\n"
        f"3. tell_me_about_yourself: Provide a perfect 2-minute elevator pitch narrative in STAR format tailored to this specific role.\n"
        f"4. interview_questions: {distribution_prompt}\n"
        f"CRITICAL RESPONSE FORMAT RULE FOR ALL QUESTIONS:\n"
        f"Every single answer string inside the 'response' key MUST be structured clearly in the STAR framework. "
        f"You must explicitly label the headers inside the text block string, matching this layout exactly:\n"
        f"- Situation: [Context details]\n"
        f"- Task: [Core objective/responsibility]\n"
        f"- Action: [What specific engineering/behavioral execution was performed]\n"
        f"- Result: [Quantifiable metrics metrics outcome]\n"
        f"5. follow_up_questions: Generate 3 to 5 highly intelligent questions for the candidate to ask the interviewer at the end.\n"
        f"6. resume: Reconstruct experience bullets to weave in relevant missing keywords natively."
    )

    linkedin_context = f"\nCandidate LinkedIn URL Profile Data: {linkedin_profile}" if linkedin_profile else ""

    try:
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=f"Candidate Name: {full_name}\nTarget: {target_role}{linkedin_context}\nHistory: {career_history}\nJD:\n{job_description}",
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=CareerDashboardSchema,
                temperature=0.1
            )
        )
        # ✅ FIXED: Extract data correctly via .parsed to match Pydantic constraints cleanly
        if hasattr(response, 'parsed') and response.parsed:
            analysis_result = response.parsed.model_dump()
        else:
            analysis_result = json.loads(response.text.strip())
            
    except Exception as ai_err:
        raise HTTPException(status_code=500, detail=f"AI Engine Extraction Crash Error: {str(ai_err)}")

    resume_data = analysis_result.get("resume", {})
    public_url = "Cloud Storage Connection Mismatch"

    try:
        pdf_filename = f"{full_name.replace(' ', '_')}_Resume.pdf"
        doc = SimpleDocTemplate(pdf_filename, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle('TStyle', parent=styles['Heading1'], fontSize=22, leading=26, spaceAfter=10)
        # ✅ FIXED: Converted color hex string into an active ReportLab color object
        section_style = ParagraphStyle('SStyle', parent=styles['Heading2'], fontSize=13, leading=17, spaceBefore=10, spaceAfter=4, textColor=colors.HexColor('#8B5A2B'))
        body_style = styles['Normal']
        
        story = [
            Paragraph(f"<b>{resume_data.get('full_name', full_name)}</b>", title_style),
            Paragraph(f"Target Objective: {target_role}", styles['Heading3']),
            Spacer(1, 8),
            Paragraph("<b>Professional Summary</b>", section_style),
            Paragraph(resume_data.get('professional_summary', ''), body_style),
            Paragraph("<b>Core Competencies</b>", section_style),
            Paragraph(", ".join(resume_data.get('skills', [])), body_style),
            Paragraph("<b>Professional Experience</b>", section_style)
        ]
        
        for exp in resume_data.get('experience', []):
            story.append(Paragraph(f"<b>{exp.get('role', '')}</b> — {exp.get('company', '')} ({exp.get('duration', '')})", styles['Heading4']))
            for bullet in exp.get('bullet_points', []):
                story.append(Paragraph(f"• {bullet}", body_style))
            story.append(Spacer(1, 4))

        doc.build(story)

        with open(pdf_filename, "rb") as f:
            file_data = f.read()

        storage_path = f"resumes/{pdf_filename}"
        
        try:
            supabase.storage.from_("updated-resumes").upload(path=storage_path, file=file_data, file_options={"content-type": "application/pdf"})
            public_url = supabase.storage.from_("updated-resumes").get_public_url(storage_path)
        except Exception as upload_err:
            print(f"Storage Upload Error: {upload_err}")
            pass 

        if os.path.exists(pdf_filename):
            os.remove(pdf_filename)

    except Exception as pdf_error:
        raise HTTPException(status_code=500, detail=f"PDF Generation/Processing Failure: {str(pdf_error)}")

    # ✅ FIXED: Enforced a matching structural root dictionary yield back to the client route
    return {
        "success": True,
        "data": analysis_result,
        "resume_url": public_url
    }
