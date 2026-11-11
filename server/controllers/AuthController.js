
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

        // Thông tin trả về cho Frontend
        const sessionUser = {
            id: user.EmployeeCode,
            employeeId: user.EmployeeID,
            name: user.FullName,
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

module.exports = { login };
