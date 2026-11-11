
const sql = require("mssql");
const { connectDB } = require("../database/connection");

// 1. Lấy danh sách báo cáo
async function getAllReports(req, res) {
    try {
        const pool = await connectDB();

        const result = await pool.request().query(`
            SELECT
                r.ReportID,
                r.ReportCode,
                r.EmployeeID,
                e.EmployeeCode,
                e.FullName AS EmployeeName,
                r.ReportType,
                r.Title,
                r.Content,
                r.ReportDate,
                r.Status,
                r.ApprovalNote,
                r.ApprovedBy,
                approver.FullName AS ApproverName,
                r.ApprovedAt,
                r.CreatedAt,
                r.UpdatedAt
            FROM EmployeeReports r
            INNER JOIN Employees e
                ON r.EmployeeID = e.EmployeeID
            LEFT JOIN Employees approver
                ON r.ApprovedBy = approver.EmployeeID
            ORDER BY r.CreatedAt DESC;
        `);

        return res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error("Lỗi lấy báo cáo:", error);
        return res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách báo cáo."
        });
    }
}

// 2. Lấy chi tiết một báo cáo
async function getReportById(req, res) {
    try {
        const pool = await connectDB();

        const result = await pool.request()
            .input("ReportID", sql.Int, Number(req.params.id))
            .query(`
                SELECT
                    r.*,
                    e.EmployeeCode,
                    e.FullName AS EmployeeName,
                    approver.FullName AS ApproverName
                FROM EmployeeReports r
                INNER JOIN Employees e
                    ON r.EmployeeID = e.EmployeeID
                LEFT JOIN Employees approver
                    ON r.ApprovedBy = approver.EmployeeID
                WHERE r.ReportID = @ReportID;
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy báo cáo."
            });
        }

        return res.json({
            success: true,
            data: result.recordset[0]
        });
    } catch (error) {
        console.error("Lỗi lấy chi tiết báo cáo:", error);
        return res.status(500).json({
            success: false,
            message: "Không thể lấy chi tiết báo cáo."
        });
    }
}

// 3. Nhân viên gửi báo cáo
async function createReport(req, res) {
    try {
        const {
            employeeId,
            reportType,
            title,
            content,
            reportDate
        } = req.body;

        if (!employeeId || !reportType || !title || !content) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập đầy đủ thông tin báo cáo."
            });
        }

        const pool = await connectDB();

const employeeResult = await pool.request()
    .input("EmployeeID", sql.Int, Number(employeeId))
    .query(`
        SELECT EmployeeID
        FROM Employees
        WHERE EmployeeID = @EmployeeID
          AND Status = N'Đang làm việc';
    `);

        if (employeeResult.recordset.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Nhân viên không tồn tại hoặc không còn làm việc."
            });
        }

        const reportCode =
            "BC" +
            Date.now().toString();

        const result = await pool.request()
            .input("ReportCode", sql.NVarChar(30), reportCode)
            .input("EmployeeID", sql.Int, Number(employeeId))
            .input("ReportType", sql.NVarChar(50), reportType)
            .input("Title", sql.NVarChar(200), title.trim())
            .input("Content", sql.NVarChar(sql.MAX), content.trim())
            .input(
                "ReportDate",
                sql.Date,
                reportDate || new Date()
            )
            .query(`
                INSERT INTO EmployeeReports (
                    ReportCode,
                    EmployeeID,
                    ReportType,
                    Title,
                    Content,
                    ReportDate
                )
                OUTPUT INSERTED.ReportID
                VALUES (
                    @ReportCode,
                    @EmployeeID,
                    @ReportType,
                    @Title,
                    @Content,
                    @ReportDate
                );
            `);

        return res.status(201).json({
            success: true,
            message: "Gửi báo cáo thành công.",
            data: {
                ReportID: result.recordset[0].ReportID,
                ReportCode: reportCode
            }
        });
    } catch (error) {
        console.error("Lỗi gửi báo cáo:", error);
        return res.status(500).json({
            success: false,
            message: "Không thể gửi báo cáo."
        });
    }
}

// 4. Duyệt hoặc từ chối báo cáo
async function updateReportStatus(req, res) {
    try {
        const reportId = Number(req.params.id);
        const { status, approvalNote, approvedBy } = req.body;

        if (!Number.isInteger(reportId) || reportId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Mã báo cáo không hợp lệ."
            });
        }

        if (!["Đã duyệt", "Từ chối"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Trạng thái duyệt không hợp lệ."
            });
        }

        if (!approvedBy) {
            return res.status(400).json({
                success: false,
                message: "Thiếu thông tin người duyệt."
            });
        }

        if (status === "Từ chối" && !approvalNote?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập lý do từ chối."
            });
        }

        const pool = await connectDB();

        const result = await pool.request()
            .input("ReportID", sql.Int, reportId)
            .input("Status", sql.NVarChar(30), status)
            .input(
                "ApprovalNote",
                sql.NVarChar(500),
                approvalNote?.trim() || null
            )
            .input("ApprovedBy", sql.Int, Number(approvedBy))
            .query(`
                UPDATE EmployeeReports
                SET
                    Status = @Status,
                    ApprovalNote = @ApprovalNote,
                    ApprovedBy = @ApprovedBy,
                    ApprovedAt = GETDATE(),
                    UpdatedAt = GETDATE()
                WHERE ReportID = @ReportID
                  AND Status = N'Chờ duyệt';

                SELECT @@ROWCOUNT AS AffectedRows;
            `);

        if (result.recordset[0].AffectedRows === 0) {
            return res.status(400).json({
                success: false,
                message: "Báo cáo không tồn tại hoặc đã được xử lý."
            });
        }

        return res.json({
            success: true,
            message: status === "Đã duyệt"
                ? "Duyệt báo cáo thành công."
                : "Đã từ chối báo cáo."
        });
    } catch (error) {
        console.error("Lỗi cập nhật báo cáo:", error);
        return res.status(500).json({
            success: false,
            message: "Không thể cập nhật trạng thái báo cáo."
        });
    }
}

module.exports = {
    getAllReports,
    getReportById,
    createReport,
    updateReportStatus
};
