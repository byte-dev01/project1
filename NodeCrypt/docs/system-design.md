# System Design Document
## HIPAA Medical Chat with Queue Management
### Object Model and Architecture Design

---

## 1. System Architecture Overview

```plantuml
@startuml
!define RECTANGLE class

package "Client Layer" {
  RECTANGLE HIPAAMedicalChatWithQueue {
    - queueManager: SecureQueueManager
    - signalManager: SignalProtocolManager
    - webRTCManager: WebRTCManager
    - hipaaMiddleware: HIPAAMiddleware
    + initialize(): Promise<void>
    + startConsultationWithQueue(): Promise<Result>
    + addPatientToQueue(): Promise<QueueEntry>
    + getDoctorQueueView(): Promise<QueueView>
  }
}

package "Security Layer" {
  RECTANGLE SignalProtocolManager {
    - identityKeyPair: KeyPair
    - preKeys: PreKey[]
    - signedPreKey: SignedPreKey
    + encryptMessage(): Promise<CipherText>
    + decryptMessage(): Promise<PlainText>
    + establishSession(): Promise<Session>
  }
  
  RECTANGLE HIPAAMiddleware {
    - auditLogger: AuditLogger
    - accessControl: AccessControl
    + verifyAccess(): Promise<AccessResult>
    + logEvent(): Promise<void>
    + sanitizePHI(): string
  }
}

package "Queue Management" {
  RECTANGLE SecureQueueManager {
    - queues: Map<DoctorId, Queue>
    - encryptionManager: EncryptionManager
    + addPatient(): Promise<QueueEntry>
    + removePatient(): Promise<boolean>
    + updatePriority(): Promise<void>
    + getQueueView(): Promise<QueueView>
  }
  
  RECTANGLE QueueEntry {
    - patientId: string
    - doctorId: string
    - priority: Priority
    - joinTime: timestamp
    - estimatedWaitTime: number
    + encrypt(): EncryptedEntry
    + getPosition(): number
  }
}

package "Communication Layer" {
  RECTANGLE WebRTCManager {
    - peerConnection: RTCPeerConnection
    - localStream: MediaStream
    - remoteStream: MediaStream
    + createOffer(): Promise<RTCSessionDescription>
    + handleAnswer(): Promise<void>
    + addIceCandidate(): Promise<void>
  }
  
  RECTANGLE WebSocketManager {
    - connection: WebSocket
    - subscriptions: Set<string>
    + connect(): Promise<void>
    + subscribe(): void
    + sendMessage(): void
    + handleMessage(): void
  }
}

package "Server Layer" {
  RECTANGLE HIPAAQueueServer {
    - queueClients: Map<ClientId, Client>
    - doctorQueues: Map<DoctorId, Queue>
    - persistence: QueuePersistence
    + handleQueueMessage(): Promise<void>
    + broadcastQueueUpdate(): Promise<void>
    + handleEmergencyAlert(): Promise<void>
  }
  
  RECTANGLE QueuePersistence {
    - mongoClient: MongoClient
    - encryptionKey: Buffer
    + saveQueue(): Promise<void>
    + loadQueue(): Promise<Queue>
    + saveAuditEntry(): Promise<void>
  }
}

HIPAAMedicalChatWithQueue --> SecureQueueManager
HIPAAMedicalChatWithQueue --> SignalProtocolManager
HIPAAMedicalChatWithQueue --> WebRTCManager
HIPAAMedicalChatWithQueue --> HIPAAMiddleware
SecureQueueManager --> QueueEntry
HIPAAMedicalChatWithQueue --> WebSocketManager
WebSocketManager --> HIPAAQueueServer
HIPAAQueueServer --> QueuePersistence

@enduml
```

## 2. Class Diagrams

### 2.1 Core Medical Chat System

