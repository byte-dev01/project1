// provider-messaging-widget.js
// This widget integrates into the existing provider dashboard

class ProviderMessagingWidget {
    constructor(containerId, providerId) {
        this.container = document.getElementById(containerId);
        this.providerId = providerId;
        this.websocket = null;
        this.conversations = new Map();
        this.currentConversation = null;
        
        this.init();
    }

    init() {
        this.render();
        this.connectWebSocket();
        this.loadConversations();
        this.attachEventListeners();
    }

    render() {
        this.container.innerHTML = `
            <div class="messaging-widget">
                <div class="messaging-header">
                    <h3>Patient Messages</h3>
                    <div class="message-stats">
                        <span class="unread-count">0 unread</span>
                    </div>
                </div>
                
                <div class="messaging-search">
                    <input type="text" placeholder="Search messages..." id="messageSearch">
                </div>
                
                <div class="conversation-list" id="conversationList">
                    <div class="loading">Loading conversations...</div>
                </div>
                
                <div class="quick-reply-section hidden" id="quickReplySection">
                    <h4>Quick Reply</h4>
                    <div class="template-buttons">
                        <button onclick="providerMessaging.useTemplate('results')">Test Results Ready</button>
                        <button onclick="providerMessaging.useTemplate('appointment')">Schedule Follow-up</button>
                        <button onclick="providerMessaging.useTemplate('prescription')">Prescription Info</button>
                    </div>
                    <textarea id="quickReplyText" placeholder="Type your message..."></textarea>
                    <div class="reply-actions">
                        <label>
                            <input type="checkbox" id="urgentFlag"> Mark as urgent
                        </label>
                        <button class="send-btn" onclick="providerMessaging.sendQuickReply()">Send</button>
                    </div>
                </div>
            </div>
            
            <style>
                .messaging-widget {
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                }
                
                .messaging-header {
                    padding: 15px;
                    border-bottom: 1px solid #e9ecef;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .messaging-header h3 {
                    margin: 0;
                    font-size: 18px;
                    color: #003366;
                }
                
                .unread-count {
                    background: #dc3545;
                    color: white;
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 600;
                }
                
                .messaging-search {
                    padding: 10px 15px;
                    border-bottom: 1px solid #e9ecef;
                }
                
                .messaging-search input {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    font-size: 14px;
                }
                
                .conversation-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 10px;
                }
                
                .conversation-item {
                    padding: 12px;
                    border: 1px solid #e9ecef;
                    border-radius: 6px;
                    margin-bottom: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .conversation-item:hover {
                    background: #f8f9fa;
                    border-color: #0066cc;
                }
                
                .conversation-item.unread {
                    background: #e8f5e9;
                    border-color: #4caf50;
                }
                
                .conversation-item.selected {
                    background: #e3f2fd;
                    border-color: #0066cc;
                }
                
                .patient-info {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 5px;
                }
                
                .patient-name {
                    font-weight: 600;
                    color: #212529;
                }
                
                .message-time {
                    font-size: 12px;
                    color: #6c757d;
                }
                
                .message-preview {
                    font-size: 13px;
                    color: #6c757d;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                .quick-reply-section {
                    border-top: 2px solid #e9ecef;
                    padding: 15px;
                    background: #f8f9fa;
                }
                
                .quick-reply-section h4 {
                    margin: 0 0 10px 0;
                    font-size: 16px;
                    color: #003366;
                }
                
                .template-buttons {
                    display: flex;
                    gap: 5px;
                    margin-bottom: 10px;
                    flex-wrap: wrap;
                }
                
                .template-buttons button {
                    padding: 4px 8px;
                    font-size: 12px;
                    background: white;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .template-buttons button:hover {
                    background: #e9ecef;
                    border-color: #adb5bd;
                }
                
                #quickReplyText {
                    width: 100%;
                    min-height: 80px;
                    padding: 8px;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    resize: vertical;
                    font-family: inherit;
                    font-size: 14px;
                    margin-bottom: 10px;
                }
                
                .reply-actions {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .send-btn {
                    padding: 6px 16px;
                    background: #0066cc;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                
                .send-btn:hover {
                    background: #0052a3;
                }
                
                .loading {
                    text-align: center;
                    padding: 20px;
                    color: #6c757d;
                }
                
                .hidden {
                    display: none !important;
                }
                
                .urgent-indicator {
                    display: inline-block;
                    background: #dc3545;
                    color: white;
                    font-size: 11px;
                    padding: 2px 6px;
                    border-radius: 3px;
                    margin-left: 5px;
                }
            </style>
        `;
    }

