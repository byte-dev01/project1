import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function HomeScreen({ navigation }) {
  const handleCallPress = () => {
    Alert.alert(
      'Call Support',
      'Would you like to call our support line?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call', onPress: () => Linking.openURL('tel:+18005551234') }
      ]
    );
  };

  const handleChatPress = () => {
    // Navigate to AI chat screen
    navigation.navigate('Chat');
  };

  const quickActions = [
    {
      title: 'Find Urgent Care',
      icon: 'local-hospital',
      color: '#FF5722',
      onPress: () => navigation.navigate('Urgent Care')
    },
    {
      title: 'Schedule Telehealth',
      icon: 'video-call',
      color: '#4CAF50',
      onPress: () => navigation.navigate('Telehealth')
    },
    {
      title: 'Upload Insurance',
      icon: 'upload-file',
      color: '#2196F3',
      onPress: () => navigation.navigate('Insurance')
    },
    {
      title: 'View Prescriptions',
      icon: 'medication',
      color: '#9C27B0',
      onPress: () => navigation.navigate('Portal')
    },
    {
      title: 'Chat with AI',
      icon: 'chat',
      color: '#00BCD4',
      onPress: handleChatPress
    },
    {
      title: 'Call Us',
      icon: 'phone',
      color: '#FFC107',
      onPress: handleCallPress
    }
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome to HealthBridge</Text>
        <Text style={styles.subText}>Your health, simplified</Text>
      </View>

      <View style={styles.grid}>
        {quickActions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={styles.card}
            onPress={action.onPress}
          >
            <View style={[styles.iconContainer, { backgroundColor: action.color + '20' }]}>
              <Icon name={action.icon} size={32} color={action.color} />
            </View>
            <Text style={styles.cardTitle}>{action.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#007AFF',
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subText: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    marginTop: 5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
  },
  card: {
    width: '45%',
    margin: '2.5%',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    color: '#333',
  },
});