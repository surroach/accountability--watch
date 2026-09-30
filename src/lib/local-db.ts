/**
 * Local In-Memory Database Adapter
 * Mimics Supabase API for local development
 */

// Simple UUID generator using crypto
function generateId(): string {
  return crypto.randomUUID();
}

interface DBResponse<T> {
  data: T | null;
  error: { message: string } | null;
}

interface QueryBuilder {
  insert: (data: any) => any;
  select: (fields?: string) => any;
  from: (table: string) => any;
  single: () => Promise<DBResponse<any>>;
  eq: (field: string, value: any) => any;
  update: (data: any) => any;
  delete: () => any;
}

// Store for in-memory data (for now, since we're running in browser)
const store: Record<string, any[]> = {
  incident_reports: [],
  report_evidence: [],
  user_roles: [],
};

const storage: Record<string, Blob> = {};

class LocalDB {
  private table: string | null = null;
  private selectFields: string[] = [];
  private whereConditions: Array<{ field: string; value: any }> = [];
  private insertData: any = null;
  private updateData: any = null;

  from(table: string) {
    this.table = table;
    return this;
  }

  insert(data: any) {
    this.insertData = Array.isArray(data) ? data : [data];
    return this;
  }

  select(fields?: string) {
    if (fields) {
      this.selectFields = fields.split(',').map(f => f.trim());
    }
    return this;
  }

  eq(field: string, value: any) {
    this.whereConditions.push({ field, value });
    return this;
  }

  update(data: any) {
    this.updateData = data;
    return this;
  }

  async delete() {
    if (!this.table || this.whereConditions.length === 0) {
      return { data: null, error: { message: 'Invalid delete operation' } };
    }

    try {
      const items = store[this.table] || [];
      const filtered = items.filter(item => {
        return !this.whereConditions.every(cond => item[cond.field] === cond.value);
      });
      store[this.table] = filtered;
      return { data: null, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }

  async single() {
    if (!this.table) {
      return { data: null, error: { message: 'No table specified' } };
    }

    try {
      // INSERT
      if (this.insertData) {
        const data = this.insertData[0];
        const record = {
          id: data.id || generateId(),
          ...data,
          created_at: data.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (!store[this.table]) store[this.table] = [];
        store[this.table].push(record);

        // Return selected fields
        const result = this.selectFields.length > 0
          ? this.selectFields.reduce((acc: any, field) => {
              acc[field] = record[field];
              return acc;
            }, {})
          : record;

        return { data: result, error: null };
      }

      // SELECT
      let items = store[this.table] || [];

      // Apply where conditions
      for (const cond of this.whereConditions) {
        items = items.filter(item => item[cond.field] === cond.value);
      }

      if (items.length === 0) {
        return { data: null, error: null };
      }

      let result = items[0];

      // Apply select fields
      if (this.selectFields.length > 0) {
        result = this.selectFields.reduce((acc: any, field) => {
          acc[field] = result[field];
          return acc;
        }, {});
      }

      return { data: result, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }

  async toArray() {
    if (!this.table) {
      return { data: [], error: { message: 'No table specified' } };
    }

    try {
      let items = store[this.table] || [];

      // Apply where conditions
      for (const cond of this.whereConditions) {
        items = items.filter(item => item[cond.field] === cond.value);
      }

      // Apply select fields
      if (this.selectFields.length > 0) {
        items = items.map(item =>
          this.selectFields.reduce((acc: any, field) => {
            acc[field] = item[field];
            return acc;
          }, {})
        );
      }

      return { data: items, error: null };
    } catch (err: any) {
      return { data: [], error: { message: err.message } };
    }
  }
}

class LocalStorage {
  from(bucket: string) {
    return {
      upload: async (path: string, file: Blob | File, options?: any) => {
        try {
          const key = `${bucket}/${path}`;
          storage[key] = file;
          console.log(`✓ File uploaded: ${key}`);
          return { data: null, error: null };
        } catch (err: any) {
          return { data: null, error: { message: err.message } };
        }
      },
      download: async (path: string) => {
        try {
          const key = `${bucket}/${path}`;
          const file = storage[key];
          if (!file) {
            return { data: null, error: { message: 'File not found' } };
          }
          return { data: file, error: null };
        } catch (err: any) {
          return { data: null, error: { message: err.message } };
        }
      },
      remove: async (paths: string[]) => {
        try {
          paths.forEach(path => {
            const key = `${bucket}/${path}`;
            delete storage[key];
          });
          return { data: [], error: null };
        } catch (err: any) {
          return { data: [], error: { message: err.message } };
        }
      },
    };
  }
}

// Export singleton instances
export const localDB = new LocalDB();

export const localSupabase = {
  from: (table: string) => {
    const db = new LocalDB();
    return {
      insert: (data: any) => {
        db.from(table).insert(data);
        return {
          select: (fields?: string) => {
            db.select(fields);
            return { single: () => db.single() };
          },
        };
      },
      select: (fields?: string) => {
        db.from(table).select(fields);
        return {
          eq: (field: string, value: any) => {
            db.eq(field, value);
            return {
              single: () => db.single(),
              then: async (cb: any) => {
                const result = await db.toArray();
                return cb(result);
              },
            };
          },
          then: async (cb: any) => {
            const result = await db.toArray();
            return cb(result);
          },
        };
      },
    };
  },

  storage: new LocalStorage(),

  auth: {
    getSession: async () => {
      return { data: { session: null }, error: null };
    },
    onAuthStateChange: (callback: any) => {
      return { unsubscribe: () => {} };
    },
  },
};

export function getLocalData(table: string) {
  return store[table] || [];
}

export function clearLocalData() {
  Object.keys(store).forEach(key => {
    store[key] = [];
  });
}
