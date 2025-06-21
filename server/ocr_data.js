const fs = require("fs");
const sql = require("./db");

async function handleOCRData(output, filename, filePath, res) {
  const parsed = JSON.parse(output);
  if (parsed.status !== "success") throw new Error("OCR failed");

  const data = parsed.data;

  const [patient] = await sql`
    INSERT INTO patients (first_name, last_name, legal_name, date_of_birth)
    VALUES (
      ${data.first_name || 'Unknown'},
      ${data.last_name || ''},
      ${data.legal_name || null},
      ${data.date_of_birth || null}
    )
    RETURNING id
  `;

  const [record] = await sql`
    INSERT INTO medical_records (
      patient_id, record_type, chief_complaint, medical_history,
      medications, present_illness, history_illness, physician_notes
    )
    VALUES (
      ${patient.id}, 'OCR_EXTRACTED',
      ${data.chief_complaint || null},
      ${data.medical_history || null},
      ${JSON.stringify(data.medications || {})},
      ${data.present_illness || '{}'},
      ${data.history_illness || '{}'},
      ${data.physician_notes || null}
    )
    RETURNING id
  `;

  await sql`
    INSERT INTO ocr_records (
      patient_id, original_filename, file_path,
      extracted_data, processing_status, processed_by
    )
    VALUES (
      ${patient.id}, ${filename}, ${filePath},
      ${JSON.stringify(data)}, 'Completed', NULL
    )
  `;

  fs.unlinkSync(filePath);
  res.json({ status: "saved", patient_id: patient.id, record_id: record.id });
}

module.exports = handleOCRData;
