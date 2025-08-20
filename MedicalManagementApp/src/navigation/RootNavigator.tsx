import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from '../../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { RootStackParamList } from '../../types/navigation.types';

const Stack = createStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
};

src/navigation/AuthNavigator.tsx

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { AuthStackParamList } from '../../types/navigation.types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

const Stack = createStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.background.primary },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      {/* Add other auth screens as needed */}
    </Stack.Navigator>
  );
};

src/navigation/MainNavigator.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Platform } from 'react-native';
import { DashboardScreen } from '../src/screens/dashboard/DashboardScreen';
import { FaxListScreen } from '../screens/fax/FaxListScreen';
import { FaxDetailScreen } from '../screens/fax/FaxDetailScreen';
import { PatientSearchScreen } from '../src/screens/patients/PatientSearchScreen';
import { PatientDetailScreen } from '../src/screens/patients/PatientDetailScreen';
import { MessagesScreen } from '../src/screens/messages/MessagesScreen';
import { InsuranceForm } from '../components/forms/InsuranceForm';
import { PatientForm } from '../src/components/forms/PatientForm';
import { 
  MainTabParamList, 
  FaxStackParamList,
  PatientStackParamList,
  MessageStackParamList 
} from '../../types/navigation.types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { useAuthStore } from '../../store/authStore';

const Tab = createBottomTabNavigator<MainTabParamList>();
const FaxStack = createStackNavigator<FaxStackParamList>();
const PatientStack = createStackNavigator<PatientStackParamList>();
const MessageStack = createStackNavigator<MessageStackParamList>();

// Stack Navigators
const FaxNavigator = () => (
  <FaxStack.Navigator>
    <FaxStack.Screen 
      name="FaxList" 
      component={FaxListScreen}
      options={{ headerShown: false }}
    />
    <FaxStack.Screen 
      name="FaxDetail" 
      component={FaxDetailScreen}
      options={{ 
        title: 'Fax Details',
        headerBackTitle: 'Back',
      }}
    />
  </FaxStack.Navigator>
);

const PatientNavigator = () => (
  <PatientStack.Navigator>
    <PatientStack.Screen 
      name="PatientSearch" 
      component={PatientSearchScreen}
      options={{ headerShown: false }}
    />
    <PatientStack.Screen 
      name="PatientDetail" 
      component={PatientDetailScreen}
      options={{ headerShown: false }}
    />
    <PatientStack.Screen 
      name="NewPatient" 
      component={PatientForm}
      options={{ title: 'New Patient' }}
    />
    <PatientStack.Screen 
      name="PatientEdit" 
      component={PatientForm}
      options={{ title: 'Edit Patient' }}
    />
    <PatientStack.Screen 
      name="InsuranceForm" 
      component={InsuranceForm}
      options={{ title: 'Insurance Information' }}
    />
  </PatientStack.Navigator>
);

const MessageNavigator = () => (
  <MessageStack.Navigator>
    <MessageStack.Screen 
      name="MessageList" 
      component={MessagesScreen}
      options={{ headerShown: false }}
    />
    {/* Add MessageDetail and ComposeMessage screens */}
  </MessageStack.Navigator>
);

// Tab Navigator
export const MainNavigator: React.FC = () => {
  const { user, logout } = useAuthStore();

  const getTabIcon = (route: string, focused: boolean) => {
    const icons: { [key: string]: string } = {
      Dashboard: focused ? '🏠' : '🏡',
      Fax: focused ? '📠' : '📄',
      Patients: focused ? '👥' : '👤',
      Messages: focused ? '💬' : '✉️',
      More: focused ? '☰' : '⋯',
    };
    return icons[route] || '❓';
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => ({
          icon: getTabIcon(route.name, focused),
        }),
        tabBarActiveTintColor: colors.primary[600],
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: {
          backgroundColor: colors.background.primary,
          borderTopWidth: 1,
          borderTopColor: colors.border.light,
          paddingBottom: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
          paddingTop: spacing.xs,
          height: Platform.OS === 'ios' ? 85 : 65,
        },
        tabBarLabelStyle: {
          fontSize: typography.fontSize.xs,
          fontWeight: typography.fontWeight.medium,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen 
        name="Fax" 
        component={FaxNavigator}
        options={{
          tabBarLabel: 'Fax',
          tabBarBadge: undefined, // Add badge for urgent faxes
        }}
      />
      <Tab.Screen 
        name="Patients" 
        component={PatientNavigator}
        options={{
          tabBarLabel: 'Patients',
        }}
      />
      <Tab.Screen 
        name="Messages" 
        component={MessageNavigator}
        options={{
          tabBarLabel: 'Messages',
          tabBarBadge: undefined, // Add badge for unread messages
        }}
      />
      <Tab.Screen 
        name="More" 
        component={MoreScreen}
        options={{
          tabBarLabel: 'More',
        }}
      />
    </Tab.Navigator>
  );
};

// Placeholder More Screen
const MoreScreen: React.FC = () => {
  const { user, logout } = useAuthStore();
  
  return (
    <SafeAreaWrapper>
      <View style={{ flex: 1, padding: spacing.lg }}>
        <Text style={{ fontSize: typography.fontSize.xl, marginBottom: spacing.lg }}>
          More Options
        </Text>
        <TouchableOpacity 
          onPress={logout}
          style={{
            backgroundColor: colors.status.error,
            padding: spacing.md,
            borderRadius: spacing.borderRadius.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: colors.text.inverse }}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaWrapper>
  );
};



