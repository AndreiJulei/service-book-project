"""
Server-side validation for appointment input.

Mirrors the rules from scheduleDomain.ts validateAppointmentInput exactly:
  - client_name: required, 2–60 chars after trimming
  - service:     required, 2–60 chars after trimming
  - start_time:  finite number, >= WORK_DAY_START, < WORK_DAY_END
  - duration:    finite number, > 0, <= 8, end must be <= WORK_DAY_END
  - reliability_score: integer, 0–100
  - employee_id: required, must be in the known employee list
  - overlap:     no time overlap with another appointment for the same employee
"""

from models import Appointment

WORK_DAY_START = 8
WORK_DAY_END = 21


def _is_finite_number(value) -> bool:
    """Check if a value is a finite int or float (not NaN, not Infinity)."""
    if isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        import math
        return math.isfinite(value)
    return False


def _has_overlap(
    appointments: list[Appointment],
    start_time: float,
    duration: float,
    employee_id: str,
    exclude_id: int | None = None,
) -> bool:
    """Check if a proposed time slot overlaps any existing appointment for the same employee."""
    end_b = start_time + duration
    for appt in appointments:
        if appt.employee_id != employee_id:
            continue
        if exclude_id is not None and appt.id == exclude_id:
            continue
        end_a = appt.start_time + appt.duration
        if start_time < end_a and end_b > appt.start_time:
            return True
    return False


def validate_appointment_input(
    data: dict,
    employee_ids: list[str],
    existing_appointments: list[Appointment],
    current_id: int | None = None,
) -> dict[str, str]:
    """
    Validate raw appointment input dictionary.

    Returns a dict of field_name -> error_message.
    Empty dict means all validations passed.
    """
    errors: dict[str, str] = {}

    # --- client_name ---
    client_name = data.get("client_name")
    if client_name is None or not isinstance(client_name, str) or not client_name.strip():
        errors["client_name"] = "Client name is required"
    else:
        trimmed = client_name.strip()
        if len(trimmed) < 2 or len(trimmed) > 60:
            errors["client_name"] = "Client name must be between 2 and 60 characters"

    # --- service ---
    service = data.get("service")
    if service is None or not isinstance(service, str) or not service.strip():
        errors["service"] = "Service is required"
    else:
        trimmed = service.strip()
        if len(trimmed) < 2 or len(trimmed) > 60:
            errors["service"] = "Service must be between 2 and 60 characters"

    # --- start_time ---
    start_time = data.get("start_time")
    if not _is_finite_number(start_time):
        errors["start_time"] = "Start time must be a number"
    elif start_time < WORK_DAY_START or start_time >= WORK_DAY_END:
        errors["start_time"] = f"Start time must be between {WORK_DAY_START} and {WORK_DAY_END - 0.25}"

    # --- duration ---
    duration = data.get("duration")
    if not _is_finite_number(duration):
        errors["duration"] = "Duration must be a number"
    elif duration <= 0 or duration > 8:
        errors["duration"] = "Duration must be greater than 0 and less than or equal to 8"

    # --- end time check (only when both start_time and duration are valid numbers) ---
    if "start_time" not in errors and "duration" not in errors:
        end_time = start_time + duration
        if end_time > WORK_DAY_END:
            errors["duration"] = f"Appointment must end by {WORK_DAY_END}:00"

    # --- reliability_score ---
    reliability_score = data.get("reliability_score")
    if not _is_finite_number(reliability_score) or isinstance(reliability_score, float) and not reliability_score.is_integer():
        errors["reliability_score"] = "Reliability score must be an integer"
    elif reliability_score < 0 or reliability_score > 100:
        errors["reliability_score"] = "Reliability score must be between 0 and 100"

    # --- employee_id ---
    employee_id = data.get("employee_id")
    if not employee_id or not isinstance(employee_id, str):
        errors["employee_id"] = "Employee is required"
    elif employee_id not in employee_ids:
        errors["employee_id"] = "Employee is not valid"

    # --- overlap check (only when start_time, duration, and employee_id are all valid) ---
    if "start_time" not in errors and "duration" not in errors and "employee_id" not in errors:
        if _has_overlap(existing_appointments, start_time, duration, employee_id, current_id):
            errors["start_time"] = "Appointment overlaps an existing booking for this employee"

    return errors
