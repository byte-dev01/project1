import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaWrapper } from '../components/common/SafeAreaWrapper';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useNavigation } from '@react-navigation/native';
import { messagesAPI } from '../api/messages';
import { Message } from '../../types/models.types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { formatDate, truncateText } from '../../utils/helpers';
import SegmentedControl from '@react-native-segmented-control/segmented-control';

type FolderType = 'inbox' | 'sent' | 'drafts' | 'archived';

export const MessagesScreen: React.FC = () => {
  const navigation = useNavigation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFolder, setActiveFolder] = useState<FolderType>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const folders = ['Inbox', 'Sent', 'Drafts', 'Archived'];
  const folderValues: FolderType[] = ['inbox', 'sent', 'drafts', 'archived'];

  useEffect(() => {
    loadMessages();
  }, [activeFolder]);

  const loadMessages = async () => {
    try {
      const response = await messagesAPI.getMessages(activeFolder, 1, 50);
      setMessages(response.data);
      
      if (activeFolder === 'inbox') {
        const unread = response.data.filter(m => m.unread).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadMessages();
  };

  const handleMessagePress = async (message: Message) => {
    // Mark as read if unread
    if (message.unread && activeFolder === 'inbox') {
      try {
        await messagesAPI.markAsRead(message.id);
        setMessages(prev => 
          prev.map(m => 
            m.id === message.id ? { ...m, unread: false } : m
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }

    // Navigate to message detail
    navigation.navigate('MessageDetail' as any, { messageId: message.id });
  };

  const handleCompose = () => {
    navigation.navigate('ComposeMessage' as any);
  };

  const handleDeleteMessage = (messageId: string) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await messagesAPI.deleteMessage(messageId);
              setMessages(prev => prev.filter(m => m.id !== messageId));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete message');
            }
          },
        },
      ]
    );
  };

  const filteredMessages = messages.filter(message => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      message.subject.toLowerCase().includes(query) ||
      message.content.toLowerCase().includes(query) ||
      message.senderName.toLowerCase().includes(query)
    );
  });

  const renderMessage = ({ item }: { item: Message }) => {
    const isInbox = activeFolder === 'inbox';
    const displayName = isInbox ? item.senderName : item.recipientName;
    
    return (
      <TouchableOpacity
        style={styles.messageCard}
        onPress={() => handleMessagePress(item)}
        onLongPress={() => {
          Alert.alert(
            'Message Options',
            '',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => handleDeleteMessage(item.id),
              },
              {
                text: 'Archive',
                onPress: async () => {
                  try {
                    await messagesAPI.archiveMessage(item.id);
                    setMessages(prev => prev.filter(m => m.id !== item.id));
                  } catch (error) {
                    Alert.alert('Error', 'Failed to archive message');
                  }
                },
              },
            ]
          );
        }}
      >
        <View style={styles.messageHeader}>
          <View style={styles.messageInfo}>
            {item.unread && <View style={styles.unreadIndicator} />}
            <View style={styles.senderInfo}>
              <Text style={[
                styles.senderName,
                item.unread && styles.unreadText
              ]}>
                {displayName}
              </Text>
              <Text style={styles.senderRole}>{item.senderRole}</Text>
            </View>
          </View>
          <View style={styles.messageMetadata}>
            <Text style={styles.timestamp}>
              {formatDate(item.timestamp, 'MMM dd')}
            </Text>
            {item.urgent && (
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentText}>!</Text>
              </View>
            )}
          </View>
        </View>
        
        <Text style={[
          styles.subject,
          item.unread && styles.unreadText
        ]} numberOfLines={1}>
          {item.subject}
        </Text>
        
        <Text style={styles.preview} numberOfLines={2}>
          {truncateText(item.content, 100)}
        </Text>
        
        <View style={styles.messageFooter}>
          <View style={styles.messageType}>
            <Text style={styles.messageTypeText}>{item.messageType}</Text>
          </View>
          {item.hasAttachment && (
            <Text style={styles.attachmentIcon}>📎</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📬</Text>
      <Text style={styles.emptyTitle}>No messages</Text>
      <Text style={styles.emptyMessage}>
        {activeFolder === 'inbox' 
          ? 'Your inbox is empty'
          : `No messages in ${activeFolder}`
        }
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaWrapper>
        <LoadingSpinner fullScreen text="Loading messages..." />
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Messages</Text>
          <TouchableOpacity 
            style={styles.composeButton}
            onPress={handleCompose}
          >
            <Text style={styles.composeIcon}>✉️</Text>
          </TouchableOpacity>
        </View>

        {/* Folder Tabs */}
        <View style={styles.tabContainer}>
          <SegmentedControl
            values={folders.map((folder, index) => 
              folder + (folder === 'Inbox' && unreadCount > 0 ? ` (${unreadCount})` : '')
            )}
            selectedIndex={folderValues.indexOf(activeFolder)}
            onChange={(event) => {
              setActiveFolder(folderValues[event.nativeEvent.selectedSegmentIndex]);
            }}
            style={styles.segmentControl}
          />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            placeholderTextColor={colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Messages List */}
        <FlatList
          data={filteredMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary[500]]}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  composeButton: {
    padding: spacing.sm,
  },
  composeIcon: {
    fontSize: 28,
  },
  tabContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
  },
  segmentControl: {
    backgroundColor: colors.background.secondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    paddingVertical: spacing.xs,
  },
  clearIcon: {
    fontSize: 20,
    color: colors.text.tertiary,
    padding: spacing.xs,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  messageCard: {
    backgroundColor: colors.background.primary,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    padding: spacing.md,
    borderRadius: spacing.borderRadius.md,
    ...spacing.shadow.sm,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  messageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary[500],
    marginRight: spacing.sm,
  },
  senderInfo: {
    flex: 1,
  },
  senderName: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  unreadText: {
    fontWeight: typography.fontWeight.semibold,
  },
  senderRole: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  messageMetadata: {
    alignItems: 'flex-end',
  },
  timestamp: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  urgentBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.status.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  urgentText: {
    color: colors.text.inverse,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  subject: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  preview: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: typography.lineHeight.relaxed,
    marginBottom: spacing.sm,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageType: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.borderRadius.sm,
  },
  messageTypeText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  attachmentIcon: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyMessage: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});

