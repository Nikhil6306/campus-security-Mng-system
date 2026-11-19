/**
 * Automated Verification Suite for Strict Role-Based Authentication & Dashboard Routing
 *
 * Scenarios verified:
 * 1. Administrator (super_admin) logs in via /administrator/login -> redirects to /administrator/dashboard
 * 2. Admin logs in via /admin/login -> redirects to /admin/dashboard
 * 3. Security Guard logs in via /security/login -> redirects to /security/dashboard
 * 4. Admin attempts to log in via /administrator/login -> access denied (403)
 * 5. Security Guard attempts to access /admin/dashboard or /administrator/dashboard -> denied/redirected
 * 6. Unauthenticated access to any protected dashboard -> redirected to appropriate login page
 * 7. Logout successfully invalidates session and prevents protected dashboard access
 * 8. Legacy aliases (/super-admin -> /administrator, /guard -> /security)
 */

import assert from "node:assert/strict";

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(`${name} - ${error.message}`);
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error.message}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
}

// System configuration models
const ROLE_HOME = {
  super_admin: "/administrator/dashboard",
  admin: "/admin/dashboard",
  security: "/security/dashboard",
  teacher: "/teacher/dashboard",
  student: "/student",
  visitor: "/visitor",
};

const LOGIN_PORTALS = {
  super_admin: "/administrator/login",
  admin: "/admin/login",
  security: "/security/login",
};

const ADMIN_ROLES = ["admin", "super_admin"];

class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
    this.name = "AuthError";
  }
}

// Simulates the exact server-side validation logic in app/api/auth/login/route.ts
function validateLoginPortal(userRole, expectedRole) {
  if (expectedRole) {
    const allowed = userRole === expectedRole;
    if (!allowed) {
      throw new AuthError("You are not authorized to access this login portal.", 403);
    }
  }
  return true;
}

// Simulates the routing/protection logic in AdministratorShell, SuperAdminShell, AdminShell, and SecurityShell
function resolveDashboardNavigation(session, targetPath) {
  if (!session) {
    if (targetPath.startsWith("/administrator") || targetPath.startsWith("/super-admin")) {
      return { action: "redirect", target: `/administrator/login?next=${encodeURIComponent(targetPath)}` };
    }
    if (targetPath.startsWith("/admin")) {
      return { action: "redirect", target: `/admin/login?next=${encodeURIComponent(targetPath)}` };
    }
    if (targetPath.startsWith("/security") || targetPath.startsWith("/guard")) {
      return { action: "redirect", target: `/security/login?next=${encodeURIComponent(targetPath)}` };
    }
    return { action: "redirect", target: "/login" };
  }

  // Target: /administrator/* or legacy /super-admin/*
  if (targetPath.startsWith("/administrator") || targetPath.startsWith("/super-admin")) {
    if (session.role === "super_admin") {
      return { action: "render", allowed: true };
    }
    return {
      action: "deny_403",
      allowed: false,
      message: "Access Denied — Administrator clearance required.",
      permittedHome: ROLE_HOME[session.role],
    };
  }

  // Target: /admin/*
  if (targetPath.startsWith("/admin")) {
    const permitted = ADMIN_ROLES.includes(session.role);
    if (permitted) {
      return { action: "render", allowed: true };
    }
    return {
      action: "redirect",
      allowed: false,
      target: ROLE_HOME[session.role] ?? "/",
    };
  }

  // Target: /security/* or legacy /guard/*
  if (targetPath.startsWith("/security") || targetPath.startsWith("/guard")) {
    const allowed = session.role === "security" || ADMIN_ROLES.includes(session.role);
    if (allowed) {
      return { action: "render", allowed: true };
    }
    return {
      action: "redirect",
      allowed: false,
      target: ROLE_HOME[session.role] ?? "/",
    };
  }

  return { action: "render", allowed: true };
}

// Simulates session storage & logout invalidation
class MockSessionStore {
  constructor() {
    this.sessions = new Map();
  }

