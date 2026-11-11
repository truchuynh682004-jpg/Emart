
const sql = require("mssql");
const { connectDB } = require("../database/connection");

async function checkout(req, res) {
    const {
    items,
    paymentMethod,
    customerName,
    customerPhone,
    pointsToRedeem
} = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Giỏ hàng đang trống."
        });
    }

    // Gộp các sản phẩm trùng ID và kiểm tra số lượng
    const quantities = new Map();

    for (const item of items) {
        const productId = Number(item.productId);
        const quantity = Number(item.quantity);

        if (
            !Number.isInteger(productId) ||
            productId <= 0 ||
            !Number.isInteger(quantity) ||
            quantity <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Mã sản phẩm hoặc số lượng không hợp lệ."
            });
        }

        quantities.set(
            productId,
            (quantities.get(productId) || 0) + quantity
        );
    }

    let pool;
    let transaction;
    let transactionStarted = false;

    try {
        pool = await connectDB();
        transaction = new sql.Transaction(pool);
        await transaction.begin();
        transactionStarted = true;

        let subTotal = 0;
        const details = [];

        // Khóa các dòng sản phẩm trong lúc kiểm tra và cập nhật kho
        for (const [productId, quantity] of quantities) {
            const request = new sql.Request(transaction);

            request.input("ProductID", sql.Int, productId);
            request.input("Quantity", sql.Int, quantity);

            const result = await request.query(`
                SELECT ProductID, ProductName, SellingPrice, CurrentStock
                FROM Products WITH (UPDLOCK, HOLDLOCK)
                WHERE ProductID = @ProductID AND IsActive = 1;
            `);

            const product = result.recordset[0];

            if (!product) {
                throw new Error(
                    `Không tìm thấy sản phẩm ID ${productId} hoặc sản phẩm đã ngừng kinh doanh.`
                );
            }

            if (Number(product.CurrentStock) < quantity) {
                throw new Error(
                    `Sản phẩm "${product.ProductName}" không đủ tồn kho. Hiện còn ${product.CurrentStock}.`
                );
            }

            const unitPrice = Number(product.SellingPrice);
            const lineTotal = Math.round(unitPrice * quantity * 100) / 100;

            subTotal += lineTotal;

            details.push({
                productId,
                productName: product.ProductName,
                quantity,
                unitPrice,
                lineTotal
            });
        }

// Kiểm tra và xử lý điểm thành viên
const redeemPoints = Number(pointsToRedeem ?? 0);

if (!Number.isInteger(redeemPoints) || redeemPoints < 0) {
    throw new Error("Số điểm sử dụng không hợp lệ.");
}

let availablePoints = 0;

// Chỉ cho phép đổi điểm khi có số điện thoại khách hàng
if (redeemPoints > 0) {
    if (!customerPhone) {
        throw new Error("Vui lòng chọn khách hàng thành viên để đổi điểm.");
    }

    const customerCheck = new sql.Request(transaction);

    customerCheck.input("CustomerPhone", sql.NVarChar(20), customerPhone);

    const customerResult = await customerCheck.query(`
        SELECT AvailablePoints
        FROM Customers WITH (UPDLOCK, HOLDLOCK)
        WHERE Phone = @CustomerPhone
          AND Status = N'Đang hoạt động';
    `);

    if (customerResult.recordset.length === 0) {
        throw new Error("Không tìm thấy khách hàng thành viên đang hoạt động.");
    }

    availablePoints = Number(customerResult.recordset[0].AvailablePoints);

    if (redeemPoints > availablePoints) {
        throw new Error("Khách hàng không đủ điểm để sử dụng.");
    }

    const maxDiscount = Math.floor(subTotal * 0.5);

    	if (redeemPoints > maxDiscount) {
        throw new Error("Số điểm sử dụng vượt quá giới hạn giảm giá 50% tiền hàng.");
    }
}

// 1 điểm = 1 VNĐ
const discountAmount = redeemPoints;

const vatAmount = Math.round(
    (subTotal - discountAmount) * 0.08
);

const totalAmount = subTotal - discountAmount + vatAmount;

        const invoiceCode =
            "HD" +
            new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14) +
            Math.floor(Math.random() * 1000).toString().padStart(3, "0");

        const invoiceRequest = new sql.Request(transaction);

        invoiceRequest.input("InvoiceCode", sql.NVarChar(30), invoiceCode);
        invoiceRequest.input("SubTotal", sql.Decimal(18, 2), subTotal);
        invoiceRequest.input("DiscountAmount", sql.Decimal(18, 2), discountAmount);
        invoiceRequest.input("VATAmount", sql.Decimal(18, 2), vatAmount);
        invoiceRequest.input("TotalAmount", sql.Decimal(18, 2), totalAmount);
        invoiceRequest.input(
            "PaymentMethod",
            sql.NVarChar(30),
            paymentMethod || "Tiền mặt"
        );
        invoiceRequest.input(
            "CustomerName",
            sql.NVarChar(100),
            customerName || null
        );
        invoiceRequest.input(
            "CustomerPhone",
            sql.NVarChar(20),
            customerPhone || null
        );

        const invoiceResult = await invoiceRequest.query(`
            INSERT INTO Invoices (
                InvoiceCode, SubTotal, DiscountAmount, VATAmount,
                TotalAmount, PaymentMethod, CustomerName, CustomerPhone
            )
            OUTPUT INSERTED.InvoiceID
            VALUES (
                @InvoiceCode, @SubTotal, @DiscountAmount, @VATAmount,
                @TotalAmount, @PaymentMethod, @CustomerName, @CustomerPhone
            );
        `);

        const invoiceId = invoiceResult.recordset[0].InvoiceID;

        for (const detail of details) {
            const detailRequest = new sql.Request(transaction);

            detailRequest.input("InvoiceID", sql.Int, invoiceId);
            detailRequest.input("ProductID", sql.Int, detail.productId);
            detailRequest.input("ProductName", sql.NVarChar(200), detail.productName);
            detailRequest.input("Quantity", sql.Int, detail.quantity);
            detailRequest.input("UnitPrice", sql.Decimal(18, 2), detail.unitPrice);
            detailRequest.input("LineTotal", sql.Decimal(18, 2), detail.lineTotal);

            await detailRequest.query(`
                INSERT INTO InvoiceDetails (
                    InvoiceID, ProductID, ProductName,
                    Quantity, UnitPrice, LineTotal
                )
                VALUES (
                    @InvoiceID, @ProductID, @ProductName,
                    @Quantity, @UnitPrice, @LineTotal
                );
            `);

            const updateRequest = new sql.Request(transaction);

            updateRequest.input("ProductID", sql.Int, detail.productId);
            updateRequest.input("Quantity", sql.Int, detail.quantity);

            const updateResult = await updateRequest.query(`
                UPDATE Products
                SET CurrentStock = CurrentStock - @Quantity,
                    UpdatedAt = GETDATE()
                WHERE ProductID = @ProductID
                  AND CurrentStock >= @Quantity;

                SELECT @@ROWCOUNT AS AffectedRows;
            `);

            if (updateResult.recordset[0].AffectedRows !== 1) {
                throw new Error(
                    `Không thể cập nhật tồn kho cho sản phẩm ${detail.productName}.`
                );
            }
        }

 // Cập nhật điểm thưởng và tổng chi tiêu
