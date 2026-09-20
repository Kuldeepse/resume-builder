"""Temporary compatibility bridge for the legacy backend PdfReader import.

Do not install the abandoned PyPDF2 distribution: this module deliberately uses
maintained pypdf for PDF parsing. Remove this bridge when main.py is refactored
to import PdfReader from pypdf directly.
"""

from pypdf import PdfReader

__all__ = ["PdfReader"]
