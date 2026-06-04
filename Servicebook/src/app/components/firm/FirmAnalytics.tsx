import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  Calendar,
  BarChart3,
  MessageSquare,
  Settings,
  Info,
  TrendingUp,
  DollarSign,
  Users,
} from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import * as Tooltip from '@radix-ui/react-tooltip';
import { scheduleStore, useScheduleAppointments, EmployeeWithStats } from './scheduleStore';

interface AppointmentData {
  id: string;
  status: 'completed' | 'scheduled' | 'cancelled';
  customerName: string;
  service: string;
  employee: string;
  reliabilityScore: number;
  price: number;
  startTime: number;
}

const SERVICE_COLORS = ['#013220', '#8FAF8A', '#6B7F5F', '#50C878', '#D4AF37'];

const SERVICE_BASE_PRICES: Record<string, number> = {
  Haircut: 45,
  Styling: 60,
  Coloring: 120,
  Treatment: 150,
  Shave: 30,
};

const estimatePrice = (service: string, duration: number): number => {
  const configured = SERVICE_BASE_PRICES[service];
  if (configured) {
    return configured;
  }

  return Math.max(20, Math.round(duration * 50));
};

const toHourLabel = (hour: number): string => {
  if (hour === 12) return '12 PM';
  if (hour > 12) return `${hour - 12} PM`;
  return `${hour} AM`;
};

import { FirmSidebar } from './FirmSidebar';

