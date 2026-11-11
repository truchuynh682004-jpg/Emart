const { connectDB } = require("../database/connection");


// ========================================
// LẤY DANH SÁCH SẢN PHẨM
// ========================================
exports.getAll = async (req, res) => {

    try {

        const pool = await connectDB();

        const result = await pool.request().query(`
            SELECT
                p.ProductID,
                p.Barcode,
                p.ProductCode,
                p.ProductName,

                p.CategoryID,
                c.CategoryName,

                p.SupplierID,
                s.SupplierName,

                p.Unit,
               p.PurchasePrice,
            p.SellingPrice,
            p.OriginalSellingPrice,
            p.FefoDiscountPercent,
            p.FefoActionStatus,

                p.MinStock,
                p.CurrentStock,

                p.ImageURL,
                p.IsActive,

                p.ExpiryDate,

                p.CreatedAt,
                p.UpdatedAt

            FROM Products p

            LEFT JOIN Categories c
            ON p.CategoryID = c.CategoryID

            LEFT JOIN Suppliers s
    ON p.SupplierID = s.SupplierID

            WHERE p.IsActive = 1

            ORDER BY p.ProductID DESC
        `);

        res.status(200).json({
            success: true,
            data: result.recordset
        });

    } catch (err) {

        console.error("Lỗi lấy danh sách sản phẩm:", err);

        res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách sản phẩm."
        });

    }

};

/**
 * THÊM SẢN PHẨM MỚI VÀO SQL SERVER
 */
exports.create = async (req, res) => {
    try {
        const {
            ProductName,
            Barcode,
            CategoryID,
            SellingPrice,
            CurrentStock,
            MinStock,
            ExpiryDate,
            ImageURL,
            PurchasePrice,
            SupplierID,
            Unit,
            ProductCode
        } = req.body;
                const finalImageURL = req.file
            ? `/uploads/${req.file.filename}`
            : (ImageURL || null);
        // Kiểm tra dữ liệu bắt buộc
        if (
            !ProductName ||
            !Barcode ||
            !CategoryID ||
            SellingPrice === undefined ||
            CurrentStock === undefined ||
            MinStock === undefined ||
            !ExpiryDate
        ) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập đầy đủ thông tin sản phẩm."
            });
        }

        const pool = await connectDB();

        // Kiểm tra mã barcode đã tồn tại chưa
        const duplicate = await pool.request()
            .input("Barcode", require("mssql").NVarChar, Barcode)
            .query(`
                SELECT ProductID
                FROM Products
                WHERE Barcode = @Barcode
            `);

        if (duplicate.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Mã barcode đã tồn tại."
            });
        }

        const result = await pool.request()
            .input("Barcode", require("mssql").NVarChar, Barcode)
            .input("ProductCode", require("mssql").NVarChar, ProductCode || null)
            .input("ProductName", require("mssql").NVarChar, ProductName)
            .input("CategoryID", require("mssql").Int, Number(CategoryID))
            .input("SupplierID", require("mssql").Int, SupplierID ? Number(SupplierID) : null)
            .input("Unit", require("mssql").NVarChar, Unit || "Cái")
            .input("PurchasePrice", require("mssql").Decimal(18, 2), Number(PurchasePrice) || 0)
            .input("SellingPrice", require("mssql").Decimal(18, 2), Number(SellingPrice))
            .input("CurrentStock", require("mssql").Int, Number(CurrentStock))
            .input("MinStock", require("mssql").Int, Number(MinStock))
            .input("ImageURL", require("mssql").NVarChar, finalImageURL)
            .input("ExpiryDate", require("mssql").Date, ExpiryDate)
            .query(`
                INSERT INTO Products (
                    Barcode, ProductCode, ProductName, CategoryID,
                    SupplierID, Unit, PurchasePrice, SellingPrice,
                    CurrentStock, MinStock, ImageURL, ExpiryDate, IsActive
                )
                OUTPUT INSERTED.ProductID
                VALUES (
                    @Barcode, @ProductCode, @ProductName, @CategoryID,
                    @SupplierID, @Unit, @PurchasePrice, @SellingPrice,
                    @CurrentStock, @MinStock, @ImageURL, @ExpiryDate, 1
                )
            `);

        return res.status(201).json({
            success: true,
            message: "Thêm sản phẩm thành công.",
            data: {
                ProductID: result.recordset[0].ProductID
            }
        });

    } catch (err) {
        console.error("Lỗi thêm sản phẩm:", err);

        return res.status(500).json({
            success: false,
            message: "Không thể thêm sản phẩm vào SQL Server.",
            error: err.message
        });
    }
};

