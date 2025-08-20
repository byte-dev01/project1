import fitz  # PyMuPDF
import tkinter as Tk
from tkinter import filedialog
import pandas as pd
import pytesseract
from pdf2image import convert_from_path

def extract_text_from_pdf(pdf_path):
    """Extract text from a PDF with selectable text."""
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text("text") + "\n"  # Concatenating the extracted text
    return text.strip()

def check_pdf_text_layer(pdf_path):
    """Check if the PDF has selectable text or if it's a scanned image."""
    doc = fitz.open(pdf_path)  
    for page_num in range(len(doc)):
        text = doc.load_page(page_num).get_text("text")
        if text.strip():  # If any text is found, return True
            return True
    return False  # If no text is found, it's likely a scanned PDF

def ocr_from_scanned_pdf(pdf_path):
    """Extract text from a scanned PDF using OCR."""
    print("🔄 Performing OCR on scanned PDF...")

    try:
        images = convert_from_path(pdf_path)  # Adjust path
    except Exception as e:
        print(f"❌ Error converting PDF to images: {e}")
        return ""

    extracted_text = ""

    for i, img in enumerate(images):
        text = pytesseract.image_to_string(img, lang="eng")  # Extract text from image
        extracted_text += f"\n--- Page {i+1} ---\n{text}\n"

    return extracted_text.strip()

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

def save_to_txt(text, filename="output.txt"):
    """Save extracted text to a .txt file."""
    if text.strip():
        with open(filename, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"📄 Text saved to {filename}")
        return filename
    print("❌ No text to save to TXT.")

def save_to_excel(data, filename="output.xlsx"):
    """Save extracted text to an Excel file."""
    if data.strip():
        df = pd.DataFrame({"Extracted Text": [data]})
        df.to_excel(filename, index=False)
        print(f"📊 Text saved to {filename}")
        return filename
    print("❌ No text to save to Excel.")

def main(): 
    """Main function to run the PDF text extraction process."""
    extracted_text = select_pdf()

    if extracted_text.strip():  # Only save if there's text
        save_to_txt(extracted_text)  
        save_to_excel(extracted_text)  
    else:
        print("❌ No text extracted, nothing to save.")

if __name__ == "__main__": 
    main()  # Start the program