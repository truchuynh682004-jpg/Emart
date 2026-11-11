const sql = require("mssql");
const { connectDB } = require("../database/connection");

// 1. Lấy danh sách báo cáo kết ca
async function getAllShiftReports(req, res) {
    try {
        const pool = await connectDB();

        const result = await pool.request().query(`
            SELECT
                r.*,
                e.EmployeeCode,
                e.FullName AS EmployeeName,
                approver.FullName AS ApproverName
            FROM ShiftReports r
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
        console.error("Lỗi lấy báo cáo kết ca:", error);
        return res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách báo cáo kết ca."
        });
    }
}

// 2. Lấy chi tiết báo cáo kết ca
async function getShiftReportById(req, res) {
    try {
        const pool = await connectDB();

        const result = await pool.request()
            .input("ShiftReportID", sql.Int, Number(req.params.id))
            .query(`
                SELECT
                    r.*,
                    e.EmployeeCode,
                    e.FullName AS EmployeeName,
                    approver.FullName AS ApproverName
                FROM ShiftReports r
                INNER JOIN Employees e
                    ON r.EmployeeID = e.EmployeeID
                LEFT JOIN Employees approver
                    ON r.ApprovedBy = approver.EmployeeID
                WHERE r.ShiftReportID = @ShiftReportID;
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy báo cáo kết ca."
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
            message: "Không thể lấy chi tiết báo cáo kết ca."
        });
    }
}

// 3. Nhân viên gửi báo cáo kết ca
async function createShiftReport(req, res) {
    try {
        const {
            employeeId,
            shiftName,
            reportDate,
            totalOrders,
            totalRevenue,
            systemCash,
            systemTransfer,
            initialDrawerCash,
            expectedDrawerCash,
            actualDrawerCash,
            cashDifference,
            differenceStatus,
            totalSoldItems,
            totalStockRemaining,
            nearExpiryCount,
            lowStockCount,
            note
        } = req.body;

        if (!employeeId || !shiftName) {
            return res.status(400).json({
                success: false,
                message: "Thiếu thông tin nhân viên hoặc ca làm việc."
            });
        }

        const pool = await connectDB();

        const employee = await pool.request()
            .input("EmployeeID", sql.Int, Number(employeeId))
            .query(`
                SELECT EmployeeID
                FROM Employees
                WHERE EmployeeID = @EmployeeID
                  AND Status = N'Đang làm việc';
            `);

        if (employee.recordset.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Nhân viên không tồn tại hoặc không còn làm việc."
            });
        }

        const reportCode = "KCA" + Date.now();

        const result = await pool.request()
            .input("ReportCode", sql.NVarChar(30), reportCode)
            .input("EmployeeID", sql.Int, Number(employeeId))
            .input("ShiftName", sql.NVarChar(100), shiftName)
            .input("ReportDate", sql.Date, reportDate || new Date())
            .input("TotalOrders", sql.Int, Number(totalOrders) || 0)
            .input("TotalRevenue", sql.Decimal(18, 2), Number(totalRevenue) || 0)
            .input("SystemCash", sql.Decimal(18, 2), Number(systemCash) || 0)
            .input("SystemTransfer", sql.Decimal(18, 2), Number(systemTransfer) || 0)
            .input("InitialDrawerCash", sql.Decimal(18, 2), Number(initialDrawerCash) || 0)
            .input("ExpectedDrawerCash", sql.Decimal(18, 2), Number(expectedDrawerCash) || 0)
            .input("ActualDrawerCash", sql.Decimal(18, 2), Number(actualDrawerCash) || 0)
            .input("CashDifference", sql.Decimal(18, 2), Number(cashDifference) || 0)
            .input("DifferenceStatus", sql.NVarChar(100), differenceStatus || "")
            .input("TotalSoldItems", sql.Int, Number(totalSoldItems) || 0)
            .input("TotalStockRemaining", sql.Int, Number(totalStockRemaining) || 0)
            .input("NearExpiryCount", sql.Int, Number(nearExpiryCount) || 0)
            .input("LowStockCount", sql.Int, Number(lowStockCount) || 0)
            .input("Note", sql.NVarChar(sql.MAX), note || "")
            .query(`
                INSERT INTO ShiftReports (
                    ReportCode, EmployeeID, ShiftName, ReportDate,
                    TotalOrders, TotalRevenue, SystemCash, SystemTransfer,
                    InitialDrawerCash, ExpectedDrawerCash, ActualDrawerCash,
                    CashDifference, DifferenceStatus,
                    TotalSoldItems, TotalStockRemaining,
                    NearExpiryCount, LowStockCount, Note
                )
                OUTPUT INSERTED.ShiftReportID
                VALUES (
                    @ReportCode, @EmployeeID, @ShiftName, @ReportDate,
                    @TotalOrders, @TotalRevenue, @SystemCash, @SystemTransfer,
                    @InitialDrawerCash, @ExpectedDrawerCash, @ActualDrawerCash,
                    @CashDifference, @DifferenceStatus,
                    @TotalSoldItems, @TotalStockRemaining,
                    @NearExpiryCount, @LowStockCount, @Note
                );
            `);

        return res.status(201).json({
            success: true,
            message: "Gửi báo cáo kết ca thành công.",
            data: {
                ShiftReportID: result.recordset[0].ShiftReportID,
                ReportCode: reportCode
            }
        });

    } catch (error) {
        console.error("Lỗi gửi báo cáo kết ca:", error);
        return res.status(500).json({
            success: false,
            message: "Không thể gửi báo cáo kết ca."
        });
    }
}

// 4. Chủ cửa hàng xác nhận hoặc từ chối báo cáo
async function updateShiftReportStatus(req, res) {
    try {
        const reportId = Number(req.params.id);
        const { status, approvalNote, approvedBy } = req.body;

        if (!Number.isInteger(reportId) || reportId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Mã báo cáo không hợp lệ."
            });
        }

        if (!["Đã xác nhận", "Từ chối"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Trạng thái xử lý không hợp lệ."
            });
        }

        if (!approvedBy) {
            return res.status(400).json({
                success: false,
                message: "Thiếu thông tin người xác nhận."
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
            .input("ShiftReportID", sql.Int, reportId)
            .input("Status", sql.NVarChar(30), status)
            .input("ApprovalNote", sql.NVarChar(500), approvalNote?.trim() || null)
            .input("ApprovedBy", sql.Int, Number(approvedBy))
            .query(`
                UPDATE ShiftReports
                SET
                    Status = @Status,
                    ApprovalNote = @ApprovalNote,
                    ApprovedBy = @ApprovedBy,
                    ApprovedAt = GETDATE(),
                    UpdatedAt = GETDATE()
                WHERE ShiftReportID = @ShiftReportID
                  AND Status = N'Chờ chủ xác nhận';

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
            message: status === "Đã xác nhận"
                ? "Xác nhận báo cáo kết ca thành công."
                : "Đã từ chối báo cáo kết ca."
        });

    } catch (error) {
        console.error("Lỗi xử lý báo cáo kết ca:", error);
        return res.status(500).json({
            success: false,
            message: "Không thể xử lý báo cáo kết ca."
        });
    }
}

module.exports = {
    getAllShiftReports,
    getShiftReportById,
    createShiftReport,
    updateShiftReportStatus
};