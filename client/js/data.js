/**
 * Emart Store Data & LocalStorage Management (Vanilla JS)
 */

const DEFAULT_PRODUCTS = [
  {
    id: "p1",
    name: "Cơm Nắm Omusubi Cá Hồi Nướng Emart",
    category: "Đồ Ăn Nhanh & Ready-to-eat",
    price: 12500,
    originalPrice: 18000,
    barcode: "8935001001",
    stock: 14,
    minStockAlert: 10,
    expiryDate: "2026-09-17",
    batchCode: "LOT-20260916-01",
    image: "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=400&auto=format&fit=crop&q=80",
    isFefoAlert: true
  },
  {
    id: "p2",
    name: "Sandwich Gà Cay Phô Mai Tươi Emart",
    category: "Đồ Ăn Nhanh & Ready-to-eat",
    price: 28000,
    originalPrice: 28000,
    barcode: "8935001002",
    stock: 6,
    minStockAlert: 8,
    expiryDate: "2026-09-17",
    batchCode: "LOT-20260915-04",
    image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&auto=format&fit=crop&q=80",
    isFefoAlert: true
  },
  {
    id: "p3",
    name: "Mì Ly Cay Shin Ramyun Hàn Quốc 68g",
    category: "Thực Phẩm & Bánh Kẹo",
    price: 22000,
    originalPrice: 22000,
    barcode: "8935001003",
    stock: 45,
    minStockAlert: 15,
    expiryDate: "2026-12-30",
    batchCode: "LOT-20260810-09",
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&auto=format&fit=crop&q=80"
  },
  {
    id: "p4",
    name: "Trà Sữa Rang No Brand Emart 350ml",
    category: "Đồ Uống & Nước Giải Khát",
    price: 25000,
    originalPrice: 25000,
    barcode: "8935001004",
    stock: 28,
    minStockAlert: 12,
    expiryDate: "2026-11-20",
    batchCode: "LOT-20260715-02",
    image: "https://images.unsplash.com/photo-1558857563-b37fe4332997?w=400&auto=format&fit=crop&q=80"
  },
  {
    id: "p5",
    name: "Nước Khoáng Tinh Khiết Aquafina 500ml",
    category: "Đồ Uống & Nước Giải Khát",
    price: 6000,
    originalPrice: 6000,
    barcode: "8935001005",
    stock: 60,
    minStockAlert: 20,
    expiryDate: "2027-06-15",
    batchCode: "LOT-20260601-11",
    image: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=400&auto=format&fit=crop&q=80"
  },
  {
    id: "p6",
    name: "Snack Rong Biển Sấy Giòn Vị Truyền Thống",
    category: "Thực Phẩm & Bánh Kẹo",
    price: 15000,
    originalPrice: 15000,
    barcode: "8935001006",
    stock: 35,
    minStockAlert: 10,
    expiryDate: "2026-10-25",
    batchCode: "LOT-20260512-07",
    image: "https://images.unsplash.com/photo-1608755728617-aefab37d45f6?w=400&auto=format&fit=crop&q=80"
  },
  {
    id: "p7",
    name: "Sữa Chua Uống Men Sống Probi 65ml (Lốc 5)",
    category: "Đồ Uống & Nước Giải Khát",
    price: 19500,
    originalPrice: 24500,
    barcode: "8935001007",
    stock: 18,
    minStockAlert: 10,
    expiryDate: "2026-09-22",
    batchCode: "LOT-20260905-03",
    image: "https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=400&auto=format&fit=crop&q=80",
    isFefoAlert: true
  },
  {
    id: "p8",
    name: "Bánh Chocopie Lotte Hộp 6 Cái",
    category: "Thực Phẩm & Bánh Kẹo",
    price: 32000,
    originalPrice: 32000,
    barcode: "8935001008",
    stock: 22,
    minStockAlert: 8,
    expiryDate: "2027-03-10",
    batchCode: "LOT-20260401-08",
    image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&auto=format&fit=crop&q=80"
  },
  {
    id: "p9",
    name: "Khăn Giấy Ướt Kháng Khuẩn Không Mùi (Gói 30)",
    category: "Chăm Sóc Cá Nhân & Gia Dụng",
    price: 16000,
    originalPrice: 16000,
    barcode: "8935001009",
    stock: 25,
    minStockAlert: 10,
    expiryDate: "2028-01-01",
    batchCode: "LOT-20260220-14",
    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80"
  },
  {
    id: "p10",
    name: "Kem Que Socola Hạnh Nhân Lotte",
    category: "Kem & Đồ Đông Lạnh",
    price: 21000,
    originalPrice: 21000,
    barcode: "8935001010",
    stock: 15,
    minStockAlert: 10,
    expiryDate: "2027-05-15",
    batchCode: "LOT-20260510-18",
    image: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400&auto=format&fit=crop&q=80"
  }
];

