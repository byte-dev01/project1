import sys
import fitz  # PyMuPDF
import pytesseract
from pdf2image import convert_from_path
import os

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

def ocr_from_scanned_pdf(pdf_path):
    """Perform OCR on scanned PDF"""
    try:
        images = convert_from_path(pdf_path, dpi=150, first_page=1, last_page=3)  # Limit to first 3 pages
        extracted_text = ""
        for i, img in enumerate(images):
            text = pytesseract.image_to_string(img, lang="eng")
            extracted_text += f"\n--- Page {i+1} ---\n{text}\n"
        return extracted_text.strip()
    except Exception as e:
        return f"OCR Error: {str(e)}"

def main():
    """Main function to extract and print text"""
    if len(sys.argv) < 2:
        print(" No file path provided")
        return

    file_path = sys.argv[1]

    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    if check_pdf_text_layer(file_path):
        extracted_text = extract_text_from_pdf(file_path)
    else:
        extracted_text = ocr_from_scanned_pdf(file_path)

    print(extracted_text)
if __name__ == "__main__":
    main()
