import os
import json
from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel
from typing import List
from supabase import create_client, Client
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔐 INFRASTRUCTURE CONFIGURATION
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not supabase_url or not supabase_key:
    raise ValueError("CRITICAL: Missing Supabase environmental keys.")
supabase: Client = create_client(supabase_url, supabase_key)

# 🚀 FREE GOOGLE GEMINI LAYER
gemini_client = genai.Client()

# 📋 Pydantic Validation Blueprints (Guarantees Accuracy in Flash Models)
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
    return {"status": "healthy"}


@app.post("/build-resume")
async def build_and_compare_resume(
    full_name: str = Form(...),
    target_role: str = Form(...),
    career_history: str = Form(...),
    job_description: str = Form(...)
):
    # Strict algorithmic rules to force Gemini Flash into hyper-accurate metrics scoring
    system_prompt = (
        "You are an automated corporate ATS compliance scanning algorithm system. "
        "Analyze the user's career history explicitly against the target job description criteria.\n"
        "CRITICAL METRIC RULES:\n"
        "1. match_score: Perform an objective mathematical comparison based on skills overlap. Be highly critical.\n"
        "2. missing_skills: Isolate explicit hard frameworks, programming languages, and tools from the job description completely missing in the candidate's text.\n"
        "3. resume / experience: Rewrite the candidate's bullet points to weave in missing professional hard skills while matching the structural schema parameters."
    )

    try:
        # Enforces structured output formatting directly via the Gemini Native Engine
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=f"Candidate: {full_name}\nTarget: {target_role}\nHistory: {career_history}\nJD:\n{job_description}",
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=CareerDashboardSchema,
                temperature=0.2
            )
        )
        analysis_result = json.loads(response.text.strip())
    except Exception as ai_err:
        raise HTTPException(status_code=500, detail=f"AI Engine Extraction Error: {str(ai_err)}")

    resume_data = analysis_result.get("resume", {})
    public_url = ""

    # 🗂️ DOCUMENT GENERATION PIPELINE
    try:
        pdf_filename = f"{full_name.replace(' ', '_')}_Resume.pdf"
        doc = SimpleDocTemplate(pdf_filename, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle('TStyle', parent=styles['Heading1'], fontSize=22, leading=26, spaceAfter=10)
        section_style = ParagraphStyle('SStyle', parent=styles['Heading2'], fontSize=13, leading=17, spaceBefore=10, spaceAfter=4, textColor='#8B5A2B')
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
        except Exception:
            public_url = "Storage Connection Error"

        if os.path.exists(pdf_filename):
            os.remove(pdf_filename)
            
    except Exception:
        public_url = "PDF Engine Fallback"

    return {
        "match_score": analysis_result.get("match_score", 70),
        "missing_skills": analysis_result.get("missing_skills", []),
        "tailoring_tips": analysis_result.get("tailoring_tips", []),
        "hr_interview": analysis_result.get("hr_interview", []),
        "technical_interview": analysis_result.get("technical_interview", []),
        "resume": resume_data, 
        "shareable_url": public_url
    }