const DEFAULT_STAFF = [
  {
    id: "st-01",
    email: "admin@emart.vn",
    name: "Admin",
    role: "Chủ cửa hàng",
    phone: "0901234567",
    shift: "Ca Hành Chính (08:00 - 17:00)",
    status: "Đang làm việc"
  },
  {
    id: "st-02",
    email: "cashier@emart.vn",
    name: "Trần Thị Mai",
    role: "Nhân viên thu ngân",
    phone: "0912345678",
    shift: "Ca Sáng (06:00 - 14:00)",
    status: "Đang làm việc"
  },
  {
    id: "st-03",
    email: "minh.le@emart.vn",
    name: "Lê Quốc Minh",
    role: "Nhân viên thu ngân",
    phone: "0938112244",
    shift: "Ca Đêm (22:00 - 06:00)",
    status: "Nghỉ việc (Khóa tài khoản không đăng nhập được)"
  }
];

const DEFAULT_CUSTOMERS = [
  { phone: "0909123456", name: "Nguyễn Thị Hoa", points: 35000, tier: "Đồng", totalSpent: 61020, joinedDate: "15/01/2026" },
  { phone: "0918765432", name: "Lê Hoàng Nam", points: 15000, tier: "Đồng", totalSpent: 97200, joinedDate: "20/03/2026" },
  { phone: "0988666888", name: "Phạm Minh Tuấn", points: 5000, tier: "Đồng", totalSpent: 0, joinedDate: "12/08/2026" },
  { phone: "0933112233", name: "Đặng Thu Thảo", points: 72000, tier: "Đồng", totalSpent: 0, joinedDate: "01/01/2026" }
];

const DEFAULT_INVOICES = [
  {
    id: "HD-8823",
    time: "14:20 16/09/2026",
    cashier: "Trần Thị Mai",
    subtotal: 560000,
    memberDiscount: 35000,
    vat: 42000,
    totalAmount: 567000,
    paymentMethod: "Chuyển khoản QR",
    customerPhone: "0933112233",
    customerName: "Đặng Thu Thảo",
    receivedAmount: 567000,
    changeDue: 0,
    items: [
      { name: "Cơm Trộn Bibimbap Thịt Bò Trứng Lòng Đào", quantity: 8, price: 42000, total: 336000 },
      { name: "Khoai Tây Chiên Vị Tự Nhiên No Brand 110g", quantity: 8, price: 28000, total: 224000 }
    ]
  },
  {
    id: "HD-8822",
    time: "11:45 15/09/2026",
    cashier: "Trần Thị Mai",
    subtotal: 168000,
    memberDiscount: 10000,
    vat: 12640,
    totalAmount: 170640,
    paymentMethod: "Tiền mặt",
    customerPhone: "0988666888",
    customerName: "Phạm Minh Tuấn",
    receivedAmount: 200000,
    changeDue: 29360,
    items: [
      { name: "Cơm Trộn Bibimbap Thịt Bò Trứng Lòng Đào", quantity: 4, price: 42000, total: 168000 }
    ]
  },
  {
    id: "HD-8821",
    time: "10:30 16/09/2026",
    cashier: "Trần Thị Mai",
    subtotal: 61500,
    memberDiscount: 5000,
    vat: 4520,
    totalAmount: 61020,
    paymentMethod: "Tiền mặt",
    customerPhone: "0909123456",
    customerName: "Nguyễn Thị Hoa",
    receivedAmount: 100000,
    changeDue: 38980,
    items: [
      { name: "Cơm Nắm Omusubi Cá Hồi Nướng Emart", quantity: 2, price: 18000, total: 36000 },
      { name: "Sandwich Gà Cay Phô Mai Tươi Emart", quantity: 1, price: 19500, total: 19500 },
      { name: "Nước Khoáng Tinh Khiết Aquafina 500ml", quantity: 1, price: 6000, total: 6000 }
    ]
  },
  {
    id: "HD-8820",
    time: "09:15 16/09/2026",
    cashier: "Trần Thị Mai",
    subtotal: 41000,
    memberDiscount: 0,
    vat: 3280,
    totalAmount: 44280,
    paymentMethod: "Chuyển khoản QR",
    customerPhone: "",
    customerName: "Khách vãng lai",
    receivedAmount: 44280,
    changeDue: 0,
    items: [
      { name: "Trà Sữa Rang No Brand Emart 350ml", quantity: 1, price: 25000, total: 25000 },
      { name: "Khăn Giấy Ướt Kháng Khuẩn Không Mùi (Gói 30)", quantity: 1, price: 16000, total: 16000 }
    ]
  },
  {
    id: "HD-8819",
    time: "08:45 16/09/2026",
    cashier: "Trần Thị Mai",
    subtotal: 105000,
    memberDiscount: 15000,
    vat: 7200,
    totalAmount: 97200,
    paymentMethod: "Tiền mặt",
    customerPhone: "0918765432",
    customerName: "Lê Hoàng Nam",
    receivedAmount: 100000,
    changeDue: 2800,
    items: [
      { name: "Khoai Tây Chiên Vị Tự Nhiên No Brand 110g", quantity: 2, price: 28000, total: 56000 },
      { name: "Kem Que Socola Hạnh Nhân Lotte", quantity: 2, price: 21000, total: 42000 },
      { name: "Khăn Giấy Ướt Kháng Khuẩn Không Mùi (Gói 30)", quantity: 1, price: 16000, total: 16000 }
    ]
  }
];

