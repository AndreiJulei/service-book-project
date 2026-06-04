import { describe, expect, it } from 'vitest';
import {
  Appointment,
  AppointmentInput,
  AppointmentValidationError,
  EMPLOYEES,
  InMemoryAppointmentRepository,
  WORK_DAY_END,
  WORK_DAY_START,
  emptyAppointmentInput,
  formatTimeLabel,
  getReliabilityBorderClass,
  getReliabilityColorClass,
  getReliabilityReasoning,
  validateAppointmentInput,
} from './scheduleDomain';

const employeeIds = EMPLOYEES.map((employee) => employee.id);

const buildValidInput = (): AppointmentInput => ({
  clientName: 'Valid Client',
  service: 'Haircut',
  startTime: 9,
  duration: 1,
  reliabilityScore: 80,
  employeeId: employeeIds[0],
});

describe('emptyAppointmentInput', () => {
  it('returns default values', () => {
    expect(emptyAppointmentInput()).toEqual({
      clientName: '',
      service: '',
      startTime: WORK_DAY_START,
      duration: 1,
      reliabilityScore: 70,
      employeeId: '',
    });
  });
});

describe('validateAppointmentInput', () => {
  it('accepts a valid payload', () => {
    expect(validateAppointmentInput(buildValidInput(), employeeIds)).toEqual({});
  });

  it('validates client and service required/length rules', () => {
    expect(
      validateAppointmentInput(
        {
          ...buildValidInput(),
          clientName: ' ',
          service: ' ',
        },
        employeeIds
      )
    ).toEqual({
      clientName: 'Client name is required',
      service: 'Service is required',
    });

    expect(
      validateAppointmentInput(
        {
          ...buildValidInput(),
          clientName: 'A',
          service: 'B',
        },
        employeeIds
      )
    ).toEqual({
      clientName: 'Client name must be between 2 and 60 characters',
      service: 'Service must be between 2 and 60 characters',
    });

    expect(
      validateAppointmentInput(
        {
          ...buildValidInput(),
          clientName: 'x'.repeat(61),
          service: 'x'.repeat(61),
        },
        employeeIds
      )
    ).toEqual({
      clientName: 'Client name must be between 2 and 60 characters',
      service: 'Service must be between 2 and 60 characters',
    });
  });

  it('validates numeric fields and ranges', () => {
    expect(
      validateAppointmentInput(
        {
          ...buildValidInput(),
          startTime: Number.NaN,
          duration: Number.NaN,
          reliabilityScore: 50.5,
        },
        employeeIds
      )
    ).toEqual({
      startTime: 'Start time must be a number',
      duration: 'Duration must be a number',
      reliabilityScore: 'Reliability score must be an integer',
    });

    expect(
      validateAppointmentInput(
        {
          ...buildValidInput(),
          startTime: WORK_DAY_START - 1,
        },
        employeeIds
      )
    ).toEqual({
      startTime: `Start time must be between ${WORK_DAY_START} and ${WORK_DAY_END - 0.25}`,
    });

    expect(
      validateAppointmentInput(
        {
          ...buildValidInput(),
          startTime: WORK_DAY_END,
        },
        employeeIds
      )
    ).toEqual({
      startTime: `Start time must be between ${WORK_DAY_START} and ${WORK_DAY_END - 0.25}`,
      duration: `Appointment must end by ${WORK_DAY_END}:00`,
    });

    expect(
      validateAppointmentInput(
        {
          ...buildValidInput(),
          duration: 0,
        },
        employeeIds
      )
    ).toEqual({
      duration: 'Duration must be greater than 0 and less than or equal to 8',
    });

    expect(
      validateAppointmentInput(
        {
          ...buildValidInput(),
          duration: 9,
        },
        employeeIds
      )
    ).toEqual({
      duration: 'Duration must be greater than 0 and less than or equal to 8',
    });

    expect(
      validateAppointmentInput(
        {
          ...buildValidInput(),
          startTime: 20.5,
          duration: 1,
        },
        employeeIds
      )
    ).toEqual({
      duration: `Appointment must end by ${WORK_DAY_END}:00`,
    });

    expect(
      validateAppointmentInput(
        {
          ...buildValidInput(),
          reliabilityScore: -1,
        },
        employeeIds
      )
    ).toEqual({
      reliabilityScore: 'Reliability score must be between 0 and 100',
    });

    expect(
      validateAppointmentInput(
        {
          ...buildValidInput(),
          reliabilityScore: 101,
        },
        employeeIds
      )
    ).toEqual({
      reliabilityScore: 'Reliability score must be between 0 and 100',
    });
  });

  it('validates employee and overlap rules', () => {
    const existing: Appointment[] = [
      {
        id: '1',
        clientName: 'Existing',
        service: 'Cut',
        startTime: 10,
        duration: 1,
        reliabilityScore: 80,
        employeeId: employeeIds[0],
      },
    ];

    expect(
      validateAppointmentInput(
        {
          ...buildValidInput(),
          employeeId: '',
        },
        employeeIds,
        existing
      )
    ).toEqual({
      employeeId: 'Employee is required',
    });

    expect(
      validateAppointmentInput(
        {
          ...buildValidInput(),
          employeeId: 'missing',
        },
        employeeIds,
        existing
      )
    ).toEqual({
      employeeId: 'Employee is not valid',
    });

    expect(
      validateAppointmentInput(
        {
          ...buildValidInput(),
          employeeId: employeeIds[1],
          startTime: 10.25,
        },
        employeeIds,
        existing
      )
    ).toEqual({});

    expect(
      validateAppointmentInput(
        {
          ...buildValidInput(),
          employeeId: employeeIds[0],
          startTime: 10.25,
        },
        employeeIds,
        existing,
        '1'
      )
    ).toEqual({});

    expect(
      validateAppointmentInput(
        {
          ...buildValidInput(),
          employeeId: employeeIds[0],
          startTime: 10.25,
        },
        employeeIds,
        existing
      )
    ).toEqual({
      startTime: 'Appointment overlaps an existing booking for this employee',
    });

    expect(
      validateAppointmentInput(
        {
          ...buildValidInput(),
          employeeId: employeeIds[0],
          startTime: 9,
          duration: 1,
        },
        employeeIds,
        existing
      )
    ).toEqual({});

    expect(
      validateAppointmentInput(
        {
          ...buildValidInput(),
          employeeId: employeeIds[0],
          startTime: 12,
          duration: 1,
        },
        employeeIds,
        existing
      )
    ).toEqual({});
  });
});