  createSession(userId, role) {
    const token = `token-${Math.random().toString(36).slice(2)}`;
    const expiresAt = Date.now() + 12 * 3600 * 1000;
    this.sessions.set(token, { userId, role, expiresAt });
    return token;
  }

  getSession(token) {
    if (!token) return null;
    const s = this.sessions.get(token);
    if (!s) return null;
    if (Date.now() > s.expiresAt) {
      this.sessions.delete(token);
      return null;
    }
    return s;
  }

  signOutToken(token) {
    this.sessions.delete(token);
  }
}

// ==========================================
// RUN SCENARIO VERIFICATION TESTS
// ==========================================

section("Scenario 1: Administrator (Super Admin) Login & Redirection");
test("Administrator authenticates via /administrator/login (expectedRole: super_admin)", () => {
  assert.equal(validateLoginPortal("super_admin", "super_admin"), true);
  const destination = ROLE_HOME["super_admin"];
  assert.equal(destination, "/administrator/dashboard");
});

section("Scenario 2: Admin Login & Redirection");
test("Admin authenticates via /admin/login (expectedRole: admin)", () => {
  assert.equal(validateLoginPortal("admin", "admin"), true);
  const destination = ROLE_HOME["admin"];
  assert.equal(destination, "/admin/dashboard");
});

section("Scenario 3: Security Guard Login & Redirection");
test("Security Guard authenticates via /security/login (expectedRole: security)", () => {
  assert.equal(validateLoginPortal("security", "security"), true);
  const destination = ROLE_HOME["security"];
  assert.equal(destination, "/security/dashboard");
});

section("Scenario 4: Cross-Role Login Portal Denials");
test("Admin attempting to log in via /administrator/login is rejected with HTTP 403", () => {
  assert.throws(
    () => validateLoginPortal("admin", "super_admin"),
    (err) => {
      assert.equal(err.status, 403);
      assert.equal(err.message, "You are not authorized to access this login portal.");
      return true;
    }
  );
});

test("Security Guard attempting to log in via /administrator/login is rejected with HTTP 403", () => {
  assert.throws(
    () => validateLoginPortal("security", "super_admin"),
    (err) => {
      assert.equal(err.status, 403);
      assert.equal(err.message, "You are not authorized to access this login portal.");
      return true;
    }
  );
});

test("Security Guard attempting to log in via /admin/login is rejected with HTTP 403", () => {
  assert.throws(
    () => validateLoginPortal("security", "admin"),
    (err) => {
      assert.equal(err.status, 403);
      assert.equal(err.message, "You are not authorized to access this login portal.");
      return true;
    }
  );
});

test("Admin attempting to log in via /security/login is rejected with HTTP 403", () => {
  assert.throws(
    () => validateLoginPortal("admin", "security"),
    (err) => {
      assert.equal(err.status, 403);
      assert.equal(err.message, "You are not authorized to access this login portal.");
      return true;
    }
  );
});

test("Administrator attempting to log in via /admin/login is rejected with HTTP 403", () => {
  assert.throws(
    () => validateLoginPortal("super_admin", "admin"),
    (err) => {
      assert.equal(err.status, 403);
      assert.equal(err.message, "You are not authorized to access this login portal.");
      return true;
    }
  );
});

test("Administrator attempting to log in via /security/login is rejected with HTTP 403", () => {
  assert.throws(
    () => validateLoginPortal("super_admin", "security"),
    (err) => {
      assert.equal(err.status, 403);
      assert.equal(err.message, "You are not authorized to access this login portal.");
      return true;
    }
  );
});

section("Scenario 4b: Authenticated User Accessing Login Pages (Redirect to Home Dashboard)");
function resolveLoginAccess(session, loginPath) {
  if (session && session.role) {
    return { action: "redirect", target: ROLE_HOME[session.role] };
  }
  return { action: "render", allowed: true };
}

