import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = path.join(__dirname, '..', '.test-filters-final.db');
const BASE_URL = 'http://localhost:8080';
const API_BASE = BASE_URL + '/api';

describe('Dashboard Final Filter Tests', () => {
  beforeAll(async () => {
    // Clean up old test DB
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    
    // Set test DB path
    process.env.ACCOUNTABILITY_DB_PATH = TEST_DB_PATH;
    
    // Wait a moment for DB to initialize
    await new Promise(r => setTimeout(r, 500));
  });

  afterAll(() => {
    // Clean up
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  it('should submit a report with Mumbai city', async () => {
    const report = {
      title: 'Incident in Mumbai',
      description: 'Test incident from Mumbai',
      location: 'Mumbai',
      incident_date: '2025-02-15',
    };

    const res = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.data?.reference_code).toBeDefined();
  });

  it('should submit a report with Pune city', async () => {
    const report = {
      title: 'Incident in Pune',
      description: 'Test incident from Pune',
      location: 'Pune',
      incident_date: '2025-02-18',
    };

    const res = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.data?.reference_code).toBeDefined();
  });

  it('should submit a report without city', async () => {
    const report = {
      title: 'Anonymous Incident',
      description: 'Test incident without location',
      location: '',
      incident_date: '2025-02-20',
    };

    const res = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.data?.reference_code).toBeDefined();
  });

  it('should verify city aggregation (no filter)', async () => {
    await new Promise(r => setTimeout(r, 1000));

    const res = await fetch(`${API_BASE}/stats`);
    const statsData = await res.json();
    
    expect(statsData.success).toBe(true);
    expect(statsData.data).toBeDefined();

    const stats = statsData.data;
    expect(stats.total_reports).toBe(3);
    
    const cityCount = stats.by_city.filter((c: any) => c.city && c.city.trim()).length;
    expect(cityCount).toBe(2);
  });

  it('should filter by city (Mumbai)', async () => {
    const res = await fetch(`${API_BASE}/stats?city_filter=%Mumbai%`);
    const data = await res.json();
    
    expect(data.success).toBe(true);
    expect(data.data?.total_reports).toBe(1);
  });

  it('should filter by date range (Feb 15-25)', async () => {
    const fromDate = new Date('2025-02-15T00:00:00Z').toISOString();
    const toDate = new Date('2025-02-26T00:00:00Z').toISOString();
    
    const res = await fetch(`${API_BASE}/stats?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`);
    const data = await res.json();
    
    expect(data.success).toBe(true);
    expect(data.data?.total_reports).toBe(2);
  });

  it('should filter by year & month (Feb 2025)', async () => {
    const fromFeb = new Date('2025-02-01T00:00:00Z').toISOString();
    const toFeb = new Date('2025-03-01T00:00:00Z').toISOString();
    
    const res = await fetch(`${API_BASE}/stats?from_date=${encodeURIComponent(fromFeb)}&to_date=${encodeURIComponent(toFeb)}`);
    const data = await res.json();
    
    expect(data.success).toBe(true);
    expect(data.data?.total_reports).toBe(3);
  });

  it('should apply combined filters (Pune + Feb 15-25)', async () => {
    const fromDate = new Date('2025-02-15T00:00:00Z').toISOString();
    const toDate = new Date('2025-02-26T00:00:00Z').toISOString();
    
    const res = await fetch(
      `${API_BASE}/stats?city_filter=%Pune%&from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`
    );
    const data = await res.json();
    
    expect(data.success).toBe(true);
    expect(data.data?.total_reports).toBe(1);
  });

  it('should show month aggregation', async () => {
    const res = await fetch(`${API_BASE}/stats`);
    const statsData = await res.json();
    
    expect(statsData.data?.by_month).toBeDefined();
    expect(statsData.data?.by_month.length).toBe(1);
    expect(statsData.data?.by_month[0].count).toBe(3);
  });

  it('should show report without city in aggregation', async () => {
    const res = await fetch(`${API_BASE}/stats`);
    const statsData = await res.json();
    
    const stats = statsData.data;
    const noCity = stats.by_city.find((c: any) => !c.city || !c.city.trim());
    expect(noCity).toBeDefined();
    expect(noCity?.count).toBe(1);
  });
});