```plantuml
@startuml
class HIPAAMedicalChat {
  - config: ChatConfig
  - signalManager: SignalProtocolManager
  - webRTCManager: WebRTCManager
  - hipaaMiddleware: HIPAAMiddleware
  - messageStore: EncryptedMessageStore
  - currentSession: Session
  
  + initialize(): Promise<void>
  + startConsultation(patientId: string, type: string): Promise<Result>
  + sendMedicalMessage(recipient: string, content: string): Promise<void>
  + startSecureCall(patientId: string): Promise<void>
  + endConsultation(): Promise<void>
  + getSystemStatus(): SystemStatus
  + cleanup(): Promise<void>
}

class SignalProtocolManager {
  - store: SignalProtocolStore
  - identityKeyPair: KeyPair
  - registrationId: number
  - deviceId: number
  
  + generateIdentityKeyPair(): KeyPair
  + generatePreKeys(count: number): PreKey[]
  + generateSignedPreKey(): SignedPreKey
  + processPreKeyBundle(bundle: PreKeyBundle): Promise<void>
  + encryptMessage(recipient: string, message: string): Promise<CipherText>
  + decryptMessage(sender: string, cipherText: CipherText): Promise<string>
}

class WebRTCManager {
  - configuration: RTCConfiguration
  - peerConnection: RTCPeerConnection
  - localStream: MediaStream
  - remoteStream: MediaStream
  - dataChannel: RTCDataChannel
  
  + initializePeerConnection(): void
  + createEncryptedOffer(): Promise<EncryptedSDP>
  + handleEncryptedAnswer(answer: EncryptedSDP): Promise<void>
  + addIceCandidate(candidate: RTCIceCandidate): Promise<void>
  + startVideoCall(): Promise<void>
  + endCall(): void
}

class HIPAAMiddleware {
  - auditLogger: AuditLogger
  - accessControl: AccessControl
  - encryptionManager: EncryptionManager
  
  + verifyAccess(resource: string, action: string): Promise<AccessResult>
  + logAuditEvent(event: AuditEvent): Promise<void>
  + sanitizePHI(data: any): any
  + encryptPHI(data: string): Promise<EncryptedData>
  + decryptPHI(encrypted: EncryptedData): Promise<string>
}

HIPAAMedicalChat --> SignalProtocolManager
HIPAAMedicalChat --> WebRTCManager
HIPAAMedicalChat --> HIPAAMiddleware

@enduml
```

### 2.2 Queue Management System

```plantuml
@startuml
class SecureQueueManager {
  - userId: string
  - userRole: UserRole
  - queues: Map<string, DoctorQueue>
  - encryptionManager: EncryptionManager
  - webSocketConnection: WebSocket
  
  + initialize(): Promise<void>
  + addPatient(patientId: string, doctorId: string, type: string, priority: Priority): Promise<QueueResult>
  + removePatient(patientId: string, doctorId: string): Promise<boolean>
  + updatePatientPriority(patientId: string, doctorId: string, priority: Priority): Promise<void>
  + getDoctorQueueView(doctorId: string): Promise<DoctorQueueView>
  + getPatientQueueView(patientId: string, doctorId: string): Promise<PatientQueueView>
  + getAdminQueueOverview(): Promise<AdminOverview>
  + cleanup(): Promise<void>
}

class DoctorQueue {
  - doctorId: string
  - regularQueue: PatientEntry[]
  - priorityQueue: PatientEntry[]
  - metadata: QueueMetadata
  
  + addPatient(entry: PatientEntry): void
  + removePatient(patientId: string): boolean
  + getPosition(patientId: string): number
  + getTotalPatients(): number
  + reorderByPriority(): void
}

class PatientEntry {
  - patientId: string
  - doctorId: string
  - appointmentType: AppointmentType
  - priority: Priority
  - joinTime: Date
  - status: QueueStatus
  - estimatedWaitTime: number
  
  + encrypt(): EncryptedEntry
  + updateWaitTime(time: number): void
  + escalatePriority(): void
}

enum Priority {
  NORMAL
  HIGH
  EMERGENCY
}

enum QueueStatus {
  WAITING
  CALLED
  IN_CONSULTATION
  COMPLETED
  NO_SHOW
}

interface QueueView {
  + position: number
  + estimatedWaitTime: number
  + lastUpdated: Date
}

class DoctorQueueView implements QueueView {
  + totalPatients: number
  + priorityPatients: number
  + regularPatients: number
  + queue: EncryptedPatientInfo[]
}

class PatientQueueView implements QueueView {
  + inQueue: boolean
  + message: string
}

SecureQueueManager --> DoctorQueue
DoctorQueue --> PatientEntry
SecureQueueManager --> QueueView
DoctorQueueView --|> QueueView
PatientQueueView --|> QueueView

@enduml
```

