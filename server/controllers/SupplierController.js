const { connectDB } = require("../database/connection");


// ========================================
// LẤY DANH SÁCH NHÀ CUNG CẤP
// ========================================
exports.getAll = async (req, res) => {

    try {

        const pool = await connectDB();

        const result = await pool.request().query(`
            SELECT
                SupplierID,
                SupplierCode,
                SupplierName,
                ContactPerson,
                Phone,
                Email,
                Address,
                CreatedAt
            FROM Suppliers
            ORDER BY SupplierID DESC
        `);

        res.status(200).json({
            success: true,
            data: result.recordset
        });

    } catch (err) {

        console.error("Lỗi lấy danh sách nhà cung cấp:", err);

        res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách nhà cung cấp."
        });

    }

};

// ========================================
// THÊM NHÀ CUNG CẤP
// ========================================
exports.create = async (req, res) => {

    try {

        const {
            SupplierCode,
            SupplierName,
            ContactPerson,
            Phone,
            Email,
            Address
        } = req.body;


        // Kiểm tra dữ liệu bắt buộc
        if (!SupplierName) {

            return res.status(400).json({
                success: false,
                message: "Tên nhà cung cấp là bắt buộc."
            });

        }


        const pool = await connectDB();


        // Kiểm tra mã nhà cung cấp nếu có nhập
        if (SupplierCode) {

            const check = await pool
                .request()
                .input("SupplierCode", SupplierCode)
                .query(`
                    SELECT SupplierID
                    FROM Suppliers
                    WHERE SupplierCode = @SupplierCode
                `);


            if (check.recordset.length > 0) {

                return res.status(400).json({
                    success: false,
                    message: "Mã nhà cung cấp đã tồn tại."
                });

            }

        }


        const result = await pool
            .request()
            .input("SupplierCode", SupplierCode || null)
            .input("SupplierName", SupplierName)
            .input("ContactPerson", ContactPerson || null)
            .input("Phone", Phone || null)
            .input("Email", Email || null)
            .input("Address", Address || null)
            .query(`
                INSERT INTO Suppliers
                (
                    SupplierCode,
                    SupplierName,
                    ContactPerson,
                    Phone,
                    Email,
                    Address
                )
                OUTPUT INSERTED.*
                VALUES
                (
                    @SupplierCode,
                    @SupplierName,
                    @ContactPerson,
                    @Phone,
                    @Email,
                    @Address
                )
            `);


        res.status(201).json({
            success: true,
            message: "Thêm nhà cung cấp thành công.",
            data: result.recordset[0]
        });


    } catch (err) {

        console.error("Lỗi thêm nhà cung cấp:", err);

        res.status(500).json({
            success: false,
            message: "Không thể thêm nhà cung cấp."
        });

    }

};
// ========================================
// CẬP NHẬT NHÀ CUNG CẤP
// ========================================
exports.update = async (req, res) => {

    try {

        const supplierId = parseInt(req.params.id);

        const {
            SupplierCode,
            SupplierName,
            ContactPerson,
            Phone,
            Email,
            Address
        } = req.body;


        // Kiểm tra ID
        if (isNaN(supplierId)) {

            return res.status(400).json({
                success: false,
                message: "SupplierID không hợp lệ."
            });

        }


        // Kiểm tra tên nhà cung cấp
        if (!SupplierName) {

            return res.status(400).json({
                success: false,
                message: "Tên nhà cung cấp là bắt buộc."
            });

        }


        const pool = await connectDB();


        // Kiểm tra nhà cung cấp có tồn tại không
        const checkSupplier = await pool
            .request()
            .input("SupplierID", supplierId)
            .query(`
                SELECT SupplierID
                FROM Suppliers
                WHERE SupplierID = @SupplierID
            `);


        if (checkSupplier.recordset.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Không tìm thấy nhà cung cấp."
            });

        }


        // Kiểm tra mã nhà cung cấp có bị trùng không
        if (SupplierCode) {

            const checkCode = await pool
                .request()
                .input("SupplierCode", SupplierCode)
                .input("SupplierID", supplierId)
                .query(`
                    SELECT SupplierID
                    FROM Suppliers
                    WHERE SupplierCode = @SupplierCode
                    AND SupplierID <> @SupplierID
                `);


            if (checkCode.recordset.length > 0) {

                return res.status(400).json({
                    success: false,
                    message: "Mã nhà cung cấp đã tồn tại."
                });

            }

        }


        // Cập nhật
        const result = await pool
            .request()
            .input("SupplierID", supplierId)
            .input("SupplierCode", SupplierCode || null)
            .input("SupplierName", SupplierName)
            .input("ContactPerson", ContactPerson || null)
            .input("Phone", Phone || null)
            .input("Email", Email || null)
            .input("Address", Address || null)
            .query(`
                UPDATE Suppliers
                SET
                    SupplierCode = @SupplierCode,
                    SupplierName = @SupplierName,
                    ContactPerson = @ContactPerson,
                    Phone = @Phone,
                    Email = @Email,
                    Address = @Address
                OUTPUT INSERTED.*
                WHERE SupplierID = @SupplierID
            `);


        res.status(200).json({
            success: true,
            message: "Cập nhật nhà cung cấp thành công.",
            data: result.recordset[0]
        });


    } catch (err) {

        console.error("Lỗi cập nhật nhà cung cấp:", err);

        res.status(500).json({
            success: false,
            message: "Không thể cập nhật nhà cung cấp."
        });

    }

};
// ========================================
// XÓA NHÀ CUNG CẤP
// ========================================
exports.remove = async (req, res) => {
    try {
        const supplierId = parseInt(req.params.id);

        if (isNaN(supplierId) || supplierId <= 0) {
            return res.status(400).json({
                success: false,
                message: "SupplierID không hợp lệ."
            });
        }

        // Kết nối SQL Server giống các hàm phía trên
        const pool = await connectDB();

        // Kiểm tra nhà cung cấp có tồn tại không
        const checkSupplier = await pool.request()
            .input("SupplierID", supplierId)
            .query(`
                SELECT SupplierID
                FROM Suppliers
                WHERE SupplierID = @SupplierID
            `);

        if (checkSupplier.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy nhà cung cấp."
            });
        }

        // Kiểm tra nhà cung cấp có sản phẩm liên kết không
        const checkProducts = await pool.request()
            .input("SupplierID", supplierId)
            .query(`
                SELECT COUNT(*) AS Total
                FROM Products
                WHERE SupplierID = @SupplierID
            `);

        if (checkProducts.recordset[0].Total > 0) {
            return res.status(400).json({
                success: false,
                message: "Không thể xóa nhà cung cấp đang có sản phẩm liên kết."
            });
        }

        // Thực hiện xóa
        await pool.request()
            .input("SupplierID", supplierId)
            .query(`
                DELETE FROM Suppliers
                WHERE SupplierID = @SupplierID
            `);

        res.status(200).json({
            success: true,
            message: "Xóa nhà cung cấp thành công."
        });

    } catch (err) {
        console.error("Lỗi xóa nhà cung cấp:", err);

        res.status(500).json({
            success: false,
            message: "Không thể xóa nhà cung cấp."
        });
    }
};