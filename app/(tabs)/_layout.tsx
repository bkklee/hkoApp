import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ 
      headerShown: false,
      tabBarStyle: { display: 'none' }, // Hide the tab bar since there is only one page
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '天氣',
          tabBarIcon: ({ color, size }) => <Ionicons name="partly-sunny" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