## 3. Sequence Diagrams

### 3.1 Patient Queue Entry and Consultation Flow

```plantuml
@startuml
actor Patient
participant "HIPAAMedicalChat\nWithQueue" as Client
participant "SecureQueue\nManager" as QueueMgr
participant "WebSocket\nServer" as WSServer
participant "Queue\nPersistence" as DB
participant "Signal\nProtocol" as Signal
participant Doctor

Patient -> Client: Request Consultation
Client -> QueueMgr: addPatient(patientId, doctorId)

QueueMgr -> QueueMgr: Encrypt patient data
QueueMgr -> WSServer: ADD_PATIENT_TO_QUEUE

WSServer -> DB: saveQueue(encryptedData)
DB --> WSServer: saved

WSServer -> WSServer: Calculate position
WSServer --> QueueMgr: QueueResult{position: 3}

QueueMgr --> Client: Queue position #3
Client --> Patient: "You are #3 in line\nEstimated wait: 45 min"

note over WSServer: Real-time updates
loop Every 5 seconds
    WSServer -> Doctor: QUEUE_UPDATE
    WSServer -> Patient: POSITION_UPDATE
end

note over Doctor: When ready for next patient
Doctor -> Client: callNextPatient()
Client -> QueueMgr: removePatient(nextPatientId)
QueueMgr -> WSServer: REMOVE_PATIENT

WSServer -> WSServer: Update queue positions
WSServer -> Patient: POSITION_CHANGED{position: 1}
Patient --> Client: Acknowledge

note over Patient, Doctor: Start secure consultation
Client -> Signal: establishSession(doctorId)
Signal -> Signal: Generate session keys
Signal --> Client: Session established

Client -> Client: startVideoCall()
Client -> Doctor: Encrypted video stream
Doctor -> Patient: Encrypted video stream

@enduml
```

### 3.2 Emergency Priority Escalation

```plantuml
@startuml
actor Nurse
participant "Admin\nInterface" as Admin
participant "Queue\nManager" as QueueMgr
participant "WebSocket\nServer" as WSServer
participant Doctor
participant "Other\nPatients" as Others

Nurse -> Admin: Identify emergency case
Admin -> QueueMgr: updatePatientPriority(\n  patientId,\n  "emergency")

QueueMgr -> WSServer: UPDATE_PRIORITY
WSServer -> WSServer: Reorder queue
note right: Emergency patient\nmoves to position 1

WSServer -> Doctor: EMERGENCY_ALERT
Doctor --> Doctor: Visual/audio alert

WSServer -> Others: POSITION_CHANGED
note right: All patients\nmove back one position

WSServer -> QueueMgr: Priority updated
QueueMgr -> Admin: Success

Admin -> Admin: Log audit event
note right: "Emergency escalation\nfor patient [encrypted_id]\nat timestamp"

@enduml
```

### 3.3 Message Encryption Flow

```plantuml
@startuml
actor Patient
participant "Client\nApp" as Client
participant "Signal\nProtocol" as Signal
participant "WebSocket" as WS
participant Server
participant "Signal\nProtocol" as DoctorSignal
participant Doctor

Patient -> Client: Type message
Client -> Signal: encryptMessage(content, doctorId)

Signal -> Signal: Get/Create session
Signal -> Signal: Generate message keys
Signal -> Signal: Encrypt with AES-256-GCM
Signal --> Client: CipherText

Client -> WS: Send encrypted message
WS -> Server: Relay encrypted message
note over Server: Zero knowledge\nCannot decrypt

Server -> WS: Forward to doctor
WS -> DoctorSignal: Encrypted message

DoctorSignal -> DoctorSignal: Decrypt with session key
DoctorSignal -> DoctorSignal: Verify message integrity
DoctorSignal --> Doctor: Plain text message

Doctor --> Patient: Read receipt (encrypted)

@enduml
```

## 4. State Diagrams

### 4.1 Patient Queue State Machine

