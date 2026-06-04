import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Calendar,
  BarChart3,
  Users,
  Settings,
  Plus,
  Trash2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { scheduleStore, EmployeeWithStats, EmployeeInput } from './scheduleStore';
import { authService } from '../authService';

import { FirmSidebar } from './FirmSidebar';

export function FirmEmployees() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeWithStats[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('edit');
  const [formValues, setFormValues] = useState<EmployeeInput>({ name: '', color: '#000000' });
  const [error, setError] = useState<string | null>(null);

  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [codeExpiry, setCodeExpiry] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const savedCode = localStorage.getItem('sb_emp_access_code');
    const savedExpiry = localStorage.getItem('sb_emp_code_expiry');
    if (savedCode && savedExpiry) {
      const expiry = parseInt(savedExpiry);
      if (Date.now() < expiry) {
        setAccessCode(savedCode);
        setCodeExpiry(expiry);
        setTimeLeft(Math.floor((expiry - Date.now()) / 1000));
      }
    }
  }, []);

  useEffect(() => {
    if (!codeExpiry || timeLeft <= 0) return;
    const timer = setInterval(() => {
      const remaining = Math.floor((codeExpiry - Date.now()) / 1000);
      if (remaining <= 0) {
        setAccessCode(null);
        setCodeExpiry(null);
        localStorage.removeItem('sb_emp_access_code');
        localStorage.removeItem('sb_emp_code_expiry');
        setTimeLeft(0);
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [codeExpiry, timeLeft]);

  const generateAccessCode = async () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes
    
    try {
      const res = await fetch('/api/auth/access-code', {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({ code, expiry })
      });
      if (res.ok) {
        localStorage.setItem('sb_emp_access_code', code);
        localStorage.setItem('sb_emp_code_expiry', expiry.toString());
        setAccessCode(code);
        setCodeExpiry(expiry);
        setTimeLeft(300);
      } else {
        alert('Failed to register access code on server');
      }
    } catch (e) {
      alert('Network error registering access code on server');
    }
  };

  const fetchEmployees = async () => {
    try {
      const list = await scheduleStore.listEmployees();
      setEmployees(list);
      if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].id);
        setFormValues({ name: list[0].name, color: list[0].color });
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const selectedEmployee = employees.find(e => e.id === selectedId);

  const handleSelect = (emp: EmployeeWithStats) => {
    setSelectedId(emp.id);
    setFormMode('edit');
    setFormValues({ name: emp.name, color: emp.color });
    setError(null);
  };

  const startCreate = () => {
    setSelectedId(null);
    setFormMode('create');
    setFormValues({ name: '', color: '#013220' });
    setError(null);
  };

  const onSave = async () => {
    try {
      if (formMode === 'create') {
        await scheduleStore.createEmployee(formValues);
      } else if (selectedId) {
        await scheduleStore.updateEmployee(selectedId, formValues);
      }
      await fetchEmployees();
    } catch (e: any) {
      setError(e.message || 'Validation error');
    }
  };

  const onDelete = async () => {
    if (!selectedId) return;
    try {
      await scheduleStore.deleteEmployee(selectedId);
      setSelectedId(null);
      await fetchEmployees();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="flex h-screen bg-white">
      <FirmSidebar />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mb-8">
          <h1 className="text-4xl mb-2 text-[#013220]" style={{ fontFamily: 'Playfair Display, serif' }}>
            Team Directory
          </h1>
          <p className="text-[#013220]/60">Manage your barbers and stylists</p>
        </div>

        <div className="grid grid-cols-12 gap-8 h-[calc(100vh-200px)]">
          {/* Master List */}
          <div className="col-span-4 bg-[#F5F5DC] rounded-[32px] p-6 border border-[#013220]/10 flex flex-col">
            <div className="flex flex-col gap-3 mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl text-[#013220] font-semibold">Employees</h2>
                <button
                  onClick={startCreate}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-[14px] bg-[#013220] text-white hover:bg-[#013220]/90"
                >
                  <Plus size={16} /> New
                </button>
              </div>
              <button
                onClick={generateAccessCode}
                className="w-full py-3 bg-[#D4AF37] text-[#013220] rounded-[16px] hover:bg-[#D4AF37]/90 font-semibold transition-all shadow-sm text-sm"
              >
                Generate Access Code
              </button>
              {accessCode && (
                <div className="p-3 bg-white border border-[#D4AF37] rounded-[16px] text-center shadow-sm">
                  <span className="text-xs text-[#013220]/60 block mb-1">
                    Join Code (Expires in {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')})
                  </span>
                  <span className="text-2xl font-mono font-bold text-[#013220] tracking-widest">{accessCode}</span>
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2">
              {employees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => handleSelect(emp)}
                  className={`w-full text-left p-4 rounded-[16px] flex items-center gap-4 transition-colors ${
                    selectedId === emp.id ? 'bg-[#013220] text-white' : 'bg-white text-[#013220] hover:bg-white/60'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: emp.color }} />
                  <div>
                    <div className="font-semibold">{emp.name}</div>
                    <div className={`text-sm ${selectedId === emp.id ? 'text-white/70' : 'text-[#013220]/60'}`}>
                      {emp.statistics.totalAppointments} appointments
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Detail View */}
          <div className="col-span-8 bg-white border border-[#013220]/10 rounded-[32px] p-8 flex flex-col">
            {(selectedEmployee || formMode === 'create') ? (
              <>
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-2xl font-semibold text-[#013220] mb-2">
                      {formMode === 'create' ? 'Add New Employee' : 'Edit Employee'}
                    </h2>
                    {formMode === 'edit' && (
                      <div className="flex gap-4 mt-4">
                        <div className="bg-[#F5F5DC] px-4 py-2 rounded-[12px]">
                          <span className="text-[#013220]/60 text-sm block">Revenue Generated</span>
                          <span className="text-[#013220] font-bold">${selectedEmployee?.statistics.totalRevenue}</span>
                        </div>
                        <div className="bg-[#F5F5DC] px-4 py-2 rounded-[12px]">
                          <span className="text-[#013220]/60 text-sm block">Avg. Reliability</span>
                          <span className="text-[#013220] font-bold">{selectedEmployee?.statistics.averageReliability}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {formMode === 'edit' && (
                    <button
                      onClick={onDelete}
                      className="p-3 text-[#d4183d] hover:bg-[#d4183d]/10 rounded-[16px] transition-colors"
                      title="Delete Employee"
                    >
                      <Trash2 size={24} />
                    </button>
                  )}
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-[#d4183d]/10 border border-[#d4183d]/20 text-[#d4183d] rounded-[16px] flex items-center gap-2">
                    <AlertTriangle size={20} />
                    {error}
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-[#013220] mb-2">Full Name</label>
                    <input
                      type="text"
                      value={formValues.name}
                      onChange={e => setFormValues(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 rounded-[16px] border border-[#013220]/20 text-[#013220] bg-white focus:ring-2 focus:ring-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#013220] mb-2">Theme Color</label>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={formValues.color}
                        onChange={e => setFormValues(prev => ({ ...prev, color: e.target.value }))}
                        className="w-16 h-16 rounded-[16px] cursor-pointer"
                      />
                      <span className="text-[#013220]/60">{formValues.color}</span>
                    </div>
                  </div>
                </div>

                {formMode === 'edit' && (
                  <div className="mt-8 p-4 bg-yellow-50 rounded-[16px] flex items-start gap-3 border border-yellow-200">
                    <Info className="text-yellow-600 flex-shrink-0" />
                    <p className="text-sm text-yellow-700">
                      <strong>Warning:</strong> Deleting this employee will instantly delete all <strong>{selectedEmployee?.statistics.totalAppointments}</strong> of their scheduled appointments via a cascade delete.
                    </p>
                  </div>
                )}

                <div className="mt-auto pt-8 border-t border-[#013220]/10 flex justify-end">
                  <button
                    onClick={onSave}
                    className="px-8 py-3 bg-[#013220] text-white rounded-[16px] font-semibold hover:bg-[#013220]/90 transition-colors"
                  >
                    Save Details
                  </button>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[#013220]/40">
                <Users size={64} className="mb-4" />
                <p>Select an employee or create a new one</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