// Helper functions
function getStorage(key, defaultVal) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
}

function setStorage(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error("Storage error:", e);
  }
}

// Dữ liệu sản phẩm lấy từ SQL Server thông qua API
let apiProductsCache = null;

async function loadProductsFromAPI() {
  try {
    const response = await fetch("/api/products");

    if (!response.ok) {
      throw new Error("Không thể kết nối API sản phẩm");
    }

    const result = await response.json();

    if (!result.success || !Array.isArray(result.data)) {
      throw new Error("Dữ liệu sản phẩm trả về không hợp lệ");
    }

   apiProductsCache = result.data
  .filter(p => p.IsActive)
  .map(p => ({
    id: String(p.ProductID),
    name: p.ProductName,
    category: p.CategoryName || "Chưa phân loại",

    // Giá bán và thông tin FEFO
    price: Number(p.SellingPrice) || 0,
    originalPrice: Number(
      p.OriginalSellingPrice ?? p.SellingPrice
    ) || 0,
    fefoDiscountPercent: Number(p.FefoDiscountPercent) || 0,
    fefoActionStatus: p.FefoActionStatus || null,

    barcode: p.Barcode || "",
    stock: Number(p.CurrentStock) || 0,
    minStockAlert: Number(p.MinStock) || 5,

    expiryDate: p.ExpiryDate
      ? p.ExpiryDate.substring(0, 10)
      : "2099-12-31",

    batchCode: "",
    image: p.ImageURL || "",
    isFefoAlert: false
  }));

    console.log("Đã tải sản phẩm từ SQL Server:", apiProductsCache.length);

    return apiProductsCache;
  } catch (error) {
    console.error("Lỗi tải sản phẩm từ SQL Server:", error);
    throw error;
  }
}
///
function getProducts() {
  if (apiProductsCache !== null) {
    return apiProductsCache;
  }

  let products = getStorage("emart_products", null);

  if (!products || !Array.isArray(products) || products.length === 0) {
    products = DEFAULT_PRODUCTS;
    setStorage("emart_products", products);
  }

  return products;
}

function saveProducts(products) {
  setStorage("emart_products", products);
}

function getStaffList() {
  let staff = getStorage("emart_staff", null);
  if (!staff) {
    staff = DEFAULT_STAFF;
    setStorage("emart_staff", staff);
  }
  return staff;
}

function saveStaffList(staff) {
  setStorage("emart_staff", staff);
}

function getCustomers() {
  let cust = getStorage("emart_customers", null);
  if (!cust) {
    cust = DEFAULT_CUSTOMERS;
    setStorage("emart_customers", cust);
  }
  return cust;
}

function saveCustomers(cust) {
  setStorage("emart_customers", cust);
}

function getInvoices() {
  let inv = getStorage("emart_invoices", null);
  if (!inv || !Array.isArray(inv) || inv.length === 0) {
    inv = DEFAULT_INVOICES;
    setStorage("emart_invoices", inv);
  } else {
    let changed = false;
    DEFAULT_INVOICES.forEach(defInv => {
      if (!inv.some(i => i.id === defInv.id)) {
        inv.push(defInv);
        changed = true;
      }
    });
    if (changed) setStorage("emart_invoices", inv);
  }
  return inv;
}

