
const sql = require("mssql");
const { connectDB } = require("../database/connection");

// Lấy cấu hình thanh toán
async function getPaymentSettings(req, res) {
  try {
    const pool = await connectDB();

    const result = await pool.request().query(`
      SELECT TOP 1
        SettingID,
        BankCode,
        BankName,
        AccountNumber,
        AccountName,
        MomoPhone,
        MomoName,
        ZaloPayPhone,
        ZaloPayName,
        CreatedAt,
        UpdatedAt
      FROM PaymentSettings
      ORDER BY SettingID DESC;
    `);

    return res.json({
      success: true,
      data: result.recordset[0] || null
    });

  } catch (error) {
    console.error("Lỗi lấy cấu hình thanh toán:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy cấu hình thanh toán."
    });
  }
}

// Lưu hoặc cập nhật cấu hình thanh toán
async function savePaymentSettings(req, res) {
  try {
    const {
      bankCode,
      bankName,
      accountNumber,
      accountName,
      momoPhone,
      momoName,
      zalopayPhone,
      zalopayName
    } = req.body;

    const pool = await connectDB();

    const result = await pool.request()
      .input("BankCode", sql.NVarChar(20), bankCode || null)
      .input("BankName", sql.NVarChar(100), bankName || null)
      .input("AccountNumber", sql.NVarChar(50), accountNumber || null)
      .input("AccountName", sql.NVarChar(200), accountName || null)
      .input("MomoPhone", sql.NVarChar(20), momoPhone || null)
      .input("MomoName", sql.NVarChar(200), momoName || null)
      .input("ZaloPayPhone", sql.NVarChar(20), zalopayPhone || null)
      .input("ZaloPayName", sql.NVarChar(200), zalopayName || null)
      .query(`
        IF EXISTS (SELECT 1 FROM PaymentSettings)
        BEGIN
          UPDATE PaymentSettings
          SET
            BankCode = @BankCode,
            BankName = @BankName,
            AccountNumber = @AccountNumber,
            AccountName = @AccountName,
            MomoPhone = @MomoPhone,
            MomoName = @MomoName,
            ZaloPayPhone = @ZaloPayPhone,
            ZaloPayName = @ZaloPayName,
            UpdatedAt = GETDATE();
        END
        ELSE
        BEGIN
          INSERT INTO PaymentSettings (
            BankCode,
            BankName,
            AccountNumber,
            AccountName,
            MomoPhone,
            MomoName,
            ZaloPayPhone,
            ZaloPayName
          )
          VALUES (
            @BankCode,
            @BankName,
            @AccountNumber,
            @AccountName,
            @MomoPhone,
            @MomoName,
            @ZaloPayPhone,
            @ZaloPayName
          );
        END;

        SELECT TOP 1 *
        FROM PaymentSettings
        ORDER BY SettingID DESC;
      `);

    return res.json({
      success: true,
      message: "Lưu cấu hình thanh toán thành công.",
      data: result.recordset[0]
    });

  } catch (error) {
    console.error("Lỗi lưu cấu hình thanh toán:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lưu cấu hình thanh toán."
    });
  }
}

module.exports = {
  getPaymentSettings,
  savePaymentSettings
};
