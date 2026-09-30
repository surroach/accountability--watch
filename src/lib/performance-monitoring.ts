/**
 * Performance Monitoring and Query Analysis for Accountability Watch
 *
 * Tracks and analyzes database performance:
 * - Query execution times
 * - Index usage statistics
 * - Slow query detection
 * - Database optimization recommendations
 *
 * TOOLS:
 * - SQLite EXPLAIN QUERY PLAN for execution analysis
 * - Performance metrics collection
 * - Bottleneck identification
 */

import { supabase } from "@/integrations/supabase/client";

/**
 * Query performance metrics
 */
export interface QueryMetrics {
  query: string;
  executionTimeMs: number;
  rowsAffected: number;
  isSlowQuery: boolean;
  rowsScanned?: number;
  indexesUsed?: string[];
  estimatedRowsScanned?: number;
  executionPlan?: string;
  timestamp: number;
}

/**
 * Performance threshold configuration
 */
export const PERFORMANCE_CONFIG = {
  slowQueryThresholdMs: 1000, // Queries >1s considered slow
  dataCollectionInterval: 60000, // Collect metrics every minute
  retentionDays: 30, // Keep metrics for 30 days
  sampleRate: 0.1, // Sample 10% of queries
};

/**
 * Storage for metrics
 */
const metricsStore: QueryMetrics[] = [];
let isMonitoring = false;

/**
 * Start collecting query performance metrics
 */
export function startPerformanceMonitoring(): void {
  if (isMonitoring) {
    console.warn("Performance monitoring already active");
    return;
  }

  isMonitoring = true;
  console.log("Performance monitoring started");

  // Periodic cleanup of old metrics
  setInterval(cleanupOldMetrics, PERFORMANCE_CONFIG.dataCollectionInterval);
}

/**
 * Stop collecting metrics
 */
export function stopPerformanceMonitoring(): void {
  isMonitoring = false;
  console.log("Performance monitoring stopped");
}

/**
 * Record a query's performance metrics
 */
export async function recordQueryPerformance(
  query: string,
  executionTimeMs: number,
  rowsAffected: number = 0,
): Promise<void> {
  if (!isMonitoring || Math.random() > PERFORMANCE_CONFIG.sampleRate) {
    return;
  }

  try {
    // Analyze query execution plan
    const plan = await analyzeQueryPlan(query);

    const metric: QueryMetrics = {
      query: sanitizeQuery(query),
      executionTimeMs,
      rowsAffected,
      isSlowQuery: executionTimeMs > PERFORMANCE_CONFIG.slowQueryThresholdMs,
      executionPlan: plan.plan,
      indexesUsed: plan.indexesUsed,
      estimatedRowsScanned: plan.estimatedRows,
      timestamp: Date.now(),
    };

    metricsStore.push(metric);

    // Log slow queries immediately
    if (metric.isSlowQuery) {
      console.warn("Slow query detected:", {
        query: metric.query,
        time: executionTimeMs,
        rows: rowsAffected,
        plan: plan.plan,
      });

      await logSlowQuery(metric);
    }
  } catch (error) {
    console.error("Error recording query performance:", error);
  }
}

/**
 * Analyze query execution plan using SQLite EXPLAIN
 *
 * EXPLAIN QUERY PLAN shows:
 * - Which indexes are used (or table scan)
 * - Join strategy
 * - Estimated rows processed
 * - Sorting/filtering operations
 */
async function analyzeQueryPlan(query: string): Promise<{
  plan: string;
  indexesUsed: string[];
  estimatedRows: number;
}> {
  try {
    // Don't analyze INSERT/UPDATE/DELETE
    if (/^(INSERT|UPDATE|DELETE)/i.test(query)) {
      return {
        plan: "N/A for write operations",
        indexesUsed: [],
        estimatedRows: 0,
      };
    }

    const explainQuery = `EXPLAIN QUERY PLAN ${query}`;

    // Execute explain query
    const { data, error } = await supabase.rpc("exec_sql", {
      sql: explainQuery,
    });

    if (error || !data) {
      return {
        plan: "Unable to analyze plan",
        indexesUsed: [],
        estimatedRows: 0,
      };
    }

    // Parse execution plan
    const planText = data.map((row: any) => row.plan || row).join("\n");
    const indexesUsed = extractIndexesFromPlan(planText);
    const estimatedRows = extractEstimatedRowsFromPlan(planText);

    return {
      plan: planText,
      indexesUsed,
      estimatedRows,
    };
  } catch (error) {
    return {
      plan: "Error analyzing plan",
      indexesUsed: [],
      estimatedRows: 0,
    };
  }
}