function saveInvoices(inv) {
  setStorage("emart_invoices", inv);
}

// Cấu hình tài khoản ngân hàng & ví điện tử hộ kinh doanh (Do Chủ cửa hàng quản lý)
const DEFAULT_PAYMENT_CONFIG = {
  bankCode: "VCB",
  bankName: "Ngân hàng TMCP Ngoại Thương Việt Nam (Vietcombank)",
  accountNumber: "0071008899668",
  accountName: "HỘ KINH DOANH CỬA HÀNG EMART - NGUYỄN VĂN AN",
  momoPhone: "0909123456",
  momoName: "HỘ KINH DOANH EMART (NGUYỄN VĂN AN)",
  zalopayPhone: "0909123456",
  zalopayName: "HỘ KINH DOANH EMART (NGUYỄN VĂN AN)"
};


// Lấy cấu hình thanh toán từ bộ nhớ local
function getPaymentConfig() {
  return getStorage("emart_payment_config", DEFAULT_PAYMENT_CONFIG);
}

// Tải cấu hình mới nhất từ SQL Server
async function loadPaymentConfigFromAPI() {
  try {
    const response = await fetch("/api/payment-settings");
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Không tải được cấu hình thanh toán.");
    }

    if (result.data) {
      const data = result.data;

      const config = {
        bankCode: data.BankCode || DEFAULT_PAYMENT_CONFIG.bankCode,
        bankName: data.BankName || DEFAULT_PAYMENT_CONFIG.bankName,
        accountNumber: data.AccountNumber || DEFAULT_PAYMENT_CONFIG.accountNumber,
        accountName: data.AccountName || DEFAULT_PAYMENT_CONFIG.accountName,
        momoPhone: data.MomoPhone || DEFAULT_PAYMENT_CONFIG.momoPhone,
        momoName: data.MomoName || DEFAULT_PAYMENT_CONFIG.momoName,
        zalopayPhone: data.ZaloPayPhone || DEFAULT_PAYMENT_CONFIG.zalopayPhone,
        zalopayName: data.ZaloPayName || DEFAULT_PAYMENT_CONFIG.zalopayName
      };

      setStorage("emart_payment_config", config);
      return config;
    }

    return getPaymentConfig();

  } catch (error) {
    console.error("Lỗi tải cấu hình thanh toán:", error);
    return getPaymentConfig();
  }
}

// Lưu cấu hình vào SQL Server và cập nhật bộ nhớ local
async function savePaymentConfig(config) {
  const response = await fetch("/api/payment-settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(config)
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Không thể lưu cấu hình thanh toán.");
  }

  setStorage("emart_payment_config", config);

  return result;
}


// Báo cáo kiểm kê hàng hóa & cận date từ nhân viên gửi lên chủ cửa hàng
const DEFAULT_INVENTORY_REPORTS = [
  {
    id: "RP-20260916-01",
    submittedAt: "09:30 16/09/2026",
    reporterId: "st-02",
    reporterName: "Trần Thị Mai",
    status: "Chờ duyệt",
    note: "Kiểm kê ca sáng: Phát hiện Cơm nắm cá hồi cận hạn 24h và Cơm trộn Bibimbap chạm ngưỡng tồn kho còn 3 suất.",
    items: [
      {
        id: "p1",
        name: "Cơm Nắm Omusubi Cá Hồi Nướng Emart",
        barcode: "8935001001",
        batchCode: "LOT-20260915-01",
        stock: 14,
        minStockAlert: 5,
        expiryDate: "2026-09-17",
        daysLeft: 1,
        type: "Cận date cực kỳ nguy cấp",
        suggestedDiscount: 40
      },
      {
        id: "p4",
        name: "Cơm Trộn Bibimbap Thịt Bò Trứng Lòng Đào",
        barcode: "8935001004",
        batchCode: "LOT-20260915-04",
        stock: 3,
        minStockAlert: 5,
        expiryDate: "2026-09-16",
        daysLeft: 0,
        type: "Chạm ngưỡng tồn & Hạn hôm nay",
        suggestedDiscount: 50
      }
    ]
  }
];

function getInventoryReports() {
  return getStorage("emart_inventory_reports", DEFAULT_INVENTORY_REPORTS);
}

function saveInventoryReports(reports) {
  setStorage("emart_inventory_reports", reports);
}

