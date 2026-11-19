import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE = "csms_session";
const ROLE_COOKIE = "csms_role";

/**
 * Role-based path prefixes.
 *
 * IMPORTANT: This middleware is a usability layer, not the security boundary.
 * Every sensitive API route re-validates the session server-side via requireRole().
 * The `csms_role` cookie is a lightweight routing hint set by the login route —
 * it is never trusted for data access, only for redirecting users to the right
 * portal when they land on the wrong one.
 */

type Role = "super_admin" | "admin" | "security" | "teacher" | "student" | "visitor";

/** Dashboard home for each role, used to redirect authenticated users. */
const ROLE_HOME: Record<Role, string> = {
  super_admin: "/super-admin/dashboard",
  admin: "/admin/dashboard",
  security: "/security/dashboard",
  teacher: "/teacher/dashboard",
  student: "/student",
  visitor: "/visitor",
};

/** Roles allowed to access each protected prefix (excluding the login page itself). */
const PREFIX_ALLOWED_ROLES: Record<string, Role[]> = {
  "/super-admin": ["super_admin"],
  "/admin": ["admin", "super_admin"],
  "/security": ["security", "admin", "super_admin"],
  "/teacher": ["teacher", "admin", "super_admin"],
};

/** Dedicated login URL for each role. */
const ROLE_LOGIN: Record<Role, string> = {
  super_admin: "/super-admin/login",
  admin: "/admin/login",
  security: "/security/login",
  teacher: "/teacher",
  student: "/login",
  visitor: "/login",
};

/** Login URL for each protected prefix. */
const PREFIX_LOGIN: Record<string, string> = {
  "/super-admin": "/super-admin/login",
  "/admin": "/admin/login",
  "/security": "/security/login",
  "/teacher": "/teacher",
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const role = (request.cookies.get(ROLE_COOKIE)?.value ?? "") as Role | "";

  // ------------------------------------------------------------------ //
  // Generic /login page handling:
  // If user is already authenticated and visits generic /login, send to their dashboard
  // ------------------------------------------------------------------ //
  if (pathname === "/login") {
    const nextParam = request.nextUrl.searchParams.get("next");
    if (!nextParam && token && role && ROLE_HOME[role as Role]) {
      const home = ROLE_HOME[role as Role];
      return NextResponse.redirect(new URL(home, request.url));
    }
    return NextResponse.next();
  }

  // ------------------------------------------------------------------ //
  // Identify which protected prefix this path falls under (if any)
  // ------------------------------------------------------------------ //
  const prefix = Object.keys(PREFIX_ALLOWED_ROLES).find((p) =>
    pathname.startsWith(p),
  );

  if (!prefix) return NextResponse.next();

  const loginPath = PREFIX_LOGIN[prefix];
  const allowedRoles = PREFIX_ALLOWED_ROLES[prefix];

  // ------------------------------------------------------------------ //
  // Special handling for login pages:
  // ------------------------------------------------------------------ //
  const isLoginPage = pathname === loginPath;
  if (isLoginPage) {
    // 1. If 'next' query parameter is present, the user was redirected here to authenticate.
    // Never redirect away from login when 'next' is present to prevent infinite loops.
    const nextParam = request.nextUrl.searchParams.get("next");
    if (nextParam) {
      return NextResponse.next();
    }

    // 2. If authenticated and accessing a DIFFERENT portal's login page,
    // redirect them to their own permitted home dashboard.
    // (e.g., Admin visiting /super-admin/login -> /admin/dashboard)
    if (token && role && ROLE_HOME[role as Role]) {
      const userLoginPath = ROLE_LOGIN[role as Role];
      if (userLoginPath && userLoginPath !== pathname) {
        const home = ROLE_HOME[role as Role];
        return NextResponse.redirect(new URL(home, request.url));
      }
    }
    return NextResponse.next();
  }

  // No session at all → send to the portal's login page
  if (!token) {
    const loginUrl = new URL(loginPath, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Session exists but no role cookie (edge case: cookie cleared or old session)
  // Let the server-side layout guard handle it; don't block here.
  if (!role) return NextResponse.next();

  // Wrong role for this portal → redirect to their permitted dashboard
  if (!(allowedRoles as string[]).includes(role)) {
    const home = ROLE_HOME[role as Role] ?? "/";
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/super-admin/:path*",
    "/admin/:path*",
    "/security/:path*",
    "/teacher/:path*",
    "/login",
  ],
};
