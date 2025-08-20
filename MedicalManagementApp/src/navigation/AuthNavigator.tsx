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
