import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Calendar,
  MessageSquare,
  Settings,
  Clock,
  User,
  AlertTriangle,
  Plus,
  Megaphone,
  CheckCircle,
  XCircle,
  Trash2,
  Star,
  List,
  Grid,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { authService } from '../authService';

const formatFloatToTime = (time: number): string => {
  const hours24 = Math.floor(time);
  const minutes = Math.round((time - hours24) * 60);
  const period = hours24 >= 12 ? 'PM' : 'AM';
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

export function EmployeeSchedule() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'schedule' | 'performance'>('schedule');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(() => {
    return localStorage.getItem('sb_employee_profile_id') || '';
  });
  const [appointments, setAppointments] = useState<any[]>([]);
  const [unavailabilities, setUnavailabilities] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [averageRating, setAverageRating] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Unavailability Form state
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [blockType, setBlockType] = useState<'break' | 'vacation'>('break');
  const [blockStart, setBlockStart] = useState('12:30');
  const [blockEnd, setBlockEnd] = useState('13:30');
  const [blockReason, setBlockReason] = useState('');
  const [broadcastMessage] = useState('Team meeting today at 5 PM in the main salon');

  const dateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;

  const fetchData = async () => {
    setIsLoading(true);
    try {
      let selfEmpId = selectedEmployeeId;
      if (!selfEmpId) {
        try {
          const selfRes = await fetch('/api/employees/me', { headers: authService.getAuthHeaders() });
          if (selfRes.ok) {
            const selfData = await selfRes.json();
            if (selfData && selfData.id) {
              selfEmpId = String(selfData.id);
              setSelectedEmployeeId(selfEmpId);
              localStorage.setItem('sb_employee_profile_id', selfEmpId);
            }
          }
        } catch (err) {
          console.error("Error fetching self profile", err);
        }
      }

      const [apptRes, empRes] = await Promise.all([
        fetch('/api/appointments?page_size=1000', { headers: authService.getAuthHeaders() }),
        fetch('/api/employees', { headers: authService.getAuthHeaders() })
      ]);
      const apptData = await apptRes.json();
      const empData = await empRes.json();
      
      let apptList = [];
      if (apptData && Array.isArray(apptData.items)) {
        apptList = apptData.items;
      } else if (Array.isArray(apptData)) {
        apptList = apptData;
      }
      setAppointments(apptList);
      
      if (Array.isArray(empData)) {
        setEmployees(empData);
        if (empData.length > 0 && !selfEmpId) {
          selfEmpId = String(empData[0].id);
          setSelectedEmployeeId(selfEmpId);
          localStorage.setItem('sb_employee_profile_id', selfEmpId);
        }
      }

      if (selfEmpId) {
        await Promise.all([
          fetchUnavailabilities(selfEmpId, dateStr),
          fetchReviews(selfEmpId)
        ]);
      }
    } catch (e) {
      console.error("Error loading schedule data", e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnavailabilities = async (empId: string, date: string) => {
    try {
      const res = await fetch(`/api/employees/${empId}/unavailable?date=${date}`, {
        headers: authService.getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setUnavailabilities(data);
      }
    } catch (err) {
      console.error("Error fetching unavailabilities", err);
    }
  };

  const fetchReviews = async (empId: string) => {
    try {
      const res = await fetch(`/api/employees/${empId}/reviews`, {
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
      console.error("Error fetching reviews", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) {
      localStorage.setItem('sb_employee_profile_id', selectedEmployeeId);
      Promise.all([
        fetchUnavailabilities(selectedEmployeeId, dateStr),
        fetchReviews(selectedEmployeeId)
      ]);
    }
  }, [selectedEmployeeId, dateStr]);

  const filteredAppointments = appointments.filter(
    (appt) => 
      String(appt.employee_id || appt.employeeId) === String(selectedEmployeeId) &&
      appt.date === dateStr
  );

  const activeEmployee = employees.find(e => String(e.id) === String(selectedEmployeeId));

  const handleMarkAttendance = async (appt: any, shown: boolean) => {
    const updatedScore = shown ? 100 : 0;
    const updatedRaw = {
      ...appt,
      client_name: appt.clientName || appt.client_name,
      employee_id: appt.employeeId || appt.employee_id,
      start_time: appt.startTime || appt.start_time,
      duration: appt.duration,
      service: appt.service,
      reliability_score: updatedScore
    };
    
    try {
      const res = await fetch(`/api/appointments/${appt.id}`, {
        method: 'PUT',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify(updatedRaw)
      });
      if (res.ok) {
        const currentScore = parseInt(localStorage.getItem('sb_client_trust_score') || '85');
        const newScore = shown 
          ? Math.min(100, currentScore + 5) 
          : Math.max(0, currentScore - 15);
        localStorage.setItem('sb_client_trust_score', newScore.toString());
        
        alert(`Client marked as ${shown ? 'SHOWN UP' : 'NO SHOW'}. Client trust score is now ${newScore}%.`);
        fetchData();
      } else {
        alert('Failed to update attendance on server.');
      }
    } catch (e) {
      alert('Error updating attendance.');
    }
  };

  const handleSaveBlock = async () => {
    if (!selectedEmployeeId) return;
    const [startH, startM] = blockStart.split(':').map(Number);
    const [endH, endM] = blockEnd.split(':').map(Number);
    
    const startFloat = startH + startM / 60;
    const endFloat = endH + endM / 60;
    
    if (endFloat <= startFloat) {
      alert("End time must be after start time");
      return;
    }
    
    const duration = endFloat - startFloat;
    const reasonText = blockReason.trim() || (blockType === 'break' ? 'Scheduled Break' : 'Vacation / Time Off');
    
    try {
      const res = await fetch(`/api/employees/${selectedEmployeeId}/unavailable`, {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({
          date: dateStr,
          start_time: startFloat,
          duration: duration,
          reason: reasonText
        })
      });
      
      if (res.ok) {
        setShowAddBlock(false);
        setBlockReason('');
        await fetchUnavailabilities(selectedEmployeeId, dateStr);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "Failed to save block");
      }
    } catch (err) {
      alert("Network error saving unavailability block");
    }
  };

  const handleDeleteBlock = async (id: number) => {
    if (!window.confirm("Are you sure you want to remove this block?")) return;
    try {
      const res = await fetch(`/api/unavailability/${id}`, {
        method: 'DELETE',
        headers: authService.getAuthHeaders()
      });
      if (res.ok) {
        await fetchUnavailabilities(selectedEmployeeId, dateStr);
      } else {
        alert("Failed to delete block");
      }
    } catch (err) {
      alert("Network error deleting block");
    }
  };

  const getReliabilityColor = (score: number) => {
    if (score >= 70) return 'text-[#50C878]';
    if (score >= 40) return 'text-[#D4AF37]';
    return 'text-[#d4183d]';
  };

  const getReliabilityBorder = (score: number) => {
    if (score < 40) return 'border-2 border-[#D4AF37]';
    return '';
  };

  // Helper to render hours for the visual grid
  const renderGridHours = () => {
    const hours = [];
    for (let h = 8; h <= 20; h++) {
      hours.push(h);
    }
    return hours;
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Left Sidebar - Navigation */}
      <div className="w-20 bg-[#F5F5DC] flex flex-col items-center py-8 gap-8 border-r border-[#013220]/10 flex-shrink-0">
        <button
          onClick={() => navigate('/employee/schedule')}
          className="p-4 rounded-[16px] bg-[#013220] text-white"
        >
          <Calendar size={24} />
        </button>
        <button
          onClick={() => navigate('/employee/chats')}
          className="p-4 rounded-[16px] text-[#013220] hover:bg-white transition-colors"
        >
          <MessageSquare size={24} />
        </button>
        <button
          onClick={() => navigate('/employee/settings')}
          className="p-4 rounded-[16px] text-[#013220] hover:bg-white transition-colors mt-auto"
        >
          <Settings size={24} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1
                className="text-4xl mb-2 text-[#013220]"
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                Staff Portal
              </h1>
              <p className="text-[#013220]/60" style={{ fontFamily: 'Inter, sans-serif' }}>
                {activeTab === 'schedule' ? 'Manage your daily agenda and breaks' : 'Track client feedback and performance reviews'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[#013220] font-semibold text-sm">Active Profile:</label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                disabled={!authService.hasRole('admin')}
                className="px-4 py-2 bg-[#F5F5DC] rounded-[16px] text-[#013220] font-semibold border-none focus:ring-2 focus:ring-[#D4AF37] outline-none disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={String(emp.id)}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Broadcast Banner */}
          {broadcastMessage && (
            <div className="mb-6 p-4 bg-[#F5F5DC] border-2 border-[#013220] rounded-[24px] flex items-start gap-3">
              <Megaphone className="text-[#013220] flex-shrink-0 mt-1" size={24} />
              <div>
                <h3 className="font-semibold text-[#013220] mb-1">Team Announcement</h3>
                <p className="text-[#013220]/80">{broadcastMessage}</p>
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
              My Schedule
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`py-3 px-6 font-semibold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'performance'
                  ? 'border-[#D4AF37] text-[#013220]'
                  : 'border-transparent text-[#013220]/60 hover:text-[#013220]'
              }`}
            >
              <Star size={18} />
              My Performance
            </button>
          </div>

          {activeTab === 'schedule' ? (
            <div>
              {/* Controls - Date Scroller & View Mode */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                {/* Date Scroller */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => {
                      const d = new Date(currentDate);
                      d.setDate(d.getDate() - 1);
                      setCurrentDate(d);
                    }}
                    className="p-2 rounded-full hover:bg-[#F5F5DC] transition-colors"
                  >
                    <ChevronLeft size={24} className="text-[#013220]" />
                  </button>
                  <div className="px-6 py-2 bg-[#F5F5DC] rounded-[20px] font-semibold text-[#013220]">
                    {currentDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                  <button
                    onClick={() => {
                      const d = new Date(currentDate);
                      d.setDate(d.getDate() + 1);
                      setCurrentDate(d);
                    }}
                    className="p-2 rounded-full hover:bg-[#F5F5DC] transition-colors"
                  >
                    <ChevronRight size={24} className="text-[#013220]" />
                  </button>
                </div>

                {/* View Mode Toggle */}
                <div className="flex bg-[#F5F5DC] p-1 rounded-[16px]">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-4 py-2 rounded-[12px] flex items-center gap-1 text-sm font-semibold transition-all ${
                      viewMode === 'grid'
                        ? 'bg-[#013220] text-white shadow-sm'
                        : 'text-[#013220]/70 hover:text-[#013220]'
                    }`}
                  >
                    <Grid size={16} />
                    Grid View
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-4 py-2 rounded-[12px] flex items-center gap-1 text-sm font-semibold transition-all ${
                      viewMode === 'list'
                        ? 'bg-[#013220] text-white shadow-sm'
                        : 'text-[#013220]/70 hover:text-[#013220]'
                    }`}
                  >
                    <List size={16} />
                    List View
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Schedule Timeline Column */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Add Block / Break Trigger */}
                  <button
                    onClick={() => setShowAddBlock(!showAddBlock)}
                    className="w-full py-3 bg-[#D4AF37] text-white rounded-[20px] hover:bg-[#D4AF37]/90 transition-all flex items-center justify-center gap-2 shadow-lg font-semibold"
                  >
                    <Plus size={20} />
                    Block Time / Add Break
                  </button>

                  {showAddBlock && (
                    <div className="bg-[#F5F5DC] rounded-[24px] p-6 border border-[#013220]/10">
                      <h3 className="font-semibold text-[#013220] mb-4 text-lg">Schedule Time Off / Break</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#013220] mb-1">Block Type</label>
                          <select
                            value={blockType}
                            onChange={(e) => setBlockType(e.target.value as any)}
                            className="w-full px-4 py-3 bg-white rounded-[16px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220]"
                          >
                            <option value="break">Short Break (Gray)</option>
                            <option value="vacation">Full Unavailable / Time Off (Red)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#013220] mb-1">Reason (Optional)</label>
                          <input
                            type="text"
                            placeholder="e.g. Lunch, Dentist appointment, Vacation"
                            value={blockReason}
                            onChange={(e) => setBlockReason(e.target.value)}
                            className="w-full px-4 py-3 bg-white rounded-[16px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220]"
                          />
                        </div>
                      </div>
                      <div className="flex gap-4 mb-4">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-[#013220] mb-1">Start Time</label>
                          <input
                            type="time"
                            value={blockStart}
                            onChange={(e) => setBlockStart(e.target.value)}
                            className="w-full px-4 py-3 bg-white rounded-[16px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220]"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-[#013220] mb-1">End Time</label>
                          <input
                            type="time"
                            value={blockEnd}
                            onChange={(e) => setBlockEnd(e.target.value)}
                            className="w-full px-4 py-3 bg-white rounded-[16px] border border-[#013220]/20 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#013220]"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveBlock}
                          className="flex-1 py-2.5 bg-[#013220] text-white rounded-[16px] hover:bg-[#013220]/90 font-semibold transition-all"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setShowAddBlock(false)}
                          className="flex-1 py-2.5 bg-white text-[#013220] rounded-[16px] hover:bg-[#013220]/5 border border-[#013220]/20 font-semibold transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {isLoading ? (
                    <div className="text-center py-8 text-[#013220]/60">Loading agenda...</div>
                  ) : viewMode === 'list' ? (
                    /* LIST VIEW */
                    <div className="space-y-3">
                      {filteredAppointments.length === 0 && unavailabilities.length === 0 ? (
                        <div className="text-center py-12 bg-[#F5F5DC]/40 rounded-[24px] text-[#013220]/60 border border-dashed border-[#013220]/20">
                          No appointments or breaks scheduled for this day.
                        </div>
                      ) : (
                        <>
                          {/* Appointments */}
                          {filteredAppointments.map((appt) => (
                            <div
                              key={appt.id}
                              className={`bg-[#013220] rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden ${getReliabilityBorder(
                                appt.reliabilityScore || appt.reliability_score
                              )}`}
                            >
                              <div className="flex items-start justify-between mb-4">
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Clock size={16} className="text-[#D4AF37]" />
                                    <span className="text-sm text-[#8FAF8A]">
                                      {formatFloatToTime(appt.startTime || appt.start_time)} - {formatFloatToTime((appt.startTime || appt.start_time) + (appt.duration || 1))}
                                    </span>
                                  </div>
                                  <h3 className="text-xl mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
                                    {appt.clientName || appt.client_name}
                                  </h3>
                                  <p className="text-[#8FAF8A]">{appt.service}</p>
                                </div>
                                <div className="text-center">
                                  <div
                                    className={`text-2xl font-bold ${getReliabilityColor(
                                      appt.reliabilityScore || appt.reliability_score
                                    )} bg-white px-4 py-2 rounded-[16px]`}
                                  >
                                    {appt.reliabilityScore || appt.reliability_score}%
                                  </div>
                                  {(appt.reliabilityScore || appt.reliability_score) < 40 && (
                                    <div className="mt-2 flex items-center gap-1 text-[#D4AF37] text-xs justify-center font-bold">
                                      <AlertTriangle size={14} />
                                      <span>High Risk</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="pt-4 border-t border-white/20 flex flex-col sm:flex-row gap-2">
                                <div className="flex-1 flex gap-2">
                                  <button
                                    onClick={() => handleMarkAttendance(appt, true)}
                                    className="flex-1 py-2 bg-[#50C878] text-white rounded-[16px] hover:bg-[#50C878]/90 transition-colors flex items-center justify-center gap-1 font-semibold text-sm shadow-md"
                                  >
                                    <CheckCircle size={16} />
                                    Client Shown Up
                                  </button>
                                  <button
                                    onClick={() => handleMarkAttendance(appt, false)}
                                    className="flex-1 py-2 bg-[#d4183d] text-white rounded-[16px] hover:bg-[#d4183d]/90 transition-colors flex items-center justify-center gap-1 font-semibold text-sm shadow-md"
                                  >
                                    <XCircle size={16} />
                                    No Show
                                  </button>
                                </div>
                                <button
                                  onClick={() => navigate('/employee/chats')}
                                  className="py-2 px-4 bg-white/20 text-white rounded-[16px] hover:bg-white/30 transition-colors font-semibold text-sm"
                                >
                                  Contact Client
                                </button>
                              </div>
                            </div>
                          ))}

                          {/* Unavailability blocks */}
                          {unavailabilities.map((block) => {
                            const isBreak = block.reason.toLowerCase().includes('break') || block.reason.toLowerCase().includes('lunch');
                            return (
                              <div
                                key={block.id}
                                className={`rounded-[24px] p-6 border-2 ${
                                  isBreak
                                    ? 'bg-[#F5F5DC] border-dashed border-[#013220]/30'
                                    : 'bg-[#d4183d]/5 border-solid border-[#d4183d]/20'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <Clock size={16} className={isBreak ? 'text-[#013220]/60' : 'text-[#d4183d]/80'} />
                                      <span className={`text-sm ${isBreak ? 'text-[#013220]/70' : 'text-[#d4183d]/90 font-medium'}`}>
                                        {formatFloatToTime(block.start_time)} - {formatFloatToTime(block.start_time + block.duration)}
                                      </span>
                                    </div>
                                    <h3 className={`text-lg font-semibold ${isBreak ? 'text-[#013220]' : 'text-[#d4183d]'}`}>
                                      {isBreak ? 'Break Time' : 'Time Off / Unavailable'}
                                    </h3>
                                    <p className="text-sm text-[#013220]/60">{block.reason}</p>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteBlock(block.id)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                    title="Delete Block"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  ) : (
                    /* VISUAL CALENDAR GRID VIEW */
                    <div className="bg-white rounded-[32px] border border-[#013220]/10 shadow-xl overflow-hidden relative">
                      {/* Hours Grid Columns */}
                      <div className="flex flex-col relative h-[780px] overflow-y-auto">
                        {renderGridHours().map((hour) => {
                          const topPos = (hour - 8) * 60;
                          return (
                            <div
                              key={hour}
                              className="absolute left-0 right-0 border-t border-[#013220]/5 flex items-center h-[60px]"
                              style={{ top: `${topPos}px` }}
                            >
                              <span className="w-20 pl-4 text-xs font-semibold text-[#013220]/50 select-none">
                                {hour === 12 ? '12:00 PM' : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`}
                              </span>
                              <div className="flex-1 border-t border-[#013220]/10 h-0"></div>
                            </div>
                          );
                        })}

                        {/* Staged Items Overlay */}
                        <div className="absolute left-20 right-0 top-0 bottom-0 pointer-events-none">
                          {/* Render appointments as absolute divs */}
                          {filteredAppointments.map((appt) => {
                            const start = appt.startTime || appt.start_time;
                            const duration = appt.duration || 1.0;
                            const top = (start - 8) * 60;
                            const height = duration * 60;
                            const reliability = appt.reliabilityScore || appt.reliability_score;
                            
                            return (
                              <div
                                key={appt.id}
                                className={`absolute left-4 right-4 bg-[#013220] rounded-[16px] p-3 text-white shadow-md pointer-events-auto border-l-4 transition-all hover:shadow-lg ${
                                  reliability < 40 ? 'border-l-[#D4AF37]' : 'border-l-[#50C878]'
                                }`}
                                style={{ top: `${top + 8}px`, height: `${height - 16}px` }}
                              >
                                <div className="flex items-start justify-between h-full">
                                  <div className="overflow-hidden">
                                    <p className="text-[11px] text-[#8FAF8A] font-semibold">
                                      {formatFloatToTime(start)} ({duration * 60}m)
                                    </p>
                                    <h4 className="font-bold text-sm truncate" style={{ fontFamily: 'Playfair Display, serif' }}>
                                      {appt.clientName || appt.client_name}
                                    </h4>
                                    <p className="text-xs text-[#8FAF8A] truncate">{appt.service}</p>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white ${getReliabilityColor(reliability)}`}>
                                      {reliability}%
                                    </span>
                                    {reliability < 40 && <AlertTriangle size={12} className="text-[#D4AF37]" />}
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {/* Render unavailability blocks as absolute divs */}
                          {unavailabilities.map((block) => {
                            const start = block.start_time;
                            const duration = block.duration;
                            const top = (start - 8) * 60;
                            const height = duration * 60;
                            const isBreak = block.reason.toLowerCase().includes('break') || block.reason.toLowerCase().includes('lunch');
                            
                            return (
                              <div
                                key={block.id}
                                className={`absolute left-4 right-4 rounded-[16px] p-3 pointer-events-auto shadow-sm border-l-4 ${
                                  isBreak
                                    ? 'bg-[#F5F5DC] text-[#013220] border-l-[#013220]/30 border-dashed border'
                                    : 'bg-[#d4183d]/10 text-[#d4183d] border-l-[#d4183d]'
                                }`}
                                style={{ top: `${top + 8}px`, height: `${height - 16}px` }}
                              >
                                <div className="flex items-start justify-between h-full">
                                  <div className="overflow-hidden">
                                    <p className="text-[11px] font-semibold opacity-70">
                                      {formatFloatToTime(start)} ({duration * 60}m)
                                    </p>
                                    <h4 className="font-bold text-sm truncate">
                                      {isBreak ? 'Break Time' : 'Time Off / Vacation'}
                                    </h4>
                                    <p className="text-xs opacity-80 truncate">{block.reason}</p>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteBlock(block.id)}
                                    className="p-1 rounded-full hover:bg-black/5 pointer-events-auto flex-shrink-0 text-red-600 transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Stats Sidebar Column */}
                <div className="space-y-6">
                  {/* Today's Summary */}
                  <div className="bg-gradient-to-br from-[#013220] to-[#013220]/80 rounded-[24px] p-6 text-white shadow-lg">
                    <h3 className="text-xl mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
                      Schedule Summary
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-[#8FAF8A] text-sm mb-1">Employee Profile</p>
                        <p className="text-xl font-bold">{activeEmployee ? activeEmployee.name : 'Not selected'}</p>
                      </div>
                      <div>
                        <p className="text-[#8FAF8A] text-sm mb-1">Date</p>
                        <p className="text-lg font-semibold">{currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                      </div>
                      <div>
                        <p className="text-[#8FAF8A] text-sm mb-1">Total Appointments</p>
                        <p className="text-3xl font-bold">{filteredAppointments.length}</p>
                      </div>
                      <div>
                        <p className="text-[#8FAF8A] text-sm mb-1">High Risk Clients</p>
                        <p className="text-3xl font-bold text-[#D4AF37]">
                          {filteredAppointments.filter((a) => (a.reliabilityScore || a.reliability_score) < 40).length}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#8FAF8A] text-sm mb-1">Blocked Intervals</p>
                        <p className="text-3xl font-bold">{unavailabilities.length}</p>
                      </div>
                    </div>
                  </div>

                  {/* Legend Panel */}
                  <div className="bg-[#F5F5DC] rounded-[24px] p-6 border border-[#013220]/10">
                    <h3 className="text-lg mb-3 text-[#013220] font-bold">Grid Legend</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-[#013220] border-l-4 border-[#50C878] rounded"></div>
                        <span className="text-[#013220] font-medium">Standard Appointment</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-[#013220] border-l-4 border-[#D4AF37] rounded"></div>
                        <span className="text-[#013220] font-medium">High Risk Appointment (&lt;40%)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-[#F5F5DC] border-l-4 border-[#013220]/30 border rounded"></div>
                        <span className="text-[#013220] font-medium">Short Rest / Lunch Break</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-[#d4183d]/10 border-l-4 border-[#d4183d] rounded"></div>
                        <span className="text-[#013220] font-medium">Vacation / Sick Leave</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* MY PERFORMANCE TAB */
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Rating Card */}
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
                  <span className="text-xs text-[#013220]/60">Based on client feedback</span>
                </div>

                {/* Total Reviews Card */}
                <div className="bg-[#F5F5DC] rounded-[24px] p-6 border border-[#013220]/10 flex flex-col items-center justify-center text-center">
                  <span className="text-sm font-semibold text-[#013220]/60 mb-2">Total Reviews</span>
                  <span className="text-5xl font-black text-[#013220]">{reviews.length}</span>
                  <span className="text-xs text-[#013220]/60 mt-4">Verified appointment reviews</span>
                </div>

                {/* Rating Breakdown Card */}
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

              {/* Reviews Feed */}
              <div className="bg-white rounded-[24px] border border-[#013220]/10 p-6 shadow-sm">
                <h3 className="text-2xl font-semibold text-[#013220] mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>
                  Client Feedback Feed
                </h3>

                {isLoading ? (
                  <div className="text-center py-8 text-[#013220]/60">Loading reviews...</div>
                ) : reviews.length === 0 ? (
                  <div className="text-center py-12 text-[#013220]/60 bg-[#F5F5DC]/20 rounded-[20px] border border-dashed border-[#013220]/10">
                    No reviews received yet. Completed bookings will trigger review prompts.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div
                        key={review.id}
                        className="bg-[#F5F5DC]/30 p-5 rounded-[20px] border border-[#013220]/5 hover:border-[#013220]/10 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-bold text-[#013220]">{review.client_name}</h4>
                            <p className="text-xs text-[#013220]/40">
                              {new Date(review.created_at).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                              })}
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
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