if (customerPhone) {
    const earnedPoints = Math.floor(totalAmount / 10000);

    const customerRequest = new sql.Request(transaction);

    customerRequest.input(
        "CustomerPhone",
        sql.NVarChar(20),
        customerPhone
    );

customerRequest.input(
    "PointsToRedeem",
    sql.Int,
    redeemPoints
);

    customerRequest.input(
        "EarnedPoints",
        sql.Int,
        earnedPoints
    );

    customerRequest.input(
        "TotalAmount",
        sql.Decimal(18, 2),
        totalAmount
    );

    const updateCustomerResult = await customerRequest.query(`
        UPDATE Customers
        SET
            TotalPoints = TotalPoints + @EarnedPoints,
            AvailablePoints = AvailablePoints
                - @PointsToRedeem
                + @EarnedPoints,
            TotalSpent = TotalSpent + @TotalAmount,
            UpdatedAt = GETDATE()
        WHERE Phone = @CustomerPhone
          AND Status = N'Đang hoạt động'
          AND AvailablePoints >= @PointsToRedeem;

        SELECT @@ROWCOUNT AS AffectedRows;
    `);

    if (updateCustomerResult.recordset[0].AffectedRows !== 1) {
        throw new Error("Không thể cập nhật điểm thành viên. Vui lòng kiểm tra lại số dư điểm.");
    }
}
        await transaction.commit();
        transactionStarted = false;

        return res.status(201).json({
            success: true,
            message: "Thanh toán thành công.",
            data: {
                invoiceId,
                invoiceCode,
                subTotal,
                discountAmount,
                vatAmount,
                totalAmount,
                items: details
            }
        });
    } catch (error) {
        if (transactionStarted && transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error("Lỗi rollback giao dịch:", rollbackError);
            }
        }

        console.error("Lỗi thanh toán:", error);

        return res.status(400).json({
            success: false,
            message: error.message || "Không thể xử lý thanh toán."
        });
    }
}


