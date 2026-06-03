"""
SQLAlchemy repository for Appointments and Employees.
"""

from models import db, Appointment, Employee
from validators import validate_appointment_input

class AppointmentRepository:
    """
    SQLAlchemy-backed repository.
    """

    def __init__(self, *args, **kwargs):
        pass

    @property
    def employee_ids(self) -> list[str]:
        employees = db.session.query(Employee).all()
        return [str(e.id) for e in employees]

    def list_employees(self):
        return db.session.query(Employee).all()

    def list_appointments(self):
        """Return all appointments sorted by employee_id then start_time."""
        return db.session.query(Appointment).order_by(Appointment.employee_id, Appointment.start_time).all()

    def list_appointments_paginated(
        self,
        page: int = 1,
        page_size: int = 10,
    ) -> tuple[list, int]:
        """
        Return a page of appointments plus the total count.
        """
        query = db.session.query(Appointment).order_by(Appointment.employee_id, Appointment.start_time)
        total = query.count()
        start = (page - 1) * page_size
        items = query.offset(start).limit(page_size).all()
        return items, total

    def get_by_id(self, appointment_id: int):
        return db.session.query(Appointment).filter_by(id=appointment_id).first()

    def create(self, data: dict):
        """
        Validate and create a new appointment.
        """
        employee_id = int(data.get("employee_id", 0)) if str(data.get("employee_id")).isdigit() else 0
        date = data.get("date")
        
        # Resolve service name from service_ids before validating
        booked_services = []
        if "service_ids" in data:
            from models import Service
            s_ids = [int(i) for i in data["service_ids"]]
            booked_services = db.session.query(Service).filter(Service.id.in_(s_ids)).all()
            if booked_services:
                joined_name = ", ".join(s.name for s in booked_services)
                if len(joined_name) > 100:
                    joined_name = joined_name[:97] + "..."
                data["service"] = joined_name
        
        # Filter existing appointments by date so overlap check applies on same day
        existing_appts = db.session.query(Appointment).filter(
            Appointment.employee_id == employee_id,
            Appointment.date == date,
            Appointment.status != 'cancelled'
        ).all()
        
        errors = validate_appointment_input(
            data, self.employee_ids, existing_appts
        )
        if errors:
            return errors

        appointment = Appointment(
            client_name=data["client_name"].strip(),
            service=data.get("service", "").strip(),
            start_time=data["start_time"],
            duration=data["duration"],
            reliability_score=int(data["reliability_score"]),
            employee_id=int(data["employee_id"]),
            date=date,
            client_user_id=data.get("client_user_id"),
            status=data.get("status", "confirmed")
        )
        if booked_services:
            appointment.booked_services = booked_services
            
        db.session.add(appointment)
        db.session.commit()
        return appointment

    def update(self, appointment_id: int, data: dict):
        """
        Validate and update an existing appointment.
        """
        existing = self.get_by_id(appointment_id)
        if existing is None:
            return None

        employee_id = int(data.get("employee_id", 0)) if str(data.get("employee_id")).isdigit() else 0
        date = data.get("date")
        
        # Resolve service name from service_ids before validating
        booked_services = []
        if "service_ids" in data:
            from models import Service
            s_ids = [int(i) for i in data["service_ids"]]
            booked_services = db.session.query(Service).filter(Service.id.in_(s_ids)).all()
            if booked_services:
                joined_name = ", ".join(s.name for s in booked_services)
                if len(joined_name) > 100:
                    joined_name = joined_name[:97] + "..."
                data["service"] = joined_name

        # Filter by date so overlap check applies on same day
        existing_appts = db.session.query(Appointment).filter(
            Appointment.employee_id == employee_id,
            Appointment.date == date,
            Appointment.status != 'cancelled'
        ).all()

        errors = validate_appointment_input(
            data, self.employee_ids, existing_appts, current_id=appointment_id
        )
        if errors:
            return errors

        existing.client_name = data["client_name"].strip()
        existing.service = data.get("service", "").strip() if data.get("service") else existing.service
        existing.start_time = data["start_time"]
        existing.duration = data["duration"]
        existing.reliability_score = int(data["reliability_score"])
        existing.employee_id = int(data["employee_id"])
        existing.date = date
        if "client_user_id" in data:
            existing.client_user_id = data["client_user_id"]
        if "status" in data:
            existing.status = data["status"]
        if booked_services:
            existing.booked_services = booked_services
        
        db.session.commit()
        return existing

    def delete(self, appointment_id: int) -> bool:
        """Delete an appointment by ID."""
        appt = self.get_by_id(appointment_id)
        if appt:
            db.session.delete(appt)
            db.session.commit()
            return True
        return False

    # Additional methods mentioned in the implementation plan:
    def create_appointment(self, data: dict) -> tuple:
        res = self.create(data)
        if isinstance(res, dict) and "client_name" in res:  # Error dict
            return None, res
        return res.to_dict() if res else None, None

    def update_appointment(self, appointment_id: int, data: dict) -> tuple:
        res = self.update(appointment_id, data)
        if res is None:
            return None, None, False
        if isinstance(res, dict) and "client_name" in res:
            return None, res, True
        return res.to_dict(), None, True

    def delete_appointment(self, appointment_id: int) -> bool:
        return self.delete(appointment_id)

    def get_appointment(self, appointment_id: int):
        res = self.get_by_id(appointment_id)
        return res.to_dict() if res else None

