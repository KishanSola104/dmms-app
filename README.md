# Digital Marksheet Management System (DMMS)

> **Sprint 1 – Initial Platform Setup, Registration, Authentication & User Dashboard**  
> Developed using **MongoDB**, **Express.js**, **React.js** (Vite JSX), and **Node.js**.

---

## 📌 Implementation Overview

DMMS provides an end-to-end multi-tenant academic management architecture designed for educational institutions. Every school operates in an isolated environment with two tiers of authentication:
1. **School-Level Authentication**: Ensures that all actions, queries, and role authorizations are scoped strictly to the authenticated institution.
2. **Role-Based User Authentication**: Supports four primary system roles (**School Administrator**, **Head Teacher**, **Teacher**, and **Office Staff**) with distinct dashboard metrics, navigation, and permissions.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React.js (JSX only, Vite), Tailwind CSS, Lucide Icons, Axios, React Router v6 |
| **Backend** | Node.js, Express.js, RESTful API architecture |
| **Database** | MongoDB (Mongoose ODM) &bull; Database: `DMMS` |
| **Authentication** | Two-tier JWT (School Session + User Session), bcryptjs password hashing |
| **Email Service** | Nodemailer with Gmail SMTP integration |
| **File Uploads** | Multer for employee profile pictures |

---

## 🗄️ Database Collections

The system strictly follows the database schema defined in the specification:

1. **`school_info`**: Stores institutional details, unique `schoolId` (e.g. `KBPS_001`), `schoolCode`, bcrypt password hash, contact persons (2–3), terms acceptance, and configuration.
2. **`employee_info`**: Stores personal & professional staff profiles, designation, contact numbers, and profile picture references.
3. **`role_info`**: Dynamically managed roles (`ADMIN`, `HEAD_TEACHER`, `TEACHER`, `OFFICE_STAFF`).
4. **`user_info`**: Authentication records, unique `userId` (e.g. `KSKBPS_001`), password hash, role references, `isFirstLogin`, and `mustChangePassword` flags.
5. **`notification_info`**: Real-time notifications for schools, roles, and individual users with read/unread tracking.
6. **`academic_year_info`**: School-specific academic sessions with active session tracking (e.g. `2025-2026`).

---

## 🚀 How to Run the Application

### Prerequisites
- Node.js (v18+)
- MongoDB running locally on `mongodb://127.0.0.1:27017`

### 1. Backend Server
```bash
cd backend
npm install
npm run dev
# Server starts on http://localhost:8000
```

### 2. Frontend Application
```bash
cd frontend
npm install
npm run dev
# Vite dev server starts on http://localhost:5173
```

### 3. Automated End-to-End Test Suite
```bash
cd backend
node test_e2e.js
# Runs full 35-assertion automated test suite
```

---

## ✅ Sprint 1 Implementation Checklist (23/23 Completed)

- [x] **Home Page with Header, Main Content, and Footer** (incorporating `Home Image.png` and `logo.png`)
- [x] **School Registration – 4-Step Workflow** (School Info, 2–3 Contact Persons, Initial Admin, Review & Terms)
- [x] **Automated School ID Generation** (`[Initials]_[Number]`, e.g. `KBPS_001`)
- [x] **Automated School Password Generation** (Min 8–10 chars, uppercase, lowercase, numbers, special chars)
- [x] **Initial Administrator ID Generation** (`[AdminInitials][SchoolCode]_[Number]`, e.g. `KSKBPS_001`)
- [x] **Initial Administrator Password Generation** (Complexity guaranteed, distinct from school password)
- [x] **Credential Email Delivery** (Automated dual HTML emails dispatched via Gmail SMTP)
- [x] **School Login** (Authenticates school and sets institutional session)
- [x] **School Forgot Password** (Generates secure temporary password delivered via email)
- [x] **School Logout / Change School** (Clears school session cleanly)
- [x] **Role-Based User Login** (Dynamic role dropdown fetched from `role_info`, identifier validation)
- [x] **User Forgot Password** (Generates temporary user password delivered to personal email)
- [x] **Mandatory First Login Password Change** (Enforces password reset before allowing dashboard access)
- [x] **Four Role-Specific Dashboards** (`ADMIN`, `HEAD_TEACHER`, `TEACHER`, `OFFICE_STAFF`)
- [x] **Common Header, Sidebar, Main Content, and Footer**
- [x] **Academic Year Dropdown** (Dynamically loads school sessions, allows switching active year)
- [x] **Notification Icon & Dropdown** (Badge counter, read/unread states, mark-all-read)
- [x] **User Profile Management** (View details, edit permitted personal info)
- [x] **Profile Image Upload** (Multer upload with JPG/JPEG/PNG validation & 2MB limit)
- [x] **Individual User Password Change** (Validates current password and updates hash)
- [x] **School Password Change by Administrator** (Admin-only privilege to update institutional password)
- [x] **User Logout** (Clears user session while retaining school session for other users)
- [x] **Role-Based Access Control and Strict School Data Isolation**

---

## 🏢 Credits

**Design and Developed by:**  
[Shreeji IT Solutions PVT. LTD.](https://shreejiitsolutions.com)  
&copy; Digital Marksheet Management System
