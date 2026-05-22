import os
import json
from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List, Optional
from supabase import create_client, Client
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

app = FastAPI()

# 🛠️ CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔐 SAFE SUPABASE INITIALIZATION
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("CRITICAL: Missing SUPABASE_URL or SUPABASE_KEY environment variables.")

supabase: Client = create_client(supabase_url, supabase_key)

# 🚀 GOOGLE GEMINI INITIALIZATION
gemini_client = genai.Client()

# 📋 Pydantic Schemas to Guarantee Perfect Data Formats
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
    hr_interview: List[InterviewItem]
    technical_interview: List[InterviewItem]
    resume: ResumeData


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "gemini_key_loaded": bool(os.getenv("GEMINI_API_KEY")),
        "supabase_url_loaded": bool(supabase_url),
        "supabase_key_loaded": bool(supabase_key)
    }


@app.post("/build-resume")
async def build_and_compare_resume(
    full_name: str = Form(...),
    target_role: str = Form(...),
    career_history: str = Form(...),
    job_description: str = Form(...)
):
    system_prompt = (
        "You are an expert resume writer, recruiter, and interview coach. Your task is to output a single structural layout "
        "matching the requested schema exactly. Analyze the user's career history against the target job description to build everything."
    )
    
    try:
        # Uses strict Pydantic Response Schema to enforce exact data formatting natively
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=f"Name: {full_name}\nTarget Role: {target_role}\nHistory: {career_history}\nJob Description:\n{job_description}",
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=CareerDashboardSchema,
                temperature=0.3
            )
        )
        analysis_result = json.loads(response.text.strip())
    except Exception as ai_error:
        print(f"--- GEMINI PARSING CRASH: {str(ai_error)} ---")
        raise HTTPException(status_code=500, detail=f"Gemini Processing Failed: {str(ai_error)}")
    
    resume_data = analysis_result.get("resume", {})
    public_url = ""

    # 🗂️ SAFE INFRASTRUCTURE PIPELINE
    try:
        pdf_filename = f"{full_name.replace(' ', '_')}_Resume.pdf"
        doc = SimpleDocTemplate(pdf_filename, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle('TitleStyle', parent=styles['Heading1'], fontSize=24, leading=28, spaceAfter=12)
        section_style = ParagraphStyle('SectionStyle', parent=styles['Heading2'], fontSize=14, leading=18, spaceBefore=12, spaceAfter=6, textColor='#4F46E5')
        body_style = styles['Normal']
        
        story = []
        story.append(Paragraph(f"<b>{resume_data.get('full_name', full_name)}</b>", title_style))
        story.append(Paragraph(f"Target Role: {target_role}", styles['Heading3']))
        story.append(Spacer(1, 10))
        
        story.append(Paragraph("<b>Professional Summary</b>", section_style))
        story.append(Paragraph(resume_data.get('professional_summary', ''), body_style))
        
        story.append(Paragraph("<b>Core Competencies</b>", section_style))
        story.append(Paragraph(", ".join(resume_data.get('skills', [])), body_style))
        
        story.append(Paragraph("<b>Professional Experience</b>", section_style))
        for exp in resume_data.get('experience', []):
            story.append(Paragraph(f"<b>{exp.get('role', '')}</b> — {exp.get('company', '')} ({exp.get('duration', '')})", styles['Heading4']))
            for bullet in exp.get('bullet_points', []):
                story.append(Paragraph(f"• {bullet}", body_style))
            story.append(Spacer(1, 6))

        doc.build(story)

        with open(pdf_filename, "rb") as f:
            file_data = f.read()

        storage_path = f"resumes/{pdf_filename}"
        
        # Safe Try/Except Wrapper: If Supabase Storage permissions or bucket names fail, 
        # it catches the error here and preserves the rest of the application response data.
        try:
            supabase.storage.from_("updated-resumes").upload(
                path=storage_path,
                file=file_data,
                file_options={"content-type": "application/pdf"}
            )
            public_url = supabase.storage.from_("updated-resumes").get_public_url(storage_path)
        except Exception as storage_err:
            print(f"--- SUPABASE STORAGE CONTINUITY WARNING: {str(storage_err)} ---")
            public_url = "https://supabase.com (Bucket Connection Error)"

        if os.path.exists(pdf_filename):
            os.remove(pdf_filename)
            
    except Exception as pdf_error:
        print(f"--- PDF SYSTEM BREAK: {str(pdf_error)} ---")
        # Continues without breaking structural dashboard arrays
        public_url = "PDF Generation Error"

    return {
        "match_score": analysis_result.get("match_score", 75),
        "missing_skills": analysis_result.get("missing_skills", []),
        "tailoring_tips": analysis_result.get("tailoring_tips", []),
        "hr_interview": analysis_result.get("hr_interview", []),
        "technical_interview": analysis_result.get("technical_interview", []),
        "resume": resume_data, 
        "shareable_url": public_url
    }