/**
 * CẬP NHẬT SẢN PHẨM TRONG SQL SERVER
 */
exports.update = async (req, res) => {
    try {
        const sql = require("mssql");
        const productId = Number(req.params.id);

        const {
    ProductName,
    Barcode,
    ProductCode,
    CategoryID,
    SupplierID,
    Unit,
    PurchasePrice,
    SellingPrice,
    OriginalSellingPrice,
    FefoDiscountPercent,
    FefoActionStatus,
    CurrentStock,
    MinStock,
    ImageURL,
    ExpiryDate
} = req.body;
const finalImageURL = req.file
    ? `/uploads/${req.file.filename}`
    : (ImageURL || null);

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Mã sản phẩm không hợp lệ."
            });
        }

        if (
            !ProductName?.trim() ||
            !Barcode?.trim() ||
            !Number.isInteger(Number(CategoryID)) ||
            Number(CategoryID) <= 0 ||
            !Number.isFinite(Number(SellingPrice)) ||
            Number(SellingPrice) < 0 ||
            !Number.isInteger(Number(CurrentStock)) ||
            Number(CurrentStock) < 0 ||
            !Number.isInteger(Number(MinStock)) ||
            Number(MinStock) < 0 ||
            !ExpiryDate
        ) {
            return res.status(400).json({
                success: false,
                message: "Thông tin sản phẩm không hợp lệ."
            });
        }

        const pool = await connectDB();

        // Kiểm tra sản phẩm có tồn tại
        const existing = await pool.request()
            .input("ProductID", sql.Int, productId)
            .query(`
                SELECT ProductID
                FROM Products
                WHERE ProductID = @ProductID
            `);

        if (existing.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm."
            });
        }

        // Không cho trùng barcode với sản phẩm khác
        const duplicate = await pool.request()
            .input("Barcode", sql.NVarChar, Barcode.trim())
            .input("ProductID", sql.Int, productId)
            .query(`
                SELECT ProductID
                FROM Products
                WHERE Barcode = @Barcode
                  AND ProductID <> @ProductID
            `);

        if (duplicate.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Barcode đã được sử dụng bởi sản phẩm khác."
            });
        }

        await pool.request()
            .input("ProductID", sql.Int, productId)
            .input("ProductName", sql.NVarChar, ProductName.trim())
            .input("Barcode", sql.NVarChar, Barcode.trim())
            .input("ProductCode", sql.NVarChar, ProductCode || null)
            .input("CategoryID", sql.Int, Number(CategoryID))
            .input("SupplierID", sql.Int,
                SupplierID ? Number(SupplierID) : null)
            .input("Unit", sql.NVarChar, Unit || "Cái")
            .input("PurchasePrice", sql.Decimal(18, 2),
                Number(PurchasePrice) || 0)
           .input("SellingPrice", sql.Decimal(18, 2),
    Number(SellingPrice))

// Thông tin giảm giá FEFO
.input("OriginalSellingPrice", sql.Decimal(18, 2),
    OriginalSellingPrice == null ? null : Number(OriginalSellingPrice))
.input("FefoDiscountPercent", sql.Decimal(5, 2),
    FefoDiscountPercent == null ? 0 : Number(FefoDiscountPercent))
.input("FefoActionStatus", sql.NVarChar(30),
    FefoActionStatus ?? null)
.input("UpdateFefoFields", sql.Bit,
    OriginalSellingPrice !== undefined ||
    FefoDiscountPercent !== undefined ||
    FefoActionStatus !== undefined)

