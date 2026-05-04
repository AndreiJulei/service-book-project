"""
Unit tests for repository.py — in-memory CRUD operations.

Tests all repository methods: list, get, create, update, delete,
pagination, seeding, and validation integration.
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from repository import AppointmentRepository, SEED_EMPLOYEES, SEED_APPOINTMENTS
from models import Appointment, Employee


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _empty_repo() -> AppointmentRepository:
    """Create a repository with no seed data."""
    return AppointmentRepository(seed_appointments=[], seed_employees=SEED_EMPLOYEES)


def _seeded_repo() -> AppointmentRepository:
    """Create a repository with the default seed data."""
    return AppointmentRepository()


def _valid_input() -> dict:
    return {
        "client_name": "New Client",
        "service": "Massage",
        "start_time": 14,
        "duration": 1,
        "reliability_score": 75,
        "employee_id": "4",
    }


# ---------------------------------------------------------------------------
# Constructor / seed data
# ---------------------------------------------------------------------------

class TestRepositoryInit:
    def test_default_seed_data(self):
        repo = _seeded_repo()
        assert len(repo.list_appointments()) == 6

    def test_empty_seed(self):
        repo = _empty_repo()
        assert len(repo.list_appointments()) == 0

    def test_custom_seed(self):
        custom = [
            Appointment(id=100, client_name="A", service="B", start_time=9, duration=1, reliability_score=50, employee_id="1"),
        ]
        repo = AppointmentRepository(seed_appointments=custom, seed_employees=SEED_EMPLOYEES)
        assert len(repo.list_appointments()) == 1
        assert repo._next_id == 101

    def test_employee_ids(self):
        repo = _seeded_repo()
        assert repo.employee_ids == ["1", "2", "3", "4"]

    def test_list_employees(self):
        repo = _seeded_repo()
        employees = repo.list_employees()
        assert len(employees) == 4
        assert employees[0].name == "Marcus Chen"


# ---------------------------------------------------------------------------
# list_appointments
# ---------------------------------------------------------------------------

class TestListAppointments:
    def test_sorted_by_employee_then_time(self):
        repo = _seeded_repo()
        appts = repo.list_appointments()
        for i in range(len(appts) - 1):
            a, b = appts[i], appts[i + 1]
            if a.employee_id == b.employee_id:
                assert a.start_time <= b.start_time
            else:
                assert a.employee_id <= b.employee_id

    def test_returns_new_list(self):
        repo = _seeded_repo()
        list1 = repo.list_appointments()
        list2 = repo.list_appointments()
        assert list1 is not list2


# ---------------------------------------------------------------------------
# list_appointments_paginated
# ---------------------------------------------------------------------------

class TestPagination:
    def test_first_page(self):
        repo = _seeded_repo()
        items, total = repo.list_appointments_paginated(page=1, page_size=2)
        assert len(items) == 2
        assert total == 6

    def test_second_page(self):
        repo = _seeded_repo()
        items, total = repo.list_appointments_paginated(page=2, page_size=2)
        assert len(items) == 2
        assert total == 6

    def test_last_page_partial(self):
        repo = _seeded_repo()
        items, total = repo.list_appointments_paginated(page=2, page_size=4)
        assert len(items) == 2  # 6 total, page_size 4, page 2 has 2 items
        assert total == 6

    def test_page_beyond_data(self):
        repo = _seeded_repo()
        items, total = repo.list_appointments_paginated(page=100, page_size=10)
        assert len(items) == 0
        assert total == 6

    def test_page_size_1(self):
        repo = _seeded_repo()
        items, total = repo.list_appointments_paginated(page=1, page_size=1)
        assert len(items) == 1
        assert total == 6

    def test_page_size_larger_than_total(self):
        repo = _seeded_repo()
        items, total = repo.list_appointments_paginated(page=1, page_size=100)
        assert len(items) == 6
        assert total == 6

    def test_empty_repo(self):
        repo = _empty_repo()
        items, total = repo.list_appointments_paginated(page=1, page_size=10)
        assert len(items) == 0
        assert total == 0


# ---------------------------------------------------------------------------
# get_by_id
# ---------------------------------------------------------------------------

class TestGetById:
    def test_existing(self):
        repo = _seeded_repo()
        appt = repo.get_by_id(1)
        assert appt is not None
        assert appt.client_name == "John Doe"

    def test_not_found(self):
        repo = _seeded_repo()
        assert repo.get_by_id(999) is None

    def test_after_delete(self):
        repo = _seeded_repo()
        repo.delete(1)
        assert repo.get_by_id(1) is None


# ---------------------------------------------------------------------------
# create
# ---------------------------------------------------------------------------

class TestCreate:
    def test_success(self):
        repo = _seeded_repo()
        data = _valid_input()
        result = repo.create(data)
        assert isinstance(result, Appointment)
        assert result.client_name == "New Client"
        assert result.id == 7  # next after seed IDs 1–6

    def test_increments_id(self):
        repo = _empty_repo()
        r1 = repo.create(_valid_input())
        r2 = repo.create({**_valid_input(), "start_time": 16})
        assert isinstance(r1, Appointment)
        assert isinstance(r2, Appointment)
        assert r2.id == r1.id + 1

    def test_strips_whitespace(self):
        repo = _empty_repo()
        data = _valid_input()
        data["client_name"] = "  Padded Name  "
        data["service"] = "  Trimmed  "
        result = repo.create(data)
        assert isinstance(result, Appointment)
        assert result.client_name == "Padded Name"
        assert result.service == "Trimmed"

    def test_validation_failure_returns_errors(self):
        repo = _empty_repo()
        data = _valid_input()
        data["client_name"] = ""
        result = repo.create(data)
        assert isinstance(result, dict)
        assert "client_name" in result

    def test_validation_failure_does_not_add_appointment(self):
        repo = _empty_repo()
        data = _valid_input()
        data["client_name"] = ""
        repo.create(data)
        assert len(repo.list_appointments()) == 0

    def test_create_adds_to_list(self):
        repo = _empty_repo()
        repo.create(_valid_input())
        assert len(repo.list_appointments()) == 1

    def test_overlap_prevention(self):
        repo = _empty_repo()
        repo.create(_valid_input())
        # Try to create overlapping appointment for same employee
        data = _valid_input()
        data["start_time"] = 14.5  # overlaps 14–15
        result = repo.create(data)
        assert isinstance(result, dict)
        assert "start_time" in result


# ---------------------------------------------------------------------------
# update
# ---------------------------------------------------------------------------

class TestUpdate:
    def test_success(self):
        repo = _seeded_repo()
        data = {
            "client_name": "Updated Name",
            "service": "Updated Service",
            "start_time": 9,
            "duration": 1,
            "reliability_score": 50,
            "employee_id": "1",
        }
        result = repo.update(1, data)
        assert isinstance(result, Appointment)
        assert result.client_name == "Updated Name"
        assert result.service == "Updated Service"

    def test_not_found(self):
        repo = _seeded_repo()
        result = repo.update(999, _valid_input())
        assert result is None

    def test_validation_failure(self):
        repo = _seeded_repo()
        data = _valid_input()
        data["client_name"] = ""
        result = repo.update(1, data)
        assert isinstance(result, dict)
        assert "client_name" in result

    def test_validation_failure_does_not_modify(self):
        repo = _seeded_repo()
        original = repo.get_by_id(1)
        original_name = original.client_name
        data = _valid_input()
        data["client_name"] = ""
        repo.update(1, data)
        assert repo.get_by_id(1).client_name == original_name

    def test_overlap_self_allowed(self):
        """Updating an appointment to the same time slot should not trigger overlap."""
        repo = _seeded_repo()
        appt = repo.get_by_id(1)
        data = {
            "client_name": appt.client_name,
            "service": appt.service,
            "start_time": appt.start_time,
            "duration": appt.duration,
            "reliability_score": appt.reliability_score,
            "employee_id": appt.employee_id,
        }
        result = repo.update(1, data)
        assert isinstance(result, Appointment)

    def test_strips_whitespace(self):
        repo = _seeded_repo()
        data = _valid_input()
        data["client_name"] = "  Padded  "
        result = repo.update(1, data)
        assert isinstance(result, Appointment)
        assert result.client_name == "Padded"

    def test_persists_changes(self):
        repo = _seeded_repo()
        data = {
            "client_name": "Persisted",
            "service": "Test",
            "start_time": 9,
            "duration": 1,
            "reliability_score": 50,
            "employee_id": "1",
        }
        repo.update(1, data)
        assert repo.get_by_id(1).client_name == "Persisted"


# ---------------------------------------------------------------------------
# delete
# ---------------------------------------------------------------------------

class TestDelete:
    def test_success(self):
        repo = _seeded_repo()
        assert repo.delete(1) is True
        assert len(repo.list_appointments()) == 5

    def test_not_found(self):
        repo = _seeded_repo()
        assert repo.delete(999) is False
        assert len(repo.list_appointments()) == 6

    def test_double_delete(self):
        repo = _seeded_repo()
        assert repo.delete(1) is True
        assert repo.delete(1) is False

    def test_delete_all(self):
        repo = _seeded_repo()
        for i in range(1, 7):
            repo.delete(i)
        assert len(repo.list_appointments()) == 0
