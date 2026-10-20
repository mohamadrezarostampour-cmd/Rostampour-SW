/* =========================================================================
   Rostampour — shared role helper (classic script, loaded by the shell and
   every section).  The shell resolves the role at login and stores it in
   localStorage; sections read it from here.

   Roles
     admin     مدیر        — everything
     operator  اپراتور     — daily data entry only (no new equipment, no
                             warehouse intake, no reports / logs / settings)
     viewer    مشاهده‌گر   — read-only (no entry, no reports)

   NOTE: this controls the interface only. The real enforcement is done by
   the Firestore security rules (firestore-rules-v3.txt).
   ========================================================================= */
(function (global) {
  'use strict';
  var ADMIN_EMAIL = 'rostampour@rostampour-system.local';
  var DOMAIN = '@rostampour-system.local';
  var K_ROLE = 'rostampour-role', K_USER = 'rostampour-user';
  var ROLES = ['admin', 'operator', 'viewer'];
  var LABELS = {
    admin:    { fa: 'مدیر سامانه', en: 'Administrator' },
    operator: { fa: 'اپراتور', en: 'Operator' },
    viewer:   { fa: 'مشاهده‌گر', en: 'Viewer' }
  };
  function ls(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  var Role = {
    ADMIN_EMAIL: ADMIN_EMAIL, DOMAIN: DOMAIN, ROLES: ROLES, LABELS: LABELS,
    get: function () { var r = ls(K_ROLE); return ROLES.indexOf(r) >= 0 ? r : ''; },
    user: function () { return ls(K_USER); },
    set: function (role, user) { try { localStorage.setItem(K_ROLE, role); localStorage.setItem(K_USER, user || ''); } catch (e) { } },
    clear: function () { try { localStorage.removeItem(K_ROLE); localStorage.removeItem(K_USER); } catch (e) { } },
    emailOf: function (username) { return String(username || '').trim().toLowerCase() + DOMAIN; },
    /* role for a Firebase user object (null if the user may not use the app) */
    forUser: function (u) {
      if (!u || !u.email) return null;
      if (u.email === ADMIN_EMAIL) return 'admin';
      var r = Role.get();
      return (r === 'operator' || r === 'viewer') ? r : null;
    },
    label: function (role, fa) { var l = LABELS[role]; return l ? (fa === false ? l.en : l.fa) : ''; },
    isAdmin: function () { return Role.get() === 'admin'; },
    /* capability matrix */
    can: function (what) {
      var r = Role.get();
      switch (what) {
        case 'daily':   return r === 'admin' || r === 'operator';   // daily data entry
        case 'manage':  return r === 'admin';                       // new/edit/delete equipment, PM, CM, items …
        case 'intake':  return r === 'admin';                       // warehouse intake
        case 'report':  return r === 'admin';                       // reports & exports
        case 'log':     return r === 'admin';
        case 'view':    return !!r;
      }
      return false;
    }
  };
  global.Role = Role;
  try { document.documentElement.setAttribute('data-role', Role.get() || 'none'); } catch (e) { }
})(window);