.input("CurrentStock", sql.Int, Number(CurrentStock))
            .input("MinStock", sql.Int, Number(MinStock))
            .input("ImageURL", sql.NVarChar, finalImageURL)
            .input("ExpiryDate", sql.Date, ExpiryDate)
            .query(`
                UPDATE Products
                SET
                    ProductName = @ProductName,
                    Barcode = @Barcode,
                    ProductCode = @ProductCode,
                    CategoryID = @CategoryID,
                    SupplierID = @SupplierID,
                    Unit = @Unit,
                    PurchasePrice = @PurchasePrice,
                   SellingPrice = @SellingPrice,

OriginalSellingPrice = CASE
    WHEN @UpdateFefoFields = 1
    THEN @OriginalSellingPrice
    ELSE OriginalSellingPrice
END,

FefoDiscountPercent = CASE
    WHEN @UpdateFefoFields = 1
    THEN @FefoDiscountPercent
    ELSE FefoDiscountPercent
END,

FefoActionStatus = CASE
    WHEN @UpdateFefoFields = 1
    THEN @FefoActionStatus
    ELSE FefoActionStatus
END,

CurrentStock = @CurrentStock,
                    MinStock = @MinStock,
                    ImageURL = @ImageURL,
                    ExpiryDate = @ExpiryDate,
                    UpdatedAt = GETDATE()
                WHERE ProductID = @ProductID
            `);

        return res.json({
            success: true,
            message: "Cập nhật sản phẩm thành công.",
            data: { ProductID: productId }
        });

    } catch (err) {
        console.error("Lỗi cập nhật sản phẩm:", err);

        return res.status(500).json({
            success: false,
            message: "Không thể cập nhật sản phẩm trong SQL Server.",
            error: err.message
        });
    }
};

// Áp dụng giảm giá FEFO và lưu trực tiếp vào SQL Server
exports.applyFefoDiscount = async (req, res) => {
    try {
        const sql = require("mssql");
        const productId = Number(req.params.id);
        const percent = Number(req.body.percent);

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Mã sản phẩm không hợp lệ."
            });
        }

        if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) {
            return res.status(400).json({
                success: false,
                message: "Phần trăm giảm giá phải từ 1% đến 99%."
            });
        }

        const pool = await connectDB();

        const result = await pool.request()
            .input("ProductID", sql.Int, productId)
            .input("Percent", sql.Decimal(5, 2), percent)
            .query(`
                UPDATE p
                SET
                    OriginalSellingPrice = x.BasePrice,
                    SellingPrice = ROUND(
                        x.BasePrice * (1 - @Percent / 100.0), 0
                    ),
                    FefoDiscountPercent = @Percent,
                    FefoActionStatus = N'Giảm giá',
                    UpdatedAt = GETDATE()
                OUTPUT
                    INSERTED.ProductID,
                    INSERTED.SellingPrice,
                    INSERTED.OriginalSellingPrice,
                    INSERTED.FefoDiscountPercent,
                    INSERTED.FefoActionStatus
                FROM Products p
                CROSS APPLY (
                    SELECT COALESCE(
                        p.OriginalSellingPrice,
                        p.SellingPrice
                    ) AS BasePrice
                ) x
                WHERE p.ProductID = @ProductID;
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm."
            });
        }

        return res.json({
            success: true,
            message: "Đã lưu giảm giá FEFO vào SQL Server.",
            data: result.recordset[0]
        });

    } catch (err) {
        console.error("Lỗi áp dụng giảm giá FEFO:", err);

        return res.status(500).json({
            success: false,
            message: "Không thể lưu giảm giá FEFO.",
            error: err.message
        });
    }
};

// Khôi phục giá gốc sau khi giảm giá FEFO
exports.restoreFefoPrice = async (req, res) => {
    try {
        const sql = require("mssql");
        const productId = Number(req.params.id);

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Mã sản phẩm không hợp lệ."
            });
        }

        const pool = await connectDB();

        const result = await pool.request()
            .input("ProductID", sql.Int, productId)
            .query(`
                UPDATE Products
                SET
                    SellingPrice = OriginalSellingPrice,
                    FefoDiscountPercent = 0,
                    FefoActionStatus = NULL,
                    UpdatedAt = GETDATE()
                OUTPUT
                    INSERTED.ProductID,
                    INSERTED.SellingPrice,
                    INSERTED.OriginalSellingPrice,
                    INSERTED.FefoDiscountPercent,
                    INSERTED.FefoActionStatus
                WHERE ProductID = @ProductID
                  AND OriginalSellingPrice IS NOT NULL;
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm hoặc sản phẩm chưa có giá gốc."
            });
        }

        return res.json({
            success: true,
            message: "Đã khôi phục giá gốc thành công.",
            data: result.recordset[0]
        });

    } catch (err) {
        console.error("Lỗi khôi phục giá FEFO:", err);

        return res.status(500).json({
            success: false,
            message: "Không thể khôi phục giá gốc.",
            error: err.message
        });
    }
};