// Báo cáo kết ca, kiểm két tiền mặt/chuyển khoản và tồn kho cuối ngày
const DEFAULT_SHIFT_REPORTS = [
  {
    id: "SHIFT-20260916-02",
    date: "16/09/2026",
    dateISO: "2026-09-16",
    shiftName: "Ca Chiều (14:00 - 22:00)",
    cashierId: "st-02",
    cashierName: "Trần Thị Mai",
    timeSubmitted: "22:05 16/09/2026",
    totalOrders: 5,
    totalRevenue: 345000,
    systemCash: 220000,
    systemTransfer: 125000,
    initialDrawerCash: 1000000,
    expectedDrawerCash: 1220000,
    actualDrawerCash: 1220000,
    cashDifference: 0,
    differenceStatus: "Khớp két 100%",
    inventorySummary: {
      totalSoldItems: 12,
      totalStockRemaining: 230,
      topSellingItems: [
        { name: "Trà Sữa Rang No Brand Emart 350ml", qty: 4, price: 25000 },
        { name: "Mì Ly Cay Shin Ramyun Hàn Quốc 68g", qty: 3, price: 22000 },
        { name: "Bánh Chocopie Lotte Hộp 6 Cái", qty: 2, price: 32000 },
        { name: "Sandwich Gà Cay Phô Mai Tươi Emart", qty: 3, price: 19500 }
      ],
      nearExpiryCount: 2,
      lowStockCount: 2
    },
    note: "Bàn giao kết ca chiều. Đã kiểm đếm kỹ két tiền mặt và đối soát biên lai VietQR, khớp 100%.",
    status: "Chờ chủ xác nhận"
  },
  {
    id: "SHIFT-20260916-01",
    date: "16/09/2026",
    dateISO: "2026-09-16",
    shiftName: "Ca Sáng (06:00 - 14:00)",
    cashierId: "st-02",
    cashierName: "Trần Thị Mai",
    timeSubmitted: "14:05 16/09/2026",
    totalOrders: 3,
    totalRevenue: 208980,
    systemCash: 158220, // Doanh thu tiền mặt theo hóa đơn
    systemTransfer: 50760, // Doanh thu chuyển khoản QR / Ví theo hóa đơn
    initialDrawerCash: 1000000, // Tiền lẻ đầu ca
    expectedDrawerCash: 1158220, // Lý thuyết trong két
    actualDrawerCash: 1158220, // Thực tế đếm được
    cashDifference: 0, // Chênh lệch
    differenceStatus: "Khớp két 100%",
    inventorySummary: {
      totalSoldItems: 7,
      totalStockRemaining: 242,
      topSellingItems: [
        { name: "Cơm Nắm Omusubi Cá Hồi Nướng Emart", qty: 2, price: 18000 },
        { name: "Khoai Tây Chiên Vị Tự Nhiên No Brand 110g", qty: 2, price: 35000 },
        { name: "Kem Que Socola Hạnh Nhân Lotte", qty: 2, price: 21000 },
        { name: "Bánh Tráng Cuộn Trứng Muối Sấy Giòn", qty: 1, price: 22000 }
      ],
      nearExpiryCount: 3,
      lowStockCount: 2
    },
    note: "Bàn giao két ca sáng cho ca chiều. Két tiền mặt khớp 100%, hàng hóa không có thất thoát hay hư hại.",
    status: "Chủ shop đã duyệt & lưu"
  }
];

// Danh sách báo cáo kết ca từ SQL Server
let shiftReportsCache = [];

// Lấy danh sách báo cáo kết ca
function getShiftReports() {
  return shiftReportsCache;
}

// Tải báo cáo kết ca từ SQL Server
async function loadShiftReportsFromAPI() {
  try {
    const response = await fetch("/api/shift-reports");
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Không tải được báo cáo kết ca.");
    }

    shiftReportsCache = (result.data || []).map(r => ({
      id: r.ReportCode,
      reportId: r.ShiftReportID,
      cashierId: r.EmployeeCode,
      cashierName: r.EmployeeName,
      shiftName: r.ShiftName,
      date: r.ReportDate,
      timeSubmitted: r.TimeSubmitted,
      totalOrders: Number(r.TotalOrders || 0),
      totalRevenue: Number(r.TotalRevenue || 0),
      systemCash: Number(r.SystemCash || 0),
      systemTransfer: Number(r.SystemTransfer || 0),
      initialDrawerCash: Number(r.InitialDrawerCash || 0),
      expectedDrawerCash: Number(r.ExpectedDrawerCash || 0),
      actualDrawerCash: Number(r.ActualDrawerCash || 0),
      cashDifference: Number(r.CashDifference || 0),
      differenceStatus: r.DifferenceStatus,
      totalSoldItems: Number(r.TotalSoldItems || 0),
      totalStockRemaining: Number(r.TotalStockRemaining || 0),
      nearExpiryCount: Number(r.NearExpiryCount || 0),
      lowStockCount: Number(r.LowStockCount || 0),
      note: r.Note,
      status: r.Status,
      approvalNote: r.ApprovalNote,
      approvedBy: r.ApprovedBy,
      approvedAt: r.ApprovedAt
    }));

    return shiftReportsCache;

  } catch (error) {
    console.error("Lỗi tải báo cáo kết ca:", error);
    throw error;
  }
}

