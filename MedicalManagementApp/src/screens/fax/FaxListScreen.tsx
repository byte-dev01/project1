import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaWrapper } from '../../components/common/SafeAreaWrapper';
import { useFaxStore } from '../../../store/faxStore';
import { FaxCard } from '../../components/fax/FaxCard';
import { FaxFilters } from '../../components/fax/FaxFilters';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useNavigation } from '@react-navigation/native';
import { FaxListScreenNavigationProp } from '../../../types/navigation.types';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { FaxMessage } from '../../../types/models.types';
import SegmentedControl from '@react-native-segmented-control/segmented-control';

export const FaxListScreen: React.FC = () => {
  const navigation = useNavigation<FaxListScreenNavigationProp>();
  const {
    faxMessages,
    loading,
    fetchFaxMessages,
    stats,
    updateFaxStatus,
  } = useFaxStore();

  const [timeRange, setTimeRange] = useState('24h');
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFaxes, setSelectedFaxes] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const timeRanges = ['1h', '24h', '7d', '30d'];

  useEffect(() => {
    fetchFaxMessages(timeRange);
  }, [timeRange]);

  const filteredMessages = useCallback(() => {
    let filtered = [...faxMessages];

    // Apply severity filter
    if (severityFilter) {
      filtered = filtered.filter(msg => msg.severityLevel === severityFilter);
    }

    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter(msg => msg.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(msg =>
        msg.fileName.toLowerCase().includes(query) ||
        msg.summary.toLowerCase().includes(query) ||
        msg.transcription.toLowerCase().includes(query)
      );
    }

    // Sort by severity score (highest first) and then by date
    filtered.sort((a, b) => {
      if (a.severityScore !== b.severityScore) {
        return b.severityScore - a.severityScore;
      }
      return new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime();
    });

    return filtered;
  }, [faxMessages, severityFilter, statusFilter, searchQuery]);

  const handleFaxPress = (fax: FaxMessage) => {
    if (isSelectionMode) {
      toggleFaxSelection(fax._id);
    } else {
      navigation.navigate('FaxDetail', { faxId: fax._id });
    }
  };

  const toggleFaxSelection = (faxId: string) => {
    const newSelection = new Set(selectedFaxes);
    if (newSelection.has(faxId)) {
      newSelection.delete(faxId);
    } else {
      newSelection.add(faxId);
    }
    setSelectedFaxes(newSelection);
    
    if (newSelection.size === 0) {
      setIsSelectionMode(false);
    }
  };

  const handleLongPress = (fax: FaxMessage) => {
    setIsSelectionMode(true);
    toggleFaxSelection(fax._id);
  };

  const handleBulkAction = async (action: 'archive' | 'mark-reviewed') => {
    const selectedCount = selectedFaxes.size;
    if (selectedCount === 0) return;

    Alert.alert(
      'Confirm Action',
      `${action === 'archive' ? 'Archive' : 'Mark as reviewed'} ${selectedCount} fax${selectedCount > 1 ? 'es' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const status = action === 'archive' ? 'archived' : 'reviewed';
              const promises = Array.from(selectedFaxes).map(faxId =>
                updateFaxStatus(faxId, status)
              );
              await Promise.all(promises);
              
              setSelectedFaxes(new Set());
              setIsSelectionMode(false);
              fetchFaxMessages(timeRange);
              
              Alert.alert('Success', `${selectedCount} fax${selectedCount > 1 ? 'es' : ''} updated`);
            } catch (error) {
              Alert.alert('Error', 'Failed to update faxes');
            }
          }
        }
      ]
    );
  };

  const renderHeader = () => (
    <View>
      {/* Stats Summary */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.totalProcessed}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.severity.urgent }]}>
            {stats.highSeverityCount}
          </Text>
          <Text style={styles.statLabel}>High Priority</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {Math.round(stats.averageProcessingTime)}s
          </Text>
          <Text style={styles.statLabel}>Avg Time</Text>
        </View>
        <View style={styles.statItem}>
          <View style={[
            styles.statusIndicator,
            { backgroundColor: stats.systemStatus === 'Running' 
              ? colors.status.success 
              : colors.status.error 
            }
          ]} />
          <Text style={styles.statLabel}>{stats.systemStatus}</Text>
        </View>
      </View>

      {/* Time Range Selector */}
      <View style={styles.segmentContainer}>
        <SegmentedControl
          values={timeRanges}
          selectedIndex={timeRanges.indexOf(timeRange)}
          onChange={(event) => {
            setTimeRange(timeRanges[event.nativeEvent.selectedSegmentIndex]);
          }}
          style={styles.segmentControl}
        />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search faxes..."
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

      {/* Filters */}
      <FaxFilters
        selectedSeverity={severityFilter}
        onSeverityChange={setSeverityFilter}
        selectedStatus={statusFilter}
        onStatusChange={setStatusFilter}
        showStatusFilter
      />

      {/* Selection Mode Actions */}
      {isSelectionMode && (
        <View style={styles.selectionActions}>
          <Text style={styles.selectionCount}>
            {selectedFaxes.size} selected
          </Text>
          <View style={styles.selectionButtons}>
            <TouchableOpacity
              style={styles.selectionButton}
              onPress={() => handleBulkAction('mark-reviewed')}
            >
              <Text style={styles.selectionButtonText}>Mark Reviewed</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.selectionButton}
              onPress={() => handleBulkAction('archive')}
            >
              <Text style={styles.selectionButtonText}>Archive</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.selectionButton, styles.cancelButton]}
              onPress={() => {
                setSelectedFaxes(new Set());
                setIsSelectionMode(false);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const renderFaxItem = ({ item }: { item: FaxMessage }) => (
    <FaxCard
      fax={item}
      onPress={() => handleFaxPress(item)}
      onLongPress={() => handleLongPress(item)}
      selected={selectedFaxes.has(item._id)}
    />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📭</Text>
      <Text style={styles.emptyTitle}>No Faxes Found</Text>
      <Text style={styles.emptyMessage}>
        {searchQuery 
          ? 'Try adjusting your search or filters'
          : 'No faxes received in the selected time range'
        }
      </Text>
    </View>
  );

  if (loading && faxMessages.length === 0) {
    return (
      <SafeAreaWrapper>
        <LoadingSpinner fullScreen text="Loading faxes..." />
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Fax Monitor</Text>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => {
              Alert.alert('Settings', 'Fax settings coming soon');
            }}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={filteredMessages()}
          keyExtractor={(item) => item._id}
          renderItem={renderFaxItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => fetchFaxMessages(timeRange)}
              colors={[colors.primary[500]]}
            />
          }
          contentContainerStyle={styles.listContent}
          stickyHeaderIndices={[0]}
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
  settingsButton: {
    padding: spacing.sm,
  },
  settingsIcon: {
    fontSize: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: spacing.xs,
  },
  segmentContainer: {
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
  selectionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.primary[200],
  },
  selectionCount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[700],
  },
  selectionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  selectionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary[500],
    borderRadius: spacing.borderRadius.md,
  },
  selectionButtonText: {
    color: colors.text.inverse,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  cancelButton: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  cancelButtonText: {
    color: colors.text.primary,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
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
    paddingHorizontal: spacing.xl,
  },
});
