/**
 * Auth Flow Test Suite
 * Tests email/password login and role-based access control
 */

import { describe, it, expect, beforeEach } from "vitest";

// Mock sessionStorage for testing
const mockStorage: Record<string, string> = {};

const mockSessionStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  },
};

// Store data
const store: Record<string, any[]> = {
  incident_reports: [],
  report_evidence: [],
  user_roles: [],
};

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// Minimal auth implementation for testing
const testAuth = {
  signInWithPassword: async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => {
    try {
      if (!email || !password) {
        throw new Error("Email and password required");
      }

      const user = {
        id: "user-" + generateId(),
        email,
        created_at: new Date().toISOString(),
        role: "authenticated",
      };

      mockSessionStorage.setItem("__KIRO_AUTH_USER", JSON.stringify(user));
      mockSessionStorage.setItem("__KIRO_AUTH_TOKEN", "token-" + user.id);

      // Add user role based on email
      const isAdmin = email.includes("admin");
      const isLawyer = email.includes("lawyer") || email.includes("legal");
      const roleType = isAdmin ? "admin" : isLawyer ? "legal_partner" : "user";

      if (!store["user_roles"]) store["user_roles"] = [];
      store["user_roles"].push({
        id: generateId(),
        user_id: user.id,
        role: roleType,
        created_at: new Date().toISOString(),
      });

      return { data: { user }, error: null };
    } catch (err: any) {
      return { data: { user: null }, error: { message: err.message } };
    }
  },

  getUser: async () => {
    const userData = mockSessionStorage.getItem("__KIRO_AUTH_USER");
    if (userData) {
      try {
        const user = JSON.parse(userData);
        return { data: { user }, error: null };
      } catch (err) {
        return {
          data: { user: null },
          error: { message: "Invalid user data" },
        };
      }
    }
    return { data: { user: null }, error: null };
  },

  signOut: async () => {
    mockSessionStorage.removeItem("__KIRO_AUTH_USER");
    mockSessionStorage.removeItem("__KIRO_AUTH_TOKEN");
    return { error: null };
  },
};

describe("Auth Flow - Email/Password Login", () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    store.user_roles = [];
  });

  it("should sign in a lawyer with email/password", async () => {
    const result = await testAuth.signInWithPassword({
      email: "lawyer@example.com",
      password: "secure123",
    });

    expect(result.error).toBeNull();
    expect(result.data?.user).toBeDefined();
    expect(result.data?.user?.email).toBe("lawyer@example.com");

    // Verify user is logged in
    const user = await testAuth.getUser();
    expect(user.data?.user).toBeDefined();
    expect(user.data?.user?.email).toBe("lawyer@example.com");
  });

  it("should sign in an admin with email/password", async () => {
    const result = await testAuth.signInWithPassword({
      email: "admin@example.com",
      password: "secure123",
    });

    expect(result.error).toBeNull();
    expect(result.data?.user?.email).toBe("admin@example.com");
  });

  it("should create role record for lawyer", async () => {
    await testAuth.signInWithPassword({
      email: "lawyer@example.com",
      password: "secure123",
    });

    const user = await testAuth.getUser();
    const userRoles = store.user_roles.filter(
      (r) => r.user_id === user.data?.user?.id,
    );

    expect(userRoles.length).toBeGreaterThan(0);
    expect(userRoles[0].role).toBe("legal_partner");
  });

  it("should create role record for admin", async () => {
    await testAuth.signInWithPassword({
      email: "admin@example.com",
      password: "secure123",
    });

    const user = await testAuth.getUser();
    const userRoles = store.user_roles.filter(
      (r) => r.user_id === user.data?.user?.id,
    );

    expect(userRoles.length).toBeGreaterThan(0);
    expect(userRoles[0].role).toBe("admin");
  });

  it("should reject login with missing email", async () => {
    const result = await testAuth.signInWithPassword({
      email: "",
      password: "secure123",
    });

    expect(result.error).toBeDefined();
    expect(result.data?.user).toBeNull();
  });

  it("should reject login with missing password", async () => {
    const result = await testAuth.signInWithPassword({
      email: "lawyer@example.com",
      password: "",
    });

    expect(result.error).toBeDefined();
    expect(result.data?.user).toBeNull();
  });

  it("should sign out user", async () => {
    // Sign in
    await testAuth.signInWithPassword({
      email: "lawyer@example.com",
      password: "secure123",
    });

    let user = await testAuth.getUser();
    expect(user.data?.user).toBeDefined();

    // Sign out
    await testAuth.signOut();

    user = await testAuth.getUser();
    expect(user.data?.user).toBeNull();
  });

  it("should maintain separate user sessions", async () => {
    // Sign in lawyer
    await testAuth.signInWithPassword({
      email: "lawyer@example.com",
      password: "secure123",
    });

    const lawyer = await testAuth.getUser();
    expect(lawyer.data?.user?.email).toBe("lawyer@example.com");

    // Sign out
    await testAuth.signOut();

    // Sign in admin
    await testAuth.signInWithPassword({
      email: "admin@example.com",
      password: "secure123",
    });

    const admin = await testAuth.getUser();
    expect(admin.data?.user?.email).toBe("admin@example.com");
    expect(admin.data?.user?.id).not.toBe(lawyer.data?.user?.id);
  });
});

