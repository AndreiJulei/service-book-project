"""
REST API route handlers (Flask Blueprint).

This module contains ONLY route definitions and HTTP-level logic.
All business logic lives in repository.py and validators.py.
"""

from flask import Blueprint, request, jsonify, current_app
from models import Appointment
from repository import AppointmentRepository
from generator import start_generator, stop_generator

api = Blueprint("api", __name__, url_prefix="/api")


def _get_repo() -> AppointmentRepository:
    """Retrieve the repository from the current Flask app's config."""
    return current_app.config["REPO"]


# ---------------------------------------------------------------------------
# Employee endpoints
# ---------------------------------------------------------------------------

@api.route("/employees", methods=["GET"])
def list_employees():
    """GET /api/employees — return all employees."""
    repo = _get_repo()
    employees = repo.list_employees()
    return jsonify([e.to_dict() for e in employees]), 200


# ---------------------------------------------------------------------------
# Appointment endpoints
# ---------------------------------------------------------------------------

@api.route("/appointments", methods=["GET"])
def list_appointments():
    """
    GET /api/appointments — return appointments with server-side pagination.

    Query parameters:
        page      (int, default 1)  — 1-indexed page number
        page_size (int, default 10) — items per page (max 100)

    Response body:
    {
        "items": [ ... ],
        "page": 1,
        "page_size": 10,
        "total": 42,
        "total_pages": 5
    }
    """
    repo = _get_repo()

    # Parse and clamp pagination params
    try:
        page = int(request.args.get("page", 1))
    except (ValueError, TypeError):
        page = 1
    if page < 1:
        page = 1

    try:
        page_size = int(request.args.get("page_size", 10))
    except (ValueError, TypeError):
        page_size = 10
    if page_size < 1:
        page_size = 1
    if page_size > 100:
        page_size = 100

    items, total = repo.list_appointments_paginated(page, page_size)
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return jsonify({
        "items": [a.to_dict() for a in items],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
    }), 200


@api.route("/appointments/<int:appointment_id>", methods=["GET"])
def get_appointment(appointment_id: int):
    """GET /api/appointments/<id> — return a single appointment."""
    repo = _get_repo()
    appt = repo.get_by_id(appointment_id)
    if appt is None:
        return jsonify({"error": "Appointment not found"}), 404
    return jsonify(appt.to_dict()), 200


@api.route("/appointments", methods=["POST"])
def create_appointment():
    """
    POST /api/appointments — create a new appointment.

    Expects a JSON body with: client_name, service, start_time, duration,
    reliability_score, employee_id.

    Returns 201 + the created appointment on success,
    or 400 + { "errors": { ... } } on validation failure.
    """
    repo = _get_repo()
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    result = repo.create(data)

    if isinstance(result, dict):
        # Validation errors
        return jsonify({"errors": result}), 400

    return jsonify(result.to_dict()), 201


@api.route("/appointments/<int:appointment_id>", methods=["PUT"])
def update_appointment(appointment_id: int):
    """
    PUT /api/appointments/<id> — update an existing appointment.

    Returns 200 + updated appointment on success,
    404 if not found, or 400 + { "errors": { ... } } on validation failure.
    """
    repo = _get_repo()
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    result = repo.update(appointment_id, data)

    if result is None:
        return jsonify({"error": "Appointment not found"}), 404

    if isinstance(result, dict):
        return jsonify({"errors": result}), 400

    return jsonify(result.to_dict()), 200


@api.route("/appointments/<int:appointment_id>", methods=["DELETE"])
def delete_appointment(appointment_id: int):
    """
    DELETE /api/appointments/<id> — delete an appointment.

    Returns 200 on success, 404 if not found.
    """
    repo = _get_repo()
    deleted = repo.delete(appointment_id)
    if not deleted:
        return jsonify({"error": "Appointment not found"}), 404
    return jsonify({"message": "Appointment deleted"}), 200


# ---------------------------------------------------------------------------
# Generator endpoints
# ---------------------------------------------------------------------------

@api.route("/generator/start", methods=["POST"])
def api_start_generator():
    """Start the background appointment generator."""
    start_generator()
    return jsonify({"message": "Generator started"}), 200

@api.route("/generator/stop", methods=["POST"])
def api_stop_generator():
    """Stop the background appointment generator."""
    stop_generator()
    return jsonify({"message": "Generator stopped"}), 200
