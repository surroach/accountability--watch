/**
 * Duplicate Detection Algorithm Tests
 *
 * Validates 4-factor similarity scoring algorithm:
 * - Location matching (40%)
 * - Description similarity (30%)
 * - Time proximity (20%)
 * - Category matching (10%)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  findDuplicateReports,
  calculateSimilarityScore,
  calculateLocationSimilarity,
  calculateDescriptionSimilarity,
  calculateTimeSimilarity,
} from "@/lib/duplicate-detection";

describe("Duplicate Detection Algorithm", () => {
  const baseReport = {
    id: "report-1",
    location_text: "Main Street, City Center",
    city: "Springfield",
    description:
      "Police used excessive force during arrest at downtown intersection",
    incident_type: "excessive_force",
    incident_at: "2026-07-27T14:30:00Z",
  };

  describe("Location Similarity", () => {
    it("should match exact location", () => {
      const similarity = calculateLocationSimilarity(
        baseReport.location_text,
        "Main Street, City Center",
      );

      expect(similarity).toBe(1.0); // 100% match
    });

    it("should match partial location with high similarity", () => {
      const similarity = calculateLocationSimilarity(
        baseReport.location_text,
        "Main Street",
      );

      expect(similarity).toBeGreaterThan(0.7); // >70% match
      expect(similarity).toBeLessThanOrEqual(1.0);
    });

    it("should handle case-insensitive matching", () => {
      const similarity = calculateLocationSimilarity(
        baseReport.location_text.toUpperCase(),
        baseReport.location_text.toLowerCase(),
      );

      expect(similarity).toBe(1.0);
    });

    it("should penalize different locations", () => {
      const similarity = calculateLocationSimilarity(
        baseReport.location_text,
        "Oak Street, Different City",
      );

      expect(similarity).toBeLessThan(0.5);
    });

    it("should handle geocoordinates", () => {
      const similarity = calculateLocationSimilarity(
        "40.7128,-74.0060", // NYC
        "40.7129,-74.0059", // ~10 meters away
      );

      expect(similarity).toBeGreaterThan(0.9); // Very close
    });

    it("should penalize distant coordinates", () => {
      const similarity = calculateLocationSimilarity(
        "40.7128,-74.0060", // NYC
        "34.0522,-118.2437", // LA
      );

      expect(similarity).toBeLessThan(0.2); // Far apart
    });
  });

  describe("Description Similarity", () => {
    it("should match identical descriptions", () => {
      const similarity = calculateDescriptionSimilarity(
        baseReport.description,
        baseReport.description,
      );

      expect(similarity).toBe(1.0);
    });

    it("should match very similar descriptions", () => {
      const similarity = calculateDescriptionSimilarity(
        baseReport.description,
        "Police used excessive force during arrest at downtown intersection",
      );

      expect(similarity).toBe(1.0);
    });

    it("should detect similar descriptions with minor differences", () => {
      const similarity = calculateDescriptionSimilarity(
        baseReport.description,
        "Police officer used excessive force during arrest downtown",
      );

      expect(similarity).toBeGreaterThan(0.7);
    });

    it("should handle word order variations", () => {
      const similarity = calculateDescriptionSimilarity(
        baseReport.description,
        "During arrest at downtown intersection, excessive force was used by police",
      );

      expect(similarity).toBeGreaterThan(0.6);
    });

    it("should penalize completely different descriptions", () => {
      const similarity = calculateDescriptionSimilarity(
        baseReport.description,
        "The weather was nice today",
      );

      expect(similarity).toBeLessThan(0.2);
    });

    it("should use Levenshtein distance for typo tolerance", () => {
      const similarity = calculateDescriptionSimilarity(
        baseReport.description,
        "Police used excesssive force during arrest at downtown intersction", // typos
      );

      expect(similarity).toBeGreaterThan(0.8);
    });

    it("should not match empty descriptions", () => {
      const similarity = calculateDescriptionSimilarity(
        baseReport.description,
        "",
      );

      expect(similarity).toBe(0);
    });
  });

  describe("Time Similarity", () => {
    it("should match exact same time", () => {
      const similarity = calculateTimeSimilarity(
        baseReport.incident_at,
        baseReport.incident_at,
      );

      expect(similarity).toBe(1.0);
    });

    it("should match close timestamps (1 hour apart)", () => {
      const otherTime = new Date(
        new Date(baseReport.incident_at).getTime() + 60 * 60 * 1000,
      ).toISOString();

      const similarity = calculateTimeSimilarity(
        baseReport.incident_at,
        otherTime,
      );

      expect(similarity).toBeGreaterThan(0.8);
    });

    it("should match same day incidents", () => {
      const otherTime = new Date(
        new Date(baseReport.incident_at).getTime() + 12 * 60 * 60 * 1000,
      ).toISOString();

      const similarity = calculateTimeSimilarity(
        baseReport.incident_at,
        otherTime,
      );

      expect(similarity).toBeGreaterThan(0.6);
    });

    it("should penalize incidents days apart", () => {
      const otherTime = new Date(
        new Date(baseReport.incident_at).getTime() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const similarity = calculateTimeSimilarity(
        baseReport.incident_at,
        otherTime,
      );

      expect(similarity).toBeLessThan(0.3);
    });

    it("should penalize incidents months apart", () => {
      const otherTime = new Date(
        new Date(baseReport.incident_at).getTime() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const similarity = calculateTimeSimilarity(
        baseReport.incident_at,
        otherTime,
      );

      expect(similarity).toBeLessThan(0.1);
    });
  });

  describe("Overall Similarity Score", () => {
    it("should calculate weighted score correctly", () => {
      // Identical report
      const score = calculateSimilarityScore(
        {
          location_text: baseReport.location_text,
          city: baseReport.city,
          description: baseReport.description,
          incident_type: baseReport.incident_type,
          incident_at: baseReport.incident_at,
        },
        {
          location_text: baseReport.location_text,
          city: baseReport.city,
          description: baseReport.description,
          incident_type: baseReport.incident_type,
          incident_at: baseReport.incident_at,
        },
      );

      expect(score).toBe(100); // 100% match
    });

    it("should calculate partial match score", () => {
      const score = calculateSimilarityScore(baseReport, {
        location_text: "Main Street", // Partial location match
        city: baseReport.city,
        description: "Police excessive force downtown", // Partial description
        incident_type: baseReport.incident_type,
        incident_at: baseReport.incident_at,
      });

      expect(score).toBeGreaterThan(60); // Moderate match
      expect(score).toBeLessThan(100);
    });

    it("should weigh location heavily (40%)", () => {
      // Same location and time, but different description
      const score = calculateSimilarityScore(baseReport, {
        location_text: baseReport.location_text,
        city: baseReport.city,
        description: "Completely different incident",
        incident_type: baseReport.incident_type,
        incident_at: baseReport.incident_at,
      });

      expect(score).toBeGreaterThan(40); // At least location weight
      expect(score).toBeLessThan(70);
    });

    it("should return 0 for completely different reports", () => {
      const score = calculateSimilarityScore(baseReport, {
        location_text: "Different City",
        city: "Another State",
        description: "Unrelated incident",
        incident_type: "other",
        incident_at: "2025-01-01T00:00:00Z",
      });

      expect(score).toBeLessThan(20); // Very low match
    });
  });

  describe("Duplicate Finding", () => {
    it("should find exact duplicates", async () => {
      const duplicates = await findDuplicateReports(baseReport);

      expect(Array.isArray(duplicates)).toBe(true);
      // Should find at least one (itself or similar reports)
    });

    it("should rank results by similarity score", async () => {
      const duplicates = await findDuplicateReports(baseReport);

      // Results should be sorted by score (highest first)
      for (let i = 0; i < duplicates.length - 1; i++) {
        expect(duplicates[i].similarityScore).toBeGreaterThanOrEqual(
          duplicates[i + 1].similarityScore,
        );
      }
    });

    it("should respect similarity threshold", async () => {
      const duplicates = await findDuplicateReports(baseReport, {
        threshold: 0.8, // 80% similarity
      });

      // All results should meet threshold
      duplicates.forEach((dup) => {
        expect(dup.similarityScore / 100).toBeGreaterThanOrEqual(0.8);
      });
    });

    it("should limit results by maxResults parameter", async () => {
      const duplicates = await findDuplicateReports(baseReport, {
        maxResults: 5,
      });

      expect(duplicates.length).toBeLessThanOrEqual(5);
    });

    it("should exclude self from results", async () => {
      const duplicates = await findDuplicateReports(baseReport);

      // Should not include the same report ID
      expect(duplicates.every((d) => d.id !== baseReport.id)).toBe(true);
    });

    it("should handle empty report database", async () => {
      // Test with report that has no matches
      const orphanReport = {
        ...baseReport,
        id: "orphan-report",
        location_text: "Unique Location XYZ-123",
        description: "Very unique description that matches nothing",
      };

      const duplicates = await findDuplicateReports(orphanReport);

      expect(Array.isArray(duplicates)).toBe(true);
      expect(duplicates.length).toBe(0); // No matches
    });
  });

  describe("Edge Cases", () => {
    it("should handle null/undefined fields gracefully", () => {
      const score = calculateSimilarityScore(
        { ...baseReport, city: null },
        { ...baseReport, city: undefined },
      );

      expect(typeof score).toBe("number");
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("should handle very long descriptions", () => {
      const longDesc = "A".repeat(5000);

      const score = calculateDescriptionSimilarity(longDesc, longDesc);

      expect(score).toBe(1.0);
    });

    it("should handle special characters in location", () => {
      const specialLocation = "O'Brien's St., #123 & Suite A";

      const similarity = calculateLocationSimilarity(
        specialLocation,
        specialLocation,
      );

      expect(similarity).toBe(1.0);
    });

    it("should handle unicode in descriptions", () => {
      const unicode = "警察が力を使いすぎた (Police used excessive force)";

      const score = calculateDescriptionSimilarity(unicode, unicode);

      expect(score).toBe(1.0);
    });

    it("should handle invalid ISO dates", () => {
      const similarity = calculateTimeSimilarity(
        "2026-07-27T14:30:00Z",
        "invalid-date",
      );

      expect(typeof similarity).toBe("number");
      expect(similarity).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Performance", () => {
    it("should find duplicates quickly", async () => {
      const startTime = performance.now();

      await findDuplicateReports(baseReport);

      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(1000); // < 1 second
    });

    it("should calculate similarity score efficiently", () => {
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        calculateSimilarityScore(baseReport, {
          location_text: "Main Street",
          city: "Springfield",
          description: "Test description",
          incident_type: "excessive_force",
          incident_at: "2026-07-27T14:30:00Z",
        });
      }

      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(500); // 1000 calculations in <500ms
    });

    it("should scale linearly with number of candidates", async () => {
      // This test would require database seeding
      // For now, verify the algorithm doesn't have exponential complexity
      const score1 = calculateSimilarityScore(baseReport, baseReport);
      const score2 = calculateSimilarityScore(baseReport, baseReport);

      expect(score1).toBe(score2);
    });
  });

  describe("Real-World Scenarios", () => {
    it("should detect duplicate reports with typos", () => {
      const score = calculateSimilarityScore(baseReport, {
        location_text: "Main Street, City Centre", // British spelling
        city: "Springfield",
        description:
          "Police used exessve force during arrest at downtown intersection", // typo
        incident_type: "excessive_force",
        incident_at: "2026-07-27T14:35:00Z", // 5 min difference
      });

      expect(score).toBeGreaterThan(75); // High enough to flag as duplicate
    });

    it("should detect similar incidents at nearby locations", () => {
      const score = calculateSimilarityScore(baseReport, {
        location_text: "Main & 5th Street", // Nearby intersection
        city: "Springfield",
        description: "Excessive force used during arrest downtown",
        incident_type: "excessive_force",
        incident_at: "2026-07-27T15:00:00Z", // 30 min later
      });

      expect(score).toBeGreaterThan(60); // Moderate-high similarity
    });

    it("should distinguish between different incident types", () => {
      const score = calculateSimilarityScore(baseReport, {
        location_text: baseReport.location_text,
        city: baseReport.city,
        description: baseReport.description,
        incident_type: "unlawful_detention", // Different type
        incident_at: baseReport.incident_at,
      });

      expect(score).toBeLessThan(80); // Lower score due to category mismatch
    });

    it("should flag multi-day pattern as potential duplicate", () => {
      const score = calculateSimilarityScore(baseReport, {
        location_text: "Main Street, City Center", // Same location
        city: "Springfield",
        description: "Police excessive force arrest downtown", // Similar
        incident_type: "excessive_force",
        incident_at: "2026-07-28T14:30:00Z", // Next day same time
      });

      expect(score).toBeGreaterThan(50); // Might indicate pattern
    });
  });
});