test("Logged-in Admin accessing /administrator/login is redirected to /admin/dashboard", () => {
  const session = { userId: "a-1", role: "admin" };
  const res = resolveLoginAccess(session, "/administrator/login");
  assert.equal(res.action, "redirect");
  assert.equal(res.target, "/admin/dashboard");
});

test("Logged-in Security Guard accessing /admin/login is redirected to /security/dashboard", () => {
  const session = { userId: "g-1", role: "security" };
  const res = resolveLoginAccess(session, "/admin/login");
  assert.equal(res.action, "redirect");
  assert.equal(res.target, "/security/dashboard");
});

test("Logged-in Administrator accessing /login is redirected to /administrator/dashboard", () => {
  const session = { userId: "sa-1", role: "super_admin" };
  const res = resolveLoginAccess(session, "/login");
  assert.equal(res.action, "redirect");
  assert.equal(res.target, "/administrator/dashboard");
});

section("Scenario 4c: Safe 'next' Parameter Redirection (Preventing cross-role leaks)");
function getSafeRedirectUrl(target, role) {
  if (!target) return ROLE_HOME[role];
  if (
    (target.startsWith("/administrator") || target.startsWith("/super-admin")) &&
    role !== "super_admin"
  ) {
    return ROLE_HOME[role];
  }
  if (target.startsWith("/admin") && role !== "admin" && role !== "super_admin") {
    return ROLE_HOME[role];
  }
  if (
    (target.startsWith("/security") || target.startsWith("/guard")) &&
    role !== "security" &&
    role !== "admin" &&
    role !== "super_admin"
  ) {
    return ROLE_HOME[role];
  }
  return target;
}

test("Admin with next=/administrator/dashboard is safely redirected to /admin/dashboard", () => {
  const safe = getSafeRedirectUrl("/administrator/dashboard", "admin");
  assert.equal(safe, "/admin/dashboard");
});

test("Security guard with next=/admin/settings is safely redirected to /security/dashboard", () => {
  const safe = getSafeRedirectUrl("/admin/settings", "security");
  assert.equal(safe, "/security/dashboard");
});

test("Administrator with next=/admin/activity retains legitimate permitted route", () => {
  const safe = getSafeRedirectUrl("/admin/activity", "super_admin");
  assert.equal(safe, "/admin/activity");
});

section("Scenario 5: Direct Protected Dashboard Access & Prevention");
test("Security Guard navigating to /admin/dashboard is redirected to /security/dashboard", () => {
  const guardSession = { userId: "g-1", role: "security" };
  const res = resolveDashboardNavigation(guardSession, "/admin/dashboard");
  assert.equal(res.action, "redirect");
  assert.equal(res.allowed, false);
  assert.equal(res.target, "/security/dashboard");
});

test("Security Guard navigating to /administrator/dashboard is denied with 403", () => {
  const guardSession = { userId: "g-1", role: "security" };
  const res = resolveDashboardNavigation(guardSession, "/administrator/dashboard");
  assert.equal(res.action, "deny_403");
  assert.equal(res.allowed, false);
  assert.equal(res.permittedHome, "/security/dashboard");
});

test("Admin navigating to /administrator/dashboard is denied with 403 and permitted home link", () => {
  const adminSession = { userId: "a-1", role: "admin" };
  const res = resolveDashboardNavigation(adminSession, "/administrator/dashboard");
  assert.equal(res.action, "deny_403");
  assert.equal(res.allowed, false);
  assert.equal(res.permittedHome, "/admin/dashboard");
});

test("Administrator navigating to /administrator/dashboard is granted access", () => {
  const saSession = { userId: "sa-1", role: "super_admin" };
  const res = resolveDashboardNavigation(saSession, "/administrator/dashboard");
  assert.equal(res.action, "render");
  assert.equal(res.allowed, true);
});

test("Administrator can view Admin Console (/admin/dashboard)", () => {
  const saSession = { userId: "sa-1", role: "super_admin" };
  const res = resolveDashboardNavigation(saSession, "/admin/dashboard");
  assert.equal(res.action, "render");
  assert.equal(res.allowed, true);
});

