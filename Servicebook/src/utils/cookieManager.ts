/**
 * Simple Cookie Manager - Track user activity and preferences
 */

export const cookieManager = {
  set: (name: string, value: string, maxAgeDays = 30) => {
    const maxAge = maxAgeDays * 24 * 60 * 60;
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; path=/`;
  },

  get: (name: string): string | null => {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [key, val] = cookie.trim().split('=');
      if (key === name) return decodeURIComponent(val || '');
    }
    return null;
  },

  delete: (name: string) => {
    document.cookie = `${name}=; path=/; Max-Age=0`;
  },

  getAll: () => {
    const cookies: Record<string, string> = {};
    document.cookie.split(';').forEach((cookie) => {
      const [name, value] = cookie.trim().split('=');
      if (name) cookies[name] = decodeURIComponent(value || '');
    });
    return cookies;
  },
};

/**
 * User Activity Tracker
 */
export const activityTracker = {
  trackPageVisit: (pageName: string) => {
    const pages = cookieManager.get('visited_pages')
      ? JSON.parse(cookieManager.get('visited_pages')!)
      : [];
    if (!pages.includes(pageName)) pages.push(pageName);
    cookieManager.set('visited_pages', JSON.stringify(pages), 30);
    cookieManager.set('last_page', pageName, 30);
    
    const count = parseInt(cookieManager.get('visit_count') || '0') + 1;
    cookieManager.set('visit_count', count.toString(), 365);
  },

  trackClick: (elementName: string) => {
    const clicks = cookieManager.get('clicked_elements')
      ? JSON.parse(cookieManager.get('clicked_elements')!)
      : {};
    clicks[elementName] = (clicks[elementName] || 0) + 1;
    cookieManager.set('clicked_elements', JSON.stringify(clicks), 30);
  },

  setPreference: (key: string, value: any) => {
    const prefs = cookieManager.get('preferences')
      ? JSON.parse(cookieManager.get('preferences')!)
      : {};
    prefs[key] = value;
    cookieManager.set('preferences', JSON.stringify(prefs), 365);
  },

  getActivity: () => ({
    visitCount: parseInt(cookieManager.get('visit_count') || '0'),
    visitedPages: cookieManager.get('visited_pages')
      ? JSON.parse(cookieManager.get('visited_pages')!)
      : [],
    lastPage: cookieManager.get('last_page'),
    clicks: cookieManager.get('clicked_elements')
      ? JSON.parse(cookieManager.get('clicked_elements')!)
      : {},
    preferences: cookieManager.get('preferences')
      ? JSON.parse(cookieManager.get('preferences')!)
      : {},
  }),

  clearAll: () => {
    ['visited_pages', 'last_page', 'visit_count', 'clicked_elements', 'preferences'].forEach(
      (key) => cookieManager.delete(key)
    );
  },
};

// Expose for debugging in console
(window as any).activityTracker = activityTracker;
(window as any).cookieManager = cookieManager;
