require("dotenv").config();
const express = require("express");
const sql = require("mssql");
const router = express.Router();
const moment = require("moment-timezone");
const bcrypt = require("bcrypt");
const session = require("express-session");
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");
const config = require("../config");

// Create a connection to the database
// const config = {
//   connectionString:
//     "Server=localhost\\SQLEXPRESS;Database=EmployeeAttendanceDB;Trusted_Connection=YES;;Driver={ODBC Driver 18 for SQL Server};Encrypt=Yes;TrustServerCertificate=Yes;",
//   options: {
//     encrypt: true,
//     trustServerCertificate: true,
//   },
//   connectionTimeout: 3000000,
//   requestTimeout: 3000000,
// };

// Database connection check function
async function checkDatabaseConnection() {
  let pool;

  try {
    console.log("🔍 Checking database connection...");

    pool = await sql.connect(config);

    // Simple query to validate connection
    const result = await pool.request().query("SELECT 1 AS test");

    if (result.recordset.length > 0) {
      const dbName = config.database || "Unknown DB";
      console.log("✅ Database connection successful!");
      console.log(`📊 Connected to: ${dbName}`);
    }

    await pool.close();
    return true;
  } catch (error) {
    console.error("❌ Database connection failed!");
    console.error("Error details:", error.message);

    // Mask sensitive info before logging
    const safeConfig = {
      server: config.server,
      database: config.database,
      user: config.user,
      password: "****",
      port: config.port
    };
    console.error("🔒 Connection config used:", safeConfig);

    if (pool) {
      try {
        await pool.close();
      } catch (closeError) {
        console.error("⚠️ Error closing connection:", closeError.message);
      }
    }

    return false;
  }
}

router.get("/", async (req, res) => {
  let pool;
  try {
    // Connect to SQL Server
    pool = await sql.connect(config);

    // Get filters from query params
    const siteFilter = req.query.site || "ALL SITES";
    const monthFilter = req.query.month || new Date().toISOString().slice(0, 7); // Format: YYYY-MM

    console.log("Filters:", { siteFilter, monthFilter });

    const punchesTodayQuery = `
      SELECT 
          s.site_name AS Site,
          COUNT(*) AS PunchCount
      FROM attendance.attendance_data a
      INNER JOIN attendance.employee_details e ON a.employee_id = e.employee_id
      INNER JOIN attendance.department_site_details dsd ON e.department_site_id = dsd.department_site_id
      INNER JOIN attendance.site_details s ON dsd.site_id = s.site_id
      WHERE CAST(a.rec_timestamp AS DATE) = CAST(GETDATE() AS DATE)
      GROUP BY s.site_name
      ORDER BY PunchCount DESC
    `;

    // ============================================================================
    // NEW QUERY 2: Number of Employees Per Site
    // ============================================================================
    const employeesPerSiteQuery = `
      SELECT 
          s.site_name AS Site,
          COUNT(DISTINCT e.employee_id) AS EmployeeCount
      FROM attendance.employee_details e
      INNER JOIN attendance.department_site_details dsd ON e.department_site_id = dsd.department_site_id
      INNER JOIN attendance.site_details s ON dsd.site_id = s.site_id
      WHERE e.is_active = 1
      GROUP BY s.site_name
      ORDER BY EmployeeCount DESC
    `;

    // ... (your existing queries) ...

    // ============================================================================
    // Execute All Queries
    // ============================================================================
    const request1 = pool.request();
    request1.input("monthFilter", sql.VarChar, monthFilter);

    const request2 = pool.request();
    request2.input("monthFilter", sql.VarChar, monthFilter);

    // ============================================================================
    // QUERY 1: Total Employees (Active)
    // ============================================================================
    const totalEmployeesQuery = `
            SELECT COUNT(DISTINCT e.employee_id) AS total
            FROM attendance.employee_details e
            WHERE e.is_active = 1
            ${
              siteFilter !== "ALL SITES"
                ? `
                AND EXISTS (
                    SELECT 1 FROM attendance.department_site_details dsd
                    INNER JOIN attendance.site_details s ON dsd.site_id = s.site_id
                    WHERE dsd.department_site_id = e.department_site_id 
                    AND s.site_name = @siteFilter
                )
            `
                : ""
            }
        `;

    // ============================================================================
    // QUERY 2: Total Sites/Locations
    // ============================================================================
    const totalSitesQuery = `
            SELECT COUNT(DISTINCT site_id) AS total
            FROM attendance.site_details
        `;

    // ============================================================================
    // QUERY 3: Monthly Absentee Trends (Based on First Punch)
    // ============================================================================
    // ============================================================================
    // QUERY 3: Monthly Absentee Trends (Based on First Punch) - FIXED
    // ============================================================================
    const absenteeTrendsQuery = `
WITH MonthlyWorkingDays AS (
    -- Count working days per month
    SELECT 
        FORMAT(CAST(rec_timestamp AS DATE), 'yyyy-MM') AS Month,
        COUNT(DISTINCT CAST(rec_timestamp AS DATE)) AS WorkingDays
    FROM attendance.attendance_data
    WHERE DATEPART(WEEKDAY, CAST(rec_timestamp AS DATE)) NOT IN (1, 7)
    GROUP BY FORMAT(CAST(rec_timestamp AS DATE), 'yyyy-MM')
),
MonthlyPresence AS (
    -- Count unique employees present each month
    SELECT 
        FORMAT(CAST(a.rec_timestamp AS DATE), 'yyyy-MM') AS Month,
        COUNT(DISTINCT a.employee_id) AS UniqueEmployeesPresent,
        COUNT(DISTINCT CAST(a.rec_timestamp AS DATE)) AS DaysWithData
    FROM attendance.attendance_data a
    INNER JOIN attendance.employee_details e ON a.employee_id = e.employee_id
    WHERE a.punch_type = 'IN' AND e.is_active = 1
    GROUP BY FORMAT(CAST(a.rec_timestamp AS DATE), 'yyyy-MM')
),
TotalEmployeeCount AS (
    -- Get total active employees
    SELECT COUNT(*) AS TotalEmployees
    FROM attendance.employee_details
    WHERE is_active = 1
)
SELECT 
    mp.Month,
    tec.TotalEmployees,
    mp.UniqueEmployeesPresent AS PresentEmployees,
    mwd.WorkingDays,
    (tec.TotalEmployees - mp.UniqueEmployeesPresent) AS AvgAbsentees
FROM MonthlyPresence mp
CROSS JOIN TotalEmployeeCount tec
INNER JOIN MonthlyWorkingDays mwd ON mp.Month = mwd.Month
ORDER BY mp.Month
`;

    // ============================================================================
    // QUERY 4: Leave Days (Current Month, Filtered)
    // ============================================================================
    const leaveDaysQuery = `
            SELECT 
                l.employee_id AS Employee_ID,
                SUM(
                    DATEDIFF(DAY, l.begda, l.endda) + 1
                    - ((DATEDIFF(WEEK, l.begda, l.endda)) * 2)
                    - (CASE WHEN DATEPART(WEEKDAY, l.begda) = 1 THEN 1 ELSE 0 END)
                    - (CASE WHEN DATEPART(WEEKDAY, l.endda) = 7 THEN 1 ELSE 0 END)
                ) AS TotalLeaveDaysExcludingWeekends
            FROM attendance.casual_leave_info l
            INNER JOIN attendance.employee_details e ON l.employee_id = e.employee_id
            WHERE FORMAT(l.endda, 'yyyy-MM') = @monthFilter
                AND l.status = 'Approved'
                ${
                  siteFilter !== "ALL SITES"
                    ? `
                    AND EXISTS (
                        SELECT 1 FROM attendance.department_site_details dsd
                        INNER JOIN attendance.site_details s ON dsd.site_id = s.site_id
                        WHERE dsd.department_site_id = e.department_site_id 
                        AND s.site_name = @siteFilter
                    )
                `
                    : ""
                }
            GROUP BY l.employee_id
        `;

    // ============================================================================
    // QUERY 5: Tour Days (Current Month, Filtered)
    // ============================================================================
    const tourDaysQuery = `
            SELECT 
                t.employee_id AS Employee_ID,
                SUM(
                    DATEDIFF(DAY, t.begda, t.endda) + 1
                    - ((DATEDIFF(WEEK, t.begda, t.endda)) * 2)
                    - (CASE WHEN DATEPART(WEEKDAY, t.begda) = 1 THEN 1 ELSE 0 END)
                    - (CASE WHEN DATEPART(WEEKDAY, t.endda) = 7 THEN 1 ELSE 0 END)
                ) AS TotalTourDaysExcludingWeekends
            FROM attendance.tour_leave_info t
            INNER JOIN attendance.employee_details e ON t.employee_id = e.employee_id
            WHERE FORMAT(t.endda, 'yyyy-MM') = @monthFilter
                AND t.status = 'Approved'
                ${
                  siteFilter !== "ALL SITES"
                    ? `
                    AND EXISTS (
                        SELECT 1 FROM attendance.department_site_details dsd
                        INNER JOIN attendance.site_details s ON dsd.site_id = s.site_id
                        WHERE dsd.department_site_id = e.department_site_id 
                        AND s.site_name = @siteFilter
                    )
                `
                    : ""
                }
            GROUP BY t.employee_id
        `;

    // ============================================================================
    // QUERY 6: Absent Days (Based on No First Punch on Working Days)
    // ============================================================================
    // ============================================================================
    // QUERY 6: Absent Days (Based on No First Punch on Working Days) - FIXED
    // ============================================================================
    const absentDaysQuery = `
WITH WorkingDays AS (
    -- Get all unique working days (weekdays) in the selected month
    SELECT DISTINCT CAST(rec_timestamp AS DATE) AS WorkDate
    FROM attendance.attendance_data
    WHERE FORMAT(CAST(rec_timestamp AS DATE), 'yyyy-MM') = @monthFilter
        AND DATEPART(WEEKDAY, CAST(rec_timestamp AS DATE)) NOT IN (1, 7)
),
AllEmployees AS (
    -- Get all active employees (with site filter if applicable)
    SELECT DISTINCT e.employee_id
    FROM attendance.employee_details e
    WHERE e.is_active = 1
        ${
          siteFilter !== "ALL SITES"
            ? `
            AND EXISTS (
                SELECT 1 FROM attendance.department_site_details dsd
                INNER JOIN attendance.site_details s ON dsd.site_id = s.site_id
                WHERE dsd.department_site_id = e.department_site_id 
                AND s.site_name = @siteFilter
            )
        `
            : ""
        }
),
EmployeePresentDays AS (
    -- Count days each employee was present (had at least one IN punch)
    SELECT 
        a.employee_id,
        CAST(a.rec_timestamp AS DATE) AS AttendanceDate
    FROM attendance.attendance_data a
    INNER JOIN AllEmployees ae ON a.employee_id = ae.employee_id
    WHERE FORMAT(CAST(a.rec_timestamp AS DATE), 'yyyy-MM') = @monthFilter
        AND a.punch_type = 'IN'
    GROUP BY a.employee_id, CAST(a.rec_timestamp AS DATE)
),
EmployeeAbsentDays AS (
    -- Calculate absent days by comparing total working days vs present days
    SELECT 
        ae.employee_id,
        (SELECT COUNT(*) FROM WorkingDays) AS TotalWorkingDays,
        COUNT(DISTINCT epd.AttendanceDate) AS PresentDays,
        (SELECT COUNT(*) FROM WorkingDays) - COUNT(DISTINCT epd.AttendanceDate) AS AbsentDays
    FROM AllEmployees ae
    LEFT JOIN EmployeePresentDays epd ON ae.employee_id = epd.employee_id
    GROUP BY ae.employee_id
)
SELECT 
    employee_id AS Employee_ID,
    AbsentDays AS TotalAbsentDays
FROM EmployeeAbsentDays
WHERE AbsentDays > 0
`;

    // ============================================================================
    // QUERY 7: Monthly Employee Counts (Over Time)
    // ============================================================================
    const monthlyEmployeeCountsQuery = `
            SELECT 
                FORMAT(CAST(rec_timestamp AS DATE), 'yyyy-MM') AS Month,
                COUNT(DISTINCT employee_id) AS EmployeeCount
            FROM attendance.attendance_data
            GROUP BY FORMAT(CAST(rec_timestamp AS DATE), 'yyyy-MM')
            ORDER BY Month
        `;
    const sites = await pool.request().query(`
          SELECT site_name 
          FROM attendance.site_details
          ORDER BY site_name
      `);
    // ============================================================================
    // Execute All Queries in Parallel
    // ============================================================================
    const request = pool.request();
    request.input("siteFilter", sql.VarChar, siteFilter);
    request.input("monthFilter", sql.VarChar, monthFilter);

    const [
      totalEmployeesResult,
      totalSitesResult,
      absenteeTrendsResult,
      leaveDaysResult,
      tourDaysResult,
      absentDaysResult,
      monthlyEmployeeCountsResult,
      punchesTodayResult, // ✅ NEW
      employeesPerSiteResult,
    ] = await Promise.all([
      request.query(totalEmployeesQuery),
      pool.request().query(totalSitesQuery),
      pool.request().query(absenteeTrendsQuery),
      request.query(leaveDaysQuery),
      request.query(tourDaysQuery),
      request.query(absentDaysQuery),
      pool.request().query(monthlyEmployeeCountsQuery),
      pool.request().query(punchesTodayQuery), // ✅ NEW
      pool.request().query(employeesPerSiteQuery),
    ]);

    // ============================================================================
    // Process Results
    // ============================================================================
    const totalEmployees = totalEmployeesResult.recordset[0]?.total || 0;
    const totalSites = totalSitesResult.recordset[0]?.total || 0;
    const absenteeTrends = absenteeTrendsResult.recordset;
    const punchesToday = punchesTodayResult.recordset; // ✅ NEW
    const employeesPerSite = employeesPerSiteResult.recordset; // ✅ NEW
    const totalLeaveDays = leaveDaysResult.recordset.reduce(
      (acc, item) => acc + Number(item.TotalLeaveDaysExcludingWeekends || 0),
      0
    );

    const totalTourDays = tourDaysResult.recordset.reduce(
      (acc, item) => acc + Number(item.TotalTourDaysExcludingWeekends || 0),
      0
    );

    const totalAbsentDays = absentDaysResult.recordset.reduce(
      (acc, item) => acc + Number(item.TotalAbsentDays || 0),
      0
    );
    console.log("these are total absent days", absentDaysResult.recordset);

    const monthlyEmployeeCounts = monthlyEmployeeCountsResult.recordset;

    // Calculate absentee percentage change
    const absenteePercentageChange = calculatePercentageChange(absenteeTrends);

    console.log("Dashboard Data:", {
      totalEmployees,
      totalSites,
      absenteeTrends,
      totalLeaveDays,
      totalTourDays,
      totalAbsentDays,
      sites: sites.recordset,
    });

    // ============================================================================
    // Send JSON Response (For React Frontend)
    // ============================================================================
    res.status(200).json({
      success: true,
      data: {
        totalEmployees,
        totalSites,
        absenteeTrends,
        punchesToday, // ✅ NEW
        employeesPerSite,
        statistics: {
          totalLeaveDays,
          totalTourDays,
          totalAbsentDays,
        },
        monthlyEmployeeCounts,
        sites: sites.recordset,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({
      success: false,
      error: "Database Error",
      message: error.message,
    });
  } finally {
    if (pool) await pool.close();
  }
});

// Helper function to calculate percentage change

function calculatePercentageChange(trends) {
  if (!trends || trends.length < 2) return [];

  const result = [];
  for (let i = 1; i < trends.length; i++) {
    const current = trends[i].TotalAbsentees;
    const previous = trends[i - 1].TotalAbsentees;
    const percentageChange =
      previous !== 0 ? ((current - previous) / previous) * 100 : 0;

    result.push({
      Month: trends[i].Month,
      PercentageChange: percentageChange.toFixed(2),
    });
  }
  return result;
}

router.post("/login", async (req, res) => {
  const { userid, password } = req.body;

  // Validate input
  if (!userid || !password) {
    return res.status(400).json({
      success: false,
      error: "Username and password are required",
    });
  }

  let pool;
  try {
    // Connect to SQL Server
    pool = await sql.connect(config);

    // Query to get user data based on CPF_NO (userid)
    const query = `
          SELECT * 
          FROM attendance.users 
          WHERE cpf_no = @userid
      `;

    // Execute the query
    const result = await pool
      .request()
      .input("userid", sql.VarChar, userid)
      .query(query);

    if (result.recordset.length > 0) {
      const user = result.recordset[0];

      // Compare passwords using bcrypt
      const match = await bcrypt.compare(password, user.password);

      if (match) {
        // Update last login timestamp
        await pool
          .request()
          .input("userid", sql.VarChar, userid)
          .input("lastLogin", sql.DateTime, new Date()).query(`
                      UPDATE attendance.users 
                      SET last_login = @lastLogin 
                      WHERE cpf_no = @userid
                  `);

        // Set session (if using express-session)
        if (req.session) {
          req.session.user = {
            id: user.user_id,
            cpf_no: user.cpf_no,
            username: user.username,
          };
        }

        // Return JSON response for React
        return res.status(200).json({
          success: true,
          user: {
            id: user.user_id,
            cpf_no: user.cpf_no,
            username: user.username,
            lastLogin: new Date(),
          },
        });
      } else {
        return res.status(401).json({
          success: false,
          error: "Invalid username or password",
        });
      }
    } else {
      return res.status(401).json({
        success: false,
        error: "Invalid username or password",
      });
    }
  } catch (error) {
    console.error("Error during login:", error);
    return res.status(500).json({
      success: false,
      error: "Error logging in",
      message: error.message,
    });
  } finally {
    if (pool) await pool.close();
  }
});

// ============================================================================
// SIGNUP ROUTE - Updated for new database
// ============================================================================
router.post("/signup", async (req, res) => {
  const { cpf_no, username, password } = req.body;

  // Validate input
  if (!cpf_no || !username || !password) {
    return res.status(400).json({
      success: false,
      error: "CPF Number, username, and password are required",
    });
  }

  let pool;
  try {
    pool = await sql.connect(config);

    // Check if user already exists
    const checkUserQuery = `
          SELECT * FROM attendance.users 
          WHERE cpf_no = @cpf_no OR username = @username
      `;

    const existingUser = await pool
      .request()
      .input("cpf_no", sql.VarChar, cpf_no)
      .input("username", sql.VarChar, username)
      .query(checkUserQuery);

    if (existingUser.recordset.length > 0) {
      return res.status(409).json({
        success: false,
        error: "User with this CPF number or username already exists",
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const insertQuery = `
          INSERT INTO attendance.users (cpf_no, username, password, created_at)
          VALUES (@cpf_no, @username, @password, @created_at)
      `;

    await pool
      .request()
      .input("cpf_no", sql.VarChar, cpf_no)
      .input("username", sql.VarChar, username)
      .input("password", sql.VarChar, hashedPassword)
      .input("created_at", sql.DateTime, new Date())
      .query(insertQuery);

    return res.status(201).json({
      success: true,
      message: "Account created successfully!",
    });
  } catch (error) {
    console.error("Error during signup:", error);
    console.log("Request body:", req.body);

    return res.status(500).json({
      success: false,
      error: "Error creating account",
      message: error.message,
    });
  } finally {
    if (pool) await pool.close();
  }
});

// ============================================================================
// LOGOUT ROUTE
// ============================================================================
router.post("/logout", (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: "Could not log out",
        });
      }
      return res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    });
  } else {
    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  }
});

