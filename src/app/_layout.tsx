import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: colors.backgroundElement },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/signup" />
        <Stack.Screen name="item/[id]" />
        <Stack.Screen name="claim/[id]" />
        <Stack.Screen
          name="messages/[claimId]"
          options={{
            headerShown: true,
            title: 'Messages',
            headerStyle: { backgroundColor: colors.backgroundElement },
            headerTintColor: colors.text,
            headerTitleStyle: { color: colors.text },
          }}
        />
        <Stack.Screen name="staff/dashboard" />
        <Stack.Screen name="staff/verify" />
      </Stack>
    </ThemeProvider>
  );
}
