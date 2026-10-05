import "server-only";

import { getDb, isEmpty, run, tx } from "./db";
import { hashPassword, randomToken } from "./password";
import { DEFAULT_SETTINGS } from "@/lib/settings";

/**
 * Demonstration dataset.
 *
 * Every person, phone number, ID and number plate below is invented. Nothing
 * here is real personal data, and the accounts exist so the system can be
 * walked through end to end on a fresh install.
 *
 * Seeding runs once, only into an empty database, inside a single transaction.
 */

const YEAR = new Date().getFullYear();

const day = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
};

const at = (dayOffset: number, hour: number, minute = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const ref = (serial: number): string => `DSVV-VIS-${YEAR}-${`${serial}`.padStart(6, "0")}`;

/* ------------------------------------------------------------------ *
 * Reference data
 * ------------------------------------------------------------------ */

/**
 * Official DSVV academic departments.
 *
 * Source: https://www.dsvv.ac.in/ (academic structure published on the
 * official DSVV website). Organised by School → Faculty → Department.
 *
 * Format: [id, name, code, head, location, phone, email]
 *
 * Administrative departments are appended after the academic ones so that
 * existing bookings (which reference DEPT-003 = Administration etc.) continue
 * to resolve correctly.
 */
const DEPARTMENTS = [
  // ── School of Indology ────────────────────────────────────────────────
  // Faculty of Yoga and Health
  ["DEPT-001", "Department of Yogic Science and Human Consciousness", "YOGA", "Dr. Narendra Pratap Singh", "Yoga Block", "9810012001", "yoga@dsvv.ac.in"],
  ["DEPT-002", "Department of Ayurved and Holistic Health", "AYUR", "Dr. Amrit Lal Guruvendra", "Health Sciences Block", "9810012002", "ayurveda@dsvv.ac.in"],
  ["DEPT-003", "Department of Complementary and Alternative Medicine", "CAM", "", "Health Sciences Block", "9810012003", "cam@dsvv.ac.in"],
  // Faculty of Indian Languages
  ["DEPT-004", "Department of Vedic Studies and Sanskrit", "VED", "Prof. Emeritus Radheshyam Chaturvedi", "Indology Block", "9810012004", "vedic@dsvv.ac.in"],
  ["DEPT-005", "Department of Hindi", "HIN", "Prof. Sukhnandan Singh", "Indology Block", "9810012005", "hindi@dsvv.ac.in"],
  // Faculty of Music and Indian Culture
  ["DEPT-006", "Department of Indian Classical Music", "MUS", "", "Arts Block", "9810012006", "music@dsvv.ac.in"],
  ["DEPT-007", "Department of History and Indian Culture", "HIC", "", "Humanities Block", "9810012007", "history@dsvv.ac.in"],

  // ── School of Humanities, Social Sciences and Human Values ────────────
  // Faculty of Humanities and Social Sciences
  ["DEPT-008", "Department of English", "ENG", "", "Humanities Block", "9810012008", "english@dsvv.ac.in"],
  ["DEPT-009", "Department of Psychology", "PSY", "Dr. Mamta Arora", "Humanities Block", "9810012009", "psychology@dsvv.ac.in"],
  // Faculty of Human Values
  ["DEPT-010", "Department of Education", "EDU", "Dr. Rajeshwari Trivedi", "Education Block", "9810012010", "education@dsvv.ac.in"],
  ["DEPT-011", "Department of Life Management", "LMG", "", "Humanities Block", "9810012011", "lifemgmt@dsvv.ac.in"],
  ["DEPT-012", "Department of Scientific Spirituality", "SSP", "", "Humanities Block", "9810012012", "scisp@dsvv.ac.in"],
  ["DEPT-013", "Department of Oriental Studies, Religious Studies and Philosophy", "ORS", "", "Indology Block", "9810012013", "orstud@dsvv.ac.in"],

  // ── School of Technology, Communication and Management ───────────────
  // Faculty of Technology and Management
  ["DEPT-014", "Department of Computer Sciences", "CS", "Dr. Piyush Trivedi", "Technology Block", "9810012014", "cs@dsvv.ac.in"],
  ["DEPT-015", "Department of Mathematics", "MATH", "", "Science Block", "9810012015", "maths@dsvv.ac.in"],
  ["DEPT-016", "Department of Tourism Management", "TRM", "Dr. Arunesh Parashar", "Management Block", "9810012016", "tourism@dsvv.ac.in"],
  // Faculty of Communication
  ["DEPT-017", "Department of Journalism and Mass Communication", "JMC", "Dr. Artee Verma", "Media Block", "9810012017", "jmc@dsvv.ac.in"],
  ["DEPT-018", "Department of Animation and Visual Effects", "AVE", "", "Media Block", "9810012018", "animation@dsvv.ac.in"],

  // ── School of Biological Sciences and Sustainability ──────────────────
  // Faculty of Biological Sciences
  ["DEPT-019", "Department of Medicinal and Aromatic Plants Sciences", "MAP", "", "Biological Sciences Block", "9810012019", "maps@dsvv.ac.in"],
  ["DEPT-020", "Department of Environmental Science", "ENV", "", "Biological Sciences Block", "9810012020", "env@dsvv.ac.in"],
  // Faculty of Rural Studies and Sustainability
  ["DEPT-021", "Department of Rural Studies and Sustainability", "RSS", "", "Rural Studies Block", "9810012021", "rss@dsvv.ac.in"],

  // ── Administrative offices (for non-academic visitor bookings) ────────
  ["DEPT-022", "Administration Office", "ADM", "", "Admin Block · Ground Floor", "9810012022", "admin@dsvv.ac.in"],
  ["DEPT-023", "Admissions Office", "ADS", "", "Admin Block · Ground Floor", "9810012023", "admissions@dsvv.ac.in"],
  ["DEPT-024", "Central Library", "LIB", "", "Central Library Building", "9810012024", "library@dsvv.ac.in"],
  ["DEPT-025", "Student Affairs", "SA", "", "Student Centre", "9810012025", "studentaffairs@dsvv.ac.in"],
  ["DEPT-026", "Finance Office", "FIN", "", "Admin Block · 1st Floor", "9810012026", "finance@dsvv.ac.in"],
] as const;

/**
 * Faculty directory — official DSVV academic and administrative staff.
 *
 * Names sourced from: https://www.dsvv.ac.in/ (academic leadership and
 * department pages). Only names confirmed from the official DSVV website
 * are used here. Designations are as published.
 *
 * Format: [id, employeeId, name, email, phone, deptId, designation, room, availabilityStatus]
 *
 * Email and phone are internal — not exposed to the public booking form
 * (see publicDirectory() in snapshot.ts).
 */
const TEACHERS = [
  // Dept of Yogic Science and Human Consciousness (DEPT-001)
  ["TCH-001", "EMP-1001", "Dr. Narendra Pratap Singh", "np.singh@dsvv.ac.in", "9810012301", "DEPT-001", "Head of Department", "Yoga Block · 101", "Available"],
  ["TCH-002", "EMP-1002", "Prof. Hemadri Sao", "hemadri.sao@dsvv.ac.in", "9810012302", "DEPT-001", "Professor", "Yoga Block · 102", "Available"],
  // Dept of Ayurved and Holistic Health (DEPT-002)
  ["TCH-003", "EMP-1003", "Dr. Amrit Lal Guruvendra", "amritlal.guruvendra@dsvv.ac.in", "9810012303", "DEPT-002", "Head of Department", "Health Sciences Block · 201", "Available"],
  // Dept of Vedic Studies and Sanskrit (DEPT-004)
  ["TCH-004", "EMP-1004", "Prof. Emeritus Radheshyam Chaturvedi", "rs.chaturvedi@dsvv.ac.in", "9810012304", "DEPT-004", "Professor Emeritus", "Indology Block · 301", "Available"],
  // Dept of Hindi (DEPT-005)
  ["TCH-005", "EMP-1005", "Prof. Sukhnandan Singh", "sukhnandan.singh@dsvv.ac.in", "9810012305", "DEPT-005", "Head of Department", "Indology Block · 302", "Available"],
  // Dept of Psychology (DEPT-009)
  ["TCH-006", "EMP-1006", "Dr. Mamta Arora", "mamta.arora@dsvv.ac.in", "9810012306", "DEPT-009", "Head of Department", "Humanities Block · 401", "Available"],
  ["TCH-007", "EMP-1007", "Dr. Shivnarayan Prasad", "shivnarayan.prasad@dsvv.ac.in", "9810012307", "DEPT-009", "Assistant Professor", "Humanities Block · 402", "Available"],
  // Dept of Education (DEPT-010)
  ["TCH-008", "EMP-1008", "Dr. Rajeshwari Trivedi", "rajeshwari.trivedi@dsvv.ac.in", "9810012308", "DEPT-010", "Head of Department", "Education Block · 101", "Available"],
  ["TCH-009", "EMP-1009", "Dr. Vandana Shrivastava", "vandana.shrivastava@dsvv.ac.in", "9810012309", "DEPT-010", "Associate Professor", "Education Block · 102", "Busy"],
  // Dept of Computer Sciences (DEPT-014)
  ["TCH-010", "EMP-1010", "Dr. Piyush Trivedi", "piyush.trivedi@dsvv.ac.in", "9810012310", "DEPT-014", "Head of Department", "Technology Block · 201", "Available"],
  ["TCH-011", "EMP-1011", "Dr. Pankaj Saini", "pankaj.saini@dsvv.ac.in", "9810012311", "DEPT-014", "Assistant Professor", "Technology Block · 202", "Available"],
  // Dept of Tourism Management (DEPT-016)
  ["TCH-012", "EMP-1012", "Dr. Arunesh Parashar", "arunesh.parashar@dsvv.ac.in", "9810012312", "DEPT-016", "Head of Department", "Management Block · 101", "Available"],
  // Dept of Journalism and Mass Communication (DEPT-017)
  ["TCH-013", "EMP-1013", "Dr. Artee Verma", "artee.verma@dsvv.ac.in", "9810012313", "DEPT-017", "Head of Department", "Media Block · 101", "Available"],
  // Senior academic leadership (meet at Admin block)
  ["TCH-014", "EMP-1014", "Prof. Suresh Lal Barnwal", "sl.barnwal@dsvv.ac.in", "9810012314", "DEPT-022", "Dean", "Admin Block · 201", "Available"],
  ["TCH-015", "EMP-1015", "Prof. Abhay Saxena", "abhay.saxena@dsvv.ac.in", "9810012315", "DEPT-022", "Professor", "Admin Block · 202", "Available"],
  ["TCH-016", "EMP-1016", "Prof. Emeritus K. S. Tyagi", "ks.tyagi@dsvv.ac.in", "9810012316", "DEPT-022", "Professor Emeritus", "Admin Block · 203", "Available"],
  ["TCH-017", "EMP-1017", "Prof. Emeritus Karan Singh", "karan.singh@dsvv.ac.in", "9810012317", "DEPT-022", "Professor Emeritus", "Admin Block · 204", "Available"],
  ["TCH-018", "EMP-1018", "Ms. Kaveri Bali", "kaveri.bali@dsvv.ac.in", "9810012318", "DEPT-023", "Admissions Officer", "Admissions Block · 001", "Available"],
] as const;

const GUARDS = [
  ["GRD-001", "SEC-2001", "Amit Kumar", "9820011001", "amit.kumar@dsvv.edu.in", "Morning", "06:00", "14:00", "Main Gate", "On Duty", "2021-04-12", "9820099001", "Shivalik Nagar, Haridwar"],
  ["GRD-002", "SEC-2002", "Sunil Thapa", "9820011002", "sunil.thapa@dsvv.edu.in", "Evening", "14:00", "22:00", "Main Gate", "Active", "2020-08-03", "9820099002", "Jwalapur, Haridwar"],
  ["GRD-003", "SEC-2003", "Rajesh Bisht", "9820011003", "rajesh.bisht@dsvv.edu.in", "Night", "22:00", "06:00", "Service Gate", "Off Duty", "2019-11-25", "9820099003", "Bahadrabad, Haridwar"],
  ["GRD-004", "SEC-2004", "Pooja Rawat", "9820011004", "pooja.rawat@dsvv.edu.in", "Morning", "06:00", "14:00", "Hostel Gate", "On Duty", "2022-01-17", "9820099004", "Kankhal, Haridwar"],
  ["GRD-005", "SEC-2005", "Mahesh Chauhan", "9820011005", "mahesh.chauhan@dsvv.edu.in", "General", "09:00", "18:00", "Sports Gate", "Active", "2018-06-09", "9820099005", "Ranipur, Haridwar"],
  ["GRD-006", "SEC-2006", "Neha Bhandari", "9820011006", "neha.bhandari@dsvv.edu.in", "Evening", "14:00", "22:00", "Hostel Gate", "On Leave", "2023-03-21", "9820099006", "Roorkee Road, Haridwar"],
] as const;

const STUDENTS = [
  ["STU-2026-001", "Aarav Mehta", "DSVV/CS/2026/001", "DEPT-001", "2nd Year", "Ganga Hostel", "G-114", "Rakesh Mehta", "9899001001", 1],
  ["STU-2026-002", "Ishita Verma", "DSVV/MGT/2026/014", "DEPT-002", "1st Year", "Yamuna Hostel", "Y-207", "Sanjay Verma", "9899001002", 1],
  ["STU-2026-003", "Kabir Singh", "DSVV/ENG/2026/032", "DEPT-008", "3rd Year", "Ganga Hostel", "G-302", "Harpreet Singh", "9899001003", 0],
  ["STU-2026-004", "Ananya Rao", "DSVV/CS/2026/045", "DEPT-001", "2nd Year", "Saraswati Hostel", "S-118", "Prakash Rao", "9899001004", 1],
  ["STU-2026-005", "Rohan Gupta", "DSVV/RES/2026/007", "DEPT-006", "4th Year", "Ganga Hostel", "G-401", "Manoj Gupta", "9899001005", 1],
  ["STU-2026-006", "Tara Nair", "DSVV/WEL/2026/019", "DEPT-009", "1st Year", "Yamuna Hostel", "Y-102", "Suresh Nair", "9899001006", 1],
] as const;

const LOCATIONS = [
  ["LOC-001", "Main Gate", "Gate"],
  ["LOC-002", "Service Gate", "Gate"],
  ["LOC-003", "Sports Gate", "Gate"],
  ["LOC-004", "Hostel Gate", "Gate"],
  ["LOC-005", "Admin Block", "Block"],
  ["LOC-006", "Central Library", "Facility"],
  ["LOC-007", "Science Block", "Block"],
  ["LOC-008", "Sports Complex", "Facility"],
  ["LOC-009", "Ganga Hostel", "Hostel"],
  ["LOC-010", "Yamuna Hostel", "Hostel"],
  ["LOC-011", "Saraswati Hostel", "Hostel"],
  ["LOC-012", "Auditorium", "Facility"],
  ["LOC-013", "Parking Area", "Facility"],
  ["LOC-014", "Canteen", "Facility"],
  ["LOC-015", "Health Centre", "Facility"],
  ["LOC-016", "Research Centre", "Block"],
] as const;

const VISITORS = [
  ["VSTR-0001", "Rahul Sharma", "9876500001", "rahul.sharma@example.com", "Male", "Aadhaar Card", "4821 7734 9901", "Sharma Technologies", "12 Ganga Vihar, Haridwar", "9876590001", "Parent/Guardian", 4],
  ["VSTR-0002", "Priya Nambiar", "9876500002", "priya.nambiar@example.com", "Female", "Driving Licence", "UK07 20190001234", "Nambiar Consulting", "44 Rishikesh Road, Dehradun", "9876590002", "Official", 2],
  ["VSTR-0003", "Imran Qureshi", "9876500003", "imran.qureshi@example.com", "Male", "PAN Card", "AXQPQ1234K", "Skyline Interiors", "9 Mall Road, Mussoorie", "9876590003", "Vendor", 6],
  ["VSTR-0004", "Sneha Kulkarni", "9876500004", "sneha.kulkarni@example.com", "Female", "Aadhaar Card", "7712 4409 8823", "—", "88 Sector 4, Noida", "9876590004", "Alumni", 1],
  ["VSTR-0005", "Vikram Desai", "9876500005", "vikram.desai@example.com", "Male", "Passport", "M4429871", "Desai Exports", "23 Park Street, Kolkata", "9876590005", "Guest", 3],
  ["VSTR-0006", "Ritu Aggarwal", "9876500006", "ritu.aggarwal@example.com", "Female", "Voter ID", "UKD2938471", "—", "17 Civil Lines, Roorkee", "9876590006", "Parent/Guardian", 5],
  ["VSTR-0007", "Sandeep Yadav", "9876500007", "sandeep.yadav@example.com", "Male", "Aadhaar Card", "5590 2213 7745", "Yadav Logistics", "3 Transport Nagar, Haridwar", "9876590007", "Vendor", 8],
  ["VSTR-0008", "Fatima Sheikh", "9876500008", "fatima.sheikh@example.com", "Female", "Employee ID", "NHRC-4471", "National Research Council", "5 Lodhi Estate, New Delhi", "9876590008", "Official", 2],
  ["VSTR-0009", "Arjun Pillai", "9876500009", "arjun.pillai@example.com", "Male", "Aadhaar Card", "3321 9987 0012", "—", "61 Marine Drive, Kochi", "9876590009", "Interview Candidate", 1],
  ["VSTR-0010", "Deepa Chauhan", "9876500010", "deepa.chauhan@example.com", "Female", "Driving Licence", "UK08 20170004521", "Chauhan Caterers", "30 Jwalapur, Haridwar", "9876590010", "Vendor", 7],
  ["VSTR-0011", "Nitin Malhotra", "9876500011", "nitin.malhotra@example.com", "Male", "PAN Card", "BKLPM8821J", "Malhotra Press", "12 Press Colony, Meerut", "9876590011", "Guest", 2],
  ["VSTR-0012", "Kavya Iyer", "9876500012", "kavya.iyer@example.com", "Female", "Aadhaar Card", "8834 1120 5567", "—", "77 Anna Nagar, Chennai", "9876590012", "Parent/Guardian", 3],
] as const;

/**
 * Bookings across the lifecycle: completed visits behind us, people on campus
 * right now, decisions waiting on an administrator, and a few closed outcomes.
 * `[serial, visitorIndex, hostIndex, purpose, dayOffset, time, status, party, vehicle]`
 */
const BOOKINGS: [number, number, number, string, number, string, string, number, string | null][] = [
  [1, 0, 0, "Parent Visit", -6, "10:00", "Checked Out", 2, "UK07AB1234"],
  [2, 1, 4, "Official Work", -6, "11:30", "Checked Out", 1, null],
  [3, 2, 9, "Delivery", -5, "09:30", "Checked Out", 2, "UK08CD5678"],
  [4, 3, 5, "Administrative Work", -5, "14:00", "Checked Out", 1, null],
  [5, 4, 1, "Teacher Meeting", -4, "11:00", "Checked Out", 1, null],
  [6, 5, 7, "Parent Visit", -4, "15:30", "Checked Out", 3, "DL1CAB9090"],
  [7, 6, 9, "Delivery", -3, "08:30", "Checked Out", 2, "UK07EF2211"],
  [8, 7, 5, "Official Work", -3, "12:00", "No Show", 2, null],
  [9, 8, 3, "Admission Inquiry", -2, "10:30", "Checked Out", 1, null],
  [10, 9, 9, "Delivery", -2, "16:00", "Checked Out", 1, "UK07GH7788"],
  [11, 10, 2, "Official Work", -1, "11:00", "Checked Out", 2, null],
  [12, 11, 0, "Parent Visit", -1, "14:30", "Rejected", 2, null],
  [13, 0, 0, "Teacher Meeting", 0, "09:30", "Checked Out", 1, null],
  [14, 2, 9, "Delivery", 0, "10:00", "Checked In", 2, "UK08CD5678"],
  [15, 5, 7, "Student Meeting", 0, "11:00", "Meeting In Progress", 1, null],
  [16, 6, 4, "Administrative Work", 0, "12:30", "Approved", 1, "UK07EF2211"],
  [17, 9, 5, "Official Work", 0, "15:00", "Approved", 3, null],
  [18, 11, 10, "Teacher Meeting", 0, "16:00", "Pending", 1, null],
  [19, 3, 3, "Admission Inquiry", 1, "10:00", "Approved", 2, null],
  [20, 4, 11, "Teacher Meeting", 1, "11:30", "Pending", 1, null],
  [21, 7, 2, "Official Work", 1, "14:00", "Pending", 2, null],
  [22, 8, 3, "Admission Inquiry", 2, "09:30", "Approved", 1, null],
  [23, 1, 4, "Official Work", 2, "11:00", "Pending", 1, "DL1CAB9090"],
  [24, 10, 5, "Event", 3, "10:30", "Pending", 4, null],
  [25, 6, 6, "Teacher Meeting", 3, "14:30", "Cancelled", 1, null],
  [26, 0, 1, "Teacher Meeting", 4, "11:00", "Pending", 2, null],
];

const INCIDENTS = [
  ["INC-0001", "Suspicious Activity", "Unidentified person near hostel fence", "Ganga Hostel", -5, "23:10", "Medium", "A person was seen loitering along the rear fence. Patrol dispersed and no entry was attempted.", "GRD-003", "Rajesh Bisht", "Resolved", "Patrol increased on the rear perimeter for the rest of the night."],
  ["INC-0002", "Vehicle Incident", "Minor scrape in visitor parking", "Parking Area", -4, "13:40", "Low", "Two parked vehicles made contact while reversing. Both owners exchanged details on site.", "GRD-005", "Mahesh Chauhan", "Closed", "Owners settled privately. No campus property affected."],
  ["INC-0003", "Lost Property", "Laptop bag left in the library", "Central Library", -2, "17:20", "Low", "A black laptop bag was handed in at the desk and moved to lost property.", "GRD-001", "Amit Kumar", "Resolved", "Returned to the owner against ID on the following day."],
  ["INC-0004", "Unauthorised Entry", "Tailgating attempt at Service Gate", "Service Gate", -1, "19:05", "High", "A vehicle attempted to follow an authorised delivery through the barrier. Entry was refused.", "GRD-002", "Sunil Thapa", "Investigating", null],
  ["INC-0005", "Medical Emergency", "Student fainted during assembly", "Auditorium", 0, "09:50", "High", "A student lost consciousness briefly and was walked to the Health Centre by staff.", "GRD-004", "Pooja Rawat", "Open", null],
  ["INC-0006", "Student Safety", "Damaged handrail on hostel stairwell", "Yamuna Hostel", 0, "11:15", "Medium", "The second-floor stairwell handrail is loose and has been cordoned off pending repair.", "GRD-004", "Pooja Rawat", "Open", null],
] as const;

/* ------------------------------------------------------------------ *
 * Seeding
 * ------------------------------------------------------------------ */

export function seedIfEmpty(): boolean {
  if (!isEmpty()) return false;
  seed();
  return true;
}

export function seed(): void {
  tx(() => {
    const stamp = at(-30, 9);

    for (const [id, name, code, head, location, phone, email] of DEPARTMENTS) {
      run(
        "INSERT INTO departments(id, name, code, head, location, phone, email, active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)",
        [id, name, code, head, location, phone, email, stamp, stamp],
      );
    }

    for (const [id, empId, name, email, phone, deptId, designation, room, status] of TEACHERS) {
      run(
        `INSERT INTO teachers(id, employee_id, name, email, phone, department_id, designation, room,
                              availability_status, active, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,1,?,?)`,
        [id, empId, name, email, phone, deptId, designation, room, status, stamp, stamp],
      );
      run(
        "INSERT INTO teacher_availability(teacher_id, days, start_time, end_time, slot_minutes, blocked, updated_at) VALUES (?,?,?,?,?,?,?)",
        [id, "[1,2,3,4,5,6]", "09:00", "17:00", 30, "[]", stamp],
      );
    }

    for (const [
      id,
      empId,
      name,
      phone,
      email,
      shift,
      shiftStart,
      shiftEnd,
      gate,
      status,
      joined,
      emergency,
      address,
    ] of GUARDS) {
      run(
        `INSERT INTO security_guards(id, employee_id, full_name, phone, email, shift, shift_start, shift_end,
                                     assigned_gate, status, joining_date, emergency_contact, address,
                                     created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, empId, name, phone, email, shift, shiftStart, shiftEnd, gate, status, joined, emergency, address, stamp, stamp],
      );
    }

    for (const [id, name, roll, deptId, year, hostel, room, guardian, guardianPhone, onCampus] of STUDENTS) {
      run(
        `INSERT INTO students(id, name, roll_no, department_id, year, hostel, room, guardian_name, guardian_phone, on_campus)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [id, name, roll, deptId, year, hostel, room, guardian, guardianPhone, onCampus],
      );
    }

    for (const [id, name, kind] of LOCATIONS) {
      run("INSERT INTO campus_locations(id, name, kind, active) VALUES (?,?,?,1)", [id, name, kind]);
    }

    for (const [
      id,
      name,
      mobile,
      email,
      gender,
      idType,
      idNumber,
      organization,
      address,
      emergency,
      type,
      visits,
    ] of VISITORS) {
      run(
        `INSERT INTO visitors(id, full_name, mobile, email, gender, id_type, id_number, organization,
                              address, emergency_contact, whatsapp_country_code, whatsapp_number,
                              visitor_type, total_visits, blacklisted, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,'+91',?,?,?,0,?,?)`,
        // Demo visitors reach WhatsApp on the same number they gave as their mobile.
        [id, name, mobile, email, gender, idType, idNumber, organization, address, emergency, mobile, type, visits, stamp, stamp],
      );
    }

    seedBookings();
    seedIncidents();
    seedEmergencies();
    seedNotifications();
    seedActivity();

    run("INSERT INTO app_settings(id, data, updated_at) VALUES (1, ?, ?)", [
      JSON.stringify(DEFAULT_SETTINGS),
      stamp,
    ]);

    seedAccounts();
    seedCounters();
  });
}

function seedBookings(): void {
  let badge = 200;

  for (const [serial, visitorIdx, hostIdx, purpose, dayOffset, time, status, party, vehicle] of BOOKINGS) {
    const visitor = VISITORS[visitorIdx];
    const teacher = TEACHERS[hostIdx];
    const department = DEPARTMENTS.find((d) => d[0] === teacher[5]);
    const id = ref(serial);
    const createdAt = at(dayOffset - 3, 10, serial % 60);
    const [hour, minute] = time.split(":").map(Number);

    const decided = ["Approved", "Rejected", "Checked In", "Meeting In Progress", "Checked Out", "No Show"].includes(status);
    const arrived = ["Checked In", "Meeting In Progress", "Checked Out"].includes(status);
    const departed = status === "Checked Out";
    const meeting = ["Meeting In Progress", "Checked Out"].includes(status);

    const gate = vehicle ? "Main Gate" : "Main Gate";
    const guard = dayOffset % 2 === 0 ? GUARDS[0] : GUARDS[1];

    run(
      `INSERT INTO visit_requests
         (id, visitor_id, full_name, mobile, email, gender, organization, address, emergency_contact,
          whatsapp_country_code, whatsapp_number,
          visitor_type, id_type, id_number, purpose, host_id, host_name, department_id, department,
          visit_date, visit_time, expected_duration, number_of_visitors, vehicle_required, vehicle_number,
          notes, status, source, pass_token, badge_number, decided_at, decided_by, rejection_reason,
          check_in_at, checked_in_by, check_out_at, checked_out_by, meeting_started_at, meeting_ended_at,
          gate, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,'+91',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        visitor[0],
        visitor[1],
        visitor[2],
        visitor[3],
        visitor[4],
        visitor[7],
        visitor[8],
        visitor[9],
        visitor[2], // WhatsApp number — the visitor's own mobile
        visitor[10],
        visitor[5],
        visitor[6],
        purpose,
        teacher[0],
        teacher[2],
        teacher[5],
        department?.[1] ?? "",
        day(dayOffset),
        time,
        "30 minutes",
        party,
        vehicle ? 1 : 0,
        vehicle,
        null,
        status,
        "Visitor Portal",
        decided && status !== "Rejected" ? randomToken(24) : null,
        decided && status !== "Rejected" ? `B-${++badge}` : null,
        decided ? at(dayOffset - 1, 9, 15) : null,
        decided ? "Security Administrator" : null,
        status === "Rejected" ? "Host is unavailable on the requested date." : null,
        arrived ? at(dayOffset, hour, minute + 4) : null,
        arrived ? guard[2] : null,
        departed ? at(dayOffset, hour + 1, minute) : null,
        departed ? guard[2] : null,
        meeting ? at(dayOffset, hour, minute + 9) : null,
        departed ? at(dayOffset, hour + 1, minute - 5) : null,
        arrived ? gate : null,
        createdAt,
        at(dayOffset, hour + 1, minute),
      ],
    );

    if (arrived) {
      run(
        `INSERT INTO check_logs(id, visit_request_id, visitor_id, visitor_name, direction, gate, guard_id, guard_name, at)
         VALUES (?,?,?,?,'In',?,?,?,?)`,
        [`CHK-${`${serial * 2 - 1}`.padStart(4, "0")}`, id, visitor[0], visitor[1], gate, guard[0], guard[2], at(dayOffset, hour, minute + 4)],
      );
      run(
        `INSERT INTO movements(id, person_id, person_name, person_type, direction, gate, at)
         VALUES (?,?,?,'Visitor','Entry',?,?)`,
        [`MOV-${`${serial * 2 - 1}`.padStart(4, "0")}`, visitor[0], visitor[1], gate, at(dayOffset, hour, minute + 4)],
      );
    }
    if (departed) {
      run(
        `INSERT INTO check_logs(id, visit_request_id, visitor_id, visitor_name, direction, gate, guard_id, guard_name, at)
         VALUES (?,?,?,?,'Out',?,?,?,?)`,
        [`CHK-${`${serial * 2}`.padStart(4, "0")}`, id, visitor[0], visitor[1], gate, guard[0], guard[2], at(dayOffset, hour + 1, minute)],
      );
      run(
        `INSERT INTO movements(id, person_id, person_name, person_type, direction, gate, at)
         VALUES (?,?,?,'Visitor','Exit',?,?)`,
        [`MOV-${`${serial * 2}`.padStart(4, "0")}`, visitor[0], visitor[1], gate, at(dayOffset, hour + 1, minute)],
      );
    }

    if (vehicle && arrived) {
      run(
        `INSERT INTO vehicles(id, vehicle_number, vehicle_type, visitor_name, driver_name, purpose, gate,
                              entry_time, exit_time, status, linked_visit_id, guard_id, guard_name)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          `VEH-${`${serial}`.padStart(4, "0")}`,
          vehicle,
          purpose === "Delivery" ? "Goods Vehicle" : "Car",
          visitor[1],
          visitor[1],
          purpose,
          gate,
          at(dayOffset, hour, minute + 3),
          departed ? at(dayOffset, hour + 1, minute + 2) : null,
          departed ? "Exited" : "Inside",
          id,
          guard[0],
          guard[2],
        ],
      );
    }
  }

  // A standing contractor vehicle with no linked booking, parked on campus.
  run(
    `INSERT INTO vehicles(id, vehicle_number, vehicle_type, visitor_name, driver_name, purpose, gate,
                          entry_time, status, guard_id, guard_name)
     VALUES ('VEH-0090','UK07ZZ4410','Goods Vehicle','Campus Works','Shyam Lal','Civil maintenance','Service Gate',?,'Inside','GRD-005','Mahesh Chauhan')`,
    [at(0, 7, 45)],
  );
}

