
const { sql, connectDB } = require("../database/connection");

// GET /api/customers - Lấy danh sách khách hàng
async function getAll(req, res) {
    try {
        const pool = await connectDB();

        const result = await pool.request().query(`
            SELECT
                CustomerID,
                CustomerCode,
                FullName,
                Phone,
                Email,
                Gender,
                DateOfBirth,
                Address,
                TotalPoints,
                AvailablePoints,
                TotalSpent,
                Status,
                CreatedAt,
                UpdatedAt
            FROM Customers
            WHERE Status <> N'Đã xóa'
            ORDER BY CustomerID DESC
        `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error("Lỗi lấy danh sách khách hàng:", error);
        res.status(500).json({
            success: false,
            message: "Không thể tải danh sách khách hàng!"
        });
    }
}

// GET /api/customers/:id - Lấy chi tiết khách hàng
async function getById(req, res) {
    try {
        const pool = await connectDB();

        const result = await pool.request()
            .input("CustomerID", sql.Int, Number(req.params.id))
            .query(`
                SELECT *
                FROM Customers
                WHERE CustomerID = @CustomerID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy khách hàng!"
            });
        }

        res.json({
            success: true,
            data: result.recordset[0]
        });
    } catch (error) {
        console.error("Lỗi lấy chi tiết khách hàng:", error);
        res.status(500).json({
            success: false,
            message: "Không thể lấy thông tin khách hàng!"
        });
    }
}

// POST /api/customers - Thêm khách hàng
async function create(req, res) {
    try {
        const {
            CustomerCode,
            FullName,
            Phone,
            Email,
            Gender,
            DateOfBirth,
            Address
        } = req.body;

        if (!CustomerCode || !FullName || !Phone) {
            return res.status(400).json({
                success: false,
                message: "Mã khách hàng, họ tên và số điện thoại là bắt buộc!"
            });
        }

        const pool = await connectDB();

        const duplicate = await pool.request()
            .input("CustomerCode", sql.NVarChar(20), CustomerCode.trim())
            .input("Phone", sql.NVarChar(20), Phone.trim())
            .query(`
                SELECT CustomerID
                FROM Customers
                WHERE CustomerCode = @CustomerCode
                   OR Phone = @Phone
            `);

        if (duplicate.recordset.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Mã khách hàng hoặc số điện thoại đã tồn tại!"
            });
        }

        const result = await pool.request()
            .input("CustomerCode", sql.NVarChar(20), CustomerCode.trim())
            .input("FullName", sql.NVarChar(100), FullName.trim())
            .input("Phone", sql.NVarChar(20), Phone.trim())
            .input("Email", sql.NVarChar(100), Email || null)
            .input("Gender", sql.NVarChar(10), Gender || null)
            .input("DateOfBirth", sql.Date, DateOfBirth || null)
            .input("Address", sql.NVarChar(255), Address || null)
            .query(`
                INSERT INTO Customers (
                    CustomerCode, FullName, Phone, Email,
                    Gender, DateOfBirth, Address,
                    TotalPoints, AvailablePoints, TotalSpent, Status
                )
                OUTPUT INSERTED.*
                VALUES (
                    @CustomerCode, @FullName, @Phone, @Email,
                    @Gender, @DateOfBirth, @Address,
                    0, 0, 0, N'Đang hoạt động'
                )
            `);

        res.status(201).json({
            success: true,
            message: "Thêm khách hàng thành công!",
            data: result.recordset[0]
        });
    } catch (error) {
        console.error("Lỗi thêm khách hàng:", error);
        res.status(500).json({
            success: false,
            message: "Không thể thêm khách hàng!"
        });
    }
}

// PUT /api/customers/:id - Cập nhật khách hàng
async function update(req, res) {
    try {
        const {
            FullName,
            Phone,
            Email,
            Gender,
            DateOfBirth,
            Address
        } = req.body;

        if (!FullName || !Phone) {
            return res.status(400).json({
                success: false,
                message: "Họ tên và số điện thoại là bắt buộc!"
            });
        }

        const pool = await connectDB();

        const result = await pool.request()
            .input("CustomerID", sql.Int, Number(req.params.id))
            .input("FullName", sql.NVarChar(100), FullName.trim())
            .input("Phone", sql.NVarChar(20), Phone.trim())
            .input("Email", sql.NVarChar(100), Email || null)
            .input("Gender", sql.NVarChar(10), Gender || null)
            .input("DateOfBirth", sql.Date, DateOfBirth || null)
            .input("Address", sql.NVarChar(255), Address || null)
            .query(`
                UPDATE Customers
                SET FullName = @FullName,
                    Phone = @Phone,
                    Email = @Email,
                    Gender = @Gender,
                    DateOfBirth = @DateOfBirth,
                    Address = @Address,
                    UpdatedAt = GETDATE()
                WHERE CustomerID = @CustomerID
                  AND Status <> N'Đã xóa';

                SELECT @@ROWCOUNT AS AffectedRows;
            `);

        if (result.recordset[0].AffectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy khách hàng!"
            });
        }

        res.json({
            success: true,
            message: "Cập nhật khách hàng thành công!"
        });
    } catch (error) {
        console.error("Lỗi cập nhật khách hàng:", error);
        res.status(500).json({
            success: false,
            message: "Không thể cập nhật khách hàng!"
        });
    }
}

// DELETE /api/customers/:id - Xóa mềm khách hàng
async function remove(req, res) {
    try {
        const pool = await connectDB();

        const result = await pool.request()
            .input("CustomerID", sql.Int, Number(req.params.id))
            .query(`
                UPDATE Customers
                SET Status = N'Đã xóa',
                    UpdatedAt = GETDATE()
                WHERE CustomerID = @CustomerID
                  AND Status <> N'Đã xóa';

                SELECT @@ROWCOUNT AS AffectedRows;
            `);

        if (result.recordset[0].AffectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy khách hàng hoặc khách hàng đã bị xóa!"
            });
        }

        res.json({
            success: true,
            message: "Xóa khách hàng thành công!"
        });
    } catch (error) {
        console.error("Lỗi xóa khách hàng:", error);
        res.status(500).json({
            success: false,
            message: "Không thể xóa khách hàng!"
        });
    }
}

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove
};
