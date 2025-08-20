
import { API_ENDPOINTS } from './endpoints';
import { apiClient } from './ApiClient';
import { Message, MessageThread } from '../../types/models.types';
import { PaginatedResponse } from '../../types/api.types';
import { offlineManager } from '../../utils/offline';

interface SendMessageData {
  recipient: string;
  subject: string;
  content: string;
  messageType: string;
  urgent?: boolean;
  attachments?: string[];
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
    // If offline, save to drafts and queue
    if (!offlineManager.getConnectionStatus()) {
      const draftMessage: Partial<Message> = {
        ...data,
        id: `draft_${Date.now()}`,
        folder: 'drafts',
        timestamp: new Date(),
        unread: false,
        hasAttachment: data.attachments ? data.attachments.length > 0 : false,
        sender: 'You',
        senderRole: 'Patient',
        senderName: 'You'
      };
      
      await offlineManager.addToSyncQueue({
        method: 'POST',
        endpoint: API_ENDPOINTS.MESSAGES.SEND,
        data
      });
      
      return draftMessage as Message;
    }

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
}

export const messagesAPI = new MessagesAPI();
