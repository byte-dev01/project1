
import sys
import fitz  # PyMuPDF
import pytesseract
from pdf2image import convert_from_path
import json
import os
import tkinter as Tk
from dotenv import load_dotenv
from tkinter import filedialog

load_dotenv()
def extract_text_from_pdf(pdf_path):
    """Extract text from PDF using PyMuPDF"""
    try:
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text("text") + "\n"
        doc.close()
        return text.strip()
    except Exception as e:
        return f"Error extracting text: {str(e)}"

def check_pdf_text_layer(pdf_path):
    """Check if PDF has searchable text"""
    try:
        doc = fitz.open(pdf_path)
        for page_num in range(min(3, len(doc))):  # Check first 3 pages
            text = doc.load_page(page_num).get_text("text")
            if text.strip():
                doc.close()
                return True
        doc.close()
        return False
    except Exception:
        return False
def select_pdf():
    """Allow the user to select a PDF and extract its text."""
    root = Tk.Tk()
    root.withdraw()  # Hide the main window

    file_path = filedialog.askopenfilename(title="选择文件", filetypes=[("PDF files", "*.pdf")])  
    if not file_path:
        print("❌ No file selected.")
        return ""

    check = check_pdf_text_layer(file_path)  # Check if PDF has selectable text

    if check:
        extracted_text = extract_text_from_pdf(file_path)  # Extract selectable text
        print("\n✅ Extracted Text:\n", extracted_text)
    else:
        extracted_text = ocr_from_scanned_pdf(file_path)  # Use OCR if no text is found
        print("\n📝 OCR Extracted Text:\n", extracted_text)

    return extracted_text  # Return the extracted text

def ocr_from_scanned_pdf(pdf_path):
    """Perform OCR on scanned PDF"""
    try:
        images = convert_from_path(pdf_path, first_page=1, last_page=3)  # Limit to first 3 pages
        extracted_text = ""
        
        for i, img in enumerate(images):
            text = pytesseract.image_to_string(img, lang="eng")
            extracted_text += f"\n--- Page {i+1} ---\n{text}\n"
        
        return extracted_text.strip()
    except Exception as e:
        return f"OCR Error: {str(e)}"

def send_to_openai_for_extraction(text):
    """Send text to OpenAI for structured extraction"""
    try:
        from openai import OpenAI
        
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENROUTER_API_KEY"),         )

        completion = client.chat.completions.create(
            model="deepseek/deepseek-r1-0528:free",
            messages=[
                {
                    "role": "system",
                    "content": """You are a medical document scribe. Extract the following fields from the medical document text and return ONLY a valid JSON object:

Required fields to extract (if present):
- patient_name: Full name of the patient
- legal_name: Legal name if different from patient name
- date_of_birth: Date of birth (format as YYYY-MM-DD if possible)
- pcp_name: Primary care physician name
- chief_complaint: Main complaint or reason for visit
- medical_history: Relevant medical history
- medications: List of current medications and dosage
- labs_ordered: ALL Laboratory tests that were ordered and their results. 
- imaging_results: Imaging test results
- labs_imaging_abnormal: Any abnormal tests.
- Physican_Notes: Display summary what happened during the visit.
- Present illness: a list of present illness;
- History of illness: a list of past illness and surgeries;



Return ONLY the JSON object. If a field is not found, omit it from the response. Do not include any explanatory text."""
                },
                {
                    "role": "user",
                    "content": f"Extract medical information from this text:\n\n{text}"
                }
            ]
        )
        
        response_content = completion.choices[0].message.content.strip()
        
        # Try to extract JSON from the response
        if response_content.startswith('{') and response_content.endswith('}'):
            # Validate JSON
            parsed_json = json.loads(response_content)
            return parsed_json
        else:
            # Look for JSON in the response
            import re
            json_match = re.search(r'\{[^}]*\}', response_content, re.DOTALL)
            if json_match:
                parsed_json = json.loads(json_match.group())
                return parsed_json
            else:
                return {"error": "No structured data could be extracted", "raw_response": response_content}
    
    except ImportError:
        return {"error": "OpenAI library not installed. Install with: pip install openai"}
    except Exception as e:
        return {"error": f"OpenAI extraction failed: {str(e)}"}

def main():
    """Main function to process PDF and return structured JSON"""
    if len(sys.argv) < 2:
        print(json.dumps({
            "status": "error",
            "message": "No file path provided"
        }))
        return

    file_path = sys.argv[1]
    
    if not os.path.exists(file_path):
        print(json.dumps({
            "status": "error",
            "message": f"File not found: {file_path}"
        }))
        return

    try:
        # Step 1: Extract text from PDF
        if check_pdf_text_layer(file_path):
            extracted_text = extract_text_from_pdf(file_path)
        else:
            extracted_text = ocr_from_scanned_pdf(file_path)
        
        if not extracted_text or extracted_text.startswith("Error") or extracted_text.startswith("OCR Error"):
            print(json.dumps({
                "status": "error",
                "message": "Failed to extract text from PDF",
                "details": extracted_text
            }))
            return
        
        # Step 2: Send to OpenAI for structured extraction
        structured_data = send_to_openai_for_extraction(extracted_text)
        
        if "error" in structured_data:
            print(json.dumps({
                "status": "error",
                "message": "Failed to extract structured data",
                "details": structured_data
            }))
            return
        
        # Step 3: Return success with structured data
        print(json.dumps({
            "status": "success",
            "data": structured_data
        }))
        
    except Exception as e:
        print(json.dumps({
            "status": "error",
            "message": "Unexpected error occurred",
            "details": str(e)
        }))

if __name__ == "__main__":
    main()