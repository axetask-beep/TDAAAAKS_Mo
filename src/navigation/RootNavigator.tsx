import React, { useEffect } from 'react';
import { NavigationContainer, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoadingScreen } from '../components/ui';
import { colors } from '../theme';
import { getModule } from '../lib/localNotifications';

import AuthScreen from '../screens/auth/AuthScreen';
import MainTabs from './MainTabs';
import WorkspaceDetailScreen from '../screens/main/WorkspaceDetailScreen';
import WorkspaceSettingsScreen from '../screens/main/WorkspaceSettingsScreen';
import ProjectDetailScreen from '../screens/main/ProjectDetailScreen';
import TaskDetailScreen from '../screens/main/TaskDetailScreen';
import CreateTaskScreen from '../screens/main/CreateTaskScreen';
import EditProjectScreen from '../screens/main/EditProjectScreen';
import ConversationScreen from '../screens/main/ConversationScreen';
import TeamManagementScreen from '../screens/main/TeamManagementScreen';
import AnnouncementsScreen from '../screens/main/AnnouncementsScreen';
import ReportsScreen from '../screens/main/ReportsScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import ProgressScreen from '../screens/main/ProgressScreen';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef<any>();

// Opens the screen a tapped notification (local or push) is about.
function openFromNotification(data: Record<string, any> | undefined) {
  if (!data || !navigationRef.isReady()) return;
  if (data.task_id) navigationRef.navigate('TaskDetail', { taskId: data.task_id });
  else if (data.conversation_id) navigationRef.navigate('Conversation', { conversationId: data.conversation_id, name: 'Conversation' });
  else if (data.type === 'message') navigationRef.navigate('MainTabs', { screen: 'Messages' });
  else if (data.type === 'announcement') navigationRef.navigate('Announcements');
  else if (data.workspace_id) navigationRef.navigate('MainTabs', { screen: 'Workspaces' });
  else navigationRef.navigate('MainTabs', { screen: 'Notifications' });
}

function useNotificationTaps(enabled: boolean) {
  useEffect(() => {
    const notifications = getModule();
    if (!enabled || !notifications) return;
    const sub = notifications.addNotificationResponseReceivedListener(r =>
      openFromNotification(r.notification.request.content.data as any));
    return () => sub.remove();
  }, [enabled]);
}

// App cold-started by tapping a notification.
function openLaunchNotification() {
  getModule()?.getLastNotificationResponseAsync()
    .then(r => {
      if (!r) return;
      getModule()?.clearLastNotificationResponseAsync?.();
      openFromNotification(r.notification.request.content.data as any);
    })
    .catch(() => {});
}

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    border: colors.border,
    primary: colors.primary,
    text: colors.textPrimary,
  },
};

const screenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { color: colors.textPrimary },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
};

export default function RootNavigator() {
  const { user, loading } = useAuth();
  useNotificationTaps(!!user);

  if (loading) return <LoadingScreen label="Chargement…" />;

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} onReady={() => { if (user) openLaunchNotification(); }}>
      <Stack.Navigator screenOptions={screenOptions}>
        {!user ? (
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="WorkspaceDetail" component={WorkspaceDetailScreen} options={{ title: '' }} />
            <Stack.Screen name="WorkspaceSettings" component={WorkspaceSettingsScreen} options={{ title: 'Paramètres' }} />
            <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} options={{ title: '' }} />
            <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: 'Tâche' }} />
            <Stack.Screen name="CreateTask" component={CreateTaskScreen} options={{ title: 'Nouvelle tâche', presentation: 'modal' }} />
            <Stack.Screen name="EditProject" component={EditProjectScreen} options={{ title: 'Modifier le projet' }} />
            <Stack.Screen name="Conversation" component={ConversationScreen} options={{ title: '' }} />
            <Stack.Screen name="TeamManagement" component={TeamManagementScreen} options={{ title: "Gestion de l'équipe" }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
            <Stack.Screen name="Progress" component={ProgressScreen} options={{ title: 'Progression' }} />
            <Stack.Screen name="Announcements" component={AnnouncementsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Reports" component={ReportsScreen} options={{ title: 'Rapports' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