// ========================================
// XÓA SẢN PHẨM (XÓA MỀM)
// ========================================
exports.remove = async (req, res) => {
    try {
        const sql = require("mssql");
        const productId = Number(req.params.id);

        // Kiểm tra mã sản phẩm
        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Mã sản phẩm không hợp lệ."
            });
        }

        const pool = await connectDB();

        // Kiểm tra sản phẩm tồn tại và đang hoạt động
        const existing = await pool.request()
            .input("ProductID", sql.Int, productId)
            .query(`
                SELECT ProductID
                FROM Products
                WHERE ProductID = @ProductID
                  AND IsActive = 1
            `);

        if (existing.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm hoặc sản phẩm đã bị xóa."
            });
        }

        // Xóa mềm: chuyển IsActive thành 0
        await pool.request()
            .input("ProductID", sql.Int, productId)
            .query(`
                UPDATE Products
                SET
                    IsActive = 0,
                    UpdatedAt = GETDATE()
                WHERE ProductID = @ProductID
            `);

        return res.json({
            success: true,
            message: "Xóa sản phẩm thành công.",
            data: {
                ProductID: productId
            }
        });

    } catch (err) {
        console.error("Lỗi xóa sản phẩm:", err);

        return res.status(500).json({
            success: false,
            message: "Không thể xóa sản phẩm.",
            error: err.message
        });
    }
};
// ========================================
// KHÔI PHỤC SẢN PHẨM ĐÃ XÓA
// ========================================
exports.restore = async (req, res) => {
    try {
        const sql = require("mssql");
        const productId = Number(req.params.id);

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Mã sản phẩm không hợp lệ."
            });
        }

        const pool = await connectDB();

        // Kiểm tra sản phẩm đã bị xóa
        const existing = await pool.request()
            .input("ProductID", sql.Int, productId)
            .query(`
                SELECT ProductID
                FROM Products
                WHERE ProductID = @ProductID
                  AND IsActive = 0
            `);

        if (existing.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm đã xóa."
            });
        }

        // Khôi phục sản phẩm
        await pool.request()
            .input("ProductID", sql.Int, productId)
            .query(`
                UPDATE Products
                SET
                    IsActive = 1,
                    UpdatedAt = GETDATE()
                WHERE ProductID = @ProductID
            `);

        return res.json({
            success: true,
            message: "Khôi phục sản phẩm thành công.",
            data: {
                ProductID: productId
            }
        });

    } catch (err) {
        console.error("Lỗi khôi phục sản phẩm:", err);

        return res.status(500).json({
            success: false,
            message: "Không thể khôi phục sản phẩm.",
            error: err.message
        });
    }
};
// ========================================
// LẤY DANH SÁCH SẢN PHẨM ĐÃ XÓA
// ========================================
exports.getDeleted = async (req, res) => {
    try {
        const pool = await connectDB();

        const result = await pool.request().query(`
            SELECT
                p.ProductID,
                p.Barcode,
                p.ProductCode,
                p.ProductName,
                p.CategoryID,
                c.CategoryName,
                p.SupplierID,
                s.SupplierName,
                p.Unit,
                p.PurchasePrice,
                p.SellingPrice,
                p.MinStock,
                p.CurrentStock,
                p.ImageURL,
                p.IsActive,
                p.ExpiryDate,
                p.CreatedAt,
                p.UpdatedAt
            FROM Products p
            LEFT JOIN Categories c
                ON p.CategoryID = c.CategoryID
            LEFT JOIN Suppliers s
                ON p.SupplierID = s.SupplierID
            WHERE p.IsActive = 0
            ORDER BY p.UpdatedAt DESC
        `);

        return res.json({
            success: true,
            data: result.recordset
        });

    } catch (err) {
        console.error("Lỗi lấy sản phẩm đã xóa:", err);

        return res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách sản phẩm đã xóa."
        });
    }
};