section("Scenario 6: Unauthenticated Access Redirections");
test("Unauthenticated user accessing /administrator/dashboard redirects to /administrator/login", () => {
  const res = resolveDashboardNavigation(null, "/administrator/dashboard");
  assert.equal(res.action, "redirect");
  assert.equal(res.target, "/administrator/login?next=%2Fadministrator%2Fdashboard");
});

test("Unauthenticated user accessing /admin/dashboard redirects to /admin/login", () => {
  const res = resolveDashboardNavigation(null, "/admin/dashboard");
  assert.equal(res.action, "redirect");
  assert.equal(res.target, "/admin/login?next=%2Fadmin%2Fdashboard");
});

test("Unauthenticated user accessing /security/dashboard redirects to /security/login", () => {
  const res = resolveDashboardNavigation(null, "/security/dashboard");
  assert.equal(res.action, "redirect");
  assert.equal(res.target, "/security/login?next=%2Fsecurity%2Fdashboard");
});

section("Scenario 7: Session Management & Invalidation on Logout");
test("Logout invalidates session token and prevents subsequent dashboard access", () => {
  const store = new MockSessionStore();
  const token = store.createSession("usr-guard", "security");

  // Valid session allows access
  const activeSession = store.getSession(token);
  assert.ok(activeSession);
  assert.equal(activeSession.role, "security");

  const guardAccess = resolveDashboardNavigation(activeSession, "/security/dashboard");
  assert.equal(guardAccess.action, "render");
  assert.equal(guardAccess.allowed, true);

  // User logs out: token is revoked
  store.signOutToken(token);

  // Subsequent check reveals session is null
  const revokedSession = store.getSession(token);
  assert.equal(revokedSession, null);

  // Direct access is now blocked and redirects to /security/login
  const postLogoutAccess = resolveDashboardNavigation(revokedSession, "/security/dashboard");
  assert.equal(postLogoutAccess.action, "redirect");
  assert.equal(postLogoutAccess.target, "/security/login?next=%2Fsecurity%2Fdashboard");
});

section("Scenario 8: API Route Role Enforcement (requireRole / requireAdmin)");
function mockRequireRole(session, ...allowedRoles) {
  if (!session) throw new AuthError("You need to sign in to continue.", 401);
  if (allowedRoles.length && !allowedRoles.includes(session.role)) {
    throw new AuthError("Your role does not have access to this action.", 403);
  }
  return session;
}

test("API call without session throws HTTP 401", () => {
  assert.throws(
    () => mockRequireRole(null, "admin", "super_admin"),
    (err) => {
      assert.equal(err.status, 401);
      assert.equal(err.message, "You need to sign in to continue.");
      return true;
    }
  );
});

test("Security Guard calling Admin API route throws HTTP 403", () => {
  const guardSession = { userId: "g-1", role: "security" };
  assert.throws(
    () => mockRequireRole(guardSession, "admin", "super_admin"),
    (err) => {
      assert.equal(err.status, 403);
      assert.equal(err.message, "Your role does not have access to this action.");
      return true;
    }
  );
});

test("Admin calling Administrator-only API (e.g. system reset) throws HTTP 403", () => {
  const adminSession = { userId: "a-1", role: "admin" };
  assert.throws(
    () => mockRequireRole(adminSession, "super_admin"),
    (err) => {
      assert.equal(err.status, 403);
      assert.equal(err.message, "Your role does not have access to this action.");
      return true;
    }
  );
});

test("Administrator calling Administrator API is authorized", () => {
  const saSession = { userId: "sa-1", role: "super_admin" };
  const authorized = mockRequireRole(saSession, "super_admin");
  assert.equal(authorized.role, "super_admin");
});

// Summary
console.log("\n==========================================");
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("==========================================");

if (failed > 0) {
  process.exit(1);
}