function seedIncidents(): void {
  for (const [id, type, title, location, dayOffset, time, severity, description, guardId, guardName, status, note] of INCIDENTS) {
    const created = at(dayOffset, Number(time.split(":")[0]), Number(time.split(":")[1]));
    run(
      `INSERT INTO incidents(id, type, title, location, date, time, severity, description, reported_by,
                             reported_by_id, status, resolution_note, resolved_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        type,
        title,
        location,
        day(dayOffset),
        time,
        severity,
        description,
        guardName,
        guardId,
        status,
        note,
        status === "Resolved" || status === "Closed" ? at(dayOffset + 1, 10) : null,
        created,
        created,
      ],
    );
  }
}

function seedEmergencies(): void {
  run(
    `INSERT INTO emergencies(id, type, severity, location, note, triggered_by, triggered_by_id,
                             triggered_at, status, acknowledged_at, acknowledged_by, resolved_at)
     VALUES ('SOS-0001','Medical Emergency','High','Auditorium','Student fainted during assembly — stretcher requested.','Pooja Rawat','GRD-004',?,'Resolved',?,'Security Administrator',?)`,
    [at(0, 9, 52), at(0, 9, 54), at(0, 10, 20)],
  );
  run(
    `INSERT INTO emergencies(id, type, severity, location, note, triggered_by, triggered_by_id,
                             triggered_at, status)
     VALUES ('SOS-0002','Suspicious Activity','Medium','Service Gate','Vehicle refused entry attempted to re-approach the barrier.','Sunil Thapa','GRD-002',?,'Acknowledged')`,
    [at(-1, 19, 8)],
  );
}

function seedNotifications(): void {
  const rows: [string, string, string, string, string | null, number, string][] = [
    ["NTF-00001", "request", "New visit request", "Kavya Iyer requested a visit with Dr. Anupama Sharma.", "/admin/requests", 0, at(0, 8, 5)],
    ["NTF-00002", "checkin", "Visitor checked in", "Imran Qureshi checked in at Main Gate by Amit Kumar.", "/admin/checkin", 0, at(0, 10, 4)],
    ["NTF-00003", "emergency", "Emergency alert — Medical Emergency", "High alert raised at Auditorium by Pooja Rawat.", "/admin/emergency", 0, at(0, 9, 52)],
    ["NTF-00004", "incident", "High severity incident", "Medical Emergency reported at Auditorium by Pooja Rawat.", "/admin/incidents", 0, at(0, 9, 50)],
    ["NTF-00005", "approval", "Visit approved", "Sandeep Yadav's visit was approved. Visitor pass issued.", "/admin/bookings", 1, at(0, 8, 30)],
    ["NTF-00006", "checkout", "Visitor checked out", "Rahul Sharma checked out at Main Gate by Amit Kumar.", "/admin/visitors", 1, at(0, 10, 35)],
    ["NTF-00007", "vehicle", "Vehicle entry recorded", "UK07ZZ4410 entered through the Service Gate.", "/admin/vehicles", 1, at(0, 7, 45)],
    ["NTF-00008", "incident", "Medium severity incident", "Student Safety reported at Yamuna Hostel by Pooja Rawat.", "/admin/incidents", 0, at(0, 11, 15)],
    ["NTF-00009", "meeting", "Meeting in progress", "Ritu Aggarwal is meeting Shri Mohan Rawat.", "/admin/meetings", 1, at(0, 11, 9)],
    ["NTF-00010", "system", "Nightly summary", "6 visits completed yesterday across 3 gates.", "/admin/reports", 1, at(-1, 22, 0)],
  ];
  for (const [id, type, title, message, href, read, when] of rows) {
    run(
      "INSERT INTO notifications(id, type, title, message, href, audience, read, at) VALUES (?,?,?,?,?,NULL,?,?)",
      [id, type, title, message, href, read, when],
    );
  }
}

function seedActivity(): void {
  const rows: [string, string, string, string, string, string, string, string][] = [
    ["ACT-000001", "Security Administrator", "admin", "booking.approved", "booking", ref(16), "Security Administrator approved booking " + ref(16) + " for Sandeep Yadav.", at(0, 8, 30)],
    ["ACT-000002", "Amit Kumar", "security", "gate.check_in", "booking", ref(14), "Guard Amit Kumar checked in visitor Imran Qureshi at Main Gate.", at(0, 10, 4)],
    ["ACT-000003", "Mahesh Chauhan", "security", "vehicle.entry", "vehicle", "VEH-0090", "Mahesh Chauhan recorded vehicle UK07ZZ4410 entering at Service Gate.", at(0, 7, 45)],
    ["ACT-000004", "Pooja Rawat", "security", "incident.created", "incident", "INC-0005", "Pooja Rawat reported Medical Emergency (High) at Auditorium.", at(0, 9, 50)],
    ["ACT-000005", "Pooja Rawat", "security", "emergency.triggered", "emergency", "SOS-0001", "Pooja Rawat raised a Medical Emergency alert at Auditorium.", at(0, 9, 52)],
    ["ACT-000006", "Security Administrator", "admin", "emergency.resolved", "emergency", "SOS-0001", "Security Administrator marked alert SOS-0001 as resolved.", at(0, 10, 20)],
    ["ACT-000007", "Amit Kumar", "security", "gate.check_out", "booking", ref(13), "Guard Amit Kumar checked out visitor Rahul Sharma at Main Gate.", at(0, 10, 35)],
    ["ACT-000008", "Shri Mohan Rawat", "teacher", "meeting.started", "booking", ref(15), "Meeting started between Ritu Aggarwal and Shri Mohan Rawat.", at(0, 11, 9)],
    ["ACT-000009", "Pooja Rawat", "security", "incident.created", "incident", "INC-0006", "Pooja Rawat reported Student Safety (Medium) at Yamuna Hostel.", at(0, 11, 15)],
    ["ACT-000010", "Security Administrator", "admin", "guard.updated", "guard", "GRD-006", "Security Administrator changed guard Neha Bhandari's status from Active to On Leave.", at(-1, 16, 40)],
  ];
  for (const [id, actorName, actorRole, action, entity, entityId, summary, when] of rows) {
    run(
      `INSERT INTO activity_logs(id, actor_id, actor_name, actor_role, action, entity, entity_id, summary, channel, at)
       VALUES (?,NULL,?,?,?,?,?,?,'web',?)`,
      [id, actorName, actorRole, action, entity, entityId, summary, when],
    );
  }
}

/**
 * Demo sign-in accounts.
 *
 * Demo passwords come from the local DEMO_ACCOUNT_PASSWORD setting and are
 * hashed with scrypt before insert. Do not enable demo accounts in production.
 */
export const DEMO_ACCOUNTS = [
  { id: "USR-001", email: "superadmin@dsvv.edu.in", name: "Campus Security Director", role: "super_admin", refId: null, gate: null },
  { id: "USR-002", email: "admin@dsvv.edu.in", name: "Security Administrator", role: "admin", refId: null, gate: null },
  { id: "USR-003", email: "security@dsvv.edu.in", name: "Amit Kumar", role: "security", refId: "GRD-001", gate: "Main Gate" },
  { id: "USR-004", email: "sunil.thapa@dsvv.edu.in", name: "Sunil Thapa", role: "security", refId: "GRD-002", gate: "Main Gate" },
  { id: "USR-005", email: "pooja.rawat@dsvv.edu.in", name: "Pooja Rawat", role: "security", refId: "GRD-004", gate: "Hostel Gate" },
  // TCH-008 = Dr. Rajeshwari Trivedi · HoD, Department of Education
  { id: "USR-006", email: "rajeshwari.trivedi@dsvv.ac.in", name: "Dr. Rajeshwari Trivedi", role: "teacher", refId: "TCH-008", gate: null },
  // TCH-001 = Dr. Narendra Pratap Singh · HoD, Yogic Science
  { id: "USR-007", email: "np.singh@dsvv.ac.in", name: "Dr. Narendra Pratap Singh", role: "teacher", refId: "TCH-001", gate: null },
  { id: "USR-008", email: "aarav.mehta@dsvv.edu.in", name: "Aarav Mehta", role: "student", refId: "STU-2026-001", gate: null },
] as const;

function seedAccounts(): void {
  const password = process.env.DEMO_ACCOUNT_PASSWORD;
  if (!password) return;

  const stamp = at(-30, 9);
  for (const account of DEMO_ACCOUNTS) {
    const { hash, salt } = hashPassword(password);
    run(
      `INSERT INTO app_users(id, email, password_hash, password_salt, name, role, ref_id, gate, active, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,1,?,?)`,
      [account.id, account.email, hash, salt, account.name, account.role, account.refId, account.gate, stamp, stamp],
    );
  }
}

/** Point every sequence past the seeded rows so generated ids never collide. */
function seedCounters(): void {
  const counters: [string, number][] = [
    [`DSVV-VIS-${YEAR}`, BOOKINGS.length],
    ["VSTR", VISITORS.length],
    ["DEPT", DEPARTMENTS.length],
    ["TCH", TEACHERS.length],
    ["GRD", GUARDS.length],
    ["VEH", 90],
    ["CHK", BOOKINGS.length * 2],
    ["MOV", BOOKINGS.length * 2],
    ["INC", INCIDENTS.length],
    ["SOS", 2],
    ["NTF", 10],
    ["ACT", 10],
    ["OUT", 0],
    ["B", 226],
  ];
  for (const [key, value] of counters) {
    run("INSERT INTO counters(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [
      key,
      value,
    ]);
  }
}

/** Drops every row and re-seeds — used by the "reset demo data" action. */
export function resetToSeed(): void {
  const db = getDb();
  db.exec("PRAGMA foreign_keys = OFF");
  tx(() => {
    for (const table of [
      "sessions",
      "check_logs",
      "movements",
      "vehicles",
      "visit_requests",
      "visitors",
      "outings",
      "students",
      "teacher_availability",
      "teachers",
      "security_guards",
      "departments",
      "incidents",
      "emergencies",
      "notifications",
      "activity_logs",
      "campus_locations",
      "app_settings",
      "app_users",
      "counters",
    ]) {
      run(`DELETE FROM ${table}`);
    }
  });
  db.exec("PRAGMA foreign_keys = ON");
  seed();
}
