export interface Appointment {
  id: string;
  clientName: string;
  service: string;
  startTime: number;
  duration: number;
  reliabilityScore: number;
  employeeId: string;
  date: string;
}

export interface AppointmentInput {
  clientName: string;
  service: string;
  startTime: number;
  duration: number;
  reliabilityScore: number;
  employeeId: string;
  date: string;
}

export interface Employee {
  id: string;
  name: string;
  color: string;
}

export interface ValidationErrors {
  clientName?: string;
  service?: string;
  startTime?: string;
  duration?: string;
  reliabilityScore?: string;
  employeeId?: string;
}

export class AppointmentValidationError extends Error {
  public readonly fieldErrors: ValidationErrors;

  constructor(fieldErrors: ValidationErrors) {
    super('Appointment validation failed');
    this.name = 'AppointmentValidationError';
    this.fieldErrors = fieldErrors;
  }
}

export const WORK_DAY_START = 8;
export const WORK_DAY_END = 21;

export const EMPLOYEES: Employee[] = [
  { id: '1', name: 'Marcus Chen', color: '#8FAF8A' },
  { id: '2', name: 'Sarah Williams', color: '#6B7F5F' },
  { id: '3', name: 'Jake Morrison', color: '#50C878' },
  { id: '4', name: 'Emily Zhang', color: '#4A7C59' },
];

export const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: '1',
    clientName: 'John Doe',
    service: 'Haircut',
    startTime: 9,
    duration: 1,
    reliabilityScore: 85,
    employeeId: '1',
  },
  {
    id: '2',
    clientName: 'Jane Smith',
    service: 'Coloring',
    startTime: 10.5,
    duration: 2,
    reliabilityScore: 92,
    employeeId: '1',
  },
  {
    id: '3',
    clientName: 'Bob Johnson',
    service: 'Shave',
    startTime: 9.5,
    duration: 0.75,
    reliabilityScore: 35,
    employeeId: '2',
  },
  {
    id: '4',
    clientName: 'Alice Brown',
    service: 'Styling',
    startTime: 11,
    duration: 1.5,
    reliabilityScore: 78,
    employeeId: '2',
  },
  {
    id: '5',
    clientName: 'Charlie Davis',
    service: 'Haircut',
    startTime: 10,
    duration: 1,
    reliabilityScore: 45,
    employeeId: '3',
  },
  {
    id: '6',
    clientName: 'Diana Evans',
    service: 'Treatment',
    startTime: 13,
    duration: 2,
    reliabilityScore: 95,
    employeeId: '3',
  },
];

export const emptyAppointmentInput = (defaultDate?: string): AppointmentInput => ({
  clientName: '',
  service: '',
  startTime: WORK_DAY_START,
  duration: 1,
  reliabilityScore: 70,
  employeeId: '',
  date: defaultDate ?? '',
});

const normalizeText = (value: string) => value.trim();

const hasOverlap = (
  appointments: Appointment[],
  appointment: AppointmentInput,
  currentId?: string
): boolean => {
  return appointments.some((existing) => {
    if (existing.employeeId !== appointment.employeeId) {
      return false;
    }

    if (currentId && existing.id === currentId) {
      return false;
    }

    const startA = existing.startTime;
    const endA = existing.startTime + existing.duration;
    const startB = appointment.startTime;
    const endB = appointment.startTime + appointment.duration;

    return startB < endA && endB > startA;
  });
};

