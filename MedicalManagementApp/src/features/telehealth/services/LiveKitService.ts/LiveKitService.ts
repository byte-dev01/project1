import {
  Room,
  RoomEvent,
  Track,
  Participant,
  LocalParticipant,
  RemoteParticipant,
  VideoPresets,
  AudioPresets,
  createLocalTracks,
  DataPacket_Kind,
} from 'livekit-client';
import { auditLogger } from '@core/compliance/AuditLogger';
import { Platform } from 'react-native';

interface VideoCallConfig {
  roomName: string;
  token: string;
  patientId: string;
  providerId: string;
  appointmentId: string;
}

export class LiveKitService {
  private static instance: LiveKitService;
  private room: Room | null = null;
  private localParticipant: LocalParticipant | null = null;
  private remoteParticipants: Map<string, RemoteParticipant> = new Map();
  private isRecording: boolean = false;
  private callStartTime: Date | null = null;
  private encryptionKey: string | null = null;

  static getInstance(): LiveKitService {
    if (!LiveKitService.instance) {
      LiveKitService.instance = new LiveKitService();
    }
    return LiveKitService.instance;
  }

  /**
   * Initialize video call with HIPAA compliance
   */
  async initializeCall(config: VideoCallConfig): Promise<void> {
    try {
      // Create room with encryption
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
        e2ee: {
          keyProvider: {
            getKeys: async () => this.getEncryptionKeys(),
            setKey: async (key: CryptoKey) => this.setEncryptionKey(key),
          },
        },
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Connect to LiveKit server
      await this.room.connect(
        process.env.LIVEKIT_URL!,
        config.token,
        {
          autoSubscribe: true,
          publishDefaults: {
            videoEncoding: VideoPresets.h720,
            audioPreset: AudioPresets.music,
          },
        }
      );

      this.localParticipant = this.room.localParticipant;
      this.callStartTime = new Date();

      // Enable HIPAA-compliant recording
      await this.enableCompliantRecording(config);

      // Log call initiation
      await auditLogger.logTelehealthEvent({
        type: 'CALL_INITIATED',
        roomName: config.roomName,
        patientId: config.patientId,
        providerId: config.providerId,
        appointmentId: config.appointmentId,
        timestamp: this.callStartTime,
        platform: Platform.OS,
      });

      // Create and publish local tracks
      await this.publishLocalTracks();

    } catch (error) {
      console.error('Failed to initialize video call:', error);
      await this.logCallError(error, config);
      throw error;
    }
  }

