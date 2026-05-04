"""
In-memory repository for Appointments and Employees.

All data lives in Python lists — no database, no file I/O, no persistence.
Data resets every time the server restarts.
"""

import copy

from models import Appointment, Employee
from validators import validate_appointment_input


# ---------------------------------------------------------------------------
# Seed data — matches the TypeScript EMPLOYEES and INITIAL_APPOINTMENTS
# ---------------------------------------------------------------------------

SEED_EMPLOYEES: list[Employee] = [
    Employee(id="1", name="Marcus Chen",   color="#8FAF8A"),
    Employee(id="2", name="Sarah Williams", color="#6B7F5F"),
    Employee(id="3", name="Jake Morrison",  color="#50C878"),
    Employee(id="4", name="Emily Zhang",    color="#4A7C59"),
]

SEED_APPOINTMENTS: list[Appointment] = [
    Appointment(id=1, client_name="John Doe",      service="Haircut",   start_time=9,    duration=1,    reliability_score=85, employee_id="1"),
    Appointment(id=2, client_name="Jane Smith",     service="Coloring",  start_time=10.5, duration=2,    reliability_score=92, employee_id="1"),
    Appointment(id=3, client_name="Bob Johnson",    service="Shave",     start_time=9.5,  duration=0.75, reliability_score=35, employee_id="2"),
    Appointment(id=4, client_name="Alice Brown",    service="Styling",   start_time=11,   duration=1.5,  reliability_score=78, employee_id="2"),
    Appointment(id=5, client_name="Charlie Davis",  service="Haircut",   start_time=10,   duration=1,    reliability_score=45, employee_id="3"),
    Appointment(id=6, client_name="Diana Evans",    service="Treatment", start_time=13,   duration=2,    reliability_score=95, employee_id="3"),
]


# ---------------------------------------------------------------------------
# Repository
# ---------------------------------------------------------------------------

class AppointmentRepository:
    """
    In-memory CRUD repository for appointments.

    Stores everything in a plain Python list.
    Thread-safety is not a concern for this assignment.
    """

    def __init__(
        self,
        seed_appointments: list[Appointment] | None = None,
        seed_employees: list[Employee] | None = None,
    ):
        self._employees: list[Employee] = copy.deepcopy(seed_employees if seed_employees is not None else SEED_EMPLOYEES)
        self._appointments: list[Appointment] = copy.deepcopy(seed_appointments if seed_appointments is not None else SEED_APPOINTMENTS)
        # Next auto-increment ID = max existing ID + 1
        if self._appointments:
            self._next_id: int = max(a.id for a in self._appointments) + 1
        else:
            self._next_id: int = 1

    # -- Employee helpers --------------------------------------------------

    @property
    def employee_ids(self) -> list[str]:
        return [e.id for e in self._employees]

    def list_employees(self) -> list[Employee]:
        return list(self._employees)

    # -- Appointment CRUD --------------------------------------------------

    def list_appointments(self) -> list[Appointment]:
        """Return all appointments sorted by employee_id then start_time."""
        return sorted(
            self._appointments,
            key=lambda a: (a.employee_id, a.start_time),
        )

    def list_appointments_paginated(
        self,
        page: int = 1,
        page_size: int = 10,
    ) -> tuple[list[Appointment], int]:
        """
        Return a page of appointments plus the total count.

        Args:
            page:      1-indexed page number (defaults to 1).
            page_size: number of items per page (defaults to 10).

        Returns:
            (items_on_this_page, total_count)
        """
        all_sorted = self.list_appointments()
        total = len(all_sorted)
        start = (page - 1) * page_size
        end = start + page_size
        return all_sorted[start:end], total

    def get_by_id(self, appointment_id: int) -> Appointment | None:
        for appt in self._appointments:
            if appt.id == appointment_id:
                return appt
        return None

    def create(self, data: dict) -> Appointment | dict[str, str]:
        """
        Validate and create a new appointment.

        Returns the created Appointment on success,
        or a dict of field errors on validation failure.
        """
        errors = validate_appointment_input(
            data, self.employee_ids, self._appointments
        )
        if errors:
            return errors

        appointment = Appointment(
            id=self._next_id,
            client_name=data["client_name"].strip(),
            service=data["service"].strip(),
            start_time=data["start_time"],
            duration=data["duration"],
            reliability_score=int(data["reliability_score"]),
            employee_id=data["employee_id"],
        )
        self._next_id += 1
        self._appointments.append(appointment)
        return appointment

    def update(self, appointment_id: int, data: dict) -> Appointment | dict[str, str] | None:
        """
        Validate and update an existing appointment.

        Returns:
            - Updated Appointment on success
            - dict of field errors on validation failure
            - None if the appointment was not found
        """
        existing = self.get_by_id(appointment_id)
        if existing is None:
            return None

        errors = validate_appointment_input(
            data, self.employee_ids, self._appointments, current_id=appointment_id
        )
        if errors:
            return errors

        existing.client_name = data["client_name"].strip()
        existing.service = data["service"].strip()
        existing.start_time = data["start_time"]
        existing.duration = data["duration"]
        existing.reliability_score = int(data["reliability_score"])
        existing.employee_id = data["employee_id"]
        return existing

    def delete(self, appointment_id: int) -> bool:
        """Delete an appointment by ID. Returns True if it was found and removed."""
        before = len(self._appointments)
        self._appointments = [a for a in self._appointments if a.id != appointment_id]
        return len(self._appointments) < before