// Employee Master endpoint
// Employee Master endpoint - FIXED
router.get("/emp_master", async (req, res) => {
  const site = req.query.site || "";

  let pool;
  try {
    pool = await sql.connect(config);

    // ============================================================================
    // QUERY 1: Get all employees with their details (NO designation table)
    // ============================================================================
    let employeeQuery = `
          SELECT 
              e.employee_id,
              e.firstname,
              e.middlename,
              e.lastname,
              CONCAT(e.firstname, ' ', 
                       ISNULL(e.middlename + ' ', ''), 
                       e.lastname) AS full_name,
              d.department_name,
              s.site_name,
              e.is_active,
              e.created_at,
              des.designation_name
          FROM attendance.employee_details e
          LEFT JOIN attendance.department_site_details dsd 
              ON e.department_site_id = dsd.department_site_id
          LEFT JOIN attendance.department_details d 
              ON dsd.department_id = d.department_id
          LEFT JOIN attendance.employee_designation_details des ON des.designation_id= e.designation_id
          LEFT JOIN attendance.site_details s 
              ON dsd.site_id = s.site_id
          WHERE 1=1
      `;

    // Add filters
    const request = pool.request();

    if (site && site !== "" && site !== "ALL SITES") {
      employeeQuery += ` AND s.site_name = @site`;
      request.input("site", sql.VarChar, site);
    }

    employeeQuery += ` ORDER BY e.employee_id`;

    console.log("Executing employee query with filters:", {
      site
    });

    // ============================================================================
    // QUERY 2: Get all sites for dropdown
    // ============================================================================
    const sitesQuery = `
          SELECT DISTINCT site_id, site_name
          FROM attendance.site_details
          ORDER BY site_name
      `;

    // ============================================================================
    // QUERY 3: Get all departments for dropdown
    // ============================================================================
    const departmentsQuery = `
          SELECT DISTINCT department_id, department_name
          FROM attendance.department_details
          ORDER BY department_name
      `;

    // ============================================================================
    // Execute all queries in parallel
    // ============================================================================
    const [employeeResult, sitesResult, departmentsResult] = await Promise.all([
      request.query(employeeQuery),
      pool.request().query(sitesQuery),
      pool.request().query(departmentsQuery),
    ]);

    console.log(`Found ${employeeResult.recordset.length} employees`);

    // ============================================================================
    // Send JSON response
    // ============================================================================
    console.log({
      success: true,
      data: {
        employees: employeeResult.recordset,
        sites: sitesResult.recordset,
        departments: departmentsResult.recordset,
        filters: {
          selectedSite: site,
        },
      },
    });
    res.status(200).json({
      success: true,
      data: {
        employees: employeeResult.recordset,
        sites: sitesResult.recordset,
        departments: departmentsResult.recordset,
        filters: {
          selectedSite: site,
        },
      },
    });
  } catch (err) {
    console.error("Error fetching employee data:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch employee data",
      message: err.message,
    });
  } finally {
    if (pool) await pool.close();
  }
});
router.get("/download/emp_master", async (req, res) => {
  const site = req.query.site || "";
  const department = req.query.department || "";
  const searchTerm = req.query.searchTerm || "";

  let pool;
  try {
    pool = await sql.connect(config);

    // ============================================================================
    // Same query as the display endpoint
    // ============================================================================
    let employeeQuery = `
      SELECT 
          e.employee_id,
          CONCAT(e.firstname, ' ', 
                 ISNULL(e.middlename + ' ', ''), 
                 e.lastname) AS full_name,
          des.designation_name,
          d.department_name,
          s.site_name,
          e.is_active,
          e.created_at
      FROM attendance.employee_details e
      LEFT JOIN attendance.department_site_details dsd 
          ON e.department_site_id = dsd.department_site_id
      LEFT JOIN attendance.department_details d 
          ON dsd.department_id = d.department_id
      LEFT JOIN attendance.employee_designation_details des 
          ON des.designation_id = e.designation_id
      LEFT JOIN attendance.site_details s 
          ON dsd.site_id = s.site_id
      WHERE 1=1
    `;

    // Add filters
    const request = pool.request();

    if (site && site !== "" && site !== "ALL SITES") {
      employeeQuery += ` AND s.site_name = @site`;
      request.input("site", sql.VarChar, site);
    }

    if (department && department !== "") {
      employeeQuery += ` AND d.department_name = @department`;
      request.input("department", sql.VarChar, department);
    }

    if (searchTerm && searchTerm !== "") {
      employeeQuery += ` AND (
          e.firstname LIKE @search 
          OR e.lastname LIKE @search 
          OR e.middlename LIKE @search
          OR CAST(e.employee_id AS VARCHAR) LIKE @search
      )`;
      request.input("search", sql.VarChar, `%${searchTerm}%`);
    }

    employeeQuery += ` ORDER BY e.employee_id`;

    console.log("Executing employee download query with filters:", {
      site,
      department,
      searchTerm,
    });

    // Execute query
    const employeeResult = await request.query(employeeQuery);

    console.log(`Exporting ${employeeResult.recordset.length} employees to Excel`);

    // ============================================================================
    // Create Excel file using ExcelJS
    // ============================================================================
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Employee Data");

    // Define columns with headers
    worksheet.columns = [
      { header: "ID", key: "employee_id", width: 10 },
      { header: "Name", key: "full_name", width: 30 },
      { header: "Designation", key: "designation_name", width: 25 },
      { header: "Department", key: "department_name", width: 25 },
      { header: "Site", key: "site_name", width: 20 },
      { header: "Status", key: "is_active", width: 12 },
      { header: "Created At", key: "created_at", width: 20 },
    ];

    // Style the header row
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    };
    worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    // Add data rows
    employeeResult.recordset.forEach((employee) => {
      worksheet.addRow({
        employee_id: employee.employee_id,
        full_name: employee.full_name,
        designation_name: employee.designation_name || "N/A",
        department_name: employee.department_name || "N/A",
        site_name: employee.site_name || "N/A",
        is_active: employee.is_active ? "Active" : "Inactive",
        created_at: employee.created_at
          ? moment(employee.created_at).format("YYYY-MM-DD HH:mm:ss")
          : "N/A",
      });
    });

    // Add borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    // Generate filename with timestamp
    const timestamp = moment().format("YYYY-MM-DD_HH-mm-ss");
    const filename = `Employee_Data_${timestamp}.xlsx`;

    // Set response headers for download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Write workbook to response
    await workbook.xlsx.write(res);
    res.end();

    console.log(`✅ Excel file "${filename}" downloaded successfully`);
  } catch (err) {
    console.error("Error generating Excel file:", err);
    res.status(500).json({
      success: false,
      error: "Failed to generate Excel file",
      message: err.message,
    });
  } finally {
    if (pool) await pool.close();
  }
});

// ============================================================================
// GET SINGLE EMPLOYEE DETAILS
// ============================================================================
router.get("/emp_master/:id", async (req, res) => {
  const employeeId = req.params.id;
  let pool;

  try {
    pool = await sql.connect(config);

    const query = `
          SELECT 
              e.employee_id,
              e.firstname,
              e.middlename,
              e.lastname,
              CONCAT(e.firstname, ' ', 
                     ISNULL(e.middlename + ' ', ''), 
                     e.lastname) AS full_name,
              d.department_name,
              dt.designation_type_name,
              s.site_name,
              e.is_active,
              e.created_at,
              -- Get attendance summary
              (SELECT COUNT(DISTINCT CAST(rec_timestamp AS DATE))
               FROM attendance.attendance_data 
               WHERE employee_id = e.employee_id 
                 AND punch_type = 'IN'
                 AND MONTH(rec_timestamp) = MONTH(GETDATE())
                 AND YEAR(rec_timestamp) = YEAR(GETDATE())
              ) AS current_month_attendance,
              -- Get leave summary
              (SELECT COUNT(*) 
               FROM attendance.casual_leave_info 
               WHERE employee_id = e.employee_id 
                 AND status = 'Approved'
                 AND YEAR(begda) = YEAR(GETDATE())
              ) AS total_leaves_this_year,
              -- Get tour summary
              (SELECT COUNT(*) 
               FROM attendance.tour_leave_info 
               WHERE employee_id = e.employee_id 
                 AND status = 'Approved'
                 AND YEAR(begda) = YEAR(GETDATE())
              ) AS total_tours_this_year
          FROM attendance.employee_details e
          LEFT JOIN attendance.department_site_details dsd 
              ON e.department_site_id = dsd.department_site_id
          LEFT JOIN attendance.department_details d 
              ON dsd.department_id = d.department_id
          LEFT JOIN attendance.[employee_designation_details] dt 
              ON e.designation_id = dt.designation_id
          LEFT JOIN attendance.site_details s 
              ON dsd.site_id = s.site_id
          WHERE e.employee_id = @employeeId
      `;

    const result = await pool
      .request()
      .input("employeeId", sql.Int, employeeId)
      .query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Employee not found",
      });
    }

    res.status(200).json({
      success: true,
      data: result.recordset[0],
    });
  } catch (err) {
    console.error("Error fetching employee details:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch employee details",
      message: err.message,
    });
  } finally {
    if (pool) await pool.close();
  }
});

// Punching Data endpoint - Updated for new database
router.get("/punching", async (req, res) => {
  // Default times: 7:00 AM and 7:15 AM
  const defaultTime1 = "07:00:00";
  const defaultTime2 = "07:15:00";

  let time1 = req.query.time1 || defaultTime1;
  let time2 = req.query.time2 || defaultTime2;
  let fromDate = req.query.fromDate;
  let toDate = req.query.toDate;
  const site = req.query.site;

  let pool;
  try {
    pool = await sql.connect(config);

    // ============================================================================
    // QUERY 1: Get all sites for dropdown
    // ============================================================================
    const sitesQuery = `
          SELECT DISTINCT site_id, site_name
          FROM attendance.site_details
          ORDER BY site_name
      `;
    const siteResult = await pool.request().query(sitesQuery);

    // If required params are missing, return form data only
    if (!fromDate || !toDate || !site) {
      return res.status(200).json({
        success: true,
        data: {
          sites: siteResult.recordset,
          time1,
          time2,
          filters: { fromDate, toDate, site },
        },
      });
    }

    // ============================================================================
    // QUERY 2: Get punching data with first punch of each day
    // ============================================================================
    const punchingQuery = `
          WITH FirstPunchCTE AS (
              SELECT
                  a.employee_id,
                  CAST(a.rec_timestamp AS DATE) AS PunchDate,
                  MIN(a.rec_timestamp) AS FirstPunchDateTime
              FROM attendance.attendance_data a
              WHERE a.rec_timestamp >= @fromDate 
                AND a.rec_timestamp < DATEADD(DAY, 1, @toDate)
                AND a.punch_type = 'IN'
              GROUP BY a.employee_id, CAST(a.rec_timestamp AS DATE)
          )
          SELECT
              a.employee_id AS ID,
              CONCAT(e.firstname, ' ', 
                     ISNULL(e.middlename + ' ', ''), 
                     e.lastname) AS Name,
              '' AS designation,  -- No designation table
              d.department_name AS Department,
              FORMAT(a.rec_timestamp, 'ddd MMM dd yyyy HH:mm:ss') AS [Punch Date & Time],
              CASE
                  WHEN CAST(a.rec_timestamp AS TIME) > @time1 THEN 'YES'
                  ELSE 'ON TIME'
              END AS [Is Late after Time 1?],
              CASE
                  WHEN CAST(a.rec_timestamp AS TIME) > @time1 THEN
                      CONVERT(VARCHAR, DATEADD(SECOND, 
                          DATEDIFF(SECOND, @time1, CAST(a.rec_timestamp AS TIME)), 0), 108)
                  ELSE '0:00:00'
              END AS [Delayed from Time1],
              CASE
                  WHEN CAST(a.rec_timestamp AS TIME) > @time2 THEN 'YES'
                  ELSE 'CAME BEFORE ' + @time2
              END AS [Is Late after Time 2?],
              CASE
                  WHEN CAST(a.rec_timestamp AS TIME) > @time2 THEN
                      CONVERT(VARCHAR, DATEADD(SECOND, 
                          DATEDIFF(SECOND, @time2, CAST(a.rec_timestamp AS TIME)), 0), 108)
                  ELSE '0:00:00'
              END AS [Delayed from Time 2],
              DATEPART(WEEKDAY, a.rec_timestamp) - 1 AS DOWeek
          FROM attendance.attendance_data a
          JOIN FirstPunchCTE fp 
              ON a.employee_id = fp.employee_id 
              AND a.rec_timestamp = fp.FirstPunchDateTime
          JOIN attendance.employee_details e 
              ON a.employee_id = e.employee_id
          LEFT JOIN attendance.department_site_details dsd 
              ON e.department_site_id = dsd.department_site_id
          LEFT JOIN attendance.department_details d 
              ON dsd.department_id = d.department_id
          LEFT JOIN attendance.site_details s 
              ON dsd.site_id = s.site_id
          WHERE (s.site_name = @site OR @site = 'ALL SITES')
          ORDER BY a.rec_timestamp DESC
      `;

    const request = pool.request();
    request.input("time1", sql.VarChar, time1);
    request.input("time2", sql.VarChar, time2);
    request.input("fromDate", sql.DateTime, fromDate);
    request.input("toDate", sql.DateTime, toDate);
    request.input("site", sql.VarChar, site);

    const result = await request.query(punchingQuery);
    const results = result.recordset;

    // Calculate statistics
    const lateAfterTime1Count = results.filter(
      (r) => r["Is Late after Time 1?"] === "YES"
    ).length;

    const onTimeAfterTime1Count = results.filter(
      (r) => r["Is Late after Time 1?"] === "ON TIME"
    ).length;

    const lateAfterTime2Count = results.filter(
      (r) => r["Is Late after Time 2?"] === "YES"
    ).length;

    const onTimeAfterTime2Count = results.filter(
      (r) => r["Is Late after Time 2?"] === `CAME BEFORE ${time2}`
    ).length;

    console.log(`Found ${results.length} punching records`);
    console.log("Statistics:", {
      lateAfterTime1Count,
      onTimeAfterTime1Count,
      lateAfterTime2Count,
      onTimeAfterTime2Count,
    });

    // ============================================================================
    // Send JSON response
    // ============================================================================
    res.status(200).json({
      success: true,
      data: {
        punchingData: results,
        sites: siteResult.recordset,
        statistics: {
          lateAfterTime1Count,
          onTimeAfterTime1Count,
          lateAfterTime2Count,
          onTimeAfterTime2Count,
          totalRecords: results.length,
        },
        filters: {
          time1,
          time2,
          fromDate,
          toDate,
          site,
        },
      },
    });
  } catch (err) {
    console.error("Error fetching punching data:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch punching data",
      message: err.message,
    });
  } finally {
    if (pool) await pool.close();
  }
});

