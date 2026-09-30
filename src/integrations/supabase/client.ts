// Accountability Watch - Database Client
// Uses local in-memory database for development

import type { Database } from "./types";

// Simple in-memory store
const store: Record<string, any[]> = {
  incident_reports: [],
  report_evidence: [],
  user_roles: [],
};

// Expose to window for debugging
if (typeof window !== "undefined") {
  (window as any).__KIRO_REPORTS_STORE = store;
  (window as any).__KIRO_VIEW_REPORTS = () => {
    console.log("📊 ALL SUBMITTED REPORTS:\n");
    console.table(store.incident_reports);
    return store.incident_reports;
  };
  (window as any).__KIRO_VIEW_USERS = () => {
    console.log("👥 ALL USER ROLES:\n");
    console.table(store.user_roles);
    return store.user_roles;
  };
}

function generateId(): string {
  return crypto.randomUUID();
}

// Build query result object
function buildQueryResult(table: string, data: any, fields?: string[]) {
  if (fields && fields.length > 0) {
    return fields.reduce((acc: any, field) => {
      acc[field] = data[field];
      return acc;
    }, {});
  }
  return data;
}

export const supabase = {
  from: (table: string) => ({
    insert: (data: any) => {
      // Create object that's both thenable and has select method
      const chainable = {
        select: (fields?: string) => {
          const fieldsList = fields
            ? fields.split(",").map((f) => f.trim())
            : undefined;
          return {
            single: async () => {
              try {
                const record = Array.isArray(data) ? data[0] : data;
                const fullRecord = {
                  id: record.id || generateId(),
                  ...record,
                  report_code: record.report_code || `REC-${Date.now()}`,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };

                if (!store[table]) store[table] = [];
                store[table].push(fullRecord);

                console.log(`✅ Inserted into ${table}:`, fullRecord.id);

                const result = fieldsList
                  ? buildQueryResult(table, fullRecord, fieldsList)
                  : fullRecord;

                return { data: result, error: null };
              } catch (err: any) {
                console.error("Insert error:", err);
                return { data: null, error: { message: err.message } };
              }
            },
          };
        },
        // Make it thenable for .then() chains
        then: function (callback: any) {
          try {
            const record = Array.isArray(data) ? data[0] : data;
            const fullRecord = {
              id: record.id || generateId(),
              ...record,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            if (!store[table]) store[table] = [];
            store[table].push(fullRecord);

            console.log(`✅ Inserted into ${table}:`, fullRecord.id);

            if (typeof callback === "function") {
              return Promise.resolve(
                callback({ data: fullRecord, error: null }),
              );
            }
            return Promise.resolve({ data: fullRecord, error: null });
          } catch (err: any) {
            console.error("Insert error:", err);
            const result = { data: null, error: { message: err.message } };
            if (typeof callback === "function") {
              return Promise.resolve(callback(result));
            }
            return Promise.resolve(result);
          }
        },
      };
      return chainable as any;
    },

    select: (fields?: string) => ({
      eq: (field: string, value: any) => ({
        single: async () => {
          try {
            const items = (store[table] || []).filter(
              (item) => item[field] === value,
            );
            if (items.length === 0) return { data: null, error: null };

            const fieldsList = fields
              ? fields.split(",").map((f) => f.trim())
              : undefined;
            const result = fieldsList
              ? buildQueryResult(table, items[0], fieldsList)
              : items[0];

            return { data: result, error: null };
          } catch (err: any) {
            return { data: null, error: { message: err.message } };
          }
        },
      }),
      // For fetching multiple rows (like all roles for a user)
      async: () => async () => {
        try {
          const items = store[table] || [];
          const fieldsList = fields
            ? fields.split(",").map((f) => f.trim())
            : undefined;

          const results = items.map((item) =>
            fieldsList ? buildQueryResult(table, item, fieldsList) : item,
          );

          return { data: results, error: null };
        } catch (err: any) {
          return { data: null, error: { message: err.message } };
        }
      },
    }),

    // Generic select without eq filter
    select: (fields?: string) => {
      // This handles the case from route.tsx: .from("user_roles").select("role").eq("user_id", user.id)
      const fieldsList = fields
        ? fields.split(",").map((f) => f.trim())
        : undefined;

      return {
        eq: (field: string, value: any) => {
          return {
            then: async (callback: any) => {
              try {
                const items = (store[table] || []).filter(
                  (item) => item[field] === value,
                );
                const results = items.map((item) =>
                  fieldsList ? buildQueryResult(table, item, fieldsList) : item,
                );

                const result = { data: results, error: null };
                if (typeof callback === "function") {
                  return callback(result);
                }
                return result;
              } catch (err: any) {
                const result = { data: null, error: { message: err.message } };
                if (typeof callback === "function") {
                  return callback(result);
                }
                return result;
              }
            },
            // Also support async/await
            catch: function (errCallback: any) {
              return this;
            },
            // Support Promise-like chaining
            async: () => async () => {
              try {
                const items = (store[table] || []).filter(
                  (item) => item[field] === value,
                );
                const results = items.map((item) =>
                  fieldsList ? buildQueryResult(table, item, fieldsList) : item,
                );
                return { data: results, error: null };
              } catch (err: any) {
                return { data: null, error: { message: err.message } };
              }
            },
          };
        },
      };
    },

    update: (updates: any) => ({
      eq: (field: string, value: any) => ({
        then: async (callback: any) => {
          try {
            const items = store[table] || [];
            let updated = false;
            items.forEach((item) => {
              if (item[field] === value) {
                Object.assign(item, updates, {
                  updated_at: new Date().toISOString(),
                });
                updated = true;
              }
            });

            if (updated) {
              console.log(`✅ Updated ${table} where ${field} = ${value}`);
              return { data: null, error: null };
            }
            return { data: null, error: null };
          } catch (err: any) {
            return { data: null, error: { message: err.message } };
          }
        },
      }),
    }),
  }),

  storage: {
    from: (bucket: string) => ({
      upload: async (path: string, file: any, options?: any) => {
        try {
          if (!file) throw new Error("No file provided");
          if (!path) throw new Error("No path specified");
          console.log(
            `✅ Uploaded ${file.name || "file"} to ${bucket}/${path}`,
          );
          return { data: { path }, error: null };
        } catch (err: any) {
          console.error("Upload error:", err);
          return { data: null, error: { message: err.message } };
        }
      },
      download: async (path: string) => {
        return { data: null, error: { message: "File not found" } };
      },
      remove: async (paths: string[]) => {
        return { data: null, error: null };
      },
    }),
  },

  auth: {
    getSession: async () => {
      // Check if user is logged in (stored in sessionStorage)
      const userData = sessionStorage.getItem("__KIRO_AUTH_USER");
      if (userData) {
        try {
          const user = JSON.parse(userData);
          return {
            data: {
              session: {
                user,
                access_token:
                  sessionStorage.getItem("__KIRO_AUTH_TOKEN") ||
                  "token-" + user.id,
              },
            },
            error: null,
          };
        } catch (err) {
          return { data: { session: null }, error: null };
        }
      }
      return { data: { session: null }, error: null };
    },

    getUser: async () => {
      // Check if user is logged in
      const userData = sessionStorage.getItem("__KIRO_AUTH_USER");
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

        // Create a mock user (in production this would verify against a real auth service)
        const user = {
          id: "user-" + generateId(),
          email,
          created_at: new Date().toISOString(),
          role: "authenticated",
        };

        // Store user session
        sessionStorage.setItem("__KIRO_AUTH_USER", JSON.stringify(user));
        sessionStorage.setItem("__KIRO_AUTH_TOKEN", "token-" + user.id);

        // Add user role (lawyer/admin for testing)
        const isAdmin = email.includes("admin");
        const isLawyer = email.includes("lawyer") || email.includes("legal");

        const roleType = isAdmin
          ? "admin"
          : isLawyer
            ? "legal_partner"
            : "user";

        if (!store["user_roles"]) store["user_roles"] = [];
        store["user_roles"].push({
          id: generateId(),
          user_id: user.id,
          role: roleType,
          created_at: new Date().toISOString(),
        });

        console.log(`✅ User signed in: ${email} (role: ${roleType})`);
        return { data: { user }, error: null };
      } catch (err: any) {
        console.error("Auth error:", err);
        return { data: { user: null }, error: { message: err.message } };
      }
    },

    signUp: async ({ email, password, options }: any) => {
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

        sessionStorage.setItem("__KIRO_AUTH_USER", JSON.stringify(user));
        sessionStorage.setItem("__KIRO_AUTH_TOKEN", "token-" + user.id);

        // Add user role
        if (!store["user_roles"]) store["user_roles"] = [];
        store["user_roles"].push({
          id: generateId(),
          user_id: user.id,
          role: "legal_partner",
          created_at: new Date().toISOString(),
        });

        console.log(`✅ Account created: ${email} (role: legal_partner)`);
        return { data: { user }, error: null };
      } catch (err: any) {
        console.error("Auth error:", err);
        return { data: { user: null }, error: { message: err.message } };
      }
    },

    signOut: async () => {
      sessionStorage.removeItem("__KIRO_AUTH_USER");
      sessionStorage.removeItem("__KIRO_AUTH_TOKEN");
      console.log("✅ User signed out");
      return { error: null };
    },

    onAuthStateChange: (callback?: any) => {
      if (callback) {
        supabase.auth.getUser().then(({ data }) => {
          callback(data.user ? "SIGNED_IN" : "SIGNED_OUT", data.user);
        });
      }
      return { unsubscribe: () => {} };
    },
  },
} as any;
