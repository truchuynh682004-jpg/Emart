
const { sql, connectDB } = require("../database/connection");
const bcrypt = require("bcrypt");

// ========================================
// LẤY DANH SÁCH NHÂN VIÊN
// ========================================
exports.getAll = async (req, res) => {
    try {
        const pool = await connectDB();

        const result = await pool.request().query(`
            SELECT
                EmployeeID,
                EmployeeCode,
                FullName,
                Email,
                Phone,
                Role,
                Shift,
                Status,
                CreatedAt,
                UpdatedAt
            FROM Employees
            ORDER BY EmployeeID DESC
        `);

        return res.status(200).json({
            success: true,
            data: result.recordset
        });

    } catch (err) {
        console.error("Lỗi lấy danh sách nhân viên:", err);

        return res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách nhân viên."
        });
    }
};


// ========================================
// XEM CHI TIẾT NHÂN VIÊN
// ========================================
exports.getById = async (req, res) => {
    try {
        const employeeId = Number(req.params.id);

        if (!Number.isInteger(employeeId) || employeeId <= 0) {
            return res.status(400).json({
                success: false,
                message: "EmployeeID không hợp lệ."
            });
        }

        const pool = await connectDB();

        const result = await pool.request()
            .input("EmployeeID", sql.Int, employeeId)
            .query(`
                SELECT
                    EmployeeID,
                    EmployeeCode,
                    FullName,
                    Email,
                    Phone,
                    Role,
                    Shift,
                    Status,
                    CreatedAt,
                    UpdatedAt
                FROM Employees
                WHERE EmployeeID = @EmployeeID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy nhân viên."
            });
        }

        return res.json({
            success: true,
            data: result.recordset[0]
        });

    } catch (err) {
        console.error("Lỗi xem nhân viên:", err);

        return res.status(500).json({
            success: false,
            message: "Không thể xem thông tin nhân viên."
        });
    }
};


// ========================================
// THÊM NHÂN VIÊN
// ========================================
exports.create = async (req, res) => {
    try {
        const {
            EmployeeCode,
            FullName,
            Email,
            Password,
            Phone,
            Role,
            Shift,
            Status
        } = req.body;

        if (
            !EmployeeCode?.trim() ||
            !FullName?.trim() ||
            !Email?.trim() ||
            !Password ||
            !Role?.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập đầy đủ mã nhân viên, họ tên, email, mật khẩu và vai trò."
            });
        }

        if (Password.length < 3) {
            return res.status(400).json({
                success: false,
                message: "Mật khẩu phải có ít nhất 3 ký tự."
            });
        }

        if (Role.trim() !== "Nhân viên thu ngân") {
            return res.status(400).json({
                success: false,
                message: "Chỉ được tạo tài khoản nhân viên thu ngân."
            });
        }

        const employeeCode = EmployeeCode.trim();
        const fullName = FullName.trim();
        const email = Email.trim().toLowerCase();

        const pool = await connectDB();

        // Kiểm tra mã nhân viên và email
        const check = await pool.request()
            .input("EmployeeCode", sql.NVarChar(20), employeeCode)
            .input("Email", sql.NVarChar(100), email)
            .query(`
                SELECT EmployeeID
                FROM Employees
                WHERE EmployeeCode = @EmployeeCode
                   OR Email = @Email
            `);

        if (check.recordset.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Mã nhân viên hoặc email đã tồn tại."
            });
        }

        // Băm mật khẩu
        const passwordHash = await bcrypt.hash(Password, 10);

        const result = await pool.request()
            .input("EmployeeCode", sql.NVarChar(20), employeeCode)
            .input("FullName", sql.NVarChar(100), fullName)
            .input("Email", sql.NVarChar(100), email)
            .input("PasswordHash", sql.NVarChar(255), passwordHash)
            .input("Phone", sql.NVarChar(20), Phone?.trim() || null)
            .input("Role", sql.NVarChar(50), Role.trim())
            .input("Shift", sql.NVarChar(100), Shift?.trim() || null)
            .input("Status", sql.NVarChar(100), Status?.trim() || "Đang làm việc")
            .query(`
                INSERT INTO Employees (
                    EmployeeCode,
                    FullName,
                    Email,
                    PasswordHash,
                    Phone,
                    Role,
                    Shift,
                    Status
                )
                OUTPUT
                    INSERTED.EmployeeID,
                    INSERTED.EmployeeCode,
                    INSERTED.FullName,
                    INSERTED.Email,
                    INSERTED.Phone,
                    INSERTED.Role,
                    INSERTED.Shift,
                    INSERTED.Status,
                    INSERTED.CreatedAt
                VALUES (
                    @EmployeeCode,
                    @FullName,
                    @Email,
                    @PasswordHash,
                    @Phone,
                    @Role,
                    @Shift,
                    @Status
                )
            `);

        return res.status(201).json({
            success: true,
            message: "Thêm nhân viên thành công.",
            data: result.recordset[0]
        });

    } catch (err) {
        console.error("Lỗi thêm nhân viên:", err);

        return res.status(500).json({
            success: false,
            message: "Không thể thêm nhân viên."
        });
    }
};


// ========================================
// CẬP NHẬT THÔNG TIN NHÂN VIÊN
// ========================================
exports.update = async (req, res) => {
    try {
        const employeeId = Number(req.params.id);

        const {
            EmployeeCode,
            FullName,
            Email,
            Password,
            Phone,
            Role,
            Shift,
            Status
        } = req.body;

        if (!Number.isInteger(employeeId) || employeeId <= 0) {
            return res.status(400).json({
                success: false,
                message: "EmployeeID không hợp lệ."
            });
        }

        if (!EmployeeCode?.trim() || !FullName?.trim() || !Email?.trim() || !Role?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Mã nhân viên, họ tên, email và vai trò là bắt buộc."
            });
        }

        if (Role.trim() !== "Nhân viên thu ngân") {
            return res.status(400).json({
                success: false,
                message: "Vai trò nhân viên không hợp lệ."
            });
        }

        if (Password && Password.length < 3) {
            return res.status(400).json({
                success: false,
                message: "Mật khẩu phải có ít nhất 3 ký tự."
            });
        }

        const pool = await connectDB();

        // Kiểm tra nhân viên tồn tại
        const current = await pool.request()
            .input("EmployeeID", sql.Int, employeeId)
            .query(`
                SELECT EmployeeID, Role, Status
                FROM Employees
                WHERE EmployeeID = @EmployeeID
            `);

        if (current.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy nhân viên."
            });
        }

        if (current.recordset[0].Role === "Chủ cửa hàng") {
            return res.status(403).json({
                success: false,
                message: "Không thể chỉnh sửa tài khoản chủ cửa hàng tại chức năng này."
            });
        }

        // Kiểm tra trùng mã và email
        const check = await pool.request()
            .input("EmployeeID", sql.Int, employeeId)
            .input("EmployeeCode", sql.NVarChar(20), EmployeeCode.trim())
            .input("Email", sql.NVarChar(100), Email.trim().toLowerCase())
            .query(`
                SELECT EmployeeID
                FROM Employees
                WHERE (EmployeeCode = @EmployeeCode OR Email = @Email)
                  AND EmployeeID <> @EmployeeID
            `);

        if (check.recordset.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Mã nhân viên hoặc email đã được sử dụng."
            });
        }

        // Nếu có nhập mật khẩu mới thì băm mật khẩu
        const passwordHash = Password
            ? await bcrypt.hash(Password, 10)
            : null;

        const result = await pool.request()
            .input("EmployeeID", sql.Int, employeeId)
            .input("EmployeeCode", sql.NVarChar(20), EmployeeCode.trim())
            .input("FullName", sql.NVarChar(100), FullName.trim())
            .input("Email", sql.NVarChar(100), Email.trim().toLowerCase())
            .input("PasswordHash", sql.NVarChar(255), passwordHash)
            .input("Phone", sql.NVarChar(20), Phone?.trim() || null)
            .input("Role", sql.NVarChar(50), Role.trim())
            .input("Shift", sql.NVarChar(100), Shift?.trim() || null)
            .input("Status", sql.NVarChar(100), Status?.trim() || "Đang làm việc")
            .query(`
                UPDATE Employees
                SET
                    EmployeeCode = @EmployeeCode,
                    FullName = @FullName,
                    Email = @Email,
                    PasswordHash = COALESCE(@PasswordHash, PasswordHash),
                    Phone = @Phone,
                    Role = @Role,
                    Shift = @Shift,
                    Status = @Status,
                    UpdatedAt = GETDATE()
                OUTPUT
                    INSERTED.EmployeeID,
                    INSERTED.EmployeeCode,
                    INSERTED.FullName,
                    INSERTED.Email,
                    INSERTED.Phone,
                    INSERTED.Role,
                    INSERTED.Shift,
                    INSERTED.Status,
                    INSERTED.UpdatedAt
                WHERE EmployeeID = @EmployeeID
            `);

        return res.json({
            success: true,
            message: "Cập nhật nhân viên thành công.",
            data: result.recordset[0]
        });

    } catch (err) {
        console.error("Lỗi cập nhật nhân viên:", err);

        return res.status(500).json({
            success: false,
            message: "Không thể cập nhật nhân viên."
        });
    }
};


// ========================================
// KHÓA / MỞ KHÓA TÀI KHOẢN
// ========================================
exports.updateStatus = async (req, res) => {
    try {
        const employeeId = Number(req.params.id);
        const { Status } = req.body;

        if (!Number.isInteger(employeeId) || employeeId <= 0) {
            return res.status(400).json({
                success: false,
                message: "EmployeeID không hợp lệ."
            });
        }

        if (!Status?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng chọn trạng thái."
            });
        }

        if (Status.trim() === "Đã xóa") {
            return res.status(400).json({
                success: false,
                message: "Không thể dùng trạng thái Đã xóa tại chức năng khóa tài khoản."
            });
        }

        const pool = await connectDB();

        const check = await pool.request()
            .input("EmployeeID", sql.Int, employeeId)
            .query(`
                SELECT EmployeeID, Role
                FROM Employees
                WHERE EmployeeID = @EmployeeID
            `);

        if (check.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy nhân viên."
            });
        }

        if (check.recordset[0].Role === "Chủ cửa hàng") {
            return res.status(403).json({
                success: false,
                message: "Không thể khóa tài khoản chủ cửa hàng."
            });
        }

        const result = await pool.request()
            .input("EmployeeID", sql.Int, employeeId)
            .input("Status", sql.NVarChar(100), Status.trim())
            .query(`
                UPDATE Employees
                SET
                    Status = @Status,
                    UpdatedAt = GETDATE()
                OUTPUT
                    INSERTED.EmployeeID,
                    INSERTED.EmployeeCode,
                    INSERTED.FullName,
                    INSERTED.Status
                WHERE EmployeeID = @EmployeeID
            `);

        return res.json({
            success: true,
            message: "Cập nhật trạng thái tài khoản thành công.",
            data: result.recordset[0]
        });

    } catch (err) {
        console.error("Lỗi cập nhật trạng thái nhân viên:", err);

        return res.status(500).json({
            success: false,
            message: "Không thể cập nhật trạng thái nhân viên."
        });
    }
};


// ========================================
// XÓA NHÂN VIÊN (XÓA MỀM)
// ========================================
exports.remove = async (req, res) => {
    try {
        const employeeId = Number(req.params.id);

        if (!Number.isInteger(employeeId) || employeeId <= 0) {
            return res.status(400).json({
                success: false,
                message: "EmployeeID không hợp lệ."
            });
        }

        const pool = await connectDB();

        const check = await pool.request()
            .input("EmployeeID", sql.Int, employeeId)
            .query(`
                SELECT EmployeeID, Role, Status
                FROM Employees
                WHERE EmployeeID = @EmployeeID
            `);

        if (check.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy nhân viên."
            });
        }

        if (check.recordset[0].Role === "Chủ cửa hàng") {
            return res.status(403).json({
                success: false,
                message: "Không thể xóa tài khoản chủ cửa hàng."
            });
        }

        if (check.recordset[0].Status === "Đã xóa") {
            return res.status(400).json({
                success: false,
                message: "Nhân viên này đã được xóa trước đó."
            });
        }

        await pool.request()
            .input("EmployeeID", sql.Int, employeeId)
            .query(`
                UPDATE Employees
                SET
                    Status = N'Đã xóa',
                    UpdatedAt = GETDATE()
                WHERE EmployeeID = @EmployeeID
            `);

        return res.json({
            success: true,
            message: "Đã xóa nhân viên thành công."
        });

    } catch (err) {
        console.error("Lỗi xóa nhân viên:", err);

        return res.status(500).json({
            success: false,
            message: "Không thể xóa nhân viên."
        });
    }
};
