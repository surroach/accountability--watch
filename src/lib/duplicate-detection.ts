/**
 * Duplicate Report Detection
 * 
 * Identifies potentially duplicate or related reports using similarity scoring
 * based on:
 * - Location proximity (exact match weighted heavily)
 * - Time proximity (same day, hour)
 * - Category match
 * - Description text similarity
 * - Geographic clustering
 * 
 * ALGORITHM: Transparent, explainable similarity scoring suitable for a college project viva
 * 
 * Score Range: 0 (completely different) to 1.0 (identical)
 * Threshold: 0.75+ = likely duplicate
 */

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export interface DuplicateMatch {
  reportId: string;
  reportCode: string;
  similarityScore: number;
  reason: string;  // Explanation of why it's similar
  matchDetails: {
    locationScore: number;
    timeScore: number;
    categoryScore: number;
    descriptionScore: number;
  };
}

/**
 * Find potential duplicates for a new report
 */
export async function findDuplicateReports(
  newReport: {
    location_text: string;
    city: string | null;
    incident_type: string | null;
    description: string;
    incident_at: string;
  },
  similarityThreshold = 0.75
): Promise<DuplicateMatch[]> {
  try {
    // Fetch recent reports (last 30 days) to compare against
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentReports, error } = await supabase
      .from('incident_reports')
      .select('id, report_code, location_text, city, incident_type, description, incident_at')
      .gte('created_at', thirtyDaysAgo);

    if (error) {
      console.error('Failed to fetch reports for duplicate detection:', error);
      return [];
    }

    if (!recentReports || recentReports.length === 0) {
      return [];
    }

    // Score each report
    const matches: DuplicateMatch[] = [];

    for (const report of recentReports) {
      const scores = calculateSimilarityScores(newReport, report);
      const overallScore = calculateWeightedScore(scores);

      if (overallScore >= similarityThreshold) {
        matches.push({
          reportId: report.id,
          reportCode: report.report_code,
          similarityScore: overallScore,
          reason: generateMatchReason(scores),
          matchDetails: scores,
        });
      }
    }

    // Sort by similarity score (highest first)
    matches.sort((a, b) => b.similarityScore - a.similarityScore);

    return matches;
  } catch (err: any) {
    console.error('Duplicate detection error:', err);
    return [];
  }
}

/**
 * Calculate individual similarity scores between two reports
 */
function calculateSimilarityScores(
  newReport: {
    location_text: string;
    city: string | null;
    incident_type: string | null;
    description: string;
    incident_at: string;
  },
  existingReport: any
): {
  locationScore: number;
  timeScore: number;
  categoryScore: number;
  descriptionScore: number;
} {
  return {
    locationScore: calculateLocationSimilarity(newReport.location_text, existingReport.location_text, newReport.city, existingReport.city),
    timeScore: calculateTimeSimilarity(newReport.incident_at, existingReport.incident_at),
    categoryScore: calculateCategorySimilarity(newReport.incident_type, existingReport.incident_type),
    descriptionScore: calculateDescriptionSimilarity(newReport.description, existingReport.description),
  };
}

/**
 * Location similarity (0 to 1.0)
 * 
 * Exact match: 1.0
 * Same city: 0.6
 * Similar text: 0.3 (using Levenshtein distance)
 * Different: 0.0
 */
function calculateLocationSimilarity(
  newLocation: string,
  existingLocation: string,
  newCity: string | null,
  existingCity: string | null
): number {
  // Normalize to lowercase for comparison
  const loc1 = newLocation.toLowerCase().trim();
  const loc2 = existingLocation.toLowerCase().trim();

  // Exact match
  if (loc1 === loc2) return 1.0;

  // Same city match
  if (newCity && existingCity && newCity.toLowerCase() === existingCity.toLowerCase()) {
    return 0.6;
  }

  // Partial text overlap
  const similarity = calculateStringSimilarity(loc1, loc2);
  if (similarity > 0.7) return similarity * 0.8;  // High text similarity but not exact

  return 0;
}

/**
 * Time similarity (0 to 1.0)
 * 
 * Same hour: 1.0
 * Same day: 0.7
 * Within 3 days: 0.4
 * More than 3 days: 0
 */
