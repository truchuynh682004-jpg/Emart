
const express = require("express");
const sql = require("mssql");
const { connectDB } = require("../database/connection");

const router = express.Router();

// GET /api/invoices
router.get("/", async (req, res) => {
  try {
    const pool = await connectDB();

    const result = await pool.request().query(`
      SELECT
        i.InvoiceID,
        i.InvoiceCode,
        i.SaleDate,
        i.SubTotal,
        i.DiscountAmount,
        i.VATAmount,
        i.TotalAmount,
        i.PaymentMethod,
        i.CustomerName,
        i.CustomerPhone,
        d.InvoiceDetailID,
        d.ProductID,
        d.ProductName,
        d.Quantity,
        d.UnitPrice,
        d.LineTotal
      FROM Invoices i
      LEFT JOIN InvoiceDetails d
        ON i.InvoiceID = d.InvoiceID
      ORDER BY i.SaleDate DESC, d.InvoiceDetailID ASC
    `);

    const invoiceMap = new Map();

    for (const row of result.recordset) {
      if (!invoiceMap.has(row.InvoiceID)) {
        invoiceMap.set(row.InvoiceID, {
          id: row.InvoiceCode,
          time: row.SaleDate,
          cashier: "",
          subtotal: Number(row.SubTotal),
          memberDiscount: Number(row.DiscountAmount),
          vat: Number(row.VATAmount),
          totalAmount: Number(row.TotalAmount),
          paymentMethod: row.PaymentMethod,
          customerName: row.CustomerName || "Khách vãng lai",
          customerPhone: row.CustomerPhone || "",
          items: []
        });
      }

      if (row.ProductID != null) {
        invoiceMap.get(row.InvoiceID).items.push({
          id: row.ProductID,
          name: row.ProductName,
          quantity: Number(row.Quantity),
          price: Number(row.UnitPrice),
          lineTotal: Number(row.LineTotal)
        });
      }
    }

    res.json({
      success: true,
      data: Array.from(invoiceMap.values())
    });
  } catch (error) {
    console.error("Lỗi lấy lịch sử hóa đơn:", error);

    res.status(500).json({
      success: false,
      message: "Không thể lấy lịch sử hóa đơn từ SQL Server."
    });
  }
});

module.exports = router;
