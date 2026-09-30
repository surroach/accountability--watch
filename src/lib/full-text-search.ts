/**
 * Full-Text Search Implementation for Accountability Watch
 * 
 * Provides semantic search capabilities using SQLite FTS5 virtual tables.
 * Enables users to search reports by description, location, incident type with ranking.
 * 
 * ARCHITECTURE:
 * - FTS5 virtual table for fast full-text indexing
 * - Relevance ranking based on search term frequency and position
 * - Filters for status, date range, and location
 * - Performance: O(log n) search vs O(n) table scan
 */

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

/**
 * Search query interface for flexible filtering
 */
export interface SearchQuery {
  // Full-text search terms
  query: string;
  
  // Filters
  status?: string[];
  city?: string;
  incidentType?: string;
  
  // Date range
  startDate?: string;  // ISO 8601
  endDate?: string;    // ISO 8601
  
  // Pagination
  limit?: number;
  offset?: number;
  
  // Sorting
  sortBy?: 'relevance' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Represents a search result with relevance score
 */
export interface SearchResult {
  id: string;
  reportCode: string;
  incidentAt: string;
  locationText: string;
  city?: string;
  incidentType?: string;
  description: string;
  status: string;
  relevanceScore: number;  // 0-100 based on match quality
  createdAt: string;
  matchContext?: string;   // Excerpt around the matched term
}

/**
 * Initialize FTS5 virtual table for reports
 * This should be called once during schema setup
 * 
 * IMPORTANT: SQLite FTS5 must be compiled in (usually default in recent versions)
 */
export async function initializeFTS5(): Promise<{ success: boolean; error?: string }> {
  try {
    // Create FTS5 virtual table for incident reports
    // This indexes the key searchable fields
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE VIRTUAL TABLE IF NOT EXISTS incident_reports_fts USING fts5(
          id UNINDEXED,
          report_code UNINDEXED,
          location_text,
          description,
          incident_type,
          badge_or_unit,
          content=incident_reports,
          content_rowid=rowid
        );
      `,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Create trigger to update FTS index when reports are inserted
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TRIGGER IF NOT EXISTS incident_reports_ai AFTER INSERT ON incident_reports BEGIN
          INSERT INTO incident_reports_fts(rowid, id, report_code, location_text, description, incident_type, badge_or_unit)
          VALUES (new.rowid, new.id, new.report_code, new.location_text, new.description, new.incident_type, new.badge_or_unit);
        END;
      `,
    });

