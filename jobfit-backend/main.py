import os
import json
from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
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
# This checks for both names to prevent the "supabase_key is required" crash
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("CRITICAL: Missing SUPABASE_URL or SUPABASE_KEY environment variables.")

supabase: Client = create_client(supabase_url, supabase_key)

# 🚀 GOOGLE GEMINI INITIALIZATION
# Leaves arguments empty so it automatically reads GEMINI_API_KEY from Render
gemini_client = genai.Client()


@app.get("/health")
async def health_check():
    """Endpoint to quickly check backend status and environment keys."""
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
        '    {"question": "Explain system architecture X.", "
