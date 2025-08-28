const mongoose = require('mongoose');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const PDFDocument = require('pdfkit');
const { v4: uuidv4 } = require('uuid');

const exportRequestSchema = new mongoose.Schema({
  requestId: {
    type: String,
    default: uuidv4,
    unique: true,
    required: true
  },
  patientId: {
    type: String,
    required: true,
    index: true
  },
  requesterId: {
    type: String,
    required: true
  },
  requesterType: {
    type: String,
    enum: ['patient', 'authorized_representative', 'provider', 'insurance', 'legal'],
    required: true
  },
  requestDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'processing', 'completed', 'rejected', 'expired'],
    default: 'pending'
  },
  dataCategories: [{
    type: String,
    enum: [
      'medical_records',
      'lab_results',
      'prescriptions',
      'imaging',
      'visit_notes',
      'insurance_claims',
      'billing',
      'allergies',
      'immunizations',
      'procedures',
      'demographics',
      'emergency_contacts'
    ]
  }],
  dateRange: {
    startDate: Date,
    endDate: Date
  },
  format: {
    type: String,
    enum: ['pdf', 'json', 'xml', 'csv', 'fhir', 'ccd'],
    default: 'pdf'
  },
  deliveryMethod: {
    type: String,
    enum: ['download', 'email', 'secure_message', 'api', 'physical_media'],
    default: 'download'
  },
  purpose: {
    type: String,
    enum: [
      'personal_use',
      'second_opinion',
      'changing_provider',
      'insurance_claim',
      'legal_requirement',
      'research',
      'continuity_of_care'
    ],
    required: true
  },
  verificationMethod: {
    type: String,
    enum: ['password', 'sms', 'email', 'id_verification', 'in_person'],
    required: true
  },
  verificationCompleted: {
    type: Boolean,
    default: false
  },
  approvalDetails: {
    approvedBy: String,
    approvedDate: Date,
    approverRole: String,
    notes: String
  },
  rejectionReason: String,
  exportDetails: {
    fileName: String,
    fileSize: Number,
    fileHash: String,
    encryptionKey: String,
    exportDate: Date,
    downloadUrl: String,
    downloadExpiry: Date,
    downloadCount: { type: Number, default: 0 },
    maxDownloads: { type: Number, default: 3 }
  },
  auditLog: [{
    action: String,
    timestamp: Date,
    userId: String,
    details: mongoose.Schema.Types.Mixed
  }],
  gdprCompliance: {
    consentObtained: Boolean,
    consentDate: Date,
    dataRetentionPeriod: Number,
    rightToErasure: Boolean,
    dataPortability: Boolean
  },
  hipaaCompliance: {
    minimumNecessary: Boolean,
    accountingOfDisclosure: Boolean,
    authorizationForm: String,
    restrictedPHI: [String]
  }
});

exportRequestSchema.index({ requestDate: -1 });
exportRequestSchema.index({ status: 1, requestDate: -1 });

const ExportRequest = mongoose.model('ExportRequest', exportRequestSchema);

class DataExportService {
  constructor() {
    this.exportPath = path.join(__dirname, '../exports');
    this.templatePath = path.join(__dirname, '../templates');
    this.maxFileSize = 500 * 1024 * 1024; // 500MB
    this.retentionDays = 30;
  }

  async createExportRequest(requestData) {
    try {
      const exportRequest = new ExportRequest({
        ...requestData,
        requestId: uuidv4(),
        auditLog: [{
          action: 'REQUEST_CREATED',
          timestamp: new Date(),
          userId: requestData.requesterId,
          details: { categories: requestData.dataCategories }
        }]
      });

      await exportRequest.save();

      if (requestData.requesterType === 'patient') {
        await this.sendVerificationCode(exportRequest);
      }

      return exportRequest;
    } catch (error) {
      throw new Error(`Failed to create export request: ${error.message}`);
    }
  }

  async verifyRequest(requestId, verificationCode) {
    try {
      const request = await ExportRequest.findOne({ requestId });
      
      if (!request) {
        throw new Error('Export request not found');
      }

      // Verify code (simplified - implement actual verification)
      const isValid = await this.validateVerificationCode(request, verificationCode);
      
      if (!isValid) {
        throw new Error('Invalid verification code');
      }

      request.verificationCompleted = true;
      request.auditLog.push({
        action: 'VERIFICATION_COMPLETED',
        timestamp: new Date(),
        userId: request.requesterId
      });

      await request.save();
      
      // Auto-approve patient requests after verification
      if (request.requesterType === 'patient') {
        await this.approveRequest(requestId, {
          approvedBy: 'system',
          approverRole: 'automated',
          notes: 'Auto-approved after patient verification'
        });
      }

      return request;
    } catch (error) {
      throw new Error(`Verification failed: ${error.message}`);
    }
  }