describe('InMemoryAppointmentRepository', () => {
  const seed: Appointment[] = [
    {
      id: '9',
      clientName: 'Early',
      service: 'S0',
      startTime: 8,
      duration: 1,
      reliabilityScore: 65,
      employeeId: '1',
    },
    {
      id: 'abc',
      clientName: 'Zed',
      service: 'S2',
      startTime: 12,
      duration: 1,
      reliabilityScore: 70,
      employeeId: '2',
    },
    {
      id: '10',
      clientName: 'Amy',
      service: 'S1',
      startTime: 10,
      duration: 1,
      reliabilityScore: 90,
      employeeId: '1',
    },
  ];

  it('lists sorted appointments and supports getById', () => {
    const repo = new InMemoryAppointmentRepository(seed, EMPLOYEES);
    const listed = repo.list();

    expect(listed.map((item) => item.clientName)).toEqual(['Early', 'Amy', 'Zed']);
    expect(repo.getById('10')?.clientName).toBe('Amy');
    expect(repo.getById('missing')).toBeUndefined();
  });

  it('creates appointments with validation and trimming', () => {
    const repo = new InMemoryAppointmentRepository(seed, EMPLOYEES);

    const created = repo.create({
      ...buildValidInput(),
      clientName: '  New Person  ',
      service: '  Trimmed Service  ',
      startTime: 8,
      duration: 1,
      employeeId: '3',
    });

    expect(created.id).toBe('11');
    expect(created.clientName).toBe('New Person');
    expect(created.service).toBe('Trimmed Service');

    expect(() =>
      repo.create({
        ...buildValidInput(),
        clientName: '',
      })
    ).toThrowError(AppointmentValidationError);
  });

  it('updates appointments, handles overlap self-check, and throws when missing', () => {
    const repo = new InMemoryAppointmentRepository(seed, EMPLOYEES);

    const updated = repo.update('10', {
      ...buildValidInput(),
      clientName: '  Updated Name ',
      service: '  Updated Service ',
      startTime: 10,
      duration: 1,
      employeeId: '1',
      reliabilityScore: 77,
    });

    expect(updated.clientName).toBe('Updated Name');
    expect(updated.service).toBe('Updated Service');
    expect(updated.reliabilityScore).toBe(77);

    expect(() =>
      repo.update('10', {
        ...buildValidInput(),
        employeeId: 'missing',
      })
    ).toThrowError(AppointmentValidationError);

    expect(() => repo.update('404', buildValidInput())).toThrowError('Appointment not found');
  });

  it('deletes existing entries and reports missing deletions', () => {
    const repo = new InMemoryAppointmentRepository(seed, EMPLOYEES);

    expect(repo.delete('10')).toBe(true);
    expect(repo.delete('10')).toBe(false);
  });
});

describe('formatting and reliability helpers', () => {
  it('formats times and reliability labels', () => {
    expect(formatTimeLabel(0)).toBe('12:00 AM');
    expect(formatTimeLabel(9)).toBe('9:00 AM');
    expect(formatTimeLabel(13.5)).toBe('1:30 PM');

    expect(getReliabilityColorClass(80)).toBe('text-[#50C878]');
    expect(getReliabilityColorClass(50)).toBe('text-[#D4AF37]');
    expect(getReliabilityColorClass(10)).toBe('text-[#d4183d]');

    expect(getReliabilityBorderClass(10)).toBe('border-[#D4AF37] border-2');
    expect(getReliabilityBorderClass(40)).toBe('');

    expect(getReliabilityReasoning(95)).toBe(
      'Excellent track record: 100% on-time, never cancelled'
    );
    expect(getReliabilityReasoning(80)).toBe(
      'Good client: Occasional reschedules, always shows up'
    );
    expect(getReliabilityReasoning(55)).toBe('Moderate risk: 2 late arrivals in last month');
    expect(getReliabilityReasoning(10)).toBe(
      'High risk: 3 cancellations in last 2 months, often late'
    );
  });

  it('exposes validation error details', () => {
    const error = new AppointmentValidationError({ clientName: 'missing' });
    expect(error.name).toBe('AppointmentValidationError');
    expect(error.fieldErrors.clientName).toBe('missing');
  });
});
