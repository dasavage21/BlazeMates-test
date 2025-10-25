import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase, SUPABASE_PROJECT_REF } from "../supabaseClient";

const SUPABASE_AUTH_TOKEN_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
const APP_AUTH_CACHE_KEYS = [
  "userProfile",
  "userAge",
  "pendingAvatarUri",
  "avatarVersion",
  "userId",
  "theme",
];

const REFRESH_ERROR_SNIPPETS = [
  "invalid refresh token",
  "refresh token not found",
  "session not found",
  "refresh_token_missing",
];

const toMessage = (error: unknown): string =>
  typeof (error as { message?: unknown })?.message === "string"
    ? ((error as { message: string }).message ?? "")
    : typeof error === "string"
    ? error
    : "";

export const isRefreshTokenError = (error: unknown): boolean => {
  const message = toMessage(error).toLowerCase();
  if (!message) return false;
  return REFRESH_ERROR_SNIPPETS.some((snippet) =>
    message.includes(snippet.toLowerCase())
  );
};

export const clearLocalAuthSession = async () => {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch (err) {
    console.warn("Failed clearing Supabase local session", err);
  }

  try {
    await AsyncStorage.removeItem(SUPABASE_AUTH_TOKEN_KEY);
  } catch (err) {
    console.warn("Failed removing Supabase auth token cache", err);
  }

  try {
    await AsyncStorage.multiRemove(APP_AUTH_CACHE_KEYS);
  } catch (err) {
    console.warn("Failed clearing app auth cache", err);
  }
};

export const handleRefreshTokenError = async (
  error: unknown
): Promise<boolean> => {
  if (!isRefreshTokenError(error)) {
    return false;
  }

  await clearLocalAuthSession();
  return true;
};