router.get("/download/punching", async (req, res) => {
  const defaultTime1 = "07:00:00";
  const defaultTime2 = "07:15:00";

  let time1 = req.query.time1 || defaultTime1;
  let time2 = req.query.time2 || defaultTime2;
  let fromDate = req.query.fromDate;
  let toDate = req.query.toDate;
  const site = req.query.site;
  const searchTerm = req.query.search || "";

  let pool;
  try {
    pool = await sql.connect(config);

    // Same query as display endpoint
    const punchingQuery = `
      WITH FirstPunchCTE AS (
          SELECT
              a.employee_id,
              CAST(a.rec_timestamp AS DATE) AS PunchDate,
              MIN(a.rec_timestamp) AS FirstPunchDateTime
          FROM attendance.attendance_data a
          WHERE a.rec_timestamp >= @fromDate 
            AND a.rec_timestamp < DATEADD(DAY, 1, @toDate)
            AND a.punch_type = 'IN'
          GROUP BY a.employee_id, CAST(a.rec_timestamp AS DATE)
      )
      SELECT
          a.employee_id AS ID,
          CONCAT(e.firstname, ' ', 
                 ISNULL(e.middlename + ' ', ''), 
                 e.lastname) AS Name,
          des.designation_name AS designation,
          d.department_name AS Department,
          FORMAT(a.rec_timestamp, 'ddd MMM dd yyyy HH:mm:ss') AS [Punch Date & Time],
          CASE
              WHEN CAST(a.rec_timestamp AS TIME) > @time1 THEN 'YES'
              ELSE 'ON TIME'
          END AS [Is Late after Time 1?],
          CASE
              WHEN CAST(a.rec_timestamp AS TIME) > @time1 THEN
                  CONVERT(VARCHAR, DATEADD(SECOND, 
                      DATEDIFF(SECOND, @time1, CAST(a.rec_timestamp AS TIME)), 0), 108)
              ELSE '0:00:00'
          END AS [Delayed from Time1],
          CASE
              WHEN CAST(a.rec_timestamp AS TIME) > @time2 THEN 'YES'
              ELSE 'CAME BEFORE ' + @time2
          END AS [Is Late after Time 2?],
          CASE
              WHEN CAST(a.rec_timestamp AS TIME) > @time2 THEN
                  CONVERT(VARCHAR, DATEADD(SECOND, 
                      DATEDIFF(SECOND, @time2, CAST(a.rec_timestamp AS TIME)), 0), 108)
              ELSE '0:00:00'
          END AS [Delayed from Time 2]
      FROM attendance.attendance_data a
      JOIN FirstPunchCTE fp 
          ON a.employee_id = fp.employee_id 
          AND a.rec_timestamp = fp.FirstPunchDateTime
      JOIN attendance.employee_details e 
          ON a.employee_id = e.employee_id
      LEFT JOIN attendance.employee_designation_details des 
          ON e.designation_id = des.designation_id
      LEFT JOIN attendance.department_site_details dsd 
          ON e.department_site_id = dsd.department_site_id
      LEFT JOIN attendance.department_details d 
          ON dsd.department_id = d.department_id
      LEFT JOIN attendance.site_details s 
          ON dsd.site_id = s.site_id
      WHERE (s.site_name = @site OR @site = 'ALL SITES')
    `;

    // Add search filter
    let finalQuery = punchingQuery;
    if (searchTerm && searchTerm !== "") {
      finalQuery += ` AND (
        CAST(a.employee_id AS VARCHAR) LIKE @search
        OR e.firstname LIKE @search 
        OR e.lastname LIKE @search 
        OR e.middlename LIKE @search
      )`;
    }

    finalQuery += ` ORDER BY a.rec_timestamp DESC`;

    const request = pool.request();
    request.input("time1", sql.VarChar, time1);
    request.input("time2", sql.VarChar, time2);
    request.input("fromDate", sql.DateTime, fromDate);
    request.input("toDate", sql.DateTime, toDate);
    request.input("site", sql.VarChar, site);

    if (searchTerm && searchTerm !== "") {
      request.input("search", sql.VarChar, `%${searchTerm}%`);
    }

    const result = await request.query(finalQuery);
    console.log(`Exporting ${result.recordset.length} punching records to Excel`);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Punching Data");

    // Define columns
    worksheet.columns = [
      { header: "ID", key: "ID", width: 10 },
      { header: "Name", key: "Name", width: 30 },
      { header: "Designation", key: "designation", width: 25 },
      { header: "Department", key: "Department", width: 25 },
      { header: "Punch Date & Time", key: "Punch Date & Time", width: 30 },
      { header: "Is Late after Time 1?", key: "Is Late after Time 1?", width: 20 },
      { header: "Delayed from Time1", key: "Delayed from Time1", width: 20 },
      { header: "Is Late after Time 2?", key: "Is Late after Time 2?", width: 20 },
      { header: "Delayed from Time 2", key: "Delayed from Time 2", width: 20 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    };
    worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    // Add data rows
    result.recordset.forEach((record) => {
      worksheet.addRow(record);
    });

    // Add borders
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    // Generate filename
    const timestamp = moment().format("YYYY-MM-DD_HH-mm-ss");
    const filename = `Punching_Data_${timestamp}.xlsx`;

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Write and send
    await workbook.xlsx.write(res);
    res.end();

    console.log(`✅ Excel file "${filename}" downloaded successfully`);
  } catch (err) {
    console.error("Error generating punching Excel file:", err);
    res.status(500).json({
      success: false,
      error: "Failed to generate Excel file",
      message: err.message,
    });
  } finally {
    if (pool) await pool.close();
  }
});

// Casual Leave Info endpoint - CORRECTED
router.get("/leaveinfo", async (req, res) => {
  const holidays = req.query.holidays ? req.query.holidays.split(",") : [];
  const site = req.query.site || "";
  const fromDate = req.query.fromDate || "";
  const toDate = req.query.toDate || "";

  let pool;
  try {
    pool = await sql.connect(config);

    // ============================================================================
    // QUERY 1: Get all sites for filter dropdown
    // ============================================================================
    const sitesQuery = `
          SELECT DISTINCT site_id, site_name
          FROM attendance.site_details
          ORDER BY site_name
      `;
    const sitesResult = await pool.request().query(sitesQuery);

    // ============================================================================
    // QUERY 2: Get casual leave information with employee details
    // ============================================================================
    let leaveQuery = `
          SELECT 
              l.leave_id,
              l.employee_id,
              l.begda,
              l.endda,
              l.status,
              l.reason,
              CONCAT(e.firstname, ' ', 
                     ISNULL(e.middlename + ' ', ''), 
                     e.lastname) AS employee_name,
              d.department_name,
              s.site_name,
              -- Calculate total days excluding weekends
              (DATEDIFF(DAY, l.begda, l.endda) + 1 
              - ((DATEPART(WEEK, l.endda) - DATEPART(WEEK, l.begda)) * 2)
              - (CASE WHEN DATEPART(WEEKDAY, l.begda) = 1 THEN 1 ELSE 0 END)
              - (CASE WHEN DATEPART(WEEKDAY, l.endda) = 7 THEN 1 ELSE 0 END)
              ) AS total_leave_days_excluding_weekends
          FROM attendance.casual_leave_info l
          JOIN attendance.employee_details e 
              ON l.employee_id = e.employee_id
          LEFT JOIN attendance.department_site_details dsd 
              ON e.department_site_id = dsd.department_site_id
          LEFT JOIN attendance.department_details d 
              ON dsd.department_id = d.department_id
          LEFT JOIN attendance.site_details s 
              ON dsd.site_id = s.site_id
          WHERE 1=1
      `;

    const request = pool.request();

    // Add filters
    if (site && site !== "" && site !== "ALL SITES") {
      leaveQuery += ` AND s.site_name = @site`;
      request.input("site", sql.VarChar, site);
    }

    if (fromDate && fromDate !== "") {
      leaveQuery += ` AND l.begda >= @fromDate`;
      request.input("fromDate", sql.Date, fromDate);
    }

    if (toDate && toDate !== "") {
      leaveQuery += ` AND l.endda <= @toDate`;
      request.input("toDate", sql.Date, toDate);
    }

    leaveQuery += ` ORDER BY l.begda DESC`;

    console.log("Executing leave query with filters:", {
      site,
      fromDate,
      toDate,
    });
    const leaveResults = await request.query(leaveQuery);

    // ============================================================================
    // QUERY 3: Get total leave days per employee (without duplication)
    // ============================================================================
    const totalsQuery = `
          SELECT 
              employee_id,
              SUM(total_leave_days_excluding_weekends) AS total_leave_days_without_duplication
          FROM (
              SELECT 
                  employee_id,
                  (DATEDIFF(DAY, begda, endda) + 1
                  - ((DATEPART(WEEK, endda) - DATEPART(WEEK, begda)) * 2)
                  - (CASE WHEN DATEPART(WEEKDAY, begda) = 1 THEN 1 ELSE 0 END)
                  - (CASE WHEN DATEPART(WEEKDAY, endda) = 7 THEN 1 ELSE 0 END)
                  ) AS total_leave_days_excluding_weekends,
                  begda,
                  endda
              FROM attendance.casual_leave_info
              WHERE status = 'Approved'
          ) AS LeaveDays
          GROUP BY employee_id
      `;
    const totalsResults = await pool.request().query(totalsQuery);

    // ============================================================================
    // Process results with holiday adjustments
    // ============================================================================
    const finalResults = leaveResults.recordset.map((row) => {
      const totalDays = totalsResults.recordset.find(
        (t) => t.employee_id === row.employee_id
      );

      let holidayCount = 0;
      let holidayList = [];

      // Parse dates
      const begdaDate = new Date(row.begda);
      begdaDate.setHours(0, 0, 0, 0);
      const enddaDate = new Date(row.endda);
      enddaDate.setHours(0, 0, 0, 0);

      // Parse holiday dates
      const holidayDates = holidays.map((holiday) => {
        const date = new Date(holiday);
        date.setHours(0, 0, 0, 0);
        return date;
      });

      // Count holidays within leave period
      for (
        let d = new Date(begdaDate);
        d <= enddaDate;
        d.setDate(d.getDate() + 1)
      ) {
        if (holidayDates.some((holiday) => holiday.getTime() === d.getTime())) {
          holidayCount += 1;
          holidayList.push(formatDate(d));
        }
      }

      // Calculate adjusted total leave days
      const adjustedTotalLeaveDays = totalDays
        ? totalDays.total_leave_days_without_duplication - holidayCount
        : row.total_leave_days_excluding_weekends - holidayCount;

      return {
        leave_id: row.leave_id,
        employee_id: row.employee_id,
        employee_name: row.employee_name,
        department_name: row.department_name,
        site_name: row.site_name,
        begda: formatDate(row.begda),
        endda: formatDate(row.endda),
        status: row.status,
        reason: row.reason,
        total_leave_days: row.total_leave_days_excluding_weekends,
        adjusted_total_leave_days: adjustedTotalLeaveDays,
        holiday_count: holidayCount,
        holidays: holidayList.length > 0 ? holidayList.join(", ") : null,
      };
    });

    console.log(`Found ${finalResults.length} leave records`);

    // ============================================================================
    // Send JSON response
    // ============================================================================
    res.status(200).json({
      success: true,
      data: {
        leaveInfo: finalResults,
        sites: sitesResult.recordset,
        filters: {
          site,
          fromDate,
          toDate,
          holidays,
        },
        statistics: {
          totalLeaves: finalResults.length,
          approvedLeaves: finalResults.filter((l) => l.status === "Approved")
            .length,
          pendingLeaves: finalResults.filter((l) => l.status === "Pending")
            .length,
        },
      },
    });
  } catch (err) {
    console.error("Error fetching leave info:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch leave information",
      message: err.message,
    });
  } finally {
    if (pool) await pool.close();
  }
});
router.get("/download/leaveinfo", async (req, res) => {
  const holidays = req.query.holidays ? req.query.holidays.split(",") : [];
  const site = req.query.site || "";
  const fromDate = req.query.fromDate || "";
  const toDate = req.query.toDate || "";
  const searchTerm = req.query.search || "";

  let pool;
  try {
    pool = await sql.connect(config);

    // Same query as display endpoint
    let leaveQuery = `
      SELECT 
          l.leave_id,
          l.employee_id,
          l.begda,
          l.endda,
          l.status,
          l.reason,
          CONCAT(e.firstname, ' ', 
                 ISNULL(e.middlename + ' ', ''), 
                 e.lastname) AS employee_name,
          d.department_name,
          s.site_name,
          (DATEDIFF(DAY, l.begda, l.endda) + 1 
          - ((DATEPART(WEEK, l.endda) - DATEPART(WEEK, l.begda)) * 2)
          - (CASE WHEN DATEPART(WEEKDAY, l.begda) = 1 THEN 1 ELSE 0 END)
          - (CASE WHEN DATEPART(WEEKDAY, l.endda) = 7 THEN 1 ELSE 0 END)
          ) AS total_leave_days_excluding_weekends
      FROM attendance.casual_leave_info l
      JOIN attendance.employee_details e 
          ON l.employee_id = e.employee_id
      LEFT JOIN attendance.department_site_details dsd 
          ON e.department_site_id = dsd.department_site_id
      LEFT JOIN attendance.department_details d 
          ON dsd.department_id = d.department_id
      LEFT JOIN attendance.site_details s 
          ON dsd.site_id = s.site_id
      WHERE 1=1
    `;

    const request = pool.request();

    if (site && site !== "" && site !== "ALL SITES") {
      leaveQuery += ` AND s.site_name = @site`;
      request.input("site", sql.VarChar, site);
    }

    if (fromDate && fromDate !== "") {
      leaveQuery += ` AND l.begda >= @fromDate`;
      request.input("fromDate", sql.Date, fromDate);
    }

    if (toDate && toDate !== "") {
      leaveQuery += ` AND l.endda <= @toDate`;
      request.input("toDate", sql.Date, toDate);
    }

    if (searchTerm && searchTerm !== "") {
      leaveQuery += ` AND (
        CAST(l.employee_id AS VARCHAR) LIKE @search
        OR e.firstname LIKE @search 
        OR e.lastname LIKE @search 
        OR e.middlename LIKE @search
      )`;
      request.input("search", sql.VarChar, `%${searchTerm}%`);
    }

    leaveQuery += ` ORDER BY l.begda DESC`;

    const leaveResults = await request.query(leaveQuery);

    // Get totals query
    const totalsQuery = `
      SELECT 
          employee_id,
          SUM(total_leave_days_excluding_weekends) AS total_leave_days_without_duplication
      FROM (
          SELECT 
              employee_id,
              (DATEDIFF(DAY, begda, endda) + 1
              - ((DATEPART(WEEK, endda) - DATEPART(WEEK, begda)) * 2)
              - (CASE WHEN DATEPART(WEEKDAY, begda) = 1 THEN 1 ELSE 0 END)
              - (CASE WHEN DATEPART(WEEKDAY, endda) = 7 THEN 1 ELSE 0 END)
              ) AS total_leave_days_excluding_weekends,
              begda,
              endda
          FROM attendance.casual_leave_info
          WHERE status = 'Approved'
      ) AS LeaveDays
      GROUP BY employee_id
    `;
    const totalsResults = await pool.request().query(totalsQuery);

    // Process results with holiday adjustments
    const finalResults = leaveResults.recordset.map((row) => {
      const totalDays = totalsResults.recordset.find(
        (t) => t.employee_id === row.employee_id
      );

      let holidayCount = 0;
      let holidayList = [];

      const begdaDate = new Date(row.begda);
      begdaDate.setHours(0, 0, 0, 0);
      const enddaDate = new Date(row.endda);
      enddaDate.setHours(0, 0, 0, 0);

      const holidayDates = holidays.map((holiday) => {
        const date = new Date(holiday);
        date.setHours(0, 0, 0, 0);
        return date;
      });

      for (
        let d = new Date(begdaDate);
        d <= enddaDate;
        d.setDate(d.getDate() + 1)
      ) {
        if (holidayDates.some((holiday) => holiday.getTime() === d.getTime())) {
          holidayCount += 1;
          holidayList.push(formatDate(d));
        }
      }

      const adjustedTotalLeaveDays = totalDays
        ? totalDays.total_leave_days_without_duplication - holidayCount
        : row.total_leave_days_excluding_weekends - holidayCount;

      return {
        employee_id: row.employee_id,
        employee_name: row.employee_name,
        department_name: row.department_name,
        site_name: row.site_name,
        begda: formatDate(row.begda),
        endda: formatDate(row.endda),
        total_leave_days: row.total_leave_days_excluding_weekends,
        adjusted_total_leave_days: adjustedTotalLeaveDays,
        status: row.status,
        holidays: holidayList.length > 0 ? holidayList.join(", ") : "-",
        reason: row.reason,
      };
    });

    console.log(`Exporting ${finalResults.length} leave records to Excel`);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Leave Information");

    // Define columns
    worksheet.columns = [
      { header: "Employee ID", key: "employee_id", width: 12 },
      { header: "Employee Name", key: "employee_name", width: 30 },
      { header: "Department", key: "department_name", width: 25 },
      { header: "Site", key: "site_name", width: 20 },
      { header: "Start Date", key: "begda", width: 15 },
      { header: "End Date", key: "endda", width: 15 },
      { header: "Total Days", key: "total_leave_days", width: 12 },
      { header: "Adjusted Days", key: "adjusted_total_leave_days", width: 15 },
      { header: "Status", key: "status", width: 12 },
      { header: "Holidays", key: "holidays", width: 25 },
      { header: "Reason", key: "reason", width: 25 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    };
    worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    // Add data rows
    finalResults.forEach((record) => {
      worksheet.addRow(record);
    });

    // Add borders
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    // Generate filename
    const timestamp = moment().format("YYYY-MM-DD_HH-mm-ss");
    const filename = `Leave_Information_${timestamp}.xlsx`;

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Write and send
    await workbook.xlsx.write(res);
    res.end();

    console.log(`✅ Excel file "${filename}" downloaded successfully`);
  } catch (err) {
    console.error("Error generating leave info Excel file:", err);
    res.status(500).json({
      success: false,
      error: "Failed to generate Excel file",
      message: err.message,
    });
  } finally {
    if (pool) await pool.close();
  }
});

// Helper function to format dates
function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// router.get("/leavereport", async (req, res) => {
//   if (req.session.user) {
//     const { site } = req.query.site || null;
//     const record_date = req.query.record_date
//       ? new Date(req.query.record_date).toISOString().split("T")[0]
//       : null;

//     const siteQuery = `
//      SELECT DISTINCT [site_name]
//       FROM [ongc_project].[hls_schema_common].[tbl_site_details]
//     `;

//     // const dateQuery = `
//     //   SELECT DISTINCT
//     //     FORMAT(
//     //       TRY_CONVERT(DATE,
//     //         SUBSTRING(a.punching_time, 10, 10),
//     //         103
//     //       ), 'yyyy-MM-dd'
//     //     ) AS record_date
//     //   FROM
//     //     [ongc_project].[hls_schema_common].attendance_sitewise_report a
//     //   INNER JOIN
//     //     [ongc_project].[hls_schema_common].tbl_ned_employee_details e ON a.Employee_ID = e.CPF_NO
//     //   WHERE
//     //     (@location = '' OR e.Location = @location)
//     //   ORDER BY
//     //     record_date;
//     // `;

//     let dataQuery = `
//       SELECT
//     a.Employee_ID,
//     e.Name,
//     e.Designation_TEXT,
//     SUBSTRING(a.punching_time, 1, CHARINDEX(' ', a.punching_time) - 1) AS punch_in_time,
//             SUBSTRING(
//                 a.punching_time,
//                 CHARINDEX(' ', a.punching_time) + 1,
//                 CHARINDEX('(I)', a.punching_time) - CHARINDEX(' ', a.punching_time) - 1
//             ) AS DATE,
//     CONVERT(VARCHAR(8),
//         DATEADD(SECOND,
//             DATEDIFF(SECOND, '09:45:00', CAST(SUBSTRING(a.punching_time, 1, CHARINDEX(' ', a.punching_time) - 1) AS TIME)),
//         0), 108) AS LATEBY,
//     e.Location
// FROM
//     [ongc_project].[hls_schema_common].attendance_sitewise_report a
// inner JOIN
//     [ongc_project].[hls_schema_common].tbl_ned_employee_details e ON a.Employee_ID = e.CPF_NO
//       WHERE
//         (@location = '' OR e.Location = @location)
//         AND
//         (@record_date IS NULL OR FORMAT(
//             TRY_CONVERT(DATE,
//                 SUBSTRING(a.punching_time, 10, 10),
//                 103
//             ), 'yyyy-MM-dd') = @record_date)
//     `;

//     const request = new sql.Request();
//     request.input("location", sql.VarChar, location || "");
//     request.input("record_date", sql.VarChar, record_date || null);

//     try {
//       const locationResults = await request.query(locationQuery);
//       const dateResults = await request.query(dateQuery);
//       const dataResults = await request.query(dataQuery);
//       res.json("Daily_sitewise_attendance", {
//         title: "Employees Daily Attendance Summary Sitewise Report",
//         data: dataResults.recordset,
//         locations: locationResults.recordset,
//         dates: dateResults.recordset,
//         selectedLocation: location,
//         selectedDate: record_date,
//       });
//     } catch (err) {
//       console.error("Query Error:", err);
//       res.status(500).send("Database Error");
//     }
//   } else {
//     res.redirect("/");
//   }
// });

// Tour Leave Info endpoint - Updated for new database
router.get("/tourinfo", async (req, res) => {
  const holidays = req.query.holidays ? req.query.holidays.split(",") : [];
  const site = req.query.site || "";
  const fromDate = req.query.fromDate || "";
  const toDate = req.query.toDate || "";

  let pool;
  try {
    pool = await sql.connect(config);

    // ============================================================================
    // QUERY 1: Get all sites for filter dropdown
    // ============================================================================
    const sitesQuery = `
          SELECT DISTINCT site_id, site_name
          FROM attendance.site_details
          ORDER BY site_name
      `;
    const sitesResult = await pool.request().query(sitesQuery);

    // ============================================================================
    // QUERY 2: Get tour leave information with employee details
    // ============================================================================
    let tourQuery = `
          SELECT 
              t.tour_id,
              t.employee_id,
              t.begda,
              t.endda,
              t.status,
              t.reason,
              CONCAT(e.firstname, ' ', 
                     ISNULL(e.middlename + ' ', ''), 
                     e.lastname) AS employee_name,
              d.department_name,
              s.site_name,
              -- Calculate total days excluding weekends
              (DATEDIFF(DAY, t.begda, t.endda) + 1 
              - ((DATEPART(WEEK, t.endda) - DATEPART(WEEK, t.begda)) * 2)
              - (CASE WHEN DATEPART(WEEKDAY, t.begda) = 1 THEN 1 ELSE 0 END)
              - (CASE WHEN DATEPART(WEEKDAY, t.endda) = 7 THEN 1 ELSE 0 END)
              ) AS total_tour_days_excluding_weekends
          FROM attendance.tour_leave_info t
          JOIN attendance.employee_details e 
              ON t.employee_id = e.employee_id
          LEFT JOIN attendance.department_site_details dsd 
              ON e.department_site_id = dsd.department_site_id
          LEFT JOIN attendance.department_details d 
              ON dsd.department_id = d.department_id
          LEFT JOIN attendance.site_details s 
              ON dsd.site_id = s.site_id
          WHERE 1=1
      `;

    const request = pool.request();

    // Add filters
    if (site && site !== "" && site !== "ALL SITES") {
      tourQuery += ` AND s.site_name = @site`;
      request.input("site", sql.VarChar, site);
    }

    if (fromDate && fromDate !== "") {
      tourQuery += ` AND t.begda >= @fromDate`;
      request.input("fromDate", sql.Date, fromDate);
    }

    if (toDate && toDate !== "") {
      tourQuery += ` AND t.endda <= @toDate`;
      request.input("toDate", sql.Date, toDate);
    }

    tourQuery += ` ORDER BY t.begda DESC`;

    console.log("Executing tour query with filters:", {
      site,
      fromDate,
      toDate,
    });
    const tourResults = await request.query(tourQuery);

    // ============================================================================
    // QUERY 3: Get total tour days per employee (without duplication)
    // ============================================================================
    const totalsQuery = `
          SELECT 
              employee_id,
              SUM(total_tour_days_excluding_weekends) AS total_tour_days_without_duplication
          FROM (
              SELECT 
                  employee_id,
                  (DATEDIFF(DAY, begda, endda) + 1
                  - ((DATEPART(WEEK, endda) - DATEPART(WEEK, begda)) * 2)
                  - (CASE WHEN DATEPART(WEEKDAY, begda) = 1 THEN 1 ELSE 0 END)
                  - (CASE WHEN DATEPART(WEEKDAY, endda) = 7 THEN 1 ELSE 0 END)
                  ) AS total_tour_days_excluding_weekends,
                  begda,
                  endda
              FROM attendance.tour_leave_info
              WHERE status = 'Approved'
          ) AS TourDays
          GROUP BY employee_id
      `;
    const totalsResults = await pool.request().query(totalsQuery);

    // ============================================================================
    // Process results with holiday adjustments
    // ============================================================================
    const finalResults = tourResults.recordset.map((row) => {
      const totalDays = totalsResults.recordset.find(
        (t) => t.employee_id === row.employee_id
      );

      let holidayCount = 0;
      let holidayList = [];

      // Parse dates
      const begdaDate = new Date(row.begda);
      begdaDate.setHours(0, 0, 0, 0);
      const enddaDate = new Date(row.endda);
      enddaDate.setHours(0, 0, 0, 0);

      // Parse holiday dates
      const holidayDates = holidays.map((holiday) => {
        const date = new Date(holiday);
        date.setHours(0, 0, 0, 0);
        return date;
      });

      // Count holidays within tour period
      for (
        let d = new Date(begdaDate);
        d <= enddaDate;
        d.setDate(d.getDate() + 1)
      ) {
        if (holidayDates.some((holiday) => holiday.getTime() === d.getTime())) {
          holidayCount += 1;
          holidayList.push(formatDate(d));
        }
      }

      // Calculate adjusted total tour days
      const adjustedTotalTourDays = totalDays
        ? totalDays.total_tour_days_without_duplication - holidayCount
        : row.total_tour_days_excluding_weekends - holidayCount;

      return {
        tour_id: row.tour_id,
        employee_id: row.employee_id,
        employee_name: row.employee_name,
        department_name: row.department_name,
        site_name: row.site_name,
        begda: formatDate(row.begda),
        endda: formatDate(row.endda),
        status: row.status,
        reason: row.reason,
        total_tour_days: row.total_tour_days_excluding_weekends,
        adjusted_total_tour_days: adjustedTotalTourDays,
        holiday_count: holidayCount,
        holidays: holidayList.length > 0 ? holidayList.join(", ") : null,
      };
    });

    console.log(`Found ${finalResults.length} tour records`);

    // ============================================================================
    // Send JSON response
    // ============================================================================
    res.status(200).json({
      success: true,
      data: {
        tourInfo: finalResults,
        sites: sitesResult.recordset,
        filters: {
          site,
          fromDate,
          toDate,
          holidays,
        },
        statistics: {
          totalTours: finalResults.length,
          approvedTours: finalResults.filter((t) => t.status === "Approved")
            .length,
          pendingTours: finalResults.filter((t) => t.status === "Pending")
            .length,
        },
      },
    });
  } catch (err) {
    console.error("Error fetching tour info:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch tour information",
      message: err.message,
    });
  } finally {
    if (pool) await pool.close();
  }
});

