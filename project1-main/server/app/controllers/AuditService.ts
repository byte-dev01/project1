// ============================================
// 2. SERVER SIDE - Prisma Audit Service
// ============================================
// File: server/services/AuditService.ts

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

export class ServerAuditService {
  /**
   * Receive audit logs from mobile devices
   */
  async receiveBatchFromMobile(batch: MobileAuditEntry[]): Promise<void> {
    // Use transaction for atomic writes
    await prisma.$transaction(async (tx) => {
      for (const entry of batch) {
        // Check if already synced (by clientId)
        const existing = await tx.auditLog.findFirst({
          where: { clientId: entry.clientId }
        });
        
        if (existing) {
          continue; // Skip duplicates
        }
        
        // Verify hash integrity
        if (!this.verifyHash(entry)) {
          // Log tampering attempt
          await this.logTamperingAttempt(entry);
          continue;
        }
        
        // Store in Prisma
        const auditLog = await tx.auditLog.create({
          data: {
            userId: entry.userId,
            userRole: entry.userRole,
            userDepartment: entry.userDepartment,
            action: entry.action,
            resourceType: entry.resourceType,
            resourceId: entry.resourceId,
            patientId: entry.patientId,
            purpose: entry.purpose,
            breakGlassAccess: entry.breakGlassAccess || false,
            minorAccess: entry.minorAccess || false,
            mentalHealthData: entry.mentalHealthData || false,
            substanceAbuseData: entry.substanceAbuseData || false,
            deviceId: entry.deviceId,
            deviceType: entry.deviceType,
            sessionId: entry.sessionId,
            ipAddress: entry.ipAddress,
            authMethod: entry.authMethod,
            metadata: entry.metadata,
            appVersion: entry.appVersion,
            osVersion: entry.osVersion,
            hash: entry.hash,
            previousHash: entry.previousHash,
            clientId: entry.clientId,
            timestamp: new Date(entry.timestamp),
          }
        });
        
        // Check for violations
        await this.detectViolations(auditLog);
      }
    });
  }
  
  /**
   * Detect violations using Prisma queries
   */
  async detectViolations(entry: any): Promise<void> {
    const violations = [];
    
    // Check 1: Excessive access (>100 records in 1 hour)
    const oneHourAgo = new Date(Date.now() - 3600000);
    const recentAccess = await prisma.auditLog.count({
      where: {
        userId: entry.userId,
        timestamp: { gte: oneHourAgo }
      }
    });
    
    if (recentAccess > 100) {
      violations.push({
        type: 'EXCESSIVE_ACCESS',
        severity: 'HIGH',
        details: { count: recentAccess, timeWindow: '1hour' }
      });
    }
    
    // Check 2: After-hours access for non-doctors
    const hour = new Date(entry.timestamp).getHours();
    if (entry.userRole !== 'doctor' && (hour < 6 || hour > 22)) {
      violations.push({
        type: 'AFTER_HOURS',
        severity: 'MEDIUM',
        details: { hour, role: entry.userRole }
      });
    }
    
    // Check 3: Unauthorized resource access by role
    const unauthorizedAccess = this.checkRolePermissions(entry.userRole, entry.resourceType);
    if (unauthorizedAccess) {
      violations.push({
        type: 'UNAUTHORIZED_ACCESS',
        severity: 'CRITICAL',
        details: { role: entry.userRole, resource: entry.resourceType }
      });
    }
    
    // Store violations
    for (const violation of violations) {
      await prisma.auditViolation.create({
        data: {
          auditLogId: entry.id,
          ...violation
        }
      });
      
      // Send alerts for high/critical
      if (['HIGH', 'CRITICAL'].includes(violation.severity)) {
        await this.sendAlert(violation, entry);
      }
    }
  }
  
  /**
   * Generate compliance reports using Prisma
   */
  async generateComplianceReport(startDate: Date, endDate: Date) {
    // Prisma makes complex queries easy!
    
    const [
      totalAccess,
      userActivity,
      patientAccess,
      violations,
      afterHours,
      exports
    ] = await Promise.all([
      // Total access count
      prisma.auditLog.count({
        where: {
          timestamp: { gte: startDate, lte: endDate }
        }
      }),
      
      // Group by user
      prisma.auditLog.groupBy({
        by: ['userId', 'userRole'],
        where: {
          timestamp: { gte: startDate, lte: endDate }
        },
        _count: true,
        orderBy: { _count: { userId: 'desc' } }
      }),
      
      // Most accessed patients
      prisma.auditLog.groupBy({
        by: ['patientId'],
        where: {
          timestamp: { gte: startDate, lte: endDate },
          patientId: { not: null }
        },
        _count: true,
        orderBy: { _count: { patientId: 'desc' } },
        take: 10
      }),
      
      // Violations
      prisma.auditViolation.findMany({
        where: {
          detectedAt: { gte: startDate, lte: endDate }
        },
        include: { auditLog: true }
      }),
      
      // After hours access
      prisma.$queryRaw`
        SELECT COUNT(*) as count, user_role
        FROM audit_log
        WHERE timestamp BETWEEN ${startDate} AND ${endDate}
        AND EXTRACT(HOUR FROM timestamp) NOT BETWEEN 6 AND 22
        GROUP BY user_role
      `,
      
      // Data exports
      prisma.auditLog.findMany({
        where: {
          action: 'EXPORT',
          timestamp: { gte: startDate, lte: endDate }
        }
      })
    ]);
    
    return {
      summary: {
        totalAccess,
        uniqueUsers: userActivity.length,
        violations: violations.length,
        afterHoursAccess: afterHours
      },
      details: {
        userActivity,
        patientAccess,
        violations,
        exports
      }
    };
  }
  
  /**
   * Search audit logs with Prisma's powerful filtering
   */
  async searchAuditLogs(filters: AuditSearchFilters) {
    return await prisma.auditLog.findMany({
      where: {
        userId: filters.userId,
        patientId: filters.patientId,
        action: filters.action,
        resourceType: filters.resourceType,
        timestamp: {
          gte: filters.startDate,
          lte: filters.endDate
        }
      },
      orderBy: { timestamp: 'desc' },
      take: filters.limit || 100,
      include: {
        user: true,
        patient: true
      }
    });
  }
}

