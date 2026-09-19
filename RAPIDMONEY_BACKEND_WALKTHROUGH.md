# RapidMoney Backend: Architecture & Flow Walkthrough

## 1. Executive Summary

The **RapidMoney Backend** (`rapidmoney-backend`) is an asynchronous, high-performance RESTful API built on **FastAPI** and **PostgreSQL** using **SQLAlchemy 2.0** and **Pydantic v2**. It handles phone-based OTP authentication, JWT session security with long-lived refresh tokens, auto-registration for borrowers, and provides an extensible **Generic CRUD API Engine** that automatically exposes search, filtering, sorting, and pagination for database entities.

---

## 2. Architecture & Tech Stack

```
                               ┌──────────────────────────────────────────┐
                               │       Client Applications                │
                               │  - React Native Mobile App (c:\rmi)      │
                               │  - Admin / Web Dashboard                 │
                               └────────────────────┬─────────────────────┘
                                                    │ HTTP / JSON
                                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                FastAPI Application Engine                              │
│                                                                                        │
│  ┌──────────────────────┐  ┌───────────────────────────┐  ┌─────────────────────────┐ │
│  │   CORS Middleware    │  │ Security & JWT Layer      │  │ Dynamic Generic Router  │ │
│  │   (Open origins)     │  │ (Bearer Auth / PyJWT)     │  │ (CRUD / Query Builder)  │ │
│  └──────────────────────┘  └───────────────────────────┘  └─────────────────────────┘ │
│                                         │                                              │
│  ┌──────────────────────────────────────┴───────────────────────────────────────────┐  │
│  │                          API v1 Routers (/api/v1)                                │  │
│  │  - /auth/request-otp     - /auth/verify-otp     - /auth/refresh-token            │  │
│  │  - /auth/me              - /users (Generic CRUD: List, Get, Post, Patch, Del)    │  │
│  └──────────────────────────────────────┬───────────────────────────────────────────┘  │
│                                         │                                              │
│  ┌──────────────────────────────────────┴───────────────────────────────────────────┐  │
│  │                          CRUD & Service Layer                                    │  │
│  │  - crud_user.py          - crud_otp.py          - base.py (CRUDBase)             │  │
│  └──────────────────────────────────────┬───────────────────────────────────────────┘  │
└─────────────────────────────────────────┼──────────────────────────────────────────────┘
                                          │ Connection Pool (SQLAlchemy 2.0)
                                          ▼
                               ┌─────────────────────┐
                               │ PostgreSQL Database │
                               │  - users table      │
                               │  - otps table       │
                               └─────────────────────┘
```

### Core Technologies
- **FastAPI (v0.115+)**: Asynchronous web framework with automatic OpenAPI/Swagger UI generation.
- **PostgreSQL + SQLAlchemy 2.0**: Relational database with pooled connection engine (`pool_size=10`, `max_overflow=20`, `pool_pre_ping=True`).
- **Pydantic v2**: Strict schema validation, request deserialization, and serialization using `from_attributes=True`.
- **PyJWT (v2.9+)**: Cryptographic HMAC-SHA256 JWT tokens.
- **Python Secrets**: Cryptographically secure numeric OTP codes and URL-safe sign-in keys.

---

## 3. Database Schema & Data Models

### 3.1 `users` Table ([app/models/user.py](file:///c:/Users/Admin/Desktop/Rapidmoney/rapidmoney-backend/app/models/user.py))

Represents borrowers, employees, and lending partners.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `uuid` | `UUID(as_uuid=True)` | Primary Key, Indexed | Unique internal user identifier. |
| `phone_number` | `String(20)` | Unique, Indexed, Not Null | Primary identity key for mobile OTP login. |
| `pan_card` | `String(20)` | Unique, Indexed, Nullable | Borrower's PAN number. |
| `email` | `String(255)` | Unique, Indexed, Nullable | Registered email address. |
| `full_name` | `String(255)` | Nullable | Full legal name. |
| `fathers_name` | `String(255)` | Nullable | Father's name. |
| `mothers_name` | `String(255)` | Nullable | Mother's name. |
| `gender` | `String(50)` | Nullable | Gender (`male`, `female`, `other`). |
| `phone_verified` | `Boolean` | Default: `False`, Not Null | Set to `True` upon successful OTP verification. |
| `email_verified` | `Boolean` | Default: `False`, Not Null | Email verification status flag. |
| `pan_verified` | `Boolean` | Default: `False`, Not Null | PAN verification status flag. |
| `role` | `Enum(RoleEnum)` | Not Null, Default: `borrower` | `"borrower"`, `"employee"`, `"lender"`. |
| `is_active` | `Boolean` | Default: `True`, Not Null | Active status for blocking/suspending accounts. |
| `image_url` | `Text` | Nullable | Profile avatar / selfie URL. |
| `refresh_token` | `Text` | Nullable | Current active refresh token hash for revocation check. |
| `created_at` | `DateTime(UTC)` | Server default: `func.now()` | Record creation timestamp. |
| `updated_at` | `DateTime(UTC)` | Server default: `func.now()` | Automatically updated timestamp. |

