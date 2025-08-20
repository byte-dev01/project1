import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaWrapper } from '../components/common/SafeAreaWrapper';
import { useAuthStore } from '../../store/authStore';
import { useFaxStore } from '../../store/faxStore';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { faxAPI } from '../api/fax';
import { patientsAPI } from '../api/patients';
import { messagesAPI } from '../api/messages';
import { formatDate } from '../../utils/helpers';

const { width: screenWidth } = Dimensions.get('window');

interface DashboardStats {
  pendingFaxes: number;
  urgentFaxes: number;
  unreadMessages: number;
  todayAppointments: number;
  recentPatients: number;
}

export const DashboardScreen: React.FC = () => {
  const { user } = useAuthStore();
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    pendingFaxes: 0,
    urgentFaxes: 0,
    unreadMessages: 0,
    todayAppointments: 0,
    recentPatients: 0,
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load fax stats
      const faxResponse = await faxAPI.getFaxRecords('24h');
      const pendingFaxes = faxResponse.faxData.filter(f => f.status === 'pending').length;
      const urgentFaxes = faxResponse.faxData.filter(f => f.severityLevel === '紧急').length;

      // Load message stats
      const messagesResponse = await messagesAPI.getMessages('inbox', 1, 10);
      const unreadMessages = messagesResponse.data.filter(m => m.unread).length;

      // Update stats
      setStats({
        pendingFaxes,
        urgentFaxes,
        unreadMessages,
        todayAppointments: 3, // Mock data
        recentPatients: 12, // Mock data
      });

      // Mock recent activities
      setRecentActivities([
        {
          id: '1',
          type: 'fax',
          title: 'New Fax Received',
          description: 'Lab results for John Doe',
          time: new Date(),
          severity: 'high',
        },
        {
          id: '2',
          type: 'message',
          title: 'Dr. Smith sent a message',
          description: 'Regarding patient medication',
          time: new Date(Date.now() - 3600000),
        },
        {
          id: '3',
          type: 'appointment',
          title: 'Upcoming Appointment',
          description: 'Sarah Johnson at 2:00 PM',
          time: new Date(Date.now() - 7200000),
        },
      ]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const navigateToSection = (section: string) => {
    switch (section) {
      case 'fax':
        navigation.navigate('Fax' as any);
        break;
      case 'messages':
        navigation.navigate('Messages' as any);
        break;
      case 'patients':
        navigation.navigate('Patients' as any);
        break;
      case 'appointments':
        // Navigate to appointments
        break;
    }
  };

  const StatCard = ({ 
    title, 
    value, 
    icon, 
    color, 
    onPress 
  }: {
    title: string;
    value: number;
    icon: string;
    color: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity 
      style={[styles.statCard, { borderLeftColor: color }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.statCardHeader}>
        <Text style={styles.statCardIcon}>{icon}</Text>
        <Text style={[styles.statCardValue, { color }]}>{value}</Text>
      </View>
      <Text style={styles.statCardTitle}>{title}</Text>
    </TouchableOpacity>
  );

  const ActivityItem = ({ activity }: { activity: any }) => (
    <TouchableOpacity 
      style={styles.activityItem}
      onPress={() => {
        // Navigate based on activity type
      }}
    >
      <View style={styles.activityIcon}>
        <Text style={styles.activityIconText}>
          {activity.type === 'fax' ? '📠' : activity.type === 'message' ? '💬' : '📅'}
        </Text>
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle}>{activity.title}</Text>
        <Text style={styles.activityDescription}>{activity.description}</Text>
        <Text style={styles.activityTime}>
          {formatDate(activity.time, 'hh:mm a')}
        </Text>
      </View>
      {activity.severity && (
        <View style={[
          styles.severityIndicator,
          { backgroundColor: getSeverityColor(activity.severity) }
        ]} />
      )}
    </TouchableOpacity>
  );

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return colors.severity.high;
      case 'urgent':
        return colors.severity.urgent;
      default:
        return colors.severity.medium;
    }
  };

  return (
    <SafeAreaWrapper>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Text style={styles.notificationIcon}>🔔</Text>
            {stats.unreadMessages > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {stats.unreadMessages}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <StatCard
            title="Pending Faxes"
            value={stats.pendingFaxes}
            icon="📄"
            color={colors.status.warning}
            onPress={() => navigateToSection('fax')}
          />
          <StatCard
            title="Urgent Items"
            value={stats.urgentFaxes}
            icon="🚨"
            color={colors.status.error}
            onPress={() => navigateToSection('fax')}
          />
          <StatCard
            title="Unread Messages"
            value={stats.unreadMessages}
            icon="💬"
            color={colors.status.info}
            onPress={() => navigateToSection('messages')}
          />
          <StatCard
            title="Today's Appointments"
            value={stats.todayAppointments}
            icon="📅"
            color={colors.status.success}
            onPress={() => navigateToSection('appointments')}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => navigation.navigate('PatientSearch' as any)}
            >
              <View style={styles.quickActionIcon}>
                <Text style={styles.quickActionIconText}>🔍</Text>
              </View>
              <Text style={styles.quickActionText}>Search Patient</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => navigation.navigate('NewPatient' as any)}
            >
              <View style={styles.quickActionIcon}>
                <Text style={styles.quickActionIconText}>➕</Text>
              </View>
              <Text style={styles.quickActionText}>New Patient</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => navigation.navigate('ComposeMessage' as any)}
            >
              <View style={styles.quickActionIcon}>
                <Text style={styles.quickActionIconText}>✉️</Text>
              </View>
              <Text style={styles.quickActionText}>Send Message</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => navigation.navigate('InsuranceForm' as any)}
            >
              <View style={styles.quickActionIcon}>
                <Text style={styles.quickActionIconText}>📋</Text>
              </View>
              <Text style={styles.quickActionText}>Insurance Form</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {recentActivities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background.primary,
  },
  greeting: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  userName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  notificationButton: {
    position: 'relative',
    padding: spacing.sm,
  },
  notificationIcon: {
    fontSize: 24,
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.status.error,
    borderRadius: spacing.borderRadius.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  notificationBadgeText: {
    color: colors.text.inverse,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: (screenWidth - spacing.lg * 2 - spacing.sm) / 2 - 1,
    backgroundColor: colors.background.primary,
    borderRadius: spacing.borderRadius.md,
    padding: spacing.md,
    borderLeftWidth: 4,
    ...spacing.shadow.sm,
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statCardIcon: {
    fontSize: 24,
  },
  statCardValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
  },
  statCardTitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  section: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  viewAllText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.sm,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: spacing.borderRadius.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  quickActionIconText: {
    fontSize: 24,
  },
  quickActionText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  activityItem: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: spacing.borderRadius.full,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  activityIconText: {
    fontSize: 20,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  activityDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  activityTime: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  severityIndicator: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    marginLeft: spacing.sm,
  },
});
