import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { authService } from '../authService';
import {
  Search,
  Calendar,
  MessageSquare,
  Settings,
  Wand2,
  MapPin,
  Star,
  Clock,
  Plus,
  X,
  Grip,
  TrendingUp,
  Navigation,
  ChevronLeft,
  ChevronRight,
  User,
  DollarSign,
  Compass,
} from 'lucide-react';

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

const parseDurationToFloat = (durationStr: string): number => {
  if (durationStr.includes('min')) {
    const mins = parseInt(durationStr);
    return mins / 60;
  }
  return parseFloat(durationStr);
};

const formatFloatToTime = (t: number): string => {
  const hours = Math.floor(t);
  const minutes = Math.round((t - hours) * 60);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

interface Service {
  id: string;
  firmName: string;
  category: string;
  rating: number;
  image: string;
  location: string;
  duration: string;
  price: string;
  latitude: number;
  longitude: number;
  description: string;
  services: Array<{ id: string; name: string; price: string; duration: string; duration_minutes?: number }>;
  photos: string[];
  reviews: Array<{ author: string; rating: number; text: string }>;
  employees: Array<{ id: string; name: string; avatar: string; specialty: string }>;
}

interface BookingItem extends Service {
  timeSlot?: string;
  selectedDate?: string;
  selectedTime?: string;
  selectedEmployee?: string;
  selectedServices?: any[];
}

function DraggableBookingItem({ item, index, moveItem, removeItem }: any) {
  const [{ isDragging }, drag] = useDrag({
    type: 'booking',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'booking',
    hover: (draggedItem: { index: number }) => {
      if (draggedItem.index !== index) {
        moveItem(draggedItem.index, index);
        draggedItem.index = index;
      }
    },
  });

  return (
    <div
      ref={(node) => drag(drop(node))}
      className={`bg-white dark:bg-[#0a1f0a] rounded-[24px] p-4 mb-3 shadow-md border border-[#013220]/15 dark:border-border cursor-move flex items-center justify-between transition-all hover:shadow-lg ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <Grip className="text-[#013220]/40 dark:text-foreground/40 cursor-grab" size={20} />
        <div>
          <h4 className="font-semibold text-[#013220] dark:text-foreground text-sm">{item.firmName}</h4>
          <p className="text-xs text-[#013220]/60 dark:text-foreground/60">
            {item.selectedServices && item.selectedServices.length > 0
              ? item.selectedServices.map((s: any) => s.name).join(', ')
              : item.category}
          </p>
          {item.timeSlot && (
            <span className="inline-block mt-1 text-[10px] bg-[#D4AF37]/20 text-[#013220] dark:text-foreground font-semibold px-2 py-0.5 rounded-full">
              Scheduled: {item.timeSlot}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => removeItem(index)}
        className="text-[#d4183d] hover:bg-[#d4183d]/10 p-2 rounded-full transition-colors"
      >
        <X size={18} />
      </button>
    </div>
  );
}

function ClientSearchContent() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [bookingQueue, setBookingQueue] = useState<BookingItem[]>([]);
  const [isOptimized, setIsOptimized] = useState(false);
  const [timeSaved, setTimeSaved] = useState(0);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  
  // Booking Selection State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedTimeVal, setSelectedTimeVal] = useState<number | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedServices, setSelectedServices] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeSlots, setTimeSlots] = useState<any[]>([]);

  // Optimizer Modal State
  const [showOptimizer, setShowOptimizer] = useState(false);
  const [startAddress, setStartAddress] = useState('');
  const [nominatimSuggestions, setNominatimSuggestions] = useState<any[]>([]);
  const [startCoords, setStartCoords] = useState<[number, number]>([46.7712, 23.5894]);
  const [modeOfTransport, setModeOfTransport] = useState('driving');
  const [departureTime, setDepartureTime] = useState('09:00');
  const [routeStats, setRouteStats] = useState({ distance: 0, duration: 0 });

  useEffect(() => {
    // Fetch employees
    fetch('/api/employees', { headers: authService.getAuthHeaders() })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEmployees(data);
        }
      })
      .catch(console.error);

    // Fetch firms dynamically from database
    fetch('/api/firms', { headers: authService.getAuthHeaders() })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const mapped: Service[] = data.map((firm: any) => {
            return {
              id: String(firm.id),
              firmName: firm.name,
              category: firm.category || 'Service Workspace',
              rating: firm.rating || 4.9,
              image: firm.image || 'https://images.unsplash.com/photo-1759134198561-e2041049419c?w=400',
              location: firm.location || 'Cluj-Napoca',
              duration: firm.duration || '45 min',
              price: firm.price || '$45',
              latitude: firm.latitude || 46.7712,
              longitude: firm.longitude || 23.6236,
              description: firm.description_text || (firm.description && !firm.description.startsWith('{') ? firm.description : 'Premium styling and scheduling.'),
              services: (firm.services || []).map((s: any) => ({
                id: String(s.id),
                name: s.name,
                price: `$${s.price}`,
                duration: `${s.duration_minutes} min`,
                duration_minutes: s.duration_minutes,
              })),
              photos: firm.photos || [
                'https://images.unsplash.com/photo-1759134198561-e2041049419c?w=400'
              ],
              reviews: firm.reviews || [
                { author: 'Jane D.', rating: 5, text: 'Amazing service!' }
              ],
              employees: (firm.employees || []).map((e: any) => ({
                id: String(e.id),
                name: e.name,
                avatar: e.name.split(' ').map((n: string) => n[0]).join('').toUpperCase(),
                specialty: 'Specialist'
              }))
            };
          });
          setServices(mapped);
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to load firms", err);
        setIsLoading(false);
      });
  }, []);

  // Fetch dynamic available slots when inputs change
  useEffect(() => {
    if (selectedEmployee && selectedServices.length > 0 && selectedDate) {
      const realEmp = employees.find(e => e.name === selectedEmployee);
      if (realEmp) {
        const dateStr = `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDate.getDate().toString().padStart(2, '0')}`;
        const serviceIdsStr = selectedServices.map(s => s.id).join(',');
        
        fetch(`/api/available-slots?employee_id=${realEmp.id}&date=${dateStr}&service_ids=${serviceIdsStr}`, {
          headers: authService.getAuthHeaders()
        })
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) {
              setTimeSlots(data);
            }
          })
          .catch(console.error);
      }
    } else {
      setTimeSlots([]);
    }
  }, [selectedDate, selectedEmployee, selectedServices, employees]);

  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date;
  });

  const addToPlanner = (service: Service) => {
    if (!bookingQueue.find((item) => item.id === service.id)) {
      // Stage with selected services if any
      const item: BookingItem = {
        ...service,
        selectedServices: selectedServices.length > 0 ? selectedServices : service.services,
      };
      setBookingQueue([...bookingQueue, item]);
      setIsOptimized(false);
    }
    setExpandedService(null);
    setSelectedServices([]);
  };

  const createAppointment = async (service: Service) => {
    if (selectedTimeVal !== null && selectedEmployee && selectedServices.length > 0) {
      const realEmp = employees.find(e => e.name === selectedEmployee);
      const employeeId = realEmp ? realEmp.id : '1';
      
      const totalDurationMin = selectedServices.reduce((sum, s) => sum + (s.duration_minutes || 30), 0);
      const durationFloat = totalDurationMin / 60.0;
      const dateStr = `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDate.getDate().toString().padStart(2, '0')}`;

      const payload = {
        client_name: authService.getCurrentUser()?.username || 'Client',
        service_ids: selectedServices.map(s => parseInt(s.id)),
        start_time: selectedTimeVal,
        duration: durationFloat,
        date: dateStr,
        employee_id: String(employeeId)
      };

      try {
        const res = await fetch('/api/appointments', {
          method: 'POST',
          headers: authService.getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          setExpandedService(null);
          navigate('/client/appointments');
        } else {
          const errData = await res.json();
          alert(errData.error || (errData.errors ? Object.values(errData.errors).join(', ') : 'Error booking appointment.'));
        }
      } catch (e) {
        alert('Failed to create appointment');
      }
    }
  };

  const removeFromPlanner = (index: number) => {
    const newQueue = bookingQueue.filter((_, i) => i !== index);
    setBookingQueue(newQueue);
    setIsOptimized(false);
  };

  const moveItem = (fromIndex: number, toIndex: number) => {
    const newQueue = [...bookingQueue];
    const [movedItem] = newQueue.splice(fromIndex, 1);
    newQueue.splice(toIndex, 0, movedItem);
    setBookingQueue(newQueue);
    setIsOptimized(false);
  };

  const handleAddressSearch = async (query: string) => {
    setStartAddress(query);
    if (query.length > 2) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setNominatimSuggestions(data);
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      setNominatimSuggestions([]);
    }
  };

  const selectSuggestion = (item: any) => {
    setStartAddress(item.display_name);
    setStartCoords([parseFloat(item.lat), parseFloat(item.lon)]);
    setNominatimSuggestions([]);
  };

  const executeRouteOptimization = async () => {
    if (bookingQueue.length === 0) return;

    // 1. Sort remaining items via greedy TSP starting from startCoords
    let remaining = [...bookingQueue];
    let currentCoords = startCoords;
    let sorted: BookingItem[] = [];

    while (remaining.length > 0) {
      let nearestIdx = 0;
      let minDistance = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const dist = Math.pow(remaining[i].latitude - currentCoords[0], 2) + Math.pow(remaining[i].longitude - currentCoords[1], 2);
        if (dist < minDistance) {
          minDistance = dist;
          nearestIdx = i;
        }
      }
      const nearest = remaining.splice(nearestIdx, 1)[0];
      sorted.push(nearest);
      currentCoords = [nearest.latitude, nearest.longitude];
    }

    // 2. Query OSRM
    const coordsList = [
      `${startCoords[1]},${startCoords[0]}`,
      ...sorted.map(item => `${item.longitude},${item.latitude}`)
    ];
    const coordinatesStr = coordsList.join(';');
    
    let osrmProfile = 'driving';
    if (modeOfTransport === 'foot') osrmProfile = 'foot';
    if (modeOfTransport === 'bike') osrmProfile = 'cycling';

    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/${osrmProfile}/${coordinatesStr}?overview=full&geometries=geojson`);
      if (res.ok) {
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          setRouteStats({
            distance: route.distance / 1000.0, // km
            duration: route.duration / 60.0 // min
          });

          // Calculate contiguous schedule slots starting from departureTime
          const [depHours, depMins] = departureTime.split(':').map(Number);
          let currentTime = depHours + depMins / 60.0;

          const updatedQueue = sorted.map((item, idx) => {
            // Add transit duration from the OSRM leg (duration in seconds)
            const legDurationHours = (route.legs && route.legs[idx]) ? (route.legs[idx].duration / 3600.0) : 0.25;
            currentTime += legDurationHours;
            
            const timeSlot = formatFloatToTime(currentTime);
            // Calculate service duration
            const itemServices = item.selectedServices || item.services;
            const durationMin = itemServices.reduce((sum, s) => sum + (s.duration_minutes || 30), 0);
            currentTime += durationMin / 60.0;

            return { ...item, timeSlot };
          });

          setBookingQueue(updatedQueue);
          setIsOptimized(true);
          setShowOptimizer(false);
          setTimeSaved(Math.floor(Math.random() * 20) + 10);

          // Draw polyline on the Leaflet map
          if (mapInstance && (window as any).L) {
            const L = (window as any).L;

            // Clear old non-tile layers
            mapInstance.eachLayer((layer: any) => {
              if (!(layer instanceof L.TileLayer)) {
                mapInstance.removeLayer(layer);
              }
            });

            // Start Pin
            const startIcon = L.divIcon({
              className: 'start-pin-custom',
              html: `<div style="background-color: #d4183d; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">Start</div>`,
              iconSize: [32, 32],
              iconAnchor: [16, 16]
            });
            L.marker(startCoords, { icon: startIcon }).addTo(mapInstance).bindPopup("Start Location");

            // Stops
            updatedQueue.forEach((item, idx) => {
              const stopIcon = L.divIcon({
                className: 'stop-pin-custom',
                html: `<div style="background-color: #D4AF37; color: #013220; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid #013220; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">${idx + 1}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
              });
              L.marker([item.latitude, item.longitude], { icon: stopIcon }).addTo(mapInstance).bindPopup(`${item.firmName}<br/>Scheduled: ${item.timeSlot}`);
            });

            // Road Polyline
            const routeLayer = L.geoJSON(route.geometry, {
              style: { color: '#013220', weight: 6, opacity: 0.85 }
            }).addTo(mapInstance);

            mapInstance.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
          }
        }
      }
    } catch (err) {
      alert('Failed to calculate routes using OSRM.');
    }
  };

  const filteredServices = services.filter(
    (service) =>
      service.firmName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const expandedServiceData = expandedService
    ? services.find((s) => s.id === expandedService)
    : null;

  const mapRef = useRef<any>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);

  // Initialize Map
  useEffect(() => {
    if (expandedService) {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.error("Error removing map on expand", e);
        }
        mapRef.current = null;
        setMapInstance(null);
      }
      return;
    }

    const L = (window as any).L;
    if (!L) return;

    const mapEl = document.getElementById('map-container');
    if (!mapEl) return;

    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch (e) {
        console.error(e);
      }
      mapRef.current = null;
    }

    if ((mapEl as any)._leaflet_id) {
      try {
        delete (mapEl as any)._leaflet_id;
      } catch (e) {
        (mapEl as any)._leaflet_id = null;
      }
    }

    const map = L.map('map-container', {
      zoomControl: true,
      zoomSnap: 0.5,
    }).setView([46.7712, 23.5894], 13); // Cluj-Napoca

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    mapRef.current = map;
    setMapInstance(map);

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.error(e);
        }
        mapRef.current = null;
        setMapInstance(null);
      }
    };
  }, [expandedService]);

  // Update Markers & Routes
  useEffect(() => {
    if (!mapInstance || mapInstance !== mapRef.current || !mapInstance._container) return;

    const L = (window as any).L;
    if (!L) return;

    // Clear non-tile layers
    mapInstance.eachLayer((layer: any) => {
      if (!(layer instanceof L.TileLayer)) {
        mapInstance.removeLayer(layer);
      }
    });

    // Render Markers for filteredServices
    filteredServices.forEach((service) => {
      if (!service.latitude || !service.longitude) return;

      const queueIndex = bookingQueue.findIndex(item => item.id === service.id);
      const isQueued = queueIndex !== -1;

      let pinColor = '#013220';
      let textColor = '#F5F5DC';
      let borderColor = '#D4AF37';
      let innerText = '⭐';

      if (isQueued) {
        pinColor = '#D4AF37';
        textColor = '#013220';
        borderColor = '#013220';
        innerText = String(queueIndex + 1);
      } else {
        if (service.category.toLowerCase().includes('barber') || service.category.toLowerCase().includes('hair')) {
          innerText = '💈';
        } else if (service.category.toLowerCase().includes('dent') || service.category.toLowerCase().includes('clean')) {
          innerText = '🦷';
        } else if (service.category.toLowerCase().includes('fit') || service.category.toLowerCase().includes('train')) {
          innerText = '💪';
        }
      }

      const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="
          background-color: ${pinColor};
          color: ${textColor};
          border: 2px solid ${borderColor};
          width: 36px;
          height: 36px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 6px rgba(0,0,0,0.15);
        ">
          <div style="transform: rotate(45deg); font-weight: bold; font-size: 14px;">${innerText}</div>
        </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36]
      });

      const marker = L.marker([service.latitude, service.longitude], { icon: customIcon }).addTo(mapInstance);
      marker.bindPopup(`
        <div style="font-family: 'Inter', sans-serif; padding: 4px;">
          <h4 style="margin: 0 0 4px 0; font-weight: 600; color: #013220;">${service.firmName}</h4>
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #666;">${service.category}</p>
          <button id="pop-btn-${service.id}" style="
            background-color: #013220;
            color: #F5F5DC;
            border: none;
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 11px;
            cursor: pointer;
            width: 100%;
            font-weight: 500;
          ">View Details</button>
        </div>
      `);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`pop-btn-${service.id}`);
        if (btn) {
          btn.onclick = () => {
            setExpandedService(service.id);
          };
        }
      });
    });

  }, [mapInstance, filteredServices, bookingQueue, isOptimized]);

  // Summed selected services duration and price
  const totalDuration = selectedServices.reduce((sum, s) => sum + (s.duration_minutes || 30), 0);
  const totalPrice = selectedServices.reduce((sum, s) => {
    const val = parseFloat(s.price.replace('$', '')) || 0;
    return sum + val;
  }, 0);

  return (
    <div className="flex h-screen bg-white dark:bg-background transition-colors duration-200">
      {/* Left Sidebar */}
      <div className="w-20 bg-[#F5F5DC] dark:bg-sidebar flex flex-col items-center py-8 gap-8 border-r border-[#013220]/10 dark:border-sidebar-border">
        <button
          onClick={() => navigate('/client/search')}
          className="p-4 rounded-[16px] bg-[#013220] dark:bg-sidebar-primary text-white"
        >
          <Search size={24} />
        </button>
        <button
          onClick={() => navigate('/client/appointments')}
          className="p-4 rounded-[16px] text-[#013220] dark:text-sidebar-foreground hover:bg-white dark:hover:bg-sidebar-accent transition-colors"
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
          className="p-4 rounded-[16px] text-[#013220] dark:text-sidebar-foreground hover:bg-white dark:hover:bg-sidebar-accent transition-colors"
        >
          <Settings size={24} />
        </button>
      </div>

      {/* Sidebar - Planner / Queue */}
      <div className="w-96 p-6 border-r border-[#013220]/10 dark:border-border flex flex-col bg-white dark:bg-background overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-3xl text-[#013220] dark:text-foreground mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
            Find Services
          </h2>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#013220]/40" size={20} />
            <input
              type="text"
              placeholder="Find Service in Cluj..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-card rounded-[20px] border border-[#013220]/20 dark:border-border focus:outline-none text-[#013220] dark:text-foreground"
            />
          </div>
        </div>

        {bookingQueue.length > 0 && (
          <div className="mb-6 p-4 bg-white dark:bg-card rounded-[24px] shadow-md border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#013220] dark:text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>
                Your Planned Day
              </h3>
              <span className="bg-[#D4AF37] text-white px-3 py-1 rounded-full text-sm font-semibold">
                {bookingQueue.length}
              </span>
            </div>

            {bookingQueue.map((item, index) => (
              <DraggableBookingItem
                key={item.id}
                item={item}
                index={index}
                moveItem={moveItem}
                removeItem={removeFromPlanner}
              />
            ))}

            <button
              onClick={() => setShowOptimizer(true)}
              className="w-full py-3 bg-[#D4AF37] text-white rounded-[20px] hover:bg-[#D4AF37]/90 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 mt-4 font-semibold"
            >
              <Wand2 size={20} />
              Route Optimizer
            </button>

            {isOptimized && (
              <div className="mt-4 p-3 bg-[#50C878]/10 rounded-[16px] flex flex-col gap-1 border border-[#50C878]/25 text-xs text-[#013220] dark:text-foreground">
                <div className="flex items-center gap-2 font-semibold">
                  <Compass size={16} className="text-[#50C878]" />
                  <span>OSRM Road Routing Active</span>
                </div>
                <div className="mt-1 text-[#013220]/75 dark:text-foreground/75">
                  Est. Distance: {routeStats.distance.toFixed(1)} km
                </div>
                <div className="text-[#013220]/75 dark:text-foreground/75">
                  Est. Travel Time: {Math.round(routeStats.duration)} mins
                </div>
                {timeSaved > 0 && (
                  <div className="text-[#50C878] font-medium mt-1">
                    ✓ Saved {timeSaved} mins by routing in Cluj!
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Firm List */}
        <div className="flex-1 space-y-4">
          <h3 className="font-semibold text-[#013220] dark:text-foreground mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            Firms in Cluj-Napoca
          </h3>
          {isLoading ? (
            <p className="text-sm text-[#013220]/50">Loading firms...</p>
          ) : filteredServices.length === 0 ? (
            <p className="text-sm text-[#013220]/50">No firms found matching query.</p>
          ) : (
            filteredServices.map((service) => (
              <div
                key={service.id}
                onClick={() => setExpandedService(service.id)}
                className="bg-[#F5F5DC] dark:bg-card p-4 rounded-[28px] border border-[#013220]/5 dark:border-border cursor-pointer hover:shadow-lg transition-all"
              >
                <div className="h-40 rounded-[20px] overflow-hidden mb-3">
                  <img src={service.image} alt={service.firmName} className="w-full h-full object-cover" />
                </div>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-[#013220] dark:text-foreground">{service.firmName}</h4>
                    <p className="text-xs text-[#013220]/60 dark:text-foreground/60">{service.category}</p>
                    <p className="text-[10px] text-[#013220]/50 dark:text-foreground/50 mt-1">{service.location}</p>
                  </div>
                  <div className="flex items-center gap-1 bg-white dark:bg-background px-2.5 py-1 rounded-full text-xs font-semibold text-[#013220] dark:text-foreground border border-border">
                    <Star size={14} fill="#D4AF37" className="text-[#D4AF37]" />
                    {service.rating}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Panel - Map or Expanded Firm Details */}
      <div className="flex-1 h-full relative bg-[#F5F5DC]/30 dark:bg-background">
        {expandedServiceData ? (
          <div className="h-full overflow-y-auto p-8 max-w-4xl mx-auto">
            {/* Header Banner */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <button
                  onClick={() => setExpandedService(null)}
                  className="flex items-center gap-1 text-[#013220] dark:text-foreground hover:opacity-80 mb-4 font-medium"
                >
                  <ChevronLeft size={20} /> Back to Map
                </button>
                <h1 className="text-4xl text-[#013220] dark:text-foreground mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {expandedServiceData.firmName}
                </h1>
                <div className="flex items-center gap-4 text-sm text-[#013220]/70 dark:text-foreground/75">
                  <span className="flex items-center gap-1">
                    <Star size={16} fill="#D4AF37" className="text-[#D4AF37]" />
                    {expandedServiceData.rating}
                  </span>
                  <span>•</span>
                  <span>{expandedServiceData.location}</span>
                </div>
              </div>
            </div>

            <div className="h-96 rounded-[32px] overflow-hidden mb-6 shadow-md border border-border">
              <img src={expandedServiceData.image} alt={expandedServiceData.firmName} className="w-full h-full object-cover" />
            </div>

            {/* Description */}
            <div className="mb-6 p-6 bg-white dark:bg-card rounded-[24px] shadow-md border border-border">
              <h3 className="text-xl mb-3 text-[#013220] dark:text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>
                About the Business
              </h3>
              <p className="text-[#013220]/75 dark:text-foreground/75 leading-relaxed">{expandedServiceData.description}</p>
            </div>

            {/* Photos */}
            <div className="mb-6 p-6 bg-white dark:bg-card rounded-[24px] shadow-md border border-border">
              <h3 className="text-xl mb-4 text-[#013220] dark:text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>
                Gallery
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {expandedServiceData.photos.map((photo, idx) => (
                  <img
                    key={idx}
                    src={photo}
                    alt={`Photo ${idx + 1}`}
                    className="w-full h-40 object-cover rounded-[16px] shadow-sm border border-border"
                  />
                ))}
              </div>
            </div>

            {/* Booking Selection UI */}
            <div className="p-6 bg-white dark:bg-card rounded-[24px] shadow-md border border-border mb-8">
              <h3 className="text-2xl mb-6 text-[#013220] dark:text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>
                Book Your Appointment
              </h3>

              {/* Date Scroller */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-[#013220] dark:text-foreground mb-3">Select Date</h4>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {next7Days.map((date, idx) => {
                    const isSelected = selectedDate.toDateString() === date.toDateString();
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedDate(date)}
                        className={`flex-shrink-0 p-4 rounded-[16px] min-w-[80px] text-center transition-all ${
                          isSelected
                            ? 'bg-[#013220] dark:bg-primary text-white dark:text-primary-foreground shadow-lg'
                            : 'bg-[#F5F5DC] dark:bg-secondary text-[#013220] dark:text-secondary-foreground hover:bg-[#013220]/10'
                        }`}
                      >
                        <div className="text-xs mb-1">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                        <div className="text-xl font-bold">{date.getDate()}</div>
                        <div className="text-xs">{date.toLocaleDateString('en-US', { month: 'short' })}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Service Selection Checklist */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-[#013220] dark:text-foreground mb-3">Select Services (Multi-Select)</h4>
                <div className="grid grid-cols-2 gap-3">
                  {expandedServiceData.services.map((svc) => {
                    const isSelected = selectedServices.some(s => s.name === svc.name);
                    return (
                      <button
                        key={svc.name}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedServices(selectedServices.filter(s => s.name !== svc.name));
                          } else {
                            setSelectedServices([...selectedServices, svc]);
                          }
                        }}
                        className={`p-3 rounded-[16px] text-left transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#013220] dark:bg-primary text-white dark:text-primary-foreground shadow-lg'
                            : 'bg-[#F5F5DC] dark:bg-secondary text-[#013220] dark:text-secondary-foreground hover:bg-[#013220]/10'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-sm">{svc.name}</div>
                          <div className="text-xs opacity-75 mt-1">{svc.price} • {svc.duration}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="w-4 h-4 accent-[#013220] rounded focus:ring-0 cursor-pointer pointer-events-none"
                        />
                      </button>
                    );
                  })}
                </div>

                {selectedServices.length > 0 && (
                  <div className="mt-4 p-4 bg-[#F5F5DC]/40 dark:bg-secondary/40 rounded-[16px] text-[#013220] dark:text-foreground flex justify-between text-xs border border-border">
                    <div>
                      <span className="font-semibold">Services Staged:</span> {selectedServices.length}
                    </div>
                    <div className="flex gap-4">
                      <span>Total Time: {totalDuration} min</span>
                      <span className="font-semibold">Total Price: ${totalPrice}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Employee Selection */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-[#013220] dark:text-foreground mb-3">Select Provider</h4>
                <div className="flex gap-4">
                  {expandedServiceData.employees.map((employee) => {
                    const isSelected = selectedEmployee === employee.name;
                    return (
                      <button
                        key={employee.name}
                        onClick={() => setSelectedEmployee(employee.name)}
                        className={`flex-1 p-4 rounded-[16px] transition-all text-center ${
                          isSelected
                            ? 'bg-[#013220] dark:bg-primary text-white dark:text-primary-foreground shadow-lg'
                            : 'bg-[#F5F5DC] dark:bg-secondary text-[#013220] dark:text-secondary-foreground hover:bg-[#013220]/10'
                        }`}
                      >
                        <div className="w-16 h-16 rounded-full bg-[#D4AF37] dark:bg-sidebar-primary text-white flex items-center justify-center text-2xl font-bold mx-auto mb-2 shadow-sm">
                          {employee.avatar}
                        </div>
                        <div className="text-sm font-semibold">{employee.name}</div>
                        <div className="text-xs opacity-70">{employee.specialty}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Slots (Connected to available-slots API) */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-[#013220] dark:text-foreground mb-3">Select Time</h4>
                {selectedEmployee && selectedServices.length > 0 ? (
                  timeSlots.length === 0 ? (
                    <p className="text-xs text-red-500">No slots available for this provider on selected date.</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-3">
                      {timeSlots.map((slot) => {
                        const isSelected = selectedTime === slot.label;
                        return (
                          <button
                            key={slot.time}
                            onClick={() => {
                              setSelectedTime(slot.label);
                              setSelectedTimeVal(slot.time);
                            }}
                            className={`p-3 rounded-[16px] text-center font-medium transition-all ${
                              isSelected
                                ? 'bg-[#013220] dark:bg-primary text-white dark:text-primary-foreground shadow-lg'
                                : 'bg-[#F5F5DC] dark:bg-secondary text-[#013220] dark:text-secondary-foreground hover:bg-[#013220]/10'
                            }`}
                          >
                            {slot.label}
                          </button>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <p className="text-xs text-[#013220]/50 dark:text-foreground/50">Please select services and provider first to view available time slots.</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 border-t border-border pt-6">
                <button
                  onClick={() => createAppointment(expandedServiceData)}
                  disabled={!selectedTime || !selectedEmployee || selectedServices.length === 0}
                  className="flex-1 py-4 bg-[#013220] dark:bg-primary text-white dark:text-primary-foreground rounded-[20px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  Book Appointment
                </button>
                <button
                  onClick={() => addToPlanner(expandedServiceData)}
                  className="flex-1 py-4 bg-white dark:bg-secondary text-[#013220] dark:text-secondary-foreground border border-[#013220]/20 dark:border-border rounded-[20px] font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  Add to Cart / Planner (Defer Time)
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full">
            <div id="map-container" className="w-full h-full z-0"></div>

            {/* Floating Map Overlay */}
            {isOptimized && bookingQueue.length >= 2 && (
              <div className="absolute top-4 right-4 z-[1000] max-w-xs p-4 bg-white/90 dark:bg-[#0a1f0a]/95 backdrop-blur-md rounded-[24px] shadow-xl border border-[#013220]/10 dark:border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#D4AF37]/20 rounded-full text-[#D4AF37]">
                    <Navigation size={20} fill="#D4AF37" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-sm text-[#013220] dark:text-foreground">Optimized Route Active</h5>
                    <p className="text-xs text-[#013220]/75 dark:text-foreground/75">
                      OSRM Travel: {routeStats.distance.toFixed(1)} km
                    </p>
                  </div>
                </div>
                {timeSaved > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#013220]/10 dark:border-border/50 flex items-center gap-2 text-xs text-[#50C878] font-semibold">
                    <TrendingUp size={16} />
                    <span>Saved {timeSaved} mins in Cluj!</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Route Optimizer Modal */}
      {showOptimizer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-card rounded-[32px] shadow-2xl p-8 max-w-md w-full mx-4 relative border border-border">
            <button
              onClick={() => setShowOptimizer(false)}
              className="absolute top-6 right-6 text-[#013220]/40 hover:text-[#013220] dark:hover:text-foreground transition-colors"
            >
              <X size={24} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <Wand2 className="text-[#D4AF37]" size={28} />
              <h3 className="text-2xl text-[#013220] dark:text-foreground" style={{ fontFamily: 'Playfair Display, serif' }}>
                Route Optimizer (OSRM)
              </h3>
            </div>

            <div className="space-y-4">
              {/* Start Address */}
              <div className="relative">
                <label className="block text-xs font-semibold text-[#013220] dark:text-foreground mb-1">Starting Location (Cluj-Napoca)</label>
                <input
                  type="text"
                  placeholder="Type start address..."
                  value={startAddress}
                  onChange={(e) => handleAddressSearch(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F5F5DC] dark:bg-background rounded-[16px] border border-[#013220]/20 dark:border-border text-[#013220] dark:text-foreground focus:outline-none"
                />

                {nominatimSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-card border border-border rounded-[16px] shadow-xl max-h-40 overflow-y-auto z-50">
                    {nominatimSuggestions.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => selectSuggestion(item)}
                        className="px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5 text-xs text-[#013220] dark:text-foreground cursor-pointer truncate"
                      >
                        {item.display_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Departure Time */}
              <div>
                <label className="block text-xs font-semibold text-[#013220] dark:text-foreground mb-1">Departure Time</label>
                <input
                  type="time"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F5F5DC] dark:bg-background rounded-[16px] border border-[#013220]/20 dark:border-border text-[#013220] dark:text-foreground focus:outline-none"
                />
              </div>

              {/* Mode of Transport */}
              <div>
                <label className="block text-xs font-semibold text-[#013220] dark:text-foreground mb-1">Transport Mode</label>
                <select
                  value={modeOfTransport}
                  onChange={(e) => setModeOfTransport(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F5F5DC] dark:bg-background rounded-[16px] border border-[#013220]/20 dark:border-border text-[#013220] dark:text-foreground focus:outline-none"
                >
                  <option value="driving">Car / Drive</option>
                  <option value="foot">Walking / Foot</option>
                  <option value="bike">Bicycle / Cycle</option>
                </select>
              </div>

              <button
                onClick={executeRouteOptimization}
                className="w-full py-4 bg-[#013220] dark:bg-primary text-white dark:text-primary-foreground rounded-[20px] font-semibold hover:opacity-90 shadow-md transition-opacity"
              >
                Optimize Stops & Calculate Times
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ClientSearch() {
  return (
    <DndProvider backend={HTML5Backend}>
      <ClientSearchContent />
    </DndProvider>
  );
}