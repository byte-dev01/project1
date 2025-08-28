import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

/**
 * HIPAA-Compliant Prisma Service with Encryption
 * Handles encrypted fields and secure database connections
 */
export class EncryptedPrismaService {
  private prisma: PrismaClient;
  private encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-gcm';
  private ssmClient: SSMClient;
  
  constructor() {
    this.ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'us-west-2' });
    this.initializePrisma();
  }
  
  /**
   * Initialize Prisma with encrypted connection
   */
  private async initializePrisma() {
    // Get encryption key from AWS Parameter Store (or your secret manager)
    this.encryptionKey = await this.getEncryptionKey();
    
    // Initialize Prisma with SSL/TLS connection
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: this.getSecureConnectionString(),
        },
      },
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'error', 'warn'] 
        : ['error'],
    });
    
    // Add middleware for automatic encryption/decryption
    this.addEncryptionMiddleware();
  }
  
  /**
   * Get database connection string with SSL
   */
  private getSecureConnectionString(): string {
    const baseUrl = process.env.DATABASE_URL;
    
    // For PostgreSQL with SSL/TLS
    if (baseUrl?.includes('postgresql')) {
      return `${baseUrl}?sslmode=require&sslcert=/path/to/client-cert.pem&sslkey=/path/to/client-key.pem&sslrootcert=/path/to/ca-cert.pem`;
    }
    
    // For AWS RDS
    if (baseUrl?.includes('rds.amazonaws.com')) {
      return `${baseUrl}?ssl=true&sslmode=require`;
    }
    
    return baseUrl || '';
  }
  
  /**
   * Retrieve encryption key from secure storage
   */
  private async getEncryptionKey(): Promise<Buffer> {
    try {
      // Option 1: AWS Systems Manager Parameter Store
      const command = new GetParameterCommand({
        Name: '/healthbridge/encryption/master-key',
        WithDecryption: true,
      });
      
      const response = await this.ssmClient.send(command);
      const keyString = response.Parameter?.Value;
      
      if (!keyString) {
        throw new Error('Encryption key not found in Parameter Store');
      }
      
      return Buffer.from(keyString, 'base64');
    } catch (error) {
      // Option 2: Environment variable (less secure, OK for development)
      if (process.env.DB_ENCRYPTION_KEY) {
        return Buffer.from(process.env.DB_ENCRYPTION_KEY, 'base64');
      }
      
      throw new Error('No encryption key available');
    }
  }
  
  /**
   * Encrypt sensitive data before storing
   */
  encrypt(text: string): { encrypted: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }
  
  /**
   * Decrypt sensitive data after retrieval
   */
  decrypt(encryptedData: { encrypted: string; iv: string; authTag: string }): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.encryptionKey,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  /**
   * Add Prisma middleware for automatic encryption/decryption
   */
  private addEncryptionMiddleware() {
    // Fields that need encryption
    const encryptedFields = {
      Patient: ['ssn', 'medicalRecordNumber', 'insurance'],
      AuditLog: ['metadata', 'phiAccessed'],
      Prescription: ['medicationDetails', 'sigInstructions'],
      LabResult: ['resultValue', 'clinicalNotes'],
    };
    
    // Encrypt on create/update
    this.prisma.$use(async (params, next) => {
      // Before write operations
      if (params.action === 'create' || params.action === 'update' || params.action === 'createMany') {
        const model = params.model as keyof typeof encryptedFields;
        const fieldsToEncrypt = encryptedFields[model];
        
        if (fieldsToEncrypt && params.args.data) {
          const data = Array.isArray(params.args.data) ? params.args.data : [params.args.data];
          
          for (const record of data) {
            for (const field of fieldsToEncrypt) {
              if (record[field]) {
                // Store encrypted data with metadata
                const encrypted = this.encrypt(
                  typeof record[field] === 'string' 
                    ? record[field] 
                    : JSON.stringify(record[field])
                );
                
                record[field] = JSON.stringify(encrypted);
              }
            }
          }
        }
      }
      
      const result = await next(params);
      
      // After read operations
      if (params.action === 'findUnique' || params.action === 'findFirst' || params.action === 'findMany') {
        const model = params.model as keyof typeof encryptedFields;
        const fieldsToDecrypt = encryptedFields[model];
        
        if (fieldsToDecrypt && result) {
          const records = Array.isArray(result) ? result : [result];
          
          for (const record of records) {
            if (!record) continue;
            
            for (const field of fieldsToDecrypt) {
              if (record[field]) {
                try {
                  const encryptedData = JSON.parse(record[field]);
                  record[field] = this.decrypt(encryptedData);
                  
                  // Parse JSON if it was originally an object
                  try {
                    record[field] = JSON.parse(record[field]);
                  } catch {
                    // Keep as string if not JSON
                  }
                } catch (error) {
                  console.error(`Failed to decrypt ${field}:`, error);
                  record[field] = null; // Safer than exposing encrypted data
                }
              }
            }
          }
        }
      }
      
      return result;
    });
  }
  
  /**
   * Store audit log with encryption
   */
  async createAuditLog(data: any) {
    // Sensitive fields are automatically encrypted by middleware
    return this.prisma.auditLog.create({
      data: {
        ...data,
        // PHI fields will be encrypted automatically
        phiAccessed: data.phiAccessed,
        metadata: data.metadata,
      },
    });
  }
  
  /**
   * Get decrypted patient data
   */
  async getPatient(patientId: string) {
    // Decryption happens automatically via middleware
    return this.prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        prescriptions: true,
        labResults: true,
      },
    });
  }
}
