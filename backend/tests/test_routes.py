"""
Integration tests for routes.py — REST API endpoint tests.

Uses Flask's test client to exercise every endpoint, including
error cases, pagination, and validation error responses.
"""

import pytest
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import create_app
from repository import AppointmentRepository, SEED_EMPLOYEES
from models import Appointment


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def client():
    """Flask test client with a fresh seeded repository."""
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


@pytest.fixture
def empty_client():
    """Flask test client with an empty repository."""
    repo = AppointmentRepository(seed_appointments=[], seed_employees=SEED_EMPLOYEES)
    app = create_app(repo=repo)
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


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
# GET /api/employees
# ---------------------------------------------------------------------------

class TestListEmployees:
    def test_returns_all_employees(self, client):
        resp = client.get("/api/employees")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 4
        assert data[0]["name"] == "Marcus Chen"

    def test_employee_fields(self, client):
        resp = client.get("/api/employees")
        employee = resp.get_json()[0]
        assert "id" in employee
        assert "name" in employee
        assert "color" in employee


# ---------------------------------------------------------------------------
# GET /api/appointments (with pagination)
# ---------------------------------------------------------------------------

class TestListAppointments:
    def test_default_pagination(self, client):
        resp = client.get("/api/appointments")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "items" in data
        assert "page" in data
        assert "page_size" in data
        assert "total" in data
        assert "total_pages" in data
        assert data["total"] == 6

    def test_custom_page_size(self, client):
        resp = client.get("/api/appointments?page_size=2")
        data = resp.get_json()
        assert len(data["items"]) == 2
        assert data["total_pages"] == 3

    def test_second_page(self, client):
        resp = client.get("/api/appointments?page=2&page_size=2")
        data = resp.get_json()
        assert data["page"] == 2
        assert len(data["items"]) == 2

    def test_page_beyond_data(self, client):
        resp = client.get("/api/appointments?page=100&page_size=10")
        data = resp.get_json()
        assert len(data["items"]) == 0
        assert data["total"] == 6

    def test_invalid_page_defaults_to_1(self, client):
        resp = client.get("/api/appointments?page=abc")
        data = resp.get_json()
        assert data["page"] == 1

    def test_negative_page_defaults_to_1(self, client):
        resp = client.get("/api/appointments?page=-5")
        data = resp.get_json()
        assert data["page"] == 1

    def test_invalid_page_size_defaults_to_10(self, client):
        resp = client.get("/api/appointments?page_size=abc")
        data = resp.get_json()
        assert data["page_size"] == 10

    def test_page_size_clamped_to_1(self, client):
        resp = client.get("/api/appointments?page_size=0")
        data = resp.get_json()
        assert data["page_size"] == 1

    def test_page_size_clamped_to_100(self, client):
        resp = client.get("/api/appointments?page_size=500")
        data = resp.get_json()
        assert data["page_size"] == 100

    def test_empty_list(self, empty_client):
        resp = empty_client.get("/api/appointments")
        data = resp.get_json()
        assert len(data["items"]) == 0
        assert data["total"] == 0
        assert data["total_pages"] == 1

    def test_total_pages_calculation(self, client):
        resp = client.get("/api/appointments?page_size=4")
        data = resp.get_json()
        assert data["total_pages"] == 2  # ceil(6/4) = 2


# ---------------------------------------------------------------------------
# GET /api/appointments/<id>
# ---------------------------------------------------------------------------

class TestGetAppointment:
    def test_existing(self, client):
        resp = client.get("/api/appointments/1")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["client_name"] == "John Doe"

    def test_not_found(self, client):
        resp = client.get("/api/appointments/999")
        assert resp.status_code == 404
        data = resp.get_json()
        assert "error" in data

    def test_all_fields_present(self, client):
        resp = client.get("/api/appointments/1")
        data = resp.get_json()
        expected_fields = ["id", "client_name", "service", "start_time", "duration", "reliability_score", "employee_id"]
        for field in expected_fields:
            assert field in data


# ---------------------------------------------------------------------------
# POST /api/appointments
# ---------------------------------------------------------------------------

