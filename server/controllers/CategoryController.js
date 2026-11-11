const { connectDB } = require("../database/connection");


// ========================================
// LẤY DANH SÁCH DANH MỤC
// ========================================
exports.getAll = async (req, res) => {

    try {

        const pool = await connectDB();

        const result = await pool.request().query(`
            SELECT *
            FROM Categories
            ORDER BY CategoryID DESC
        `);

        res.status(200).json(result.recordset);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách danh mục."
        });

    }

};


// ========================================
// THÊM DANH MỤC
// ========================================
exports.create = async (req, res) => {

    try {

        const {
            CategoryCode,
            CategoryName,
            Description
        } = req.body;


        // Kiểm tra dữ liệu bắt buộc
        if (!CategoryCode || !CategoryName) {

            return res.status(400).json({
                success: false,
                message: "Mã danh mục và tên danh mục là bắt buộc."
            });

        }


        const pool = await connectDB();


        // Kiểm tra mã danh mục đã tồn tại chưa
        const check = await pool
            .request()
            .input("CategoryCode", CategoryCode)
            .query(`
                SELECT CategoryID
                FROM Categories
                WHERE CategoryCode = @CategoryCode
            `);


        if (check.recordset.length > 0) {

            return res.status(400).json({
                success: false,
                message: "Mã danh mục đã tồn tại."
            });

        }


        // Thêm danh mục vào database
        const result = await pool
            .request()
            .input("CategoryCode", CategoryCode)
            .input("CategoryName", CategoryName)
            .input("Description", Description || null)
            .query(`
                INSERT INTO Categories
                (
                    CategoryCode,
                    CategoryName,
                    Description
                )
                OUTPUT INSERTED.*
                VALUES
                (
                    @CategoryCode,
                    @CategoryName,
                    @Description
                )
            `);


        res.status(201).json({
            success: true,
            message: "Thêm danh mục thành công.",
            data: result.recordset[0]
        });


    } catch (err) {

        console.error("Lỗi thêm danh mục:", err);

        res.status(500).json({
            success: false,
            message: "Không thể thêm danh mục."
        });

    }

};

// ========================================
// SỬA DANH MỤC
// ========================================
exports.update = async (req, res) => {

    try {

        const categoryId = parseInt(req.params.id);

        const {
            CategoryCode,
            CategoryName,
            Description
        } = req.body;


        // Kiểm tra ID
        if (isNaN(categoryId)) {

            return res.status(400).json({
                success: false,
                message: "ID danh mục không hợp lệ."
            });

        }


        // Kiểm tra dữ liệu bắt buộc
        if (!CategoryCode || !CategoryName) {

            return res.status(400).json({
                success: false,
                message: "Mã danh mục và tên danh mục là bắt buộc."
            });

        }


        const pool = await connectDB();


        // Kiểm tra danh mục có tồn tại không
        const checkCategory = await pool
            .request()
            .input("CategoryID", categoryId)
            .query(`
                SELECT CategoryID
                FROM Categories
                WHERE CategoryID = @CategoryID
            `);


        if (checkCategory.recordset.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Không tìm thấy danh mục."
            });

        }


        // Kiểm tra mã danh mục có bị trùng không
        const checkCode = await pool
            .request()
            .input("CategoryCode", CategoryCode)
            .input("CategoryID", categoryId)
            .query(`
                SELECT CategoryID
                FROM Categories
                WHERE CategoryCode = @CategoryCode
                AND CategoryID <> @CategoryID
            `);


        if (checkCode.recordset.length > 0) {

            return res.status(400).json({
                success: false,
                message: "Mã danh mục đã được sử dụng."
            });

        }


        // Cập nhật danh mục
        const result = await pool
            .request()
            .input("CategoryID", categoryId)
            .input("CategoryCode", CategoryCode)
            .input("CategoryName", CategoryName)
            .input("Description", Description || null)
            .query(`
                UPDATE Categories
                SET
                    CategoryCode = @CategoryCode,
                    CategoryName = @CategoryName,
                    Description = @Description,
                    UpdatedAt = GETDATE()
                OUTPUT INSERTED.*
                WHERE CategoryID = @CategoryID
            `);


        res.status(200).json({

            success: true,

            message: "Cập nhật danh mục thành công.",

            data: result.recordset[0]

        });


    } catch (err) {

        console.error("Lỗi sửa danh mục:", err);

        res.status(500).json({

            success: false,

            message: "Không thể sửa danh mục."

        });

    }

};
// ========================================
// XÓA DANH MỤC
// ========================================
exports.remove = async (req, res) => {

    try {

        const categoryId = parseInt(req.params.id);


        // Kiểm tra ID
        if (isNaN(categoryId)) {

            return res.status(400).json({
                success: false,
                message: "ID danh mục không hợp lệ."
            });

        }


        const pool = await connectDB();


        // Kiểm tra danh mục có tồn tại không
        const checkCategory = await pool
            .request()
            .input("CategoryID", categoryId)
            .query(`
                SELECT CategoryID, CategoryCode, CategoryName
                FROM Categories
                WHERE CategoryID = @CategoryID
            `);


        if (checkCategory.recordset.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Không tìm thấy danh mục."
            });

        }


        // Xóa danh mục
        const result = await pool
            .request()
            .input("CategoryID", categoryId)
            .query(`
                DELETE FROM Categories
                OUTPUT DELETED.*
                WHERE CategoryID = @CategoryID
            `);


        res.status(200).json({

            success: true,

            message: "Xóa danh mục thành công.",

            data: result.recordset[0]

        });


    } catch (err) {

        console.error("Lỗi xóa danh mục:", err);

        res.status(500).json({

            success: false,

            message: "Không thể xóa danh mục."

        });

    }

};