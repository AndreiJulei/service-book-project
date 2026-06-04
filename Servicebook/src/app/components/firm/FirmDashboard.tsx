import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Calendar,
  BarChart3,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  AlertTriangle,
  Info,
  Plus,
  Trash2,
  Users,
  Star,
  UserX
} from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  Appointment,
  AppointmentInput,
  AppointmentValidationError,
  ValidationErrors,
  emptyAppointmentInput,
  formatTimeLabel,
  getReliabilityBorderClass,
  getReliabilityColorClass,
  getReliabilityReasoning,
} from './scheduleDomain';
import { scheduleStore, useScheduleAppointments, EmployeeWithStats } from './scheduleStore';
import { authStore } from './authStore';
import { authService } from '../authService';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM
const API_BASE = 'http://localhost:5001/api';

import { FirmSidebar } from './FirmSidebar';

export function FirmDashboard() {
  const navigate = useNavigate();
  const [appointments, refresh] = useScheduleAppointments(1000);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(
    appointments[0]?.id ?? null
  );
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('edit');
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [employees, setEmployees] = useState<EmployeeWithStats[]>([]);
  const [unavailabilities, setUnavailabilities] = useState<Record<string, any[]>>({});

  const dateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;

  const fetchAllUnavailabilities = async (empList: any[], targetDateStr: string) => {
    try {
      const results = await Promise.all(
        empList.map(async (emp) => {
          try {
            const res = await fetch(`/api/employees/${emp.id}/unavailable?date=${targetDateStr}`, {
              headers: authService.getAuthHeaders(),
            });
            if (res.ok) {
              const data = await res.json();
              return { empId: String(emp.id), blocks: data };
            }
          } catch (err) {
            console.error(err);
          }
          return { empId: String(emp.id), blocks: [] };
        })
      );
      const mapping: Record<string, any[]> = {};
      results.forEach(({ empId, blocks }) => {
        mapping[empId] = blocks;
      });
      setUnavailabilities(mapping);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (employees.length === 0) return;
    fetchAllUnavailabilities(employees, dateStr);
  }, [employees, currentDate]);

  // Reviews Dashboard State
  const [activeTab, setActiveTab] = useState<'schedule' | 'reviews'>('schedule');
  const [reviews, setReviews] = useState<any[]>([]);
  const [averageRating, setAverageRating] = useState<number>(0);
  const [firmId, setFirmId] = useState<number | null>(null);

  const fetchReviews = async (fid: number) => {
    try {
      const res = await fetch(`/api/firms/${fid}/reviews`, {
        headers: authService.getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
        if (data.length > 0) {
          const sum = data.reduce((acc: number, r: any) => acc + r.rating, 0);
          setAverageRating(Number((sum / data.length).toFixed(1)));
        } else {
          setAverageRating(0);
        }
      }
    } catch (err) {
      console.error("Failed to fetch firm reviews", err);
    }
  };

  const handleDeleteReview = async (reviewId: number) => {
    if (!window.confirm("Are you sure you want to delete this review?")) return;
    try {
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: authService.getAuthHeaders()
      });
      if (res.ok) {
        alert("Review deleted successfully.");
        if (firmId) fetchReviews(firmId);
      } else {
        alert("Failed to delete review.");
      }
    } catch (err) {
      alert("Error deleting review.");
    }
  };

  const handleBanUser = async (userId: number, username: string) => {
    if (!window.confirm(`Are you sure you want to ban ${username}? They will no longer be able to log in.`)) return;
    try {
      const res = await fetch(`/api/users/${userId}/ban`, {
        method: 'POST',
        headers: authService.getAuthHeaders()
      });
      if (res.ok) {
        alert(`User ${username} has been banned.`);
      } else {
        alert("Failed to ban user.");
      }
    } catch (err) {
      alert("Error banning user.");
    }
  };

  const getEmployeeName = (empId: any) => {
    const emp = employees.find(e => String(e.id) === String(empId));
    return emp ? emp.name : 'Unknown Staff';
  };

  useEffect(() => {
    authStore.getCurrentUser().then(user => {
      if (!user) {
        navigate('/');
        return;
      }
      
      // Fetch firm profile
      fetch('/api/firms/me', { headers: authService.getAuthHeaders() })
        .then(res => {
          if (res.ok) return res.json();
        })
        .then(data => {
          if (data && data.id) {
            setFirmId(data.id);
            fetchReviews(data.id);
          }
        })
        .catch(console.error);
    });
    scheduleStore.listEmployees().then(setEmployees).catch(console.error);
  }, [navigate]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const initialSelectedAppointment = appointments.find(
    (appointment) => appointment.id === selectedAppointmentId
  );
  const [formValues, setFormValues] = useState<AppointmentInput>(() => {
    const initDate = new Date();
    const initDateStr = `${initDate.getFullYear()}-${(initDate.getMonth() + 1).toString().padStart(2, '0')}-${initDate.getDate().toString().padStart(2, '0')}`;

    if (!initialSelectedAppointment) {
      return emptyAppointmentInput(initDateStr);
    }

    return {
      clientName: initialSelectedAppointment.clientName,
      service: initialSelectedAppointment.service,
      startTime: initialSelectedAppointment.startTime,
      duration: initialSelectedAppointment.duration,
      reliabilityScore: initialSelectedAppointment.reliabilityScore,
      employeeId: initialSelectedAppointment.employeeId,
      date: initialSelectedAppointment.date || initDateStr,
    };
  });

  const selectedAppointment = appointments.find(
    (appointment) => appointment.id === selectedAppointmentId
  );

  const selectAppointment = (appointment: Appointment) => {
    setSelectedAppointmentId(appointment.id);
    setFormMode('edit');
    setFieldErrors({});
    setFormValues({
      clientName: appointment.clientName,
      service: appointment.service,
      startTime: appointment.startTime,
      duration: appointment.duration,
      reliabilityScore: appointment.reliabilityScore,
      employeeId: appointment.employeeId,
      date: appointment.date,
    });
  };

  const startCreate = () => {
    setSelectedAppointmentId(null);
    setFormMode('create');
    setFieldErrors({});
    setFormValues(emptyAppointmentInput(dateStr));
  };

  // Auto-select first appointment of the day when date changes
  useEffect(() => {
    const dayAppts = appointments.filter(a => a.date === dateStr);
    if (dayAppts.length > 0) {
      const currentSelected = dayAppts.find(a => a.id === selectedAppointmentId);
      if (!currentSelected) {
        selectAppointment(dayAppts[0]);
      }
    } else {
      startCreate();
    }
  }, [currentDate, appointments]);

  const onSave = async () => {
    try {
      const valuesToSave = {
        ...formValues,
        date: formValues.date || dateStr
      };

      if (formMode === 'create') {
        const created = await scheduleStore.create(valuesToSave);
        await refresh();
        setSelectedAppointmentId(created.id);
        setFormMode('edit');
        selectAppointment(created);
        return;
      }

      if (!selectedAppointmentId) {
        return;
      }

      const updated = await scheduleStore.update(selectedAppointmentId, valuesToSave);
      await refresh();
      selectAppointment(updated);
    } catch (error) {
      if (error instanceof AppointmentValidationError) {
        setFieldErrors(error.fieldErrors);
      }
    }
  };

  const onDelete = async () => {
    if (!selectedAppointmentId) {
      return;
    }

    await scheduleStore.delete(selectedAppointmentId);
    await refresh();
    const remaining = appointments.filter((a) => a.id !== selectedAppointmentId);

    if (remaining.length === 0) {
      startCreate();
      return;
    }

    selectAppointment(remaining[0]);
  };

  const onFormTextChange =
    (field: 'clientName' | 'service') =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setFormValues((previous) => ({ ...previous, [field]: value }));
      setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
    };

  const onFormNumberChange =
    (field: 'startTime' | 'duration' | 'reliabilityScore') =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      const parsed = raw === '' ? Number.NaN : Number(raw);
      setFormValues((previous) => ({ ...previous, [field]: parsed }));
      setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
    };

  const onEmployeeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setFormValues((previous) => ({ ...previous, employeeId: value }));
    setFieldErrors((previous) => ({ ...previous, employeeId: undefined }));
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Tooltip.Provider>
      <div className="flex h-screen bg-white">
        <FirmSidebar />

      {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1
                  className="text-4xl mb-2 text-[#013220]"
                  style={{ fontFamily: 'Playfair Display, serif' }}
                >
                  Master Schedule
                </h1>
                <p className="text-[#013220]/60" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Manage team appointments and availability
                </p>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => scheduleStore.startGenerator()}
                  className="px-4 py-2 bg-[#50C878] text-white rounded-[16px] hover:bg-[#50C878]/90 transition-colors font-semibold shadow-sm"
                >
                  Start Generator
                </button>
                <button
                  onClick={() => scheduleStore.stopGenerator()}
                  className="px-4 py-2 bg-[#d4183d] text-white rounded-[16px] hover:bg-[#d4183d]/90 transition-colors font-semibold shadow-sm"
                >
                  Stop Generator
                </button>
                <button
                  onClick={() => setShowBroadcast(!showBroadcast)}
                  className="p-3 bg-[#D4AF37] text-white rounded-[16px] hover:bg-[#D4AF37]/90 transition-colors"
                >
                  <Megaphone size={24} />
                </button>
              </div>
            </div>

            {/* Offline Banner */}
            {!isOnline && (
              <div className="mb-6 p-4 bg-[#d4183d]/10 border-2 border-[#d4183d] rounded-[24px] flex items-center gap-3">
                <AlertTriangle className="text-[#d4183d]" size={24} />
                <div>
                  <h3 className="text-[#d4183d] font-bold">You are offline</h3>
                  <p className="text-[#d4183d]/80 text-sm">Changes will be saved locally and synced when you reconnect.</p>
                </div>
              </div>
            )}

            {/* Broadcast Message */}
            {showBroadcast && (
              <div className="mb-6 p-4 bg-[#F5F5DC] border-2 border-[#013220] rounded-[24px]">
                <textarea
                  placeholder="Broadcast message to all employees..."
                  rows={2}
                  className="w-full px-4 py-2 bg-white rounded-[16px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220] resize-none"
                />
                <div className="flex gap-2 mt-2">
                  <button className="px-4 py-2 bg-[#013220] text-white rounded-[12px] hover:bg-[#013220]/90">
                    Send
                  </button>
                  <button
                    onClick={() => setShowBroadcast(false)}
                    className="px-4 py-2 bg-white text-[#013220] rounded-[12px] hover:bg-[#013220]/5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Tabs Control */}
            <div className="flex border-b border-[#013220]/10 mb-6">
              <button
                onClick={() => setActiveTab('schedule')}
                className={`py-3 px-6 font-semibold border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'schedule'
                    ? 'border-[#D4AF37] text-[#013220]'
                    : 'border-transparent text-[#013220]/60 hover:text-[#013220]'
                }`}
              >
                <Calendar size={18} />
                Master Schedule
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`py-3 px-6 font-semibold border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'reviews'
                    ? 'border-[#D4AF37] text-[#013220]'
                    : 'border-transparent text-[#013220]/60 hover:text-[#013220]'
                }`}
              >
                <Star size={18} />
                Client Reviews
              </button>
            </div>

            {activeTab === 'schedule' ? (
              <>
                {/* Date Scroller */}
                <div className="mb-6 flex items-center justify-center gap-4">
                  <button
                    onClick={() => {
                      const newDate = new Date(currentDate);
                      newDate.setDate(newDate.getDate() - 1);
                      setCurrentDate(newDate);
                    }}
                    className="p-2 rounded-full hover:bg-[#F5F5DC] transition-colors"
                  >
                    <ChevronLeft size={24} className="text-[#013220]" />
                  </button>
                  <div className="px-8 py-3 bg-[#F5F5DC] rounded-[20px]">
                    <p className="text-[#013220] font-semibold">{formatDate(currentDate)}</p>
                  </div>
                  <button
                    onClick={() => {
                      const newDate = new Date(currentDate);
                      newDate.setDate(newDate.getDate() + 1);
                      setCurrentDate(newDate);
                    }}
                    className="p-2 rounded-full hover:bg-[#F5F5DC] transition-colors"
                  >
                    <ChevronRight size={24} className="text-[#013220]" />
                  </button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
                  {/* Gantt Chart */}
                  <div className="bg-white rounded-[32px] shadow-xl overflow-hidden">
                    {/* Time Header */}
                    <div className="flex border-b border-[#013220]/10">
                      <div className="w-48 flex-shrink-0 p-4 bg-[#F5F5DC] font-semibold text-[#013220]">
                        Staff Member
                      </div>
                      <div className="flex-1 flex">
                        {HOURS.map((hour) => (
                          <div
                            key={hour}
                            className="flex-1 p-4 text-center text-sm border-l border-[#013220]/10 bg-[#F5F5DC] text-[#013220]/70"
                          >
                            {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Employee Rows */}
                    {employees.map((employee) => (
                      <div key={employee.id} className="flex border-b border-[#013220]/10 relative">
                        <div className="w-48 flex-shrink-0 p-4 bg-[#F5F5DC] font-semibold text-[#013220] flex items-center">
                          <div
                            className="w-3 h-3 rounded-full mr-3"
                            style={{ backgroundColor: employee.color }}
                          />
                          {employee.name}
                        </div>
                        <div className="flex-1 flex relative h-24">
                          {/* Hour Grid */}
                          {HOURS.map((hour, index) => (
                            <div
                              key={hour}
                              className={`flex-1 border-l border-[#013220]/10 ${
                                index % 2 === 0 ? 'bg-white' : 'bg-[#F5F5DC]/30'
                              }`}
                            />
                          ))}

                          {/* Appointments */}
                          {appointments
                            .filter((appointment) => appointment.employeeId === employee.id && appointment.date === dateStr)
                            .map((appointment) => {
                              const left = ((appointment.startTime - 8) / 13) * 100;
                              const width = (appointment.duration / 13) * 100;
                              const isSelected = appointment.id === selectedAppointmentId;

                              return (
                                <Tooltip.Root key={appointment.id}>
                                  <Tooltip.Trigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => selectAppointment(appointment)}
                                      aria-label={`Select appointment ${appointment.clientName}`}
                                      className={`absolute top-2 bottom-2 rounded-[16px] p-2 text-left cursor-pointer hover:shadow-lg transition-shadow ${getReliabilityBorderClass(
                                        appointment.reliabilityScore
                                      )} ${isSelected ? 'ring-2 ring-[#013220] ring-offset-1' : ''}`}
                                      style={{
                                        left: `${left}%`,
                                        width: `${width}%`,
                                        backgroundColor: employee.color,
                                      }}
                                    >
                                      <div className="text-white text-xs font-semibold truncate">
                                        {appointment.clientName}
                                      </div>
                                      <div className="text-white text-xs opacity-90 truncate">
                                        {appointment.service}
                                      </div>
                                      <div
                                        className={`text-xs font-bold mt-1 ${getReliabilityColorClass(
                                          appointment.reliabilityScore
                                        )} bg-white px-2 py-0.5 rounded-full inline-block`}
                                      >
                                        {appointment.reliabilityScore}%
                                      </div>
                                    </button>
                                  </Tooltip.Trigger>
                                  <Tooltip.Portal>
                                    <Tooltip.Content
                                      className="bg-[#013220] text-white px-4 py-3 rounded-[16px] shadow-xl max-w-xs z-50"
                                      sideOffset={5}
                                    >
                                      <div className="space-y-2">
                                        <div>
                                          <p className="font-semibold">{appointment.clientName}</p>
                                          <p className="text-sm opacity-90">{appointment.service}</p>
                                        </div>
                                        <div className="pt-2 border-t border-white/20">
                                          <div className="flex items-center gap-2 mb-1">
                                            <span
                                              className={`font-bold ${getReliabilityColorClass(
                                                appointment.reliabilityScore
                                              )}`}
                                            >
                                              Reliability: {appointment.reliabilityScore}%
                                            </span>
                                            {appointment.reliabilityScore < 40 && (
                                              <AlertTriangle size={14} className="text-[#D4AF37]" />
                                            )}
                                          </div>
                                          <p className="text-xs opacity-80">
                                            {getReliabilityReasoning(appointment.reliabilityScore)}
                                          </p>
                                        </div>
                                      </div>
                                      <Tooltip.Arrow className="fill-[#013220]" />
                                    </Tooltip.Content>
                                  </Tooltip.Portal>
                                </Tooltip.Root>
                              );
                            })}

                          {/* Unavailability Blocks */}
                          {(unavailabilities[String(employee.id)] || []).map((block) => {
                            const left = ((block.start_time - 8) / 13) * 100;
                            const width = (block.duration / 13) * 100;
                            const isBreak = block.reason.toLowerCase().includes('break') || block.reason.toLowerCase().includes('lunch');

                            return (
                              <Tooltip.Root key={block.id}>
                                <Tooltip.Trigger asChild>
                                  <div
                                    className={`absolute top-2 bottom-2 rounded-[16px] p-2 text-left hover:shadow-lg transition-shadow border flex flex-col justify-center ${
                                      isBreak
                                        ? 'bg-[#E2E2D0] text-[#013220] border-dashed border-[#013220]/40'
                                        : 'bg-[#d4183d]/20 text-[#d4183d] border-solid border-[#d4183d]/40'
                                    }`}
                                    style={{
                                      left: `${left}%`,
                                      width: `${width}%`,
                                    }}
                                  >
                                    <div className={`text-xs font-semibold truncate ${isBreak ? 'text-[#013220]' : 'text-[#d4183d]'}`}>
                                      {isBreak ? '☕ Break' : '🛑 Time Off'}
                                    </div>
                                    <div className={`text-[10px] truncate opacity-80 ${isBreak ? 'text-[#013220]' : 'text-[#d4183d]'}`}>
                                      {block.reason}
                                    </div>
                                  </div>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                  <Tooltip.Content
                                    className="bg-[#013220] text-white px-4 py-3 rounded-[16px] shadow-xl max-w-xs z-50"
                                    sideOffset={5}
                                  >
                                    <div className="space-y-1">
                                      <p className="font-semibold">{isBreak ? 'Break Time' : 'Time Off / Vacation'}</p>
                                      <p className="text-xs opacity-90">Reason: {block.reason}</p>
                                      <p className="text-xs opacity-90">
                                        Time: {formatTimeLabel(block.start_time)} - {formatTimeLabel(block.start_time + block.duration)}
                                      </p>
                                    </div>
                                    <Tooltip.Arrow className="fill-[#013220]" />
                                  </Tooltip.Content>
                                </Tooltip.Portal>
                              </Tooltip.Root>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Master-Detail Panel */}
                  <div className="bg-[#F5F5DC] rounded-[32px] p-6 border border-[#013220]/10">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl text-[#013220]" style={{ fontFamily: 'Playfair Display, serif' }}>
                        Appointment Detail
                      </h2>
                      <button
                        type="button"
                        onClick={startCreate}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-[14px] bg-[#013220] text-white hover:bg-[#013220]/90"
                        aria-label="Create new appointment"
                      >
                        <Plus size={16} />
                        New
                      </button>
                    </div>

                    <div className="mb-4 rounded-[20px] bg-white p-3 border border-[#013220]/10 max-h-44 overflow-auto">
                      <p className="text-sm font-semibold text-[#013220] mb-2">Master List</p>
                      <div className="space-y-2">
                        {appointments
                          .filter((appointment) => appointment.date === dateStr)
                          .map((appointment) => (
                            <button
                              key={appointment.id}
                              type="button"
                              onClick={() => selectAppointment(appointment)}
                              className={`w-full text-left p-2 rounded-[12px] transition-colors ${
                                selectedAppointmentId === appointment.id
                                  ? 'bg-[#013220] text-white'
                                  : 'bg-[#F5F5DC] text-[#013220] hover:bg-[#013220]/10'
                              }`}
                              aria-label={`Open details for ${appointment.clientName}`}
                            >
                              <div className="font-semibold text-sm">{appointment.clientName}</div>
                              <div className="text-xs opacity-80">
                                {appointment.service} - {formatTimeLabel(appointment.startTime)}
                              </div>
                            </button>
                          ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label htmlFor="clientName" className="block text-sm font-semibold text-[#013220] mb-1">
                          Client Name
                        </label>
                        <input
                          id="clientName"
                          type="text"
                          value={formValues.clientName}
                          onChange={onFormTextChange('clientName')}
                          className="w-full px-3 py-2 rounded-[12px] border border-[#013220]/20 text-[#013220]"
                        />
                        {fieldErrors.clientName && (
                          <p className="text-xs text-[#d4183d] mt-1">{fieldErrors.clientName}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="service" className="block text-sm font-semibold text-[#013220] mb-1">
                          Service
                        </label>
                        <select
                          id="service"
                          value={formValues.service}
                          onChange={onFormTextChange('service')}
                          className="w-full px-3 py-2 rounded-[12px] border border-[#013220]/20 text-[#013220] bg-white"
                        >
                          <option value="" disabled>Select a service</option>
                          <option value="Haircut">Haircut</option>
                          <option value="Styling">Styling</option>
                          <option value="Coloring">Coloring</option>
                          <option value="Treatment">Treatment</option>
                          <option value="Shave">Shave</option>
                        </select>
                        {fieldErrors.service && (
                          <p className="text-xs text-[#d4183d] mt-1">{fieldErrors.service}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="startTime" className="block text-sm font-semibold text-[#013220] mb-1">
                            Start Time
                          </label>
                          <input
                            id="startTime"
                            type="number"
                            step="0.25"
                            value={Number.isFinite(formValues.startTime) ? formValues.startTime : ''}
                            onChange={onFormNumberChange('startTime')}
                            className="w-full px-3 py-2 rounded-[12px] border border-[#013220]/20 text-[#013220]"
                          />
                          {fieldErrors.startTime && (
                            <p className="text-xs text-[#d4183d] mt-1">{fieldErrors.startTime}</p>
                          )}
                        </div>

                        <div>
                          <label htmlFor="duration" className="block text-sm font-semibold text-[#013220] mb-1">
                            Duration (hours)
                          </label>
                          <input
                            id="duration"
                            type="number"
                            step="0.25"
                            value={Number.isFinite(formValues.duration) ? formValues.duration : ''}
                            onChange={onFormNumberChange('duration')}
                            className="w-full px-3 py-2 rounded-[12px] border border-[#013220]/20 text-[#013220]"
                          />
                          {fieldErrors.duration && (
                            <p className="text-xs text-[#d4183d] mt-1">{fieldErrors.duration}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label
                            htmlFor="reliabilityScore"
                            className="block text-sm font-semibold text-[#013220] mb-1"
                          >
                            Reliability Score
                          </label>
                          <input
                            id="reliabilityScore"
                            type="number"
                            step="1"
                            value={
                              Number.isFinite(formValues.reliabilityScore)
                                ? formValues.reliabilityScore
                                : ''
                            }
                            onChange={onFormNumberChange('reliabilityScore')}
                            className="w-full px-3 py-2 rounded-[12px] border border-[#013220]/20 text-[#013220]"
                          />
                          {fieldErrors.reliabilityScore && (
                            <p className="text-xs text-[#d4183d] mt-1">{fieldErrors.reliabilityScore}</p>
                          )}
                        </div>

                        <div>
                          <label htmlFor="employeeId" className="block text-sm font-semibold text-[#013220] mb-1">
                            Employee
                          </label>
                          <select
                            id="employeeId"
                            value={formValues.employeeId}
                            onChange={onEmployeeChange}
                            className="w-full px-3 py-2 rounded-[12px] border border-[#013220]/20 text-[#013220] bg-white"
                          >
                            <option value="">Select employee</option>
                            {employees.map((employee) => (
                              <option key={employee.id} value={employee.id}>
                                {employee.name}
                              </option>
                            ))}
                          </select>
                          {fieldErrors.employeeId && (
                            <p className="text-xs text-[#d4183d] mt-1">{fieldErrors.employeeId}</p>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={onSave}
                          className="flex-1 px-3 py-2 rounded-[14px] bg-[#013220] text-white hover:bg-[#013220]/90"
                        >
                          {formMode === 'create' ? 'Create' : 'Save'}
                        </button>

                        <button
                          type="button"
                          onClick={onDelete}
                          disabled={!selectedAppointment}
                          className="px-3 py-2 rounded-[14px] bg-[#d4183d] text-white hover:bg-[#d4183d]/90 disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Delete selected appointment"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <p className="mt-4 text-xs text-[#013220]/70">
                      Validation rules: required fields, numeric ranges, day-end limit, and overlap checks per employee.
                    </p>
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-6 flex items-center justify-center gap-8">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border-2 border-[#D4AF37]"></div>
                    <span className="text-sm text-[#013220]">High-Risk Client (&lt;40%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Info size={16} className="text-[#D4AF37]" />
                    <span className="text-sm text-[#013220]">Hover for reliability details</span>
                  </div>
                </div>
              </>
            ) : (
              /* REVIEWS VIEW */
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Avg Rating */}
                  <div className="bg-[#F5F5DC] rounded-[24px] p-6 border border-[#013220]/10 flex flex-col items-center justify-center text-center">
                    <span className="text-sm font-semibold text-[#013220]/60 mb-2">Average Rating</span>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-5xl font-black text-[#013220]">{averageRating || 'N/A'}</span>
                      <Star className="text-[#D4AF37] fill-[#D4AF37] w-8 h-8" />
                    </div>
                    <div className="flex gap-1 mb-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={16}
                          className={
                            star <= Math.round(averageRating)
                              ? 'text-[#D4AF37] fill-[#D4AF37]'
                              : 'text-[#013220]/10'
                          }
                        />
                      ))}
                    </div>
                    <span className="text-xs text-[#013220]/60">Across all completed appointments</span>
                  </div>

                  {/* Total Reviews */}
                  <div className="bg-[#F5F5DC] rounded-[24px] p-6 border border-[#013220]/10 flex flex-col items-center justify-center text-center">
                    <span className="text-sm font-semibold text-[#013220]/60 mb-2">Total Reviews</span>
                    <span className="text-5xl font-black text-[#013220]">{reviews.length}</span>
                    <span className="text-xs text-[#013220]/60 mt-4">Verified client feedback</span>
                  </div>

                  {/* Rating distribution breakdown */}
                  <div className="bg-[#F5F5DC] rounded-[24px] p-6 border border-[#013220]/10 flex flex-col justify-center">
                    <span className="text-sm font-semibold text-[#013220]/60 mb-3 text-center">Reviews Breakdown</span>
                    <div className="space-y-1.5">
                      {[5, 4, 3, 2, 1].map((stars) => {
                        const count = reviews.filter((r) => r.rating === stars).length;
                        const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                        return (
                          <div key={stars} className="flex items-center gap-2 text-xs">
                            <span className="w-3 text-[#013220] font-semibold">{stars}</span>
                            <Star className="text-[#D4AF37] fill-[#D4AF37] w-3 h-3" />
                            <div className="flex-1 bg-[#013220]/5 h-2 rounded-full overflow-hidden">
                              <div className="bg-[#D4AF37] h-full" style={{ width: `${percentage}%` }}></div>
                            </div>
                            <span className="w-6 text-right text-[#013220]/60">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Reviews Feed list */}
                <div className="bg-white rounded-[24px] border border-[#013220]/10 p-6 shadow-sm">
                  <h3 className="text-2xl font-semibold text-[#013220] mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>
                    All Client Reviews
                  </h3>

                  {reviews.length === 0 ? (
                    <div className="text-center py-12 text-[#013220]/60 bg-[#F5F5DC]/20 rounded-[20px] border border-dashed border-[#013220]/10">
                      No reviews received yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reviews.map((review) => (
                        <div
                          key={review.id}
                          className="bg-[#F5F5DC]/30 p-5 rounded-[20px] border border-[#013220]/5 hover:border-[#013220]/10 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                        >
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-bold text-[#013220] text-lg">{review.client_name}</h4>
                                <p className="text-xs text-[#013220]/50 font-medium">
                                  Staff: <span className="text-[#013220] font-semibold">{getEmployeeName(review.employee_id)}</span> | Reviewed on {new Date(review.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    size={14}
                                    className={
                                      star <= review.rating
                                        ? 'text-[#D4AF37] fill-[#D4AF37]'
                                        : 'text-[#013220]/10'
                                    }
                                  />
                                ))}
                              </div>
                            </div>
                            {review.text ? (
                              <p className="text-sm text-[#013220]/80 italic mt-2">"{review.text}"</p>
                            ) : (
                              <p className="text-sm text-[#013220]/40 italic mt-2">No review text left.</p>
                            )}
                          </div>
                          <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
                            <button
                              onClick={() => handleDeleteReview(review.id)}
                              className="flex-1 sm:flex-initial px-4 py-2 bg-red-50 text-red-600 rounded-[14px] hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5 font-semibold text-xs border border-red-200"
                            >
                              <Trash2 size={14} />
                              Delete Review
                            </button>
                            <button
                              onClick={() => handleBanUser(review.client_user_id, review.client_name)}
                              className="flex-1 sm:flex-initial px-4 py-2 bg-[#013220] text-white rounded-[14px] hover:bg-[#013220]/90 transition-colors flex items-center justify-center gap-1.5 font-semibold text-xs shadow-sm"
                            >
                              <UserX size={14} />
                              Ban Client
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Tooltip.Provider>
  );
}