async function getAllInvoices(req, res) {
    try {
        const pool = await connectDB();

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(
            100,
            Math.max(1, parseInt(req.query.pageSize, 10) || 10)
        );

        const search = (req.query.search || "").trim();
        const fromDate = req.query.fromDate || "";
        const toDate = req.query.toDate || "";

        const request = pool.request();

        request.input("Search", sql.NVarChar(100), `%${search}%`);
        request.input("Offset", sql.Int, (page - 1) * pageSize);
        request.input("PageSize", sql.Int, pageSize);

        let dateCondition = "";

        if (fromDate) {
            request.input("FromDate", sql.Date, fromDate);
            dateCondition += " AND SaleDate >= @FromDate";
        }

        if (toDate) {
            request.input("ToDate", sql.Date, toDate);
            dateCondition += " AND SaleDate < DATEADD(DAY, 1, @ToDate)";
        }

        const whereCondition = `
            WHERE (
                InvoiceCode LIKE @Search
                OR ISNULL(CustomerName, N'') LIKE @Search
                OR ISNULL(CustomerPhone, N'') LIKE @Search
            )
            ${dateCondition}
        `;

        const countResult = await request.query(`
            SELECT COUNT(*) AS Total
            FROM Invoices
            ${whereCondition};
        `);

        const invoicesResult = await request.query(`
            SELECT
                InvoiceID,
                InvoiceCode,
                SaleDate,
                SubTotal,
                DiscountAmount,
                VATAmount,
                TotalAmount,
                PaymentMethod,
                CustomerName,
                CustomerPhone
            FROM Invoices
            ${whereCondition}
            ORDER BY SaleDate DESC, InvoiceID DESC
            OFFSET @Offset ROWS
            FETCH NEXT @PageSize ROWS ONLY;
        `);

        return res.json({
            success: true,
            data: invoicesResult.recordset,
            pagination: {
                page,
                pageSize,
                total: countResult.recordset[0].Total,
                totalPages: Math.ceil(
                    countResult.recordset[0].Total / pageSize
                )
            }
        });
    } catch (error) {
        console.error("Lỗi lấy lịch sử hóa đơn:", error);

        return res.status(500).json({
            success: false,
            message: "Không thể tải lịch sử hóa đơn."
        });
    }
}


async function getInvoiceDetails(req, res) {
    try {
        const invoiceId = Number(req.params.id);

        if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Mã hóa đơn không hợp lệ."
            });
        }

        const pool = await connectDB();

        const invoiceResult = await pool.request()
            .input("InvoiceID", sql.Int, invoiceId)
            .query(`
                SELECT
                    InvoiceID,
                    InvoiceCode,
                    SaleDate,
                    SubTotal,
                    DiscountAmount,
                    VATAmount,
                    TotalAmount,
                    PaymentMethod,
                    CustomerName,
                    CustomerPhone
                FROM Invoices
                WHERE InvoiceID = @InvoiceID;
            `);

        if (invoiceResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy hóa đơn."
            });
        }

        const detailsResult = await pool.request()
            .input("InvoiceID", sql.Int, invoiceId)
            .query(`
                SELECT
                    InvoiceDetailID,
                    ProductID,
                    ProductName,
                    Quantity,
                    UnitPrice,
                    LineTotal
                FROM InvoiceDetails
                WHERE InvoiceID = @InvoiceID
                ORDER BY InvoiceDetailID;
            `);

        return res.json({
            success: true,
            data: {
                invoice: invoiceResult.recordset[0],
                items: detailsResult.recordset
            }
        });
    } catch (error) {
        console.error("Lỗi lấy chi tiết hóa đơn:", error);

        return res.status(500).json({
            success: false,
            message: "Không thể tải chi tiết hóa đơn."
        });
    }
}

module.exports = { checkout,getAllInvoices, getInvoiceDetails };