```plantuml
@startuml
[*] --> NotInQueue

NotInQueue --> Joining : Request consultation
Joining --> Waiting : Added to queue
Waiting --> Waiting : Position update

Waiting --> Called : Doctor calls next
Waiting --> Removed : Patient cancels
Waiting --> Emergency : Priority escalated

Emergency --> Called : Immediate call
Called --> InConsultation : Patient accepts
Called --> NoShow : Timeout (5 min)

InConsultation --> Completed : Consultation ends
NoShow --> Removed : Marked as no-show
Completed --> NotInQueue : Return to start
Removed --> NotInQueue : Exit queue

Waiting : position = N
Waiting : estimatedWait = time
Emergency : position = 1
Emergency : alert sent
Called : notification sent
InConsultation : video/chat active

@enduml
```

### 4.2 WebRTC Connection Lifecycle

```plantuml
@startuml
[*] --> Idle

Idle --> Initializing : Start call
Initializing --> CreatingOffer : Initialize peer connection
CreatingOffer --> OfferSent : Create and encrypt offer

OfferSent --> WaitingAnswer : Send via signaling
WaitingAnswer --> ProcessingAnswer : Receive answer
ProcessingAnswer --> Connecting : Set remote description

Connecting --> Connected : ICE candidates exchanged
Connected --> Active : DTLS handshake complete

Active --> Active : Media streaming
Active --> Reconnecting : Connection lost
Reconnecting --> Active : Connection restored
Reconnecting --> Failed : Timeout

Active --> Closing : End call
Connected --> Failed : Connection timeout
Failed --> Idle : Reset
Closing --> Idle : Cleanup complete

Active : Encrypted media flow
Active : Data channel open
Reconnecting : Attempting recovery
Failed : Error state

@enduml
```

### 4.3 Message Encryption State

```plantuml
@startuml
[*] --> Unencrypted

Unencrypted --> GeneratingKeys : Initialize Signal
GeneratingKeys --> KeysReady : Keys generated

KeysReady --> EstablishingSession : Contact initiated
EstablishingSession --> SessionActive : PreKey exchange

SessionActive --> Encrypting : Send message
Encrypting --> Encrypted : AES-256-GCM
Encrypted --> Sending : Add metadata

Sending --> Sent : Via WebSocket
Sent --> SessionActive : Ready for next

SessionActive --> Decrypting : Receive message
Decrypting --> Decrypted : Verify and decrypt
Decrypted --> SessionActive : Display to user

SessionActive --> RotatingKeys : Periodic rotation
RotatingKeys --> SessionActive : New keys active

SessionActive --> SessionClosed : End conversation
SessionClosed --> [*]

SessionActive : E2E encrypted
SessionActive : Forward secrecy
RotatingKeys : Perfect forward secrecy

@enduml
```

## 5. Data Flow Diagrams

### 5.1 Level 0 - System Context

```plantuml
@startuml
!define RECTANGLE class

RECTANGLE Patient {
}

RECTANGLE Doctor {
}

RECTANGLE "HIPAA Medical\nChat System" as System {
}

RECTANGLE "Audit Log\nStorage" as Audit {
}

RECTANGLE Administrator {
}

Patient --> System : Request consultation
System --> Patient : Queue position\nVideo/chat session

Doctor --> System : Manage queue\nConduct consultation
System --> Doctor : Patient queue\nEncrypted communication

System --> Audit : HIPAA-compliant logs

Administrator --> System : Monitor system
System --> Administrator : Performance metrics

@enduml
```

### 5.2 Level 1 - Major Processes