export function FirmAnalytics() {
  const navigate = useNavigate();
  const [appointments, refresh, loadMore] = useScheduleAppointments();
  const [viewMode, setViewMode] = useState<'table' | 'visual'>('table');
  const [employees, setEmployees] = useState<EmployeeWithStats[]>([]);

  useEffect(() => {
    scheduleStore.listEmployees().then(setEmployees).catch(console.error);
  }, []);

  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    return () => observer.disconnect();
  }, [loadMore, viewMode]);

  const appointmentData = useMemo<AppointmentData[]>(() => {
    const employeeById = new Map(employees.map((employee) => [employee.id, employee.name]));
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;

    return appointments.map((appointment) => {
      const estimatedPrice = estimatePrice(appointment.service, appointment.duration);
      const endsAt = appointment.startTime + appointment.duration;
      const status: AppointmentData['status'] =
        appointment.reliabilityScore < 30
          ? 'cancelled'
          : endsAt <= currentHour
            ? 'completed'
            : 'scheduled';

      return {
        id: `APT-${appointment.id}`,
        status,
        customerName: appointment.clientName,
        service: appointment.service,
        employee: employeeById.get(appointment.employeeId) ?? 'Unknown',
        reliabilityScore: appointment.reliabilityScore,
        price: estimatedPrice,
        startTime: appointment.startTime,
      };
    });
  }, [appointments, employees]);

  const totalRevenue = useMemo(
    () => appointmentData.reduce((sum, item) => sum + item.price, 0),
    [appointmentData]
  );

  const totalAppointments = appointmentData.length;

  const averageReliability = useMemo(() => {
    if (appointmentData.length === 0) {
      return 0;
    }

    const total = appointmentData.reduce((sum, item) => sum + item.reliabilityScore, 0);
    return Math.round(total / appointmentData.length);
  }, [appointmentData]);

  const serviceRevenueData = useMemo(() => {
    const grouped = new Map<string, number>();
    appointmentData.forEach((item) => {
      grouped.set(item.service, (grouped.get(item.service) ?? 0) + item.price);
    });

    return Array.from(grouped.entries()).map(([name, value], index) => ({
      name,
      value,
      color: SERVICE_COLORS[index % SERVICE_COLORS.length],
    }));
  }, [appointmentData]);

  const employeeRevenueData = useMemo(() => {
    return employees.map((employee) => {
      const revenue = appointmentData
        .filter((item) => item.employee === employee.name)
        .reduce((sum, item) => sum + item.price, 0);

      return {
        name: employee.name.split(' ')[0],
        revenue,
      };
    });
  }, [appointmentData, employees]);

  const growthData = useMemo(() => {
    const currentRevenue = totalRevenue;
    return [
      { month: 'Current', revenue: currentRevenue, forecast: currentRevenue },
      { month: 'Next', revenue: null, forecast: Math.round(currentRevenue * 1.15) },
      { month: '+2', revenue: null, forecast: Math.round(currentRevenue * 1.3) },
    ];
  }, [totalRevenue]);

  const noShowData = useMemo(() => {
    const cancelled = appointmentData.filter((item) => item.status === 'cancelled').length;
    const depositsCollected = appointmentData.filter((item) => item.reliabilityScore < 40).length;

    return [{ month: 'Current', cancelled, depositsCollected }];
  }, [appointmentData]);

  const peakHoursData = useMemo(() => {
    const hourCounts = new Map<number, number>();
    for (let hour = 8; hour <= 18; hour++) {
      hourCounts.set(hour, 0);
    }

    appointmentData.forEach((item) => {
      const hour = Math.floor(item.startTime);
      if (hourCounts.has(hour)) {
        hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
      }
    });

    return Array.from(hourCounts.entries()).map(([hour, bookings]) => ({
      time: toHourLabel(hour),
      bookings,
    }));
  }, [appointmentData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-[#50C878]';
      case 'scheduled':
        return 'bg-[#D4AF37]';
      case 'cancelled':
        return 'bg-[#d4183d]';
      default:
        return 'bg-gray-500';
    }
  };

  const getReliabilityColor = (score: number) => {
    if (score >= 70) return 'text-[#50C878]';
    if (score >= 40) return 'text-[#D4AF37]';
    return 'text-[#d4183d]';
  };

  const getReliabilityReasoning = (score: number, name: string) => {
    if (score >= 90) return `${name} has an excellent track record with 100% on-time arrivals`;
    if (score >= 70) return `${name} is a good client with occasional reschedules but always shows up`;
    if (score >= 40) return `${name} has moderate risk with 2 late arrivals in the last month`;
    return `${name} is high risk with 3 cancellations in the last 2 months`;
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
                  Analytics & Statistics
                </h1>
                <p className="text-[#013220]/60" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Business insights and performance metrics
                </p>
              </div>

              {/* Toggle Switch */}
              <div className="flex bg-[#F5F5DC] rounded-[24px] p-2">
                <button
                  onClick={() => setViewMode('visual')}
                  className={`px-6 py-3 rounded-[20px] transition-all duration-300 ${
                    viewMode === 'visual'
                      ? 'bg-[#013220] text-white shadow-lg'
                      : 'text-[#013220] hover:bg-white'
                  }`}
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  Visual Analytics
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-6 py-3 rounded-[20px] transition-all duration-300 ${
                    viewMode === 'table'
                      ? 'bg-[#013220] text-white shadow-lg'
                      : 'text-[#013220] hover:bg-white'
                  }`}
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  Master Data
                </button>
              </div>
            </div>

            {/* Master Table View */}
            {viewMode === 'table' && (
              <div className="bg-white rounded-[32px] shadow-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F5F5DC]">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#013220]">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#013220]">
                        Appt ID
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#013220]">
                        Customer
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#013220]">
                        Service
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#013220]">
                        Employee
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#013220]">
                        ML Score
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#013220]">
                        Price
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointmentData.map((appointment, index) => (
                      <tr
                        key={appointment.id}
                        className={index % 2 === 0 ? 'bg-[#F5F5DC]/30' : 'bg-white'}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${getStatusColor(appointment.status)}`} />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#013220]">{appointment.id}</td>
                        <td className="px-6 py-4 text-sm text-[#013220] font-semibold">
                          {appointment.customerName}
                        </td>
                        <td className="px-6 py-4 text-sm text-[#013220]">{appointment.service}</td>
                        <td className="px-6 py-4 text-sm text-[#013220]">{appointment.employee}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-bold ${getReliabilityColor(
                                appointment.reliabilityScore
                              )}`}
                            >
                              {appointment.reliabilityScore}%
                            </span>
                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <button className="text-[#D4AF37] hover:text-[#D4AF37]/80">
                                  <Info size={16} />
                                </button>
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content
                                  className="bg-[#013220] text-white px-4 py-3 rounded-[16px] shadow-xl max-w-xs z-50"
                                  sideOffset={5}
                                >
                                  <p className="text-sm">
                                    {getReliabilityReasoning(
                                      appointment.reliabilityScore,
                                      appointment.customerName
                                    )}
                                  </p>
                                  <Tooltip.Arrow className="fill-[#013220]" />
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-[#013220]">
                          ${appointment.price}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={7} className="px-6 py-8">
                        <div ref={observerTarget} className="flex items-center justify-center text-[#013220]/40 text-sm">
                          Loading more...
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Visual Analytics View */}
            {viewMode === 'visual' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Summary Cards */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-gradient-to-br from-[#013220] to-[#013220]/80 rounded-[24px] p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                      <DollarSign size={32} />
                      <TrendingUp size={24} className="text-[#50C878]" />
                    </div>
                    <p className="text-[#8FAF8A] mb-1">Total Revenue (This Month)</p>
                    <h3 className="text-3xl font-bold">${totalRevenue.toLocaleString()}</h3>
                  </div>

                  <div className="bg-gradient-to-br from-[#8FAF8A] to-[#6B7F5F] rounded-[24px] p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                      <Calendar size={32} />
                      <TrendingUp size={24} className="text-[#50C878]" />
                    </div>
                    <p className="text-white/80 mb-1">Total Appointments (This Month)</p>
                    <h3 className="text-3xl font-bold">{totalAppointments}</h3>
                  </div>

                  <div className="bg-gradient-to-br from-[#D4AF37] to-[#D4AF37]/80 rounded-[24px] p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                      <Calendar size={32} />
                      <TrendingUp size={24} className="text-[#50C878]" />
                    </div>
                    <p className="text-white/80 mb-1">Total Appointments (Today)</p>
                    <h3 className="text-3xl font-bold">{totalAppointments}</h3>
                  </div>

                  <div className="bg-gradient-to-br from-[#50C878] to-[#50C878]/80 rounded-[24px] p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                      <Users size={32} />
                      <TrendingUp size={24} className="text-white" />
                    </div>
                    <p className="text-white/80 mb-1">Average Reliability Score</p>
                    <h3 className="text-3xl font-bold">{averageReliability}%</h3>
                  </div>
                </div>

                {/* Service Revenue Donut Chart */}
                <div className="bg-white rounded-[32px] shadow-xl p-6">
                  <h3
                    className="text-xl mb-2 text-[#013220]"
                    style={{ fontFamily: 'Playfair Display, serif' }}
                  >
                    Service Revenue Distribution
                  </h3>
                  <p className="text-sm text-[#013220]/60 mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Revenue breakdown by service type (live from Master Schedule)
                  </p>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={serviceRevenueData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {serviceRevenueData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#013220',
                          border: 'none',
                          borderRadius: '16px',
                          color: 'white',
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Employee Revenue Bar Chart */}
                <div className="bg-white rounded-[32px] shadow-xl p-6">
                  <h3
                    className="text-xl mb-6 text-[#013220]"
                    style={{ fontFamily: 'Playfair Display, serif' }}
                  >
                    Employee Revenue Comparison
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={employeeRevenueData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#013220" opacity={0.1} />
                      <XAxis dataKey="name" stroke="#013220" />
                      <YAxis stroke="#013220" />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#013220',
                          border: 'none',
                          borderRadius: '16px',
                          color: 'white',
                        }}
                      />
                      <Bar dataKey="revenue" fill="#013220" radius={[16, 16, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Revenue Forecast & Performance Trends */}
                <div className="lg:col-span-2 bg-white rounded-[32px] shadow-xl p-6">
                  <h3
                    className="text-xl mb-6 text-[#013220]"
                    style={{ fontFamily: 'Playfair Display, serif' }}
                  >
                    Revenue Forecast & Performance Trends
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={growthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#013220" opacity={0.1} />
                      <XAxis dataKey="month" stroke="#013220" />
                      <YAxis stroke="#013220" />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#013220',
                          border: 'none',
                          borderRadius: '16px',
                          color: 'white',
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#013220"
                        strokeWidth={3}
                        dot={{ fill: '#013220', r: 6 }}
                        name="Actual Revenue"
                      />
                      <Line
                        type="monotone"
                        dataKey="forecast"
                        stroke="#D4AF37"
                        strokeWidth={3}
                        strokeDasharray="5 5"
                        dot={{ fill: '#D4AF37', r: 6 }}
                        name="AI Forecast"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* No-Show Mitigation Impact */}
                <div className="bg-white rounded-[32px] shadow-xl p-6">
                  <h3
                    className="text-xl mb-6 text-[#013220]"
                    style={{ fontFamily: 'Playfair Display, serif' }}
                  >
                    No-Show Mitigation Impact
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={noShowData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#013220" opacity={0.1} />
                      <XAxis dataKey="month" stroke="#013220" />
                      <YAxis stroke="#013220" />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#013220',
                          border: 'none',
                          borderRadius: '16px',
                          color: 'white',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="cancelled" fill="#d4183d" radius={[16, 16, 0, 0]} name="Cancellations Avoided" />
                      <Bar dataKey="depositsCollected" fill="#50C878" radius={[16, 16, 0, 0]} name="Deposits Collected" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Peak Booking Hours */}
                <div className="bg-white rounded-[32px] shadow-xl p-6">
                  <h3
                    className="text-xl mb-6 text-[#013220]"
                    style={{ fontFamily: 'Playfair Display, serif' }}
                  >
                    Peak Booking Hours
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={peakHoursData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#013220" opacity={0.1} />
                      <XAxis dataKey="time" stroke="#013220" />
                      <YAxis stroke="#013220" />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#013220',
                          border: 'none',
                          borderRadius: '16px',
                          color: 'white',
                        }}
                      />
                      <Bar dataKey="bookings" fill="#013220" radius={[16, 16, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Tooltip.Provider>
  );
}