    connectWebSocket() {
        const wsUrl = `ws://localhost:3001/provider-messaging?providerId=${this.providerId}`;
        this.websocket = new WebSocket(wsUrl);

        this.websocket.onopen = () => {
            console.log('Provider messaging WebSocket connected');
        };

        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };

        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.websocket.onclose = () => {
            // Reconnect after 5 seconds
            setTimeout(() => this.connectWebSocket(), 5000);
        };
    }

    handleWebSocketMessage(data) {
        switch(data.type) {
            case 'newMessage':
                this.addNewMessage(data.message);
                this.showNotification(`New message from ${data.message.patientName}`);
                break;
                
            case 'messageRead':
                this.markMessageRead(data.conversationId);
                break;
                
            case 'patientTyping':
                this.showTypingIndicator(data.conversationId, data.isTyping);
                break;
        }
    }

    async loadConversations() {
        try {
            const response = await fetch(`/api/provider/${this.providerId}/conversations`);
            const data = await response.json();
            
            this.conversations.clear();
            data.conversations.forEach(conv => {
                this.conversations.set(conv.id, conv);
            });
            
            this.renderConversations();
            this.updateUnreadCount();
        } catch (error) {
            console.error('Error loading conversations:', error);
            document.getElementById('conversationList').innerHTML = 
                '<div class="error">Error loading messages</div>';
        }
    }

    renderConversations() {
        const listContainer = document.getElementById('conversationList');
        const conversations = Array.from(this.conversations.values())
            .sort((a, b) => new Date(b.lastMessage) - new Date(a.lastMessage));
        
        if (conversations.length === 0) {
            listContainer.innerHTML = '<div class="empty-state">No messages</div>';
            return;
        }
        
        listContainer.innerHTML = conversations.map(conv => `
            <div class="conversation-item ${conv.unread ? 'unread' : ''} ${this.currentConversation === conv.id ? 'selected' : ''}" 
                 onclick="providerMessaging.selectConversation('${conv.id}')">
                <div class="patient-info">
                    <span class="patient-name">${conv.patientName}</span>
                    <span class="message-time">${this.formatTime(conv.lastMessage)}</span>
                </div>
                <div class="message-preview">
                    ${conv.urgent ? '<span class="urgent-indicator">URGENT</span>' : ''}
                    ${conv.lastMessageText}
                </div>
            </div>
        `).join('');
    }

    selectConversation(conversationId) {
        this.currentConversation = conversationId;
        const conversation = this.conversations.get(conversationId);
        
        if (!conversation) return;
        
        // Mark as read
        if (conversation.unread) {
            this.markConversationRead(conversationId);
        }
        
        // Show quick reply section
        document.getElementById('quickReplySection').classList.remove('hidden');
        
        // Update UI
        this.renderConversations();
        
        // Load full conversation in main window if integrated
        if (window.loadPatientConversation) {
            window.loadPatientConversation(conversationId);
        }
    }

    async markConversationRead(conversationId) {
        const conversation = this.conversations.get(conversationId);
        if (conversation) {
            conversation.unread = false;
            this.updateUnreadCount();
            
            // Send to server
            await fetch(`/api/conversations/${conversationId}/read`, {
                method: 'PUT'
            });
        }
    }

    updateUnreadCount() {
        const unreadCount = Array.from(this.conversations.values())
            .filter(conv => conv.unread).length;
        
        document.querySelector('.unread-count').textContent = 
            `${unreadCount} unread`;
    }

    useTemplate(type) {
        const templates = {
            results: 'Your test results are now available. I have reviewed them and [add summary]. Please let me know if you have any questions.',
            appointment: 'I would like to schedule a follow-up appointment to discuss your progress. Please call our office at (310) 825-2631 to schedule a convenient time.',
            prescription: 'Your prescription for [medication] has been sent to your pharmacy. Please take as directed: [instructions]. Let me know if you have any questions about the medication.'
        };
        
        const textarea = document.getElementById('quickReplyText');
        textarea.value = templates[type] || '';
        textarea.focus();
    }

    async sendQuickReply() {
        if (!this.currentConversation) {
            alert('Please select a conversation first');
            return;
        }
        
        const message = document.getElementById('quickReplyText').value.trim();
        if (!message) return;
        
        const urgent = document.getElementById('urgentFlag').checked;
        
        try {
            const response = await fetch(`/api/conversations/${this.currentConversation}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    providerId: this.providerId,
                    message: message,
                    urgent: urgent
                })
            });
            
            if (response.ok) {
                // Clear form
                document.getElementById('quickReplyText').value = '';
                document.getElementById('urgentFlag').checked = false;
                
                // Show success
                this.showNotification('Message sent');
                
                // Reload conversation
                await this.loadConversations();
            }
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message');
        }
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        
        return date.toLocaleDateString();
    }

    showNotification(message) {
        // Use the same notification system as the main dashboard
        if (window.showNotification) {
            window.showNotification(message);
        }
    }

    attachEventListeners() {
        // Search functionality
        document.getElementById('messageSearch').addEventListener('input', (e) => {
            this.filterConversations(e.target.value);
        });
    }

    filterConversations(query) {
        const filtered = Array.from(this.conversations.values())
            .filter(conv => 
                conv.patientName.toLowerCase().includes(query.toLowerCase()) ||
                conv.lastMessageText.toLowerCase().includes(query.toLowerCase())
            );
        
        // Re-render with filtered results
        const listContainer = document.getElementById('conversationList');
        
        if (filtered.length === 0) {
            listContainer.innerHTML = '<div class="empty-state">No matching conversations</div>';
            return;
        }
        
        listContainer.innerHTML = filtered.map(conv => `
            <div class="conversation-item ${conv.unread ? 'unread' : ''}" 
                 onclick="providerMessaging.selectConversation('${conv.id}')">
                <div class="patient-info">
                    <span class="patient-name">${conv.patientName}</span>
                    <span class="message-time">${this.formatTime(conv.lastMessage)}</span>
                </div>
                <div class="message-preview">${conv.lastMessageText}</div>
            </div>
        `).join('');
    }

    // Public methods for integration
    highlightPatientConversation(patientId) {
        const conversation = Array.from(this.conversations.values())
            .find(conv => conv.patientId === patientId);
        
        if (conversation) {
            this.selectConversation(conversation.id);
        }
    }

    getUnreadCountForPatient(patientId) {
        const conversation = Array.from(this.conversations.values())
            .find(conv => conv.patientId === patientId);
        
        return conversation && conversation.unread ? 1 : 0;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // This would be initialized from the provider dashboard
    // window.providerMessaging = new ProviderMessagingWidget('messagingContainer', 'dr-hanson');
});