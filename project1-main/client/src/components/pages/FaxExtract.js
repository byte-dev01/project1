import React from "react";

export default function FaxExtractionPage() {
  return (
    <div className="container">
      <div className="section-header">
        <h1>Fax Extraction Overview</h1>
        <p>How the system detects, processes, and classifies faxed medical records</p>
      </div>

      <div className="card">
        <h2>📥 Fax File Detection</h2>
        <p>
          The system continuously monitors a predefined folder for incoming fax
          documents, usually in PDF or TIFF format. Once a new file is detected,
          it is queued for processing.
        </p>
      </div>

      <div className="card">
        <h2>🔍 Optical Character Recognition (OCR)</h2>
        <p>
          Each fax document undergoes OCR using Tesseract or a cloud-based API to
          extract text content. The extracted text is then cleaned and normalized.
        </p>
      </div>

      <div className="card">
        <h2>📑 Medical Data Parsing</h2>
        <p>
          The OCR result is parsed using pattern recognition to extract:
        </p>
        <ul>
          <li>Patient name, DOB, and identifiers</li>
          <li>Diagnosis or ICD-10 codes</li>
          <li>Prescriptions, test results, and follow-ups</li>
        </ul>
      </div>

      <div className="card">
        <h2>⚠️ Urgency Classification</h2>
        <p>
          Each fax is scored based on clinical keywords. Critical faxes (e.g.,
          abnormal labs or urgent referrals) are flagged and routed to clinicians
          immediately.
        </p>
      </div>

      <div className="card">
        <h2>📤 Integration</h2>
        <p>
          Parsed and classified fax data is inserted into the local database, and
          optionally sent to the EHR system or notified to the doctor via email or
          dashboard.
        </p>
      </div>
    </div>
  );
}