function calculateTimeSimilarity(newTime: string, existingTime: string): number {
  try {
    const newDate = new Date(newTime);
    const existingDate = new Date(existingTime);
    const diffMs = Math.abs(newDate.getTime() - existingDate.getTime());
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffHours / 24;

    if (diffHours < 1) return 1.0;  // Same hour
    if (diffDays < 1) return 0.7;   // Same day
    if (diffDays < 3) return 0.4;   // Within 3 days
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Category/incident type similarity
 * 
 * Exact match: 1.0
 * Different: 0
 */
function calculateCategorySimilarity(newType: string | null, existingType: string | null): number {
  if (!newType || !existingType) return 0;
  return newType === existingType ? 1.0 : 0;
}

/**
 * Description text similarity using Levenshtein-like algorithm
 * 
 * Returns 0 to 1.0 based on word overlap and text distance
 */
function calculateDescriptionSimilarity(newDesc: string, existingDesc: string): number {
  // Normalize: lowercase, trim, remove punctuation
  const desc1 = normalizeText(newDesc);
  const desc2 = normalizeText(existingDesc);

  // If very short, require high similarity
  if (desc1.length < 20 || desc2.length < 20) {
    return calculateStringSimilarity(desc1, desc2);
  }

  // Extract keywords (first 5 words)
  const words1 = desc1.split(' ').slice(0, 5).join(' ');
  const words2 = desc2.split(' ').slice(0, 5).join(' ');
  
  const keywordSimilarity = calculateStringSimilarity(words1, words2);
  
  // If keyword similarity is high, boost overall score
  return keywordSimilarity;
}

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')  // Remove punctuation
    .replace(/\s+/g, ' ');     // Collapse whitespace
}

/**
 * Calculate string similarity using token overlap
 * 
 * Simple but transparent algorithm suitable for viva explanation
 * 
 * Algorithm:
 * 1. Split both strings into words
 * 2. Find common words
 * 3. Return: common_words / total_unique_words
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const words1 = new Set(str1.split(' '));
  const words2 = new Set(str2.split(' '));
  
  // Common words
  let commonCount = 0;
  for (const word of words1) {
    if (words2.has(word)) commonCount++;
  }
  
  // Total unique words
  const totalUnique = new Set([...words1, ...words2]).size;
  
  if (totalUnique === 0) return 0;
  return commonCount / totalUnique;
}

/**
 * Weighted scoring
 * 
 * Weights:
 * - Location: 40% (most important for police incidents)
 * - Description: 30%
 * - Time: 20%
 * - Category: 10%
 */
function calculateWeightedScore(scores: {
  locationScore: number;
  timeScore: number;
  categoryScore: number;
  descriptionScore: number;
}): number {
  return (
    scores.locationScore * 0.40 +
    scores.descriptionScore * 0.30 +
    scores.timeScore * 0.20 +
    scores.categoryScore * 0.10
  );
}

/**
 * Generate human-readable explanation of why reports match
 */
function generateMatchReason(scores: {
  locationScore: number;
  timeScore: number;
  categoryScore: number;
  descriptionScore: number;
}): string {
  const reasons: string[] = [];

  if (scores.locationScore > 0.9) reasons.push('Same location');
  else if (scores.locationScore > 0.5) reasons.push('Similar location');

  if (scores.timeScore > 0.9) reasons.push('Same timeframe');
  else if (scores.timeScore > 0.3) reasons.push('Close in time');

  if (scores.categoryScore > 0.9) reasons.push('Same incident type');

  if (scores.descriptionScore > 0.7) reasons.push('Similar description');

  return reasons.join(', ') || 'Moderate similarity';
}

/**
 * Get duplicate detection report for admin dashboard
 */
export async function getDuplicateReport(reportId: string) {
  try {
    const { data: report, error } = await supabase
      .from('incident_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (error || !report) return null;

    const duplicates = await findDuplicateReports(report, 0.7);  // Lower threshold for admin review
    
    return {
      reportId,
      duplicateCount: duplicates.length,
      potentialMatches: duplicates,
    };
  } catch (err) {
    console.error('Error getting duplicate report:', err);
    return null;
  }
}