> **Unique Table Constraints:**
> - `uq_user_phone_pan`: Composite unique constraint on `(phone_number, pan_card)` to enforce single account per PAN/phone pairing.

---

### 3.2 `otps` Table ([app/models/otp.py](file:///c:/Users/Admin/Desktop/Rapidmoney/rapidmoney-backend/app/models/otp.py))

Handles verification codes across the user journey.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `uuid` | `UUID(as_uuid=True)` | Primary Key, Indexed | Unique OTP record identifier. |
| `user_id` | `UUID` | ForeignKey(`users.uuid`, ondelete=`CASCADE`), Nullable | Linked user (null on initial first-time signup request). |
| `otp_type` | `Enum(OTPTypeEnum)` | Default: `signup/login`, Not Null | `"signup/login"`, `"sanction"`, `"consent"`. |
| `otp` | `Integer` | Not Null | 4-digit numeric verification code. |
| `sign_in_key` | `String(255)` | Indexed, Nullable | 32-byte cryptographic session linkage token. |
| `is_active` | `Boolean` | Default: `True`, Not Null | Set to `False` once verified or superseded. |
| `created_at` | `DateTime(UTC)` | Server default: `func.now()` | Generation timestamp. |
| `expires_at` | `DateTime(UTC)` | Not Null | Expiration timestamp (default: `now + 5 minutes`). |

---

## 4. End-to-End Authentication & User Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor User as Mobile App (User)
    participant Auth as /api/v1/auth
    participant DB as PostgreSQL DB

    Note over User,DB: Phase 1: Request OTP
    User->>Auth: POST /auth/request-otp { phone_number: "9876543210" }
    Auth->>DB: Query User & deactive old active OTPs for this phone
    Auth->>DB: Insert new OTP (4-digit code, sign_in_key, expires_at +5m)
    Auth-->>User: 200 OK { sign_in_key, expires_in_seconds, test_otp }

    Note over User,DB: Phase 2: Verify OTP & Auto-Registration
    User->>Auth: POST /auth/verify-otp { phone_number, otp, sign_in_key }
    Auth->>DB: Query active unexpired OTP matching code & sign_in_key
    alt Invalid or Expired OTP
        Auth-->>User: 400 Bad Request ("Invalid or expired OTP")
    else Valid OTP
        Auth->>DB: Set OTP is_active = False
        alt User Exists
            Auth->>DB: UPDATE users SET phone_verified = True
        else New User
            Auth->>DB: INSERT INTO users (phone_number, role="borrower", phone_verified=True)
        end
        Auth->>DB: Link OTP user_id & save generated refresh_token
        Auth-->>User: 200 OK { access_token (60m), refresh_token (30d), user }
    end

    Note over User,DB: Phase 3: Authenticated Operations
    User->>Auth: GET /auth/me (Header: Bearer <access_token>)
    Auth-->>User: 200 OK { user profile details }

    Note over User,DB: Phase 4: Token Refresh
    User->>Auth: POST /auth/refresh-token { refresh_token }
    Auth->>DB: Check token validity and verify against user.refresh_token
    Auth-->>User: 200 OK { access_token: <new_token> }
```

### Key Security Defenses:
1. **Replay & Stale Attack Prevention**: Requesting a new OTP immediately flags all prior active OTPs for that phone/user as `is_active = False`.
2. **Session Hijack Prevention**: The `sign_in_key` ties the phone request to the specific verification call.
3. **Single-Use Burn**: The OTP is marked `is_active = False` in the exact transaction that validates it.
4. **Token Revocation Support**: `user.refresh_token` stored in the database allows revoking a user's session from the server by clearing or regenerating the database entry.

---

## 5. The Generic CRUD API Engine

The engine defined in [app/api/generic_router.py](file:///c:/Users/Admin/Desktop/Rapidmoney/rapidmoney-backend/app/api/generic_router.py) and [app/crud/base.py](file:///c:/Users/Admin/Desktop/Rapidmoney/rapidmoney-backend/app/crud/base.py) allows creating fully functional RESTful CRUD endpoints for any SQLAlchemy model with **3 lines of code**:

```python
# Example: Creating users router (app/api/v1/users.py)
router = create_generic_router(
    model=User,
    create_schema=UserCreate,
    update_schema=UserUpdate,
    response_schema=UserResponse,
    prefix="/users",
    tags=["Users"],
    search_fields=["full_name", "email", "phone_number", "pan_card"],
    auth_required=True,
)
```

### Generated Capabilities:
- **Pagination**: Built-in `page` and `page_size` parameters returning `total`, `page`, `page_size`, and `total_pages`.
- **Dynamic Field Filtering**: Any query parameter matching a model column (e.g. `?role=borrower&is_active=true&gender=male`) is dynamically evaluated and filtered.
- **Search Query**: `?search=term` executes an `ILIKE` search across all configured `search_fields`.
- **Dynamic Sorting**: `?sort_by=created_at&sort_order=desc` (or `asc`).

---

## 6. API Reference

All responses follow the standard response envelope:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### 6.1 Authentication Endpoints (`/api/v1/auth`)

| Method | Endpoint | Auth | Request Body | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/request-otp` | Public | `{ phone_number, otp_type?, full_name? }` | Generates a 4-digit OTP and returns `sign_in_key`. (Includes `test_otp` in dev/debug mode). |
| `POST` | `/api/v1/auth/verify-otp` | Public | `{ phone_number, otp, sign_in_key }` | Validates OTP, auto-creates user if missing, and issues JWT access and refresh tokens. |
| `POST` | `/api/v1/auth/refresh-token` | Public | `{ refresh_token }` | Validates refresh token and returns a fresh Bearer access token. |
| `GET` | `/api/v1/auth/me` | Bearer Token | None | Returns the currently authenticated user's profile. |

