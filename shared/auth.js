// auth.js — Workhub shared auth module
// Profile button, login modal, Google OAuth, and page guard
//
// Usage:
//   1. Include Supabase CDN + supabase.js + auth.js on every page
//   2. On public pages: auth widget auto-inserts into .site-nav__inner (or first <nav>)
//   3. On admin pages: call requireAuth(callback) to guard access
//   4. Use window.adminSupabase for authenticated Supabase calls
//
(function() {
    'use strict';

    if (typeof window.supabase === 'undefined') {
        console.warn('[auth] Supabase JS SDK not loaded');
        return;
    }

    var url = window.SUPABASE_URL;
    var key = window.SUPABASE_ANON_KEY;
    if (!url || !key) {
        console.warn('[auth] SUPABASE_URL or SUPABASE_ANON_KEY not defined.');
        return;
    }

    var sb = window.supabase.createClient(url, key);
    var currentUser = null;

    // =============================================
    // HELPERS
    // =============================================

    function getInitials(name) {
        if (!name) return '?';
        var parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        return name[0].toUpperCase();
    }

    function escapeHtml(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    function showToast(message, type) {
        var existing = document.querySelector('.toast-notification');
        if (existing) existing.remove();
        var toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%) translateY(-10px);z-index:10000;padding:14px 24px;border-radius:12px;font-size:14px;font-weight:500;font-family:inherit;max-width:90vw;text-align:center;opacity:0;transition:all 0.3s ease;box-shadow:0 8px 32px rgba(0,0,0,0.12);';
        if (type === 'success') { toast.style.background = '#f0fdf4'; toast.style.color = '#166534'; toast.style.border = '1px solid #bbf7d0'; }
        else if (type === 'error') { toast.style.background = '#fef2f2'; toast.style.color = '#991b1b'; toast.style.border = '1px solid #fecaca'; }
        else { toast.style.background = '#fffbeb'; toast.style.color = '#92400e'; toast.style.border = '1px solid #fde68a'; }
        toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(function() { toast.style.opacity = '1'; toast.style.transform = 'translateX(-50%) translateY(0)'; });
        setTimeout(function() { toast.style.opacity = '0'; toast.style.transform = 'translateX(-50%) translateY(-10px)'; setTimeout(function() { toast.remove(); }, 300); }, 4000);
    }

    // =============================================
    // GOOGLE SIGN-IN
    // =============================================

    window.signInWithGoogle = function() {
        var base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '');
        // Walk up to site root for the callback URL
        var depth = (window.location.pathname.match(/\//g) || []).length - 1;
        var root = window.location.origin;
        var pathParts = window.location.pathname.split('/').filter(Boolean);
        // GitHub Pages: first path segment is the repo name
        if (pathParts.length > 0) {
            root = window.location.origin + '/' + pathParts[0];
        }
        var callbackUrl = root + '/auth/callback.html';

        sb.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: callbackUrl,
                queryParams: { access_type: 'offline', prompt: 'consent' }
            }
        }).then(function(result) {
            if (result.error) {
                showToast('Sign-in failed: ' + result.error.message, 'error');
            }
        });
    };

    // =============================================
    // PROFILE BUTTON (NAV)
    // =============================================

    function buildAuthWidget() {
        var wrapper = document.createElement('div');
        wrapper.className = 'auth-widget';
        wrapper.id = 'authWidget';
        return wrapper;
    }

    function renderLoggedOut(wrapper) {
        wrapper.innerHTML =
            '<button class="auth-btn" id="authLoginBtn" aria-label="Sign in" title="Sign in">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                    '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>' +
                    '<circle cx="12" cy="7" r="4"/>' +
                '</svg>' +
            '</button>';

        wrapper.querySelector('#authLoginBtn').addEventListener('click', function(e) {
            e.stopPropagation();
            openLoginModal();
        });
    }

    function renderLoggedIn(wrapper, user) {
        var displayName = (user.user_metadata && user.user_metadata.full_name) || user.email;
        var avatarUrl = user.user_metadata && user.user_metadata.avatar_url;
        var initials = getInitials(displayName);

        var adminHref = 'admin/index.html';
        if (window.location.pathname.indexOf('/admin/') !== -1) {
            adminHref = '../admin/index.html';
        }

        var avatarHtml = avatarUrl
            ? '<img src="' + escapeHtml(avatarUrl) + '" alt="' + escapeHtml(displayName) + '" class="auth-avatar auth-avatar--photo" id="authAvatarBtn" style="width:32px;height:32px;border-radius:50%;object-fit:cover;cursor:pointer;border:2px solid var(--aap-gold);">'
            : '<button class="auth-avatar auth-avatar--initials" id="authAvatarBtn" aria-haspopup="true" aria-expanded="false" title="' + escapeHtml(displayName) + '">' + initials + '</button>';

        wrapper.innerHTML =
            avatarHtml +
            '<div class="auth-dropdown" id="authDropdown">' +
                '<div class="auth-dropdown__user">' + escapeHtml(displayName) + '</div>' +
                '<div class="auth-dropdown__divider"></div>' +
                '<a href="' + adminHref + '" class="auth-dropdown__item">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>' +
                    '<span>Admin</span>' +
                '</a>' +
                '<button class="auth-dropdown__item auth-dropdown__signout" id="authSignOutBtn">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
                    '<span>Sign Out</span>' +
                '</button>' +
            '</div>';

        var avatarBtn = wrapper.querySelector('#authAvatarBtn');
        var dropdown = wrapper.querySelector('#authDropdown');

        avatarBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            var isOpen = dropdown.classList.contains('auth-dropdown--open');
            dropdown.classList.toggle('auth-dropdown--open', !isOpen);
            if (avatarBtn.setAttribute) avatarBtn.setAttribute('aria-expanded', !isOpen);
        });

        document.addEventListener('click', function() {
            dropdown.classList.remove('auth-dropdown--open');
            if (avatarBtn.setAttribute) avatarBtn.setAttribute('aria-expanded', 'false');
        });

        wrapper.querySelector('#authSignOutBtn').addEventListener('click', function(e) {
            e.stopPropagation();
            sb.auth.signOut().then(function() {
                currentUser = null;
                renderLoggedOut(wrapper);
                showToast('Signed out', 'success');
                if (window.location.pathname.indexOf('/admin/') !== -1) {
                    window.location.href = '../index.html';
                }
            });
        });
    }

    // =============================================
    // LOGIN MODAL (email/password fallback)
    // =============================================

    function openLoginModal() {
        var existing = document.getElementById('authModal');
        if (existing) existing.remove();

        var modal = document.createElement('div');
        modal.className = 'auth-modal';
        modal.id = 'authModal';
        modal.innerHTML =
            '<div class="auth-modal__backdrop" id="authModalBackdrop"></div>' +
            '<div class="auth-modal__card">' +
                '<button class="auth-modal__close" id="authModalClose" aria-label="Close">&times;</button>' +
                '<div class="auth-modal__header">' +
                    '<h2 class="auth-modal__title">Sign In</h2>' +
                    '<p class="auth-modal__subtitle">Practitioner access only</p>' +
                '</div>' +
                '<button class="auth-modal__google" id="authGoogleBtn" type="button">' +
                    '<svg width="18" height="18" viewBox="0 0 48 48" style="flex-shrink:0">' +
                        '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
                        '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
                        '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
                        '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>' +
                    '</svg>' +
                    'Continue with Google' +
                '</button>' +
                '<div class="auth-modal__divider"><span>or</span></div>' +
                '<form class="auth-modal__form" id="authLoginForm">' +
                    '<div class="auth-modal__field">' +
                        '<label for="authEmail">Email</label>' +
                        '<input type="email" id="authEmail" required autocomplete="email" placeholder="you@example.com">' +
                    '</div>' +
                    '<div class="auth-modal__field">' +
                        '<label for="authPassword">Password</label>' +
                        '<input type="password" id="authPassword" required autocomplete="current-password" placeholder="Password">' +
                    '</div>' +
                    '<div class="auth-modal__error" id="authError"></div>' +
                    '<button type="submit" class="auth-modal__submit" id="authSubmitBtn">Sign In</button>' +
                '</form>' +
            '</div>';

        document.body.appendChild(modal);

        document.getElementById('authModalBackdrop').addEventListener('click', closeLoginModal);
        document.getElementById('authModalClose').addEventListener('click', closeLoginModal);
        document.addEventListener('keydown', handleModalEsc);

        document.getElementById('authGoogleBtn').addEventListener('click', function() {
            closeLoginModal();
            window.signInWithGoogle();
        });

        document.getElementById('authLoginForm').addEventListener('submit', function(e) {
            e.preventDefault();
            var email = document.getElementById('authEmail').value.trim();
            var password = document.getElementById('authPassword').value;
            var errorEl = document.getElementById('authError');
            var submitBtn = document.getElementById('authSubmitBtn');

            errorEl.textContent = '';
            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in\u2026';

            sb.auth.signInWithPassword({ email: email, password: password }).then(function(result) {
                if (result.error) {
                    errorEl.textContent = result.error.message || 'Invalid credentials';
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Sign In';
                    return;
                }
                currentUser = result.data.user;
                closeLoginModal();
                var widget = document.getElementById('authWidget');
                if (widget) renderLoggedIn(widget, currentUser);
                showToast('Signed in successfully', 'success');
            }).catch(function() {
                errorEl.textContent = 'Something went wrong. Please try again.';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign In';
            });
        });

        requestAnimationFrame(function() { modal.classList.add('auth-modal--open'); });
    }

    function closeLoginModal() {
        var modal = document.getElementById('authModal');
        if (!modal) return;
        modal.classList.remove('auth-modal--open');
        document.removeEventListener('keydown', handleModalEsc);
        setTimeout(function() { modal.remove(); }, 250);
    }

    function handleModalEsc(e) {
        if (e.key === 'Escape') closeLoginModal();
    }

    // =============================================
    // ADMIN PAGE GUARD
    // =============================================

    /**
     * Guard an admin page. If not authenticated, redirects to login.html.
     * @param {Function} callback - Called with (user, supabaseClient) when authenticated.
     */
    window.requireAuth = function(callback) {
        // Show loading state immediately
        var body = document.body;
        body.style.visibility = 'hidden';

        sb.auth.getSession().then(function(result) {
            if (result.data.session && result.data.session.user) {
                currentUser = result.data.session.user;
                body.style.visibility = 'visible';
                if (callback) callback(currentUser, sb);
            } else {
                window.location.href = '../login.html';
            }
        });
    };

    window.adminSupabase = sb;

    // =============================================
    // INIT (public pages)
    // =============================================

    function insertAuthWidget() {
        var navInner = document.querySelector('.site-nav__inner') ||
                       (document.querySelector('nav') && document.querySelector('nav').firstElementChild);
        if (!navInner) return;

        var widget = buildAuthWidget();
        navInner.appendChild(widget);

        sb.auth.getSession().then(function(result) {
            if (result.data.session && result.data.session.user) {
                currentUser = result.data.session.user;
                renderLoggedIn(widget, currentUser);
            } else {
                renderLoggedOut(widget);
            }
        }).catch(function() {
            renderLoggedOut(widget);
        });

        sb.auth.onAuthStateChange(function(event, session) {
            if (event === 'SIGNED_IN' && session && session.user) {
                currentUser = session.user;
                renderLoggedIn(widget, session.user);
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                renderLoggedOut(widget);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', insertAuthWidget);
    } else {
        insertAuthWidget();
    }
})();