```plantuml
@startuml
!define RECTANGLE class

RECTANGLE "1.0\nAuthentication\nProcess" as Auth {
}

RECTANGLE "2.0\nQueue\nManagement" as Queue {
}

RECTANGLE "3.0\nEncryption\nProcess" as Encrypt {
}

RECTANGLE "4.0\nCommunication\nProcess" as Comm {
}

RECTANGLE "5.0\nAudit\nProcess" as Audit {
}

RECTANGLE "User\nDatabase" as UserDB {
}

RECTANGLE "Queue\nDatabase" as QueueDB {
}

RECTANGLE "Audit\nDatabase" as AuditDB {
}

actor User

User --> Auth : Credentials
Auth --> UserDB : Verify
UserDB --> Auth : User info
Auth --> Queue : Authorized user

User --> Queue : Queue request
Queue --> QueueDB : Update queue
QueueDB --> Queue : Queue state
Queue --> User : Position update

Queue --> Encrypt : Patient data
Encrypt --> Comm : Encrypted data

User --> Comm : Messages/Video
Comm --> Encrypt : Encrypt/Decrypt
Encrypt --> Comm : Processed data
Comm --> User : Secure communication

Auth --> Audit : Access logs
Queue --> Audit : Queue events
Comm --> Audit : Communication logs
Audit --> AuditDB : Store logs

@enduml
```

## 6. Database Schema

### 6.1 MongoDB Collections

```javascript
// Users Collection
{
  _id: ObjectId,
  userId: String (encrypted),
  role: "doctor" | "patient" | "admin",
  publicKey: String,
  identityKey: String,
  registrationId: Number,
  createdAt: Date,
  lastActive: Date
}

// Queues Collection
{
  _id: ObjectId,
  doctorId: String (encrypted),
  queue: {
    priority: [
      {
        patientId: String (encrypted),
        appointmentType: String,
        priority: "emergency",
        joinTime: Date,
        estimatedWaitTime: Number
      }
    ],
    regular: [
      {
        patientId: String (encrypted),
        appointmentType: String,
        priority: "normal" | "high",
        joinTime: Date,
        estimatedWaitTime: Number
      }
    ]
  },
  metadata: {
    created: Date,
    lastUpdated: Date,
    totalServed: Number
  }
}

// Messages Collection (Encrypted)
{
  _id: ObjectId,
  conversationId: String,
  senderId: String (hashed),
  recipientId: String (hashed),
  encryptedContent: Binary,
  messageType: "text" | "file" | "system",
  timestamp: Date,
  delivered: Boolean,
  read: Boolean
}

// Audit Logs Collection
{
  _id: ObjectId,
  eventType: String,
  userId: String (hashed),
  action: String,
  resource: String,
  timestamp: Date,
  metadata: {
    // No PHI stored here
    userRole: String,
    ipAddress: String (hashed),
    sessionId: String
  }
}

// Sessions Collection
{
  _id: ObjectId,
  sessionId: String,
  participants: [String], // Hashed IDs
  sessionType: "consultation" | "emergency",
  startTime: Date,
  endTime: Date,
  encryptedMetadata: Binary
}
```

## 7. Security Architecture

### 7.1 Encryption Layers

```plantuml
@startuml
!define RECTANGLE class

package "Application Layer" {
  RECTANGLE "UI Components" as UI {
    Patient Interface
    Doctor Interface
    Admin Dashboard
  }
}

package "Encryption Layer 1: E2E Messaging" {
  RECTANGLE "Signal Protocol" as Signal {
    X3DH Key Agreement
    Double Ratchet Algorithm
    AES-256-GCM Encryption
  }
}

package "Encryption Layer 2: WebRTC" {
  RECTANGLE "DTLS-SRTP" as DTLS {
    Media Encryption
    Signaling Encryption
    ICE Candidate Protection
  }
}

package "Encryption Layer 3: Transport" {
  RECTANGLE "TLS 1.3" as TLS {
    HTTPS
    WSS (Secure WebSocket)
    Certificate Pinning
  }
}

package "Encryption Layer 4: Storage" {
  RECTANGLE "Database Encryption" as DBEnc {
    MongoDB Encryption at Rest
    Field-Level Encryption
    Key Management Service
  }
}

UI --> Signal : Messages
UI --> DTLS : Video/Audio
Signal --> TLS : Encrypted payload
DTLS --> TLS : Encrypted streams
TLS --> DBEnc : Persist encrypted

@enduml
```

### 7.2 Zero-Knowledge Architecture