export const validateAppointmentInput = (
  input: AppointmentInput,
  employeeIds: string[],
  existingAppointments: Appointment[] = [],
  currentId?: string
): ValidationErrors => {
  const errors: ValidationErrors = {};

  const clientName = normalizeText(input.clientName);
  if (!clientName) {
    errors.clientName = 'Client name is required';
  } else if (clientName.length < 2 || clientName.length > 60) {
    errors.clientName = 'Client name must be between 2 and 60 characters';
  }

  const service = normalizeText(input.service);
  if (!service) {
    errors.service = 'Service is required';
  } else if (service.length < 2 || service.length > 100) {
    errors.service = 'Service must be between 2 and 100 characters';
  }

  if (!Number.isFinite(input.startTime)) {
    errors.startTime = 'Start time must be a number';
  } else if (input.startTime < WORK_DAY_START || input.startTime >= WORK_DAY_END) {
    errors.startTime = `Start time must be between ${WORK_DAY_START} and ${WORK_DAY_END - 0.25}`;
  }

  if (!Number.isFinite(input.duration)) {
    errors.duration = 'Duration must be a number';
  } else if (input.duration <= 0 || input.duration > 8) {
    errors.duration = 'Duration must be greater than 0 and less than or equal to 8';
  }

  if (Number.isFinite(input.startTime) && Number.isFinite(input.duration)) {
    const endTime = input.startTime + input.duration;
    if (endTime > WORK_DAY_END) {
      errors.duration = `Appointment must end by ${WORK_DAY_END}:00`;
    }
  }

  if (!Number.isInteger(input.reliabilityScore)) {
    errors.reliabilityScore = 'Reliability score must be an integer';
  } else if (input.reliabilityScore < 0 || input.reliabilityScore > 100) {
    errors.reliabilityScore = 'Reliability score must be between 0 and 100';
  }

  if (!input.employeeId) {
    errors.employeeId = 'Employee is required';
  } else if (!employeeIds.includes(input.employeeId)) {
    errors.employeeId = 'Employee is not valid';
  }

  if (
    !errors.startTime &&
    !errors.duration &&
    !errors.employeeId &&
    hasOverlap(existingAppointments, input, currentId)
  ) {
    errors.startTime = 'Appointment overlaps an existing booking for this employee';
  }

  return errors;
};

const normalizeAppointmentInput = (input: AppointmentInput): AppointmentInput => ({
  clientName: normalizeText(input.clientName),
  service: normalizeText(input.service),
  startTime: input.startTime,
  duration: input.duration,
  reliabilityScore: input.reliabilityScore,
  employeeId: input.employeeId,
});

export class InMemoryAppointmentRepository {
  private appointments: Appointment[];
  private nextId: number;
  private readonly employeeIds: string[];

  constructor(seedAppointments: Appointment[], employees: Employee[]) {
    this.appointments = [...seedAppointments];
    this.employeeIds = employees.map((employee) => employee.id);
    this.nextId =
      seedAppointments
        .map((appointment) => Number.parseInt(appointment.id, 10))
        .filter((id) => Number.isFinite(id))
        .reduce((max, id) => Math.max(max, id), 0) + 1;
  }

  list(): Appointment[] {
    return [...this.appointments].sort((a, b) => {
      if (a.employeeId !== b.employeeId) {
        return a.employeeId.localeCompare(b.employeeId);
      }

      return a.startTime - b.startTime;
    });
  }

  getById(id: string): Appointment | undefined {
    return this.appointments.find((appointment) => appointment.id === id);
  }

  create(input: AppointmentInput): Appointment {
    const normalized = normalizeAppointmentInput(input);
    const fieldErrors = validateAppointmentInput(
      normalized,
      this.employeeIds,
      this.appointments
    );

    if (Object.keys(fieldErrors).length > 0) {
      throw new AppointmentValidationError(fieldErrors);
    }

    const appointment: Appointment = {
      id: String(this.nextId++),
      ...normalized,
    };

    this.appointments = [...this.appointments, appointment];
    return appointment;
  }

  update(id: string, input: AppointmentInput): Appointment {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error('Appointment not found');
    }

    const normalized = normalizeAppointmentInput(input);
    const fieldErrors = validateAppointmentInput(
      normalized,
      this.employeeIds,
      this.appointments,
      id
    );

    if (Object.keys(fieldErrors).length > 0) {
      throw new AppointmentValidationError(fieldErrors);
    }

    const updated: Appointment = {
      ...existing,
      ...normalized,
    };

    this.appointments = this.appointments.map((appointment) =>
      appointment.id === id ? updated : appointment
    );

    return updated;
  }

  delete(id: string): boolean {
    const before = this.appointments.length;
    this.appointments = this.appointments.filter((appointment) => appointment.id !== id);
    return this.appointments.length < before;
  }
}

export const formatTimeLabel = (time: number): string => {
  const hours = Math.floor(time);
  const minutes = Math.round((time - hours) * 60);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
};

export const getReliabilityColorClass = (score: number): string => {
  if (score >= 70) return 'text-[#50C878]';
  if (score >= 40) return 'text-[#D4AF37]';
  return 'text-[#d4183d]';
};

export const getReliabilityBorderClass = (score: number): string => {
  if (score < 40) return 'border-[#D4AF37] border-2';
  return '';
};

export const getReliabilityReasoning = (score: number): string => {
  if (score >= 90) return 'Excellent track record: 100% on-time, never cancelled';
  if (score >= 70) return 'Good client: Occasional reschedules, always shows up';
  if (score >= 40) return 'Moderate risk: 2 late arrivals in last month';
  return 'High risk: 3 cancellations in last 2 months, often late';
};
