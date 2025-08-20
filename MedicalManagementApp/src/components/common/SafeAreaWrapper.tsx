import React from 'react';
import { 
  SafeAreaView, 
  StatusBar, 
  View, 
  StyleSheet,
  ViewStyle,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../theme/colors';

interface SafeAreaWrapperProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
  backgroundColor?: string;
  statusBarStyle?: 'default' | 'light-content' | 'dark-content';
  statusBarBackgroundColor?: string;
}

export const SafeAreaWrapper: React.FC<SafeAreaWrapperProps> = ({
  children,
  style,
  edges = ['top', 'bottom'],
  backgroundColor = colors.background.primary,
  statusBarStyle = 'dark-content',
  statusBarBackgroundColor,
}) => {
  const insets = useSafeAreaInsets();

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor,
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  return (
    <>
      <StatusBar 
        barStyle={statusBarStyle}
        backgroundColor={statusBarBackgroundColor || backgroundColor}
        translucent={Platform.OS === 'android'}
      />
      <View style={[containerStyle, style]}>
        {children}
      </View>
    </>
  );
};

// Alternative implementation using SafeAreaView
export const SafeAreaViewWrapper: React.FC<SafeAreaWrapperProps> = ({
  children,
  style,
  backgroundColor = colors.background.primary,
  statusBarStyle = 'dark-content',
  statusBarBackgroundColor,
}) => {
  return (
    <>
      <StatusBar 
        barStyle={statusBarStyle}
        backgroundColor={statusBarBackgroundColor || backgroundColor}
      />
      <SafeAreaView style={[styles.container, { backgroundColor }, style]}>
        {children}
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
