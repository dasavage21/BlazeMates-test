// Global type declarations for web APIs in React Native

declare global {
  interface Window {
    confirm: (message?: string) => boolean;
    alert: (message?: string) => void;
    prompt: (message?: string, defaultValue?: string) => string | null;
    location: Location;
    Notification: typeof Notification;
  }

  interface Blob {
    arrayBuffer(): Promise<ArrayBuffer>;
  }

  const window: Window | undefined;
  const atob: ((data: string) => string) | undefined;
  const crypto: Crypto | undefined;
  const TextEncoder: typeof TextEncoder | undefined;
  const Buffer: any;

  class TextEncoder {
    encode(input?: string): Uint8Array;
  }

  interface Crypto {
    subtle: SubtleCrypto;
  }

  interface SubtleCrypto {
    digest(algorithm: string, data: BufferSource): Promise<ArrayBuffer>;
  }

  class Notification {
    constructor(title: string, options?: NotificationOptions);
    static permission: NotificationPermission;
    static requestPermission(): Promise<NotificationPermission>;
  }

  interface NotificationOptions {
    body?: string;
    icon?: string;
  }

  type NotificationPermission = 'default' | 'denied' | 'granted';
}

export {};