router.get("/download/tourinfo", async (req, res) => {
  const holidays = req.query.holidays ? req.query.holidays.split(",") : [];
  const site = req.query.site || "";
  const fromDate = req.query.fromDate || "";
  const toDate = req.query.toDate || "";
  const searchTerm = req.query.searchTerm || "";

  let pool;
  try {
    pool = await sql.connect(config);

    // Same query as display endpoint
    let tourQuery = `
      SELECT 
          t.tour_id,
          t.employee_id,
          t.begda,
          t.endda,
          t.status,
          t.reason,
          CONCAT(e.firstname, ' ', 
                 ISNULL(e.middlename + ' ', ''), 
                 e.lastname) AS employee_name,
          d.department_name,
          s.site_name,
          (DATEDIFF(DAY, t.begda, t.endda) + 1 
          - ((DATEPART(WEEK, t.endda) - DATEPART(WEEK, t.begda)) * 2)
          - (CASE WHEN DATEPART(WEEKDAY, t.begda) = 1 THEN 1 ELSE 0 END)
          - (CASE WHEN DATEPART(WEEKDAY, t.endda) = 7 THEN 1 ELSE 0 END)
          ) AS total_tour_days_excluding_weekends
      FROM attendance.tour_leave_info t
      JOIN attendance.employee_details e 
          ON t.employee_id = e.employee_id
      LEFT JOIN attendance.department_site_details dsd 
          ON e.department_site_id = dsd.department_site_id
      LEFT JOIN attendance.department_details d 
          ON dsd.department_id = d.department_id
      LEFT JOIN attendance.site_details s 
          ON dsd.site_id = s.site_id
      WHERE 1=1
    `;

    const request = pool.request();

    if (site && site !== "" && site !== "ALL SITES") {
      tourQuery += ` AND s.site_name = @site`;
      request.input("site", sql.VarChar, site);
    }

    if (fromDate && fromDate !== "") {
      tourQuery += ` AND t.begda >= @fromDate`;
      request.input("fromDate", sql.Date, fromDate);
    }

    if (toDate && toDate !== "") {
      tourQuery += ` AND t.endda <= @toDate`;
      request.input("toDate", sql.Date, toDate);
    }

    if (searchTerm && searchTerm !== "") {
      tourQuery += ` AND (
        CAST(t.employee_id AS VARCHAR) LIKE @search
        OR e.firstname LIKE @search 
        OR e.lastname LIKE @search 
        OR e.middlename LIKE @search
      )`;
      request.input("search", sql.VarChar, `%${searchTerm}%`);
    }

    tourQuery += ` ORDER BY t.begda DESC`;

    const tourResults = await request.query(tourQuery);

    // Get totals query
    const totalsQuery = `
      SELECT 
          employee_id,
          SUM(total_tour_days_excluding_weekends) AS total_tour_days_without_duplication
      FROM (
          SELECT 
              employee_id,
              (DATEDIFF(DAY, begda, endda) + 1
              - ((DATEPART(WEEK, endda) - DATEPART(WEEK, begda)) * 2)
              - (CASE WHEN DATEPART(WEEKDAY, begda) = 1 THEN 1 ELSE 0 END)
              - (CASE WHEN DATEPART(WEEKDAY, endda) = 7 THEN 1 ELSE 0 END)
              ) AS total_tour_days_excluding_weekends,
              begda,
              endda
          FROM attendance.tour_leave_info
          WHERE status = 'Approved'
      ) AS TourDays
      GROUP BY employee_id
    `;
    const totalsResults = await pool.request().query(totalsQuery);

    // Process results with holiday adjustments
    const finalResults = tourResults.recordset.map((row) => {
      const totalDays = totalsResults.recordset.find(
        (t) => t.employee_id === row.employee_id
      );

      let holidayCount = 0;
      let holidayList = [];

      const begdaDate = new Date(row.begda);
      begdaDate.setHours(0, 0, 0, 0);
      const enddaDate = new Date(row.endda);
      enddaDate.setHours(0, 0, 0, 0);

      const holidayDates = holidays.map((holiday) => {
        const date = new Date(holiday);
        date.setHours(0, 0, 0, 0);
        return date;
      });

      for (
        let d = new Date(begdaDate);
        d <= enddaDate;
        d.setDate(d.getDate() + 1)
      ) {
        if (holidayDates.some((holiday) => holiday.getTime() === d.getTime())) {
          holidayCount += 1;
          holidayList.push(formatDate(d));
        }
      }

      const adjustedTotalTourDays = totalDays
        ? totalDays.total_tour_days_without_duplication - holidayCount
        : row.total_tour_days_excluding_weekends - holidayCount;

      return {
        employee_id: row.employee_id,
        employee_name: row.employee_name,
        department_name: row.department_name,
        site_name: row.site_name,
        begda: formatDate(row.begda),
        endda: formatDate(row.endda),
        total_tour_days: row.total_tour_days_excluding_weekends,
        adjusted_total_tour_days: adjustedTotalTourDays,
        status: row.status,
        holidays: holidayList.length > 0 ? holidayList.join(", ") : "-",
        reason: row.reason,
      };
    });

    console.log(`Exporting ${finalResults.length} tour records to Excel`);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Tour Information");

    // Define columns
    worksheet.columns = [
      { header: "Employee ID", key: "employee_id", width: 12 },
      { header: "Employee Name", key: "employee_name", width: 30 },
      { header: "Department", key: "department_name", width: 25 },
      { header: "Site", key: "site_name", width: 20 },
      { header: "Start Date", key: "begda", width: 15 },
      { header: "End Date", key: "endda", width: 15 },
      { header: "Total Days", key: "total_tour_days", width: 12 },
      { header: "Adjusted Days", key: "adjusted_total_tour_days", width: 15 },
      { header: "Status", key: "status", width: 12 },
      { header: "Holidays", key: "holidays", width: 25 },
      { header: "Reason", key: "reason", width: 25 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    };
    worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    // Add data rows
    finalResults.forEach((record) => {
      worksheet.addRow(record);
    });

    // Add borders
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    // Generate filename
    const timestamp = moment().format("YYYY-MM-DD_HH-mm-ss");
    const filename = `Tour_Information_${timestamp}.xlsx`;

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Write and send
    await workbook.xlsx.write(res);
    res.end();

    console.log(`✅ Excel file "${filename}" downloaded successfully`);
  } catch (err) {
    console.error("Error generating tour info Excel file:", err);
    res.status(500).json({
      success: false,
      error: "Failed to generate Excel file",
      message: err.message,
    });
  } finally {
    if (pool) await pool.close();
  }
});


// Monthly Report endpoint - Updated for new database
router.get("/monthlyreport", async (req, res) => {
  const { fromDate, toDate } = req.query;
  const site = req.query.site || "ALL SITES";
  const defaultTime1 = "07:00:00";
  const defaultTime2 = "07:15:00";
  let time1 = req.query.time1 || defaultTime1;
  let time2 = req.query.time2 || defaultTime2;

  let pool;
  try {
    pool = await sql.connect(config);

    // ============================================================================
    // If no parameters provided, return initial data (sites)
    // ============================================================================
    if (!fromDate || !toDate || !site) {
      const sitesQuery = `
              SELECT DISTINCT site_id, site_name
              FROM attendance.site_details
              ORDER BY site_name
          `;
      const siteResult = await pool.request().query(sitesQuery);

      return res.status(200).json({
        success: true,
        data: {
          sites: siteResult.recordset,
          time1,
          time2,
        },
      });
    }

    // ============================================================================
    // QUERY 1: Get all employees with details
    // ============================================================================
    const employeeQuery = `
          SELECT 
              e.employee_id,
              e.firstname,
              e.middlename,
              e.lastname,
              CONCAT(e.firstname, ' ', 
                     ISNULL(e.middlename + ' ', ''), 
                     e.lastname) AS full_name,
              d.department_name,
              des.designation_name,
              s.site_name
          FROM attendance.employee_details e
          LEFT JOIN attendance.department_site_details dsd 
              ON e.department_site_id = dsd.department_site_id
          LEFT JOIN attendance.department_details d 
              ON dsd.department_id = d.department_id
          LEFT JOIN attendance.employee_designation_details des ON des.designation_id= e.designation_id
          LEFT JOIN attendance.site_details s 
              ON dsd.site_id = s.site_id
          WHERE (s.site_name = @site OR @site = 'ALL SITES')
      `;

    const employeeResult = await pool
      .request()
      .input("site", sql.VarChar, site)
      .query(employeeQuery);

    // Get sites for dropdown
    const sitesQuery = `
          SELECT DISTINCT site_id, site_name
          FROM attendance.site_details
          ORDER BY site_name
      `;
    const siteResult = await pool.request().query(sitesQuery);

    // ============================================================================
    // QUERY 2: Get punch data with first punch analysis
    // ============================================================================
    const punchDataQuery = `
          WITH FirstPunches AS (
              SELECT
                  a.employee_id,
                  MIN(a.rec_timestamp) AS FirstPunchTimestamp
              FROM attendance.attendance_data a
              WHERE a.rec_timestamp >= @fromDate 
                AND a.rec_timestamp < DATEADD(DAY, 1, @toDate)
                AND a.punch_type = 'IN'
              GROUP BY a.employee_id, CAST(a.rec_timestamp AS DATE)
          )
          SELECT 
              fp.employee_id AS Employee_ID,
              COUNT(CASE WHEN CAST(fp.FirstPunchTimestamp AS TIME) > @time1 THEN 1 END) AS NoOfDaysBeyond10,
              SUM(CASE WHEN CAST(fp.FirstPunchTimestamp AS TIME) > @time1 THEN 
                  CAST(DATEDIFF(SECOND, @time1, CAST(fp.FirstPunchTimestamp AS TIME)) AS BIGINT)
              END) AS TotalTimeDelayBeyond10InSeconds,
              
              COUNT(CASE WHEN CAST(fp.FirstPunchTimestamp AS TIME) > @time2 THEN 1 END) AS NoOfDaysBeyond1015,
              SUM(CASE WHEN CAST(fp.FirstPunchTimestamp AS TIME) > @time2 THEN 
                  CAST(DATEDIFF(SECOND, @time2, CAST(fp.FirstPunchTimestamp AS TIME)) AS BIGINT)
              END) AS TotalTimeDelayBeyond1015InSeconds
          FROM FirstPunches fp
          GROUP BY fp.employee_id
      `;

    const punchDataResult = await pool
      .request()
      .input("fromDate", sql.DateTime, fromDate)
      .input("toDate", sql.DateTime, toDate)
      .input("time1", sql.VarChar, time1)
      .input("time2", sql.VarChar, time2)
      .query(punchDataQuery);

    // ============================================================================
    // QUERY 3: Get casual leave days
    // ============================================================================
    const leaveDaysQuery = `
          SELECT 
              employee_id AS Employee_ID,
              SUM(
                  DATEDIFF(DAY, begda, endda) + 1
                  - ((DATEPART(WEEK, endda) - DATEPART(WEEK, begda)) * 2)
                  - (CASE WHEN DATEPART(WEEKDAY, begda) = 1 THEN 1 ELSE 0 END)
                  - (CASE WHEN DATEPART(WEEKDAY, endda) = 7 THEN 1 ELSE 0 END)
              ) AS TotalTourDaysWithoutDuplication
          FROM attendance.casual_leave_info
          WHERE begda >= @fromDate AND endda <= @toDate
            AND status = 'Approved'
          GROUP BY employee_id
      `;

    const leaveDaysResult = await pool
      .request()
      .input("fromDate", sql.DateTime, fromDate)
      .input("toDate", sql.DateTime, toDate)
      .query(leaveDaysQuery);

    // ============================================================================
    // QUERY 4: Get tour leave days
    // ============================================================================
    const tourDaysQuery = `
          SELECT 
              employee_id AS Employee_ID,
              SUM(
                  DATEDIFF(DAY, begda, endda) + 1
                  - ((DATEPART(WEEK, endda) - DATEPART(WEEK, begda)) * 2)
                  - (CASE WHEN DATEPART(WEEKDAY, begda) = 1 THEN 1 ELSE 0 END)
                  - (CASE WHEN DATEPART(WEEKDAY, endda) = 7 THEN 1 ELSE 0 END)
              ) AS TotalTourDaysWithoutDuplication
          FROM attendance.tour_leave_info
          WHERE begda >= @fromDate AND endda <= @toDate
            AND status = 'Approved'
          GROUP BY employee_id
      `;

    const tourDaysResult = await pool
      .request()
      .input("fromDate", sql.DateTime, fromDate)
      .input("toDate", sql.DateTime, toDate)
      .query(tourDaysQuery);
    // ============================================================================
    // QUERY 5: Get absentee data with working days calculation
    // ============================================================================
    const absenteesQuery = `
            WITH WorkingDays AS (
                SELECT CAST(@fromDate AS DATE) AS WorkDate
                UNION ALL
                SELECT DATEADD(DAY, 1, WorkDate)
                FROM WorkingDays
                WHERE DATEADD(DAY, 1, WorkDate) <= @toDate
            ),
            FilteredWorkingDays AS (
                SELECT WorkDate
                FROM WorkingDays
                WHERE DATENAME(WEEKDAY, WorkDate) IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
            ),
            PresentDays AS (
                SELECT 
                    a.employee_id AS Employee_ID,
                    COUNT(DISTINCT CAST(a.rec_timestamp AS DATE)) AS PresentDays
                FROM attendance.attendance_data a
                WHERE a.rec_timestamp >= @fromDate 
                  AND a.rec_timestamp < DATEADD(DAY, 1, @toDate)
                  AND a.punch_type = 'IN'
                GROUP BY a.employee_id
            ),
            TotalWorkingDays AS (
                SELECT COUNT(WorkDate) AS TotalDays
                FROM FilteredWorkingDays
            )
            SELECT 
                e.employee_id AS Employee_ID,
                ISNULL(twd.TotalDays, 0) AS TotalWorkingDays,
                ISNULL(pd.PresentDays, 0) AS PresentDays,
                CASE 
                    WHEN ISNULL(twd.TotalDays, 0) - ISNULL(pd.PresentDays, 0) < 0 THEN 0
                    ELSE ISNULL(twd.TotalDays, 0) - ISNULL(pd.PresentDays, 0)
                END AS AbsentDays
            FROM attendance.employee_details e
            CROSS JOIN TotalWorkingDays twd
            LEFT JOIN PresentDays pd ON e.employee_id = pd.Employee_ID
            OPTION (MAXRECURSION 0)
        `;

    const absenteesResult = await pool
      .request()
      .input("fromDate", sql.DateTime, fromDate)
      .input("toDate", sql.DateTime, toDate)
      .query(absenteesQuery);

    // ============================================================================
    // QUERY 6: Summary statistics
    // ============================================================================
    const summaryQuery = `
            DECLARE @workingDays INT;
            
            WITH WorkingDays AS (
                SELECT CAST(@fromDate AS DATE) AS WorkDate
                UNION ALL
                SELECT DATEADD(DAY, 1, WorkDate)
                FROM WorkingDays
                WHERE DATEADD(DAY, 1, WorkDate) <= @toDate
            ),
            FilteredWorkingDays AS (
                SELECT WorkDate
                FROM WorkingDays
                WHERE DATENAME(WEEKDAY, WorkDate) IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
            )
            SELECT @workingDays = COUNT(WorkDate)
            FROM FilteredWorkingDays
            OPTION (MAXRECURSION 0);

            DECLARE @totalEmployees INT;
            SET @totalEmployees = (
                SELECT COUNT(DISTINCT e.employee_id)
                FROM attendance.employee_details e
            );

            DECLARE @latePunches10_00 INT;
            WITH FirstPunches AS (
                SELECT a.employee_id, MIN(a.rec_timestamp) AS FirstPunchTimestamp
                FROM attendance.attendance_data a
                WHERE a.rec_timestamp >= @fromDate 
                  AND a.rec_timestamp < DATEADD(DAY, 1, @toDate)
                  AND a.punch_type = 'IN'
                GROUP BY a.employee_id, CAST(a.rec_timestamp AS DATE)
            )
            SELECT @latePunches10_00 = COUNT(DISTINCT employee_id)
            FROM FirstPunches
            WHERE CAST(FirstPunchTimestamp AS TIME) > @time1;

            DECLARE @latePunches10_15 INT;
            WITH FirstPunches AS (
                SELECT a.employee_id, MIN(a.rec_timestamp) AS FirstPunchTimestamp
                FROM attendance.attendance_data a
                WHERE a.rec_timestamp >= @fromDate 
                  AND a.rec_timestamp < DATEADD(DAY, 1, @toDate)
                  AND a.punch_type = 'IN'
                GROUP BY a.employee_id, CAST(a.rec_timestamp AS DATE)
            )
            SELECT @latePunches10_15 = COUNT(DISTINCT employee_id)
            FROM FirstPunches
            WHERE CAST(FirstPunchTimestamp AS TIME) > @time2;

            SELECT 
                @workingDays AS No_of_Working_Days_in_the_Month,
                @totalEmployees AS Total_Employees_in_the_Month,
                @latePunches10_00 AS No_of_Times_beyond_Time1,
                @latePunches10_15 AS No_of_Times_beyond_Time2
        `;

    const summaryResult = await pool
      .request()
      .input("fromDate", sql.DateTime, fromDate)
      .input("toDate", sql.DateTime, toDate)
      .input("time1", sql.VarChar, time1)
      .input("time2", sql.VarChar, time2)
      .query(summaryQuery);

    // ============================================================================
    // Combine all results by employee
    // ============================================================================
    const combinedResults = employeeResult.recordset.map((employee) => {
      const punchData =
        punchDataResult.recordset.find(
          (p) => p.Employee_ID == employee.employee_id
        ) || {};

      const leaveData =
        leaveDaysResult.recordset.find(
          (l) => l.Employee_ID == employee.employee_id
        ) || {};

      const tourData =
        tourDaysResult.recordset.find(
          (t) => t.Employee_ID == employee.employee_id
        ) || {};

      const absenteeData =
        absenteesResult.recordset.find(
          (a) => a.Employee_ID == employee.employee_id
        ) || {};

      return {
        employee_id: employee.employee_id,
        full_name: employee.full_name,
        department_name: employee.department_name || "N/A",
        designation: employee.designation_name,
        site_name: employee.site_name || "N/A",
        NoOfDaysBeyond10: punchData.NoOfDaysBeyond10 || 0,
        TotalTimeDelayBeyond10: punchData.TotalTimeDelayBeyond10InSeconds
          ? formatTime(punchData.TotalTimeDelayBeyond10InSeconds)
          : "00:00:00",
        NoOfDaysBeyond1015: punchData.NoOfDaysBeyond1015 || 0,
        TotalTimeDelayBeyond1015: punchData.TotalTimeDelayBeyond1015InSeconds
          ? formatTime(punchData.TotalTimeDelayBeyond1015InSeconds)
          : "00:00:00",
        TotalEACSAbsentDays: absenteeData.AbsentDays || 0,
        TotalLeaveDays: leaveData.TotalTourDaysWithoutDuplication || 0,
        TotalDaysOnTour: tourData.TotalTourDaysWithoutDuplication || 0,
      };
    });

    // ============================================================================
    // Calculate Late Punches Statistics by percentage ranges
    // ============================================================================
    const latePunchesStatistics = {
      ">80%": { Beyond10: 0, Beyond1015: 0 },
      "70-80%": { Beyond10: 0, Beyond1015: 0 },
      "60-70%": { Beyond10: 0, Beyond1015: 0 },
      "50-60%": { Beyond10: 0, Beyond1015: 0 },
      "40-50%": { Beyond10: 0, Beyond1015: 0 },
      "30-40%": { Beyond10: 0, Beyond1015: 0 },
      "20-30%": { Beyond10: 0, Beyond1015: 0 },
      "<20%": { Beyond10: 0, Beyond1015: 0 },
    };

    const totalWorkingDays =
      summaryResult.recordset[0].No_of_Working_Days_in_the_Month;

    punchDataResult.recordset.forEach((record) => {
      const daysBeyond10Percent =
        (record.NoOfDaysBeyond10 / totalWorkingDays) * 100;
      const daysBeyond1015Percent =
        (record.NoOfDaysBeyond1015 / totalWorkingDays) * 100;

      const range = getRange(daysBeyond10Percent);
      if (range) {
        latePunchesStatistics[range].Beyond10++;
      }

      const range1015 = getRange(daysBeyond1015Percent);
      if (range1015) {
        latePunchesStatistics[range1015].Beyond1015++;
      }
    });

    function getRange(percent) {
      if (percent > 80) return ">80%";
      if (percent > 70) return "70-80%";
      if (percent > 60) return "60-70%";
      if (percent > 50) return "50-60%";
      if (percent > 40) return "40-50%";
      if (percent > 30) return "30-40%";
      if (percent > 20) return "20-30%";
      if (percent <= 20) return "<20%";
      return null;
    }

    // Calculate employee level statistics (add this before final response)
    const employeeLevelStats = {
      levelWise: {},
      totalOfficers: 0,
      totalStaff: 0,
    };

    // Count late punches by employee level (you'll need to add level to employee table or query)
    // For now, using placeholder logic - you should join with employee level data
    const levels = ["E9", "E8", "E7", "E6", "E5", "E4", "E3", "E2", "E1", "E0"];
    levels.forEach((level) => {
      employeeLevelStats.levelWise[level] = 0; // Calculate based on your data
    });

    // Calculate totals
    employeeLevelStats.totalOfficers = Object.values(
      employeeLevelStats.levelWise
    ).reduce((a, b) => a + b, 0);
    employeeLevelStats.totalStaff =
      combinedResults.length - employeeLevelStats.totalOfficers;

    const statistics = {
      summary: summaryResult.recordset[0],
      ...employeeLevelStats,
    };

    console.log(`Found ${combinedResults.length} employee records`);

    // ============================================================================
    // Send JSON response
    // ============================================================================
    res.status(200).json({
      success: true,
      data: {
        employees: combinedResults,
        sites: siteResult.recordset,
        statistics,
        latePunchesStatistics,
        filters: {
          site,
          fromDate,
          toDate,
          time1,
          time2,
        },
      },
    });
  } catch (err) {
    console.error("Error fetching monthly report:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch monthly report",
      message: err.message,
    });
  } finally {
    if (pool) await pool.close();
  }
});
router.get("/download/monthlyreport", async (req, res) => {
  const { fromDate, toDate } = req.query;
  const site = req.query.site || "ALL SITES";
  const defaultTime1 = "07:00:00";
  const defaultTime2 = "07:15:00";
  let time1 = req.query.time1 || defaultTime1;
  let time2 = req.query.time2 || defaultTime2;
  const searchTerm = req.query.searchTerm || "";

  let pool;
  try {
    pool = await sql.connect(config);

    // ============================================================================
    // QUERY 1: Get all employees with details
    // ============================================================================
    const employeeQuery = `
      SELECT 
          e.employee_id,
          e.firstname,
          e.middlename,
          e.lastname,
          CONCAT(e.firstname, ' ', 
                 ISNULL(e.middlename + ' ', ''), 
                 e.lastname) AS full_name,
          d.department_name,
          des.designation_name,
          s.site_name
      FROM attendance.employee_details e
      LEFT JOIN attendance.department_site_details dsd 
          ON e.department_site_id = dsd.department_site_id
      LEFT JOIN attendance.department_details d 
          ON dsd.department_id = d.department_id
      LEFT JOIN attendance.employee_designation_details des 
          ON des.designation_id = e.designation_id
      LEFT JOIN attendance.site_details s 
          ON dsd.site_id = s.site_id
      WHERE (s.site_name = @site OR @site = 'ALL SITES')
    `;

    let finalEmployeeQuery = employeeQuery;
    const request = pool.request();
    request.input("site", sql.VarChar, site);

    if (searchTerm && searchTerm !== "") {
      finalEmployeeQuery += ` AND (
        CAST(e.employee_id AS VARCHAR) LIKE @search
        OR e.firstname LIKE @search 
        OR e.lastname LIKE @search 
        OR e.middlename LIKE @search
      )`;
      request.input("search", sql.VarChar, `%${searchTerm}%`);
    }

    const employeeResult = await request.query(finalEmployeeQuery);

    // ============================================================================
    // QUERY 2: Get punch data
    // ============================================================================
    const punchDataQuery = `
      WITH FirstPunches AS (
          SELECT
              a.employee_id,
              MIN(a.rec_timestamp) AS FirstPunchTimestamp
          FROM attendance.attendance_data a
          WHERE a.rec_timestamp >= @fromDate 
            AND a.rec_timestamp < DATEADD(DAY, 1, @toDate)
            AND a.punch_type = 'IN'
          GROUP BY a.employee_id, CAST(a.rec_timestamp AS DATE)
      )
      SELECT 
          fp.employee_id AS Employee_ID,
          COUNT(CASE WHEN CAST(fp.FirstPunchTimestamp AS TIME) > @time1 THEN 1 END) AS NoOfDaysBeyond10,
          SUM(CASE WHEN CAST(fp.FirstPunchTimestamp AS TIME) > @time1 THEN 
              CAST(DATEDIFF(SECOND, @time1, CAST(fp.FirstPunchTimestamp AS TIME)) AS BIGINT)
          END) AS TotalTimeDelayBeyond10InSeconds,
          COUNT(CASE WHEN CAST(fp.FirstPunchTimestamp AS TIME) > @time2 THEN 1 END) AS NoOfDaysBeyond1015,
          SUM(CASE WHEN CAST(fp.FirstPunchTimestamp AS TIME) > @time2 THEN 
              CAST(DATEDIFF(SECOND, @time2, CAST(fp.FirstPunchTimestamp AS TIME)) AS BIGINT)
          END) AS TotalTimeDelayBeyond1015InSeconds
      FROM FirstPunches fp
      GROUP BY fp.employee_id
    `;

    const punchDataResult = await pool
      .request()
      .input("fromDate", sql.DateTime, fromDate)
      .input("toDate", sql.DateTime, toDate)
      .input("time1", sql.VarChar, time1)
      .input("time2", sql.VarChar, time2)
      .query(punchDataQuery);

    // ============================================================================
    // QUERY 3 & 4: Get leave and tour days
    // ============================================================================
    const leaveDaysQuery = `
      SELECT 
          employee_id AS Employee_ID,
          SUM(
              DATEDIFF(DAY, begda, endda) + 1
              - ((DATEPART(WEEK, endda) - DATEPART(WEEK, begda)) * 2)
              - (CASE WHEN DATEPART(WEEKDAY, begda) = 1 THEN 1 ELSE 0 END)
              - (CASE WHEN DATEPART(WEEKDAY, endda) = 7 THEN 1 ELSE 0 END)
          ) AS TotalTourDaysWithoutDuplication
      FROM attendance.casual_leave_info
      WHERE begda >= @fromDate AND endda <= @toDate AND status = 'Approved'
      GROUP BY employee_id
    `;

    const tourDaysQuery = `
      SELECT 
          employee_id AS Employee_ID,
          SUM(
              DATEDIFF(DAY, begda, endda) + 1
              - ((DATEPART(WEEK, endda) - DATEPART(WEEK, begda)) * 2)
              - (CASE WHEN DATEPART(WEEKDAY, begda) = 1 THEN 1 ELSE 0 END)
              - (CASE WHEN DATEPART(WEEKDAY, endda) = 7 THEN 1 ELSE 0 END)
          ) AS TotalTourDaysWithoutDuplication
      FROM attendance.tour_leave_info
      WHERE begda >= @fromDate AND endda <= @toDate AND status = 'Approved'
      GROUP BY employee_id
    `;

    const leaveDaysResult = await pool
      .request()
      .input("fromDate", sql.DateTime, fromDate)
      .input("toDate", sql.DateTime, toDate)
      .query(leaveDaysQuery);

    const tourDaysResult = await pool
      .request()
      .input("fromDate", sql.DateTime, fromDate)
      .input("toDate", sql.DateTime, toDate)
      .query(tourDaysQuery);

    // ============================================================================
    // QUERY 5: Get absentee data
    // ============================================================================
    const absenteesQuery = `
      WITH WorkingDays AS (
          SELECT CAST(@fromDate AS DATE) AS WorkDate
          UNION ALL
          SELECT DATEADD(DAY, 1, WorkDate)
          FROM WorkingDays
          WHERE DATEADD(DAY, 1, WorkDate) <= @toDate
      ),
      FilteredWorkingDays AS (
          SELECT WorkDate
          FROM WorkingDays
          WHERE DATENAME(WEEKDAY, WorkDate) IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
      ),
      PresentDays AS (
          SELECT 
              a.employee_id AS Employee_ID,
              COUNT(DISTINCT CAST(a.rec_timestamp AS DATE)) AS PresentDays
          FROM attendance.attendance_data a
          WHERE a.rec_timestamp >= @fromDate 
            AND a.rec_timestamp < DATEADD(DAY, 1, @toDate)
            AND a.punch_type = 'IN'
          GROUP BY a.employee_id
      ),
      TotalWorkingDays AS (
          SELECT COUNT(WorkDate) AS TotalDays
          FROM FilteredWorkingDays
      )
      SELECT 
          e.employee_id AS Employee_ID,
          ISNULL(twd.TotalDays, 0) AS TotalWorkingDays,
          ISNULL(pd.PresentDays, 0) AS PresentDays,
          CASE 
              WHEN ISNULL(twd.TotalDays, 0) - ISNULL(pd.PresentDays, 0) < 0 THEN 0
              ELSE ISNULL(twd.TotalDays, 0) - ISNULL(pd.PresentDays, 0)
          END AS AbsentDays
      FROM attendance.employee_details e
      CROSS JOIN TotalWorkingDays twd
      LEFT JOIN PresentDays pd ON e.employee_id = pd.Employee_ID
      OPTION (MAXRECURSION 0)
    `;

    const absenteesResult = await pool
      .request()
      .input("fromDate", sql.DateTime, fromDate)
      .input("toDate", sql.DateTime, toDate)
      .query(absenteesQuery);

    // ============================================================================
    // QUERY 6: Summary statistics
    // ============================================================================
    const summaryQuery = `
      DECLARE @workingDays INT;
      WITH WorkingDays AS (
          SELECT CAST(@fromDate AS DATE) AS WorkDate
          UNION ALL
          SELECT DATEADD(DAY, 1, WorkDate)
          FROM WorkingDays
          WHERE DATEADD(DAY, 1, WorkDate) <= @toDate
      ),
      FilteredWorkingDays AS (
          SELECT WorkDate
          FROM WorkingDays
          WHERE DATENAME(WEEKDAY, WorkDate) IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
      )
      SELECT @workingDays = COUNT(WorkDate)
      FROM FilteredWorkingDays
      OPTION (MAXRECURSION 0);

      DECLARE @totalEmployees INT;
      SET @totalEmployees = (SELECT COUNT(DISTINCT e.employee_id) FROM attendance.employee_details e);

      DECLARE @latePunches10_00 INT;
      WITH FirstPunches AS (
          SELECT a.employee_id, MIN(a.rec_timestamp) AS FirstPunchTimestamp
          FROM attendance.attendance_data a
          WHERE a.rec_timestamp >= @fromDate AND a.rec_timestamp < DATEADD(DAY, 1, @toDate) AND a.punch_type = 'IN'
          GROUP BY a.employee_id, CAST(a.rec_timestamp AS DATE)
      )
      SELECT @latePunches10_00 = COUNT(DISTINCT employee_id)
      FROM FirstPunches
      WHERE CAST(FirstPunchTimestamp AS TIME) > @time1;

      DECLARE @latePunches10_15 INT;
      WITH FirstPunches AS (
          SELECT a.employee_id, MIN(a.rec_timestamp) AS FirstPunchTimestamp
          FROM attendance.attendance_data a
          WHERE a.rec_timestamp >= @fromDate AND a.rec_timestamp < DATEADD(DAY, 1, @toDate) AND a.punch_type = 'IN'
          GROUP BY a.employee_id, CAST(a.rec_timestamp AS DATE)
      )
      SELECT @latePunches10_15 = COUNT(DISTINCT employee_id)
      FROM FirstPunches
      WHERE CAST(FirstPunchTimestamp AS TIME) > @time2;

      SELECT 
          @workingDays AS No_of_Working_Days_in_the_Month,
          @totalEmployees AS Total_Employees_in_the_Month,
          @latePunches10_00 AS No_of_Times_beyond_Time1,
          @latePunches10_15 AS No_of_Times_beyond_Time2
    `;

    const summaryResult = await pool
      .request()
      .input("fromDate", sql.DateTime, fromDate)
      .input("toDate", sql.DateTime, toDate)
      .input("time1", sql.VarChar, time1)
      .input("time2", sql.VarChar, time2)
      .query(summaryQuery);

    // ============================================================================
    // Combine results
    // ============================================================================
    const combinedResults = employeeResult.recordset.map((employee) => {
      const punchData =
        punchDataResult.recordset.find((p) => p.Employee_ID == employee.employee_id) || {};
      const leaveData =
        leaveDaysResult.recordset.find((l) => l.Employee_ID == employee.employee_id) || {};
      const tourData =
        tourDaysResult.recordset.find((t) => t.Employee_ID == employee.employee_id) || {};
      const absenteeData =
        absenteesResult.recordset.find((a) => a.Employee_ID == employee.employee_id) || {};

      return {
        employee_id: employee.employee_id,
        full_name: employee.full_name,
        designation: employee.designation_name || "N/A",
        department_name: employee.department_name || "N/A",
        site_name: employee.site_name || "N/A",
        NoOfDaysBeyond10: punchData.NoOfDaysBeyond10 || 0,
        TotalTimeDelayBeyond10: punchData.TotalTimeDelayBeyond10InSeconds
          ? formatTime(punchData.TotalTimeDelayBeyond10InSeconds)
          : "00:00:00",
        NoOfDaysBeyond1015: punchData.NoOfDaysBeyond1015 || 0,
        TotalTimeDelayBeyond1015: punchData.TotalTimeDelayBeyond1015InSeconds
          ? formatTime(punchData.TotalTimeDelayBeyond1015InSeconds)
          : "00:00:00",
        TotalEACSAbsentDays: absenteeData.AbsentDays || 0,
        TotalLeaveDays: leaveData.TotalTourDaysWithoutDuplication || 0,
        TotalDaysOnTour: tourData.TotalTourDaysWithoutDuplication || 0,
      };
    });

    // Calculate Late Punches Statistics
    const latePunchesStatistics = {
      ">80%": { Beyond10: 0, Beyond1015: 0 },
      "70-80%": { Beyond10: 0, Beyond1015: 0 },
      "60-70%": { Beyond10: 0, Beyond1015: 0 },
      "50-60%": { Beyond10: 0, Beyond1015: 0 },
      "40-50%": { Beyond10: 0, Beyond1015: 0 },
      "30-40%": { Beyond10: 0, Beyond1015: 0 },
      "20-30%": { Beyond10: 0, Beyond1015: 0 },
      "<20%": { Beyond10: 0, Beyond1015: 0 },
    };

    const totalWorkingDays = summaryResult.recordset[0].No_of_Working_Days_in_the_Month;

    punchDataResult.recordset.forEach((record) => {
      const daysBeyond10Percent = (record.NoOfDaysBeyond10 / totalWorkingDays) * 100;
      const daysBeyond1015Percent = (record.NoOfDaysBeyond1015 / totalWorkingDays) * 100;

      const range = getRange(daysBeyond10Percent);
      if (range) latePunchesStatistics[range].Beyond10++;

      const range1015 = getRange(daysBeyond1015Percent);
      if (range1015) latePunchesStatistics[range1015].Beyond1015++;
    });

    function getRange(percent) {
      if (percent > 80) return ">80%";
      if (percent > 70) return "70-80%";
      if (percent > 60) return "60-70%";
      if (percent > 50) return "50-60%";
      if (percent > 40) return "40-50%";
      if (percent > 30) return "30-40%";
      if (percent > 20) return "20-30%";
      if (percent <= 20) return "<20%";
      return null;
    }

    console.log(`Exporting ${combinedResults.length} monthly report records to Excel`);

    // ============================================================================
    // CREATE EXCEL WORKBOOK WITH MULTIPLE SHEETS
    // ============================================================================
    const workbook = new ExcelJS.Workbook();

    // ============================================================================
    // SHEET 1: Summary Statistics
    // ============================================================================
    const summarySheet = workbook.addWorksheet("Summary");

    // Add title
    summarySheet.mergeCells("A1:B1");
    const titleCell = summarySheet.getCell("A1");
    titleCell.value = "Monthly Report Summary";
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };

    summarySheet.getRow(1).height = 30;

    // Add summary data
    const summary = summaryResult.recordset[0];
    summarySheet.addRow(["", ""]); // Empty row
    summarySheet.addRow(["No. of Working Days in the month:", summary.No_of_Working_Days_in_the_Month]);
    summarySheet.addRow(["Total Employees in the month:", summary.Total_Employees_in_the_Month]);
    summarySheet.addRow(["", ""]);
    summarySheet.addRow(["TOTAL LATE PUNCHES DURING THE MONTH", ""]);
    summarySheet.addRow(["No. of Times beyond Time1:", summary.No_of_Times_beyond_Time1]);
    summarySheet.addRow(["No. of Times beyond Time2:", summary.No_of_Times_beyond_Time2]);

    // Style summary cells
    summarySheet.getColumn(1).width = 40;
    summarySheet.getColumn(2).width = 20;

    summarySheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
          if (rowNumber === 6) {
            cell.font = { bold: true };
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFD966" },
            };
          }
        });
      }
    });

    // ============================================================================
    // SHEET 2: Late Punches Profile
    // ============================================================================
    const latePunchSheet = workbook.addWorksheet("Late Punches Profile");

    // Add title
    latePunchSheet.mergeCells("A1:C1");
    const lpTitleCell = latePunchSheet.getCell("A1");
    lpTitleCell.value = "Late Punches Profile";
    lpTitleCell.font = { bold: true, size: 16 };
    lpTitleCell.alignment = { horizontal: "center", vertical: "middle" };
    lpTitleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF70AD47" },
    };
    latePunchSheet.getRow(1).height = 30;

    // Add headers
    latePunchSheet.addRow(["% of Days in Month", "Beyond 07:00", "Beyond 07:15"]);
    latePunchSheet.getRow(2).font = { bold: true };
    latePunchSheet.getRow(2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    };

    // Add data
    Object.entries(latePunchesStatistics).forEach(([range, data]) => {
      latePunchSheet.addRow([range, data.Beyond10, data.Beyond1015]);
    });

    // Style columns
    latePunchSheet.getColumn(1).width = 20;
    latePunchSheet.getColumn(2).width = 15;
    latePunchSheet.getColumn(3).width = 15;

    // Add borders
    latePunchSheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    // ============================================================================
    // SHEET 3: Employee Data (Main Report)
    // ============================================================================
    const dataSheet = workbook.addWorksheet("Employee Data");

    // Define columns
    dataSheet.columns = [
      { header: "CPF ID", key: "employee_id", width: 12 },
      { header: "Name", key: "full_name", width: 30 },
      { header: "Designation", key: "designation", width: 25 },
      { header: "Department", key: "department_name", width: 25 },
      { header: "Site", key: "site_name", width: 20 },
      { header: "No. of Days Beyond 07:00", key: "NoOfDaysBeyond10", width: 25 },
      { header: "Total Time Delay Beyond 07:00", key: "TotalTimeDelayBeyond10", width: 30 },
      { header: "No. of Days Beyond 07:15", key: "NoOfDaysBeyond1015", width: 25 },
      { header: "Total Time Delay Beyond 07:15", key: "TotalTimeDelayBeyond1015", width: 30 },
      { header: "Total EACS Absent Days", key: "TotalEACSAbsentDays", width: 22 },
      { header: "Total Leave Days", key: "TotalLeaveDays", width: 18 },
    ];

    // Style header
    dataSheet.getRow(1).font = { bold: true, size: 12 };
    dataSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    dataSheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    // Add data
    combinedResults.forEach((record) => {
      dataSheet.addRow(record);
    });

    // Add borders
    dataSheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    // Generate filename
    const timestamp = moment().format("YYYY-MM-DD_HH-mm-ss");
    const filename = `Monthly_Report_${timestamp}.xlsx`;

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Write and send
    await workbook.xlsx.write(res);
    res.end();

    console.log(`✅ Excel file "${filename}" downloaded successfully`);
  } catch (err) {
    console.error("Error generating monthly report Excel file:", err);
    res.status(500).json({
      success: false,
      error: "Failed to generate Excel file",
      message: err.message,
    });
  } finally {
    if (pool) await pool.close();
  }
});

