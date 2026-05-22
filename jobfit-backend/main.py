import os
import json
from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
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

# 🚀 CRITICAL: Force the client to look strictly for GEMINI_API_KEY env variables natively
gemini_client = genai.Client()

@app.post("/build-resume")
async def build_and_compare_resume(
    full_name: str = Form(...),
    target_role: str = Form(...),
    career_history: str = Form(...),
    job_description: str = Form(...)
):
    system_prompt = (
        "You are an expert resume writer and ATS optimization system. Analyze the user's career logs against the target job requirements. "
        "Calculate an objective match score percentage, list the missing technical skills, give clear optimization tips, and build a tailored resume structure."
    )
    
    user_prompt = (
        f"Name: {full_name}\n"
        f"Target Role: {target_role}\n"
        f"Raw History: {career_history}\n"
        f"Target Job Description:\n{job_description}"
    )
    
    try:
        # Define a rigid type constraint so Gemini answers strictly in clean data objects natively
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=user_prompt,
            config=genai.types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                temperature=0.3
            ),
        )
        
        analysis_result = json.loads(response.text)
    except Exception as ai_error:
        print(f"--- GEMINI PARSING CRASH LOG: {str(ai_error)} ---")
        raise HTTPException(status_code=500, detail=f"Gemini Processing Failed: {str(ai_error)}")
    
    resume_data = analysis_result.get("resume", {})

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
        story.append(Paragraph(resume_data.get('professional_summary', 'Experienced professional tailored for target role.'), body_style))
        
        story.append(Paragraph("<b>Core Competencies</b>", section_style))
        story.append(Paragraph(", ".join(resume_data.get('skills', ['ATS Optimization'])), body_style))
        
        story.append(Paragraph("<b>Professional Experience</b>", section_style))
        for exp in resume_data.get('experience', []):
            story.append(Paragraph(f"<b>{exp.get('role', 'Specialist')}</b> — {exp.get('company', 'Enterprise')} ({exp.get('duration', 'Recent')})", styles['Heading4']))
            for bullet in exp.get('bullet_points', []):
                story.append(Paragraph(f"• {bullet}", body_style))
            story.append(Spacer(1, 6))

        doc.build(story)

        # 3. Save PDF direct to Supabase Storage Bucket
        storage_path = f"resumes/{pdf_filename}"
        with open(pdf_filename, "rb") as f:
            supabase.storage.from_("updated-resumes").upload(storage_path, f, {"content-type": "application/pdf"})

        public_url = supabase.storage.from_("updated-resumes").get_public_url(storage_path)
        os.remove(pdf_filename)
    except Exception as infra_error:
        print(f"--- STORAGE ENGINE CRASH LOG: {str(infra_error)} ---")
        raise HTTPException(status_code=500, detail=f"Infrastructure Storage System Failed: {str(infra_error)}")

    return {
        "match_score": analysis_result.get("match_score", 75),
        "missing_skills": analysis_result.get("missing_skills", []),
        "tailoring_tips": analysis_result.get("tailoring_tips", []),
        "resume": resume_data, 
        "shareable_url": public_url
    }