class TestCreateAppointment:
    def test_success(self, client):
        resp = client.post(
            "/api/appointments",
            data=json.dumps(_valid_input()),
            content_type="application/json",
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["client_name"] == "New Client"
        assert "id" in data

    def test_auto_increment_id(self, empty_client):
        resp1 = empty_client.post(
            "/api/appointments",
            data=json.dumps(_valid_input()),
            content_type="application/json",
        )
        resp2 = empty_client.post(
            "/api/appointments",
            data=json.dumps({**_valid_input(), "start_time": 16}),
            content_type="application/json",
        )
        assert resp2.get_json()["id"] == resp1.get_json()["id"] + 1

    def test_validation_error(self, client):
        data = _valid_input()
        data["client_name"] = ""
        resp = client.post(
            "/api/appointments",
            data=json.dumps(data),
            content_type="application/json",
        )
        assert resp.status_code == 400
        body = resp.get_json()
        assert "errors" in body
        assert "client_name" in body["errors"]

    def test_no_json_body(self, client):
        resp = client.post("/api/appointments", data="not json", content_type="text/plain")
        assert resp.status_code == 400
        assert "error" in resp.get_json()

    def test_empty_body(self, client):
        resp = client.post(
            "/api/appointments",
            data=json.dumps({}),
            content_type="application/json",
        )
        assert resp.status_code == 400
        body = resp.get_json()
        assert "errors" in body

    def test_overlap_error(self, client):
        """Seed data has employee 1 booked 9–10. Creating overlapping appointment should fail."""
        data = _valid_input()
        data["start_time"] = 9
        data["duration"] = 1
        data["employee_id"] = "1"
        resp = client.post(
            "/api/appointments",
            data=json.dumps(data),
            content_type="application/json",
        )
        assert resp.status_code == 400
        body = resp.get_json()
        assert "start_time" in body["errors"]

    def test_created_appears_in_list(self, empty_client):
        empty_client.post(
            "/api/appointments",
            data=json.dumps(_valid_input()),
            content_type="application/json",
        )
        resp = empty_client.get("/api/appointments")
        assert resp.get_json()["total"] == 1


# ---------------------------------------------------------------------------
# PUT /api/appointments/<id>
# ---------------------------------------------------------------------------

class TestUpdateAppointment:
    def test_success(self, client):
        updated = {
            "client_name": "Updated Name",
            "service": "Updated Service",
            "start_time": 9,
            "duration": 1,
            "reliability_score": 50,
            "employee_id": "1",
        }
        resp = client.put(
            "/api/appointments/1",
            data=json.dumps(updated),
            content_type="application/json",
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["client_name"] == "Updated Name"

    def test_not_found(self, client):
        resp = client.put(
            "/api/appointments/999",
            data=json.dumps(_valid_input()),
            content_type="application/json",
        )
        assert resp.status_code == 404

    def test_validation_error(self, client):
        data = _valid_input()
        data["client_name"] = ""
        resp = client.put(
            "/api/appointments/1",
            data=json.dumps(data),
            content_type="application/json",
        )
        assert resp.status_code == 400
        body = resp.get_json()
        assert "errors" in body

    def test_no_json_body(self, client):
        resp = client.put("/api/appointments/1", data="not json", content_type="text/plain")
        assert resp.status_code == 400

    def test_persists_changes(self, client):
        updated = {
            "client_name": "Persisted",
            "service": "Test",
            "start_time": 9,
            "duration": 1,
            "reliability_score": 50,
            "employee_id": "1",
        }
        client.put(
            "/api/appointments/1",
            data=json.dumps(updated),
            content_type="application/json",
        )
        resp = client.get("/api/appointments/1")
        assert resp.get_json()["client_name"] == "Persisted"


# ---------------------------------------------------------------------------
# DELETE /api/appointments/<id>
# ---------------------------------------------------------------------------

class TestDeleteAppointment:
    def test_success(self, client):
        resp = client.delete("/api/appointments/1")
        assert resp.status_code == 200
        assert "message" in resp.get_json()

    def test_not_found(self, client):
        resp = client.delete("/api/appointments/999")
        assert resp.status_code == 404

    def test_removed_from_list(self, client):
        client.delete("/api/appointments/1")
        resp = client.get("/api/appointments/1")
        assert resp.status_code == 404

    def test_double_delete(self, client):
        client.delete("/api/appointments/1")
        resp = client.delete("/api/appointments/1")
        assert resp.status_code == 404

    def test_count_decreases(self, client):
        client.delete("/api/appointments/1")
        resp = client.get("/api/appointments")
        assert resp.get_json()["total"] == 5


# ---------------------------------------------------------------------------
# Full CRUD integration
# ---------------------------------------------------------------------------

class TestFullCRUDFlow:
    def test_create_read_update_delete(self, empty_client):
        """End-to-end: create → read → update → delete → verify gone."""
        c = empty_client

        # CREATE
        resp = c.post(
            "/api/appointments",
            data=json.dumps(_valid_input()),
            content_type="application/json",
        )
        assert resp.status_code == 201
        appt_id = resp.get_json()["id"]

        # READ
        resp = c.get(f"/api/appointments/{appt_id}")
        assert resp.status_code == 200
        assert resp.get_json()["client_name"] == "New Client"

        # UPDATE
        updated = {**_valid_input(), "client_name": "Final Name"}
        resp = c.put(
            f"/api/appointments/{appt_id}",
            data=json.dumps(updated),
            content_type="application/json",
        )
        assert resp.status_code == 200
        assert resp.get_json()["client_name"] == "Final Name"

        # DELETE
        resp = c.delete(f"/api/appointments/{appt_id}")
        assert resp.status_code == 200

        # VERIFY GONE
        resp = c.get(f"/api/appointments/{appt_id}")
        assert resp.status_code == 404
