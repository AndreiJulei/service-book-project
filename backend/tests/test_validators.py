"""
Unit tests for validators.py — server-side validation logic.

Covers every field, every error branch, edge cases, and the overlap check.
"""

import pytest
import sys
import os
import math

# Add backend directory to path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from validators import validate_appointment_input, _is_finite_number, _has_overlap, WORK_DAY_START, WORK_DAY_END
from models import Appointment


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VALID_EMPLOYEE_IDS = ["1", "2", "3", "4"]

def _valid_input() -> dict:
    """Return a fully valid appointment input dict."""
    return {
        "client_name": "Test Client",
        "service": "Haircut",
        "start_time": 10,
        "duration": 1,
        "reliability_score": 80,
        "employee_id": "1",
    }


# ---------------------------------------------------------------------------
# _is_finite_number tests
# ---------------------------------------------------------------------------

class TestIsFiniteNumber:
    def test_int(self):
        assert _is_finite_number(5) is True

    def test_float(self):
        assert _is_finite_number(3.14) is True

    def test_zero(self):
        assert _is_finite_number(0) is True

    def test_negative(self):
        assert _is_finite_number(-10) is True

    def test_nan(self):
        assert _is_finite_number(float("nan")) is False

    def test_inf(self):
        assert _is_finite_number(float("inf")) is False

    def test_neg_inf(self):
        assert _is_finite_number(float("-inf")) is False

    def test_string(self):
        assert _is_finite_number("5") is False

    def test_none(self):
        assert _is_finite_number(None) is False

    def test_bool_true(self):
        assert _is_finite_number(True) is False

    def test_bool_false(self):
        assert _is_finite_number(False) is False


# ---------------------------------------------------------------------------
# client_name validation
# ---------------------------------------------------------------------------

class TestClientNameValidation:
    def test_valid(self):
        data = _valid_input()
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert "client_name" not in errors

    def test_missing(self):
        data = _valid_input()
        del data["client_name"]
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["client_name"] == "Client name is required"

    def test_empty_string(self):
        data = _valid_input()
        data["client_name"] = ""
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["client_name"] == "Client name is required"

    def test_whitespace_only(self):
        data = _valid_input()
        data["client_name"] = "   "
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["client_name"] == "Client name is required"

    def test_too_short(self):
        data = _valid_input()
        data["client_name"] = "A"
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["client_name"] == "Client name must be between 2 and 60 characters"

    def test_too_long(self):
        data = _valid_input()
        data["client_name"] = "A" * 61
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["client_name"] == "Client name must be between 2 and 60 characters"

    def test_exactly_2_chars(self):
        data = _valid_input()
        data["client_name"] = "AB"
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert "client_name" not in errors

    def test_exactly_60_chars(self):
        data = _valid_input()
        data["client_name"] = "A" * 60
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert "client_name" not in errors

    def test_not_a_string(self):
        data = _valid_input()
        data["client_name"] = 123
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["client_name"] == "Client name is required"

    def test_none_value(self):
        data = _valid_input()
        data["client_name"] = None
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["client_name"] == "Client name is required"


# ---------------------------------------------------------------------------
# service validation
# ---------------------------------------------------------------------------

class TestServiceValidation:
    def test_valid(self):
        data = _valid_input()
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert "service" not in errors

    def test_missing(self):
        data = _valid_input()
        del data["service"]
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["service"] == "Service is required"

    def test_empty_string(self):
        data = _valid_input()
        data["service"] = ""
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["service"] == "Service is required"

    def test_whitespace_only(self):
        data = _valid_input()
        data["service"] = "   "
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["service"] == "Service is required"

    def test_too_short(self):
        data = _valid_input()
        data["service"] = "X"
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["service"] == "Service must be between 2 and 100 characters"

    def test_too_long(self):
        data = _valid_input()
        data["service"] = "S" * 101
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["service"] == "Service must be between 2 and 100 characters"

    def test_not_a_string(self):
        data = _valid_input()
        data["service"] = 999
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["service"] == "Service is required"


# ---------------------------------------------------------------------------
# start_time validation
# ---------------------------------------------------------------------------

