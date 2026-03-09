import { Redirect } from 'expo-router';

// Entry point: redirect straight into the tab navigator
export default function Index() {
  return <Redirect href="/(tabs)/" />;
}