  async approveRequest(requestId, approvalDetails) {
    try {
      const request = await ExportRequest.findOne({ requestId });
      
      if (!request) {
        throw new Error('Export request not found');
      }

      if (request.status !== 'pending') {
        throw new Error('Request is not in pending status');
      }

      request.status = 'approved';
      request.approvalDetails = {
        ...approvalDetails,
        approvedDate: new Date()
      };
      request.auditLog.push({
        action: 'REQUEST_APPROVED',
        timestamp: new Date(),
        userId: approvalDetails.approvedBy,
        details: approvalDetails
      });

      await request.save();
      
      // Start processing the export
      this.processExport(requestId);
      
      return request;
    } catch (error) {
      throw new Error(`Approval failed: ${error.message}`);
    }
  }

  async processExport(requestId) {
    try {
      const request = await ExportRequest.findOne({ requestId });
      
      if (!request) {
        throw new Error('Export request not found');
      }

      request.status = 'processing';
      await request.save();

      // Collect data from various sources
      const exportData = await this.collectPatientData(request);
      
      // Generate export file based on format
      let exportFile;
      switch (request.format) {
        case 'pdf':
          exportFile = await this.generatePDFExport(exportData, request);
          break;
        case 'json':
          exportFile = await this.generateJSONExport(exportData, request);
          break;
        case 'fhir':
          exportFile = await this.generateFHIRExport(exportData, request);
          break;
        case 'xml':
          exportFile = await this.generateXMLExport(exportData, request);
          break;
        default:
          exportFile = await this.generatePDFExport(exportData, request);
      }

      // Encrypt the file
      const encryptedFile = await this.encryptExport(exportFile, request);
      
      // Generate download URL
      const downloadUrl = await this.generateSecureDownloadUrl(encryptedFile, request);
      
      request.status = 'completed';
      request.exportDetails = {
        fileName: encryptedFile.fileName,
        fileSize: encryptedFile.size,
        fileHash: encryptedFile.hash,
        encryptionKey: encryptedFile.key,
        exportDate: new Date(),
        downloadUrl: downloadUrl,
        downloadExpiry: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)), // 7 days
        downloadCount: 0
      };
      request.auditLog.push({
        action: 'EXPORT_COMPLETED',
        timestamp: new Date(),
        userId: 'system',
        details: {
          format: request.format,
          fileSize: encryptedFile.size
        }
      });

      await request.save();
      
      // Notify requester
      await this.notifyExportReady(request);
      
