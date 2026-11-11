import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import CommandCenterScreen from '../screens/main/CommandCenterScreen';
import DashboardScreen from '../screens/main/DashboardScreen';
import WorkspacesScreen from '../screens/main/WorkspacesScreen';
import TimeTrackingScreen from '../screens/main/TimeTrackingScreen';
import MessagesScreen from '../screens/main/MessagesScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import { useNotifications } from '../context/NotificationsContext';
import { useAuth } from '../context/AuthContext';
import { presentLocalNotification } from '../lib/localNotifications';
import { api } from '../lib/api';
import { isPushActive } from '../lib/pushToken';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  CommandCenter: 'speedometer-outline',
  Dashboard: 'checkmark-done-outline',
  Workspaces: 'grid-outline',
  TimeTracking: 'time-outline',
  Messages: 'chatbubble-ellipses-outline',
  Notifications: 'notifications-outline',
};

// Mirrors AXETASKS/src/components/layout/Sidebar.tsx's unread-message
// polling — same 15s interval, same "only announce on an increase, and not
// on the very first poll" guard, same device-level signal now instead of a
// web toast+tone.
const UNREAD_POLL_INTERVAL_MS = 15000;

function useUnreadMessageCount(): number {
  const [unreadMessages, setUnreadMessages] = useState(0);
  const prevRef = useRef<number | null>(null);

  useEffect(() => {
    const loadUnread = () => {
      api.getConversations()
        .then(convs => {
          const total = convs.reduce((sum, c) => sum + c.unread_count, 0);
          if (prevRef.current !== null && total > prevRef.current) {
            isPushActive().then(active => {
              if (!active) presentLocalNotification('Nouveau message', undefined, { type: 'message' });
            });
          }
          prevRef.current = total;
          setUnreadMessages(total);
        })
        .catch(() => {});
    };
    loadUnread();
    const interval = setInterval(loadUnread, UNREAD_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return unreadMessages;
}

export default function MainTabs() {
  const { unreadCount: unreadNotifications } = useNotifications();
  const unreadMessages = useUnreadMessageCount();
  const isAdmin = useAuth().user?.role === 'admin';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primarySoft,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarBadgeStyle: { backgroundColor: colors.danger },
        tabBarIcon: ({ color, size }) => (
          <View>
            <Ionicons name={ICONS[route.name]} size={size} color={color} />
          </View>
        ),
      })}
    >
      {/* Centre de contrôle: global admins only (same rule as the web app). */}
      {isAdmin && <Tab.Screen name="CommandCenter" component={CommandCenterScreen} options={{ title: 'Accueil' }} />}
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Tâches' }} />
      <Tab.Screen name="Workspaces" component={WorkspacesScreen} options={{ title: 'Espaces' }} />
      <Tab.Screen name="TimeTracking" component={TimeTrackingScreen} options={{ title: 'Temps' }} />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ title: 'Messages', tabBarBadge: unreadMessages > 0 ? unreadMessages : undefined }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Alertes', tabBarBadge: unreadNotifications > 0 ? unreadNotifications : undefined }}
      />
    </Tab.Navigator>
  );
}