class TestStartTimeValidation:
    def test_valid(self):
        data = _valid_input()
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert "start_time" not in errors

    def test_not_a_number(self):
        data = _valid_input()
        data["start_time"] = "ten"
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["start_time"] == "Start time must be a number"

    def test_nan(self):
        data = _valid_input()
        data["start_time"] = float("nan")
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["start_time"] == "Start time must be a number"

    def test_before_work_day(self):
        data = _valid_input()
        data["start_time"] = 7
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert "start_time" in errors

    def test_at_work_day_end(self):
        data = _valid_input()
        data["start_time"] = WORK_DAY_END  # 21 — must be < 21
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert "start_time" in errors

    def test_at_work_day_start(self):
        data = _valid_input()
        data["start_time"] = WORK_DAY_START  # 8 — valid
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert "start_time" not in errors


# ---------------------------------------------------------------------------
# duration validation
# ---------------------------------------------------------------------------

class TestDurationValidation:
    def test_valid(self):
        data = _valid_input()
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert "duration" not in errors

    def test_not_a_number(self):
        data = _valid_input()
        data["duration"] = "one"
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["duration"] == "Duration must be a number"

    def test_zero(self):
        data = _valid_input()
        data["duration"] = 0
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["duration"] == "Duration must be greater than 0 and less than or equal to 8"

    def test_negative(self):
        data = _valid_input()
        data["duration"] = -1
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["duration"] == "Duration must be greater than 0 and less than or equal to 8"

    def test_exceeds_max(self):
        data = _valid_input()
        data["duration"] = 9
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["duration"] == "Duration must be greater than 0 and less than or equal to 8"

    def test_exactly_8(self):
        data = _valid_input()
        data["start_time"] = 8
        data["duration"] = 8  # 8 + 8 = 16 ≤ 21, and 8 ≤ 8
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert "duration" not in errors

    def test_end_after_workday(self):
        data = _valid_input()
        data["start_time"] = 18
        data["duration"] = 4  # 18 + 4 = 22 > 21
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["duration"] == f"Appointment must end by {WORK_DAY_END}:00"


# ---------------------------------------------------------------------------
# reliability_score validation
# ---------------------------------------------------------------------------

class TestReliabilityScoreValidation:
    def test_valid(self):
        data = _valid_input()
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert "reliability_score" not in errors

    def test_not_integer(self):
        data = _valid_input()
        data["reliability_score"] = 80.5
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["reliability_score"] == "Reliability score must be an integer"

    def test_not_a_number(self):
        data = _valid_input()
        data["reliability_score"] = "high"
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["reliability_score"] == "Reliability score must be an integer"

    def test_below_zero(self):
        data = _valid_input()
        data["reliability_score"] = -1
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["reliability_score"] == "Reliability score must be between 0 and 100"

    def test_above_100(self):
        data = _valid_input()
        data["reliability_score"] = 101
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["reliability_score"] == "Reliability score must be between 0 and 100"

    def test_zero(self):
        data = _valid_input()
        data["reliability_score"] = 0
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert "reliability_score" not in errors

    def test_hundred(self):
        data = _valid_input()
        data["reliability_score"] = 100
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert "reliability_score" not in errors


# ---------------------------------------------------------------------------
# employee_id validation
# ---------------------------------------------------------------------------

class TestEmployeeIdValidation:
    def test_valid(self):
        data = _valid_input()
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert "employee_id" not in errors

    def test_missing(self):
        data = _valid_input()
        del data["employee_id"]
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["employee_id"] == "Employee is required"

    def test_empty_string(self):
        data = _valid_input()
        data["employee_id"] = ""
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["employee_id"] == "Employee is required"

    def test_invalid_id(self):
        data = _valid_input()
        data["employee_id"] = "999"
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors["employee_id"] == "Employee is not valid"


# ---------------------------------------------------------------------------
# Overlap validation
# ---------------------------------------------------------------------------

