"""
SmartEdu - Flask + SQLite Backend
Run with: python app.py
Everything runs on: http://localhost:5000
"""

import sqlite3
import hashlib
import os
import json
from datetime import datetime, date
from flask import Flask, request, jsonify, g, send_from_directory
from flask_cors import CORS

# Serve HTML files from the project root directory
ROOT = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, static_folder=ROOT, static_url_path='')
CORS(app)  # keep as safety net

DB_PATH = os.path.join(ROOT, 'smartedu.db')

# ── Serve HTML pages ──────────────────────────────────────
@app.route('/')
def home():
    return send_from_directory(ROOT, 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(ROOT, filename)
# ──────────────────────────────────────────────────────────


# ─────────────────────────────────────────
#  DATABASE HELPERS
# ─────────────────────────────────────────
def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row   # return dict-like rows
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db

@app.teardown_appcontext
def close_db(exc):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def query(sql, args=(), one=False):
    cur = get_db().execute(sql, args)
    rv = cur.fetchall()
    return (dict(rv[0]) if rv else None) if one else [dict(r) for r in rv]

def execute(sql, args=()):
    db = get_db()
    cur = db.execute(sql, args)
    db.commit()
    return cur.lastrowid

def hash_pw(pw):
    return hashlib.sha256(pw.encode()).hexdigest()

# ─────────────────────────────────────────
#  DATABASE INIT & SEED
# ─────────────────────────────────────────
SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    roll_no     TEXT UNIQUE,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'student',  -- student | faculty | admin
    department  TEXT,
    semester    INTEGER,
    section     TEXT,
    phone       TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subjects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    credits     INTEGER DEFAULT 4,
    semester    INTEGER NOT NULL,
    faculty_id  INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS attendance (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id  INTEGER NOT NULL REFERENCES users(id),
    subject_id  INTEGER NOT NULL REFERENCES subjects(id),
    date        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'present',  -- present | absent | late
    marked_by   INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS grades (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id  INTEGER NOT NULL REFERENCES users(id),
    subject_id  INTEGER NOT NULL REFERENCES subjects(id),
    exam_type   TEXT NOT NULL,  -- internal | midsem | endsem
    marks       REAL NOT NULL,
    max_marks   REAL NOT NULL DEFAULT 100,
    semester    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS resources (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    subject_id  INTEGER REFERENCES subjects(id),
    file_type   TEXT NOT NULL,  -- pdf | video | paper | lab
    file_size   TEXT,
    uploaded_by INTEGER REFERENCES users(id),
    downloads   INTEGER DEFAULT 0,
    description TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notices (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'info',  -- urgent | exam | event | info | finance
    priority    TEXT DEFAULT 'normal',
    posted_by   INTEGER REFERENCES users(id),
    target_dept TEXT DEFAULT 'all',
    views       INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assignments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    subject_id  INTEGER REFERENCES subjects(id),
    due_date    TEXT NOT NULL,
    max_marks   REAL DEFAULT 100,
    description TEXT,
    created_by  INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS submissions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id   INTEGER REFERENCES assignments(id),
    student_id      INTEGER REFERENCES users(id),
    submitted_at    TEXT DEFAULT (datetime('now')),
    marks_awarded   REAL,
    feedback        TEXT,
    status          TEXT DEFAULT 'submitted'  -- submitted | graded | late
);

CREATE TABLE IF NOT EXISTS chat_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER REFERENCES users(id),
    message     TEXT NOT NULL,
    response    TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS books (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT NOT NULL,
    author        TEXT NOT NULL,
    isbn          TEXT UNIQUE,
    category      TEXT NOT NULL,
    subject_id    INTEGER REFERENCES subjects(id),
    publisher     TEXT,
    edition       TEXT,
    year          INTEGER,
    total_copies  INTEGER DEFAULT 3,
    available     INTEGER DEFAULT 3,
    cover_color   TEXT DEFAULT '#6366f1',
    description   TEXT,
    rating        REAL DEFAULT 4.0,
    pages         INTEGER DEFAULT 300
);

CREATE TABLE IF NOT EXISTS library_transactions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id    INTEGER REFERENCES users(id),
    book_id       INTEGER REFERENCES books(id),
    borrowed_at   TEXT DEFAULT (datetime('now')),
    due_date      TEXT NOT NULL,
    returned_at   TEXT,
    fine          REAL DEFAULT 0,
    status        TEXT DEFAULT 'borrowed'
);

CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT,
    event_date  TEXT NOT NULL,
    event_time  TEXT,
    venue       TEXT,
    category    TEXT DEFAULT 'academic',
    organizer   TEXT,
    max_seats   INTEGER DEFAULT 100,
    registered  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS study_groups (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    subject_id  INTEGER REFERENCES subjects(id),
    description TEXT,
    max_members INTEGER DEFAULT 6,
    leader_id   INTEGER REFERENCES users(id),
    meeting_day TEXT,
    meeting_time TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS study_group_members (
    group_id    INTEGER REFERENCES study_groups(id),
    student_id  INTEGER REFERENCES users(id),
    joined_at   TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (group_id, student_id)
);

CREATE TABLE IF NOT EXISTS quick_notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id  INTEGER REFERENCES users(id),
    title       TEXT NOT NULL,
    content     TEXT,
    color       TEXT DEFAULT '#6366f1',
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);
"""

SEED_DATA = """
-- Faculty
INSERT OR IGNORE INTO users (name, email, roll_no, password, role, department, semester)
VALUES
  ('Prof. Ramesh Kumar',  'ramesh@college.edu',  NULL, '{pw}', 'faculty', 'CSE', NULL),
  ('Prof. Anita Desai',   'anita@college.edu',   NULL, '{pw}', 'faculty', 'CSE', NULL),
  ('Prof. Suresh Patel',  'suresh@college.edu',  NULL, '{pw}', 'faculty', 'CSE', NULL),
  ('Prof. Preethi Iyer',  'preethi@college.edu', NULL, '{pw}', 'faculty', 'CSE', NULL),
  ('Prof. Vikram Singh',  'vikram@college.edu',  NULL, '{pw}', 'faculty', 'CSE', NULL);

-- Students
INSERT OR IGNORE INTO users (name, email, roll_no, password, role, department, semester, section, phone)
VALUES
  ('Priya Sharma',  'priya@college.edu',  '21CS001', '{pw}', 'student', 'CSE', 5, 'A', '9876543210'),
  ('Arjun Mehta',   'arjun@college.edu',  '21CS007', '{pw}', 'student', 'CSE', 5, 'A', '9876543211'),
  ('Rahul Mehta',   'rahul@college.edu',  '21CS012', '{pw}', 'student', 'CSE', 5, 'A', '9876543212'),
  ('Sneha Patil',   'sneha@college.edu',  '21CS019', '{pw}', 'student', 'CSE', 5, 'A', '9876543213'),
  ('Karan Nair',    'karan@college.edu',  '21CS041', '{pw}', 'student', 'CSE', 5, 'A', '9876543214'),
  ('Ananya Roy',    'ananya@college.edu', '21CS023', '{pw}', 'student', 'CSE', 5, 'A', '9876543215');

-- Subjects (semester 5)
INSERT OR IGNORE INTO subjects (code, name, credits, semester, faculty_id)
VALUES
  ('CS501', 'Data Structures & Algorithms',  4, 5, 1),
  ('CS502', 'Database Management System',    4, 5, 2),
  ('CS503', 'Computer Networks',             4, 5, 3),
  ('CS504', 'Operating Systems',             4, 5, 4),
  ('CS505', 'Software Engineering',          4, 5, 5);

-- Notices
INSERT OR IGNORE INTO notices (title, description, category, priority, posted_by, views)
VALUES
  ('Mid-Semester Examination Schedule Released',
   'Mid-sem examinations for all Semester 5 courses are scheduled from Oct 20-28, 2026. Hall tickets to be collected by Oct 18.',
   'urgent', 'high', 2, 1240),
  ('Internal Assessment Marks Uploaded',
   'Internal assessment marks for Unit Test 2 have been uploaded. Grievances within 3 working days.',
   'exam', 'normal', 2, 890),
  ('TechFest 2026 InnovatX - Registrations Open',
   'Annual technical festival open for registrations. Hackathon, Paper Presentation, Coding Contest, Robotics.',
   'event', 'normal', 1, 2100),
  ('Semester Fee Payment Deadline - October 20',
   'Complete Semester 5 fee payment before October 20, 2026 to avoid Rs.500 late penalty.',
   'finance', 'high', 1, 3200),
  ('Library Book Return Deadline - Oct 12',
   'All library books must be returned by October 12, 2026. Fine of Rs.5/day after deadline.',
   'urgent', 'high', 1, 1800),
  ('Campus Placement Drive - Infosys, TCS, Wipro',
   'Campus placement drive for 2026-27 batch begins November 1. Eligible: CGPA >= 6.5, no active backlogs.',
   'event', 'normal', 1, 4500),
  ('Campus Wi-Fi Upgrade - Scheduled Maintenance Oct 10',
   'Campus network maintenance on Oct 10 from 2AM-6AM. Wi-Fi unavailable during this period.',
   'info', 'normal', 1, 560);

-- Resources
INSERT OR IGNORE INTO resources (title, subject_id, file_type, file_size, uploaded_by, downloads, description)
VALUES
  ('DSA Module 3 - Trees & Graphs',                    1, 'pdf',   '2.4 MB', 1, 342, 'Complete notes on BST, AVL, Graph algorithms'),
  ('DBMS - Normalization & Functional Dependencies',    2, 'pdf',   '1.8 MB', 2, 578, '1NF to BCNF with examples'),
  ('DSA - Binary Trees Complete Video Lecture',         1, 'video', '52 min', 1, 892, 'Recorded lecture on binary trees'),
  ('CN - OSI & TCP/IP Layers Complete Notes',           3, 'pdf',   '3.1 MB', 3, 415, 'Layer-by-layer explanation with diagrams'),
  ('OS - Process Scheduling & Memory Management',       4, 'pdf',   '2.2 MB', 4, 290, 'FCFS, SJF, Round Robin algorithms'),
  ('DBMS Previous Year Papers 2021-25',                 2, 'paper', '4 papers', 2, 1204, 'Previous 5 year question papers with solutions'),
  ('SE - Agile, Scrum & SDLC Models',                   5, 'pdf',   '1.5 MB', 5, 188, 'Comparison of all SDLC models'),
  ('CN - Subnetting & IP Addressing Masterclass',       3, 'video', '38 min', 3, 654, 'IP addressing, CIDR, subnetting practice'),
  ('OS Lab Manual - Shell Scripting & System Calls',    4, 'lab',   '4.2 MB', 4, 340, 'Complete OS lab exercises'),
  ('DSA Previous Year Papers with Solutions 2020-25',   1, 'paper', '6 papers', 1, 987, 'Fully solved previous year papers'),
  ('SE - UML Diagrams & Use Case Modeling',             5, 'video', '45 min', 5, 430, 'Class diagrams, sequence diagrams, use cases'),
  ('DBMS - SQL Advanced Queries & Stored Procedures',   2, 'pdf',   '2.6 MB', 2, 621, 'Complex joins, views, triggers, procedures');

-- Assignments
INSERT OR IGNORE INTO assignments (title, subject_id, due_date, max_marks, description, created_by)
VALUES
  ('DSA Assignment 3 - Graph Algorithms',  1, '2026-10-06', 30, 'Implement BFS, DFS and Dijkstra algorithm', 1),
  ('DBMS Mini Project - Library System',   2, '2026-10-15', 50, 'Design and implement a library management DB', 2),
  ('SE Project Proposal Submission',       5, '2026-10-15', 20, 'Submit project proposal with SRS document', 5),
  ('CN Lab Report - Socket Programming',   3, '2026-10-12', 25, 'Complete socket programming lab report', 3),
  ('OS Assignment - Page Replacement',     4, '2026-10-20', 30, 'Simulate FIFO, LRU, Optimal page replacement', 4);

-- Books / Library
INSERT OR IGNORE INTO books (title, author, isbn, category, subject_id, publisher, edition, year, total_copies, available, cover_color, description, rating, pages)
VALUES
  ('Introduction to Algorithms', 'Cormen, Leiserson, Rivest', '978-0262033848', 'DSA', 1, 'MIT Press', '4th', 2022, 4, 2, '#6366f1', 'The comprehensive guide to algorithms used worldwide in CS education.', 4.8, 1292),
  ('Database System Concepts', 'Silberschatz, Korth', '978-0078022159', 'DBMS', 2, 'McGraw-Hill', '7th', 2020, 3, 1, '#8b5cf6', 'Complete coverage of database management from fundamentals to advanced topics.', 4.6, 910),
  ('Computer Networks', 'Andrew Tanenbaum', '978-0132126953', 'Networks', 3, 'Pearson', '5th', 2011, 3, 3, '#06b6d4', 'Detailed exploration of all network layers with practical examples.', 4.7, 960),
  ('Operating System Concepts', 'Silberschatz, Galvin', '978-1119800361', 'OS', 4, 'Wiley', '10th', 2021, 4, 2, '#10b981', 'The definitive OS textbook — processes, memory, storage.', 4.5, 976),
  ('Software Engineering', 'Ian Sommerville', '978-0137035151', 'SE', 5, 'Addison-Wesley', '10th', 2015, 3, 3, '#f97316', 'Best practices in software engineering, agile and traditional methods.', 4.3, 816),
  ('Data Structures Using C', 'Reema Thareja', '978-0198099307', 'DSA', 1, 'Oxford Press', '3rd', 2019, 5, 4, '#ec4899', 'Comprehensive data structures guide with C implementations.', 4.4, 676),
  ('Fundamentals of Database Systems', 'Ramez Elmasri', '978-0133970777', 'DBMS', 2, 'Pearson', '7th', 2015, 3, 2, '#14b8a6', 'Covers relational, object-oriented and other database models.', 4.3, 1240),
  ('Data Communications & Networking', 'Behrouz Forouzan', '978-0073376226', 'Networks', 3, 'McGraw-Hill', '5th', 2012, 4, 3, '#f59e0b', 'Thorough coverage of data communications and networking protocols.', 4.5, 1264),
  ('Modern Operating Systems', 'Andrew Tanenbaum', '978-0133591620', 'OS', 4, 'Pearson', '4th', 2014, 3, 1, '#6366f1', 'Covers processes, threads, memory management and file systems.', 4.6, 1080),
  ('The Pragmatic Programmer', 'Hunt & Thomas', '978-0135957059', 'SE', 5, 'Addison-Wesley', '20th Anniversary', 2019, 3, 3, '#8b5cf6', 'Classic programming wisdom — tips for professional developers.', 4.9, 352),
  ('Clean Code', 'Robert C. Martin', '978-0132350884', 'Programming', NULL, 'Prentice Hall', '1st', 2008, 3, 2, '#10b981', 'How to write code that is readable, reusable and refactorable.', 4.7, 464),
  ('Head First Design Patterns', 'Freeman & Robson', '978-0596007126', 'Programming', NULL, 'O''Reilly', '2nd', 2020, 2, 2, '#ef4444', 'Visual, engaging guide to design patterns in software development.', 4.6, 694),
  ('Python Crash Course', 'Eric Matthes', '978-1593279288', 'Programming', NULL, 'No Starch Press', '3rd', 2023, 4, 4, '#f97316', 'Fast-paced, hands-on introduction to Python programming.', 4.8, 552),
  ('Cracking the Coding Interview', 'Gayle McDowell', '978-0984782857', 'Placement', NULL, 'CareerCup', '6th', 2015, 5, 3, '#ec4899', '189 programming questions and solutions for tech interviews.', 4.8, 708),
  ('The Algorithm Design Manual', 'Steven Skiena', '978-3030542559', 'DSA', 1, 'Springer', '3rd', 2020, 2, 2, '#14b8a6', 'War stories and practical algorithm design for real problems.', 4.5, 793);

-- Events
INSERT OR IGNORE INTO events (title, description, event_date, event_time, venue, category, organizer, max_seats, registered)
VALUES
  ('TechFest 2026 — Hackathon', '24-hour hackathon on AI/ML solutions. Team size: 2-4.', '2026-11-05', '09:00 AM', 'Main Auditorium', 'technical', 'CSE Department', 200, 143),
  ('Campus Placement Drive — Infosys', 'Off-campus recruitment for B.Tech CSE/ECE. CGPA >= 6.5.', '2026-11-01', '08:30 AM', 'Placement Hall', 'placement', 'Placement Cell', 150, 89),
  ('DBMS Workshop — SQL & NoSQL', 'Hands-on workshop on advanced SQL and MongoDB. By Prof. Anita.', '2026-10-28', '02:00 PM', 'CS Lab 3', 'academic', 'Prof. Anita Desai', 40, 38),
  ('Paper Presentation Competition', 'Present research papers on emerging technologies. Cash prizes.', '2026-11-08', '10:00 AM', 'Seminar Hall B', 'technical', 'R&D Cell', 60, 22),
  ('Alumni Talk — Career in FAANG', 'Alumni from Google and Microsoft share their journey.', '2026-10-30', '04:00 PM', 'Main Auditorium', 'career', 'Alumni Association', 300, 267),
  ('Cultural Fest — Utsav 2026', 'Annual cultural celebration — dance, music, drama, art.', '2026-11-15', '05:00 PM', 'Open Air Theatre', 'cultural', 'Student Council', 500, 412),
  ('Coding Contest — CodeStorm', 'Online competitive programming contest. Individual.', '2026-10-29', '02:00 PM', 'Online (HackerRank)', 'technical', 'Coding Club', 100, 67),
  ('Mental Health Awareness Session', 'Talk on stress management and academic wellness.', '2026-10-27', '11:00 AM', 'Conference Room 1', 'wellness', 'Student Counsellor', 80, 34);

-- Study Groups
INSERT OR IGNORE INTO study_groups (name, subject_id, description, max_members, leader_id, meeting_day, meeting_time)
VALUES
  ('DSA Crackers', 1, 'Daily DSA practice — LeetCode + previous year questions', 6, 6, 'Monday & Thursday', '5:00 PM'),
  ('DBMS Masters', 2, 'SQL query practice and normalization problems', 5, 7, 'Tuesday & Friday', '4:30 PM'),
  ('Network Ninjas', 3, 'Subnetting, routing protocols and networking labs', 6, 8, 'Wednesday', '6:00 PM'),
  ('OS Study Circle', 4, 'Process scheduling, memory management discussions', 4, 9, 'Saturday', '10:00 AM'),
  ('Placement Prep Group', NULL, 'Aptitude, coding rounds and mock interviews', 8, 6, 'Daily', '7:00 PM');

-- Study group members
INSERT OR IGNORE INTO study_group_members (group_id, student_id) VALUES
  (1,6),(1,7),(1,8),(1,11),
  (2,7),(2,9),(2,10),
  (3,8),(3,9),(3,11),
  (4,9),(4,10),
  (5,6),(5,7),(5,8),(5,9),(5,10),(5,11);

-- Quick Notes for Priya
INSERT OR IGNORE INTO quick_notes (student_id, title, content, color)
VALUES
  (6, 'DSA Revision', 'Revise BST, AVL trees, Dijkstra before mid-sem. Focus on time complexity.', '#6366f1'),
  (6, 'DBMS To-Do', 'Complete normalization assignment. Read FD and BCNF chapter again.', '#f59e0b'),
  (6, 'Placement Prep', 'LeetCode daily: 2 medium + 1 hard. Practice SQL on HackerRank.', '#10b981'),
  (6, 'Exam Dates', 'Mid-sem: Oct 20-28. Prepare OS and CN first — toughest papers.', '#ef4444');

-- Library borrowing
INSERT OR IGNORE INTO library_transactions (student_id, book_id, borrowed_at, due_date, status)
VALUES
  (6, 1, '2026-10-01', '2026-10-15', 'borrowed'),
  (6, 4, '2026-10-05', '2026-10-19', 'borrowed'),
  (7, 2, '2026-09-28', '2026-10-12', 'overdue'),
  (8, 3, '2026-10-10', '2026-10-24', 'borrowed'),
  (9, 5, '2026-10-08', '2026-10-22', 'borrowed'),
  (6, 10, '2026-09-15', '2026-09-29', 'returned');

""".replace('{pw}', hash_pw('password123'))


def init_db():
    """Create tables and seed data if DB doesn't exist."""
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)
    # Check if already seeded
    count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if count == 0:
        conn.executescript(SEED_DATA)
        print("[OK] Database seeded with sample data!")
    conn.commit()
    conn.close()

    # Now seed attendance and grades with a separate connection
    seed_attendance_and_grades()


def seed_attendance_and_grades():
    """Insert realistic attendance and grade data."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    att_count = conn.execute("SELECT COUNT(*) FROM attendance").fetchone()[0]
    if att_count > 0:
        conn.close()
        return

    # Get student & subject IDs
    students = conn.execute("SELECT id FROM users WHERE role='student'").fetchall()
    subjects = conn.execute("SELECT id FROM subjects").fetchall()

    # Attendance config: (student_idx, subject_idx, present_count, total)
    att_config = [
        # Priya (id=6), DSA=92%, DBMS=74%, CN=88%, OS=95%, SE=79%
        (0, 0, 33, 36), (0, 1, 17, 23), (0, 2, 21, 24), (0, 3, 35, 37), (0, 4, 19, 24),
        # Arjun (id=7), at-risk
        (1, 0, 24, 36), (1, 1, 16, 23), (1, 2, 17, 24), (1, 3, 25, 37), (1, 4, 15, 24),
        # Rahul (id=8), good student
        (2, 0, 34, 36), (2, 1, 21, 23), (2, 2, 22, 24), (2, 3, 36, 37), (2, 4, 22, 24),
        # Sneha (id=9), critical
        (3, 0, 22, 36), (3, 1, 15, 23), (3, 2, 16, 24), (3, 3, 23, 37), (3, 4, 14, 24),
        # Karan (id=10)
        (4, 0, 28, 36), (4, 1, 17, 23), (4, 2, 19, 24), (4, 3, 29, 37), (4, 4, 17, 24),
        # Ananya (id=11), excellent
        (5, 0, 36, 36), (5, 1, 22, 23), (5, 2, 23, 24), (5, 3, 37, 37), (5, 4, 23, 24),
    ]

    rows = []
    base_date = date(2026, 7, 1)
    for (si, subj_i, present, total) in att_config:
        student_id = students[si]['id']
        subject_id = subjects[subj_i]['id']
        for day in range(total):
            d = base_date.replace(day=base_date.day + day * 3 % 28 + 1) if (base_date.day + day * 3 % 28) < 28 else date(2026, 7 + day % 3 + 1, (day * 2 % 27) + 1)
            status = 'present' if day < present else 'absent'
            rows.append((student_id, subject_id, d.isoformat(), status))

    conn.executemany("INSERT INTO attendance (student_id, subject_id, date, status) VALUES (?,?,?,?)", rows)

    # Grades
    grade_data = [
        # (student_idx, subject_idx, exam_type, marks, max_marks, semester)
        # Priya
        (0, 0, 'internal', 27, 30, 5), (0, 0, 'midsem', 42, 50, 5),
        (0, 1, 'internal', 22, 30, 5), (0, 1, 'midsem', 38, 50, 5),
        (0, 2, 'internal', 24, 30, 5), (0, 2, 'midsem', 36, 50, 5),
        (0, 3, 'internal', 29, 30, 5), (0, 3, 'midsem', 47, 50, 5),
        (0, 4, 'internal', 25, 30, 5), (0, 4, 'midsem', 42, 50, 5),
        # Arjun
        (1, 0, 'internal', 18, 30, 5), (1, 1, 'internal', 14, 30, 5),
        (1, 2, 'internal', 16, 30, 5), (1, 3, 'internal', 19, 30, 5),
        (1, 4, 'internal', 15, 30, 5),
        # Rahul
        (2, 0, 'internal', 25, 30, 5), (2, 1, 'internal', 24, 30, 5),
        (2, 2, 'internal', 22, 30, 5), (2, 3, 'internal', 26, 30, 5),
        (2, 4, 'internal', 23, 30, 5),
        # Ananya - excellent
        (5, 0, 'internal', 30, 30, 5), (5, 1, 'internal', 28, 30, 5),
        (5, 2, 'internal', 28, 30, 5), (5, 3, 'internal', 30, 30, 5),
        (5, 4, 'internal', 27, 30, 5),
    ]
    grade_rows = [(students[si]['id'], subjects[sj]['id'], etype, marks, maxm, sem)
                  for (si, sj, etype, marks, maxm, sem) in grade_data]
    conn.executemany(
        "INSERT INTO grades (student_id, subject_id, exam_type, marks, max_marks, semester) VALUES (?,?,?,?,?,?)",
        grade_rows
    )

    conn.commit()
    conn.close()
    print("[OK] Attendance and grades seeded!")


# ─────────────────────────────────────────
#  API ROUTES
# ─────────────────────────────────────────

# ---------- AUTH ----------
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    identifier = data.get('identifier', '').strip()
    password    = data.get('password', '').strip()
    if not identifier or not password:
        return jsonify({'error': 'Email/roll number and password required'}), 400
    user = query(
        "SELECT * FROM users WHERE (email=? OR roll_no=?) AND password=?",
        (identifier, identifier, hash_pw(password)), one=True
    )
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
    user.pop('password', None)
    return jsonify({'success': True, 'user': user})


@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    required = ['name', 'email', 'password']
    if not all(str(data.get(f, '')).strip() for f in required):
        return jsonify({'error': 'name, email and password are required'}), 400
    if data.get('role', 'student') != 'student':
        return jsonify({'error': 'Only student self-registration is allowed'}), 403
    if len(data['password']) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    email = data['email'].strip().lower()
    if '@' not in email:
        return jsonify({'error': 'Enter a valid email address'}), 400
    try:
        uid = execute(
            "INSERT INTO users (name, email, roll_no, password, role, department, semester, section, phone) VALUES (?,?,?,?,?,?,?,?,?)",
            (data['name'].strip(), email, data.get('roll_no'), hash_pw(data['password']),
             'student', data.get('department'), data.get('semester'),
             data.get('section'), data.get('phone'))
        )
        return jsonify({'success': True, 'user_id': uid}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Email or roll number already registered'}), 409


# ---------- STUDENTS ----------
@app.route('/api/students', methods=['GET'])
def get_students():
    dept = request.args.get('department')
    sem  = request.args.get('semester')
    sql  = "SELECT id, name, email, roll_no, department, semester, section, phone FROM users WHERE role='student'"
    args = []
    if dept: sql += " AND department=?"; args.append(dept)
    if sem:  sql += " AND semester=?";   args.append(sem)
    return jsonify(query(sql, args))


@app.route('/api/students/<int:sid>', methods=['GET'])
def get_student(sid):
    student = query("SELECT id, name, email, roll_no, department, semester, section, phone FROM users WHERE id=? AND role='student'", (sid,), one=True)
    if not student:
        return jsonify({'error': 'Student not found'}), 404
    return jsonify(student)


# ---------- SUBJECTS ----------
@app.route('/api/subjects', methods=['GET'])
def get_subjects():
    sem = request.args.get('semester', 5)
    subjects = query("""
        SELECT s.*, u.name AS faculty_name
        FROM subjects s
        LEFT JOIN users u ON s.faculty_id = u.id
        WHERE s.semester=?
    """, (sem,))
    return jsonify(subjects)


# ---------- ATTENDANCE ----------
@app.route('/api/attendance/<int:student_id>', methods=['GET'])
def get_attendance(student_id):
    rows = query("""
        SELECT s.code, s.name AS subject_name,
               COUNT(*) AS total,
               SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS present,
               SUM(CASE WHEN a.status='absent'  THEN 1 ELSE 0 END) AS absent,
               SUM(CASE WHEN a.status='late'    THEN 1 ELSE 0 END) AS late,
               ROUND(100.0 * SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) / COUNT(*), 1) AS percentage
        FROM attendance a
        JOIN subjects s ON a.subject_id = s.id
        WHERE a.student_id=?
        GROUP BY a.subject_id
    """, (student_id,))

    overall = query("""
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present,
               ROUND(100.0 * SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) / COUNT(*), 1) AS percentage
        FROM attendance WHERE student_id=?
    """, (student_id,), one=True)

    return jsonify({'subjects': rows, 'overall': overall})


@app.route('/api/attendance/log/<int:student_id>', methods=['GET'])
def get_attendance_log(student_id):
    rows = query("""
        SELECT a.date, a.status, s.name AS subject_name, s.code,
               u.name AS faculty_name
        FROM attendance a
        JOIN subjects s ON a.subject_id = s.id
        LEFT JOIN users u ON s.faculty_id = u.id
        WHERE a.student_id=?
        ORDER BY a.date DESC
        LIMIT 50
    """, (student_id,))
    return jsonify(rows)


@app.route('/api/attendance/mark', methods=['POST'])
def mark_attendance():
    data = request.get_json()
    required = ['student_id', 'subject_id', 'date', 'status']
    if not all(data.get(f) for f in required):
        return jsonify({'error': 'student_id, subject_id, date, status required'}), 400
    execute(
        "INSERT OR REPLACE INTO attendance (student_id, subject_id, date, status) VALUES (?,?,?,?)",
        (data['student_id'], data['subject_id'], data['date'], data['status'])
    )
    return jsonify({'success': True})


@app.route('/api/attendance/at-risk', methods=['GET'])
def at_risk_students():
    """Students with any subject below 75% attendance."""
    rows = query("""
        SELECT u.id, u.name, u.roll_no, u.email, s.name AS subject_name,
               ROUND(100.0 * SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) / COUNT(*), 1) AS percentage
        FROM attendance a
        JOIN users u ON a.student_id = u.id
        JOIN subjects s ON a.subject_id = s.id
        WHERE u.role='student'
        GROUP BY a.student_id, a.subject_id
        HAVING percentage < 75
        ORDER BY percentage ASC
    """)
    return jsonify(rows)


# ---------- GRADES ----------
@app.route('/api/grades/<int:student_id>', methods=['GET'])
def get_grades(student_id):
    rows = query("""
        SELECT g.exam_type, g.marks, g.max_marks, g.semester,
               s.name AS subject_name, s.code,
               ROUND(100.0 * g.marks / g.max_marks, 1) AS percentage
        FROM grades g
        JOIN subjects s ON g.subject_id = s.id
        WHERE g.student_id=?
        ORDER BY g.semester, s.name
    """, (student_id,))
    return jsonify(rows)


@app.route('/api/grades/class-summary', methods=['GET'])
def class_summary():
    """Grade distribution for faculty dashboard."""
    rows = query("""
        SELECT
            SUM(CASE WHEN (g.marks*100/g.max_marks) >= 90 THEN 1 ELSE 0 END) AS outstanding,
            SUM(CASE WHEN (g.marks*100/g.max_marks) BETWEEN 85 AND 89.9 THEN 1 ELSE 0 END) AS excellent,
            SUM(CASE WHEN (g.marks*100/g.max_marks) BETWEEN 75 AND 84.9 THEN 1 ELSE 0 END) AS very_good,
            SUM(CASE WHEN (g.marks*100/g.max_marks) BETWEEN 65 AND 74.9 THEN 1 ELSE 0 END) AS good,
            SUM(CASE WHEN (g.marks*100/g.max_marks) <  65 THEN 1 ELSE 0 END) AS average,
            COUNT(DISTINCT g.student_id) AS total_students,
            ROUND(AVG(g.marks*100/g.max_marks), 1) AS class_avg
        FROM grades g
        JOIN users u ON g.student_id = u.id
        WHERE u.role='student' AND g.semester=5
    """, one=True)
    return jsonify(rows)


# ---------- RESOURCES ----------
@app.route('/api/resources', methods=['GET'])
def get_resources():
    subject = request.args.get('subject')
    ftype   = request.args.get('type')
    search  = request.args.get('q', '')
    sql = """
        SELECT r.*, s.name AS subject_name, s.code, u.name AS faculty_name
        FROM resources r
        LEFT JOIN subjects s ON r.subject_id = s.id
        LEFT JOIN users u ON r.uploaded_by = u.id
        WHERE r.title LIKE ?
    """
    args = [f'%{search}%']
    if subject: sql += " AND s.name LIKE ?"; args.append(f'%{subject}%')
    if ftype:   sql += " AND r.file_type=?"; args.append(ftype)
    sql += " ORDER BY r.downloads DESC"
    return jsonify(query(sql, args))


@app.route('/api/resources/<int:rid>/download', methods=['POST'])
def download_resource(rid):
    execute("UPDATE resources SET downloads = downloads + 1 WHERE id=?", (rid,))
    return jsonify({'success': True})


@app.route('/api/resources', methods=['POST'])
def add_resource():
    data = request.get_json()
    uid = execute(
        "INSERT INTO resources (title, subject_id, file_type, file_size, uploaded_by, description) VALUES (?,?,?,?,?,?)",
        (data['title'], data.get('subject_id'), data.get('file_type','pdf'),
         data.get('file_size'), data.get('uploaded_by'), data.get('description'))
    )
    return jsonify({'success': True, 'id': uid}), 201


# ---------- NOTICES ----------
@app.route('/api/notices', methods=['GET'])
def get_notices():
    category = request.args.get('category')
    search   = request.args.get('q', '')
    sql = """
        SELECT n.*, u.name AS posted_by_name
        FROM notices n
        LEFT JOIN users u ON n.posted_by = u.id
        WHERE n.title LIKE ? OR n.description LIKE ?
    """
    args = [f'%{search}%', f'%{search}%']
    if category and category != 'all':
        sql += " AND n.category=?"
        args.append(category)
    sql += " ORDER BY n.created_at DESC"
    return jsonify(query(sql, args))


@app.route('/api/notices', methods=['POST'])
def post_notice():
    data = request.get_json()
    if not data.get('title') or not data.get('description'):
        return jsonify({'error': 'title and description required'}), 400
    uid = execute(
        "INSERT INTO notices (title, description, category, priority, posted_by, target_dept) VALUES (?,?,?,?,?,?)",
        (data['title'], data['description'], data.get('category','info'),
         data.get('priority','normal'), data.get('posted_by'), data.get('target_dept','all'))
    )
    execute("UPDATE notices SET views = views + 1 WHERE id=?", (uid,))
    return jsonify({'success': True, 'id': uid}), 201


@app.route('/api/notices/<int:nid>/view', methods=['POST'])
def view_notice(nid):
    execute("UPDATE notices SET views = views + 1 WHERE id=?", (nid,))
    return jsonify({'success': True})


# ---------- ASSIGNMENTS ----------
@app.route('/api/assignments', methods=['GET'])
def get_assignments():
    student_id = request.args.get('student_id')
    rows = query("""
        SELECT a.*, s.name AS subject_name,
               sub.status AS submission_status,
               sub.marks_awarded
        FROM assignments a
        LEFT JOIN subjects s ON a.subject_id = s.id
        LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id=?
        ORDER BY a.due_date ASC
    """, (student_id,))
    return jsonify(rows)


@app.route('/api/assignments/submit', methods=['POST'])
def submit_assignment():
    data = request.get_json()
    uid = execute(
        "INSERT INTO submissions (assignment_id, student_id) VALUES (?,?)",
        (data['assignment_id'], data['student_id'])
    )
    return jsonify({'success': True, 'submission_id': uid}), 201


# ---------- CHAT HISTORY ----------
@app.route('/api/chat', methods=['POST'])
def save_chat():
    data = request.get_json()
    uid = execute(
        "INSERT INTO chat_history (user_id, message, response) VALUES (?,?,?)",
        (data.get('user_id'), data['message'], data['response'])
    )
    return jsonify({'success': True, 'id': uid}), 201


@app.route('/api/chat/<int:user_id>', methods=['GET', 'DELETE'])
def get_chat_history(user_id):
    if request.method == 'DELETE':
        execute("DELETE FROM chat_history WHERE user_id=?", (user_id,))
        return jsonify({'success': True})
    rows = query(
        "SELECT * FROM chat_history WHERE user_id=? ORDER BY created_at DESC LIMIT 50",
        (user_id,)
    )
    return jsonify(rows)


# ---------- DASHBOARD SUMMARY ----------
@app.route('/api/dashboard/<int:student_id>', methods=['GET'])
def get_dashboard(student_id):
    student = query("SELECT id, name, email, roll_no, department, semester FROM users WHERE id=?", (student_id,), one=True)
    if not student:
        return jsonify({'error': 'Student not found'}), 404

    att = query("""
        SELECT ROUND(100.0 * SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) / COUNT(*), 1) AS overall_pct,
               COUNT(*) AS total, SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present
        FROM attendance WHERE student_id=?
    """, (student_id,), one=True)

    grades = query("""
        SELECT ROUND(AVG(marks*10/max_marks), 2) AS cgpa
        FROM grades WHERE student_id=?
    """, (student_id,), one=True)

    pending_assignments = query("""
        SELECT COUNT(*) AS cnt FROM assignments a
        WHERE date(a.due_date) >= date('now')
        AND a.id NOT IN (SELECT assignment_id FROM submissions WHERE student_id=?)
    """, (student_id,), one=True)

    notices = query("SELECT COUNT(*) AS cnt FROM notices WHERE date(created_at) >= date('now', '-7 days')", one=True)

    at_risk = query("""
        SELECT s.name AS subject_name,
               ROUND(100.0 * SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct
        FROM attendance a JOIN subjects s ON a.subject_id=s.id
        WHERE a.student_id=? GROUP BY a.subject_id HAVING pct < 75
    """, (student_id,))

    return jsonify({
        'student': student,
        'attendance': att,
        'cgpa': grades.get('cgpa') or 0,
        'pending_assignments': pending_assignments.get('cnt', 0),
        'new_notices': notices.get('cnt', 0),
        'at_risk_subjects': at_risk
    })


# ---------- FACULTY DASHBOARD ----------
@app.route('/api/faculty/dashboard/<int:faculty_id>', methods=['GET'])
def faculty_dashboard(faculty_id):
    subjects = query("SELECT id, name, code FROM subjects WHERE faculty_id=?", (faculty_id,))

    student_count = query("SELECT COUNT(*) AS cnt FROM users WHERE role='student' AND semester=5", one=True)

    avg_cgpa = query("""
        SELECT ROUND(AVG(marks*10/max_marks), 2) AS avg FROM grades g
        JOIN users u ON g.student_id=u.id WHERE u.role='student' AND g.semester=5
    """, one=True)

    class_att = query("""
        SELECT ROUND(100.0 * SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct
        FROM attendance a
        JOIN subjects s ON a.subject_id=s.id
        WHERE s.faculty_id=?
    """, (faculty_id,), one=True)

    at_risk = query("""
        SELECT u.id, u.name, u.roll_no, s.name AS subject_name,
               ROUND(100.0 * SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) / COUNT(*), 1) AS attendance_pct,
               (SELECT ROUND(AVG(g.marks*10/g.max_marks),2) FROM grades g WHERE g.student_id=u.id) AS cgpa
        FROM attendance a
        JOIN users u ON a.student_id=u.id
        JOIN subjects s ON a.subject_id=s.id
        WHERE s.faculty_id=? AND u.role='student'
        GROUP BY a.student_id, a.subject_id
        HAVING attendance_pct < 75
        ORDER BY attendance_pct ASC
    """, (faculty_id,))

    return jsonify({
        'subjects': subjects,
        'total_students': student_count.get('cnt', 0),
        'avg_cgpa': avg_cgpa.get('avg') or 0,
        'class_attendance': class_att.get('pct') or 0,
        'at_risk': at_risk
    })


# ---------- STATS ----------
@app.route('/api/stats', methods=['GET'])
def get_stats():
    return jsonify({
        'total_students': query("SELECT COUNT(*) AS c FROM users WHERE role='student'", one=True)['c'],
        'total_faculty':  query("SELECT COUNT(*) AS c FROM users WHERE role='faculty'", one=True)['c'],
        'total_resources':query("SELECT COUNT(*) AS c FROM resources", one=True)['c'],
        'total_notices':  query("SELECT COUNT(*) AS c FROM notices", one=True)['c'],
        'total_subjects': query("SELECT COUNT(*) AS c FROM subjects", one=True)['c'],
    })


# ---------- HEALTH CHECK ----------
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'db': DB_PATH, 'time': datetime.now().isoformat()})


# ---------- BOOKS / LIBRARY ----------
@app.route('/api/books', methods=['GET'])
def get_books():
    category = request.args.get('category')
    search   = request.args.get('q', '')
    available= request.args.get('available')
    sql = """
        SELECT b.*, s.name AS subject_name
        FROM books b
        LEFT JOIN subjects s ON b.subject_id = s.id
        WHERE (b.title LIKE ? OR b.author LIKE ? OR b.category LIKE ?)
    """
    args = [f'%{search}%', f'%{search}%', f'%{search}%']
    if category and category != 'all':
        sql += " AND b.category=?"; args.append(category)
    if available == '1':
        sql += " AND b.available > 0"
    sql += " ORDER BY b.rating DESC"
    return jsonify(query(sql, args))

@app.route('/api/books/<int:book_id>', methods=['GET'])
def get_book(book_id):
    book = query("SELECT b.*, s.name AS subject_name FROM books b LEFT JOIN subjects s ON b.subject_id=s.id WHERE b.id=?", (book_id,), one=True)
    if not book: return jsonify({'error': 'Book not found'}), 404
    return jsonify(book)

@app.route('/api/books/borrow', methods=['POST'])
def borrow_book():
    data = request.get_json()
    student_id = data.get('student_id')
    book_id    = data.get('book_id')
    book = query("SELECT available FROM books WHERE id=?", (book_id,), one=True)
    if not book: return jsonify({'error': 'Book not found'}), 404
    if book['available'] <= 0: return jsonify({'error': 'No copies available'}), 400
    from datetime import timedelta
    due = (datetime.now() + timedelta(days=14)).strftime('%Y-%m-%d')
    uid = execute("INSERT INTO library_transactions (student_id, book_id, due_date) VALUES (?,?,?)", (student_id, book_id, due))
    execute("UPDATE books SET available = available - 1 WHERE id=?", (book_id,))
    return jsonify({'success': True, 'transaction_id': uid, 'due_date': due}), 201

@app.route('/api/books/return', methods=['POST'])
def return_book():
    data = request.get_json()
    txn_id = data.get('transaction_id')
    execute("UPDATE library_transactions SET returned_at=datetime('now'), status='returned' WHERE id=?", (txn_id,))
    execute("UPDATE books SET available = available + 1 WHERE id=(SELECT book_id FROM library_transactions WHERE id=?)", (txn_id,))
    return jsonify({'success': True})

@app.route('/api/library/my/<int:student_id>', methods=['GET'])
def my_borrowed_books(student_id):
    rows = query("""
        SELECT lt.*, b.title, b.author, b.cover_color, b.category
        FROM library_transactions lt
        JOIN books b ON lt.book_id = b.id
        WHERE lt.student_id=? AND lt.status != 'returned'
        ORDER BY lt.due_date ASC
    """, (student_id,))
    return jsonify(rows)

@app.route('/api/library/stats', methods=['GET'])
def library_stats():
    return jsonify({
        'total_books': query("SELECT COUNT(*) AS c FROM books", one=True)['c'],
        'total_copies': query("SELECT SUM(total_copies) AS c FROM books", one=True)['c'],
        'available_now': query("SELECT SUM(available) AS c FROM books", one=True)['c'],
        'currently_borrowed': query("SELECT COUNT(*) AS c FROM library_transactions WHERE status='borrowed'", one=True)['c'],
        'overdue': query("SELECT COUNT(*) AS c FROM library_transactions WHERE status='overdue'", one=True)['c'],
        'categories': query("SELECT category, COUNT(*) AS cnt FROM books GROUP BY category ORDER BY cnt DESC", []),
    })

# ---------- EVENTS ----------
@app.route('/api/events', methods=['GET'])
def get_events():
    category = request.args.get('category')
    sql = "SELECT * FROM events WHERE date(event_date) >= date('now','- 1 day')"
    args = []
    if category and category != 'all':
        sql += " AND category=?"; args.append(category)
    sql += " ORDER BY event_date ASC"
    return jsonify(query(sql, args))

@app.route('/api/events/<int:eid>/register', methods=['POST'])
def register_event(eid):
    execute("UPDATE events SET registered = registered + 1 WHERE id=? AND registered < max_seats", (eid,))
    return jsonify({'success': True})

# ---------- STUDY GROUPS ----------
@app.route('/api/groups', methods=['GET'])
def get_study_groups():
    student_id = request.args.get('student_id')
    rows = query("""
        SELECT sg.*, s.name AS subject_name, u.name AS leader_name,
               COUNT(sgm.student_id) AS member_count,
               sg.max_members - COUNT(sgm.student_id) AS open_slots
        FROM study_groups sg
        LEFT JOIN subjects s ON sg.subject_id = s.id
        LEFT JOIN users u ON sg.leader_id = u.id
        LEFT JOIN study_group_members sgm ON sg.id = sgm.group_id
        GROUP BY sg.id
        ORDER BY member_count DESC
    """)
    if student_id:
        my_ids = {r['group_id'] for r in query("SELECT group_id FROM study_group_members WHERE student_id=?", (student_id,))}
        for r in rows: r['is_member'] = r['id'] in my_ids
    return jsonify(rows)

@app.route('/api/groups/join', methods=['POST'])
def join_group():
    data = request.get_json()
    try:
        execute("INSERT OR IGNORE INTO study_group_members (group_id, student_id) VALUES (?,?)",
                (data['group_id'], data['student_id']))
        return jsonify({'success': True})
    except: return jsonify({'error': 'Could not join group'}), 400

# ---------- QUICK NOTES ----------
@app.route('/api/notes/<int:student_id>', methods=['GET'])
def get_notes(student_id):
    return jsonify(query("SELECT * FROM quick_notes WHERE student_id=? ORDER BY updated_at DESC", (student_id,)))

@app.route('/api/notes', methods=['POST'])
def add_note():
    data = request.get_json()
    uid = execute("INSERT INTO quick_notes (student_id, title, content, color) VALUES (?,?,?,?)",
                  (data['student_id'], data['title'], data.get('content',''), data.get('color','#6366f1')))
    return jsonify({'success': True, 'id': uid}), 201

@app.route('/api/notes/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    execute("DELETE FROM quick_notes WHERE id=?", (note_id,))
    return jsonify({'success': True})

# ---------- LEADERBOARD ----------
@app.route('/api/leaderboard', methods=['GET'])
def leaderboard():
    rows = query("""
        SELECT u.id, u.name, u.roll_no, u.section,
               ROUND(AVG(g.marks*10.0/g.max_marks), 2) AS cgpa,
               ROUND(100.0 * SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) / COUNT(DISTINCT a.id), 1) AS attendance
        FROM users u
        LEFT JOIN grades g ON g.student_id = u.id
        LEFT JOIN attendance a ON a.student_id = u.id
        WHERE u.role = 'student'
        GROUP BY u.id
        ORDER BY cgpa DESC
        LIMIT 10
    """)
    for i, r in enumerate(rows): r['rank'] = i + 1
    return jsonify(rows)

# ─────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────
if __name__ == '__main__':
    print("=" * 50)
    print("  SmartEdu Backend - Flask + SQLite")
    print("=" * 50)
    init_db()
    print("[INFO] API running at: http://localhost:5000")
    print("[INFO] Open frontend: http://localhost:8080")
    print("[INFO] Database file: smartedu.db")
    print("=" * 50)
    print("\nAPI Endpoints:")
    print("  POST /api/login")
    print("  POST /api/register")
    print("  GET  /api/dashboard/<student_id>")
    print("  GET  /api/attendance/<student_id>")
    print("  GET  /api/grades/<student_id>")
    print("  GET  /api/resources")
    print("  GET  /api/notices")
    print("  GET  /api/assignments?student_id=<id>")
    print("  GET  /api/attendance/at-risk")
    print("  GET  /api/stats")
    print("=" * 50)
    app.run(debug=True, port=5000, host='0.0.0.0')
