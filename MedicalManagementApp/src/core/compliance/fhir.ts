import { Bundle, Patient, Observation, MedicationRequest, AllergyIntolerance } from 'fhir/r4';
import { v4 as uuidv4 } from 'uuid';
import { auditLogger } from '@core/compliance/AuditLogger';

export class FHIRService {
  private static instance: FHIRService;
  private readonly fhirVersion = '4.0.1';

  static getInstance(): FHIRService {
    if (!FHIRService.instance) {
      FHIRService.instance = new FHIRService();
    }
    return FHIRService.instance;
  }

  /**
   * Convert internal patient data to FHIR Patient resource
   */
  async createPatientResource(patientData: any): Promise<Patient> {
    const patient: Patient = {
      resourceType: 'Patient',
      id: uuidv4(),
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
        profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'],
      },
      identifier: [
        {
          use: 'official',
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'MR',
              display: 'Medical Record Number',
            }],
          },
          system: 'https://healthbridge.california.gov/mrn',
          value: patientData.mrn,
        },
        {
          use: 'secondary',
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'SS',
              display: 'Social Security Number',
            }],
          },
          system: 'http://hl7.org/fhir/sid/us-ssn',
          value: patientData.ssn,
        },
      ],
      active: true,
      name: [{
        use: 'official',
        family: patientData.lastName,
        given: [patientData.firstName],
        prefix: patientData.prefix ? [patientData.prefix] : undefined,
      }],
      telecom: [
        {
          system: 'phone',
          value: patientData.phone,
          use: 'mobile',
          rank: 1,
        },
        {
          system: 'email',
          value: patientData.email,
          use: 'home',
        },
      ],
      gender: this.mapGender(patientData.gender),
      birthDate: patientData.dateOfBirth,
      address: [{
        use: 'home',
        type: 'both',
        line: [patientData.address.street],
        city: patientData.address.city,
        state: patientData.address.state,
        postalCode: patientData.address.zip,
        country: 'USA',
      }],
      contact: patientData.emergencyContact ? [{
        relationship: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
            code: 'EP',
            display: 'Emergency Contact',
          }],
        }],
        name: {
          text: patientData.emergencyContact.name,
        },
        telecom: [{
          system: 'phone',
          value: patientData.emergencyContact.phone,
        }],
      }] : undefined,
      communication: [{
        language: {
          coding: [{
            system: 'urn:ietf:bcp:47',
            code: patientData.preferredLanguage || 'en',
            display: this.getLanguageDisplay(patientData.preferredLanguage || 'en'),
          }],
        },
        preferred: true,
      }],
      extension: [
        {
          url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-race',
          extension: [{
            url: 'ombCategory',
            valueCoding: {
              system: 'urn:oid:2.16.840.1.113883.6.238',
              code: this.mapRaceCode(patientData.race),
              display: patientData.race,
            },
          }],
        },
        {
          url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity',
          extension: [{
            url: 'ombCategory',
            valueCoding: {
              system: 'urn:oid:2.16.840.1.113883.6.238',
              code: this.mapEthnicityCode(patientData.ethnicity),
              display: patientData.ethnicity,
            },
          }],
        },
      ],
    };

    await auditLogger.logFHIROperation({
      operation: 'CREATE',
      resourceType: 'Patient',
      resourceId: patient.id,
      timestamp: new Date(),
    });

    return patient;
  }

  /**
   * Create FHIR Observation for vital signs
   */
  async createObservation(vitalSign: any): Promise<Observation> {
    const observation: Observation = {
      resourceType: 'Observation',
      id: uuidv4(),
      meta: {
        profile: ['http://hl7.org/fhir/StructureDefinition/vitalsigns'],
      },
      status: 'final',
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs',
        }],
      }],
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: this.getLoincCode(vitalSign.type),
          display: vitalSign.type,
        }],
      },
      subject: {
        reference: `Patient/${vitalSign.patientId}`,
      },
      effectiveDateTime: vitalSign.recordedAt || new Date().toISOString(),
      valueQuantity: {
        value: vitalSign.value,
        unit: vitalSign.unit,
        system: 'http://unitsofmeasure.org',
        code: vitalSign.unitCode,
      },
      performer: [{
        reference: `Practitioner/${vitalSign.recordedBy}`,
      }],
    };

    // Add interpretation if abnormal
    if (vitalSign.isAbnormal) {
      observation.interpretation = [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
          code: vitalSign.value > vitalSign.normalRange.high ? 'H' : 'L',
          display: vitalSign.value > vitalSign.normalRange.high ? 'High' : 'Low',
        }],
      }];
    }

    return observation;
  }

  /**
   * Create FHIR MedicationRequest
   */
  async createMedicationRequest(prescription: any): Promise<MedicationRequest> {
    const medicationRequest: MedicationRequest = {
      resourceType: 'MedicationRequest',
      id: uuidv4(),
      meta: {
        profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest'],
      },
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: {
        coding: [{
          system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
          code: prescription.rxNormCode,
          display: prescription.medicationName,
        }],
        text: prescription.medicationName,
      },
      subject: {
        reference: `Patient/${prescription.patientId}`,
      },
      authoredOn: prescription.prescribedDate,
      requester: {
        reference: `Practitioner/${prescription.prescriberId}`,
      },
      dosageInstruction: [{
        text: prescription.sig,
        timing: {
          repeat: {
            frequency: prescription.frequency,
            period: prescription.period,
            periodUnit: prescription.periodUnit,
          },
        },
        route: {
          coding: [{
            system: 'http://snomed.info/sct',
            code: this.getRouteCode(prescription.route),
            display: prescription.route,
          }],
        },
        doseAndRate: [{
          doseQuantity: {
            value: prescription.dose,
            unit: prescription.doseUnit,
            system: 'http://unitsofmeasure.org',
            code: prescription.doseUnitCode,
          },
        }],
      }],
      dispenseRequest: {
        quantity: {
          value: prescription.quantity,
          unit: prescription.quantityUnit,
        },
        numberOfRepeatsAllowed: prescription.refills,
        expectedSupplyDuration: {
          value: prescription.daysSupply,
          unit: 'days',
          system: 'http://unitsofmeasure.org',
          code: 'd',
        },
      },
      substitution: {
        allowedBoolean: prescription.allowGenericSubstitution,
      },
    };

    // Add prior authorization if required
    if (prescription.priorAuthRequired) {
      medicationRequest.priorPrescription = {
        reference: `MedicationRequest/${prescription.priorAuthNumber}`,
      };
    }

    return medicationRequest;
  }

  /**
   * Create FHIR AllergyIntolerance resource
   */
  async createAllergyIntolerance(allergy: any): Promise<AllergyIntolerance> {
    const allergyIntolerance: AllergyIntolerance = {
      resourceType: 'AllergyIntolerance',
      id: uuidv4(),
      meta: {
        profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance'],
      },
      clinicalStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
          code: allergy.isActive ? 'active' : 'inactive',
        }],
      },
      verificationStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
          code: allergy.verified ? 'confirmed' : 'unconfirmed',
        }],
      },
      type: allergy.type, // 'allergy' or 'intolerance'
      category: [allergy.category], // 'food', 'medication', 'environment', 'biologic'
      criticality: allergy.severity, // 'low', 'high', 'unable-to-assess'
      code: {
        coding: [{
          system: 'http://snomed.info/sct',
          code: allergy.snomedCode,
          display: allergy.allergen,
        }],
        text: allergy.allergen,
      },
      patient: {
        reference: `Patient/${allergy.patientId}`,
      },
      onsetDateTime: allergy.onsetDate,
      recordedDate: allergy.recordedDate || new Date().toISOString(),
      recorder: {
        reference: `Practitioner/${allergy.recordedBy}`,
      },
      reaction: allergy.reactions ? allergy.reactions.map((reaction: any) => ({
        substance: {
          coding: [{
            system: 'http://snomed.info/sct',
            code: reaction.substanceCode,
            display: reaction.substance,
          }],
        },
        manifestation: [{
          coding: [{
            system: 'http://snomed.info/sct',
            code: reaction.manifestationCode,
            display: reaction.manifestation,
          }],
        }],
        severity: reaction.severity,
        exposureRoute: reaction.exposureRoute ? {
          coding: [{
            system: 'http://snomed.info/sct',
            code: reaction.exposureRouteCode,
            display: reaction.exposureRoute,
          }],
        } : undefined,
      })) : undefined,
    };

    return allergyIntolerance;
  }

  /**
   * Generate FHIR Bundle for data exchange
   */
  async generateBundle(resources: any[]): Promise<Bundle> {
    const bundle: Bundle = {
      resourceType: 'Bundle',
      id: uuidv4(),
      meta: {
        lastUpdated: new Date().toISOString(),
      },
      type: 'collection',
      total: resources.length,
      entry: resources.map(resource => ({
        fullUrl: `urn:uuid:${resource.id}`,
        resource,
        request: {
          method: 'POST',
          url: resource.resourceType,
        },
      })),
    };

    await auditLogger.logFHIROperation({
      operation: 'BUNDLE_EXPORT',
      resourceType: 'Bundle',
      resourceId: bundle.id,
      resourceCount: resources.length,
      timestamp: new Date(),
    });

    return bundle;
  }

  /**
   * Validate FHIR resource against profile
   */
  async validateResource(resource: any): Promise<{valid: boolean; errors: string[]}> {
    const errors: string[] = [];

    // Basic structural validation
    if (!resource.resourceType) {
      errors.push('Missing resourceType');
    }

    if (!resource.id) {
      errors.push('Missing resource id');
    }

    // Profile-specific validation
    switch (resource.resourceType) {
      case 'Patient':
        if (!resource.name || resource.name.length === 0) {
          errors.push('Patient must have at least one name');
        }
        if (!resource.identifier || resource.identifier.length === 0) {
          errors.push('Patient must have at least one identifier');
        }
        break;
      
      case 'Observation':
        if (!resource.status) {
          errors.push('Observation must have status');
        }
        if (!resource.code) {
          errors.push('Observation must have code');
        }
        if (!resource.subject) {
          errors.push('Observation must have subject');
        }
        break;
      
      case 'MedicationRequest':
        if (!resource.status) {
          errors.push('MedicationRequest must have status');
        }
        if (!resource.intent) {
          errors.push('MedicationRequest must have intent');
        }
        if (!resource.medicationCodeableConcept && !resource.medicationReference) {
          errors.push('MedicationRequest must have medication');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Helper methods
  private mapGender(gender: string): 'male' | 'female' | 'other' | 'unknown' {
    const genderMap: {[key: string]: 'male' | 'female' | 'other' | 'unknown'} = {
      'M': 'male',
      'F': 'female',
      'O': 'other',
      'U': 'unknown',
    };
    return genderMap[gender] || 'unknown';
  }

  private getLoincCode(vitalType: string): string {
    const loincCodes: {[key: string]: string} = {
      'blood_pressure_systolic': '8480-6',
      'blood_pressure_diastolic': '8462-4',
      'heart_rate': '8867-4',
      'respiratory_rate': '9279-1',
      'temperature': '8310-5',
      'oxygen_saturation': '59408-5',
      'weight': '29463-7',
      'height': '8302-2',
      'bmi': '39156-5',
    };
    return loincCodes[vitalType] || '0000-0';
  }

  private getRouteCode(route: string): string {
    const routeCodes: {[key: string]: string} = {
      'oral': '26643006',
      'intravenous': '47625008',
      'intramuscular': '78421000',
      'subcutaneous': '34206005',
      'topical': '6064005',
      'inhalation': '18679011000001101',
    };
    return routeCodes[route.toLowerCase()] || '26643006';
  }

  private mapRaceCode(race: string): string {
    const raceCodes: {[key: string]: string} = {
      'American Indian or Alaska Native': '1002-5',
      'Asian': '2028-9',
      'Black or African American': '2054-5',
      'Native Hawaiian or Other Pacific Islander': '2076-8',
      'White': '2106-3',
      'Other': '2131-1',
    };
    return raceCodes[race] || '2131-1';
  }

  private mapEthnicityCode(ethnicity: string): string {
    const ethnicityCodes: {[key: string]: string} = {
      'Hispanic or Latino': '2135-2',
      'Not Hispanic or Latino': '2186-5',
    };
    return ethnicityCodes[ethnicity] || '2186-5';
  }

  private getLanguageDisplay(code: string): string {
    const languages: {[key: string]: string} = {
      'en': 'English',
      'es': 'Spanish',
      'zh': 'Chinese',
      'vi': 'Vietnamese',
      'ko': 'Korean',
      'tl': 'Tagalog',
      'ar': 'Arabic',
    };
    return languages[code] || 'English';
  }
}

export const fhirService = FHIRService.getInstance();