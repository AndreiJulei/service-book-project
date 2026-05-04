import threading
import time
import random
from faker import Faker
from models import Appointment
from ws import broadcast_appointment

fake = Faker()

_generator_active = False
_generator_thread = None
_repo = None

SERVICES = ["Haircut", "Styling", "Coloring", "Treatment", "Shave"]

def init_generator(repo):
    global _repo
    _repo = repo

def _generator_loop():
    global _generator_active
    while _generator_active:
        # Generate one every 2-5 seconds
        time.sleep(random.uniform(2, 5))
        if not _generator_active:
            break
            
        employee_ids = _repo.employee_ids
        if not employee_ids:
            continue
            
        employee_id = random.choice(employee_ids)
        # Pick a valid time slot
        start_time = random.choice([8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 14, 15, 16, 17, 18, 19])
        duration = random.choice([0.5, 1, 1.5, 2])
        
        if start_time + duration > 21:
            duration = 21 - start_time
            
        input_data = {
            "client_name": fake.name(),
            "service": random.choice(SERVICES),
            "start_time": start_time,
            "duration": duration,
            "reliability_score": random.randint(30, 100),
            "employee_id": employee_id
        }
        
        # Try to create. If it fails validation (e.g. overlap), we just ignore and try again next loop.
        result = _repo.create(input_data)
        if isinstance(result, Appointment):
            broadcast_appointment(result)

def start_generator():
    global _generator_active, _generator_thread
    if _generator_active:
        return
    _generator_active = True
    _generator_thread = threading.Thread(target=_generator_loop, daemon=True)
    _generator_thread.start()

def stop_generator():
    global _generator_active
    _generator_active = False