class TestOverlapValidation:
    def _make_appointment(self, **kwargs) -> Appointment:
        defaults = {
            "id": 1,
            "client_name": "Existing",
            "service": "Test",
            "start_time": 10,
            "duration": 2,  # occupies 10–12
            "reliability_score": 80,
            "employee_id": "1",
        }
        defaults.update(kwargs)
        return Appointment(**defaults)

    def test_no_overlap_different_employee(self):
        existing = [self._make_appointment(employee_id="1")]
        data = _valid_input()
        data["start_time"] = 10
        data["duration"] = 2
        data["employee_id"] = "2"  # different employee
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, existing)
        assert "start_time" not in errors

    def test_overlap_same_employee(self):
        existing = [self._make_appointment(employee_id="1")]
        data = _valid_input()
        data["start_time"] = 11  # overlaps 10–12
        data["duration"] = 1
        data["employee_id"] = "1"
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, existing)
        assert errors["start_time"] == "Appointment overlaps an existing booking for this employee"

    def test_no_overlap_adjacent(self):
        existing = [self._make_appointment(employee_id="1")]
        data = _valid_input()
        data["start_time"] = 12  # starts exactly when existing ends
        data["duration"] = 1
        data["employee_id"] = "1"
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, existing)
        assert "start_time" not in errors

    def test_overlap_excluded_by_current_id(self):
        """When updating, the appointment's own slot should not count as overlap."""
        existing = [self._make_appointment(id=5, employee_id="1")]
        data = _valid_input()
        data["start_time"] = 10
        data["duration"] = 2
        data["employee_id"] = "1"
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, existing, current_id=5)
        assert "start_time" not in errors

    def test_overlap_not_checked_when_other_errors(self):
        """Overlap is only checked if start_time, duration, and employee_id are all valid."""
        existing = [self._make_appointment(employee_id="1")]
        data = _valid_input()
        data["start_time"] = 11
        data["duration"] = 1
        data["employee_id"] = ""  # invalid — overlap check should be skipped
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, existing)
        assert "start_time" not in errors  # overlap error should NOT appear
        assert "employee_id" in errors  # but employee error should


# ---------------------------------------------------------------------------
# _has_overlap helper tests
# ---------------------------------------------------------------------------

class TestHasOverlap:
    def _make_appointment(self, **kwargs) -> Appointment:
        defaults = {
            "id": 1,
            "client_name": "Existing",
            "service": "Test",
            "start_time": 10,
            "duration": 2,
            "reliability_score": 80,
            "employee_id": "1",
        }
        defaults.update(kwargs)
        return Appointment(**defaults)

    def test_no_appointments(self):
        assert _has_overlap([], 10, 1, "1") is False

    def test_no_overlap_before(self):
        existing = [self._make_appointment(start_time=10, duration=2)]
        assert _has_overlap(existing, 8, 2, "1") is False  # 8–10 vs 10–12

    def test_no_overlap_after(self):
        existing = [self._make_appointment(start_time=10, duration=2)]
        assert _has_overlap(existing, 12, 1, "1") is False  # 12–13 vs 10–12

    def test_overlap_partial(self):
        existing = [self._make_appointment(start_time=10, duration=2)]
        assert _has_overlap(existing, 11, 2, "1") is True  # 11–13 overlaps 10–12

    def test_overlap_contained(self):
        existing = [self._make_appointment(start_time=10, duration=4)]
        assert _has_overlap(existing, 11, 1, "1") is True  # 11–12 inside 10–14

    def test_exclude_id(self):
        existing = [self._make_appointment(id=1, start_time=10, duration=2)]
        assert _has_overlap(existing, 10, 2, "1", exclude_id=1) is False


# ---------------------------------------------------------------------------
# Multiple validation errors at once
# ---------------------------------------------------------------------------

class TestMultipleErrors:
    def test_all_fields_invalid(self):
        data = {
            "client_name": "",
            "service": "",
            "start_time": "bad",
            "duration": "bad",
            "reliability_score": "bad",
            "employee_id": "",
        }
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert len(errors) == 6
        assert "client_name" in errors
        assert "service" in errors
        assert "start_time" in errors
        assert "duration" in errors
        assert "reliability_score" in errors
        assert "employee_id" in errors

    def test_fully_valid(self):
        data = _valid_input()
        errors = validate_appointment_input(data, VALID_EMPLOYEE_IDS, [])
        assert errors == {}
