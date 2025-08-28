
import { API_ENDPOINTS } from './endpoints';
import { apiClient } from './ApiClient';
import { Message, MessageThread } from '../../types/models.types';
import { PaginatedResponse } from '../../types/api.types';

interface SendMessageData {
  recipient: string;
  subject: string;
  content: string;
  messageType: string;
  urgent?: boolean;
  attachments?: string[];
}

interface VideoCallData {
  recipientId: string;
  roomId?: string;
  scheduledTime?: Date;
}

interface VideoCallResponse {
  callId: string;
  roomId: string;
  token: string;
  url: string;
  expiresAt: Date;
}

class MessagesAPI {
  async getMessages(
    folder: string = 'inbox',
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<Message>> {
    const response = await apiClient.get<PaginatedResponse<Message>>(
      API_ENDPOINTS.MESSAGES.LIST,
      { params: { folder, page, limit } }
    );
    return response.data;
  }

  async getMessage(messageId: string): Promise<Message> {
    const response = await apiClient.get<Message>(
      API_ENDPOINTS.MESSAGES.DETAIL(messageId)
    );
    return response.data;
  }

  async sendMessage(data: SendMessageData): Promise<Message> {
    // Simple online-only message sending
    const response = await apiClient.post<Message>(
      API_ENDPOINTS.MESSAGES.SEND,
      data
    );
    return response.data;
  }

  async markAsRead(messageId: string): Promise<void> {
    await apiClient.put(API_ENDPOINTS.MESSAGES.MARK_READ(messageId));
  }

  async deleteMessage(messageId: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.MESSAGES.DETAIL(messageId));
  }

  async archiveMessage(messageId: string): Promise<void> {
    await apiClient.put(`/api/messages/${messageId}/archive`);
  }

  async getMessageThread(threadId: string): Promise<MessageThread> {
    const response = await apiClient.get<MessageThread>(
      `/api/messages/threads/${threadId}`
    );
    return response.data;
  }

  async searchMessages(query: string, filters?: {
    folder?: string;
    dateFrom?: string;
    dateTo?: string;
    sender?: string;
  }): Promise<Message[]> {
    const response = await apiClient.get<Message[]>(
      '/api/messages/search',
      { params: { q: query, ...filters } }
    );
    return response.data;
  }

  async getDrafts(): Promise<Message[]> {
    const response = await apiClient.get<Message[]>(
      API_ENDPOINTS.MESSAGES.LIST,
      { params: { folder: 'drafts' } }
    );
    return response.data;
  }

  // Video Calling Methods
  async initiateVideoCall(data: VideoCallData): Promise<VideoCallResponse> {
    const response = await apiClient.post<VideoCallResponse>(
      '/api/video/initiate',
      data
    );
    return response.data;
  }

  async joinVideoCall(callId: string): Promise<VideoCallResponse> {
    const response = await apiClient.post<VideoCallResponse>(
      `/api/video/join/${callId}`
    );
    return response.data;
  }

  async endVideoCall(callId: string): Promise<void> {
    await apiClient.post(`/api/video/end/${callId}`);
  }

  async getActiveVideoCalls(): Promise<VideoCallResponse[]> {
    const response = await apiClient.get<VideoCallResponse[]>(
      '/api/video/active'
    );
    return response.data;
  }

  async scheduleVideoCall(data: VideoCallData): Promise<VideoCallResponse> {
    const response = await apiClient.post<VideoCallResponse>(
      '/api/video/schedule',
      data
    );
    return response.data;
  }
}

export const messagesAPI = new MessagesAPI();