/*
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaWrapper } from '../../components/common/SafeAreaWrapper';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useNavigation } from '@react-navigation/native';
import { messagesAPI } from '../../api/messages';
import { Message } from '../../types/models.types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { formatDate, truncateText } from '../../utils/helpers';
import SegmentedControl from '@react-native-segmented-control/segmented-control';

type FolderType = 'inbox' | 'sent' | 'drafts' | 'archived';

export const MessagesScreen: React.FC = () => {
  const navigation = useNavigation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFolder, setActiveFolder] = useState<FolderType>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const folders = ['Inbox', 'Sent', 'Drafts', 'Archived'];
  const folderValues: FolderType[] = ['inbox', 'sent', 'drafts', 'archived'];

  useEffect(() => {
    loadMessages();
  }, [activeFolder]);

  const loadMessages = async () => {
    try {
      const response = await messagesAPI.getMessages(activeFolder, 1, 50);
      setMessages(response.data);
      
      if (activeFolder === 'inbox') {
        const unread = response.data.filter(m => m.unread).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadMessages();
  };

  const handleMessagePress = async (message: Message) => {
    // Mark as read if unread
    if (message.unread && activeFolder === 'inbox') {
      try {
        await messagesAPI.markAsRead(message.id);
        setMessages(prev => 
          prev.map(m => 
            m.id === message.id ? { ...m, unread: false } : m
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }

    // Navigate to message detail
    navigation.navigate('MessageDetail' as any, { messageId: message.id });
  };

  const handleCompose = () => {
    navigation.navigate('ComposeMessage' as any);
  };

  const handleDeleteMessage = (messageId: string) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await messagesAPI.deleteMessage(messageId);
              setMessages(prev => prev.filter(m => m.id !== messageId));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete message');
            }
          },
        },
      ]
    );
  };

  const filteredMessages = messages.filter(message => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      message.subject.toLowerCase().includes(query) ||
      message.content.toLowerCase().includes(query) ||
      message.senderName.toLowerCase().includes(query)
    );
  });

  const renderMessage = ({ item }: { item: Message }) => {
    const isInbox = activeFolder === 'inbox';
    const displayName = isInbox ? item.senderName : item.recipientName;
    
    return (
      <TouchableOpacity
        style={styles.messageCard}
        onPress={() => handleMessagePress(item)}
        onLongPress={() => {
          Alert.alert(
            'Message Options',
            '',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => handleDeleteMessage(item.id),
              },
              {
                text: 'Archive',
                onPress: async () => {
                  try {
                    await messagesAPI.archiveMessage(item.id);
                    setMessages(prev => prev.filter(m => m.id !== item.id));
                  } catch (error) {
                    Alert.alert('Error', 'Failed to archive message');
                  }
                },
              },
            ]
          );
        }}
      >
        <View style={styles.messageHeader}>
          <View style={styles.messageInfo}>
            {item.unread && <View style={styles.unreadIndicator} />}
            <View style={styles.senderInfo}>
              <Text style={[
                styles.senderName,
                item.unread && styles.unreadText
              ]}>
                {displayName}
              </Text>
              <Text style={styles.senderRole}>{item.senderRole}</Text>
            </View>
          </View>
          <View style={styles.messageMetadata}>
            <Text style={styles.timestamp}>
              {formatDate(item.timestamp, 'MMM dd')}
            </Text>
            {item.urgent && (
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentText}>!</Text>
              </View>
            )}
          </View>
        </View>
        
        <Text style={[
          styles.subject,
          item.unread && styles.unreadText
        ]} numberOfLines={1}>
          {item.subject}
        </Text>
        
        <Text style={styles.preview} numberOfLines={2}>
          {truncateText(item.content, 100)}
        </Text>
        
        <View style={styles.messageFooter}>
          <View style={styles.messageType}>
            <Text style={styles.messageTypeText}>{item.messageType}</Text>
          </View>
          {item.hasAttachment && (
            <Text style={styles.attachmentIcon}>📎</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📬</Text>
      <Text style={styles.emptyTitle}>No messages</Text>
      <Text style={styles.emptyMessage}>
        {activeFolder === 'inbox' 
          ? 'Your inbox is empty'
          : `No messages in ${activeFolder}`
        }
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaWrapper>
        <LoadingSpinner fullScreen text="Loading messages..." />
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Messages</Text>
          <TouchableOpacity 
            style={styles.composeButton}
            onPress={handleCompose}
          >
            <Text style={styles.composeIcon}>✉️</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabContainer}>
          <SegmentedControl
            values={folders.map((folder, index) => 
              folder + (folder === 'Inbox' && unreadCount > 0 ? ` (${unreadCount})` : '')
            )}
            selectedIndex={folderValues.indexOf(activeFolder)}
            onChange={(event) => {
              setActiveFolder(folderValues[event.nativeEvent.selectedSegmentIndex]);
            }}
            style={styles.segmentControl}
          />
        </View>

        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            placeholderTextColor={colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={filteredMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary[500]]}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  composeButton: {
    padding: spacing.sm,
  },
  composeIcon: {
    fontSize: 28,
  },
  tabContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
  },
  segmentControl: {
    backgroundColor: colors.background.secondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    paddingVertical: spacing.xs,
  },
  clearIcon: {
    fontSize: 20,
    color: colors.text.tertiary,
    padding: spacing.xs,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  messageCard: {
    backgroundColor: colors.background.primary,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    padding: spacing.md,
    borderRadius: spacing.borderRadius.md,
    ...spacing.shadow.sm,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  messageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary[500],
    marginRight: spacing.sm,
  },
  senderInfo: {
    flex: 1,
  },
  senderName: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  unreadText: {
    fontWeight: typography.fontWeight.semibold,
  },
  senderRole: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  messageMetadata: {
    alignItems: 'flex-end',
  },
  timestamp: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  urgentBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.status.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  urgentText: {
    color: colors.text.inverse,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  subject: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  preview: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: typography.lineHeight.relaxed,
    marginBottom: spacing.sm,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageType: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.borderRadius.sm,
  },
  messageTypeText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  attachmentIcon: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyMessage: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
*/