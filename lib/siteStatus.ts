import { supabase } from '../supabaseClient';

export type SiteStatusType = 'warning' | 'info' | 'error';

export interface SiteStatus {
  enabled: boolean;
  message: string;
  type: SiteStatusType;
}

const DEFAULT_STATUS: SiteStatus = {
  enabled: false,
  message: "We're currently experiencing technical difficulties. Please check back soon.",
  type: 'warning',
};

export async function fetchSiteStatus(): Promise<SiteStatus> {
  try {
    const { data, error } = await supabase
      .from('site_status')
      .select('enabled, message, type')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_STATUS;
    }

    return {
      enabled: data.enabled,
      message: data.message,
      type: data.type as SiteStatusType,
    };
  } catch (err) {
    console.warn('Failed to fetch site status', err);
    return DEFAULT_STATUS;
  }
}
