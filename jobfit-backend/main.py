import os
from fastapi import FastAPI, Form
from fastapi.middleware.cors import CORSMiddleware
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
# Set method to "json_object" to ensure clean text parsing
llm = ChatOpenAI(model="gpt-4o", temperature=0.4).bind(response_format={"type": "json_object"})

@app.post("/build-resume")
async def build_and_compare_resume(
    full_name: str = Form(...),
    target_role: str = Form(...),
    career_history: str = Form(...),
    job_description: str = Form(...)
):
    system_prompt = (
        "You are an expert resume writer and ATS optimization system. Your task is to output a single, raw, valid JSON object string "
        "matching this exact keys layout framework. Do not output markdown, preambles, or formatting blocks. Only valid JSON.\n\n"
        "EXPECTED JSON FORMAT:\n"
        "{\n"
        '  "match_score": 85,\n'
        '  "missing_skills": ["Skill A", "Skill B"],\n'
        '  "tailoring_tips": ["Tip 1", "Tip 2"],\n'
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
        "  }\n"
        "}"
    )
    
    user_prompt = (
        f"Name: {full_name}\n"
        f"Target Role: {target_role}\n"
        f"Raw History: {career_history}\n"
        f"Target Job Description:\n{job_description}"
    )
    
    # 1. Generate text matching our schema layout safely using native JSON mode
    ai_msg = llm.invoke([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ])
    
    import json
    analysis_result = json.loads(ai_msg.content)

    # 2. Extract elements safely using standard dictionaries
    resume_data = analysis_result.get("resume", {})
    
    # 3. Programmatically generate clean layout PDF matching the AI structured text
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

    # 4. Save PDF direct to Supabase Storage Bucket
    storage_path = f"resumes/{pdf_filename}"
    with open(pdf_filename, "rb") as f:
        supabase.storage.from_("updated-resumes").upload(storage_path, f, {"content-type": "application/pdf"})

    # 5. Generate Absolute Cloud Public Share Link
    public_url = supabase.storage.from_("updated-resumes").get_public_url(storage_path)
    os.remove(pdf_filename)

    return {
        "match_score": analysis_result.get("match_score", 0),
        "missing_skills": analysis_result.get("missing_skills", []),
        "tailoring_tips": analysis_result.get("tailoring_tips", []),
        "resume": resume_data, 
        "shareable_url": public_url
    }