```plantuml
@startuml
actor Patient
actor Doctor
participant "Client A\n(Patient)" as ClientA
participant "Client B\n(Doctor)" as ClientB
participant "Server\n(Zero Knowledge)" as Server
database "Encrypted\nStorage" as DB

note over Server: Server cannot decrypt any data

Patient -> ClientA: Input message
ClientA -> ClientA: Encrypt locally\n(Signal Protocol)
ClientA -> Server: Encrypted message
Server -> DB: Store encrypted blob
Server -> ClientB: Relay encrypted message
ClientB -> ClientB: Decrypt locally\n(Signal Protocol)
ClientB -> Doctor: Display message

note over Server: Server only sees:\n- Encrypted data\n- Metadata (timestamps)\n- Hashed user IDs

Doctor -> ClientB: Input response
ClientB -> ClientB: Encrypt locally
ClientB -> Server: Encrypted response
Server -> ClientA: Relay encrypted
ClientA -> ClientA: Decrypt locally
ClientA -> Patient: Display response

@enduml
```

## 8. Deployment Architecture

```plantuml
@startuml
!define RECTANGLE class

cloud "AWS Cloud" {
  package "Public Subnet" {
    RECTANGLE "Application\nLoad Balancer" as ALB {
    }
    
    RECTANGLE "CloudFront\nCDN" as CDN {
    }
  }
  
  package "Private Subnet 1" {
    RECTANGLE "Node.js\nApp Server 1" as App1 {
      Medical Chat App
      Queue Manager
    }
    
    RECTANGLE "WebSocket\nServer 1" as WS1 {
      Queue Updates
      Real-time Messages
    }
  }
  
  package "Private Subnet 2" {
    RECTANGLE "Node.js\nApp Server 2" as App2 {
      Medical Chat App
      Queue Manager
    }
    
    RECTANGLE "WebSocket\nServer 2" as WS2 {
      Queue Updates
      Real-time Messages
    }
  }
  
  package "Data Subnet" {
    database "MongoDB\nReplica Set" as Mongo {
      Primary
      Secondary 1
      Secondary 2
    }
    
    RECTANGLE "Redis\nCluster" as Redis {
      Session Store
      Queue Cache
    }
  }
  
  package "Management" {
    RECTANGLE "Monitoring\n(CloudWatch)" as Monitor {
    }
    
    RECTANGLE "Audit Logs\n(S3)" as Logs {
    }
  }
}

actor Users

Users --> CDN : HTTPS
CDN --> ALB : Cached/Dynamic
ALB --> App1 : Load balanced
ALB --> App2 : Load balanced
App1 --> Mongo : Encrypted data
App2 --> Mongo : Encrypted data
App1 --> Redis : Sessions
App2 --> Redis : Sessions
WS1 --> Redis : Pub/Sub
WS2 --> Redis : Pub/Sub

App1 --> Monitor : Metrics
App2 --> Monitor : Metrics
App1 --> Logs : Audit events
App2 --> Logs : Audit events

@enduml
```

## 9. Performance Considerations

### 9.1 Scalability Metrics
- **Horizontal Scaling**: Add app servers for every 1000 concurrent users
- **Database Sharding**: Shard by doctor ID for queues, by conversation ID for messages
- **Cache Strategy**: Redis for session data, queue positions, recent messages
- **CDN Usage**: Static assets, client-side JavaScript libraries

### 9.2 Optimization Strategies
1. **Message Batching**: Combine multiple queue updates in single WebSocket frame
2. **Connection Pooling**: Maintain persistent database connections
3. **Lazy Loading**: Load patient history on-demand
4. **Compression**: Enable gzip for all HTTP responses
5. **Index Optimization**: MongoDB indexes on frequently queried fields

## 10. Monitoring and Observability

### 10.1 Key Performance Indicators (KPIs)
- Queue update latency (target: <100ms)
- WebSocket connection stability (target: >99.9%)
- Message encryption time (target: <50ms)
- Video call setup time (target: <5 seconds)
- Database query time (target: <20ms)

### 10.2 Monitoring Stack
```
Application Metrics -> Prometheus -> Grafana Dashboard
Logs -> ELK Stack (Elasticsearch, Logstash, Kibana)
Traces -> Jaeger for distributed tracing
Alerts -> PagerDuty integration
```

---

*This design document provides the complete technical architecture for the HIPAA-compliant medical chat system with queue management.*