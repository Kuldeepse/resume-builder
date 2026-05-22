import os
import json
from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types  # 🚀 CRITICAL: Required for modern Gemini configurations
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
gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

@app.post("/build-resume")
async def build_and_compare_resume(
    full_name: str = Form(...),
    target_role: str = Form(...),
    career_history: str = Form(...),
    job_description: str = Form(...)
):
    system_prompt = (
        "You are an expert resume writer, recruiter, and interview coach. Your task is to output a single, raw, valid JSON object "
        "matching this exact keys layout framework. Do not output markdown, preambles, or formatting blocks. Only valid JSON.\n\n"
        "EXPECTED JSON FORMAT:\n"
        "{\n"
        '  "match_score": 85,\n'
        '  "missing_skills": ["Skill A", "Skill B"],\n'
        '  "tailoring_tips": ["Tip 1", "Tip 2"],\n'
        '  "hr_interview": [\n'
        '    {"question": "Why do you want to join our company?", "response": "Based on my background in X..."}\n'
        '  ],\n'
        '  "technical_interview": [\n'
        '    {"question": "Explain system architecture X.", "response": "In my past role, I implemented..."}\n'
        '  ],\n'
        '  "resume": {\n'
        '    "full_name": "User Name",\n'
        '    "professional_summary": "Summary text",\n'
        '    "skills": ["Keyword A", "Keyword B"],\n'
        '    "experience": [\n'
        '      {\n'
        '        "company": "Company Name",\n'
        '        "role": "Job Title",\n'
        '        "duration": "2020 - Present",\n'
        '        "bullet_points": ["Achieved X via Y", "Managed Z"]\n'
        "      }\n"
        "    ]\n"
        '  }\n'
        "}"
    )
    
    user_prompt = (
        f"Name: {full_name}\n"
        f"Target Role: {target_role}\n"
        f"Raw History: {career_history}\n"
        f"Target Job Description:\n{job_description}"
    )
    
    try:
        # ✅ FIXED: Utilizing official google-genai config types to split systemic instructions and force native JSON mode
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                temperature=0.3
            )
        )
        
        cleaned_text = response.text.strip()
        analysis_result = json.loads(cleaned_text)
    except Exception as ai_error:
        print(f"--- GEMINI PARSING CRASH: {str(ai_error)} ---")
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

        storage_path = f"{pdf_filename}"
        with open(pdf_filename, "rb") as f:
            supabase.storage.from_("updated-resumes").upload(
                path=storage_path,
                file=f,
                file_options={"content-type": "application/pdf"}
            )

        public_url = supabase.storage.from_("updated-resumes").get_public_url(storage_path)
        os.remove(pdf_filename)
    except Exception as infra_error:
        print(f"--- STORAGE ENGINE CRASH LOG: {str(infra_error)} ---")
        raise HTTPException(status_code=500, detail=f"Infrastructure Storage System Failed: {str(infra_error)}")

    return {
        "match_score": analysis_result.get("match_score", 75),
        "missing_skills": analysis_result.get("missing_skills", []),
        "tailoring_tips": analysis_result.get("tailoring_tips", []),
        "hr_interview": analysis_result.get("hr_interview", []),
        "technical_interview": analysis_result.get("technical_interview", []),
        "resume": resume_data, 
        "shareable_url": public_url
    }
