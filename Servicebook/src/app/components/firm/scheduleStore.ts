import { useCallback, useEffect, useState } from 'react';
import {
  Appointment,
  AppointmentInput,
  AppointmentValidationError,
  ValidationErrors,
} from './scheduleDomain';
import { authService } from '../authService';

const API_BASE = '/api';
const WS_BASE = import.meta.env.VITE_WS_URL 
  ? `${import.meta.env.VITE_WS_URL}/api/ws` 
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws`;

export interface Employee {
  id: string;
  name: string;
  color: string;
}

export interface EmployeeStatistics {
  totalAppointments: number;
  totalRevenue: number;
  averageReliability: number;
}

export interface EmployeeWithStats extends Employee {
  statistics?: EmployeeStatistics;
}

export interface EmployeeInput {
  name: string;
  color: string;
}

// ---------------------------------------------------------------------------
// REST Helpers
// ---------------------------------------------------------------------------

async function restFetch(endpoint: string, method = 'GET', body: any = null) {
  const options: RequestInit = {
    method,
    headers: authService.getAuthHeaders(),
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await response.json();
  
  if (!response.ok) {
    if (response.status === 400 && data.errors) {
      throw { status: 400, errors: data.errors };
    }
    throw new Error(data.error || 'API Error');
  }
  
  return data;
}

const toValidationErrors = (apiErrors: Record<string, string>): ValidationErrors => {
  const mapped: ValidationErrors = {};
  if (apiErrors.client_name) mapped.clientName = apiErrors.client_name;
  if (apiErrors.service) mapped.service = apiErrors.service;
  if (apiErrors.start_time) mapped.startTime = apiErrors.start_time;
  if (apiErrors.duration) mapped.duration = apiErrors.duration;
  if (apiErrors.reliability_score) mapped.reliabilityScore = apiErrors.reliability_score;
  if (apiErrors.employee_id) mapped.employeeId = apiErrors.employee_id;
  return mapped;
};

// ---------------------------------------------------------------------------
// Offline Queue Support
// ---------------------------------------------------------------------------

interface OfflineOp {
  type: 'create' | 'update' | 'delete';
  id?: string;
  input?: AppointmentInput;
  tempId?: string;
}

let offlineQueue: OfflineOp[] = [];
let localAppointments: Appointment[] = [];
let nextTempId = -1;
let isSyncing = false;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const scheduleStore = {
  currentPage: 1,
  hasMore: true,

  async sync(): Promise<void> {
    if (isSyncing || offlineQueue.length === 0 || !navigator.onLine) return;
    isSyncing = true;
    
    try {
      while (offlineQueue.length > 0) {
        const op = offlineQueue[0];
        if (op.type === 'create' && op.input) {
          await this.create(op.input, true);
        } else if (op.type === 'update' && op.id && op.input) {
          await this.update(op.id, op.input, true);
        } else if (op.type === 'delete' && op.id) {
          await this.delete(op.id, true);
        }
        offlineQueue.shift();
      }
    } catch (e) {
      console.error("Sync failed", e);
    } finally {
      isSyncing = false;
      this.currentPage = 1;
      await this.list(1);
    }
  },

  async list(page = 1, pageSize = 20): Promise<Appointment[]> {
    try {
      const data = await restFetch(`/appointments?page=${page}&page_size=${pageSize}`);
      this.hasMore = data.page < data.total_pages;
      
      const items = data.items as Appointment[];
      if (page === 1) {
        localAppointments = items;
      } else {
        localAppointments = [...localAppointments, ...items];
      }
      this.currentPage = page;
      
      offlineQueue.forEach(op => {
        if (op.type === 'create' && op.input) {
          localAppointments.push({
            id: op.tempId!,
            clientName: op.input.clientName,
            service: op.input.service,
            startTime: op.input.startTime,
            duration: op.input.duration,
            reliabilityScore: op.input.reliabilityScore,
            employeeId: op.input.employeeId,
            date: op.input.date,
          } as Appointment);
        } else if (op.type === 'delete') {
          localAppointments = localAppointments.filter(a => a.id !== op.id);
        } else if (op.type === 'update' && op.input) {
          localAppointments = localAppointments.map(a => 
            a.id === op.id ? { ...a, ...op.input } as Appointment : a
          );
        }
      });
      return localAppointments;
    } catch (e) {
      return localAppointments;
    }
  },

  async create(input: AppointmentInput, isSync = false): Promise<Appointment> {
    if (!navigator.onLine && !isSync) {
      const tempId = `offline-${--nextTempId}`;
      const optimistic: Appointment = {
        id: tempId,
        ...input
      } as Appointment;
      offlineQueue.push({ type: 'create', input, tempId });
      localAppointments = [...localAppointments, optimistic];
      return optimistic;
    }

    try {
      // Map frontend camelCase to backend snake_case
      const backendInput = {
        client_name: input.clientName,
        service: input.service,
        start_time: input.startTime,
        duration: input.duration,
        reliability_score: input.reliabilityScore,
        employee_id: input.employeeId,
        date: input.date
      };
      return await restFetch('/appointments', 'POST', backendInput);
    } catch (e: any) {
      if (e.status === 400 && e.errors) {
        throw new AppointmentValidationError(toValidationErrors(e.errors));
      }
      throw e;
    }
  },

  async update(id: string, input: AppointmentInput, isSync = false): Promise<Appointment> {
    if (!navigator.onLine && !isSync) {
      const optimistic: Appointment = { id, ...input } as Appointment;
      offlineQueue.push({ type: 'update', id, input });
      localAppointments = localAppointments.map(a => a.id === id ? optimistic : a);
      return optimistic;
    }

    try {
      const backendInput = {
        client_name: input.clientName,
        service: input.service,
        start_time: input.startTime,
        duration: input.duration,
        reliability_score: input.reliabilityScore,
        employee_id: input.employeeId,
        date: input.date
      };
      return await restFetch(`/appointments/${id}`, 'PUT', backendInput);
    } catch (e: any) {
      if (e.status === 400 && e.errors) {
        throw new AppointmentValidationError(toValidationErrors(e.errors));
      }
      throw e;
    }
  },

  async delete(id: string, isSync = false): Promise<boolean> {
    if (!navigator.onLine && !isSync) {
      offlineQueue.push({ type: 'delete', id });
      localAppointments = localAppointments.filter(a => a.id !== id);
      return true;
    }

    await restFetch(`/appointments/${id}`, 'DELETE');
    return true;
  },

  // Employees CRUD
  async listEmployees(): Promise<EmployeeWithStats[]> {
    return await restFetch('/employees');
  },

  async createEmployee(input: EmployeeInput): Promise<Employee> {
    return await restFetch('/employees', 'POST', input);
  },

  async updateEmployee(id: string, input: EmployeeInput): Promise<Employee> {
    return await restFetch(`/employees/${id}`, 'PUT', input);
  },

  async deleteEmployee(id: string): Promise<boolean> {
    await restFetch(`/employees/${id}`, 'DELETE');
    return true;
  },

  // Generator
  async startGenerator() {
    await restFetch('/generator/start', 'POST');
  },
  
  async stopGenerator() {
    await restFetch('/generator/stop', 'POST');
  }
};

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

type RefreshFn = () => Promise<void>;
type LoadMoreFn = () => Promise<void>;

export const useScheduleAppointments = (pageSize = 20): [Appointment[], RefreshFn, LoadMoreFn] => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const refresh = useCallback(async () => {
    scheduleStore.currentPage = 1;
    const list = await scheduleStore.list(1, pageSize);
    setAppointments([...list]);
  }, [pageSize]);

  const loadMore = useCallback(async () => {
    if (scheduleStore.hasMore) {
      const list = await scheduleStore.list(scheduleStore.currentPage + 1, pageSize);
      setAppointments([...list]);
    }
  }, [pageSize]);

  useEffect(() => {
    refresh();

    const handleOnline = () => {
      scheduleStore.sync().then(refresh);
    };
    window.addEventListener('online', handleOnline);

    let ws: WebSocket | null = null;
    const connectWs = () => {
      const token = authService.getAccessToken();
      const wsUrl = token ? `${WS_BASE}?token=${token}` : WS_BASE;
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'NEW_APPOINTMENT') {
            const newAppt = message.data as Appointment;
            setAppointments(prev => {
              const filtered = prev.filter(a => a.id !== newAppt.id);
              return [...filtered, newAppt].sort((a, b) => 
                String(a.employeeId).localeCompare(String(b.employeeId)) || a.startTime - b.startTime
              );
            });
          }
        } catch (e) {
          console.error("WS parse error", e);
        }
      };
      ws.onclose = () => {
        setTimeout(() => {
          if (navigator.onLine) connectWs();
        }, 3000);
      };
    };
    connectWs();

    return () => {
      window.removeEventListener('online', handleOnline);
      if (ws) ws.close();
    };
  }, [refresh]);

  return [appointments, refresh, loadMore];
};

export { AppointmentValidationError };
