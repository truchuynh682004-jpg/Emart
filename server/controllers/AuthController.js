
const { sql, connectDB } = require("../database/connection");
const bcrypt = require("bcrypt");

// POST /api/auth/login
async function login(req, res) {
    try {
        const { email, password, role } = req.body;

        // Kiểm tra dữ liệu đầu vào
        if (!email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập đầy đủ email, mật khẩu và vai trò!"
            });
        }

        const pool = await connectDB();

        // Tìm tài khoản trong SQL Server
        const result = await pool.request()
            .input("Email", sql.NVarChar(100), email.trim())
            .query(`
                SELECT
                    EmployeeID,
                    EmployeeCode,
                    FullName,
                    Email,
                    PasswordHash,
                    Role,
                    Shift,
                    Status
                FROM Employees
                WHERE Email = @Email
                  AND Status <> N'Đã xóa'
            `);

        const user = result.recordset[0];

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Tài khoản hoặc mật khẩu không chính xác!"
            });
        }

        // Kiểm tra mật khẩu bằng bcrypt
        const passwordMatch = await bcrypt.compare(
            password,
            user.PasswordHash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Tài khoản hoặc mật khẩu không chính xác!"
            });
        }

        // Kiểm tra vai trò
        if (user.Role !== role) {
            return res.status(403).json({
                success: false,
                message: "Tài khoản không khớp với vai trò đã chọn!"
            });
        }

        // Kiểm tra trạng thái tài khoản
        if (user.Status !== "Đang làm việc") {
            return res.status(403).json({
                success: false,
                message: `Tài khoản đang ở trạng thái "${user.Status}", không thể đăng nhập!`
            });
        }
//name: user.FullName,
// Thông tin trả về cho Frontend
const sessionUser = {
    id: user.EmployeeCode,
    employeeId: user.EmployeeID,
    name: user.Role === "Chủ cửa hàng" ? "Admin" : user.FullName,
    email: user.Email,
    role: user.Role,
    shift: user.Shift
};

        return res.status(200).json({
            success: true,
            message: "Đăng nhập thành công!",
            user: sessionUser
        });

    } catch (error) {
        console.error("Lỗi đăng nhập:", error);

        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi đăng nhập!"
        });
    }
}
// Đổi mật khẩu tài khoản đang đăng nhập
async function changePassword(req, res) {
    try {
        const { employeeId, currentPassword, newPassword } = req.body;

        if (!employeeId || !currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập đầy đủ thông tin!"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Mật khẩu mới phải có ít nhất 6 ký tự!"
            });
        }

        const pool = await connectDB();

        const result = await pool.request()
            .input("EmployeeID", sql.Int, employeeId)
            .query(`
                SELECT EmployeeID, PasswordHash
                FROM Employees
                WHERE EmployeeID = @EmployeeID
                  AND Status = N'Đang làm việc'
            `);

        const user = result.recordset[0];

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy tài khoản!"
            });
        }

        const passwordMatch = await bcrypt.compare(
            currentPassword,
            user.PasswordHash
        );

        if (!passwordMatch) {
            return res.status(400).json({
                success: false,
                message: "Mật khẩu hiện tại không chính xác!"
            });
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        await pool.request()
            .input("EmployeeID", sql.Int, employeeId)
            .input("PasswordHash", sql.NVarChar(255), newPasswordHash)
            .query(`
                UPDATE Employees
                SET PasswordHash = @PasswordHash
                WHERE EmployeeID = @EmployeeID
            `);

        return res.status(200).json({
            success: true,
            message: "Đổi mật khẩu thành công!"
        });

    } catch (error) {
        console.error("Lỗi đổi mật khẩu:", error);

        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi đổi mật khẩu!"
        });
    }
}

// Cập nhật thông tin tài khoản chủ cửa hàng
async function updateOwnerProfile(req, res) {
    try {
        const {
            email,
            currentPassword,
            fullName,
            newEmail,
            phone,
            newPassword
        } = req.body;

        if (!email || !currentPassword || !fullName || !newEmail) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập đầy đủ thông tin bắt buộc!"
            });
        }

        if (newPassword && newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Mật khẩu mới phải có ít nhất 6 ký tự!"
            });
        }

        const pool = await connectDB();

        const result = await pool.request()
            .input("Email", sql.NVarChar(255), email)
            .query(`
                SELECT EmployeeID, FullName, Email, PasswordHash, Role
                FROM Employees
                WHERE Email = @Email
                  AND Status = N'Đang làm việc'
            `);

        const user = result.recordset[0];

        if (!user || user.Role !== "Chủ cửa hàng") {
            return res.status(403).json({
                success: false,
                message: "Không có quyền cập nhật tài khoản này!"
            });
        }

        const passwordMatch = await bcrypt.compare(
            currentPassword,
            user.PasswordHash
        );

        if (!passwordMatch) {
            return res.status(400).json({
                success: false,
                message: "Mật khẩu hiện tại không chính xác!"
            });
        }

        const duplicate = await pool.request()
            .input("NewEmail", sql.NVarChar(255), newEmail)
            .input("EmployeeID", sql.Int, user.EmployeeID)
            .query(`
                SELECT EmployeeID
                FROM Employees
                WHERE Email = @NewEmail
                  AND EmployeeID <> @EmployeeID
            `);

        if (duplicate.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email này đã được sử dụng!"
            });
        }

        let query = `
            UPDATE Employees
            SET FullName = @FullName,
                Email = @NewEmail,
                Phone = @Phone,
                UpdatedAt = GETDATE()
        `;

        const request = pool.request()
            .input("EmployeeID", sql.Int, user.EmployeeID)
            .input("FullName", sql.NVarChar(100), fullName.trim())
            .input("NewEmail", sql.NVarChar(255), newEmail.trim())
            .input("Phone", sql.NVarChar(20), phone || null);

        if (newPassword) {
            const passwordHash = await bcrypt.hash(newPassword, 10);

            query += `, PasswordHash = @PasswordHash`;

            request.input(
                "PasswordHash",
                sql.NVarChar(255),
                passwordHash
            );
        }

        query += ` WHERE EmployeeID = @EmployeeID`;

        await request.query(query);

        return res.status(200).json({
            success: true,
            message: "Cập nhật thông tin thành công!",
            user: {
                employeeId: user.EmployeeID,
                name: fullName.trim(),
                email: newEmail.trim(),
                phone: phone || "",
                role: user.Role
            }
        });

    } catch (error) {
        console.error("Lỗi cập nhật hồ sơ chủ cửa hàng:", error);

        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi cập nhật thông tin!"
        });
    }
}

module.exports = {
    login,
    changePassword,
    updateOwnerProfile
};