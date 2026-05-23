import os
import json
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

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔐 CLOUD STORAGE SECURE ENVIRONMENT POOL CHECK
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not supabase_url or not supabase_key:
    raise ValueError("CRITICAL DISPATCH ERROR: Missing Supabase credentials.")
supabase: Client = create_client(supabase_url, supabase_key)

# 🚀 STABLE GOOGLE NATIVE ENGINE POOL CLIENT
gemini_client = genai.Client()

# 📋 Pydantic Validation Mappings (Forced Strict JSON Extraction Safety Rails)
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
    generated_interview_vectors: List[InterviewItem]
    follow_up_questions_to_ask: List[str]
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
    interview_focus_type: str = Form("technical") # Enforces 'hr' or 'technical' selector loops
):
    try:
        requested_count = int(total_questions_requested)
        requested_count = max(5, min(25, requested_count))
    except ValueError:
        requested_count = 5

    # Enforce standard space allocation calculation layout boundaries
    remaining_slots = max(1, requested_count - 1)

    system_prompt = (
        f"You are an elite corporate Recruiter and strict Automated ATS validation algorithm matrix.\n"
        f"Analyze the candidate history against the job description requirements.\n"
        f"CRITICAL INTERVIEW COMPLIANCE EXTRACTION PARAMETERS:\n"
        f"1. generated_interview_vectors: Generate an array containing exactly {requested_count} items.\n"
        f"   - Item 0 MUST ALWAYS BE: question: 'Tell me about yourself.', response: 'Provide a structured elevator pitch weaving in history, target goals, and technical mastery hooks.'\n"
        f"   - The remaining {remaining_slots} questions must conform strictly to the focus type: '{interview_focus_type.upper()}'.\n"
        f"   - If focus type is 'HR': Generate behavioral, situational, culture-fit, and communication challenge questions.\n"
        f"   - If focus type is 'TECHNICAL': Generate domain tool integration challenges, coding paradigms, architectural flaws, and design pattern questions based on the job description.\n"
        f"2. follow_up_questions_to_ask: Provide a high-impact list of exactly 3 or 4 custom strategic questions the candidate should ask the interviewer at the close of a {interview_duration} conversation node based on the context.\n"
        f"3. match_score: Evaluate alignment from 0 to 100 based strictly on overlap parameters."
    )

    linkedin_context = f"\nLinkedIn Anchor Node: {linkedin_profile}" if linkedin_profile else ""

    try:
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=f"Candidate: {full_name}\nTarget: {target_role}{linkedin_context}\nHistory: {career_history}\nJD:\n{job_description}",
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=CareerDashboardSchema,
                temperature=0.15
            )
        )
        analysis_result = json.loads(response.text.strip())
    except Exception as ai_err:
        raise HTTPException(status_code=500, detail=f"AI Compliance Extractor Vector Exception: {str(ai_err)}")

    resume_data = analysis_result.get("resume", {})
    public_url = ""

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
            public_url = "Cloud Link Storage Warning"

        if os.path.exists(pdf_filename):
            os.remove(pdf_filename)
    except Exception:
        public_url = "PDF Engine Fallback Block"

    # Strict array slicing validation constraints to enforce exact layout requirements
    final_vectors = analysis_result.get("generated_interview_vectors", [])[:requested_count]

    return {
        "match_score": analysis_result.get("match_score", 70),
        "missing_skills": analysis_result.get("missing_skills", []),
        "tailoring_tips": analysis_result.get("tailoring_tips", []),
        "generated_interview_vectors": final_vectors,
        "follow_up_questions_to_ask": analysis_result.get("follow_up_questions_to_ask", []),
        "resume": resume_data, 
        "shareable_url": public_url
    }