function saveShiftReports(reports) {
  setStorage("emart_shift_reports", reports);
}

// Format Currency
function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// FEFO Date Difference Calculator (Relative to current simulated date: 16/09/2026)
// FEFO Date Difference Calculator (Theo ngày hiện tại)
function getDaysUntilExpiry(expiryDateStr) {
    if (!expiryDateStr) return NaN;

    // Lấy ngày hiện tại theo máy tính, bỏ phần giờ
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Tách ngày để tránh lỗi lệch múi giờ
    const parts = String(expiryDateStr).split("-");
    if (parts.length !== 3) return NaN;

    const target = new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2])
    );
    target.setHours(0, 0, 0, 0);

    const diffTime = target - now;

    return Math.round(diffTime / (1000 * 60 * 60 * 24));
}
// Phát âm thanh thông báo rõ ràng bằng Web Audio API
function playNotificationSound(type = "success") {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (type === "success") {
      // Âm báo thành công: 3 nốt chuông sáng rõ (C5 -> E5 -> G5)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        gain.gain.setValueAtTime(0.001, now + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.35, now + idx * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.3);
      });
    } else if (type === "error" || type === "warning") {
      // Âm cảnh báo: 2 tiếng bíp trầm rõ
      const notes = [380, 290];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, now + idx * 0.14);
        gain.gain.setValueAtTime(0.001, now + idx * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.28, now + idx * 0.14 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.14);
        osc.stop(now + idx * 0.14 + 0.25);
      });
    } else {
      // Âm thao tác (click / info): 2 nốt cao rõ ràng (A5 -> C6)
      const notes = [880, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.001, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.3, now + idx * 0.07 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.22);
      });
    }
  } catch (e) {
    // Ignore audio context restriction errors
  }
}

// Elegant In-App Toast Notification (With clear sound & high-contrast visual banner)
function showToast(message, type = "success") {
  playNotificationSound(type);
  let container = document.getElementById("emart-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "emart-toast-container";
    container.className = "fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-md pointer-events-none";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `pointer-events-auto transform translate-y-3 opacity-0 transition-all duration-300 ease-out flex items-start gap-3 p-3.5 rounded-2xl shadow-xl border text-xs font-semibold ${
    type === "success" 
      ? "bg-slate-900 text-white border-emerald-500/40" 
      : type === "error" 
      ? "bg-red-950 text-white border-red-500/40" 
      : type === "warning"
      ? "bg-amber-950 text-white border-amber-500/40"
      : "bg-slate-900 text-white border-blue-500/40"
  }`;

  const iconName = type === "success" ? "check-circle" : type === "error" ? "alert-circle" : type === "warning" ? "alert-triangle" : "info";
  const iconColor = type === "success" ? "text-emerald-400" : type === "error" ? "text-red-400" : type === "warning" ? "text-amber-400" : "text-blue-400";

  toast.innerHTML = `
    <div class="shrink-0 mt-0.5 ${iconColor}">
      <i data-lucide="${iconName}" class="w-4 h-4"></i>
    </div>
    <div class="flex-1 whitespace-pre-line leading-relaxed">${message}</div>
    <button class="shrink-0 text-slate-400 hover:text-white transition ml-1" onclick="this.parentElement.remove()">
      <i data-lucide="x" class="w-3.5 h-3.5"></i>
    </button>
  `;

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  requestAnimationFrame(() => {
    toast.classList.remove("translate-y-3", "opacity-0");
    toast.classList.add("translate-y-0", "opacity-100");
  });

  setTimeout(() => {
    toast.classList.remove("translate-y-0", "opacity-100");
    toast.classList.add("translate-y-3", "opacity-0");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