// Helper function to format time from seconds to HH:MM:SS
function formatTime(seconds) {
  if (!seconds || seconds === 0) return "00:00:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(secs).padStart(2, "0")}`;
}

router.get("/download/monthlyreport", async (req, res) => {
  if (req.session.user) {
    const { fromDate, toDate } = req.query;
    const site = req.query.site || "All Sites";
    let pool1 = await sql.connect(config);
    let pool2 = await sql.connect(config2);

    if (!fromDate || !toDate || !site) {
      return res.status(400).send("fromDate, toDate, and site are required.");
    }

    try {
      // Query 1: Fetch employee details from server1 (pool1)
      const employeeQuery = `
            SELECT e.employee_id, e.first_name, d.employee_designation_type_name, dp.department_name, middle_name, last_name,site_name
            FROM [ongc_project].[hls_schema_common].[tbl_employee_details] e
            JOIN [ongc_project].[hls_schema_common].[tbl_department_site_details] dsd ON e.department_site_ref_id= dsd.ref_id
            JOIN [ongc_project].[hls_schema_common].[tbl_department_details] dp ON dsd.department_id = dp.department_id
            JOIN [ongc_project].[hls_schema_common].[tbl_site_details] dst ON dsd.site_id = dst.site_id
            JOIN [ongc_project].[hls_schema_common].[tbl_employee_designation_type_details] d ON d.employee_designation_type_id=e.designation_id
    
            where (dst.site_name=@site OR @site='ALL Sites')
            
          `;
      console.log("Executing employeeQuery on pool1");
      const employeeResult = await pool1
        .request()
        .input("site", sql.VarChar, site)
        .query(employeeQuery);

      const sitesquery = `
          SELECT DISTINCT [site_name]
          FROM [ongc_project].[hls_schema_common].[tbl_site_details]
          `;
      console.log("Executing sitesquery");
      const siteResult = await pool1.request().query(sitesquery);

      // Query 2: Fetch punch data from server2 (pool2)
      const punchDataQuery = `
            WITH FirstPunches AS (
        SELECT
            p.employee_id,
            MIN(p.rec_timestamp) AS FirstPunchTimestamp
        FROM
            [ongc_project].[hls_schema_acs_share].[tbl_attendance_raw_data] p
        WHERE
            p.rec_timestamp >= @fromDate AND p.rec_timestamp < DATEADD(DAY, 1, @toDate)
        GROUP BY
            p.employee_id, 
            CAST(p.rec_timestamp AS DATE)
    )
    SELECT 
        fp.employee_id AS Employee_ID,
        COUNT(CASE WHEN CAST(fp.FirstPunchTimestamp AS TIME) > '10:00:00' THEN 1 END) AS NoOfDaysBeyond10,
        SUM(CASE WHEN CAST(fp.FirstPunchTimestamp AS TIME) > '10:00:00' THEN 
            CAST(DATEDIFF(SECOND, '10:00:00', CAST(fp.FirstPunchTimestamp AS TIME)) AS BIGINT)
        END) AS TotalTimeDelayBeyond10InSeconds,
    
        COUNT(CASE WHEN CAST(fp.FirstPunchTimestamp AS TIME) > '10:15:00' THEN 1 END) AS NoOfDaysBeyond1015,
        SUM(CASE WHEN CAST(fp.FirstPunchTimestamp AS TIME) > '10:15:00' THEN 
            CAST(DATEDIFF(SECOND, '10:15:00', CAST(fp.FirstPunchTimestamp AS TIME)) AS BIGINT)
        END) AS TotalTimeDelayBeyond1015InSeconds
    FROM 
        FirstPunches fp
    
    GROUP BY 
        fp.employee_id;
    
          `;
      console.log("Executing punchDataQuery on pool2");
      const punchDataResult = await pool1
        .request()
        .input("fromDate", sql.VarChar, fromDate)
        .input("toDate", sql.VarChar, toDate)
        .query(punchDataQuery);
      await pool1.close();

      let pool2 = await sql.connect(config2);
      // Query 3: Fetch leave days from server2 (pool2)
      const leaveDaysQuery = `
            SELECT l.PERNR AS Employee_ID, 
              SUM(TotalTourDaysExcludingWeekends) AS TotalTourDaysWithoutDuplication
            FROM (
              SELECT li.PERNR,
                (DATEDIFF(DAY, li.BEGDA, li.ENDDA) + 1
                - ((DATEDIFF(WEEK, li.BEGDA, li.ENDDA)) * 2)
                - (CASE WHEN DATEPART(WEEKDAY, li.BEGDA) = 1 THEN 1 ELSE 0 END)
                - (CASE WHEN DATEPART(WEEKDAY, li.ENDDA) = 7 THEN 1 ELSE 0 END)
                ) AS TotalTourDaysExcludingWeekends
              FROM project.project.leaveinfo li
              WHERE li.BEGDA >= @fromDate AND li.ENDDA <= @toDate
            ) AS l  
            GROUP BY l.PERNR
          `;
      console.log("Executing leaveDaysQuery on pool2");
      const leaveDaysResult = await pool2
        .request()
        .input("fromDate", sql.DateTime, fromDate)
        .input("toDate", sql.DateTime, toDate)
        .query(leaveDaysQuery);

      // Query 4: Fetch tour days from server2 (pool2)
      const tourDaysQuery = `
            SELECT t.PERNR AS Employee_ID, 
              SUM(TotalTourDaysExcludingWeekends) AS TotalTourDaysWithoutDuplication
            FROM (
              SELECT tt.PERNR,
                (DATEDIFF(DAY, tt.BEGDA, tt.ENDDA) + 1
                - ((DATEDIFF(WEEK, tt.BEGDA, tt.ENDDA)) * 2)
                - (CASE WHEN DATEPART(WEEKDAY, tt.BEGDA) = 1 THEN 1 ELSE 0 END)
                - (CASE WHEN DATEPART(WEEKDAY, tt.ENDDA) = 7 THEN 1 ELSE 0 END)
                ) AS TotalTourDaysExcludingWeekends
              FROM project.project.TourTable tt
              WHERE tt.BEGDA >= @fromDate AND tt.ENDDA <= @toDate
            ) AS t
            GROUP BY t.PERNR
          `;
      console.log("Executing tourDaysQuery on pool2");
      const tourDaysResult = await pool2
        .request()
        .input("fromDate", sql.DateTime, fromDate)
        .input("toDate", sql.DateTime, toDate)
        .query(tourDaysQuery);

      // Query 5: Fetch absentee data from server2 (pool2)
      await pool2.close();
      // Query for absentees data

      const absenteesQuery = `
    WITH WorkingDays AS (
        -- Generate all dates between @fromDate and @toDate
        SELECT CAST(@fromDate AS DATE) AS WorkDate
        UNION ALL
        SELECT DATEADD(DAY, 1, WorkDate)
        FROM WorkingDays
        WHERE DATEADD(DAY, 1, WorkDate) <= @toDate
    ),
    FilteredWorkingDays AS (
        -- Filter to include only Monday to Friday and exclude company holidays
        SELECT WorkDate
        FROM WorkingDays
        WHERE DATENAME(WEEKDAY, WorkDate) IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
    ),
    PresentDays AS (
        -- Get the distinct days each employee punched in
        SELECT 
            p.employee_id AS Employee_ID,
            COUNT(DISTINCT CAST(p.rec_timestamp AS DATE)) AS PresentDays
        FROM 
            [ongc_project].[hls_schema_acs_share].[tbl_attendance_raw_data] p
        WHERE 
            p.rec_timestamp >= @fromDate AND p.rec_timestamp < DATEADD(DAY, 1, @toDate)
        GROUP BY 
            p.employee_id
    ),
    TotalWorkingDays AS (
        -- Get total working days count
        SELECT COUNT(WorkDate) AS TotalDays
        FROM FilteredWorkingDays
    )
    SELECT 
        e.employee_id AS Employee_ID,
        ISNULL(twd.TotalDays, 0) AS TotalWorkingDays,
        ISNULL(pd.PresentDays, 0) AS PresentDays,
        CASE 
            WHEN ISNULL(twd.TotalDays, 0) - ISNULL(pd.PresentDays, 0) < 0 THEN 0
            ELSE ISNULL(twd.TotalDays, 0) - ISNULL(pd.PresentDays, 0)
        END AS AbsentDays
    FROM 
        [ongc_project].[hls_schema_common].[tbl_employee_details] e
    CROSS JOIN 
        TotalWorkingDays twd
    LEFT JOIN 
        PresentDays pd ON e.employee_id = pd.Employee_ID;
    
        
              `;
      console.log("Executing absenteesQuery");
      // requestAbsentees.input('monthFilter', sql.VarChar, monthFilter);
      // requestAbsentees.input('locationFilter', sql.VarChar, locationFilter);
      pool1 = await sql.connect(config);
      const absenteesResult = await pool1
        .request()
        .input("fromDate", sql.DateTime, fromDate)
        .input("toDate", sql.DateTime, toDate)
        .query(absenteesQuery);

      await pool1.close();
      pool2 = await sql.connect(config2);
      // Query for level-wise late punches
      const levelWiseLatePunchesQuery = `
        SELECT e.LEVEL AS EmployeeLevel,
          COUNT(DISTINCT LatePunchSubquery.ID) AS LatePunches
        FROM (
          SELECT p.ID
          FROM project.Punch_data p
          WHERE CAST(p.PunchDateTime AS TIME) > '10:15:00'
          GROUP BY p.ID, FORMAT(p.PunchDateTime, 'yyyy-MM')
        ) AS LatePunchSubquery
        JOIN project.employeedetails e ON LatePunchSubquery.ID = e.CPF_NO
        WHERE e.LEVEL LIKE 'E_%'
        GROUP BY e.LEVEL
        ORDER BY e.LEVEL DESC;
      `;
      const requestLevelWiseLatePunches = pool2.request();
      // requestLevelWiseLatePunches.input('monthFilter', sql.VarChar, monthFilter);
      // requestLevelWiseLatePunches.input('locationFilter', sql.VarChar, locationFilter);
      const levelWiseLatePunchesResult =
        await requestLevelWiseLatePunches.query(levelWiseLatePunchesQuery);

      // Query for summarized late punches
      const sumLevelWiseLatePunchesQuery = `
        SELECT 
          CASE 
            WHEN LatePunchSubquery.LEVEL LIKE 'E%' THEN 'E% Levels'
            ELSE 'Other Levels'
          END AS EmployeeLevelCategory,
          COUNT(DISTINCT LatePunchSubquery.ID) AS LatePunches
        FROM (
          SELECT p.ID, e.LEVEL
          FROM project.Punch_data p 
          JOIN project.employeedetails e ON p.ID = e.CPF_NO
          WHERE CAST(p.PunchDateTime AS TIME) > '10:15:00'
          GROUP BY p.ID, e.LEVEL
        ) AS LatePunchSubquery
        GROUP BY 
          CASE 
            WHEN LatePunchSubquery.LEVEL LIKE 'E%' THEN 'E% Levels'
            ELSE 'Other Levels'
          END
        ORDER BY EmployeeLevelCategory DESC;
      `;
      const requestSumLevelWiseLatePunches = pool2.request();
      // requestSumLevelWiseLatePunches.input('monthFilter', sql.VarChar, monthFilter);
      // requestSumLevelWiseLatePunches.input('locationFilter', sql.VarChar, locationFilter);
      const sumLevelWiseLatePunchesResult =
        await requestSumLevelWiseLatePunches.query(
          sumLevelWiseLatePunchesQuery
        );

      // Query for overall statistics summary
      const summaryQuery = `
        DECLARE @workingDays INT;
        SET @workingDays = (
          SELECT COUNT(DISTINCT FORMAT(PunchDateTime, 'yyyy-MM-dd'))
          FROM project.Punch_data
        );
    
        DECLARE @totalEmployees INT;
        SET @totalEmployees = (
          SELECT COUNT(DISTINCT e.CPF_NO)
          FROM project.employeedetails e
          JOIN project.Punch_data p ON e.CPF_NO = p.ID
        );
    
        DECLARE @latePunches10_00 INT;
        SET @latePunches10_00 = (
          SELECT COUNT(Distinct ID)
          FROM project.Punch_data p
          WHERE CAST(p.PunchDateTime AS TIME) > '10:00:00'
        );
    
        DECLARE @latePunches10_15 INT;
        SET @latePunches10_15 = (
          SELECT COUNT(distinct ID)
          FROM project.Punch_data p
          WHERE CAST(p.PunchDateTime AS TIME) > '10:15:00'
        );
    
        SELECT 
          @workingDays AS [No_of_Working_Days_in_the_Month],
          @totalEmployees AS [Total_Employees_in_the_Month],
          @latePunches10_00 AS [No_of_Times_beyond_10:00],
          @latePunches10_15 AS [No_of_Times_beyond_10:15];
      `;
      const requestSummary = pool2.request();
      const summaryResult = await requestSummary.query(summaryQuery);
      console.log(summaryResult);

      await pool2.close(); // Close pool2 after fetching data

      // Combine the results based on employee ID
      const combinedResults = employeeResult.recordset.map((employee) => {
        const punchData =
          punchDataResult.recordset.find(
            (p) => p.Employee_ID == employee.employee_id
          ) || {};
        const leaveData =
          leaveDaysResult.recordset.find(
            (l) => l.Employee_ID == employee.employee_id
          ) || {};
        const tourData =
          tourDaysResult.recordset.find(
            (t) => t.Employee_ID == employee.employee_id
          ) || {};
        const absenteeData =
          absenteesResult.recordset.find(
            (a) => a.Employee_ID == employee.employee_id
          ) || {};

        return {
          ...employee,
          NoOfDaysBeyond10: punchData.NoOfDaysBeyond10 || 0,
          TotalTimeDelayBeyond10: punchData.TotalTimeDelayBeyond10InSeconds
            ? formatTime(punchData.TotalTimeDelayBeyond10InSeconds)
            : "00:00:00",
          NoOfDaysBeyond1015: punchData.NoOfDaysBeyond1015 || 0,
          TotalTimeDelayBeyond1015: punchData.TotalTimeDelayBeyond1015InSeconds
            ? formatTime(punchData.TotalTimeDelayBeyond1015InSeconds)
            : "00:00:00",
          TotalEACSAbsentDays: absenteeData.AbsentDays || 0,
          TotalLeaveDays: leaveData.TotalTourDaysWithoutDuplication || 0,
          TotalDaysOnTour: tourData.TotalTourDaysWithoutDuplication || 0,
        };
      });
      const punchData = punchDataResult.recordset;
      const leaveDays = leaveDaysResult.recordset;
      const tourDays = tourDaysResult.recordset;

      const combinedData = punchData.map((punch) => {
        const employeeLeaveDays =
          leaveDays.find((l) => l.Employee_ID == punch.Employee_ID) || {};
        const employeeTourDays =
          tourDays.find((t) => t.Employee_ID == punch.Employee_ID) || {};
        return {
          ...punch,
          TotalLeaveDays: employeeLeaveDays.TotalLeaveDays || 0,
          TotalTourDays: employeeTourDays.TotalTourDays || 0,
        };
      });

      const latePunchesStatistics = {
        ">80%": { Beyond10: 0, Beyond1015: 0 },
        "70-80%": { Beyond10: 0, Beyond1015: 0 },
        "60-70%": { Beyond10: 0, Beyond1015: 0 },
        "50-60%": { Beyond10: 0, Beyond1015: 0 },
        "40-50%": { Beyond10: 0, Beyond1015: 0 },
        "30-40%": { Beyond10: 0, Beyond1015: 0 },
        "20-30%": { Beyond10: 0, Beyond1015: 0 },
        "<20%": { Beyond10: 0, Beyond1015: 0 },
      };

      const totalWorkingDays =
        summaryResult.recordset[0].No_of_Working_Days_in_the_Month;

      punchDataResult.recordset.forEach((record) => {
        const daysBeyond10Percent =
          (record.NoOfDaysBeyond10 / totalWorkingDays) * 100;
        const daysBeyond1015Percent =
          (record.NoOfDaysBeyond1015 / totalWorkingDays) * 100;

        const range = getRange(daysBeyond10Percent);
        if (range) {
          latePunchesStatistics[range].Beyond10++;
        }

        const range1015 = getRange(daysBeyond1015Percent);
        if (range1015) {
          latePunchesStatistics[range1015].Beyond1015++;
        }
      });

      function getRange(percent) {
        if (percent > 80) return ">80%";
        if (percent > 70) return "70-80%";
        if (percent > 60) return "60-70%";
        if (percent > 50) return "50-60%";
        if (percent > 40) return "40-50%";
        if (percent > 30) return "30-40%";
        if (percent > 20) return "20-30%";
        if (percent <= 20) return "<20%";
        return null;
      }

      const statistics = {
        levelWiseLatePunches: levelWiseLatePunchesResult.recordset,
        sumLevelWiseLatePunches: sumLevelWiseLatePunchesResult.recordset,
        sumlevelwiseofothers: sumLevelWiseLatePunchesResult.recordset[1],
        sumlevelwiseofE: sumLevelWiseLatePunchesResult.recordset[0],
        summary: summaryResult.recordset[0],
      };
      console.log(statistics, latePunchesStatistics);
      // Prepare Excel sheet using ExcelJS
      // Prepare Excel sheet using ExcelJS
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Monthly Report");

      // Employee Level Section
      worksheet.mergeCells("A1:A3");
      worksheet.getCell("A1").value = "Employee Level";
      worksheet.getCell("A1").font = {
        bold: true,
        color: { argb: "FFFFFF" },
        size: 13,
      };
      worksheet.getCell("A1").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "A52A2A" },
      };
      worksheet.getCell("A1").alignment = {
        vertical: "middle",
        horizontal: "center",
      };

      worksheet.mergeCells("B1:B3");
      worksheet.getCell("B1").value = "Late Punches";
      worksheet.getCell("B1").font = {
        bold: true,
        color: { argb: "FFFFFF" },
        size: 13,
      };
      worksheet.getCell("B1").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "A52A2A" },
      };
      worksheet.getCell("B1").alignment = {
        vertical: "middle",
        horizontal: "center",
      };

      const employeeLevels = [
        "E9",
        "E8",
        "E7",
        "E6",
        "E5",
        "E4",
        "E3",
        "E2",
        "E1",
        "E0",
        "Total Officers",
        "Staff",
      ];
      employeeLevels.forEach((level, index) => {
        const rowNumber = 4 + index;
        worksheet.getCell(`A${rowNumber}`).value = level;
        const latePunchesData = statistics.levelWiseLatePunches[index];
        if (latePunchesData) {
          worksheet.getCell(`B${rowNumber}`).value =
            latePunchesData.LatePunches;
        } else {
          worksheet.getCell(`B${rowNumber}`).value =
            statistics.sumLevelWiseLatePunches[index - 10].LatePunches; // or some default value
        }
      });

      // Late Punches Profile Section
      worksheet.mergeCells("C1:E1");
      worksheet.getCell("C1").value = "Late Punches Profile";
      worksheet.getCell("C1").font = {
        bold: true,
        color: { argb: "FFFFFF" },
        size: 15,
      };
      worksheet.getCell("C1").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "556B2F" },
      };
      worksheet.getCell("C1").alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      worksheet.mergeCells("C2:C3");
      worksheet.getCell("C2").value = "% of Days in Month";
      worksheet.getCell("C2").font = { color: { argb: "FFFF00" }, size: 9 };
      worksheet.mergeCells("D2:E2");
      worksheet.getCell("D2").value = "% Employees in Band";
      worksheet.getCell("D3").value = "Beyond 10:00";
      worksheet.getCell("E3").value = "Beyond 10:15";

      const bands = [
        ">80%",
        "70-80%",
        "60-70%",
        "50-60%",
        "40-50%",
        "30-40%",
        "20-30%",
        "<20%",
      ];
      bands.forEach((band, index) => {
        const rowNumber = 4 + index;
        worksheet.getCell(`C${rowNumber}`).value = band;
        const bandData = latePunchesStatistics[band];
        if (bandData) {
          worksheet.getCell(`D${rowNumber}`).value = bandData.Beyond10;
          worksheet.getCell(`E${rowNumber}`).value = bandData.Beyond1015;
        } else {
          console.error(`No data found for band ${band}`);
          worksheet.getCell(`D${rowNumber}`).value = 0; // or some default value
          worksheet.getCell(`E${rowNumber}`).value = 0; // or some default value
        }
      });

      // Summary Section
      worksheet.mergeCells("F1:I3");
      worksheet.getCell("F1").value = "Summary";
      worksheet.getCell("F1").font = {
        bold: true,
        color: { argb: "FFFFFF" },
        size: 15,
      };
      worksheet.getCell("F1").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "800000" },
      };
      worksheet.getCell("F1").alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      worksheet.mergeCells("F4:G6");
      worksheet.getCell("F4").value = "No. of Working Days in the month:";
      worksheet.mergeCells("H4:I6");
      worksheet.getCell("H4").value =
        statistics.summary.No_of_Working_Days_in_the_Month;
      worksheet.mergeCells("F7:G9");
      worksheet.getCell("F7").value = "Total Employees in the month:";
      worksheet.mergeCells("H7:I9");
      worksheet.getCell("H7").value =
        statistics.summary.Total_Employees_in_the_Month;

      worksheet.mergeCells("F10:I11");
      worksheet.getCell("F10").value = "TOTAL LATE PUNCHES DURING THE MONTH";
      worksheet.getCell("F10").font = {
        bold: true,
        color: { argb: "FFFFFF" },
        size: 12,
      };
      worksheet.getCell("F10").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "800000" },
      };
      worksheet.getCell("F10").alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      worksheet.mergeCells("F12:G12");
      worksheet.getCell("F12").value = "No. of Times beyond 10:00:";
      worksheet.mergeCells("H12:I12");
      worksheet.getCell("H12").value =
        statistics.summary["No_of_Times_beyond_10:00"];
      worksheet.mergeCells("F13:G13");
      worksheet.getCell("F13").value = "No. of Times beyond 10:15:";
      worksheet.mergeCells("H13:I13");
      worksheet.getCell("H13").value =
        statistics.summary["No_of_Times_beyond_10:00"];

      // Style cells with data
      worksheet.getColumn(1).width = 20;
      worksheet.getColumn(2).width = 15;
      worksheet.getColumn(3).width = 15;
      worksheet.getColumn(4).width = 15;
      worksheet.getColumn(5).width = 15;
      worksheet.getColumn(6).width = 15;
      worksheet.getColumn(7).width = 15;

      worksheet.getRows(1, 2, 3).forEach((row) => {
        row.font = { bold: true };
        row.alignment = { vertical: "middle", horizontal: "center" };
      });

      const tableStartRow = 18;

      // Define table headers
      const tableHeaders = [
        "Employee ID",
        "First Name",
        "Middle Name",
        "Last Name",
        "Designation",
        "Department",
        "Site Name",
        "No of Days Beyond 10:00",
        "Total Time Delay Beyond 10:00",
        "No of Days Beyond 10:15",
        "Total Time Delay Beyond 10:15",
        "Total EACS Absent Days",
        "Total Leave Days",
        "Total Days On Tour",
      ];

      // Add headers to the worksheet
      tableHeaders.forEach((header, index) => {
        const cell = worksheet.getCell(tableStartRow, index + 1); // Columns A, B, C, etc.
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "D3D3D3" }, // Light gray background
        };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      // Add data rows below headers
      const dataStartRow = tableStartRow + 1; // Row 19
      combinedResults.forEach((rowData, rowIndex) => {
        const currentRow = dataStartRow + rowIndex;
        worksheet.getCell(`A${currentRow}`).value = rowData.employee_id;
        worksheet.getCell(`B${currentRow}`).value = rowData.first_name;
        worksheet.getCell(`C${currentRow}`).value = rowData.middle_name;
        worksheet.getCell(`D${currentRow}`).value = rowData.last_name;
        worksheet.getCell(`E${currentRow}`).value =
          rowData.employee_designation_type_name;
        worksheet.getCell(`F${currentRow}`).value = rowData.department_name;
        worksheet.getCell(`G${currentRow}`).value = rowData.site_name;
        worksheet.getCell(`H${currentRow}`).value = rowData.NoOfDaysBeyond10;
        worksheet.getCell(`I${currentRow}`).value =
          rowData.TotalTimeDelayBeyond10;
        worksheet.getCell(`J${currentRow}`).value = rowData.NoOfDaysBeyond1015;
        worksheet.getCell(`K${currentRow}`).value =
          rowData.TotalTimeDelayBeyond1015;
        worksheet.getCell(`L${currentRow}`).value = rowData.TotalEACSAbsentDays;
        worksheet.getCell(`M${currentRow}`).value = rowData.TotalLeaveDays;
        worksheet.getCell(`N${currentRow}`).value = rowData.TotalDaysOnTour;

        // Optional: Format time delay cells
        worksheet.getCell(`I${currentRow}`).numFmt = "hh:mm:ss";
        worksheet.getCell(`K${currentRow}`).numFmt = "hh:mm:ss";
      });

      // Adjust column widths for better readability
      tableHeaders.forEach((header, index) => {
        worksheet.getColumn(index + 1).width = 20; // Adjust width as needed
      });

      // Send the Excel file to the client
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=Monthly_Report.xlsx"
      );
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Error generating Excel report:", error);
      res.status(500).send("Server error");
    }
  } else {
    res.redirect("/");
  }
});


module.exports = router;
