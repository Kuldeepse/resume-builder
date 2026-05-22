import os
from fastapi import FastAPI, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from langchain_openai import ChatOpenAI
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

supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
llm = ChatOpenAI(model="gpt-4o", temperature=0.5)

# Define structured schema for a complete resume output
class WorkExperience(BaseModel):
    company: str
    role: str
    duration: str
    bullet_points: List[str]

class ResumeSchema(BaseModel):
    full_name: str
    professional_summary: str
    skills: List[str]
    experience: List[WorkExperience]

@app.post("/build-resume")
async def build_resume(
    full_name: str = Form(...),
    target_role: str = Form(...),
    career_history: str = Form(...)
):
    structured_llm = llm.with_structured_output(ResumeSchema)
    
    system_prompt = (
        "You are an expert resume writer. Transform the user's raw career history, name, and target role "
        "into a professionally polished resume structure. Enhance their bullet points using strong "
        "action verbs and measurable metrics where possible."
    )
    
    user_prompt = f"Name: {full_name}\nTarget Role: {target_role}\nRaw History:\n{career_history}"
    
    # 1. Generate Structured Resume Content via AI
    resume_data = structured_llm.invoke([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ])

    # 2. Programmatically Generate clean PDF document layouts
    pdf_filename = f"{full_name.replace(' ', '_')}_Resume.pdf"
    doc = SimpleDocTemplate(pdf_filename, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    
    # Custom styling parameters
    title_style = ParagraphStyle('TitleStyle', parent=styles['Heading1'], fontSize=24, leading=28, spaceAfter=12)
    section_style = ParagraphStyle('SectionStyle', parent=styles['Heading2'], fontSize=14, leading=18, spaceBefore=12, spaceAfter=6, textColor='#4F46E5')
    body_style = styles['Normal']
    
    story = []
    story.append(Paragraph(f"<b>{resume_data.full_name}</b>", title_style))
    story.append(Paragraph(f"Target Role: {target_role}", styles['Heading3']))
    story.append(Spacer(1, 10))
    
    story.append(Paragraph("<b>Professional Summary</b>", section_style))
    story.append(Paragraph(resume_data.professional_summary, body_style))
    
    story.append(Paragraph("<b>Core Competencies</b>", section_style))
    story.append(Paragraph(", ".join(resume_data.skills), body_style))
    
    story.append(Paragraph("<b>Professional Experience</b>", section_style))
    for exp in resume_data.experience:
        story.append(Paragraph(f"<b>{exp.role}</b> — {exp.company} ({exp.duration})", styles['Heading4']))
        for bullet in exp.bullet_points:
            story.append(Paragraph(f"• {bullet}", body_style))
        story.append(Spacer(1, 6))

    doc.build(story)

    # 3. Save Newly Created File directly to Supabase Bucket
    storage_path = f"resumes/{pdf_filename}"
    with open(pdf_filename, "rb") as f:
        supabase.storage.from_("updated-resumes").upload(storage_path, f, {"content-type": "application/pdf"})

    # 4. Generate Absolute Public Share Link
    public_url = supabase.storage.from_("updated-resumes").get_public_url(storage_path)
    os.remove(pdf_filename)

    return {"resume": resume_data, "shareable_url": public_url}