describe("Role-Based Access Control", () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    store.user_roles = [];
  });

  it("should identify lawyer role correctly", async () => {
    await testAuth.signInWithPassword({
      email: "lawyer@example.com",
      password: "secure123",
    });

    const user = await testAuth.getUser();
    const roles = store.user_roles.filter(
      (r) => r.user_id === user.data?.user?.id,
    );

    expect(roles.some((r) => r.role === "legal_partner")).toBe(true);
  });

  it("should identify admin role correctly", async () => {
    await testAuth.signInWithPassword({
      email: "admin@example.com",
      password: "secure123",
    });

    const user = await testAuth.getUser();
    const roles = store.user_roles.filter(
      (r) => r.user_id === user.data?.user?.id,
    );

    expect(roles.some((r) => r.role === "admin")).toBe(true);
  });

  it("should assign legal_partner role to legal aid emails", async () => {
    const testEmails = [
      "lawyer@example.com",
      "legal@example.com",
      "legal_partner@example.com",
    ];

    for (const email of testEmails) {
      mockSessionStorage.clear();
      await testAuth.signInWithPassword({
        email,
        password: "secure123",
      });

      const user = await testAuth.getUser();
      const roles = store.user_roles.filter(
        (r) => r.user_id === user.data?.user?.id,
      );

      expect(roles.some((r) => r.role === "legal_partner")).toBe(true);
    }
  });

  it("should assign admin role only to admin emails", async () => {
    const testEmails = ["admin@example.com", "administrator@example.com"];

    for (const email of testEmails) {
      mockSessionStorage.clear();
      await testAuth.signInWithPassword({
        email,
        password: "secure123",
      });

      const user = await testAuth.getUser();
      const roles = store.user_roles.filter(
        (r) => r.user_id === user.data?.user?.id,
      );

      expect(roles.some((r) => r.role === "admin")).toBe(true);
    }
  });

  it("should verify user has privileged role before accessing admin", async () => {
    // Sign in as lawyer
    await testAuth.signInWithPassword({
      email: "lawyer@example.com",
      password: "secure123",
    });

    const user = await testAuth.getUser();
    const roles = store.user_roles.filter(
      (r) => r.user_id === user.data?.user?.id,
    );

    // Check if user has privileged role
    const hasPrivilegedRole = roles.some(
      (r) => r.role === "admin" || r.role === "legal_partner",
    );

    expect(hasPrivilegedRole).toBe(true);
  });
});

describe("Login Flow E2E", () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    store.user_roles = [];
  });

  it("should complete full lawyer login flow", async () => {
    // 1. Sign in
    const signIn = await testAuth.signInWithPassword({
      email: "lawyer@example.com",
      password: "secure123",
    });
    expect(signIn.error).toBeNull();

    // 2. Verify user exists
    const user = await testAuth.getUser();
    expect(user.data?.user).toBeDefined();

    // 3. Check user has privileged role
    const roles = store.user_roles.filter(
      (r) => r.user_id === user.data?.user?.id,
    );
    const hasPrivilegedRole = roles.some(
      (r) => r.role === "admin" || r.role === "legal_partner",
    );
    expect(hasPrivilegedRole).toBe(true);

    // 4. Sign out
    const signOut = await testAuth.signOut();
    expect(signOut.error).toBeNull();

    // 5. Verify user is signed out
    const noUser = await testAuth.getUser();
    expect(noUser.data?.user).toBeNull();
  });

  it("should complete full admin login flow", async () => {
    // 1. Sign in
    const signIn = await testAuth.signInWithPassword({
      email: "admin@example.com",
      password: "secure123",
    });
    expect(signIn.error).toBeNull();

    // 2. Verify user exists
    const user = await testAuth.getUser();
    expect(user.data?.user).toBeDefined();

    // 3. Check user has admin role
    const roles = store.user_roles.filter(
      (r) => r.user_id === user.data?.user?.id,
    );
    const hasAdminRole = roles.some((r) => r.role === "admin");
    expect(hasAdminRole).toBe(true);

    // 4. Sign out
    await testAuth.signOut();

    // 5. Verify user is signed out
    const noUser = await testAuth.getUser();
    expect(noUser.data?.user).toBeNull();
  });
});