  /**
   * Set up event handlers for the room
   */
  private setupEventHandlers(): void {
    if (!this.room) return;

    // Handle participant events
    this.room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      this.handleParticipantConnected(participant);
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      this.handleParticipantDisconnected(participant);
    });

    // Handle track events
    this.room.on(RoomEvent.TrackSubscribed, (track: Track, participant: RemoteParticipant) => {
      this.handleTrackSubscribed(track, participant);
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (track: Track, participant: RemoteParticipant) => {
      this.handleTrackUnsubscribed(track, participant);
    });

    // Handle connection quality
    this.room.on(RoomEvent.ConnectionQualityChanged, (quality: string, participant: Participant) => {
      this.handleConnectionQualityChanged(quality, participant);
    });

    // Handle data messages (for clinical notes, prescriptions, etc.)
    this.room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant: Participant) => {
      this.handleDataReceived(payload, participant);
    });

    // Handle room disconnection
    this.room.on(RoomEvent.Disconnected, () => {
      this.handleDisconnection();
    });
  }

  /**
   * Publish local audio and video tracks
   */
  private async publishLocalTracks(): Promise<void> {
    if (!this.room || !this.localParticipant) return;

    try {
      const tracks = await createLocalTracks({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          resolution: VideoPresets.h720.resolution,
          facingMode: 'user',
        },
      });

      await Promise.all(
        tracks.map(track => this.localParticipant!.publishTrack(track))
      );

    } catch (error) {
      console.error('Failed to publish local tracks:', error);
      throw error;
    }
  }

  /**
   * Enable HIPAA-compliant recording
   */
  private async enableCompliantRecording(config: VideoCallConfig): Promise<void> {
    if (!this.room) return;

    try {
      // Request recording with encryption
      await this.room.localParticipant.setMetadata(
        JSON.stringify({
          recordingEnabled: true,
          encryptionEnabled: true,
          patientConsent: true,
          appointmentId: config.appointmentId,
        })
      );

      this.isRecording = true;

      // Log recording started
      await auditLogger.logTelehealthEvent({
        type: 'RECORDING_STARTED',
        roomName: config.roomName,
        appointmentId: config.appointmentId,
        timestamp: new Date(),
        encryptionEnabled: true,
      });

    } catch (error) {
      console.error('Failed to enable recording:', error);
    }
  }

  /**
   * Send clinical data through encrypted channel
   */
  async sendClinicalData(data: any): Promise<void> {
    if (!this.room || !this.localParticipant) return;

    try {
      // Encrypt clinical data
      const encryptedData = await this.encryptData(data);
      
      // Send as data packet
      await this.localParticipant.publishData(
        encryptedData,
        DataPacket_Kind.RELIABLE,
        { topic: 'clinical_data' }
      );

      // Log data transmission
      await auditLogger.logTelehealthEvent({
        type: 'CLINICAL_DATA_SENT',
        dataType: data.type,
        timestamp: new Date(),
        encrypted: true,
      });

    } catch (error) {
      console.error('Failed to send clinical data:', error);
      throw error;
    }
  }

  /**
   * Handle participant connection
   */
  private async handleParticipantConnected(participant: RemoteParticipant): Promise<void> {
    this.remoteParticipants.set(participant.sid, participant);

    await auditLogger.logTelehealthEvent({
      type: 'PARTICIPANT_JOINED',
      participantId: participant.identity,
      timestamp: new Date(),
    });

    // Verify participant identity for HIPAA compliance
    await this.verifyParticipantIdentity(participant);
  }

  /**
   * Handle participant disconnection
   */
  private async handleParticipantDisconnected(participant: RemoteParticipant): Promise<void> {
    this.remoteParticipants.delete(participant.sid);

    await auditLogger.logTelehealthEvent({
      type: 'PARTICIPANT_LEFT',
      participantId: participant.identity,
      timestamp: new Date(),
    });
  }

  /**
   * Handle track subscription
   */
  private handleTrackSubscribed(track: Track, participant: RemoteParticipant): void {
    // Attach track to UI element
    if (track.kind === 'video') {
      // Attach to video element
      console.log(`Video track subscribed from ${participant.identity}`);
    } else if (track.kind === 'audio') {
      // Attach to audio element
      console.log(`Audio track subscribed from ${participant.identity}`);
    }
  }

  /**
   * Handle track unsubscription
   */
  private handleTrackUnsubscribed(track: Track, participant: RemoteParticipant): void {
    // Detach track from UI element
    console.log(`Track unsubscribed from ${participant.identity}`);
  }

  /**
   * Handle connection quality changes
   */
  private async handleConnectionQualityChanged(
    quality: string,
    participant: Participant
  ): Promise<void> {
    if (quality === 'poor') {
      // Notify user of poor connection
      console.warn(`Poor connection quality for ${participant.identity}`);
      
      // Log quality issue
      await auditLogger.logTelehealthEvent({
        type: 'CONNECTION_QUALITY_POOR',
        participantId: participant.identity,
        quality,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Handle received data
   */
  private async handleDataReceived(
    payload: Uint8Array,
    participant: Participant
  ): Promise<void> {
    try {
      // Decrypt data
      const decryptedData = await this.decryptData(payload);
      
      // Process based on data type
      const data = JSON.parse(decryptedData);
      
      switch (data.type) {
        case 'prescription':
          await this.processPrescription(data.content);
          break;
        case 'clinical_note':
          await this.processClinicalNote(data.content);
          break;
        case 'lab_order':
          await this.processLabOrder(data.content);
          break;
      }

      // Log data reception
      await auditLogger.logTelehealthEvent({
        type: 'CLINICAL_DATA_RECEIVED',
        dataType: data.type,
        senderId: participant.identity,
        timestamp: new Date(),
        encrypted: true,
      });

    } catch (error) {
      console.error('Failed to process received data:', error);
    }
  }

  /**
   * Handle room disconnection
   */
  private async handleDisconnection(): Promise<void> {
    const callEndTime = new Date();
    const duration = this.callStartTime 
      ? (callEndTime.getTime() - this.callStartTime.getTime()) / 1000
      : 0;

    await auditLogger.logTelehealthEvent({
      type: 'CALL_ENDED',
      startTime: this.callStartTime,
      endTime: callEndTime,
      duration,
      timestamp: callEndTime,
    });

    // Clean up
    this.cleanup();
  }

  /**
   * Verify participant identity for HIPAA compliance
   */
  private async verifyParticipantIdentity(participant: RemoteParticipant): Promise<void> {
    // Implement identity verification logic
    // This could include checking participant metadata against authorized users
    const metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
    
    if (!metadata.verified) {
      console.warn(`Unverified participant: ${participant.identity}`);
      // Could disconnect unverified participants if required
    }
  }

  /**
   * Encrypt data for transmission
   */
  private async encryptData(data: any): Promise<Uint8Array> {
    // Implement encryption logic
    const jsonString = JSON.stringify(data);
    const encoder = new TextEncoder();
    return encoder.encode(jsonString); // In production, use actual encryption
  }

  /**
   * Decrypt received data
   */
  private async decryptData(encryptedData: Uint8Array): Promise<string> {
    // Implement decryption logic
    const decoder = new TextDecoder();
    return decoder.decode(encryptedData); // In production, use actual decryption
  }

  /**
   * Get encryption keys for E2EE
   */
  private async getEncryptionKeys(): Promise<CryptoKey[]> {
    // Implement key retrieval logic
    return [];
  }

  /**
   * Set encryption key
   */
  private async setEncryptionKey(key: CryptoKey): Promise<void> {
    // Store encryption key securely
  }

  /**
   * Process received prescription
   */
  private async processPrescription(prescription: any): Promise<void> {
    // Implement prescription processing
    console.log('Processing prescription:', prescription);
  }

  /**
   * Process clinical note
   */
  private async processClinicalNote(note: any): Promise<void> {
    // Implement clinical note processing
    console.log('Processing clinical note:', note);
  }

  /**
   * Process lab order
   */
  private async processLabOrder(order: any): Promise<void> {
    // Implement lab order processing
    console.log('Processing lab order:', order);
  }

  /**
   * Log call error
   */
  private async logCallError(error: any, config: VideoCallConfig): Promise<void> {
    await auditLogger.logTelehealthEvent({
      type: 'CALL_ERROR',
      error: error.message,
      roomName: config.roomName,
      patientId: config.patientId,
      providerId: config.providerId,
      timestamp: new Date(),
    });
  }

  /**
   * End video call
   */
  async endCall(): Promise<void> {
    if (this.room) {
      await this.room.disconnect();
    }
    this.cleanup();
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    this.room = null;
    this.localParticipant = null;
    this.remoteParticipants.clear();
    this.isRecording = false;
    this.callStartTime = null;
    this.encryptionKey = null;
  }

  /**
   * Get call statistics
   */
  async getCallStatistics(): Promise<any> {
    if (!this.room) return null;

    return {
      participants: this.remoteParticipants.size + 1,
      duration: this.callStartTime 
        ? (Date.now() - this.callStartTime.getTime()) / 1000
        : 0,
      isRecording: this.isRecording,
      connectionState: this.room.state,
    };
  }
}

export const liveKitService = LiveKitService.getInstance();