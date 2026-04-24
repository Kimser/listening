/**
 * auth.js — Authentication module for ListenPro
 *
 * Strategy (pure frontend, GitHub Pages compatible):
 *  - users.json is the source-of-truth "cloud" password store (manually maintained)
 *  - On login: fetch users.json, verify credentials, store in sessionStorage
 *  - On protected pages: re-fetch users.json and verify stored creds match
 *  - sessionStorage is cleared on tab close (session-scoped, as required)
 */

(function () {
  'use strict';

  const AUTH_KEY = 'lp_auth';

  // Resolve the path to users.json relative to the script base
  // Works for both local file:// and GitHub Pages sub-path deployments
  function getUsersJsonUrl() {
    // Find auth.js script tag to derive base path
    const scripts = document.querySelectorAll('script[src]');
    let base = '';
    for (const s of scripts) {
      if (s.src && s.src.includes('auth.js')) {
        // Go up one directory from js/
        base = s.src.replace(/js\/auth\.js.*$/, '');
        break;
      }
    }
    if (!base) {
      // Fallback: use current page location
      base = window.location.href.replace(/[^/]*$/, '');
    }
    return base + 'users.json';
  }

  /**
   * Fetch the users list from users.json.
   * Returns a Promise<Array<{username, password}>>.
   */
  function fetchUsers() {
    const url = getUsersJsonUrl();
    return fetch(url + '?_=' + Date.now(), { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load users.json: ' + res.status);
        return res.json();
      });
  }

  /**
   * Attempt login. Returns Promise<boolean>.
   */
  function login(username, password) {
    return fetchUsers().then(function (users) {
      const match = users.find(function (u) {
        return u.username === username.trim() && u.password === password;
      });
      if (match) {
        sessionStorage.setItem(AUTH_KEY, JSON.stringify({
          username: match.username,
          password: match.password
        }));
        return true;
      }
      return false;
    });
  }

  /**
   * Get stored session credentials (or null).
   */
  function getSession() {
    try {
      const raw = sessionStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Verify current session against users.json.
   * Resolves to true if valid, false otherwise.
   */
  function verifySession() {
    const session = getSession();
    if (!session) return Promise.resolve(false);
    return fetchUsers().then(function (users) {
      return users.some(function (u) {
        return u.username === session.username && u.password === session.password;
      });
    }).catch(function () {
      // Network error: keep session alive (offline tolerance)
      return true;
    });
  }

  /**
   * Clear session and redirect to login page.
   */
  function logout() {
    sessionStorage.removeItem(AUTH_KEY);
    redirectToLogin();
  }

  /**
   * Redirect to the login page.
   * Preserves the GitHub Pages sub-path.
   */
  function redirectToLogin() {
    const base = window.location.href.replace(/[^/]*(\?.*)?$/, '');
    window.location.replace(base + 'login.html');
  }

  /**
   * Redirect to main page (index.html).
   */
  function redirectToHome() {
    const base = window.location.href.replace(/[^/]*(\?.*)?$/, '');
    window.location.replace(base + 'index.html');
  }

  /**
   * Guard function: call on every protected page load and on play/switch.
   * If session is invalid, redirects to login.
   * Returns a Promise<boolean>.
   */
  function guard(onFail) {
    return verifySession().then(function (valid) {
      if (!valid) {
        if (typeof onFail === 'function') onFail();
        else redirectToLogin();
      }
      return valid;
    });
  }

  // Expose globally
  window.Auth = {
    login: login,
    logout: logout,
    guard: guard,
    verifySession: verifySession,
    getSession: getSession,
    redirectToLogin: redirectToLogin,
    redirectToHome: redirectToHome
  };
})();
