"""
Domain models for ServiceBook.

Plain data classes — no ORM, no database dependencies.
"""

from dataclasses import dataclass, asdict


@dataclass
class Employee:
    id: str
    name: str
    color: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Appointment:
    id: int
    client_name: str
    service: str
    start_time: float
    duration: float
    reliability_score: int
    employee_id: str

    def to_dict(self) -> dict:
        return asdict(self)