### 6.2 User Management Endpoints (`/api/v1/users`)

| Method | Endpoint | Auth | Query / Body Params | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/users` | Bearer Token | `?page=1&page_size=20&sort_by=...&search=...&<field>=...` | Returns paginated list of users with dynamic filters. |
| `GET` | `/api/v1/users/{id}` | Bearer Token | Path `id` (UUID) | Retrieves a specific user by UUID. |
| `POST` | `/api/v1/users` | Bearer Token | `{ phone_number, full_name, role, ... }` | Creates a user record. |
| `PUT` | `/api/v1/users/{id}` | Bearer Token | Full `UserUpdate` schema | Full replacement of user fields. |
| `PATCH` | `/api/v1/users/{id}` | Bearer Token | Partial `{ pan_card, full_name, gender, ... }` | Partial update (used during onboarding steps). |
| `DELETE` | `/api/v1/users/{id}` | Bearer Token | Path `id` (UUID) | Deletes a user record. |

---

## 7. Connecting Mobile App (`c:\rmi`) to RapidMoney Backend

To connect the React Native app in `c:\rmi` to this backend:

1. **Configure Axios Base URL** in `c:\rmi\utils\api\axios.ts`:
   ```ts
   // Point to your local network IP where FastAPI is running on port 8000
   const BASE_URL = "http://192.168.1.XX:8000/api/v1";
   ```
2. **Login Screen (`app/login.tsx`)**:
   - Call `POST /api/v1/auth/request-otp` with `{ phone_number }`.
   - Store `sign_in_key` returned in `response.data.sign_in_key` into React state/params.
3. **Verify OTP Screen (`app/signin-otp.tsx`)**:
   - The backend's `generate_numeric_otp(4)` generates a **4-digit OTP**, perfectly matching the 4-box OTP input component.
   - Send `{ phone_number, otp: Number(enteredOtp), sign_in_key }` to `POST /api/v1/auth/verify-otp`.
   - Store `data.access_token` and `data.refresh_token` in secure storage.
4. **Personal Details Screen (`app/loan-application.tsx` / `personal-details.tsx`)**:
   - Send `PATCH /api/v1/users/{user_uuid}` with `{ full_name, pan_card, fathers_name, mothers_name, gender }`.

---

## 8. Local Setup & Execution Guide

### Prerequisites
- Python 3.10+ (or 3.12/3.14)
- PostgreSQL running locally with database `rpm_test` created:
  ```sql
  CREATE DATABASE rpm_test;
  ```

### Step-by-Step Run Instructions

1. **Navigate to the Backend Directory**:
   ```bash
   cd "C:\Users\Admin\Desktop\Rapidmoney\rapidmoney-backend"
   ```

2. **Create and Activate Virtual Environment**:
   ```powershell
   python -m venv venv
   .\venv\Scripts\activate
   ```

3. **Install Dependencies**:
   ```powershell
   pip install -r requirements.txt
   ```

4. **Verify `.env` Settings**:
   Ensure PostgreSQL credentials in `.env` match your local PostgreSQL service:
   ```env
   DATABASE_URL=postgresql://postgres:qwerty12345@localhost:5432/rpm_test
   DEBUG=True
   OTP_TEST_MODE=True
   ```

5. **Start the Development Server**:
   ```powershell
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

6. **Interactive Documentation**:
   - **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
   - **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

7. **Run Integration Test Suite**:
   ```powershell
   python test_api_flow.py
   ```
   Runs automated end-to-end tests verifying:
   - Health check
   - OTP generation & session key issuance
   - OTP verification & user auto-registration
   - Protected `/auth/me` with Bearer token
   - Generic CRUD listing with pagination & filtering
   - User profile partial updates (`PATCH`)
   - Refresh token rotation & re-authentication
