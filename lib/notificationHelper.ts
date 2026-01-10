import { Platform } from 'react-native';

export const showChatNotification = (senderName: string, message: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if ('Notification' in window && window.Notification && window.Notification.permission === 'granted') {
      new window.Notification(`New message from ${senderName}`, {
        body: message,
        icon: '/icon.png',
      });
    }
  }
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window && window.Notification) {
    if (window.Notification.permission === 'granted') {
      return true;
    }

    if (window.Notification.permission !== 'denied') {
      const permission = await window.Notification.requestPermission();
      return permission === 'granted';
    }
  }

  return false;
};
