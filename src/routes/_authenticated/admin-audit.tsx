/**
 * Admin Audit Dashboard
 * 
 * Displays comprehensive audit trail for all system actions:
 * - User actions and permissions
 * - Report status changes
 * - Data modifications
 * - Security events
 * - Rate limit violations
 * 
 * FEATURES:
 * - Real-time event streaming
 * - Advanced filtering and search
 * - Export functionality
 * - Compliance reporting
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, AlertCircle, XCircle, Clock, Search, Download, RefreshCw } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface AuditEvent {
  id: string;
  action: string;
  table_name?: string;
  record_id?: string;
  user_id?: string;
  changes?: Record<string, any>;
  created_at: string;
}

interface StatusHistoryEntry {
  id: string;
  report_id: string;
  from_status?: string;
  to_status: string;
  changed_by?: string;
  note?: string;
  changed_at: string;
}

export default function AdminAuditDashboard() {
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterTable, setFilterTable] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  // Fetch audit log events
  const { data: auditEvents, isLoading, refetch } = useQuery({
    queryKey: ['audit-log', filterAction, filterTable, dateRange],
    queryFn: async () => {
      let query = supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      // Apply filters
      if (filterAction !== 'all') {
        query = query.ilike('action', `%${filterAction}%`);
      }

      if (filterTable !== 'all') {
        query = query.eq('table_name', filterTable);
      }

      if (dateRange.start) {
        query = query.gte('created_at', `${dateRange.start}T00:00:00Z`);
      }

      if (dateRange.end) {
        query = query.lte('created_at', `${dateRange.end}T23:59:59Z`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch status history
  const { data: statusHistory } = useQuery({
    queryKey: ['status-history', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_status_history')
        .select('*')
        .order('changed_at', { ascending: false })
        .gte('changed_at', `${dateRange.start}T00:00:00Z`)
        .lte('changed_at', `${dateRange.end}T23:59:59Z`)
        .limit(500);

      if (error) throw error;
      return data || [];
    },
  });

  // Filter and search events
  const filteredEvents = useMemo(() => {
    if (!auditEvents) return [];

    return auditEvents.filter(event => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        event.action.toLowerCase().includes(searchLower) ||
        event.record_id?.toLowerCase().includes(searchLower) ||
        event.user_id?.toLowerCase().includes(searchLower) ||
        JSON.stringify(event.changes).toLowerCase().includes(searchLower);

      return matchesSearch;
    });
  }, [auditEvents, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    if (!auditEvents) return { total: 0, byAction: {}, byTable: {} };

    const byAction: Record<string, number> = {};
    const byTable: Record<string, number> = {};

    auditEvents.forEach(event => {
      byAction[event.action] = (byAction[event.action] || 0) + 1;
      if (event.table_name) {
        byTable[event.table_name] = (byTable[event.table_name] || 0) + 1;
      }
    });

    return {
      total: auditEvents.length,
      byAction,
      byTable,
    };
  }, [auditEvents]);

  // Action badge styling
  const getActionBadge = (action: string) => {
    if (action.includes('create') || action.includes('insert')) {
      return <Badge variant="outline" className="bg-green-50 text-green-700">Create</Badge>;
    } else if (action.includes('update')) {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700">Update</Badge>;
    } else if (action.includes('delete')) {
      return <Badge variant="outline" className="bg-red-50 text-red-700">Delete</Badge>;
    } else if (action.includes('status')) {
      return <Badge variant="outline" className="bg-purple-50 text-purple-700">Status</Badge>;
    } else if (action.includes('auth')) {
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Auth</Badge>;
    }
    return <Badge variant="outline">{action.split('_').pop()}</Badge>;
  };

  // Export audit log
  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Action', 'Table', 'Record ID', 'User', 'Changes'],
      ...filteredEvents.map(e => [
        format(new Date(e.created_at), 'yyyy-MM-dd HH:mm:ss'),
        e.action,
        e.table_name || '',
        e.record_id || '',
        e.user_id || '',
        JSON.stringify(e.changes || {}),
      ]),
    ]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Dashboard</h1>
          <p className="text-muted-foreground">System activity and compliance tracking</p>
        </div>
        <Button
          onClick={() => refetch()}
          disabled={isLoading}
          variant="outline"
          size="sm"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Create Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byAction['audit_log_create'] || 0}</div>
            <p className="text-xs text-muted-foreground">New records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byAction['audit_log_update'] || 0}</div>
            <p className="text-xs text-muted-foreground">Modified records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Status Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusHistory?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Report transitions</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="text-sm font-medium">Search</label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="mt-2"
              />
            </div>

            {/* Action Filter */}
            <div>
              <label className="text-sm font-medium">Action Type</label>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="status">Status Change</SelectItem>
                  <SelectItem value="auth">Authentication</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button
              onClick={handleExport}
              variant="outline"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="events" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="events">Audit Events</TabsTrigger>
          <TabsTrigger value="status">Status Changes</TabsTrigger>
        </TabsList>

        {/* Audit Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
              <CardDescription>
                {filteredEvents.length} events found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin">
                    <RefreshCw className="w-6 h-6" />
                  </div>
                  <p className="mt-2 text-muted-foreground">Loading events...</p>
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No events found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredEvents.slice(0, 50).map((event) => (
                    <div
                      key={event.id}
                      className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition"
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {getActionBadge(event.action)}
                          <span className="font-medium text-sm">{event.action}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Table</p>
                          <p className="font-mono">{event.table_name || '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Record</p>
                          <p className="font-mono truncate">{event.record_id || '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">User</p>
                          <p className="font-mono truncate">{event.user_id || '—'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Status Changes Tab */}
        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Report Status Changes</CardTitle>
              <CardDescription>
                {statusHistory?.length || 0} status transitions recorded
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!statusHistory ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading status changes...</p>
                </div>
              ) : statusHistory.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No status changes found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {statusHistory.slice(0, 50).map((entry) => (
                    <div
                      key={entry.id}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {entry.to_status === 'moderation_approved' && (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          )}
                          {entry.to_status === 'moderation_rejected' && (
                            <XCircle className="w-4 h-4 text-red-600" />
                          )}
                          {entry.to_status === 'closed' && (
                            <CheckCircle className="w-4 h-4 text-gray-600" />
                          )}
                          {!['moderation_approved', 'moderation_rejected', 'closed'].includes(entry.to_status) && (
                            <Clock className="w-4 h-4 text-blue-600" />
                          )}
                          <span className="font-medium">
                            {entry.from_status || 'Initial'} → {entry.to_status}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(entry.changed_at), { addSuffix: true })}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Report ID</p>
                          <p className="font-mono">{entry.report_id}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Changed By</p>
                          <p className="font-mono">{entry.changed_by || '—'}</p>
                        </div>
                      </div>

                      {entry.note && (
                        <div className="mt-2 p-2 bg-muted rounded text-sm">
                          <p className="text-muted-foreground">Note:</p>
                          <p>{entry.note}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Event Details Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Event Details</DialogTitle>
            <DialogDescription>
              {selectedEvent?.action} • {format(new Date(selectedEvent?.created_at || ''), 'PPpp')}
            </DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Action</p>
                  <p className="font-mono">{selectedEvent.action}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Table</p>
                  <p className="font-mono">{selectedEvent.table_name || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Record ID</p>
                  <p className="font-mono">{selectedEvent.record_id || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">User ID</p>
                  <p className="font-mono">{selectedEvent.user_id || '—'}</p>
                </div>
              </div>

              {selectedEvent.changes && Object.keys(selectedEvent.changes).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Changes</p>
                  <pre className="bg-muted p-3 rounded text-sm overflow-auto max-h-64">
                    {JSON.stringify(selectedEvent.changes, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
