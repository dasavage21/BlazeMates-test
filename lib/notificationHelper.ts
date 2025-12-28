import { Platform } from 'react-native';

export const showChatNotification = (senderName: string, message: string) => {
  if (Platform.OS === 'web') {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`New message from ${senderName}`, {
        body: message,
        icon: '/icon.png',
      });
    }
  }
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'web' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
  }

  return false;
};
