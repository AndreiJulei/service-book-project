import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { authService } from '../authService';

import { FirmSidebar } from './FirmSidebar';

export function AdminDashboard() {
  const [logs, setLogs] = useState<any[]>([]);
  const [suspicious, setSuspicious] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const user = authService.getCurrentUser();
        if (!user || !user.roles?.includes('admin')) {
          navigate('/');
          return;
        }

        const API_BASE = '/api';
        const [logsRes, suspRes] = await Promise.all([
          fetch(`${API_BASE}/admin/action-logs`, { headers: authService.getAuthHeaders() }),
          fetch(`${API_BASE}/admin/suspicious-activity`, { headers: authService.getAuthHeaders() })
        ]);

        if (logsRes.ok) {
          const logsData = await logsRes.json();
          setLogs(logsData.items || []);
        }
        if (suspRes.ok) {
          const suspData = await suspRes.json();
          setSuspicious(suspData || []);
        }
      } catch (err) {
        console.error("Failed to load admin data", err);
      }
    };
    fetchAdminData();
  }, [navigate]);

  return (
    <div style={{ padding: 20 }}>
      <h1>Admin Dashboard</h1>
      <Link to="/firm/dashboard">Back to Firm Dashboard</Link>

      <section style={{ marginTop: 40 }}>
        <h2 style={{ color: '#d9534f' }}>Suspicious Activity Flags</h2>
        {suspicious.length === 0 ? <p>No suspicious activity detected.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ccc' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: 10, border: '1px solid #ccc' }}>ID</th>
                <th style={{ padding: 10, border: '1px solid #ccc' }}>User ID</th>
                <th style={{ padding: 10, border: '1px solid #ccc' }}>Reason</th>
                <th style={{ padding: 10, border: '1px solid #ccc' }}>Detected At</th>
              </tr>
            </thead>
            <tbody>
              {suspicious.map(s => (
                <tr key={s.id}>
                  <td style={{ padding: 10, border: '1px solid #ccc' }}>{s.id}</td>
                  <td style={{ padding: 10, border: '1px solid #ccc' }}>{s.user_id}</td>
                  <td style={{ padding: 10, border: '1px solid #ccc' }}>{s.reason}</td>
                  <td style={{ padding: 10, border: '1px solid #ccc' }}>{new Date(s.detected_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: 40 }}>
        <h2>Action Logs</h2>
        {logs.length === 0 ? <p>No logs available.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ccc' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: 10, border: '1px solid #ccc' }}>Time</th>
                <th style={{ padding: 10, border: '1px solid #ccc' }}>User ID</th>
                <th style={{ padding: 10, border: '1px solid #ccc' }}>Role</th>
                <th style={{ padding: 10, border: '1px solid #ccc' }}>Action</th>
                <th style={{ padding: 10, border: '1px solid #ccc' }}>Resource</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ padding: 10, border: '1px solid #ccc' }}>{new Date(log.timestamp).toLocaleString()}</td>
                  <td style={{ padding: 10, border: '1px solid #ccc' }}>{log.user_id || 'System'}</td>
                  <td style={{ padding: 10, border: '1px solid #ccc' }}>{log.role}</td>
                  <td style={{ padding: 10, border: '1px solid #ccc' }}>{log.action}</td>
                  <td style={{ padding: 10, border: '1px solid #ccc' }}>{log.resource}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
