// Cookie utilities for instant persistent profile caching

export const getCookie = (name: string): string => {
  if (typeof document === 'undefined') return '';
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const popped = parts.pop();
    if (popped) return decodeURIComponent(popped.split(';').shift() || '');
  }
  return '';
};

export const setCookie = (name: string, value: string, days = 365) => {
  if (typeof document === 'undefined') return;
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `expires=${d.toUTCString()}`;
  document.cookie = `${name}=${encodeURIComponent(value)}; ${expires}; path=/; SameSite=Lax`;
};

export const removeCookie = (name: string) => {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
};

export interface StoredUserProfile {
  username: string;
  avatarStyle: string;
  avatarSeed: string;
}

export const getCachedUserProfile = (): StoredUserProfile | null => {
  const username = getCookie('anitok_user_name');
  const avatarStyle = getCookie('anitok_avatar_style');
  const avatarSeed = getCookie('anitok_avatar_seed');

  if (username) {
    return {
      username,
      avatarStyle: avatarStyle || 'adventurer',
      avatarSeed: avatarSeed || username,
    };
  }

  // Fallback to localStorage
  try {
    const local = localStorage.getItem('anime_user_profile');
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && parsed.username) {
        // Sync to cookies for faster sync next time
        setCookie('anitok_user_name', parsed.username);
        setCookie('anitok_avatar_style', parsed.avatarStyle || 'adventurer');
        setCookie('anitok_avatar_seed', parsed.avatarSeed || parsed.username);
        return parsed;
      }
    }
  } catch (e) {}

  return null;
};

export const saveCachedUserProfile = (profile: StoredUserProfile | null) => {
  if (!profile) {
    removeCookie('anitok_user_name');
    removeCookie('anitok_avatar_style');
    removeCookie('anitok_avatar_seed');
    try {
      localStorage.removeItem('anime_user_profile');
    } catch (e) {}
    return;
  }

  setCookie('anitok_user_name', profile.username);
  setCookie('anitok_avatar_style', profile.avatarStyle || 'adventurer');
  setCookie('anitok_avatar_seed', profile.avatarSeed || profile.username);

  try {
    localStorage.setItem('anime_user_profile', JSON.stringify(profile));
  } catch (e) {}
};
