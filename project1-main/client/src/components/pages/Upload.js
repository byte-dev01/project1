import React, { useState } from "react";

const Upload = ({ userId }) => {
  const [file, setFile] = useState(null);
  const [ocrResult, setOcrResult] = useState(null); // structured object
  const [loading, setLoading] = useState(false);

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select a file first!");

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      const response = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json(); // assume it's structured JSON
      setOcrResult(data);
    } catch (error) {
      console.error("OCR failed:", error);
      alert("OCR extraction failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!ocrResult) return;

    const rows = [["Field", "Value"]];
    Object.entries(ocrResult).forEach(([key, value]) => {
      const val = Array.isArray(value) ? value.join(", ") : value;
      rows.push([key, val]);
    });

    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "ocr_result.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>OCR Scan</h1>
      <p>Logged in as: {userId}</p>
      <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={loading}>
        {loading ? "Processing..." : "Upload & Extract"}
      </button>

      {ocrResult && (
        <div style={{ marginTop: "2rem" }}>
          <h3>Extracted Fields:</h3>
          <ul>
            {Object.entries(ocrResult).map(([key, value]) => (
              <li key={key}>
                <strong>{key}:</strong> {Array.isArray(value) ? value.join(", ") : value}
              </li>
            ))}
          </ul>
          <button onClick={handleExportCSV} style={{ marginTop: "1rem" }}>
            Export to CSV
          </button>
        </div>
      )}
    </div>
  );
};

export default Upload;
