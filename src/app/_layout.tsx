import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/signup" />
        <Stack.Screen name="item/[id]" />
        <Stack.Screen name="claim/[id]" />
        <Stack.Screen name="messages/[claimId]" options={{ headerShown: true, title: 'Messages' }} />
        <Stack.Screen name="staff/dashboard" />
        <Stack.Screen name="staff/verify" />
      </Stack>
    </ThemeProvider>
  );
}