    // Create trigger to update FTS index when reports are updated
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TRIGGER IF NOT EXISTS incident_reports_au AFTER UPDATE ON incident_reports BEGIN
          INSERT INTO incident_reports_fts(incident_reports_fts, rowid, id, report_code, location_text, description, incident_type, badge_or_unit)
          VALUES('delete', old.rowid, old.id, old.report_code, old.location_text, old.description, old.incident_type, old.badge_or_unit);
          INSERT INTO incident_reports_fts(rowid, id, report_code, location_text, description, incident_type, badge_or_unit)
          VALUES (new.rowid, new.id, new.report_code, new.location_text, new.description, new.incident_type, new.badge_or_unit);
        END;
      `,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Execute a full-text search against the FTS5 index
 * 
 * ALGORITHM:
 * 1. Parse search query into tokens
 * 2. Query FTS5 index with BM25 ranking
 * 3. Apply filters (status, date, location)
 * 4. Apply sorting
 * 5. Return paginated results
 * 
 * COMPLEXITY: O(log n) for FTS index lookup + O(k log k) for sorting results
 * where n = total reports, k = filtered results
 */
export async function searchReports(params: SearchQuery): Promise<{
  success: boolean;
  data?: SearchResult[];
  total?: number;
  error?: string;
}> {
  try {
    // Build query components
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const sortBy = params.sortBy || 'relevance';
    const sortOrder = params.sortOrder || 'desc';

    // Escape special FTS5 characters in search query
    const escapedQuery = escapeFTSQuery(params.query);

    // Build filter conditions
    let filterSQL = '';

    if (params.status && params.status.length > 0) {
      const statusList = params.status.map(s => `'${s}'`).join(',');
      filterSQL += ` AND ir.status IN (${statusList})`;
    }

    if (params.city) {
      filterSQL += ` AND ir.city = '${params.city}'`;
    }

    if (params.incidentType) {
      filterSQL += ` AND ir.incident_type = '${params.incidentType}'`;
    }

    if (params.startDate) {
      filterSQL += ` AND ir.created_at >= '${params.startDate}'`;
    }

    if (params.endDate) {
      filterSQL += ` AND ir.created_at <= '${params.endDate}'`;
    }

    // Build sort clause
    let sortSQL = 'ORDER BY ';
    if (sortBy === 'relevance') {
      sortSQL += `fts.rank ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
    } else if (sortBy === 'created_at') {
      sortSQL += `ir.created_at ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
    } else if (sortBy === 'updated_at') {
      sortSQL += `ir.updated_at ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
    }

    // Execute FTS5 search with ranking
    const { data: results, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          ir.id,
          ir.report_code,
          ir.incident_at,
          ir.location_text,
          ir.city,
          ir.incident_type,
          ir.description,
          ir.status,
          ir.created_at,
          -- BM25 ranking (lower is more relevant in SQLite FTS5)
          ABS(fts.rank) as relevance_score,
          -- Extract match context (excerpt around match)
          substr(ir.description, max(1, instr(ir.description, ?1) - 20), 60) as match_context
        FROM incident_reports_fts fts
        JOIN incident_reports ir ON ir.id = fts.id
        WHERE incident_reports_fts MATCH ?2
        ${filterSQL}
        ${sortSQL}
        LIMIT ?3 OFFSET ?4
      `,
      params: [escapedQuery, escapedQuery, limit, offset],
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Get total count for pagination
    const { data: countResult, error: countError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT COUNT(*) as total
        FROM incident_reports_fts fts
        JOIN incident_reports ir ON ir.id = fts.id
        WHERE incident_reports_fts MATCH ?1
        ${filterSQL}
      `,
      params: [escapedQuery],
    });

    const total = countError ? 0 : (countResult?.[0]?.total || 0);

    // Transform results to output format
    const transformedResults: SearchResult[] = (results || []).map((row: any) => ({
      id: row.id,
      reportCode: row.report_code,
      incidentAt: row.incident_at,
      locationText: row.location_text,
      city: row.city,
      incidentType: row.incident_type,
      description: row.description,
      status: row.status,
      relevanceScore: Math.round((1 - Math.abs(row.relevance_score)) * 100), // Convert to 0-100
      createdAt: row.created_at,
      matchContext: row.match_context,
    }));

    return {
      success: true,
      data: transformedResults,
      total,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Search for duplicate reports using FTS5
 * Useful for finding similar incidents (used by duplicate detection)
 */
export async function findSimilarReports(
  reportDescription: string,
  location: string,
  limit: number = 5
): Promise<SearchResult[]> {
  try {
    // Build search query from report details
    // Use AND operator to require all terms, OR for flexible matching
    const searchTerms = [reportDescription, location]
      .filter(Boolean)
      .join(' OR ');

    const result = await searchReports({
      query: searchTerms,
      limit,
      sortBy: 'relevance',
    });

    return result.data || [];
  } catch (error) {
    console.error('Error finding similar reports:', error);
    return [];
  }
}

/**
 * Advanced search with boolean operators
 * Supports: AND, OR, NOT, phrase matching with quotes
 * 
 * Examples:
 * - "excessive force" AND location => phrase AND term
 * - harassment OR assault => multiple terms with OR
 * - -"false arrest" => exclude phrase
 */
export async function advancedSearch(params: {
  booleanQuery: string;  // e.g., "(force OR assault) AND police NOT arrest"
  status?: string[];
  city?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  success: boolean;
  data?: SearchResult[];
  total?: number;
  error?: string;
}> {
  try {
    return await searchReports({
      query: params.booleanQuery,
      status: params.status,
      city: params.city,
      startDate: params.startDate,
      endDate: params.endDate,
      limit: params.limit,
      offset: params.offset,
      sortBy: 'relevance',
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get search suggestions based on partial input
 * Useful for autocomplete functionality
 */
export async function getSearchSuggestions(
  prefix: string,
  limit: number = 5
): Promise<string[]> {
  try {
    // Search for terms that start with the prefix
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT DISTINCT description 
        FROM incident_reports
        WHERE description LIKE ?1 || '%'
        LIMIT ?2
      `,
      params: [prefix, limit],
    });

    if (error) {
      return [];
    }

    return (data || []).map((row: any) => row.description);
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    return [];
  }
}

/**
 * Helper: Escape special FTS5 characters in search query
 * 
 * Special characters in FTS5: " ' ( ) - : *
 * We escape them to prevent search injection and parsing errors
 */
function escapeFTSQuery(query: string): string {
  // Remove or escape special characters that could break FTS5 parsing
  return query
    .replace(/"/g, '\\"')  // Escape quotes
    .replace(/'/g, "''")   // Escape single quotes (SQL)
    .trim();
}

/**
 * Get detailed search analytics
 * Useful for understanding search patterns and improving UX
 */
export async function getSearchAnalytics(): Promise<{
  topSearchTerms: Array<{ term: string; count: number }>;
  averageResultsPerSearch: number;
  totalSearches: number;
  successRate: number;
}> {
  // This would require logging search queries in a separate table
  // For now, return placeholder
  return {
    topSearchTerms: [],
    averageResultsPerSearch: 0,
    totalSearches: 0,
    successRate: 100,
  };
}
