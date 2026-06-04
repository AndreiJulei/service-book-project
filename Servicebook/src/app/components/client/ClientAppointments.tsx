import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Search,
  Calendar,
  MessageSquare,
  Settings,
  MapPin,
  Clock,
  User,
  CheckCircle2,
  Shield,
  X,
  ChevronLeft,
  ChevronRight,
  Star,
} from 'lucide-react';
import { Dialog, DialogContent, DialogOverlay } from '../ui/dialog';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { authService } from '../authService';

const parseTimeToFloat = (timeStr: string): number => {
  const [time, modifier] = timeStr.split(' ');
  let [hoursStr, minutesStr] = time.split(':');
  let hours = parseInt(hoursStr);
  const minutes = parseInt(minutesStr);
  if (modifier === 'PM' && hours < 12) {
    hours += 12;
  }
  if (modifier === 'AM' && hours === 12) {
    hours = 0;
  }
  return hours + minutes / 60;
};

const formatFloatToTime = (time: number): string => {
  const hours24 = Math.floor(time);
  const minutes = Math.round((time - hours24) * 60);
  const period = hours24 >= 12 ? 'PM' : 'AM';
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

interface Appointment {
  id: string;
  firmName: string;
  service: string;
  date: string;
  time: string;
  employee: {
    name: string;
    avatar: string;
  };
  location: string;
  status: 'active' | 'completed';
  raw?: any;
}

export function ClientAppointments() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [trustScore, setTrustScore] = useState(100);

  const [appointments, setAppointments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState('10:00 AM');

  // Review Prompt State
  const [pendingReviews, setPendingReviews] = useState<any[]>([]);
  const [currentPendingReview, setCurrentPendingReview] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [apptRes, empRes] = await Promise.all([
        fetch('/api/appointments', { headers: authService.getAuthHeaders() }),
        fetch('/api/employees', { headers: authService.getAuthHeaders() })
      ]);
      const apptData = await apptRes.json();
      const empData = await empRes.json();
      
      if (apptData && Array.isArray(apptData.items)) {
        setAppointments(apptData.items);
        // Look up trust score (reliability score of the latest appointment, if any)
        if (apptData.items.length > 0) {
          const userObj = authService.getCurrentUser();
          if (userObj) {
            const clientAppts = apptData.items.filter((a: any) => a.clientUserId === userObj.user_id);
            if (clientAppts.length > 0) {
              // Sort by updated_at or id desc
              const sorted = [...clientAppts].sort((a, b) => b.id - a.id);
              setTrustScore(sorted[0].reliabilityScore ?? 100);
            }
          }
        }
      } else if (Array.isArray(apptData)) {
        setAppointments(apptData);
      }
      
      if (Array.isArray(empData)) {
        setEmployees(empData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPendingReviews = async () => {
    try {
      const res = await fetch('/api/pending-reviews', { headers: authService.getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setPendingReviews(data);
          setCurrentPendingReview(data[0]);
        }
      }
    } catch (e) {
      console.error("Failed to fetch pending reviews", e);
    }
  };

  useEffect(() => {
    fetchData();
    fetchPendingReviews();
  }, []);

  const getEmployeeDetails = (empId: any) => {
    const emp = employees.find(e => String(e.id) === String(empId));
    return {
      name: emp ? emp.name : 'Provider',
      avatar: emp ? emp.name.split(' ').map((n: string) => n[0]).join('') : 'P',
    };
  };

  const getStatus = (appt: any) => {
    return appt.status === 'completed' ? 'history' : 'active';
  };

  const formattedAppointments = appointments.map((appt: any) => {
    const empDetails = getEmployeeDetails(appt.employee_id || appt.employeeId);
    return {
      id: String(appt.id),
      firmName: appt.firmName || 'Business Partner',
      service: appt.service || 'Specialty Service',
      date: appt.date || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      time: formatFloatToTime(appt.start_time || appt.startTime),
      employee: empDetails,
      location: appt.location || 'Cluj-Napoca',
      status: getStatus(appt),
      raw: appt
    };
  });

  const filteredAppointments = formattedAppointments.filter((apt) => {
    if (viewMode === 'active') {
      return apt.raw.status === 'confirmed' || apt.raw.status === 'active';
    } else {
      return apt.raw.status === 'completed' || apt.raw.status === 'cancelled' || apt.raw.status === 'no_show';
    }
  });

  const timeSlots = [
    '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
    '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM'
  ];

  const handleReschedule = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setRescheduleDialogOpen(true);
  };

  const handleSendMessage = (appointment: Appointment) => {
    const empId = appointment.raw.employee_id || appointment.raw.employeeId;
    const emp = employees.find(e => String(e.id) === String(empId));
    if (emp && emp.user_id) {
      navigate('/client/chats', { 
        state: { 
          openWith: { 
            id: emp.user_id, 
            name: emp.name 
          } 
        } 
      });
    } else {
      navigate('/client/chats');
    }
  };

  const handleConfirmReschedule = async () => {
    if (!selectedAppointment) return;
    
    const timeFloat = parseTimeToFloat(selectedTime);
    const dateStr = selectedDate ? `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDate.getDate().toString().padStart(2, '0')}` : selectedAppointment.raw.date;
    
    const updatedRaw = {
      ...selectedAppointment.raw,
      start_time: timeFloat,
      date: dateStr,
      client_name: selectedAppointment.raw.client_name || selectedAppointment.raw.clientName || authService.getCurrentUser()?.username || 'Client',
      employee_id: selectedAppointment.raw.employee_id || selectedAppointment.raw.employeeId,
      reliability_score: selectedAppointment.raw.reliability_score || selectedAppointment.raw.reliabilityScore || 100,
      duration: selectedAppointment.raw.duration || 1.0,
      service: selectedAppointment.raw.service
    };
    
    try {
      const res = await fetch(`/api/appointments/${selectedAppointment.id}`, {
        method: 'PUT',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify(updatedRaw)
      });
      if (res.ok) {
        setRescheduleDialogOpen(false);
        setSelectedAppointment(null);
        fetchData();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Time slot overlap or validation error.');
      }
    } catch (e) {
      alert('Failed to reschedule appointment');
    }
  };

  const handleCancel = async (appointmentId: string) => {
    if (!confirm('Are you sure you want to cancel this appointment? Doing so will lower your client Trust Rank.')) {
      return;
    }
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'DELETE',
        headers: authService.getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Appointment cancelled successfully. Your new Trust Rank is ${data.reliability_score}%.`);
        setTrustScore(data.reliability_score);
        fetchData();
      } else {
        alert('Failed to cancel appointment');
      }
    } catch (e) {
      alert('Error cancelling appointment');
    }
  };

  const submitReview = async () => {
    if (!currentPendingReview) return;
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({
          appointment_id: currentPendingReview.id,
          rating: reviewRating,
          text: reviewText
        })
      });
      if (res.ok) {
        alert('Thank you for submitting your review!');
        const nextPending = pendingReviews.filter(r => r.id !== currentPendingReview.id);
        setPendingReviews(nextPending);
        setCurrentPendingReview(nextPending.length > 0 ? nextPending[0] : null);
        setReviewText('');
        setReviewRating(5);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to submit review');
      }
    } catch (e) {
      alert('Error submitting review');
    }
  };

  const skipReview = () => {
    if (!currentPendingReview) return;
    const nextPending = pendingReviews.filter(r => r.id !== currentPendingReview.id);
    setPendingReviews(nextPending);
    setCurrentPendingReview(nextPending.length > 0 ? nextPending[0] : null);
    setReviewText('');
    setReviewRating(5);
  };

  const getTrustScoreColor = () => {
    if (trustScore >= 80) return 'text-[#50C878]';
    if (trustScore >= 60) return 'text-[#D4AF37]';
    return 'text-[#d4183d]';
  };

  const getTrustScoreBorder = () => {
    if (trustScore >= 80) return 'border-[#50C878]';
    if (trustScore >= 60) return 'border-[#D4AF37]';
    return 'border-[#d4183d]';
  };

  return (
    <div className="flex h-screen bg-white dark:bg-background transition-colors duration-200">
      {/* Left Sidebar - Navigation */}
      <div className="w-20 bg-[#F5F5DC] dark:bg-sidebar flex flex-col items-center py-8 gap-8 border-r border-[#013220]/10 dark:border-sidebar-border">
        <button
          onClick={() => navigate('/client/search')}
          className="p-4 rounded-[16px] text-[#013220] dark:text-sidebar-foreground hover:bg-white dark:hover:bg-sidebar-accent transition-colors"
        >
          <Search size={24} />
        </button>
        <button
          onClick={() => navigate('/client/appointments')}
          className="p-4 rounded-[16px] bg-[#013220] dark:bg-sidebar-primary text-white"
        >
          <Calendar size={24} />
        </button>
        <button
          onClick={() => navigate('/client/chats')}
          className="p-4 rounded-[16px] text-[#013220] dark:text-sidebar-foreground hover:bg-white dark:hover:bg-sidebar-accent transition-colors"
        >
          <MessageSquare size={24} />
        </button>
        <button
          onClick={() => navigate('/client/settings')}
          className="p-4 rounded-[16px] text-[#013220] dark:text-sidebar-foreground hover:bg-white dark:hover:bg-sidebar-accent transition-colors mt-auto"
        >
          <Settings size={24} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl mb-2 text-[#013220] dark:text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>
                My Appointments
              </h1>
              <p className="text-[#013220]/60 dark:text-foreground/60" style={{ fontFamily: 'Inter, sans-serif' }}>
                Manage your upcoming and past bookings
              </p>
            </div>

            {/* Trust Gauge */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-[#013220]/60 dark:text-foreground/60 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Trust Rank
                </p>
                <p className="text-xs text-[#013220]/50 dark:text-foreground/50" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Loyalty Status
                </p>
              </div>
              <div
                className={`relative w-24 h-24 rounded-full border-4 ${getTrustScoreBorder()} flex items-center justify-center bg-white dark:bg-card shadow-lg`}
              >
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getTrustScoreColor()}`}>{trustScore}%</div>
                  {trustScore >= 80 && (
                    <CheckCircle2 className="mx-auto mt-1 text-[#50C878]" size={16} />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Trust Status Message */}
          {trustScore >= 80 ? (
            <div className="mb-6 p-4 bg-[#50C878]/10 rounded-[24px] flex items-center gap-3 border border-[#50C878]/25">
              <Shield className="text-[#50C878]" size={24} />
              <div>
                <p className="font-semibold text-[#013220] dark:text-foreground">Verified Member</p>
                <p className="text-sm text-[#013220]/70 dark:text-foreground/75">
                  You qualify for $0 deposit bookings and priority scheduling!
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-[#D4AF37]/10 rounded-[24px] flex items-center gap-3 border border-[#D4AF37]/25">
              <Shield className="text-[#D4AF37]" size={24} />
              <div>
                <p className="font-semibold text-[#013220] dark:text-foreground">Build Your Trust Rank</p>
                <p className="text-sm text-[#013220]/70 dark:text-foreground/75">
                  Complete appointments on time to unlock premium priority scheduling privileges.
                </p>
              </div>
            </div>
          )}

          {/* Toggle Switch */}
          <div className="mb-8 flex bg-[#F5F5DC] dark:bg-card rounded-[24px] p-2 w-fit border border-[#013220]/5 dark:border-border">
            <button
              onClick={() => setViewMode('active')}
              className={`px-6 py-3 rounded-[20px] transition-all duration-300 ${
                viewMode === 'active'
                  ? 'bg-[#013220] dark:bg-primary text-white dark:text-primary-foreground shadow-lg'
                  : 'text-[#013220] dark:text-foreground hover:bg-white dark:hover:bg-background'
              }`}
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Active
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`px-6 py-3 rounded-[20px] transition-all duration-300 ${
                viewMode === 'history'
                  ? 'bg-[#013220] dark:bg-primary text-white dark:text-primary-foreground shadow-lg'
                  : 'text-[#013220] dark:text-foreground hover:bg-white dark:hover:bg-background'
              }`}
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              History
            </button>
          </div>

          {/* Appointments Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="bg-[#013220] dark:bg-card rounded-[32px] p-6 text-white dark:text-foreground shadow-xl border border-border flex flex-col justify-between hover:shadow-2xl transition-all"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3
                        className="text-xl mb-1 text-white dark:text-foreground"
                        style={{ fontFamily: 'Playfair Display, serif' }}
                      >
                        {appointment.firmName}
                      </h3>
                      <p className="text-[#8FAF8A] dark:text-primary/80 font-semibold" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {appointment.service}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      appointment.raw.status === 'completed'
                        ? 'bg-[#50C878]/20 border-[#50C878] text-[#50C878]'
                        : appointment.raw.status === 'cancelled'
                        ? 'bg-[#d4183d]/20 border-[#d4183d] text-[#d4183d]'
                        : 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]'
                    }`}>
                      {appointment.raw.status?.toUpperCase() || 'CONFIRMED'}
                    </span>
                  </div>

                  <div className="space-y-3 mb-4 text-white/80 dark:text-foreground/80">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar size={16} className="text-[#D4AF37]" />
                      <span>{appointment.date}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock size={16} className="text-[#D4AF37]" />
                      <span>{appointment.time}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin size={16} className="text-[#D4AF37]" />
                      <span>{appointment.location}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/20 dark:border-border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-[#D4AF37] text-[#013220] flex items-center justify-center font-semibold">
                      {appointment.employee.avatar}
                    </div>
                    <div>
                      <p className="text-xs text-[#8FAF8A] dark:text-foreground/60">with</p>
                      <p className="font-semibold text-white dark:text-foreground">{appointment.employee.name}</p>
                    </div>
                  </div>
                  {appointment.status === 'active' && (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-3">
                        <button
                          className="flex-1 px-4 py-2.5 bg-[#D4AF37] text-[#013220] rounded-[16px] hover:opacity-90 transition-opacity font-semibold text-sm"
                          onClick={() => handleReschedule(appointment)}
                        >
                          Reschedule
                        </button>
                        <button
                          className="flex-1 px-4 py-2.5 bg-[#F5F5DC] dark:bg-secondary text-[#013220] dark:text-secondary-foreground rounded-[16px] hover:opacity-90 transition-opacity font-semibold text-sm"
                          onClick={() => handleSendMessage(appointment)}
                        >
                          Send Message
                        </button>
                      </div>
                      <button
                        className="w-full px-4 py-2.5 bg-[#d4183d] text-white rounded-[16px] hover:bg-[#d4183d]/90 transition-colors font-semibold text-sm"
                        onClick={() => handleCancel(appointment.id)}
                      >
                        Cancel Appointment
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredAppointments.length === 0 && (
            <div className="text-center py-16">
              <Calendar className="mx-auto mb-4 text-[#013220]/20 dark:text-foreground/20" size={64} />
              <p className="text-[#013220]/60 dark:text-foreground/60" style={{ fontFamily: 'Inter, sans-serif' }}>
                No {viewMode} appointments
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogOverlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1050]" />
        <DialogContent className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-card rounded-[24px] p-8 max-w-md w-full mx-auto shadow-2xl border border-border z-[1100]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[#013220] dark:text-foreground">Reschedule Appointment</h2>
            <button
              className="p-2 rounded-full bg-[#013220]/10 dark:bg-background text-[#013220] dark:text-foreground hover:opacity-80 transition-opacity"
              onClick={() => setRescheduleDialogOpen(false)}
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <MapPin size={24} className="text-[#D4AF37]" />
              <p className="text-[#013220] dark:text-foreground font-semibold">{selectedAppointment?.location}</p>
            </div>

            <div className="flex items-center gap-4">
              <User size={24} className="text-[#D4AF37]" />
              <p className="text-[#013220] dark:text-foreground font-semibold">{selectedAppointment?.employee.name}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#013220] dark:text-foreground mb-1">Select Date</label>
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="border border-[#013220]/20 dark:border-border rounded-[16px] p-2 bg-[#F5F5DC] dark:bg-background"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#013220] dark:text-foreground mb-1">Select Time</label>
              <select
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full border border-[#013220]/20 dark:border-border rounded-[16px] p-3 bg-[#F5F5DC] dark:bg-background text-[#013220] dark:text-foreground focus:outline-none"
              >
                {timeSlots.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              className="px-6 py-3 bg-[#D4AF37] text-[#013220] font-semibold rounded-[16px] hover:opacity-90 transition-opacity"
              onClick={handleConfirmReschedule}
            >
              Confirm Reschedule
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Prompt Modal */}
      {currentPendingReview && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1200]">
          <div className="bg-white dark:bg-card p-8 rounded-[32px] max-w-md w-full mx-4 relative border border-border shadow-2xl">
            <h3 className="text-2xl font-semibold text-[#013220] dark:text-foreground mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              Rate Your Experience!
            </h3>
            <p className="text-xs text-[#013220]/60 dark:text-foreground/60 mb-6 leading-relaxed">
              How was your appointment for <strong>{currentPendingReview.service}</strong> with <strong>{getEmployeeDetails(currentPendingReview.employee_id || currentPendingReview.employeeId).name}</strong>?
            </p>
            
            {/* Star selector */}
            <div className="flex justify-center gap-3 mb-6">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setReviewRating(star)}
                  className="focus:outline-none transform hover:scale-110 transition-transform"
                >
                  <Star
                    size={36}
                    fill={star <= reviewRating ? "#D4AF37" : "none"}
                    className={star <= reviewRating ? "text-[#D4AF37]" : "text-gray-300 dark:text-gray-600"}
                  />
                </button>
              ))}
            </div>
            
            {/* Text feedback */}
            <textarea
              placeholder="Tell us what you liked or how we can improve..."
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-[#F5F5DC] dark:bg-background border border-[#013220]/20 dark:border-border rounded-[20px] text-[#013220] dark:text-foreground focus:outline-none mb-6 resize-none"
            />
            
            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={submitReview}
                className="flex-1 py-3 bg-[#013220] dark:bg-primary text-white dark:text-primary-foreground font-semibold rounded-[16px] hover:opacity-90 transition-opacity"
              >
                Submit Review
              </button>
              <button
                onClick={skipReview}
                className="flex-1 py-3 bg-white dark:bg-secondary text-[#013220] dark:text-secondary-foreground border border-border font-semibold rounded-[16px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}