/**
 * Extract index names from EXPLAIN output
 */
function extractIndexesFromPlan(plan: string): string[] {
  const indexPattern = /USING INDEX (\w+)/gi;
  const indexes: string[] = [];
  let match;

  while ((match = indexPattern.exec(plan)) !== null) {
    indexes.push(match[1]);
  }

  return [...new Set(indexes)]; // unique
}

/**
 * Extract estimated rows from EXPLAIN output
 */
function extractEstimatedRowsFromPlan(plan: string): number {
  const rowPattern = /~(\d+)/;
  const match = plan.match(rowPattern);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Get performance statistics and recommendations
 */
export async function getPerformanceStats(): Promise<{
  totalQueries: number;
  slowQueries: number;
  averageExecutionTimeMs: number;
  p95ExecutionTimeMs: number;
  p99ExecutionTimeMs: number;
  recommendations: string[];
}> {
  if (metricsStore.length === 0) {
    return {
      totalQueries: 0,
      slowQueries: 0,
      averageExecutionTimeMs: 0,
      p95ExecutionTimeMs: 0,
      p99ExecutionTimeMs: 0,
      recommendations: [],
    };
  }

  const times = metricsStore
    .map((m) => m.executionTimeMs)
    .sort((a, b) => a - b);
  const slowCount = metricsStore.filter((m) => m.isSlowQuery).length;

  const stats = {
    totalQueries: metricsStore.length,
    slowQueries: slowCount,
    averageExecutionTimeMs: Math.round(
      times.reduce((a, b) => a + b, 0) / times.length,
    ),
    p95ExecutionTimeMs: times[Math.floor(times.length * 0.95)],
    p99ExecutionTimeMs: times[Math.floor(times.length * 0.99)],
    recommendations: generateRecommendations(metricsStore),
  };

  return stats;
}

/**
 * Generate performance optimization recommendations
 */
function generateRecommendations(metrics: QueryMetrics[]): string[] {
  const recommendations: string[] = [];

  // Check for slow queries
  const slowQueries = metrics.filter((m) => m.isSlowQuery);
  if (slowQueries.length > metrics.length * 0.1) {
    recommendations.push(
      "10%+ of queries are slow - review query patterns and add indexes",
    );
  }

  // Check for table scans
  const tableScans = metrics.filter(
    (m) => !m.indexesUsed || m.indexesUsed.length === 0,
  );
  if (tableScans.length > metrics.length * 0.2) {
    recommendations.push(
      "Many queries perform table scans - consider adding indexes on frequently filtered columns",
    );
  }

  // Check for high row scan rates
  const highRowScans = metrics.filter(
    (m) => m.estimatedRowsScanned && m.estimatedRowsScanned > 10000,
  );
  if (highRowScans.length > metrics.length * 0.05) {
    recommendations.push(
      "Some queries scan many rows - optimize WHERE clauses or add composite indexes",
    );
  }

  // Check for missing LIMIT on SELECT queries
  const unlimitedSelects = metrics.filter(
    (m) => /^SELECT/i.test(m.query) && !/LIMIT\s+\d+/i.test(m.query),
  );
  if (unlimitedSelects.length > 5) {
    recommendations.push(
      "Many SELECT queries lack LIMIT - consider pagination to reduce data transfer",
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Performance is within acceptable ranges");
  }

  return recommendations;
}

/**
 * Find slowest queries for optimization
 */
export function getSlowQueries(limit: number = 10): QueryMetrics[] {
  return metricsStore
    .filter((m) => m.isSlowQuery)
    .sort((a, b) => b.executionTimeMs - a.executionTimeMs)
    .slice(0, limit);
}

/**
 * Identify queries that could benefit from indexes
 */
export function findMissingIndexOpportunities(): Array<{
  query: string;
  reason: string;
  suggestedIndex: string;
}> {
  const opportunities: Array<{
    query: string;
    reason: string;
    suggestedIndex: string;
  }> = [];

  for (const metric of metricsStore) {
    if (!metric.indexesUsed || metric.indexesUsed.length === 0) {
      if (metric.executionTimeMs > PERFORMANCE_CONFIG.slowQueryThresholdMs) {
        opportunities.push({
          query: metric.query,
          reason: "Slow query with no indexes",
          suggestedIndex: suggestIndexForQuery(metric.query),
        });
      }
    }
  }

  return opportunities;
}

/**
 * Suggest an index based on query pattern
 * This is a simple heuristic - complex queries may need manual analysis
 */
function suggestIndexForQuery(query: string): string {
  // Extract table and WHERE columns
  const tableMatch = query.match(/FROM\s+(\w+)/i);
  const whereMatch = query.match(/WHERE\s+(.+?)(?:GROUP|ORDER|LIMIT|$)/i);

  if (!tableMatch) {
    return "Unable to suggest index";
  }

  const table = tableMatch[1];

  if (whereMatch) {
    const whereClause = whereMatch[1];
    // Simple heuristic: suggest index on first column in WHERE
    const columnMatch = whereClause.match(/(\w+)\s*[=<>]/);
    if (columnMatch) {
      return `CREATE INDEX idx_${table}_${columnMatch[1]} ON ${table}(${columnMatch[1]})`;
    }
  }

  return `Analyze query manually: ${query}`;
}

/**
 * Log slow query for later analysis
 */
async function logSlowQuery(metric: QueryMetrics): Promise<void> {
  try {
    await supabase.from("audit_log").insert({
      action: "slow_query_detected",
      changes: JSON.stringify({
        query: metric.query,
        executionTimeMs: metric.executionTimeMs,
        plan: metric.executionPlan,
      }),
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to log slow query:", error);
  }
}

/**
 * Clean up old metrics
 */
function cleanupOldMetrics(): void {
  const cutoffTime =
    Date.now() - PERFORMANCE_CONFIG.retentionDays * 24 * 60 * 60 * 1000;

  const initialLength = metricsStore.length;
  metricsStore.splice(
    0,
    metricsStore.findIndex((m) => m.timestamp > cutoffTime) ||
      metricsStore.length,
  );

  const removed = initialLength - metricsStore.length;
  if (removed > 0) {
    console.log(`Cleaned up ${removed} old performance metrics`);
  }
}

/**
 * Sanitize query for logging (remove sensitive data)
 */
function sanitizeQuery(query: string): string {
  return query
    .replace(/('.*?')/g, "'***'") // Remove string literals
    .replace(/(\d{3}[- ]?\d{3}[- ]?\d{4})/g, "***-***-****") // Remove phone numbers
    .replace(/[\w.-]+@[\w.-]+/g, "***@***") // Remove emails
    .substring(0, 500); // Limit length
}

/**
 * Export metrics for external analysis
 */
export function exportMetrics(): {
  metrics: QueryMetrics[];
  stats: Awaited<ReturnType<typeof getPerformanceStats>>;
  recommendations: string[];
} {
  return {
    metrics: [...metricsStore],
    stats: {
      totalQueries: metricsStore.length,
      slowQueries: metricsStore.filter((m) => m.isSlowQuery).length,
      averageExecutionTimeMs: Math.round(
        metricsStore.reduce((sum, m) => sum + m.executionTimeMs, 0) /
          metricsStore.length || 0,
      ),
      p95ExecutionTimeMs:
        metricsStore.sort((a, b) => a.executionTimeMs - b.executionTimeMs)[
          Math.floor(metricsStore.length * 0.95)
        ]?.executionTimeMs || 0,
      p99ExecutionTimeMs:
        metricsStore.sort((a, b) => a.executionTimeMs - b.executionTimeMs)[
          Math.floor(metricsStore.length * 0.99)
        ]?.executionTimeMs || 0,
      recommendations: generateRecommendations(metricsStore),
    },
    recommendations: generateRecommendations(metricsStore),
  };
}

/**
 * Reset all metrics (for testing)
 */
export function resetMetrics(): void {
  metricsStore.length = 0;
  console.log("Performance metrics reset");
}