      return request;
    } catch (error) {
      const request = await ExportRequest.findOne({ requestId });
      request.status = 'failed';
      request.auditLog.push({
        action: 'EXPORT_FAILED',
        timestamp: new Date(),
        userId: 'system',
        details: { error: error.message }
      });
      await request.save();
      
      throw new Error(`Export processing failed: ${error.message}`);
    }
  }

  async collectPatientData(request) {
    const patientData = {
      patientId: request.patientId,
      exportDate: new Date(),
      requestId: request.requestId,
      categories: {}
    };

    for (const category of request.dataCategories) {
      switch (category) {
        case 'medical_records':
          patientData.categories.medicalRecords = await this.fetchMedicalRecords(
            request.patientId,
            request.dateRange
          );
          break;
        case 'lab_results':
          patientData.categories.labResults = await this.fetchLabResults(
            request.patientId,
            request.dateRange
          );
          break;
        case 'prescriptions':
          patientData.categories.prescriptions = await this.fetchPrescriptions(
            request.patientId,
            request.dateRange
          );
          break;
        case 'imaging':
          patientData.categories.imaging = await this.fetchImagingStudies(
            request.patientId,
            request.dateRange
          );
          break;
        case 'visit_notes':
          patientData.categories.visitNotes = await this.fetchVisitNotes(
            request.patientId,
            request.dateRange
          );
          break;
        case 'insurance_claims':
          patientData.categories.insuranceClaims = await this.fetchInsuranceClaims(
            request.patientId,
            request.dateRange
          );
          break;
        case 'demographics':
          patientData.categories.demographics = await this.fetchDemographics(
            request.patientId
          );
          break;
        case 'allergies':
          patientData.categories.allergies = await this.fetchAllergies(
            request.patientId
          );
          break;
        case 'immunizations':
          patientData.categories.immunizations = await this.fetchImmunizations(
            request.patientId,
            request.dateRange
          );
          break;
      }
    }

    return patientData;
  }

  async generatePDFExport(data, request) {
    const doc = new PDFDocument();
    const fileName = `patient_export_${request.requestId}.pdf`;
    const filePath = path.join(this.exportPath, fileName);
    
    doc.pipe(fs.createWriteStream(filePath));
    
    // Header
    doc.fontSize(20).text('Patient Health Information Export', 50, 50);
    doc.fontSize(12).text(`Export Date: ${new Date().toLocaleDateString()}`, 50, 80);
    doc.text(`Request ID: ${request.requestId}`, 50, 100);
    doc.text(`Patient ID: ${data.patientId}`, 50, 120);
    
    doc.moveDown();
    
    // Demographics
    if (data.categories.demographics) {
      doc.fontSize(16).text('Demographics', 50, doc.y);
      doc.fontSize(10);
      const demo = data.categories.demographics;
      doc.text(`Name: ${demo.firstName} ${demo.lastName}`);
      doc.text(`Date of Birth: ${demo.dateOfBirth}`);
      doc.text(`Gender: ${demo.gender}`);
      doc.text(`Address: ${demo.address}`);
      doc.text(`Phone: ${demo.phone}`);
      doc.text(`Email: ${demo.email}`);
      doc.moveDown();
    }
    
    // Medical Records
    if (data.categories.medicalRecords) {
      doc.fontSize(16).text('Medical Records', 50, doc.y);
      doc.fontSize(10);
      data.categories.medicalRecords.forEach(record => {
        doc.text(`Date: ${record.date}`);
        doc.text(`Provider: ${record.provider}`);
        doc.text(`Diagnosis: ${record.diagnosis}`);
        doc.text(`Treatment: ${record.treatment}`);
        doc.text(`Notes: ${record.notes}`);
        doc.moveDown();
      });
    }
    
    // Lab Results
    if (data.categories.labResults) {
      doc.addPage();
      doc.fontSize(16).text('Laboratory Results', 50, 50);
      doc.fontSize(10);
      data.categories.labResults.forEach(lab => {
        doc.text(`Date: ${lab.date}`);
        doc.text(`Test: ${lab.testName}`);
        doc.text(`Result: ${lab.result} ${lab.unit}`);
        doc.text(`Reference Range: ${lab.referenceRange}`);
        doc.text(`Status: ${lab.status}`);
        doc.moveDown();
      });
    }
    
    // Prescriptions
    if (data.categories.prescriptions) {
      doc.addPage();
      doc.fontSize(16).text('Prescriptions', 50, 50);
      doc.fontSize(10);
      data.categories.prescriptions.forEach(rx => {
        doc.text(`Medication: ${rx.medication}`);
        doc.text(`Dosage: ${rx.dosage}`);
        doc.text(`Frequency: ${rx.frequency}`);
        doc.text(`Start Date: ${rx.startDate}`);
        doc.text(`End Date: ${rx.endDate || 'Ongoing'}`);
        doc.text(`Prescriber: ${rx.prescriber}`);
        doc.moveDown();
      });
    }
    
    // Footer with compliance information
    doc.fontSize(8);
    doc.text('This document contains protected health information (PHI).', 50, doc.page.height - 100);
    doc.text('Handle in accordance with HIPAA and applicable privacy laws.', 50, doc.page.height - 85);
    doc.text(`Generated: ${new Date().toISOString()}`, 50, doc.page.height - 70);
    
    doc.end();
    
    return {
      fileName,
      filePath,
      format: 'pdf'
    };
  }

  async generateJSONExport(data, request) {
    const fileName = `patient_export_${request.requestId}.json`;
    const filePath = path.join(this.exportPath, fileName);
    
    const exportData = {
      metadata: {
        exportVersion: '1.0',
        exportDate: new Date().toISOString(),
        requestId: request.requestId,
        patientId: data.patientId,
        dataCategories: request.dataCategories,
        dateRange: request.dateRange,
        compliance: {
          hipaa: true,
          gdpr: request.gdprCompliance?.consentObtained || false
        }
      },
      patientData: data.categories
    };
    
    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));
    
    return {
      fileName,
      filePath,
      format: 'json'
    };
  }

  async generateFHIRExport(data, request) {
    const fileName = `patient_export_${request.requestId}_fhir.json`;
    const filePath = path.join(this.exportPath, fileName);
    
    const fhirBundle = {
      resourceType: 'Bundle',
      id: request.requestId,
      type: 'collection',
      timestamp: new Date().toISOString(),
      entry: []
    };
    
    // Convert patient demographics to FHIR Patient resource
    if (data.categories.demographics) {
      fhirBundle.entry.push({
        resource: {
          resourceType: 'Patient',
          id: data.patientId,
          identifier: [{
            system: 'http://hospital.example.org/patients',
            value: data.patientId
          }],
          name: [{
            use: 'official',
            family: data.categories.demographics.lastName,
            given: [data.categories.demographics.firstName]
          }],
          gender: data.categories.demographics.gender,
          birthDate: data.categories.demographics.dateOfBirth,
          address: [{
            use: 'home',
            text: data.categories.demographics.address
          }],
          telecom: [
            {
              system: 'phone',
              value: data.categories.demographics.phone,
              use: 'mobile'
            },
            {
              system: 'email',
              value: data.categories.demographics.email
            }
          ]
        }
      });
    }
    
    // Convert lab results to FHIR Observation resources
    if (data.categories.labResults) {
      data.categories.labResults.forEach(lab => {
        fhirBundle.entry.push({
          resource: {
            resourceType: 'Observation',
            id: lab.id,
            status: 'final',
            code: {
              text: lab.testName
            },
            subject: {
              reference: `Patient/${data.patientId}`
            },
            effectiveDateTime: lab.date,
            valueQuantity: {
              value: lab.result,
              unit: lab.unit
            },
            referenceRange: [{
              text: lab.referenceRange
            }]
          }
        });
      });
    }
    
    await fs.writeFile(filePath, JSON.stringify(fhirBundle, null, 2));
    
    return {
      fileName,
      filePath,
      format: 'fhir'
    };
  }

  async generateXMLExport(data, request) {
    const fileName = `patient_export_${request.requestId}.xml`;
    const filePath = path.join(this.exportPath, fileName);
    
    let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xmlContent += '<PatientExport>\n';
    xmlContent += `  <Metadata>\n`;
    xmlContent += `    <ExportDate>${new Date().toISOString()}</ExportDate>\n`;
    xmlContent += `    <RequestId>${request.requestId}</RequestId>\n`;
    xmlContent += `    <PatientId>${data.patientId}</PatientId>\n`;
    xmlContent += `  </Metadata>\n`;
    
    // Add patient data
    xmlContent += '  <PatientData>\n';
    
    if (data.categories.demographics) {
      const demo = data.categories.demographics;
      xmlContent += '    <Demographics>\n';
      xmlContent += `      <FirstName>${demo.firstName}</FirstName>\n`;
      xmlContent += `      <LastName>${demo.lastName}</LastName>\n`;
      xmlContent += `      <DateOfBirth>${demo.dateOfBirth}</DateOfBirth>\n`;
      xmlContent += `      <Gender>${demo.gender}</Gender>\n`;
      xmlContent += '    </Demographics>\n';
    }
    
    xmlContent += '  </PatientData>\n';
    xmlContent += '</PatientExport>';
    
    await fs.writeFile(filePath, xmlContent);
    
    return {
      fileName,
      filePath,
      format: 'xml'
    };
  }

  async encryptExport(exportFile, request) {
    const algorithm = 'aes-256-gcm';
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    
    const inputPath = exportFile.filePath;
    const outputPath = `${inputPath}.enc`;
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    const input = await fs.readFile(inputPath);
    const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    const encryptedData = Buffer.concat([authTag, iv, encrypted]);
    await fs.writeFile(outputPath, encryptedData);
    
    // Delete unencrypted file
    await fs.unlink(inputPath);
    
    const stats = await fs.stat(outputPath);
    const hash = crypto.createHash('sha256').update(encryptedData).digest('hex');
    
    return {
      fileName: path.basename(outputPath),
      filePath: outputPath,
      size: stats.size,
      hash: hash,
      key: key.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64')
    };
  }

  async generateSecureDownloadUrl(encryptedFile, request) {
    const token = crypto.randomBytes(32).toString('hex');
    const downloadUrl = `/api/export/download/${request.requestId}/${token}`;
    
    // Store token for validation
    request.downloadToken = token;
    await request.save();
    
    return downloadUrl;
  }

  async downloadExport(requestId, token) {
    const request = await ExportRequest.findOne({ requestId });
    
    if (!request) {
      throw new Error('Export request not found');
    }
    
    if (request.downloadToken !== token) {
      throw new Error('Invalid download token');
    }
    
    if (new Date() > new Date(request.exportDetails.downloadExpiry)) {
      throw new Error('Download link has expired');
    }
    
    if (request.exportDetails.downloadCount >= request.exportDetails.maxDownloads) {
      throw new Error('Maximum downloads exceeded');
    }
    
    // Increment download count
    request.exportDetails.downloadCount++;
    request.auditLog.push({
      action: 'EXPORT_DOWNLOADED',
      timestamp: new Date(),
      userId: request.requesterId,
      details: {
        downloadCount: request.exportDetails.downloadCount
      }
    });
    await request.save();
    
    const filePath = path.join(this.exportPath, request.exportDetails.fileName);
    const fileData = await fs.readFile(filePath);
    
    return {
      data: fileData,
      fileName: request.exportDetails.fileName,
      encryptionKey: request.exportDetails.encryptionKey
    };
  }

  async revokeExport(requestId, reason) {
    const request = await ExportRequest.findOne({ requestId });
    
    if (!request) {
      throw new Error('Export request not found');
    }
    
    request.status = 'revoked';
    request.exportDetails.downloadExpiry = new Date();
    request.auditLog.push({
      action: 'EXPORT_REVOKED',
      timestamp: new Date(),
      userId: 'admin',
      details: { reason }
    });
    
    await request.save();
    
    // Delete the export file
    if (request.exportDetails?.fileName) {
      const filePath = path.join(this.exportPath, request.exportDetails.fileName);
      await fs.unlink(filePath).catch(() => {});
    }
    
    return request;
  }

  async cleanupExpiredExports() {
    const expiredDate = new Date(Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000));
    
    const expiredRequests = await ExportRequest.find({
      status: 'completed',
      'exportDetails.exportDate': { $lt: expiredDate }
    });
    
    for (const request of expiredRequests) {
      if (request.exportDetails?.fileName) {
        const filePath = path.join(this.exportPath, request.exportDetails.fileName);
        await fs.unlink(filePath).catch(() => {});
      }
      
      request.status = 'expired';
      request.auditLog.push({
        action: 'EXPORT_EXPIRED',
        timestamp: new Date(),
        userId: 'system',
        details: { retentionDays: this.retentionDays }
      });
      await request.save();
    }
    
    return expiredRequests.length;
  }

  // Mock data fetching methods (replace with actual database queries)
  async fetchMedicalRecords(patientId, dateRange) {
    return [
      {
        id: '1',
        date: '2024-01-15',
        provider: 'Dr. Smith',
        diagnosis: 'Hypertension',
        treatment: 'Medication prescribed',
        notes: 'Blood pressure elevated, started on ACE inhibitor'
      }
    ];
  }

  async fetchLabResults(patientId, dateRange) {
    return [
      {
        id: '1',
        date: '2024-01-10',
        testName: 'Complete Blood Count',
        result: '12.5',
        unit: 'g/dL',
        referenceRange: '12.0-16.0',
        status: 'Normal'
      }
    ];
  }

  async fetchPrescriptions(patientId, dateRange) {
    return [
      {
        id: '1',
        medication: 'Lisinopril',
        dosage: '10mg',
        frequency: 'Once daily',
        startDate: '2024-01-15',
        endDate: null,
        prescriber: 'Dr. Smith'
      }
    ];
  }

  async fetchImagingStudies(patientId, dateRange) {
    return [];
  }

  async fetchVisitNotes(patientId, dateRange) {
    return [];
  }

  async fetchInsuranceClaims(patientId, dateRange) {
    return [];
  }

  async fetchDemographics(patientId) {
    return {
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1980-01-01',
      gender: 'male',
      address: '123 Main St, City, ST 12345',
      phone: '555-0123',
      email: 'john.doe@email.com'
    };
  }

  async fetchAllergies(patientId) {
    return [
      {
        allergen: 'Penicillin',
        reaction: 'Rash',
        severity: 'Moderate'
      }
    ];
  }

  async fetchImmunizations(patientId, dateRange) {
    return [
      {
        vaccine: 'COVID-19',
        date: '2023-10-15',
        manufacturer: 'Pfizer'
      }
    ];
  }

  async sendVerificationCode(request) {
    // Implement actual notification service
    console.log(`Verification code sent for request ${request.requestId}`);
  }

  async validateVerificationCode(request, code) {
    // Implement actual verification
    return true;
  }

  async notifyExportReady(request) {
    // Implement actual notification service
    console.log(`Export ready notification sent for request ${request.requestId}`);
  }
}

module.exports = new DataExportService();