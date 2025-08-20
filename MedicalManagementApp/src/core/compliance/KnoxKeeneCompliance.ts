/**
 * Knox-Keene Act Compliance Requirements
 * California Health & Safety Code §§ 1340-1399.818
 * 
 * WHAT IT IS:
 * - Regulates HMOs and health plans operating in California
 * - Ensures timely access to care
 * - Protects patient rights in managed care settings
 * 
 * KEY REQUIREMENTS FOR YOUR APP:
 * 
 * 1. TIMELY ACCESS TO CARE (28 CCR § 1300.67.2.2):
 *    - Urgent care: within 48 hours
 *    - Non-urgent primary care: within 10 business days
 *    - Non-urgent specialist: within 15 business days
 *    - Non-urgent mental health: within 10 business days
 * 
 * 2. GRIEVANCE AND APPEALS (§ 1368):
 *    - Must provide grievance system
 *    - 30-day resolution requirement
 *    - Independent Medical Review (IMR) access
 * 
 * 3. CONTINUITY OF CARE (§ 1373.96):
 *    - Continue treatment during provider transitions
 *    - Honor existing authorizations
 * 
 * 4. LANGUAGE ASSISTANCE (§ 1367.04):
 *    - Provide interpreter services
 *    - Translated materials for threshold languages
 * 
 * 5. UTILIZATION REVIEW (§ 1367.01):
 *    - Decisions by qualified medical professionals
 *    - Specific timeframes for decisions
 */

// File: src/core/compliance/california/KnoxKeeneCompliance.ts

export class KnoxKeeneCompliance {
  /**
   * Validate appointment scheduling meets Knox-Keene timeframes
   */
  async validateAppointmentCompliance(
    appointmentType: 'urgent' | 'primary' | 'specialist' | 'mental_health',
    requestedDate: Date,
    isHMOPatient: boolean
  ): Promise<ComplianceCheck> {
    if (!isHMOPatient) {
      return { compliant: true, reason: 'Not HMO patient' };
    }

    const maxWaitDays = {
      urgent: 2,
      primary: 10,
      specialist: 15,
      mental_health: 10
    };

    const businessDaysUntil = this.calculateBusinessDays(new Date(), requestedDate);
    
    if (businessDaysUntil > maxWaitDays[appointmentType]) {
      // Must offer alternative
      return {
        compliant: false,
        reason: `Exceeds Knox-Keene ${maxWaitDays[appointmentType]} day requirement`,
        action: 'MUST_OFFER_EARLIER_APPOINTMENT',
        alternativeRequired: true
      };
    }

    return { compliant: true };
  }

  /**
   * Track and ensure grievance resolution timeframes
   */
  async trackGrievance(
    grievanceId: string,
    filedDate: Date,
    patientId: string
  ): Promise<void> {
    const dueDate = this.addBusinessDays(filedDate, 30);
    
    // Set automatic escalation
    await this.scheduleEscalation(grievanceId, dueDate);
    
    // Log for compliance
    await auditLogger.logComplianceEvent('KNOX_KEENE_GRIEVANCE_FILED', {
      grievanceId,
      patientId,
      filedDate,
      dueDate,
      requiresIMRNotice: true
    });
  }

  /**
   * Ensure continuity of care during transitions
   */
  async validateContinuityOfCare(
    patientId: string,
    previousProviderId: string,
    newProviderId: string,
    existingAuthorizations: string[]
  ): Promise<ContinuityResult> {
    // Knox-Keene requires honoring existing authorizations
    const result = await api.post('/api/knox-keene/continuity', {
      patientId,
      previousProviderId,
      newProviderId,
      existingAuthorizations,
      transitionPeriod: 60 // 60 days required
    });

    return {
      authorizationsHonored: result.data.honored,
      transitionPeriodDays: 60,
      requiresNotification: true
    };
  }
}