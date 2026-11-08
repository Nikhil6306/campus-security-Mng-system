import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envContent = readFileSync(".env.local", "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseService = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseService) {
  console.error("Missing Supabase configuration");
  process.exit(1);
}

const sb = createClient(supabaseUrl, supabaseService, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const YEAR = new Date().getFullYear();
const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
};
const at = (dayOffset, hour, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};
const ref = (serial) => `DSVV-VIS-${YEAR}-${`${serial}`.padStart(6, "0")}`;

async function seed() {
  console.log("--- Seeding Supabase Database ---");

  // 1. Campus Gates
  const GATES = [
    { id: "LOC-001", name: "Main Gate", kind: "Gate", active: true },
    { id: "LOC-002", name: "Service Gate", kind: "Gate", active: true },
    { id: "LOC-003", name: "Sports Gate", kind: "Gate", active: true },
    { id: "LOC-004", name: "Hostel Gate", kind: "Gate", active: true },
    { id: "LOC-005", name: "Admin Block", kind: "Block", active: true },
    { id: "LOC-006", name: "Central Library", kind: "Facility", active: true },
    { id: "LOC-007", name: "Science Block", kind: "Block", active: true },
    { id: "LOC-008", name: "Sports Complex", kind: "Facility", active: true },
    { id: "LOC-009", name: "Ganga Hostel", kind: "Hostel", active: true },
    { id: "LOC-010", name: "Yamuna Hostel", kind: "Hostel", active: true },
    { id: "LOC-011", name: "Saraswati Hostel", kind: "Hostel", active: true },
    { id: "LOC-012", name: "Auditorium", kind: "Facility", active: true },
    { id: "LOC-013", name: "Parking Area", kind: "Facility", active: true },
    { id: "LOC-014", name: "Canteen", kind: "Facility", active: true },
    { id: "LOC-015", name: "Health Centre", kind: "Facility", active: true },
    { id: "LOC-016", name: "Research Centre", kind: "Block", active: true },
  ];
  const { error: gateErr } = await sb.from("campus_gates").upsert(GATES, { onConflict: "id" });
  if (gateErr) console.error("Gates error:", gateErr.message);
  else console.log(`✓ Campus gates: ${GATES.length} rows`);

  // 2. Departments
  const DEPARTMENTS = [
    { id: "DEPT-001", name: "Department of Yogic Science and Human Consciousness", code: "YOGA", head: "Dr. Narendra Pratap Singh", location: "Yoga Block", phone: "9810012001", email: "yoga@dsvv.ac.in", active: true },
    { id: "DEPT-002", name: "Department of Ayurved and Holistic Health", code: "AYUR", head: "Dr. Amrit Lal Guruvendra", location: "Health Sciences Block", phone: "9810012002", email: "ayurveda@dsvv.ac.in", active: true },
    { id: "DEPT-003", name: "Department of Complementary and Alternative Medicine", code: "CAM", head: "", location: "Health Sciences Block", phone: "9810012003", email: "cam@dsvv.ac.in", active: true },
    { id: "DEPT-004", name: "Department of Vedic Studies and Sanskrit", code: "VED", head: "Prof. Emeritus Radheshyam Chaturvedi", location: "Indology Block", phone: "9810012004", email: "vedic@dsvv.ac.in", active: true },
    { id: "DEPT-005", name: "Department of Hindi", code: "HIN", head: "Prof. Sukhnandan Singh", location: "Indology Block", phone: "9810012005", email: "hindi@dsvv.ac.in", active: true },
    { id: "DEPT-006", name: "Department of Indian Classical Music", code: "MUS", head: "", location: "Arts Block", phone: "9810012006", email: "music@dsvv.ac.in", active: true },
    { id: "DEPT-007", name: "Department of History and Indian Culture", code: "HIC", head: "", location: "Humanities Block", phone: "9810012007", email: "history@dsvv.ac.in", active: true },
    { id: "DEPT-008", name: "Department of English", code: "ENG", head: "", location: "Humanities Block", phone: "9810012008", email: "english@dsvv.ac.in", active: true },
    { id: "DEPT-009", name: "Department of Psychology", code: "PSY", head: "Dr. Mamta Arora", location: "Humanities Block", phone: "9810012009", email: "psychology@dsvv.ac.in", active: true },
    { id: "DEPT-010", name: "Department of Education", code: "EDU", head: "Dr. Rajeshwari Trivedi", location: "Education Block", phone: "9810012010", email: "education@dsvv.ac.in", active: true },
    { id: "DEPT-011", name: "Department of Life Management", code: "LMG", head: "", location: "Humanities Block", phone: "9810012011", email: "lifemgmt@dsvv.ac.in", active: true },
    { id: "DEPT-012", name: "Department of Scientific Spirituality", code: "SSP", head: "", location: "Humanities Block", phone: "9810012012", email: "scisp@dsvv.ac.in", active: true },
    { id: "DEPT-013", name: "Department of Oriental Studies, Religious Studies and Philosophy", code: "ORS", head: "", location: "Indology Block", phone: "9810012013", email: "orstud@dsvv.ac.in", active: true },
    { id: "DEPT-014", name: "Department of Computer Sciences", code: "CS", head: "Dr. Piyush Trivedi", location: "Technology Block", phone: "9810012014", email: "cs@dsvv.ac.in", active: true },
    { id: "DEPT-015", name: "Department of Mathematics", code: "MATH", head: "", location: "Science Block", phone: "9810012015", email: "maths@dsvv.ac.in", active: true },
    { id: "DEPT-016", name: "Department of Tourism Management", code: "TRM", head: "Dr. Arunesh Parashar", location: "Management Block", phone: "9810012016", email: "tourism@dsvv.ac.in", active: true },
    { id: "DEPT-017", name: "Department of Journalism and Mass Communication", code: "JMC", head: "Dr. Artee Verma", location: "Media Block", phone: "9810012017", email: "jmc@dsvv.ac.in", active: true },
    { id: "DEPT-018", name: "Department of Animation and Visual Effects", code: "AVE", head: "", location: "Media Block", phone: "9810012018", email: "animation@dsvv.ac.in", active: true },
    { id: "DEPT-019", name: "Department of Medicinal and Aromatic Plants Sciences", code: "MAP", head: "", location: "Biological Sciences Block", phone: "9810012019", email: "maps@dsvv.ac.in", active: true },
    { id: "DEPT-020", name: "Department of Environmental Science", code: "ENV", head: "", location: "Biological Sciences Block", phone: "9810012020", email: "env@dsvv.ac.in", active: true },
    { id: "DEPT-021", name: "Department of Rural Studies and Sustainability", code: "RSS", head: "", location: "Rural Studies Block", phone: "9810012021", email: "rss@dsvv.ac.in", active: true },
    { id: "DEPT-022", "name": "Administration Office", code: "ADM", head: "", location: "Admin Block · Ground Floor", phone: "9810012022", email: "admin@dsvv.ac.in", active: true },
    { id: "DEPT-023", "name": "Admissions Office", code: "ADS", head: "", location: "Admin Block · Ground Floor", phone: "9810012023", email: "admissions@dsvv.ac.in", active: true },
    { id: "DEPT-024", "name": "Central Library", code: "LIB", head: "", location: "Central Library Building", phone: "9810012024", email: "library@dsvv.ac.in", active: true },
    { id: "DEPT-025", "name": "Student Affairs", code: "SA", head: "", location: "Student Centre", phone: "9810012025", email: "studentaffairs@dsvv.ac.in", active: true },
    { id: "DEPT-026", "name": "Finance Office", code: "FIN", head: "", location: "Admin Block · 1st Floor", phone: "9810012026", email: "finance@dsvv.ac.in", active: true },
  ];
  const { error: deptErr } = await sb.from("departments").upsert(DEPARTMENTS, { onConflict: "id" });
  if (deptErr) console.error("Dept error:", deptErr.message);
  else console.log(`✓ Departments: ${DEPARTMENTS.length} rows`);

  // 3. Teachers & Availability
  const TEACHERS = [
    { id: "TCH-001", employee_id: "EMP-1001", name: "Dr. Narendra Pratap Singh", email: "np.singh@dsvv.ac.in", phone: "9810012301", department_id: "DEPT-001", designation: "Head of Department", room: "Yoga Block · 101", availability_status: "Available", active: true },
    { id: "TCH-002", employee_id: "EMP-1002", name: "Prof. Hemadri Sao", email: "hemadri.sao@dsvv.ac.in", phone: "9810012302", department_id: "DEPT-001", designation: "Professor", room: "Yoga Block · 102", availability_status: "Available", active: true },
    { id: "TCH-003", employee_id: "EMP-1003", name: "Dr. Amrit Lal Guruvendra", email: "amritlal.guruvendra@dsvv.ac.in", phone: "9810012303", department_id: "DEPT-002", designation: "Head of Department", room: "Health Sciences Block · 201", availability_status: "Available", active: true },
    { id: "TCH-004", employee_id: "EMP-1004", name: "Prof. Emeritus Radheshyam Chaturvedi", email: "rs.chaturvedi@dsvv.ac.in", phone: "9810012304", department_id: "DEPT-004", designation: "Professor Emeritus", room: "Indology Block · 301", availability_status: "Available", active: true },
    { id: "TCH-005", employee_id: "EMP-1005", name: "Prof. Sukhnandan Singh", email: "sukhnandan.singh@dsvv.ac.in", phone: "9810012305", department_id: "DEPT-005", designation: "Head of Department", room: "Indology Block · 302", availability_status: "Available", active: true },
    { id: "TCH-006", employee_id: "EMP-1006", name: "Dr. Mamta Arora", email: "mamta.arora@dsvv.ac.in", phone: "9810012306", department_id: "DEPT-009", designation: "Head of Department", room: "Humanities Block · 401", availability_status: "Available", active: true },
    { id: "TCH-007", employee_id: "EMP-1007", name: "Dr. Shivnarayan Prasad", email: "shivnarayan.prasad@dsvv.ac.in", phone: "9810012307", department_id: "DEPT-009", designation: "Assistant Professor", room: "Humanities Block · 402", availability_status: "Available", active: true },
    { id: "TCH-008", employee_id: "EMP-1008", name: "Dr. Rajeshwari Trivedi", email: "rajeshwari.trivedi@dsvv.ac.in", phone: "9810012308", department_id: "DEPT-010", designation: "Head of Department", room: "Education Block · 101", availability_status: "Available", active: true },
    { id: "TCH-009", employee_id: "EMP-1009", name: "Dr. Vandana Shrivastava", email: "vandana.shrivastava@dsvv.ac.in", phone: "9810012309", department_id: "DEPT-010", designation: "Associate Professor", room: "Education Block · 102", availability_status: "Busy", active: true },
    { id: "TCH-010", employee_id: "EMP-1010", name: "Dr. Piyush Trivedi", email: "piyush.trivedi@dsvv.ac.in", phone: "9810012310", department_id: "DEPT-014", designation: "Head of Department", room: "Technology Block · 201", availability_status: "Available", active: true },
    { id: "TCH-011", employee_id: "EMP-1011", name: "Dr. Pankaj Saini", email: "pankaj.saini@dsvv.ac.in", phone: "9810012311", department_id: "DEPT-014", designation: "Assistant Professor", room: "Technology Block · 202", availability_status: "Available", active: true },
    { id: "TCH-012", employee_id: "EMP-1012", name: "Dr. Arunesh Parashar", email: "arunesh.parashar@dsvv.ac.in", phone: "9810012312", department_id: "DEPT-016", designation: "Head of Department", room: "Management Block · 101", availability_status: "Available", active: true },
    { id: "TCH-013", employee_id: "EMP-1013", name: "Dr. Artee Verma", email: "artee.verma@dsvv.ac.in", phone: "9810012313", department_id: "DEPT-017", designation: "Head of Department", room: "Media Block · 101", availability_status: "Available", active: true },
    { id: "TCH-014", employee_id: "EMP-1014", name: "Prof. Suresh Lal Barnwal", email: "sl.barnwal@dsvv.ac.in", phone: "9810012314", department_id: "DEPT-022", designation: "Dean", room: "Admin Block · 201", availability_status: "Available", active: true },
    { id: "TCH-015", employee_id: "EMP-1015", name: "Prof. Abhay Saxena", email: "abhay.saxena@dsvv.ac.in", phone: "9810012315", department_id: "DEPT-022", designation: "Professor", room: "Admin Block · 202", availability_status: "Available", active: true },
    { id: "TCH-016", employee_id: "EMP-1016", name: "Prof. Emeritus K. S. Tyagi", email: "ks.tyagi@dsvv.ac.in", phone: "9810012316", department_id: "DEPT-022", designation: "Professor Emeritus", room: "Admin Block · 203", availability_status: "Available", active: true },
    { id: "TCH-017", employee_id: "EMP-1017", name: "Prof. Emeritus Karan Singh", email: "karan.singh@dsvv.ac.in", phone: "9810012317", department_id: "DEPT-022", designation: "Professor Emeritus", room: "Admin Block · 204", availability_status: "Available", active: true },
    { id: "TCH-018", employee_id: "EMP-1018", name: "Ms. Kaveri Bali", email: "kaveri.bali@dsvv.ac.in", phone: "9810012318", department_id: "DEPT-023", designation: "Admissions Officer", room: "Admissions Block · 001", availability_status: "Available", active: true },
  ];
  const { error: tchErr } = await sb.from("teachers").upsert(TEACHERS, { onConflict: "id" });
  if (tchErr) console.error("Teachers error:", tchErr.message);
  else console.log(`✓ Teachers: ${TEACHERS.length} rows`);

  const AVAILABILITY = TEACHERS.map((t) => ({
    teacher_id: t.id,
    days: [1, 2, 3, 4, 5],
    start_time: "09:00",
    end_time: "17:00",
    slot_minutes: 30,
    blocked: [],
  }));
  const { error: availErr } = await sb.from("teacher_availability").upsert(AVAILABILITY, { onConflict: "teacher_id" });
  if (availErr) console.error("Availability error:", availErr.message);
  else console.log(`✓ Teacher availability: ${AVAILABILITY.length} rows`);

  // 4. Security Guards
  const GUARDS = [
    { id: "GRD-001", employee_id: "SEC-2001", full_name: "Amit Kumar", phone: "9820011001", email: "amit.kumar@dsvv.edu.in", shift: "Morning", shift_start: "06:00", shift_end: "14:00", assigned_gate: "Main Gate", status: "On Duty", joining_date: "2021-04-12", emergency_contact: "9820099001", address: "Shivalik Nagar, Haridwar" },
    { id: "GRD-002", employee_id: "SEC-2002", full_name: "Sunil Thapa", phone: "9820011002", email: "sunil.thapa@dsvv.edu.in", shift: "Evening", shift_start: "14:00", shift_end: "22:00", assigned_gate: "Main Gate", status: "Active", joining_date: "2020-08-03", emergency_contact: "9820099002", address: "Jwalapur, Haridwar" },
    { id: "GRD-003", employee_id: "SEC-2003", full_name: "Rajesh Bisht", phone: "9820011003", email: "rajesh.bisht@dsvv.edu.in", shift: "Night", shift_start: "22:00", shift_end: "06:00", assigned_gate: "Service Gate", status: "Off Duty", joining_date: "2019-11-25", emergency_contact: "9820099003", address: "Bahadrabad, Haridwar" },
    { id: "GRD-004", employee_id: "SEC-2004", full_name: "Pooja Rawat", phone: "9820011004", email: "pooja.rawat@dsvv.edu.in", shift: "Morning", shift_start: "06:00", shift_end: "14:00", assigned_gate: "Hostel Gate", status: "On Duty", joining_date: "2022-01-17", emergency_contact: "9820099004", address: "Kankhal, Haridwar" },
    { id: "GRD-005", employee_id: "SEC-2005", full_name: "Mahesh Chauhan", phone: "9820011005", email: "mahesh.chauhan@dsvv.edu.in", shift: "General", shift_start: "09:00", shift_end: "18:00", assigned_gate: "Sports Gate", status: "Active", joining_date: "2018-06-09", emergency_contact: "9820099005", address: "Ranipur, Haridwar" },
    { id: "GRD-006", employee_id: "SEC-2006", full_name: "Neha Bhandari", phone: "9820011006", email: "neha.bhandari@dsvv.edu.in", shift: "Evening", shift_start: "14:00", shift_end: "22:00", assigned_gate: "Hostel Gate", status: "On Leave", joining_date: "2023-03-21", emergency_contact: "9820099006", address: "Roorkee Road, Haridwar" },
  ];
  const { error: grdErr } = await sb.from("security_guards").upsert(GUARDS, { onConflict: "id" });
  if (grdErr) console.error("Guards error:", grdErr.message);
  else console.log(`✓ Security guards: ${GUARDS.length} rows`);

  // 5. Students
  const STUDENTS = [
    { id: "STU-2026-001", name: "Aarav Mehta", roll_no: "DSVV/CS/2026/001", department_id: "DEPT-001", year: "2nd Year", hostel: "Ganga Hostel", room: "G-114", guardian_name: "Rakesh Mehta", guardian_phone: "9899001001", on_campus: true },
    { id: "STU-2026-002", name: "Ishita Verma", roll_no: "DSVV/MGT/2026/014", department_id: "DEPT-002", year: "1st Year", hostel: "Yamuna Hostel", room: "Y-207", guardian_name: "Sanjay Verma", guardian_phone: "9899001002", on_campus: true },
    { id: "STU-2026-003", name: "Kabir Singh", roll_no: "DSVV/ENG/2026/032", department_id: "DEPT-008", year: "3rd Year", hostel: "Ganga Hostel", room: "G-302", guardian_name: "Harpreet Singh", guardian_phone: "9899001003", on_campus: false },
    { id: "STU-2026-004", name: "Ananya Rao", roll_no: "DSVV/CS/2026/045", department_id: "DEPT-001", year: "2nd Year", hostel: "Saraswati Hostel", room: "S-118", guardian_name: "Prakash Rao", guardian_phone: "9899001004", on_campus: true },
    { id: "STU-2026-005", name: "Rohan Gupta", roll_no: "DSVV/RES/2026/007", department_id: "DEPT-006", year: "4th Year", hostel: "Ganga Hostel", room: "G-401", guardian_name: "Manoj Gupta", guardian_phone: "9899001005", on_campus: true },
    { id: "STU-2026-006", name: "Tara Nair", roll_no: "DSVV/WEL/2026/019", department_id: "DEPT-009", year: "1st Year", hostel: "Yamuna Hostel", room: "Y-102", guardian_name: "Suresh Nair", guardian_phone: "9899001006", on_campus: true },
  ];
  const { error: stuErr } = await sb.from("students").upsert(STUDENTS, { onConflict: "id" });
  if (stuErr) console.error("Students error:", stuErr.message);
  else console.log(`✓ Students: ${STUDENTS.length} rows`);

  // 6. Campus Settings
  const defaultSettings = {
    campusName: "Dev Sanskriti Vishwavidyalaya",
    campusAddress: "Gayatrikunj, Shantikunj, Haridwar, Uttarakhand 249411",
    contactEmail: "security@dsvv.ac.in",
    securityDeskPhone: "+91 1334 261367",
    visitingHoursFrom: "07:00",
    visitingHoursTo: "20:00",
    maxVisitorsPerBooking: 20,
    advanceBookingDays: 90,
    defaultMeetingMinutes: 30,
    requireIdProof: true,
    requireVehicleDetails: true,
    autoExpireHours: 24,
    allowedVisitorTypes: [
      "Guest",
      "Parent/Guardian",
      "Vendor",
      "Official",
      "Contractor",
      "Alumni",
      "Interview Candidate",
      "Delivery Agent",
      "VIP",
    ],
    notifyRequests: true,
    notifyGate: true,
    notifyIncidents: true,
  };
  const { error: setErr } = await sb.from("campus_settings").upsert({ id: 1, data: defaultSettings });
  if (setErr) console.error("Settings error:", setErr.message);
  else console.log("✓ Campus settings seeded");

  // 7. Seed Demo Auth Users
  const DEMO_USERS = [
    {
      email: "superadmin@dsvv.edu.in",
      password: "Super@123",
      name: "Campus Security Director",
      role: "super_admin",
      ref_id: null,
      gate: null,
    },
    {
      email: "admin@dsvv.edu.in",
      password: "Admin@123",
      name: "Security Administrator",
      role: "admin",
      ref_id: null,
      gate: null,
    },
    {
      email: "security@dsvv.edu.in",
      password: "Security@123",
      name: "Amit Kumar",
      role: "security",
      ref_id: "GRD-001",
      gate: "Main Gate",
    },
    {
      email: "anupama.sharma@dsvv.edu.in",
      password: "Teacher@123",
      name: "Dr. Anupama Sharma",
      role: "teacher",
      ref_id: "TCH-008",
      gate: null,
    },
    {
      email: "rajeshwari.trivedi@dsvv.ac.in",
      password: "Teacher@123",
      name: "Dr. Rajeshwari Trivedi",
      role: "teacher",
      ref_id: "TCH-008",
      gate: null,
    },
    {
      email: "aarav.mehta@dsvv.edu.in",
      password: "Student@123",
      name: "Aarav Mehta",
      role: "student",
      ref_id: "STU-2026-001",
      gate: null,
    },
    {
      email: "visitor@dsvv.edu.in",
      password: "Visitor@123",
      name: "Rahul Sharma",
      role: "visitor",
      ref_id: "VSTR-0001",
      gate: null,
    },
    {
      email: "nikhilshukla1200@gmail.com",
      password: "Super@123",
      name: "Nikhil Shukla",
      role: "super_admin",
      ref_id: null,
      gate: null,
    },
  ];

  console.log("--- Provisioning Auth Users in Supabase Auth ---");
  for (const user of DEMO_USERS) {
    // Check if user already exists
    const { data: listRes } = await sb.auth.admin.listUsers();
    const existing = listRes?.users?.find((u) => u.email?.toLowerCase() === user.email.toLowerCase());
    let userId = existing?.id;

    if (!existing) {
      const { data: createRes, error: createErr } = await sb.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          full_name: user.name,
          role: user.role,
          ref_id: user.ref_id,
          gate: user.gate,
        },
      });
      if (createErr) {
        console.error(`Failed to create ${user.email}:`, createErr.message);
        continue;
      }
      userId = createRes.user.id;
      console.log(`✓ Created auth user: ${user.email} (${user.role})`);
    } else {
      // Update password and metadata to ensure valid state
      await sb.auth.admin.updateUserById(existing.id, {
        password: user.password,
        email_confirm: true,
        user_metadata: {
          full_name: user.name,
          role: user.role,
          ref_id: user.ref_id,
          gate: user.gate,
        },
      });
      console.log(`✓ Updated auth user: ${user.email} (${user.role})`);
    }

    // Ensure public.profiles is accurately populated with designated role
    if (userId) {
      const { error: profErr } = await sb.from("profiles").upsert(
        {
          id: userId,
          email: user.email,
          full_name: user.name,
          role: user.role,
          ref_id: user.ref_id,
          gate: user.gate,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
      if (profErr) {
        console.error(`Profile error for ${user.email}:`, profErr.message);
      }
    }
  }

  // 8. Seed Visitors and Sample Bookings
  const VISITORS = [
    { id: "VSTR-0001", full_name: "Rahul Sharma", mobile: "9876500001", mobile_number: "9876500001", email: "rahul.sharma@example.com", gender: "Male", id_type: "Aadhaar Card", id_number: "482177349901", aadhaar_number: "482177349901", organization: "Sharma Technologies", address: "12 Ganga Vihar, Haridwar", emergency_contact: "9876590001", visitor_type: "Parent/Guardian", total_visits: 4, blacklisted: false, has_car: true, car_number: "UK07AB1234" },
    { id: "VSTR-0002", full_name: "Priya Nambiar", mobile: "9876500002", mobile_number: "9876500002", email: "priya.nambiar@example.com", gender: "Female", id_type: "Driving Licence", id_number: "UK0720190001234", organization: "Nambiar Consulting", address: "44 Rishikesh Road, Dehradun", emergency_contact: "9876590002", visitor_type: "Official", total_visits: 2, blacklisted: false, has_car: false },
    { id: "VSTR-0003", full_name: "Imran Qureshi", mobile: "9876500003", mobile_number: "9876500003", email: "imran.qureshi@example.com", gender: "Male", id_type: "Other", id_number: "AXQPQ1234K", organization: "Skyline Interiors", address: "9 Mall Road, Mussoorie", emergency_contact: "9876590003", visitor_type: "Vendor", total_visits: 6, blacklisted: false, has_car: true, car_number: "UK08CD5678" },
    { id: "VSTR-0004", full_name: "Sneha Kulkarni", mobile: "9876500004", mobile_number: "9876500004", email: "sneha.kulkarni@example.com", gender: "Female", id_type: "Aadhaar Card", id_number: "771244098823", aadhaar_number: "771244098823", organization: "", address: "88 Sector 4, Noida", emergency_contact: "9876590004", visitor_type: "Alumni", total_visits: 1, blacklisted: false, has_car: false },
    { id: "VSTR-0005", full_name: "Vikram Desai", mobile: "9876500005", mobile_number: "9876500005", email: "vikram.desai@example.com", gender: "Male", id_type: "Passport", id_number: "M4429871", organization: "Desai Exports", address: "23 Park Street, Kolkata", emergency_contact: "9876590005", visitor_type: "Guest", total_visits: 3, blacklisted: false, has_car: false },
  ];
  const { error: vstrErr } = await sb.from("visitors").upsert(VISITORS, { onConflict: "id" });
  if (vstrErr) console.error("Visitors error:", vstrErr.message);
  else console.log(`✓ Visitors: ${VISITORS.length} rows`);

  const BOOKINGS = [
    {
      id: ref(1),
      visitor_id: "VSTR-0001",
      full_name: "Rahul Sharma",
      mobile: "9876500001",
      mobile_number: "9876500001",
      email: "rahul.sharma@example.com",
      gender: "Male",
      id_type: "Aadhaar Card",
      id_number: "482177349901",
      aadhaar_number: "482177349901",
      organization: "Sharma Technologies",
      address: "12 Ganga Vihar, Haridwar",
      emergency_contact: "9876590001",
      visitor_type: "Parent/Guardian",
      purpose: "Parent Visit",
      host_id: "TCH-001",
      host_name: "Dr. Narendra Pratap Singh",
      department_id: "DEPT-001",
      department: "Department of Yogic Science and Human Consciousness",
      visit_date: day(0),
      visit_time: "10:00",
      expected_duration: "1 hour",
      number_of_visitors: 2,
      vehicle_required: true,
      vehicle_number: "UK07AB1234",
      has_car: true,
      car_number: "UK07AB1234",
      status: "Checked In",
      source: "Visitor Portal",
      pass_token: crypto.randomBytes(24).toString("base64url"),
      badge_number: "B-101",
      gate: "Main Gate",
      check_in_at: at(0, 9, 55),
      checked_in_by: "Amit Kumar",
    },
    {
      id: ref(2),
      visitor_id: "VSTR-0002",
      full_name: "Priya Nambiar",
      mobile: "9876500002",
      mobile_number: "9876500002",
      email: "priya.nambiar@example.com",
      gender: "Female",
      id_type: "Driving Licence",
      id_number: "UK0720190001234",
      organization: "Nambiar Consulting",
      address: "44 Rishikesh Road, Dehradun",
      emergency_contact: "9876590002",
      visitor_type: "Official",
      purpose: "Official Work",
      host_id: "TCH-005",
      host_name: "Prof. Sukhnandan Singh",
      department_id: "DEPT-005",
      department: "Department of Hindi",
      visit_date: day(0),
      visit_time: "11:30",
      expected_duration: "30 minutes",
      number_of_visitors: 1,
      vehicle_required: false,
      has_car: false,
      status: "Approved",
      source: "Visitor Portal",
      pass_token: crypto.randomBytes(24).toString("base64url"),
      badge_number: "B-102",
      decided_at: at(0, 8, 30),
      decided_by: "Security Administrator",
    },
    {
      id: ref(3),
      visitor_id: "VSTR-0003",
      full_name: "Imran Qureshi",
      mobile: "9876500003",
      mobile_number: "9876500003",
      email: "imran.qureshi@example.com",
      gender: "Male",
      id_type: "Other",
      id_number: "AXQPQ1234K",
      organization: "Skyline Interiors",
      address: "9 Mall Road, Mussoorie",
      emergency_contact: "9876590003",
      visitor_type: "Vendor",
      purpose: "Delivery",
      host_id: "TCH-010",
      host_name: "Dr. Piyush Trivedi",
      department_id: "DEPT-014",
      department: "Department of Computer Sciences",
      visit_date: day(0),
      visit_time: "14:00",
      expected_duration: "30 minutes",
      number_of_visitors: 1,
      vehicle_required: true,
      vehicle_number: "UK08CD5678",
      has_car: true,
      car_number: "UK08CD5678",
      status: "Pending",
      source: "Visitor Portal",
      pass_token: null,
    },
  ];
  const { error: bkgErr } = await sb.from("visit_requests").upsert(BOOKINGS, { onConflict: "id" });
  if (bkgErr) console.error("Bookings error:", bkgErr.message);
  else console.log(`✓ Visit requests: ${BOOKINGS.length} rows`);

  // 9. Check logs
  const CHECK_LOGS = [
    {
      id: "CHK-0001",
      visit_request_id: ref(1),
      visitor_id: "VSTR-0001",
      visitor_name: "Rahul Sharma",
      direction: "In",
      gate: "Main Gate",
      guard_id: "GRD-001",
      guard_name: "Amit Kumar",
      at: at(0, 9, 55),
      note: "ID verified via Aadhaar card",
    },
  ];
  const { error: chkErr } = await sb.from("check_logs").upsert(CHECK_LOGS, { onConflict: "id" });
  if (chkErr) console.error("Check logs error:", chkErr.message);
  else console.log(`✓ Check logs: ${CHECK_LOGS.length} rows`);

  // 10. Vehicles
  const VEHICLES = [
    {
      id: "VEH-0001",
      vehicle_number: "UK07AB1234",
      vehicle_type: "Car",
      visitor_name: "Rahul Sharma",
      driver_name: "Self",
      purpose: "Parent Visit",
      gate: "Main Gate",
      entry_time: at(0, 9, 55),
      status: "Inside",
      linked_visit_id: ref(1),
      guard_id: "GRD-001",
      guard_name: "Amit Kumar",
    },
  ];
  const { error: vehErr } = await sb.from("vehicles").upsert(VEHICLES, { onConflict: "id" });
  if (vehErr) console.error("Vehicles error:", vehErr.message);
  else console.log(`✓ Vehicles: ${VEHICLES.length} rows`);

  // 11. Incidents
  const INCIDENTS = [
    {
      id: "INC-0001",
      type: "Student Safety",
      title: "Minor slip near cafeteria",
      location: "Canteen",
      date: day(0),
      time: "11:15",
      severity: "Low",
      description: "First aid administered, floor mopped and caution sign placed.",
      reported_by: "Amit Kumar",
      reported_by_id: "GRD-001",
      status: "Resolved",
      resolution_note: "Resolved on spot",
      resolved_at: at(0, 11, 30),
    },
  ];
  const { error: incErr } = await sb.from("incidents").upsert(INCIDENTS, { onConflict: "id" });
  if (incErr) console.error("Incidents error:", incErr.message);
  else console.log(`✓ Incidents: ${INCIDENTS.length} rows`);

  // 12. Emergencies
  const EMERGENCIES = [
    {
      id: "SOS-0001",
      type: "Medical Emergency",
      severity: "High",
      location: "Auditorium",
      note: "Student felt dizzy during seminar, medical staff attended.",
      triggered_by: "Pooja Rawat",
      triggered_by_id: "GRD-004",
      triggered_at: at(0, 9, 52),
      status: "Resolved",
      acknowledged_at: at(0, 9, 54),
      acknowledged_by: "Security Administrator",
      resolved_at: at(0, 10, 20),
    },
  ];
  const { error: sosErr } = await sb.from("emergencies").upsert(EMERGENCIES, { onConflict: "id" });
  if (sosErr) console.error("Emergencies error:", sosErr.message);
  else console.log(`✓ Emergencies: ${EMERGENCIES.length} rows`);

  // 13. Notifications
  const NOTIFICATIONS = [
    {
      id: "NTF-00001",
      type: "request",
      title: "New visit request",
      message: "Imran Qureshi requested a visit with Dr. Piyush Trivedi.",
      href: "/admin/requests",
      audience: null,
      read: false,
      at: at(0, 8, 5),
    },
    {
      id: "NTF-00002",
      type: "checkin",
      title: "Visitor checked in",
      message: "Rahul Sharma checked in at Main Gate by Amit Kumar.",
      href: "/admin/checkin",
      audience: null,
      read: false,
      at: at(0, 9, 55),
    },
  ];
  const { error: ntfErr } = await sb.from("notifications").upsert(NOTIFICATIONS, { onConflict: "id" });
  if (ntfErr) console.error("Notifications error:", ntfErr.message);
  else console.log(`✓ Notifications: ${NOTIFICATIONS.length} rows`);

  // 14. Activity Logs
  const ACTIVITY = [
    {
      id: "ACT-000001",
      actor_id: null,
      actor_name: "Security Administrator",
      actor_role: "admin",
      action: "booking.approved",
      entity: "booking",
      entity_id: ref(2),
      summary: "Security Administrator approved booking " + ref(2) + " for Priya Nambiar.",
      channel: "web",
      at: at(0, 8, 30),
    },
    {
      id: "ACT-000002",
      actor_id: "GRD-001",
      actor_name: "Amit Kumar",
      actor_role: "security",
      action: "gate.check_in",
      entity: "booking",
      entity_id: ref(1),
      summary: "Guard Amit Kumar checked in visitor Rahul Sharma at Main Gate.",
      channel: "web",
      at: at(0, 9, 55),
    },
  ];
  const { error: actErr } = await sb.from("activity_logs").upsert(ACTIVITY, { onConflict: "id" });
  if (actErr) console.error("Activity error:", actErr.message);
  else console.log(`✓ Activity logs: ${ACTIVITY.length} rows`);

  console.log("\n=== Supabase Seeding Completed Successfully! ===");
}

seed().catch(console.error);
