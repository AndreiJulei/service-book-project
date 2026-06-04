
# ServiceBook High-Fidelity Design

This is a code bundle for ServiceBook High-Fidelity Design.

The original design project is available at:
https://www.figma.com/design/6tP0KnY7hc8LblKz57bXUo/ServiceBook-High-Fidelity-Design

## Running the app

1. Install dependencies:

   ```bash
   npm i
   ```

2. Start the development server:

   ```bash
   npm run dev
   ```

3. Open the app in your browser and go to `/firm/dashboard`.

## Master Schedule changes (in-memory repository + CRUD)

The Firm Master Schedule page was updated to use an in-memory repository and a master-detail workflow.

### What was added

- In-memory repository with full CRUD operations for appointments.
- Field-level validation for all appointment fields.
- Master-detail UI behavior:
  - Master list and timeline cards are selectable.
  - Selected appointment is editable in the detail form.
  - New appointment creation from the detail panel.
  - Delete action for the selected appointment.
- Unit tests with strict 100% coverage thresholds for the new domain module.

### Main files

- `src/app/components/firm/FirmDashboard.tsx`
  - UI integration with repository and form state.
- `src/app/components/firm/scheduleDomain.ts`
  - Types, validators, helpers, and in-memory repository implementation.
- `src/app/components/firm/scheduleDomain.test.ts`
  - Validation, CRUD, and helper tests.
- `vite.config.ts`
  - Vitest setup + 100% coverage thresholds.

## Cookie Tracking System

A simple cookie-based user activity monitoring system has been implemented to track user preferences and activity.

### Features

- **Page Visit Tracking**: Automatically tracks when users visit different pages
- **Click Tracking**: Records user interactions with specific elements
- **Preference Storage**: Stores user preferences in cookies
- **Activity Analytics**: Provides methods to retrieve and analyze user activity data

### Usage

The system is automatically integrated into the application. To use the tracking hooks in your components:

```typescript
import { useTrackPageVisit, useTrackClick } from '../utils/useTracking';

// Track page visits
useTrackPageVisit('dashboard');

// Track clicks
useTrackClick('search-button');
```

### Files

- `src/utils/cookieManager.ts` - Core cookie management and activity tracking
- `src/utils/useTracking.ts` - React hooks for easy integration

## End-to-End Testing

Comprehensive Playwright E2E tests have been implemented to test critical application features and the cookie tracking system.

### Test Coverage

- **Authentication**: Login form validation and navigation
- **Client Search**: Search functionality and user interactions
- **Firm Dashboard**: Dashboard loading and navigation
- **Cookie System**: Cookie persistence and activity tracking

### Running Tests

Due to framework conflicts between Vitest and Playwright, tests are run from an isolated environment:

```bash
# Run all E2E tests
npm run test:e2e

# Run tests with browser UI visible
npm run test:e2e:headed

# Launch Playwright test UI
npm run test:e2e:ui
```

### Test Files

- `playwright-tests/example.spec.ts` - Comprehensive test suite (30 tests)
- `playwright-tests/simple.spec.ts` - Basic functionality tests (12 tests)
- `playwright.config.ts` - Playwright configuration

## How to verify each operation manually

Open `/firm/dashboard` and use the "Appointment Detail" panel.

### 1. Read operation

1. Confirm appointments are listed in:
   - Timeline blocks on the left.
   - "Master List" in the detail panel.
2. Click any timeline card or master-list row.
3. Confirm the detail form loads that appointment values.

### 2. Create operation

1. Click `New`.
2. Fill all fields with valid values.
3. Click `Create`.
4. Confirm the new appointment appears in:
   - Master List.
   - Timeline for the selected employee.

### 3. Update operation

1. Select an existing appointment.
2. Change one or more fields.
3. Click `Save`.
4. Confirm updated values are reflected in master list and timeline.

### 4. Delete operation

1. Select an existing appointment.
2. Click the red delete button (trash icon).
3. Confirm the appointment is removed from:
   - Master List.
   - Timeline.

### 5. Validation checks (all fields)

Try these invalid inputs and click `Create` or `Save` to confirm inline errors are shown:

- `clientName`
  - Empty value.
  - Too short (1 character).
  - Too long (> 60 chars).
- `service`
  - Empty value.
  - Too short (1 character).
  - Too long (> 60 chars).
- `startTime`
  - Non-numeric value.
  - Earlier than workday start.
  - At or beyond workday end.
- `duration`
  - Non-numeric value.
  - `<= 0`.
  - `> 8`.
  - Causes appointment to end after closing time.
- `reliabilityScore`
  - Non-integer value.
  - Less than `0`.
  - Greater than `100`.
- `employeeId`
  - Empty selection.
  - Invalid value.
- Overlap validation
  - Create/update an appointment so it overlaps another appointment for the same employee.

Note: repository data is in memory only, so page refresh resets to seed data.

## Running tests

Run all tests:

```bash
npm run test
```

Run coverage report:

```bash
npm run coverage
```

Coverage is configured with strict thresholds and should pass at:

- 100% statements
- 100% branches
- 100% functions
- 100% lines

## Optional check

Run a production build:

```bash
npm run build
```
  


  # Start the API server
cd /Users/juv/Documents/MPP/backend
source venv/bin/activate
python app.py

# Run tests with coverage
python -m pytest tests/ -v --cov=. --cov-report=term-missing
