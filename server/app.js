
console.log("=== Bắt đầu chạy app.js ===");

const express = require("express");
const path = require("path");

const { connectDB } = require("./database/connection");
const categoryRoutes = require("./routes/categories");
const productRoutes = require("./routes/products");
const supplierRoutes = require("./routes/suppliers");
const salesRoutes = require("./routes/sales");
const invoicesRoutes = require("./routes/invoices");
const employeeRoutes = require("./routes/employees");
const authRoutes = require("./routes/auth");
const customerRoutes = require("./routes/customers");
const employeeReportRoutes = require("./routes/employeeReports");
const paymentSettingsRoutes = require("./routes/paymentSettings");
const shiftReportRoutes = require("./routes/shiftReports");
const backupRoutes = require("./routes/backup");


const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../client")));

app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/invoices", invoicesRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/employee-reports", employeeReportRoutes);
app.use("/api/payment-settings", paymentSettingsRoutes);
app.use("/api/shift-reports", shiftReportRoutes);
app.use("/api/backup", backupRoutes);


(async () => {
    try {
        console.log("Đang kết nối SQL Server...");
        await connectDB();

        app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
    } catch (error) {
        console.error("Không thể khởi động server:", error);
    }
})();
