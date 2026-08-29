// Cookie & LocalStorage utilities for instant persistent profile and session caching

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

export interface CachedAuthUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

export const getIsAuthenticatedCached = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const local = localStorage.getItem('anitok_is_authenticated');
    if (local === 'true') return true;
    const cookie = getCookie('anitok_is_authenticated');
    if (cookie === 'true') return true;
  } catch (e) {}
  return false;
};

export const setIsAuthenticatedCached = (isAuth: boolean) => {
  if (typeof window === 'undefined') return;
  try {
    if (isAuth) {
      localStorage.setItem('anitok_is_authenticated', 'true');
      setCookie('anitok_is_authenticated', 'true', 365);
    } else {
      localStorage.removeItem('anitok_is_authenticated');
      removeCookie('anitok_is_authenticated');
    }
  } catch (e) {}
};

export const getCachedAuthUser = (): CachedAuthUser | null => {
  if (typeof window === 'undefined') return null;
  try {
    const local = localStorage.getItem('anitok_auth_user');
    if (local) {
      return JSON.parse(local);
    }
  } catch (e) {}
  return null;
};

export const saveCachedAuthUser = (user: CachedAuthUser | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem('anitok_auth_user', JSON.stringify(user));
      setCookie('anitok_auth_uid', user.uid, 365);
      if (user.email) setCookie('anitok_auth_email', user.email, 365);
    } else {
      localStorage.removeItem('anitok_auth_user');
      removeCookie('anitok_auth_uid');
      removeCookie('anitok_auth_email');
    }
  } catch (e) {}
};

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
