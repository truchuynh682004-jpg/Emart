/**
 * Emart Management Dashboard Logic (Pure Vanilla JS)
 * Đầy đủ tính năng phân quyền Chủ cửa hàng:
 * 1. Danh mục hàng hóa: Dropdown 3 chấm (Sửa/Xóa), Thêm mới cạnh ô tìm kiếm, Upload/Dán ảnh, Cảnh báo tồn kho tối thiểu.
 * 2. Hạn dùng FEFO: UI/UX hiện đại, Tự set % xả hàng tùy chỉnh, Trả hàng cho Nhà cung cấp.
 * 3. Lịch sử hóa đơn: Xem chi tiết toàn diện hóa đơn bán lẻ, in lại bill.
 * 4. Quản lý nhân viên: Thêm nhân viên, đổi trạng thái; Chủ cửa hàng không bị đổi trạng thái/không bị xóa.
 * 5. CRM Khách hàng thân thiết: 1 điểm = 1 đồng, xem chi tiết chi tiêu để xét duyệt nâng hạng.
 */

let activeTab = "overview";
let salesChart = null;
let currentFefoFilter = "all";
let currentUploadedImageBase64 = "";
let currentUploadedImageFile = null;

// ===============================
// CẬP NHẬT NGÀY KIỂM SOÁT FEFO
// ===============================
function updateFefoControlDate() {
    const dateElement = document.getElementById("fefo-control-date");
    if (!dateElement) return;

    const now = new Date();

    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();

    dateElement.textContent = `Ngày kiểm soát: ${day}/${month}/${year}`;
}

// Close dropdowns on outside click
document.addEventListener("click", (e) => {
  if (!e.target.closest(".dropdown-container")) {
    hideAllDropdowns();
  }
});

function hideAllDropdowns() {
  document.querySelectorAll(".action-dropdown").forEach(d => d.classList.add("hidden"));
}

function toggleActionDropdown(event, id) {
  event.stopPropagation();
  const dropdown = document.getElementById("dropdown-" + id);
  if (!dropdown) return;
  const isHidden = dropdown.classList.contains("hidden");
  hideAllDropdowns();
  if (isHidden) {
    dropdown.classList.remove("hidden");
  }
}

// TAB SWITCHER
function switchTab(tabId) {
  const user = getCurrentUser();
  const isOwner = user && user.role === "Chủ cửa hàng";
  const staffAllowedTabs = ["products", "fefo"];

  if (!isOwner && !staffAllowedTabs.includes(tabId)) {
    tabId = "products";
  }

  activeTab = tabId;

  // Update sidebar buttons
  document.querySelectorAll(".sidebar-tab-btn").forEach(btn => {
    if (!isOwner && btn.dataset.ownerOnly === "true") {
      btn.classList.add("hidden");
      return;
    }
    if (btn.dataset.tab === tabId) {
      btn.className = "sidebar-tab-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-[#FFD700] text-[#005A2B] shadow-xs";
    } else {
      btn.className = "sidebar-tab-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition";
    }
  });

  // Hide all sections
  document.querySelectorAll(".dashboard-section").forEach(sec => sec.classList.add("hidden"));

  // Show active section
  const target = document.getElementById("section-" + tabId);
  if (target) {
    target.classList.remove("hidden");
  }

  // Refresh tab content
  if (tabId === "overview") {
  renderOverview();
} else if (tabId === "products") {
  if (typeof loadProductsFromAPI === "function") {
    loadProductsFromAPI()
      .then(() => {
        renderProductsTable();
        checkLowStockPushNotification();
      })
      .catch(error => {
        console.error("Không tải được tồn kho từ API:", error);
        renderProductsTable();
      });
  } else {
    renderProductsTable();
  }
} else if (tabId === "fefo") {
  if (typeof loadProductsFromAPI === "function") {
    loadProductsFromAPI()
      .then(() => {
        renderFefoAlerts();
      })
      .catch(error => {
        console.error("Không tải được dữ liệu FEFO từ API:", error);
        renderFefoAlerts();
      });
  } else {
    renderFefoAlerts();
  }
}
  else if (tabId === "invoices") {
  loadInvoicesFromAPI().then(() => {
    renderInvoicesTable();
  });
}
  else if (tabId === "staff") renderStaffTable();
  else if (tabId === "deleted-products") loadDeletedProducts();
  else if (tabId === "crm") renderCrmTable();
else if (tabId === "reports") {
  // Hiển thị báo cáo FEFO cũ
  renderReportsSection();

  // Tải báo cáo nhân viên từ SQL Server
  loadEmployeeReports();
}
  else if (tabId === "payment-settings") renderPaymentSettingsSection();
  else if (tabId === "shift-reports") {
  loadShiftReportsFromAPI()
    .then(() => {
      renderShiftReportsSection();
    })
    .catch(error => {
      console.error("Không tải được báo cáo kết ca:", error);
      showToast("Không thể tải báo cáo kết ca từ máy chủ.", "error");
    });
}

  // Check low stock push alerts & pending report notifications on every tab switch
  checkLowStockPushNotification();
  if (isOwner) {
    checkPendingReportsNotification();
    checkPendingShiftReportsNotification();
  }

  if (window.lucide) lucide.createIcons();
}

// ==========================================
// 1. RENDER OVERVIEW
// ==========================================
async function renderOverview() {
  const products = getProducts();

  // Lấy hóa đơn mới nhất từ SQL Server
  const invoices = await loadInvoicesFromAPI();

  const revenueEl = document.getElementById("stat-revenue");
  const ordersEl = document.getElementById("stat-orders");

  // Không dùng hóa đơn mẫu nếu API bị lỗi
  if (!Array.isArray(invoices)) {
    if (revenueEl) revenueEl.innerText = "Không tải được";
    if (ordersEl) ordersEl.innerText = "--";
    renderRevenueChart([]);
    return;
  }

  const totalRev = invoices
    .filter(inv => inv.status !== "Đã hủy")
    .reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);

  const totalOrders = invoices.length;

  const fefoAlertCount = products.filter(
    p => getDaysUntilExpiry(p.expiryDate) <= 7
  ).length;

  const lowStockCount = products.filter(
    p => p.stock <= (p.minStockAlert || 5)
  ).length;

  if (revenueEl) revenueEl.innerText = formatVND(totalRev);
  if (ordersEl) ordersEl.innerText = totalOrders + " đơn";

  document.getElementById("stat-fefo").innerText =
    fefoAlertCount + " mặt hàng";

  document.getElementById("stat-lowstock").innerText =
    lowStockCount + " mặt hàng";

  renderRevenueChart(invoices);
}

function renderRevenueChart(invoices) {
  const ctx = document.getElementById("revenueChart");
  if (!ctx) return;

  if (salesChart) {
    salesChart.destroy();
  }

  const hours = Array.from(
    { length: 24 },
    (_, hour) => String(hour).padStart(2, "0") + ":00"
  );

  const revenueData = Array(24).fill(0);

  invoices
    .filter(inv => inv.status !== "Đã hủy")
    .forEach(inv => {
      const date = new Date(inv.createdAt || inv.time);

      if (Number.isNaN(date.getTime())) return;

      const hour = date.getHours();
      revenueData[hour] += Number(inv.totalAmount || 0);
    });

  salesChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: hours,
      datasets: [{
        label: "Doanh thu theo giờ (VND)",
        data: revenueData,
        borderColor: "#005A2B",
        backgroundColor: "rgba(0, 90, 43, 0.1)",
        tension: 0.35,
        fill: true,
        pointBackgroundColor: "#FFA500",
        pointBorderColor: "#FFFFFF",
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => value.toLocaleString("vi-VN")
          }
        }
      }
    }
  });
}
// Low Stock Alert Push Notification Checker
function checkLowStockPushNotification() {
  const products = getProducts();
  const lowStockItems = products.filter(p => p.stock <= (p.minStockAlert || 5));
  const badge = document.getElementById("header-stock-alert-badge");
  const text = document.getElementById("header-stock-alert-text");

  if (badge && text) {
    if (lowStockItems.length > 0) {
      badge.classList.remove("hidden");
      text.innerText = `Cảnh báo: Có ${lowStockItems.length} sản phẩm chạm ngưỡng tồn kho tối thiểu!`;
    } else {
      badge.classList.add("hidden");
    }
  }
}

// Khi bấm vào cảnh báo tồn kho ở Header hoặc thẻ KPI Chạm Ngưỡng Tồn:
// Chuyển ngay sang tab Danh Mục Hàng Hóa và tự động lọc ra đúng các sản phẩm chạm ngưỡng tồn kho tối thiểu
function handleHeaderLowStockClick() {
  const searchEl = document.getElementById("product-search-input");
  const catEl = document.getElementById("product-category-filter");
  const expEl = document.getElementById("product-expiry-filter");
  const stockEl = document.getElementById("product-stock-filter");

  if (searchEl) searchEl.value = "";
  if (catEl) catEl.value = "all";
  if (expEl) expEl.value = "all";
  if (stockEl) stockEl.value = "low";

  switchTab("products");

  const products = getProducts();
  const lowStockItems = products.filter(p => p.stock <= (p.minStockAlert || 5));
  showToast(
    `📦 Đã chuyển đến Danh Mục Hàng Hóa và lọc ra ${lowStockItems.length} sản phẩm chạm ngưỡng tồn kho tối thiểu cần nhập thêm hàng!`,
    "warning"
  );
}

// ==========================================
// TIỆN ÍCH XUẤT EXCEL CHUẨN ĐỊNH DẠNG TOÀN HỆ THỐNG:
// - Hàng đầu tiên (Header): Tô màu xanh dương nhạt (#CFE2F3), cỡ chữ 14, in đậm, kiểu chữ Arial, có kẻ viền ô
// - Các hàng dưới: Nền màu trắng (#FFFFFF), cỡ chữ 12, kiểu chữ Arial, có kẻ viền ô
// - Hàng cuối: Ghi ngày xuất file
// ==========================================
function getFormattedExportDateStr() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function exportStyledExcelWorkbook({ headers, dataRows, colWidths, sheetName, fileName }) {
  const aoa = [headers, ...dataRows];
  const numRows = aoa.length;
  const numCols = headers.length;

  const thinBorder = {
    top: { style: "thin", color: { rgb: "000000" } },
    bottom: { style: "thin", color: { rgb: "000000" } },
    left: { style: "thin", color: { rgb: "000000" } },
    right: { style: "thin", color: { rgb: "000000" } }
  };

  if (window.XLSX) {
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Đảm bảo phạm vi bảng bao phủ toàn bộ các ô để kẻ viền đầy đủ
    ws["!ref"] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: numRows - 1, c: numCols - 1 }
    });

    // Tự động căn chỉnh độ rộng cột (AutoFit Column Width) kết hợp độ rộng tối thiểu
    const computedColWidths = headers.map((h, cIdx) => {
      const minWch = colWidths && colWidths[cIdx] && colWidths[cIdx].wch ? colWidths[cIdx].wch : 14;
      let maxCharLen = String(h || "").length + 6;
      for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
        const val = dataRows[rIdx]?.[cIdx];
        if (val !== undefined && val !== null) {
          const strVal = typeof val === "number" ? val.toLocaleString("vi-VN") : String(val);
          const lines = strVal.split(/\r?\n/);
          lines.forEach(line => {
            if (line.length + 4 > maxCharLen) {
              maxCharLen = line.length + 4;
            }
          });
        }
      }
      return { wch: Math.min(68, Math.max(minWch, maxCharLen)) };
    });

    const rowHeights = [];
    for (let R = 0; R < numRows; R++) {
      const isHeader = R === 0;
      let maxLinesInRow = 1;

      for (let C = 0; C < numCols; C++) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellRef]) {
          ws[cellRef] = { t: "s", v: "" };
        } else if (ws[cellRef].v === undefined || ws[cellRef].v === null) {
          ws[cellRef].t = "s";
          ws[cellRef].v = "";
        }

        const cellText = String(ws[cellRef].v ?? "");
        const colWch = computedColWidths[C]?.wch || 20;
        const explicitLines = cellText.split(/\r?\n/);
        let estimatedLines = 0;
        explicitLines.forEach(line => {
          estimatedLines += Math.max(1, Math.ceil(line.length / Math.max(12, colWch - 3)));
        });
        if (estimatedLines > maxLinesInRow) {
          maxLinesInRow = estimatedLines;
        }

        const isNumber = typeof ws[cellRef].v === "number";
        if (isNumber && !isHeader) {
          ws[cellRef].z = "#,##0";
        }

        if (isHeader) {
          // Hàng đầu tiên: nền xanh dương nhạt, cỡ chữ 14, in đậm, Arial, kẻ viền ô
          ws[cellRef].s = {
            font: { name: "Arial", sz: 14, bold: true, color: { rgb: "000000" } },
            fill: { patternType: "solid", fgColor: { rgb: "CFE2F3" } },
            border: thinBorder,
            alignment: { vertical: "center", horizontal: "center", wrapText: true }
          };
        } else {
          // Các hàng dưới: nền trắng, cỡ chữ 12, Arial, kẻ viền ô
          ws[cellRef].s = {
            font: { name: "Arial", sz: 12, bold: false, color: { rgb: "000000" } },
            fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
            border: thinBorder,
            alignment: {
              vertical: "center",
              horizontal: isNumber ? "right" : (C === 0 ? "center" : "left"),
              wrapText: true
            }
          };
        }
      }

      // AutoFit Row Height: tự động giãn chiều cao dòng theo số dòng văn bản trong ô
      if (isHeader) {
        rowHeights.push({ hpt: Math.max(30, maxLinesInRow * 20 + 8) });
      } else {
        rowHeights.push({ hpt: Math.max(24, maxLinesInRow * 18 + 6) });
      }
    }

    ws["!rows"] = rowHeights;
    ws["!cols"] = computedColWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName || "Sheet1");
    XLSX.writeFile(wb, fileName);
  } else {
    // Fallback HTML Table .xls giữ nguyên định dạng Arial, cỡ 14 in đậm nền xanh dương nhạt & cỡ 12 nền trắng có kẻ viền ô
    const escapeHtml = (val) => String(val ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const headerHtml = headers.map(h =>
      `<th style="background-color:#CFE2F3; font-family:Arial,sans-serif; font-size:14pt; font-weight:bold; border:1px solid #000000; padding:6px;">${escapeHtml(h)}</th>`
    ).join("");
    const bodyHtml = dataRows.map(row =>
      `<tr>${headers.map((_, i) =>
        `<td style="background-color:#FFFFFF; font-family:Arial,sans-serif; font-size:12pt; border:1px solid #000000; padding:5px;">${escapeHtml(row[i] ?? "")}</td>`
      ).join("")}</tr>`
    ).join("");

    const xlsTemplate = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"></head><body><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></body></html>`;
    const blob = new Blob(["\uFEFF" + xlsTemplate], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName.replace(/\.xlsx$/i, ".xls");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// ==========================================
// 2. RENDER PRODUCTS TABLE, BỘ LỌC (LOẠI SP, HSD, TỒN KHO) & XUẤT FILE EXCEL DANH SÁCH HÀNG HÓA
// ==========================================
function getProductValueMetrics(p) {
  const days = getDaysUntilExpiry(p.expiryDate);
  const stock = Number(p.stock || 0);
  const originalPrice = Number(p.originalPrice || p.price || 0);
  const currentPrice = Number(p.price || 0);

  // Giá trị gốc = Số tiền gốc × Số lượng
  const originalTotalValue = originalPrice * stock;

  // Giá trị giảm (Nếu có): Chỉ có dữ liệu khi sản phẩm vào ngày xuất sắp hết HSD (days <= 7)
  // Công thức: Số tiền giảm giá × Số lượng
  const isNearExpiry = days <= 7;
  let discountedUnitPrice = 0;
  let discountedTotalValue = null;

  if (isNearExpiry) {
    discountedUnitPrice = currentPrice < originalPrice ? currentPrice : Math.round(originalPrice * 0.8);
    discountedTotalValue = discountedUnitPrice * stock;
  }

  return {
    days,
    stock,
    originalPrice,
    currentPrice,
    originalTotalValue,
    isNearExpiry,
    discountedUnitPrice,
    discountedTotalValue
  };
}

function resetProductFilters() {
  const searchEl = document.getElementById("product-search-input");
  const catEl = document.getElementById("product-category-filter");
  const expEl = document.getElementById("product-expiry-filter");
  const stockEl = document.getElementById("product-stock-filter");

  if (searchEl) searchEl.value = "";
  if (catEl) catEl.value = "all";
  if (expEl) expEl.value = "all";
  if (stockEl) stockEl.value = "all";

  renderProductsTable();
}

function getFilteredProductsList() {
  const products = getProducts();
  const search = document.getElementById("product-search-input")?.value.trim().toLowerCase() || "";
  const categoryFilter = document.getElementById("product-category-filter")?.value || "all";
  const expiryFilter = document.getElementById("product-expiry-filter")?.value || "all";
  const stockFilter = document.getElementById("product-stock-filter")?.value || "all";

  // Đồng bộ danh mục vào dropdown nếu có danh mục mới
  const catSelect = document.getElementById("product-category-filter");
  if (catSelect) {
    const defaultCats = [
      "Đồ Ăn Nhanh & Ready-to-eat",
      "Đồ Uống & Nước Giải Khát",
      "Thực Phẩm & Bánh Kẹo",
      "Chăm Sóc Cá Nhân & Gia Dụng",
      "Kem & Đồ Đông Lạnh"
    ];
    const catSet = new Set(defaultCats);
    products.forEach(p => {
      if (p.category) catSet.add(p.category);
    });
    const currentVal = catSelect.value || "all";
    catSelect.innerHTML = `<option value="all">Tất cả loại sản phẩm</option>` +
      Array.from(catSet).map(c => `<option value="${c}" ${c === currentVal ? "selected" : ""}>${c}</option>`).join("");
  }

  // Hiển thị banner nếu đang lọc theo chạm ngưỡng tồn kho
  const lowStockBanner = document.getElementById("product-lowstock-banner");
  const lowStockBannerText = document.getElementById("product-lowstock-banner-text");
  if (lowStockBanner) {
    if (stockFilter === "low") {
      const lowCount = products.filter(p => p.stock <= (p.minStockAlert || 5)).length;
      lowStockBanner.classList.remove("hidden");
      lowStockBanner.classList.add("flex");
      if (lowStockBannerText) {
        lowStockBannerText.innerText = `Đang lọc ${lowCount} sản phẩm chạm ngưỡng tồn kho tối thiểu (Tồn kho ≤ Ngưỡng cảnh báo). Vui lòng bấm "Cập nhật kho / Sửa" để nhập thêm hàng!`;
      }
    } else {
      lowStockBanner.classList.add("hidden");
      lowStockBanner.classList.remove("flex");
    }
  }

  return products.filter(p => {
    const matchSearch = !search ||
      (p.name || "").toLowerCase().includes(search) ||
      (p.barcode || "").toLowerCase().includes(search);

    const matchCategory = categoryFilter === "all" || p.category === categoryFilter;

    const days = getDaysUntilExpiry(p.expiryDate);
    let matchExpiry = true;
    if (expiryFilter === "urgent") {
      matchExpiry = days <= 1;
    } else if (expiryFilter === "warning") {
      matchExpiry = days > 1 && days <= 7;
    } else if (expiryFilter === "near_all") {
      matchExpiry = days <= 7;
    } else if (expiryFilter === "safe") {
      matchExpiry = days > 7;
    }

    const minAlert = p.minStockAlert || 5;
    let matchStock = true;
    if (stockFilter === "low") {
      matchStock = p.stock <= minAlert;
    } else if (stockFilter === "out") {
      matchStock = p.stock <= 0;
    }

    return matchSearch && matchCategory && matchExpiry && matchStock;
  });
}

function exportProductsToExcel() {
  const filtered = getFilteredProductsList();

  if (filtered.length === 0) {
    showToast("Không có sản phẩm nào trong kết quả lọc hiện tại để xuất file Excel!", "warning");
    return;
  }

  const exportDateStr = getFormattedExportDateStr();

  const headers = [
    "STT",
    "Mã Barcode",
    "Tên Sản Phẩm",
    "Danh Mục Hàng Hóa",
    "Mã Lô (Batch)",
    "Số Tiền Gốc (VND)",
    "Giá Bán Hiện Tại (VND)",
    "Số Lượng Tồn Kho",
    "Hạn Sử Dụng (HSD)",
    "Tình Trạng HSD",
    "Giá Trị Gốc (VND)",
    "Giá Trị Giảm (Nếu có) (VND)"
  ];

  const dataRows = filtered.map((p, idx) => {
    const m = getProductValueMetrics(p);
    const expiryStatus = m.days <= 1
      ? `Sắp hết HSD - Nguy cấp (Còn ${m.days} ngày)`
      : (m.days <= 7 ? `Sắp hết HSD - Cận date (Còn ${m.days} ngày)` : `An toàn (Còn ${m.days} ngày)`);

    return [
      idx + 1,
      p.barcode || "",
      p.name || "",
      p.category || "",
      p.batchCode || "LOT-2026",
      m.originalPrice,
      m.isNearExpiry ? m.discountedUnitPrice : m.currentPrice,
      m.stock,
      p.expiryDate || "",
      expiryStatus,
      m.originalTotalValue,
      m.isNearExpiry ? m.discountedTotalValue : ""
    ];
  });

  // Hàng cuối ghi ngày xuất file
  dataRows.push([
    "",
    `Ngày xuất file: ${exportDateStr}`,
    `Ngày kiểm soát HSD hệ thống: ${new Date().toLocaleDateString("vi-VN")}`,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    ""
  ]);

  const colWidths = [
    { wch: 7 },  // STT
    { wch: 24 }, // Mã Barcode / Ngày xuất file
    { wch: 38 }, // Tên Sản Phẩm
    { wch: 28 }, // Danh Mục
    { wch: 18 }, // Mã Lô
    { wch: 18 }, // Số Tiền Gốc
    { wch: 22 }, // Giá Bán Hiện Tại
    { wch: 18 }, // Số Lượng Tồn Kho
    { wch: 18 }, // Hạn Sử Dụng
    { wch: 30 }, // Tình Trạng HSD
    { wch: 22 }, // Giá Trị Gốc (Số tiền gốc × Số lượng)
    { wch: 28 }  // Giá Trị Giảm (Nếu có) (Số tiền giảm giá × Số lượng)
  ];

  const fileName = `Danh_Sach_Hang_Hoa_Emart.xlsx`;
  exportStyledExcelWorkbook({
    headers,
    dataRows,
    colWidths,
    sheetName: "DanhSachHangHoa",
    fileName
  });

  showToast(`📊 ĐÃ XUẤT FILE EXCEL DANH SÁCH HÀNG HÓA!\n• Tên file: ${fileName}\n• Số lượng: ${filtered.length} mặt hàng\n• Ngày xuất file: ${exportDateStr}`, "success");
}

function renderProductsTable() {
  const tbody = document.getElementById("products-table-body");
  if (!tbody) return;

  const filtered = getFilteredProductsList();

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="p-8 text-center text-slate-400">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
          <p class="font-bold">Không tìm thấy sản phẩm nào phù hợp với bộ lọc hiện tại</p>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const m = getProductValueMetrics(p);
    const days = m.days;
    const minAlert = p.minStockAlert || 5;
    const isLowStock = p.stock <= minAlert;
    const isOutStock = p.stock <= 0;

    let stockStatusBadge = '';
    if (isOutStock) {
      stockStatusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white">Hết hàng (0)</span>`;
    } else if (isLowStock) {
      stockStatusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">Sắp hết (${p.stock} / Ngưỡng: ${minAlert})</span>`;
    } else {
      stockStatusBadge = `<span class="font-bold text-slate-800">${p.stock} <span class="text-[10px] text-slate-400">cái (Ngưỡng: ${minAlert})</span></span>`;
    }

    let expiryBadge = '';

if (days < 0) {
  expiryBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-300">
    Đã quá hạn ${Math.abs(days)} ngày
  </span>`;
} else if (days <= 1) {
  expiryBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-300">
    Cực kỳ nguy cấp: Còn ${days} ngày
  </span>`;
} else if (days <= 7) {
  expiryBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
    Cận date: Còn ${days} ngày
  </span>`;
} else {
  expiryBadge = `<span class="text-emerald-600 font-mono text-xs">
    An toàn (${days} ngày)
  </span>`;
}

    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition text-xs ${isLowStock ? 'bg-amber-50/20' : ''}">
        <td class="p-3 font-mono font-bold text-slate-500">#${p.barcode}</td>
        <td class="p-3">
          <div class="flex items-center gap-2.5">
            <img src="${p.image}" class="w-11 h-11 min-w-[44px] min-h-[44px] max-w-[44px] max-h-[44px] rounded-xl object-cover bg-slate-100 border border-slate-200 shrink-0">
            <div>
              <span class="font-bold text-slate-900 block">${p.name}</span>
              ${p.price < p.originalPrice ? `<span class="text-[10px] text-red-600 font-bold">Đang xả hàng giảm giá</span>` : ''}
            </div>
          </div>
        </td>
        <td class="p-3 text-slate-600">${p.category}</td>
        <td class="p-3 font-black text-[#005A2B] text-sm">
          ${formatVND(p.price)}
          ${p.price < p.originalPrice ? `<span class="block text-[10px] text-slate-400 line-through font-normal">${formatVND(p.originalPrice)}</span>` : ''}
        </td>
        <td class="p-3">
          ${stockStatusBadge}
        </td>
        <td class="p-3">
          <div class="font-mono text-slate-700">${p.expiryDate}</div>
          ${expiryBadge}
        </td>
        <td class="p-3 font-mono font-bold text-slate-800">
          ${formatVND(m.originalTotalValue)}
          <span class="block text-[10px] text-slate-400 font-normal">${formatVND(m.originalPrice)} × ${m.stock}</span>
        </td>
        <td class="p-3 font-mono">
          ${m.isNearExpiry ? `
            <span class="font-black text-red-600">${formatVND(m.discountedTotalValue)}</span>
            <span class="block text-[10px] text-amber-700 font-semibold">${formatVND(m.discountedUnitPrice)} × ${m.stock}</span>
          ` : `<span class="text-slate-300 text-xs">—</span>`}
        </td>
        <td class="p-3 text-center">
          <!-- Button ba gạch / ba chấm sổ xuống thao tác Sửa / Xóa -->
          <div class="relative inline-block text-left dropdown-container">
            <button 
              type="button" 
              onclick="toggleActionDropdown(event, '${p.id}')" 
              class="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition cursor-pointer border border-transparent hover:border-slate-200"
              title="Thao tác"
            >
              <i data-lucide="more-vertical" class="w-4 h-4"></i>
            </button>
            <div id="dropdown-${p.id}" class="action-dropdown hidden absolute right-0 mt-1 w-44 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-30 animate-fade-in text-left">
              <button 
                type="button" 
                onclick="editProduct('${p.id}'); hideAllDropdowns();" 
                class="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#005A2B] flex items-center gap-2 cursor-pointer"
              >
                <i data-lucide="edit-3" class="w-3.5 h-3.5 text-[#005A2B]"></i>
                <span>Cập nhật kho / Sửa</span>
              </button>
              ${getCurrentUser()?.role === 'Chủ cửa hàng' ? `
              <button 
                type="button" 
                onclick="deleteProduct('${p.id}'); hideAllDropdowns();" 
                class="w-full text-left px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
              >
                <i data-lucide="trash-2" class="w-3.5 h-3.5 text-red-600"></i>
                <span>Xóa sản phẩm</span>
              </button>
              ` : ''}
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Add/Edit Product Modal Controls
async function openAddProductModal() {
    document.getElementById("modal-product-title").innerText =
        "Thêm Sản Phẩm Mới Vào Hệ Thống";

    document.getElementById("modal-product-id").value = "";
    document.getElementById("prod-name").value = "";
    document.getElementById("prod-barcode").value =
        "893" + Math.floor(1000000 + Math.random() * 9000000);

    document.getElementById("prod-price").value = "";
    document.getElementById("prod-stock").value = "15";
    document.getElementById("prod-min-stock").value = "5";
    document.getElementById("prod-date").value = "2026-10-20";

    document.getElementById("prod-image-url").value = "";
    document.getElementById("prod-image-file").value = "";

    currentUploadedImageFile = null;

    currentUploadedImageBase64 =
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80";

    document.getElementById("prod-image-preview").src =
        currentUploadedImageBase64;

    try {
        // Tải danh mục trực tiếp từ SQL Server
        await loadProductCategories();
    } catch (error) {
        console.error("Lỗi tải danh mục:", error);
        showToast("Không thể tải danh mục từ SQL Server.", "error");
        return;
    }

    const modal = document.getElementById("product-modal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");

    if (window.lucide) lucide.createIcons();
}

function generateRandomBarcode() {
  document.getElementById("prod-barcode").value = "893" + Math.floor(1000000 + Math.random() * 9000000);
}

function handleImageUrlInput(url) {
  if (url && url.trim().length > 5) {
    currentUploadedImageBase64 = url.trim();
    document.getElementById("prod-image-preview").src = currentUploadedImageBase64;
  }
}

function handleImageFileUpload(event) {
    const file = event.target.files[0];

    if (!file) return;

    // Giữ file ảnh gốc để gửi lên Server
    currentUploadedImageFile = file;

    // Đọc ảnh để hiển thị xem trước
    const reader = new FileReader();

    reader.onload = function(e) {
        currentUploadedImageBase64 = e.target.result;

        const preview = document.getElementById("prod-image-preview");

        if (preview) {
            preview.src = currentUploadedImageBase64;
        }
    };

    reader.readAsDataURL(file);
}

function closeProductModal() {
    const modal = document.getElementById("product-modal");

    modal.classList.add("hidden");
    modal.classList.remove("flex");

    // Xóa ảnh đã chọn để tránh gửi nhầm sang sản phẩm khác
    currentUploadedImageBase64 = "";
    currentUploadedImageFile = null;

    // Xóa nội dung input file
    const fileInput = document.getElementById("prod-image-file");
    if (fileInput) {
        fileInput.value = "";
    }
}


async function saveProductFromModal(e) {
  e.preventDefault();

  // Lấy ID: có ID là sửa, không có ID là thêm mới
  const productId =
    document.getElementById("modal-product-id").value.trim();

  const name = document.getElementById("prod-name").value.trim();
  const barcode = document.getElementById("prod-barcode").value.trim();
  const categoryName = document.getElementById("prod-category").value;
  const price = Number(document.getElementById("prod-price").value);
  const stock = Number(document.getElementById("prod-stock").value);

  const minStockValue =
    document.getElementById("prod-min-stock").value;

  const minStockAlert =
    minStockValue === "" ? 5 : Number(minStockValue);

  const expiryDate = document.getElementById("prod-date").value;

  const defaultImage =
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80";

  const image = currentUploadedImageBase64 || defaultImage;

  // Kiểm tra dữ liệu
  if (
    !name ||
    !barcode ||
    !categoryName ||
    !expiryDate ||
    !Number.isFinite(price) ||
    price <= 0 ||
    !Number.isInteger(stock) ||
    stock < 0 ||
    !Number.isInteger(minStockAlert) ||
    minStockAlert < 0
  ) {
    showToast("Vui lòng kiểm tra lại thông tin sản phẩm.", "warning");
    return;
  }


  try {
    // Lấy danh mục từ SQL Server
    const categoryResponse = await fetch("/api/categories");
    const categoryResult = await categoryResponse.json();

    const categories = Array.isArray(categoryResult)
      ? categoryResult
      : categoryResult.data;

    if (!categoryResponse.ok || !Array.isArray(categories)) {
      throw new Error("Không tải được danh mục từ SQL Server.");
    }

    // Ánh xạ danh mục hiện tại
    const categoryAliases = {
      "đồ ăn nhanh & ready-to-eat": "Bánh kẹo",
      "đồ uống & nước giải khát": "Nước giải khát",
      "thực phẩm & bánh kẹo": "Bánh kẹo",
      "chăm sóc cá nhân & gia dụng": "Đồ gia dụng",
      "kem & đồ đông lạnh": "Đồ gia dụng"
    };

    const normalizeName = value =>
      String(value || "").trim().toLowerCase();

    const targetCategoryName =
      categoryAliases[normalizeName(categoryName)] || categoryName;

    const category = categories.find(
      c =>
        normalizeName(c.CategoryName) ===
        normalizeName(targetCategoryName)
    );

    if (!category) {
      throw new Error(
        `Không tìm thấy danh mục "${categoryName}" trong SQL Server.`
      );
    }

    // Dữ liệu gửi đến Backend
    const payload = {
      ProductName: name,
      Barcode: barcode,
      ProductCode: barcode,
      CategoryID: Number(category.CategoryID),
      SellingPrice: price,
      PurchasePrice: 0,
      CurrentStock: stock,
      MinStock: minStockAlert,
      ExpiryDate: expiryDate,
      ImageURL: currentUploadedImageFile ? "" : image,
      Unit: "Cái"
    };

    // Có ID thì cập nhật, không có ID thì thêm mới
    const isEditing = Boolean(productId);
// Chuẩn bị dữ liệu gửi lên Backend
let requestOptions;

if (currentUploadedImageFile) {
    // Có ảnh từ máy tính: gửi bằng FormData
    const formData = new FormData();

    Object.entries(payload).forEach(([key, value]) => {
        formData.append(key, value ?? "");
    });

    formData.append("image", currentUploadedImageFile);

    requestOptions = {
        method: isEditing ? "PUT" : "POST",
        body: formData
    };
} else {
    // Không có ảnh mới: tiếp tục gửi JSON như trước
    requestOptions = {
        method: isEditing ? "PUT" : "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    };
}

const response = await fetch(
    isEditing
        ? `/api/products/${encodeURIComponent(productId)}`
        : "/api/products",
    requestOptions
);

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message ||
        (isEditing
          ? "Không thể cập nhật sản phẩm."
          : "Không thể thêm sản phẩm.")
      );
    }

    // Tải lại dữ liệu mới nhất từ SQL Server
    await loadProductsFromAPI();

    closeProductModal();
    renderProductsTable();
    checkLowStockPushNotification();

    showToast(
      isEditing
        ? "Cập nhật sản phẩm thành công!"
        : "Thêm sản phẩm thành công!",
      "success"
    );

  } catch (error) {
    console.error("Lỗi lưu sản phẩm:", error);

    showToast(
      error.message || "Không thể kết nối SQL Server.",
      "error"
    );
  }
}


async function loadProductCategories(selectedName = "") {
  const select = document.getElementById("prod-category");

  const response = await fetch("/api/categories");
  const result = await response.json();

  const categories = Array.isArray(result)
    ? result
    : result.data;

  if (!response.ok || !Array.isArray(categories)) {
    throw new Error("Không tải được danh mục.");
  }

  select.innerHTML =
    '<option value="">-- Chọn danh mục --</option>' +
    categories.map(c => `
      <option value="${c.CategoryName}">
        ${c.CategoryName}
      </option>
    `).join("");

  select.value = selectedName;
}

async function editProduct(productId) {
  const products = getProducts();

  const p = products.find(
    prod => String(prod.id) === String(productId)
  );

  if (!p) {
    showToast("Không tìm thấy sản phẩm cần sửa.", "error");
    return;
  }

  document.getElementById("modal-product-title").innerText =
    "Chỉnh Sửa Thông Tin Sản Phẩm";

  document.getElementById("modal-product-id").value = p.id;
  document.getElementById("prod-name").value = p.name || "";
  document.getElementById("prod-barcode").value = p.barcode || "";
  document.getElementById("prod-price").value = p.price ?? "";
  document.getElementById("prod-stock").value = p.stock ?? 0;
  document.getElementById("prod-min-stock").value =
    p.minStockAlert ?? 5;

  document.getElementById("prod-date").value =
    String(p.expiryDate || "").slice(0, 10);

const image = p.image || "";

// Đặt lại file ảnh mới
currentUploadedImageFile = null;
document.getElementById("prod-image-file").value = "";

// Giữ và hiển thị ảnh hiện tại
document.getElementById("prod-image-url").value = image;
currentUploadedImageBase64 = image;
document.getElementById("prod-image-preview").src = image;

  try {
    await loadProductCategories(p.category || "");
  } catch (error) {
    console.error(error);
    showToast("Không tải được danh mục sản phẩm.", "error");
    return;
  }

  const modal = document.getElementById("product-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");

  if (window.lucide) lucide.createIcons();
}

async function deleteProduct(productId) {
    if (!confirm("Bạn có chắc chắn muốn xóa sản phẩm này khỏi hệ thống Emart?")) {
        return;
    }

    try {
        const response = await fetch(`/api/products/${productId}`, {
            method: "DELETE"
        });

        // Đọc phản hồi dạng văn bản trước
        const responseText = await response.text();

        let result;

        try {
            result = JSON.parse(responseText);
        } catch (error) {
            console.error("Phản hồi không phải JSON:", responseText);

            throw new Error(
                `Server trả về HTML hoặc dữ liệu không hợp lệ. HTTP ${response.status}. Hãy kiểm tra Backend.`
            );
        }

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Không thể xóa sản phẩm.");
        }

        alert("Xóa sản phẩm thành công!");

        await loadProductsFromAPI();
        renderProductsTable();
        checkLowStockPushNotification();

    } catch (error) {
        console.error("Lỗi xóa sản phẩm:", error);
        alert(error.message);
    }
}
// ==========================================
// SẢN PHẨM ĐÃ XÓA - TẢI DANH SÁCH
// ==========================================
async function loadDeletedProducts() {
    const tbody = document.getElementById("deleted-products-table-body");

    if (!tbody) {
        console.error("Không tìm thấy deleted-products-table-body");
        return;
    }

    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="p-5 text-center text-slate-400">
                Đang tải danh sách...
            </td>
        </tr>
    `;

    try {
        const response = await fetch("/api/products/deleted");
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Không tải được sản phẩm đã xóa.");
        }

        const products = result.data || [];

        if (products.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="p-5 text-center text-slate-400">
                        Không có sản phẩm nào đã xóa.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = products.map(p => `
            <tr class="border-b border-slate-100 hover:bg-slate-50 text-xs">
                <td class="p-3 font-mono font-bold">
                    ${p.ProductCode || p.Barcode || p.ProductID}
                </td>

                <td class="p-3 font-bold text-slate-800">
                    ${p.ProductName || ""}
                </td>

                <td class="p-3 font-mono">
                    ${p.Barcode || ""}
                </td>

                <td class="p-3 font-bold text-[#005A2B]">
                    ${formatVND(Number(p.SellingPrice || 0))}
                </td>

                <td class="p-3">
                    ${Number(p.CurrentStock || 0)}
                </td>

                <td class="p-3 text-center">
                    <button
                        onclick="restoreProduct(${Number(p.ProductID)})"
                        class="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                        Khôi phục
                    </button>
                </td>
            </tr>
        `).join("");

        if (window.lucide) lucide.createIcons();

    } catch (error) {
        console.error("Lỗi tải sản phẩm đã xóa:", error);

        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="p-5 text-center text-red-500">
                    ${error.message}
                </td>
            </tr>
        `;
    }
}


// ==========================================
// KHÔI PHỤC SẢN PHẨM
// ==========================================
async function restoreProduct(productId) {
    if (!confirm("Bạn có chắc chắn muốn khôi phục sản phẩm này?")) {
        return;
    }

    try {
        const response = await fetch(
            `/api/products/${productId}/restore`,
            {
                method: "PUT"
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Không thể khôi phục sản phẩm.");
        }

        alert("Khôi phục sản phẩm thành công!");

        // Đồng bộ lại danh sách sản phẩm đang hoạt động
        await loadProductsFromAPI();
        renderProductsTable();

        // Tải lại danh sách đã xóa
        await loadDeletedProducts();

        checkLowStockPushNotification();

    } catch (error) {
        console.error("Lỗi khôi phục sản phẩm:", error);
        alert(error.message);
    }
}
// ==========================================
// 3. QUẢN LÝ HẠN SỬ DỤNG (FEFO):
// - Lọc theo loại sản phẩm, hạn sử dụng, trạng thái xử lý & tìm kiếm theo tên sản phẩm
// - Cột Trạng thái: Trả hàng NCC | Giảm giá | Chưa xử lí (tới HSD nguy cấp) | Chưa tới HSD
// - Xuất file Excel danh sách FEFO chuẩn định dạng
// ==========================================

function getProductFefoStatusInfo(p) {
  const days = getDaysUntilExpiry(p.expiryDate);
  const originalPrice = Number(p.originalPrice || p.price || 0);
  const currentPrice = Number(p.price || 0);
  const discountRate = currentPrice < originalPrice ? Math.round((1 - currentPrice / originalPrice) * 100) : 0;

  // Kiểm tra xem sản phẩm đã được trả hàng NCC chưa (lưu trực tiếp trên sản phẩm hoặc trong báo cáo kiểm kê)
  let returnedQty = Number(p.returnedToSupplierQty || 0);
  if (!returnedQty) {
    const invReports = getInventoryReports();
    invReports.forEach(r => {
      if (Array.isArray(r.items)) {
        r.items.forEach(it => {
          if (it.id === p.id && Number(it.returnedQty || 0) > 0) {
            returnedQty += Number(it.returnedQty || 0);
          }
        });
      }
    });
  }

  // Phân loại 4 trạng thái chuẩn theo yêu cầu:
  // 1. Trả hàng NCC
  // 2. Giảm giá
  // 3. Chưa xử lí (tới HSD nguy cấp)
  // 4. Chưa tới HSD
  if (p.fefoActionStatus === "Trả hàng NCC" || returnedQty > 0) {
    return {
      statusKey: "Trả hàng NCC",
      statusText: returnedQty > 0 ? `Trả hàng NCC (Đã trả ${returnedQty} cái)` : "Trả hàng NCC",
      badgeHtml: `<span class="px-2.5 py-1 rounded-xl text-[11px] font-black bg-purple-100 text-purple-800 border border-purple-300 inline-flex items-center gap-1"><i data-lucide="undo-2" class="w-3.5 h-3.5 text-purple-700"></i> Trả hàng NCC${returnedQty > 0 ? ` (${returnedQty})` : ''}</span>`,
      discountRate,
      returnedQty,
      days
    };
  }

  if (discountRate > 0 || p.fefoActionStatus === "Giảm giá") {
    return {
      statusKey: "Giảm giá",
      statusText: discountRate > 0 ? `Giảm giá (-${discountRate}%)` : "Giảm giá",
      badgeHtml: `<span class="px-2.5 py-1 rounded-xl text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1"><i data-lucide="tag" class="w-3.5 h-3.5 text-amber-700"></i> Giảm giá ${discountRate > 0 ? `(-${discountRate}%)` : ''}</span>`,
      discountRate,
      returnedQty,
      days
    };
  }

  if (days <= 7) {
    return {
      statusKey: "Chưa xử lí (tới HSD nguy cấp)",
      statusText: days <= 1 ? `Chưa xử lí (tới HSD nguy cấp - ${days}d)` : `Chưa xử lí (tới HSD nguy cấp - ${days} ngày)`,
      badgeHtml: `<span class="px-2.5 py-1 rounded-xl text-[11px] font-black bg-red-100 text-red-700 border border-red-300 inline-flex items-center gap-1 animate-pulse"><i data-lucide="alert-octagon" class="w-3.5 h-3.5 text-red-600"></i> Chưa xử lí (tới HSD nguy cấp)</span>`,
      discountRate: 0,
      returnedQty: 0,
      days
    };
  }

  return {
    statusKey: "Chưa tới HSD",
    statusText: `Chưa tới HSD (Còn ${days} ngày)`,
    badgeHtml: `<span class="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1"><i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-600"></i> Chưa tới HSD</span>`,
    discountRate: 0,
    returnedQty: 0,
    days
  };
}

function setFefoFilter(filterType) {
  currentFefoFilter = filterType;

  // Đồng bộ dropdown chọn hạn sử dụng
  const expirySelect = document.getElementById("fefo-expiry-select");
  if (expirySelect && expirySelect.value !== filterType) {
    expirySelect.value = filterType;
  }

  // Đồng bộ các nút quick filter pills
  document.querySelectorAll(".fefo-filter-btn").forEach(btn => {
    btn.className = "fefo-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer";
  });
  const activeBtn = document.getElementById("fefo-filter-" + filterType);
  if (activeBtn) {
    activeBtn.className = "fefo-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-[#005A2B] text-white shadow-xs cursor-pointer";
  }

  renderFefoAlerts();
}

function resetFefoFilters() {
  const searchEl = document.getElementById("fefo-search-input");
  const catEl = document.getElementById("fefo-category-filter");
  const statusEl = document.getElementById("fefo-status-filter");

  if (searchEl) searchEl.value = "";
  if (catEl) catEl.value = "all";
  if (statusEl) statusEl.value = "all";

  setFefoFilter("all");
}

function getFilteredFefoProducts() {
  const products = getProducts();
  const search = document.getElementById("fefo-search-input")?.value.trim().toLowerCase() || "";
  const categoryFilter = document.getElementById("fefo-category-filter")?.value || "all";
  const statusFilter = document.getElementById("fefo-status-filter")?.value || "all";

  // Đồng bộ danh sách loại sản phẩm trong dropdown FEFO
  const catSelect = document.getElementById("fefo-category-filter");
  if (catSelect) {
    const defaultCats = [
      "Đồ Ăn Nhanh & Ready-to-eat",
      "Đồ Uống & Nước Giải Khát",
      "Thực Phẩm & Bánh Kẹo",
      "Chăm Sóc Cá Nhân & Gia Dụng",
      "Kem & Đồ Đông Lạnh"
    ];
    const catSet = new Set(defaultCats);
    products.forEach(p => {
      if (p.category) catSet.add(p.category);
    });
    const currentVal = catSelect.value || "all";
    catSelect.innerHTML = `<option value="all">Tất cả loại sản phẩm</option>` +
      Array.from(catSet).map(c => `<option value="${c}" ${c === currentVal ? "selected" : ""}>${c}</option>`).join("");
  }

  // Sắp xếp theo nguyên tắc FEFO (First Expired, First Out)
  let sorted = [...products].sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  // 1. Lọc theo hạn sử dụng
  if (currentFefoFilter === "urgent") {
    sorted = sorted.filter(p => getDaysUntilExpiry(p.expiryDate) <= 1);
  } else if (currentFefoFilter === "warning") {
    sorted = sorted.filter(p => {
      const d = getDaysUntilExpiry(p.expiryDate);
      return d > 1 && d <= 7;
    });
  } else if (currentFefoFilter === "safe") {
    sorted = sorted.filter(p => getDaysUntilExpiry(p.expiryDate) > 7);
  }

  // 2. Lọc theo loại sản phẩm
  if (categoryFilter !== "all") {
    sorted = sorted.filter(p => p.category === categoryFilter);
  }

  // 3. Lọc theo trạng thái (Trả hàng NCC, Giảm giá, Chưa xử lí (tới HSD nguy cấp), Chưa tới HSD)
  if (statusFilter !== "all") {
    sorted = sorted.filter(p => getProductFefoStatusInfo(p).statusKey === statusFilter);
  }

  // 4. Tìm kiếm theo tên sản phẩm hoặc mã lô / barcode
  if (search) {
    sorted = sorted.filter(p =>
      (p.name || "").toLowerCase().includes(search) ||
      (p.batchCode && p.batchCode.toLowerCase().includes(search)) ||
      (p.barcode && p.barcode.toLowerCase().includes(search))
    );
  }

  return sorted;
}

function renderFefoAlerts() {
  const container = document.getElementById("fefo-cards-container");
  const countEl = document.getElementById("fefo-result-count");
  if (!container) return;

  const sorted = getFilteredFefoProducts();

  if (countEl) {
    countEl.innerText = `Đang hiển thị ${sorted.length} lô hàng`;
  }

  if (sorted.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="8" class="p-8 text-center text-slate-400">
          <i data-lucide="check-circle" class="w-10 h-10 mx-auto text-emerald-500 mb-2"></i>
          <p class="font-bold text-slate-700 text-xs">Không có lô hàng nào phù hợp với bộ lọc hiện tại</p>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = sorted.map(p => {
    const info = getProductFefoStatusInfo(p);
    const days = info.days;
    const discountRate = info.discountRate;

    let expiryRiskBadge = '';
let rowBg = '';

if (days < 0) {
  expiryRiskBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-red-100 text-red-700 border border-red-300 inline-block mt-1">
    Đã quá hạn ${Math.abs(days)} ngày
  </span>`;
  rowBg = 'bg-red-50/20';

} else if (days <= 1) {
  expiryRiskBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-red-100 text-red-700 border border-red-300 inline-block mt-1">
    Cực kỳ nguy cấp: Còn ${days} ngày
  </span>`;
  rowBg = 'bg-red-50/20';

} else if (days <= 7) {
  expiryRiskBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 inline-block mt-1">
    Cận date: Còn ${days} ngày
  </span>`;
  rowBg = 'bg-amber-50/15';

} else {
  expiryRiskBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block mt-1">
    An toàn (${days} ngày)
  </span>`;
}

    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50/90 transition text-xs ${rowBg}">
        <!-- 1. Mã Lô / Barcode -->
        <td class="p-3 whitespace-nowrap">
          <span class="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md block w-fit">${p.batchCode || 'LOT-2026'}</span>
          <span class="font-mono text-[10px] text-slate-400 mt-1 block">#${p.barcode}</span>
        </td>

        <!-- 2. Sản phẩm -->
        <td class="p-3">
          <div class="flex items-center gap-2.5 min-w-[200px]">
            <img src="${p.image}" class="w-12 h-12 min-w-[48px] min-h-[48px] max-w-[48px] max-h-[48px] rounded-xl object-cover bg-slate-100 border border-slate-200 shrink-0">
            <div>
              <span class="font-black text-slate-900 block leading-snug">${p.name}</span>
              ${info.returnedQty > 0 ? `<span class="text-[10px] font-bold text-purple-700 block mt-0.5">Đã xuất trả NCC: ${info.returnedQty} cái</span>` : ''}
            </div>
          </div>
        </td>

        <!-- 3. Loại sản phẩm -->
        <td class="p-3 text-slate-600 font-medium">
          ${p.category}
        </td>

        <!-- 4. Hạn sử dụng (HSD) -->
        <td class="p-3 whitespace-nowrap">
          <div class="font-mono font-black text-slate-900">${p.expiryDate}</div>
          ${expiryRiskBadge}
        </td>

        <!-- 5. Tồn kho -->
        <td class="p-3 whitespace-nowrap">
          <span class="font-black ${p.stock <= (p.minStockAlert || 5) ? 'text-red-600' : 'text-slate-900'}">${p.stock} cái</span>
          <span class="block text-[10px] text-slate-400">Ngưỡng: ${p.minStockAlert || 5}</span>
        </td>

        <!-- 6. Giá gốc / Giá hiện tại -->
        <td class="p-3 whitespace-nowrap font-mono">
          <div class="font-black text-[#005A2B] text-sm">${formatVND(p.price)}</div>
          ${p.price < p.originalPrice
            ? `<span class="text-[10px] text-slate-400 line-through block">Gốc: ${formatVND(p.originalPrice)}</span>`
            : `<span class="text-[10px] text-slate-400 block">Giá niêm yết</span>`
          }
        </td>

        <!-- 7. Cột Trạng Thái (Trả hàng NCC / Giảm giá / Chưa xử lí (tới HSD nguy cấp) / Chưa tới HSD) -->
        <td class="p-3 whitespace-nowrap">
          ${info.badgeHtml}
        </td>

        <!-- 8. Thiết lập giảm giá & Trả hàng NCC -->
        <td class="p-3">
          <div class="bg-slate-50 p-2.5 rounded-2xl border border-slate-200 flex flex-col gap-2 min-w-[250px]">
            <div class="flex items-center justify-between gap-1.5">
              <div class="flex items-center gap-1">
                <input 
                  type="number" 
                  id="fefo-rate-${p.id}" 
                  min="1" 
                  max="95" 
                  value="${discountRate > 0 ? discountRate : 30}" 
                  class="w-14 px-2 py-1 text-center font-black rounded-lg border border-slate-300 text-xs bg-white outline-hidden focus:border-[#005A2B]"
                >
                <span class="text-xs font-black text-slate-600">%</span>
              </div>

              <div class="flex items-center gap-1">
                <button type="button" onclick="setFefoInputRate('${p.id}', 20)" class="px-1.5 py-1 rounded-md bg-white hover:bg-slate-200 border border-slate-200 text-[10px] font-bold text-slate-700 cursor-pointer">20%</button>
                <button type="button" onclick="setFefoInputRate('${p.id}', 35)" class="px-1.5 py-1 rounded-md bg-white hover:bg-slate-200 border border-slate-200 text-[10px] font-bold text-slate-700 cursor-pointer">35%</button>
                <button type="button" onclick="setFefoInputRate('${p.id}', 50)" class="px-1.5 py-1 rounded-md bg-white hover:bg-slate-200 border border-slate-200 text-[10px] font-bold text-slate-700 cursor-pointer">50%</button>
              </div>

              <button 
                type="button"
                onclick="applyCustomFefoDiscount('${p.id}')" 
                class="px-2.5 py-1 rounded-lg bg-[#005A2B] hover:bg-[#0B6A36] text-[#FFD700] font-black text-[11px] shadow-2xs transition flex items-center gap-1 cursor-pointer shrink-0"
              >
                <i data-lucide="tag" class="w-3 h-3"></i>
                <span>Giảm giá</span>
              </button>
            </div>

            <div class="flex items-center gap-1.5 pt-1 border-t border-slate-200">
              <button 
                type="button"
                onclick="restoreFefoPrice('${p.id}')" 
                class="flex-1 py-1 px-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[10px] transition text-center cursor-pointer"
              >
                Khôi phục
              </button>

              <button 
                type="button"
                onclick="openReturnBatchModal('${p.id}')" 
                class="flex-1 py-1 px-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-black text-[10px] transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <i data-lucide="undo-2" class="w-3 h-3 text-red-600"></i>
                <span>Trả Hàng NCC</span>
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function exportFefoToExcel() {
  const sorted = getFilteredFefoProducts();

  if (sorted.length === 0) {
    showToast("Không có lô hàng nào trong danh sách lọc hiện tại để xuất file Excel!", "warning");
    return;
  }

  const exportDateStr = getFormattedExportDateStr();

  const headers = [
    "STT",
    "Mã Lô (Batch)",
    "Mã Barcode",
    "Tên Sản Phẩm",
    "Loại Sản Phẩm",
    "Hạn Sử Dụng (HSD)",
    "Số Ngày Còn Lại",
    "Số Lượng Tồn Kho",
    "Giá Gốc (VND)",
    "Giá Hiện Tại (VND)",
    "Mức Giảm Giá (%)",
    "SL Đã Trả NCC",
    "Trạng Thái"
  ];

  const dataRows = sorted.map((p, idx) => {
    const info = getProductFefoStatusInfo(p);
    return [
      idx + 1,
      p.batchCode || "LOT-2026",
      p.barcode || "",
      p.name || "",
      p.category || "",
      p.expiryDate || "",
      `${info.days} ngày`,
      Number(p.stock || 0),
      Number(p.originalPrice || p.price || 0),
      Number(p.price || 0),
      info.discountRate > 0 ? `${info.discountRate}%` : "0%",
      info.returnedQty,
      info.statusKey
    ];
  });

  // Hàng cuối ghi ngày xuất file
  dataRows.push([
    "",
    `Ngày xuất file: ${exportDateStr}`,
    `Ngày kiểm soát HSD hệ thống: ${new Date().toLocaleDateString("vi-VN")}`,
    `Tổng số lô hàng: ${sorted.length}`,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    ""
  ]);

  const colWidths = [
    { wch: 7 },  // STT
    { wch: 24 }, // Mã Lô / Ngày xuất file
    { wch: 22 }, // Mã Barcode
    { wch: 38 }, // Tên Sản Phẩm
    { wch: 28 }, // Loại Sản Phẩm
    { wch: 18 }, // Hạn Sử Dụng
    { wch: 18 }, // Số Ngày Còn Lại
    { wch: 18 }, // Số Lượng Tồn Kho
    { wch: 18 }, // Giá Gốc
    { wch: 20 }, // Giá Hiện Tại
    { wch: 18 }, // Mức Giảm Giá
    { wch: 16 }, // SL Đã Trả NCC
    { wch: 32 }  // Trạng Thái (Trả hàng NCC, Giảm giá, Chưa xử lí (tới HSD nguy cấp), Chưa tới HSD)
  ];

  const fileName = `Quan_Ly_Han_Su_Dung_FEFO_Emart.xlsx`;
  exportStyledExcelWorkbook({
    headers,
    dataRows,
    colWidths,
    sheetName: "HanSuDungFEFO",
    fileName
  });

  showToast(
    `📊 ĐÃ XUẤT FILE EXCEL HẠN SỬ DỤNG (FEFO)!\n• Tên file: ${fileName}\n• Số lượng: ${sorted.length} lô hàng\n• Đã bao gồm cột Trạng thái (Trả hàng NCC, Giảm giá, Chưa xử lí, Chưa tới HSD)\n• Ngày xuất file: ${exportDateStr}`,
    "success"
  );
}

function setFefoInputRate(productId, percent) {
  const input = document.getElementById("fefo-rate-" + productId);
  if (input) input.value = percent;
}

async function applyCustomFefoDiscount(productId) {
    const input = document.getElementById("fefo-rate-" + productId);
    const percent = Number(input?.value);

    if (!percent || percent <= 0 || percent >= 100) {
        showToast("Vui lòng nhập phần trăm giảm giá hợp lệ từ 1% đến 99%!", "warning");
        return;
    }

    try {
        const response = await fetch(
            `/api/products/${productId}/fefo-discount`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ percent })
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Không thể áp dụng giảm giá FEFO.");
        }

        // Tải lại sản phẩm mới nhất từ SQL Server
        await loadProductsFromAPI();

        renderFefoAlerts();
        renderProductsTable();

        const updatedProduct = getProducts().find(
            p => String(p.id) === String(productId)
        );

        showToast(
            `Đã áp dụng giảm giá ${percent}% cho "${updatedProduct?.name || "sản phẩm"}". Giá mới: ${formatVND(updatedProduct?.price || 0)}`,
            "success"
        );

    } catch (error) {
        console.error("Lỗi giảm giá FEFO:", error);
        showToast(error.message || "Lỗi khi lưu giảm giá FEFO!", "error");
    }
}

async function restoreFefoPrice(productId) {
    const products = getProducts();
    const p = products.find(prod => String(prod.id) === String(productId));

    if (!p) return;

    try {
        const response = await fetch(
            `/api/products/${productId}/fefo-restore`,
            {
                method: "PUT"
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Không thể khôi phục giá gốc.");
        }

        await loadProductsFromAPI();

        renderFefoAlerts();
        renderProductsTable();

        const updatedProduct = getProducts().find(
            prod => String(prod.id) === String(productId)
        );

        showToast(
            `Đã khôi phục giá gốc cho "${updatedProduct?.name || p.name}": ${formatVND(updatedProduct?.price || 0)}`,
            "success"
        );

    } catch (error) {
        console.error("Lỗi khôi phục giá FEFO:", error);
        showToast(error.message || "Không thể khôi phục giá gốc!", "error");
    }
}

// Modal Trả hàng cho Nhà Cung Cấp
function openReturnBatchModal(productId) {
  const products = getProducts();
  const p = products.find(prod => prod.id === productId);
  if (!p) {
    showToast("Không tìm thấy sản phẩm này trong kho!", "error");
    return;
  }

  document.getElementById("return-modal-prod-id").value = p.id;
  document.getElementById("return-modal-product-name").innerText = p.name;
  document.getElementById("return-modal-batch-code").innerText = p.batchCode || 'LOT-2026';
  document.getElementById("return-modal-current-stock").innerText = p.stock + " sản phẩm";
  document.getElementById("return-modal-quantity").value = p.stock > 0 ? p.stock : 1;
  document.getElementById("return-modal-quantity").max = Math.max(1, p.stock);

  const modal = document.getElementById("return-batch-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  if (window.lucide) lucide.createIcons();

  showToast(`📋 Đã mở phiếu xuất trả Nhà cung cấp cho "${p.name}". Vui lòng kiểm tra số lượng và bấm "Xác Nhận Xuất Trả".`, "info");
}

function closeReturnBatchModal() {
  const modal = document.getElementById("return-batch-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function confirmReturnBatch() {
  const prodId = document.getElementById("return-modal-prod-id").value;
  const returnQty = Number(document.getElementById("return-modal-quantity").value);
  const reason = document.getElementById("return-modal-reason").value;

  const products = getProducts();
  const p = products.find(prod => prod.id === prodId);
  if (!p) return;

  if (returnQty <= 0 || returnQty > p.stock) {
    showToast("Số lượng xuất trả không hợp lệ hoặc vượt quá tồn kho hiện tại!", "warning");
    return;
  }

  p.stock -= returnQty;
  p.returnedToSupplierQty = (Number(p.returnedToSupplierQty || 0)) + returnQty;
  p.fefoActionStatus = "Trả hàng NCC";
  saveProducts(products);

  // Đồng bộ tồn kho & trạng thái đã xuất trả vào báo cáo nhân viên
  const reports = getInventoryReports();
  reports.forEach(r => {
    if (Array.isArray(r.items)) {
      r.items.forEach(it => {
        if (it.id === prodId) {
          it.stock = p.stock;
          it.returnedQty = (it.returnedQty || 0) + returnQty;
        }
      });
    }
  });
  saveInventoryReports(reports);

  closeReturnBatchModal();
  renderReportsSection();
  renderFefoAlerts();
  renderProductsTable();
  checkLowStockPushNotification();

  showToast(`✅ ĐÃ XUẤT TRẢ HÀNG THÀNH CÔNG!\n• Sản phẩm: ${p.name}\n• Số lượng trả NCC: ${returnQty} cái (Lô: ${p.batchCode})\n• Trạng thái FEFO: Trả hàng NCC\n• Tồn kho còn lại: ${p.stock} cái\n• Lý do: ${reason}`, "success");
}

// ==========================================
// 4. RENDER INVOICES TABLE, BỘ LỌC (NGÀY/TUẦN/THÁNG/NĂM, GIÁ, TÌM KIẾM) & XUẤT EXCEL
// ==========================================
let currentInvoiceDateMode = "all"; // 'all' | 'day' | 'week' | 'month' | 'year'

function extractInvoiceDateParts(inv) {
  if (inv.dateISO && /^\d{4}-\d{2}-\d{2}$/.test(inv.dateISO)) {
    const [yyyy, mm, dd] = inv.dateISO.split("-");
    return {
      isoDate: inv.dateISO,
      yearMonth: `${yyyy}-${mm}`,
      year: yyyy,
      dateObj: new Date(Number(yyyy), Number(mm) - 1, Number(dd))
    };
  }
  const raw = inv.time || "";
  const match = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return {
      isoDate: `${yyyy}-${mm}-${dd}`,
      yearMonth: `${yyyy}-${mm}`,
      year: yyyy,
      dateObj: new Date(Number(yyyy), Number(mm) - 1, Number(dd))
    };
  }
  return { isoDate: "", yearMonth: "", year: "", dateObj: null };
}

function getWeekBoundsFromIsoDate(isoDateStr) {
  if (!isoDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(isoDateStr)) return null;
  const [yyyy, mm, dd] = isoDateStr.split("-").map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  const dayOfWeek = d.getDay(); // 0 (CN) -> 6 (T7)
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (dt) => `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
  const fmtIso = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

  return {
    monday,
    sunday,
    label: `tuần (${fmt(monday)} - ${fmt(sunday)})`,
    suffix: `Tuan_${fmtIso(monday)}_den_${fmtIso(sunday)}`
  };
}

function getInvoiceDiscountAmount(inv) {
  const memberDisc = Number(inv.memberDiscount || 0);
  // Cộng thêm khoản giảm giá trực tiếp trên từng mặt hàng nếu mặt hàng có originalPrice > price
  const itemDisc = Array.isArray(inv.items)
    ? inv.items.reduce((sum, it) => {
        const orig = Number(it.originalPrice || it.price || 0);
        const curr = Number(it.price || 0);
        const qty = Number(it.quantity || 1);
        return sum + (orig > curr ? (orig - curr) * qty : 0);
      }, 0)
    : 0;
  return memberDisc + itemDisc;
}

function setInvoiceDateFilterMode(mode) {
  currentInvoiceDateMode = mode;
  const modes = ["all", "day", "week", "month", "year"];
  modes.forEach(m => {
    const btn = document.getElementById(`inv-mode-${m}`);
    if (!btn) return;
    if (m === mode) {
      btn.className = "px-2.5 py-1.5 rounded-lg bg-[#005A2B] text-[#FFD700] text-xs font-extrabold transition cursor-pointer shadow-2xs";
    } else {
      btn.className = "px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 text-xs font-bold transition cursor-pointer";
    }
  });

  const wraps = {
    day: document.getElementById("inv-filter-day-wrap"),
    week: document.getElementById("inv-filter-week-wrap"),
    month: document.getElementById("inv-filter-month-wrap"),
    year: document.getElementById("inv-filter-year-wrap")
  };

  Object.keys(wraps).forEach(k => {
    if (wraps[k]) {
      wraps[k].classList.toggle("hidden", mode !== k);
      wraps[k].classList.toggle("flex", mode === k);
    }
  });

  renderInvoicesTable();
}

function resetInvoiceFilters() {
  const priceSel = document.getElementById("inv-filter-price");
  const searchInput = document.getElementById("inv-search-input");
  if (priceSel) priceSel.value = "all";
  if (searchInput) searchInput.value = "";
  setInvoiceDateFilterMode("all");
}

function getFilteredInvoices() {
  const invoices = window.apiInvoicesCache || getInvoices();
  // Đồng bộ danh sách năm trong dropdown
  const yearSelect = document.getElementById("inv-filter-year");
  if (yearSelect) {
    const existingYears = new Set(["2026", "2025", "2024"]);
    invoices.forEach(inv => {
      const { year } = extractInvoiceDateParts(inv);
      if (year) existingYears.add(year);
    });
    const currentSelectedYear = yearSelect.value || "2026";
    const sortedYears = Array.from(existingYears).sort((a, b) => b.localeCompare(a));
    yearSelect.innerHTML = sortedYears.map(y => `<option value="${y}" ${y === currentSelectedYear ? "selected" : ""}>Năm ${y}</option>`).join("");
  }

  let filtered = [...invoices];
  const labelParts = [];
  let fileSuffix = "Tat_Ca";

  // 1. Lọc theo thời gian (Ngày / Tuần / Tháng / Năm)
  if (currentInvoiceDateMode === "day") {
    const dayVal = document.getElementById("inv-filter-date")?.value || "";
    if (dayVal) {
      const [yyyy, mm, dd] = dayVal.split("-");
      filtered = filtered.filter(inv => extractInvoiceDateParts(inv).isoDate === dayVal);
      labelParts.push(`Ngày ${dd}/${mm}/${yyyy}`);
      fileSuffix = `Ngay_${dayVal}`;
    }
  } else if (currentInvoiceDateMode === "week") {
    const weekDateVal = document.getElementById("inv-filter-week-date")?.value || "";
    const bounds = getWeekBoundsFromIsoDate(weekDateVal);
    if (bounds) {
      filtered = filtered.filter(inv => {
        const { dateObj } = extractInvoiceDateParts(inv);
        return dateObj && dateObj >= bounds.monday && dateObj <= bounds.sunday;
      });
      labelParts.push(`Theo ${bounds.label}`);
      fileSuffix = bounds.suffix;
    }
  } else if (currentInvoiceDateMode === "month") {
    const monthVal = document.getElementById("inv-filter-month")?.value || "";
    if (monthVal) {
      const [yyyy, mm] = monthVal.split("-");
      filtered = filtered.filter(inv => extractInvoiceDateParts(inv).yearMonth === monthVal);
      labelParts.push(`Tháng ${mm}/${yyyy}`);
      fileSuffix = `Thang_${monthVal}`;
    }
  } else if (currentInvoiceDateMode === "year") {
    const yearVal = document.getElementById("inv-filter-year")?.value || "2026";
    filtered = filtered.filter(inv => extractInvoiceDateParts(inv).year === yearVal);
    labelParts.push(`Năm ${yearVal}`);
    fileSuffix = `Nam_${yearVal}`;
  } else {
    labelParts.push("Tất cả thời gian");
  }

  // 2. Lọc theo mức giá (50000, 100000, 200000, >500000)
  const priceMode = document.getElementById("inv-filter-price")?.value || "all";
  if (priceMode === "50000") {
    filtered = filtered.filter(inv => Number(inv.totalAmount || 0) <= 50000);
    labelParts.push("Giá ≤ 50.000₫");
  } else if (priceMode === "100000") {
    filtered = filtered.filter(inv => {
      const amt = Number(inv.totalAmount || 0);
      return amt > 50000 && amt <= 100000;
    });
    labelParts.push("Giá 50.000₫ - 100.000₫");
  } else if (priceMode === "200000") {
    filtered = filtered.filter(inv => {
      const amt = Number(inv.totalAmount || 0);
      return amt > 100000 && amt <= 200000;
    });
    labelParts.push("Giá 100.000₫ - 200.000₫");
  } else if (priceMode === "gt500000") {
    filtered = filtered.filter(inv => Number(inv.totalAmount || 0) > 500000);
    labelParts.push("Giá > 500.000₫");
  }

  // 3. Tìm kiếm theo tên sản phẩm, khách hàng (tên/SĐT) hoặc mã hóa đơn
  const searchRaw = document.getElementById("inv-search-input")?.value.trim() || "";
  if (searchRaw) {
    const q = searchRaw.toLowerCase();
    filtered = filtered.filter(inv => {
      const matchCustomerName = (inv.customerName || "Khách vãng lai").toLowerCase().includes(q);
      const matchCustomerPhone = (inv.customerPhone || "").toLowerCase().includes(q);
      const matchInvoiceId = (inv.id || "").toLowerCase().includes(q);
      const matchProduct = Array.isArray(inv.items) && inv.items.some(it => (it.name || "").toLowerCase().includes(q));
      return matchProduct || matchCustomerName || matchCustomerPhone || matchInvoiceId;
    });
    labelParts.push(`Từ khóa: "${searchRaw}"`);
  }

  // Tính toán 3 chỉ số tổng hợp theo quy tắc ghi nhận doanh thu của hệ thống:
  // - Tổng số hóa đơn: Đếm số hóa đơn trong kết quả lọc
  // - Tổng doanh thu: Tổng tiền thực tế của các hóa đơn hợp lệ theo quy tắc ghi nhận doanh thu của hệ thống
  // - Tổng tiền giảm giá: Tổng các khoản giảm giá của những hóa đơn được tính
  const validInvoices = filtered.filter(inv => inv.status !== "Đã hủy" && Number(inv.totalAmount || 0) >= 0);
  const totalInvoicesCount = filtered.length;
  const totalActualRevenue = validInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
  const totalDiscountAmount = validInvoices.reduce((sum, inv) => sum + getInvoiceDiscountAmount(inv), 0);

  return {
    filtered,
    filterLabel: labelParts.join(" • "),
    fileSuffix,
    totalInvoicesCount,
    totalActualRevenue,
    totalDiscountAmount
  };
}
///

async function loadInvoicesFromAPI() {
    try {
        const response = await fetch("/api/invoices?page=1&pageSize=100");

        if (!response.ok) {
            throw new Error("Không thể tải hóa đơn từ SQL Server");
        }

        const result = await response.json();

        if (!result.success || !Array.isArray(result.data)) {
            throw new Error("Dữ liệu hóa đơn không hợp lệ");
        }

        window.apiInvoicesCache = result.data.map(inv => ({
            ...inv,

            id: String(inv.id),
            invoiceCode: inv.id,

            createdAt: inv.time,
            time: new Date(inv.time).toLocaleString("vi-VN"),

            cashier: inv.cashier || "Chưa xác định",

            customerName: inv.customerName || "",
            customerPhone: inv.customerPhone || "",

            paymentMethod: inv.paymentMethod || "Tiền mặt",

            subtotal: Number(inv.subtotal || 0),
            memberDiscount: Number(inv.memberDiscount || 0),
            vat: Number(inv.vat || 0),
            totalAmount: Number(inv.totalAmount || 0),

            items: Array.isArray(inv.items)
                ? inv.items.map(item => ({
                    ...item,
                    name: item.name,
                    price: Number(item.price || 0),
                    quantity: Number(item.quantity || 0)
                }))
                : []
        }));

        return window.apiInvoicesCache;

    } catch (error) {
        console.error("Lỗi tải lịch sử hóa đơn:", error);
        showToast("Không tải được lịch sử hóa đơn từ SQL Server!", "warning");
        return null;
    }
}

function renderInvoicesTable() {
  const {
    filtered,
    filterLabel,
    totalInvoicesCount,
    totalActualRevenue,
    totalDiscountAmount
  } = getFilteredInvoices();

  // Cập nhật 3 thẻ KPI tổng hợp trên giao diện
  const countEl = document.getElementById("inv-summary-count");
  const descEl = document.getElementById("inv-summary-filter-desc");
  const revEl = document.getElementById("inv-summary-revenue");
  const discEl = document.getElementById("inv-summary-discount");

  if (countEl) countEl.innerText = `${totalInvoicesCount} hóa đơn`;
  if (descEl) descEl.innerText = filterLabel;
  if (revEl) revEl.innerText = formatVND(totalActualRevenue);
  if (discEl) discEl.innerText = formatVND(totalDiscountAmount);

  const tbody = document.getElementById("invoices-table-body");
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="p-8 text-center text-slate-400 text-xs">
          <i data-lucide="search-x" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
          <p class="font-bold text-slate-600">Không tìm thấy hóa đơn nào phù hợp với bộ lọc (${filterLabel})</p>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map(inv => {
    const discountAmt = getInvoiceDiscountAmount(inv);
    const itemsSummary = Array.isArray(inv.items) && inv.items.length > 0
      ? inv.items.map(it => `${it.name} (x${it.quantity})`).join(", ")
      : "—";
    const customerDisplay = inv.customerPhone
      ? `<span class="font-bold text-slate-800 block">${inv.customerName || "Hội viên"}</span><span class="font-mono text-[10px] text-slate-500">${inv.customerPhone}</span>`
      : `<span class="text-slate-400">Khách vãng lai</span>`;

    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
        <td class="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">${inv.id}</td>
        <td class="p-3 text-slate-600 whitespace-nowrap">${inv.time}</td>
        <td class="p-3 font-semibold text-slate-800 whitespace-nowrap">${inv.cashier}</td>
        <td class="p-3 text-slate-700 max-w-xs">
          <div class="line-clamp-2 leading-snug" title="${itemsSummary.replace(/"/g, '&quot;')}">${itemsSummary}</div>
        </td>
        <td class="p-3 font-mono font-bold ${discountAmt > 0 ? 'text-amber-600' : 'text-slate-400'} whitespace-nowrap">
          ${discountAmt > 0 ? `-${formatVND(discountAmt)}` : '0 ₫'}
        </td>
        <td class="p-3 font-black text-[#005A2B] whitespace-nowrap">${formatVND(inv.totalAmount)}</td>
        <td class="p-3 whitespace-nowrap">
          <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${inv.paymentMethod === 'Tiền mặt' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}">
            ${inv.paymentMethod}
          </span>
        </td>
        <td class="p-3">${customerDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">
          <!-- Nút Xem chi tiết hóa đơn -->
          <button 
            onclick="openInvoiceDetailModal('${inv.id}')" 
            class="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-[#005A2B] hover:text-[#FFD700] text-slate-700 font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
            title="Xem chi tiết hóa đơn"
          >
            <i data-lucide="eye" class="w-3.5 h-3.5"></i>
            <span>Chi tiết</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function exportFilteredInvoicesToExcel() {
  const {
    filtered,
    filterLabel,
    fileSuffix,
    totalInvoicesCount,
    totalActualRevenue,
    totalDiscountAmount
  } = getFilteredInvoices();

  if (!filtered || filtered.length === 0) {
    showToast(`Không có hóa đơn nào trong kết quả lọc (${filterLabel}) để xuất file Excel!`, "warning");
    return;
  }

  const exportDateStr = getFormattedExportDateStr();

  // Các cột có sẵn trong Lịch sử hóa đơn + Chi tiết sản phẩm, Tiền hàng, Giảm giá, VAT
  const headers = [
    "STT",
    "Mã Hóa Đơn",
    "Thời Gian Giao Dịch",
    "Thu Ngân",
    "Khách Hàng CRM",
    "Số Điện Thoại KH",
    "Danh Sách Sản Phẩm Mua",
    "Tạm Tính (VND)",
    "Tiền Giảm Giá (VND)",
    "Thuế VAT 8% (VND)",
    "Tổng Thanh Toán Thực Tế (VND)",
    "Phương Thức Thanh Toán"
  ];

  const dataRows = filtered.map((inv, idx) => {
    const subtotal = Number(inv.subtotal || (Array.isArray(inv.items) ? inv.items.reduce((s, it) => s + it.price * it.quantity, 0) : 0));
    const discount = getInvoiceDiscountAmount(inv);
    const vat = Number(inv.vat || Math.round(Math.max(0, subtotal - discount) * 0.08));
    const totalAmount = Number(inv.totalAmount || 0);
    const itemsText = Array.isArray(inv.items) && inv.items.length > 0
      ? inv.items.map(it => `• ${it.name} (SL: ${it.quantity} x ${Number(it.price || 0).toLocaleString("vi-VN")}đ)`).join("\n")
      : "";

    return [
      idx + 1,
      inv.id || "",
      inv.time || "",
      inv.cashier || "",
      inv.customerName || (inv.customerPhone ? "Hội viên CRM" : "Khách vãng lai"),
      inv.customerPhone || "Khách vãng lai",
      itemsText,
      subtotal,
      discount,
      vat,
      totalAmount,
      inv.paymentMethod || ""
    ];
  });

  // Thêm các dòng tổng hợp theo đúng yêu cầu:
  // 1. Tổng số hóa đơn: Đếm số hóa đơn trong kết quả lọc
  dataRows.push([
    "",
    "TỔNG SỐ HÓA ĐƠN",
    `${totalInvoicesCount} hóa đơn (Đếm số hóa đơn trong kết quả lọc)`,
    "",
    "",
    "",
    `Bộ lọc áp dụng: ${filterLabel}`,
    "",
    "",
    "",
    totalInvoicesCount,
    "hóa đơn"
  ]);

  // 2. Tổng doanh thu: Tổng tiền thực tế của các hóa đơn hợp lệ theo quy tắc ghi nhận doanh thu của hệ thống
  dataRows.push([
    "",
    "TỔNG DOANH THU",
    "Tổng tiền thực tế của các hóa đơn hợp lệ theo quy tắc ghi nhận doanh thu của hệ thống",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    totalActualRevenue,
    "VND"
  ]);

  // 3. Tổng tiền giảm giá: Tổng các khoản giảm giá của những hóa đơn được tính
  dataRows.push([
    "",
    "TỔNG TIỀN GIẢM GIÁ",
    "Tổng các khoản giảm giá của những hóa đơn được tính",
    "",
    "",
    "",
    "",
    "",
    totalDiscountAmount,
    "",
    totalDiscountAmount,
    "VND"
  ]);

  // Hàng cuối ghi ngày xuất file
  dataRows.push([
    "",
    `Ngày xuất file: ${exportDateStr}`,
    `Phạm vi lọc: ${filterLabel}`,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    ""
  ]);

  const colWidths = [
    { wch: 7 },  // STT
    { wch: 24 }, // Mã Hóa Đơn
    { wch: 26 }, // Thời Gian
    { wch: 20 }, // Thu Ngân
    { wch: 22 }, // Khách Hàng CRM
    { wch: 18 }, // SĐT KH
    { wch: 46 }, // Danh Sách Sản Phẩm Mua (AutoFit Row Height sẽ tự giãn chiều cao dòng)
    { wch: 18 }, // Tạm Tính
    { wch: 20 }, // Tiền Giảm Giá
    { wch: 18 }, // Thuế VAT
    { wch: 28 }, // Tổng Thanh Toán Thực Tế
    { wch: 22 }  // Phương Thức Thanh Toán
  ];

  const fileName = `Lich_Su_Hoa_Don_Emart_${fileSuffix}.xlsx`;
  exportStyledExcelWorkbook({
    headers,
    dataRows,
    colWidths,
    sheetName: "LichSuHoaDon",
    fileName
  });

  showToast(
    `📊 ĐÃ XUẤT FILE EXCEL LỊCH SỬ HÓA ĐƠN!\n• Tên file: ${fileName}\n• Tổng số hóa đơn: ${totalInvoicesCount} đơn\n• Tổng doanh thu thực tế: ${formatVND(totalActualRevenue)}\n• Tổng tiền giảm giá: ${formatVND(totalDiscountAmount)}`,
    "success"
  );
}


function openInvoiceDetailModal(invoiceId) {
    const invoices = Array.isArray(window.apiInvoicesCache)
        && window.apiInvoicesCache.length > 0
        ? window.apiInvoicesCache
        : getInvoices();

    const inv = invoices.find(
        i => String(i.id) === String(invoiceId)
    );

    console.log("Invoice ID:", invoiceId);
    console.log("Invoices:", invoices);
    console.log("Found invoice:", inv);

    if (!inv) {
        showToast("Không tìm thấy hóa đơn!", "warning");
        return;
    }


  document.getElementById("inv-modal-id").innerText = inv.id;
  document.getElementById("inv-modal-time").innerText = inv.time;
  document.getElementById("inv-modal-cashier").innerText = inv.cashier;
  document.getElementById("inv-modal-customer").innerText = inv.customerPhone ? `${inv.customerName || 'Hội viên'} (${inv.customerPhone})` : "Khách hàng vãng lai";
  document.getElementById("inv-modal-method").innerText = inv.paymentMethod;

  const itemsContainer = document.getElementById("inv-modal-items");
  if (itemsContainer && inv.items) {
    itemsContainer.innerHTML = inv.items.map(item => `
      <div class="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50">
        <div>
          <p class="font-bold text-slate-900">${item.name}</p>
          <p class="text-[10px] text-slate-400">${formatVND(item.price)} x ${item.quantity}</p>
        </div>
        <span class="font-black text-[#005A2B]">${formatVND(item.price * item.quantity)}</span>
      </div>
    `).join('');
  }

  const subtotal = inv.subtotal || inv.items.reduce((s, it) => s + it.price * it.quantity, 0);
  const discount = inv.memberDiscount || 0;
  const vat = inv.vat || Math.round((subtotal - discount) * 0.08);

  document.getElementById("inv-modal-subtotal").innerText = formatVND(subtotal);
  document.getElementById("inv-modal-discount").innerText = discount > 0 ? `-${formatVND(discount)}` : "0 ₫";
  document.getElementById("inv-modal-vat").innerText = formatVND(vat);
  document.getElementById("inv-modal-total").innerText = formatVND(inv.totalAmount);

  const modal = document.getElementById("invoice-detail-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  if (window.lucide) lucide.createIcons();
}



function printInvoiceBill() {
    const invoiceId = document.getElementById("inv-modal-id")?.innerText?.trim();

    const invoices = Array.isArray(window.apiInvoicesCache)
        && window.apiInvoicesCache.length > 0
        ? window.apiInvoicesCache
        : getInvoices();

    const inv = invoices.find(
        i => String(i.id) === String(invoiceId)
    );


    if (!inv) {
        showToast("Không tìm thấy dữ liệu hóa đơn để in.", "error");
        return;
    }

    // Mở cửa sổ in riêng
    const printWindow = window.open("", "_blank", "width=420,height=700");

    if (!printWindow) {
        showToast("Trình duyệt đang chặn cửa sổ in. Vui lòng cho phép pop-up.", "error");
        return;
    }

    const escapeHTML = value =>
        String(value ?? "").replace(/[&<>"']/g, ch => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[ch]);

    const money = value => formatVND(Number(value) || 0);

    const items = Array.isArray(inv.items) ? inv.items : [];

    const subtotal = Number(inv.subtotal) ||
        items.reduce((sum, item) =>
            sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);

    const discount = Number(inv.memberDiscount) || 0;
    const vat = Number(inv.vat) || Math.round((subtotal - discount) * 0.08);
    const total = Number(inv.totalAmount) || subtotal - discount + vat;

    const rows = items.map(item => {
        const quantity = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;

        return `
            <tr>
                <td class="item-name">${escapeHTML(item.name)}</td>
                <td class="qty">${quantity}</td>
                <td class="amount">${money(price * quantity)}</td>
            </tr>
        `;
    }).join("");

    printWindow.document.open();

    printWindow.document.write(`
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Hóa đơn ${escapeHTML(inv.id)}</title>

<style>
    @page {
    size: 57mm auto;
    margin: 0;
}

    * {
        box-sizing: border-box;
    }

    html, body {
    width: 57mm;
    margin: 0;
    padding: 0;
    color: #000;
    background: #fff;
}

body {
    font-family: Arial, sans-serif;
    font-size: 12px;
    line-height: 1.5;
}

    .receipt {
    width: 53mm;
    margin: 0 auto;
    padding: 2mm 0 3mm;
    box-sizing: border-box;
}

    .center {
        text-align: center;
    }

    h1 {
    margin: 0 0 5px;
    font-size: 18px;
    font-weight: 800;
}

    .muted {
        color: #333;
    }

    .rule {
        border: 0;
        border-top: 1px dashed #000;
        margin: 6px 0;
    }

    .meta div {
        margin: 4px 0;
        overflow-wrap: anywhere;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
    }

    th {
    text-align: left;
    font-size: 11px;
    border-bottom: 1px solid #000;
    padding: 4px 0;
}

    td {
    padding: 5px 0;
    vertical-align: top;
    overflow-wrap: anywhere;
}

    .item-name {
        width: 54%;
        padding-right: 2px;
    }

    .qty {
        width: 10%;
        text-align: center;
    }

    .amount {
        width: 36%;
        text-align: right;
    }

    .summary div {
    display: flex;
    justify-content: space-between;
    gap: 5px;
    margin: 5px 0;
}

    .summary strong {
        font-size: 15px;
    }

    .thanks {
    margin-top: 12px;
    font-size: 13px;
    font-weight: bold;
}
    @media screen {
        body {
            margin: 12px auto;
        }

        .receipt {
            border: 1px solid #ddd;
            padding: 4mm;
        }
    }
        tr {
    break-inside: avoid;
    page-break-inside: avoid;
}

.summary,
.meta,
header,
footer {
    break-inside: avoid;
    page-break-inside: avoid;
}

table {
    page-break-inside: auto;
}

thead {
    display: table-header-group;
}

.no-break {
    break-inside: avoid;
    page-break-inside: avoid;
}
</style>
</head>

<body>
<main class="receipt">

    <header class="center">
        <h1>CỬA HÀNG</h1>
        <div>HÓA ĐƠN BÁN LẺ</div>
    </header>

    <hr class="rule">

    <section class="meta">
        <div><b>Mã HĐ:</b> ${escapeHTML(inv.id)}</div>
        <div><b>Thời gian:</b> ${escapeHTML(inv.time)}</div>
        <div><b>Thu ngân:</b> ${escapeHTML(inv.cashier)}</div>
        <div><b>Khách hàng:</b> ${
            escapeHTML(inv.customerPhone
                ? `${inv.customerName || "Hội viên"} (${inv.customerPhone})`
                : "Khách hàng vãng lai")
        }</div>
        <div><b>Thanh toán:</b> ${escapeHTML(inv.paymentMethod)}</div>
    </section>

    <hr class="rule">

    <table>
        <thead>
            <tr>
                <th class="item-name">Sản phẩm</th>
                <th class="qty">SL</th>
                <th class="amount">Thành tiền</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>

    <hr class="rule">

    <section class="summary">
        <div>
            <span>Tạm tính</span>
            <span>${money(subtotal)}</span>
        </div>

        ${discount > 0 ? `
        <div>
            <span>Giảm giá</span>
            <span>-${money(discount)}</span>
        </div>` : ""}

        ${vat > 0 ? `
        <div>
            <span>VAT</span>
            <span>${money(vat)}</span>
        </div>` : ""}

        <hr class="rule">

        <div>
            <strong>TỔNG CỘNG</strong>
            <strong>${money(total)}</strong>
        </div>
    </section>

    <footer class="center thanks">
        Cảm ơn quý khách!
    </footer>

    <div class="center muted">Hẹn gặp lại</div>

</main>

<script>
    window.onload = () => {
        window.focus();
        window.print();
    };

    window.onafterprint = () => window.close();
<\/script>

</body>
</html>
    `);

    printWindow.document.close();
}


function closeInvoiceDetailModal() {
  const modal = document.getElementById("invoice-detail-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

// ==========================================
// 5. RENDER STAFF TABLE (Danh sách đang làm việc & Bảng nghỉ việc/tạm nghỉ việc ở dưới)
// ==========================================

async function renderStaffTable() {
    const tbody = document.getElementById("staff-table-body");
    const inactiveTbody = document.getElementById("inactive-staff-table-body");
    const activeCountEl = document.getElementById("active-staff-count");
    const inactiveCountEl = document.getElementById("inactive-staff-count");

    if (!tbody) return;

    try {
        const response = await fetch("/api/employees");
const result = await response.json();

if (!response.ok || !result.success) {
    throw new Error(result.message || "Không thể tải danh sách nhân viên!");
}

// Danh sách nhân viên nằm trong result.data
const staff = result.data.map(s => ({
    id: s.EmployeeCode,
    employeeId: s.EmployeeID,
    name: s.FullName,
    email: s.Email,
    phone: s.Phone,
    role: s.Role,
    shift: s.Shift,
    status: s.Status
}));
        const activeStaff = staff.filter(s =>
            s.status === "Đang làm việc"
        );

        const inactiveStaff = staff.filter(s =>
            s.role !== "Chủ cửa hàng" &&
            s.status !== "Đang làm việc" &&
            s.status !== "Đã xóa"
        );

        if (activeCountEl) {
            activeCountEl.innerText = `${activeStaff.length} nhân sự`;
        }

        if (inactiveCountEl) {
            inactiveCountEl.innerText = `${inactiveStaff.length} nhân sự`;
        }

        tbody.innerHTML = activeStaff.map(s => {
            const isOwner = s.role === "Chủ cửa hàng";

            return `
                <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
                    <td class="p-3 font-mono font-bold text-slate-500">${s.id}</td>
                    <td class="p-3">
                        <span class="font-bold text-slate-900 block">${s.name}</span>
                        <span class="text-[10px] text-slate-400">${s.phone || "Chưa cập nhật SĐT"}</span>
                    </td>
                    <td class="p-3 text-slate-600 font-mono">${s.email}</td>
                    <td class="p-3">
                        <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            isOwner
                                ? "bg-amber-100 text-amber-900 border border-amber-300"
                                : "bg-emerald-100 text-emerald-800"
                        }">${s.role}</span>
                    </td>
                    <td class="p-3 text-slate-600">${s.shift || ""}</td>
                    <td class="p-3 text-center">
                        <div class="flex items-center justify-center gap-1.5">
                            <button onclick="editStaff('${s.id}')"
                                class="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-[#005A2B] hover:text-[#FFD700] text-slate-700 font-bold transition flex items-center gap-1 cursor-pointer">
                                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                                <span>Chi tiết</span>
                            </button>
                            ${!isOwner ? `
                                <button onclick="deleteStaff('${s.id}')"
                                    class="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition cursor-pointer">
                                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                </button>
                            ` : ""}
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        if (inactiveTbody) {
            if (inactiveStaff.length === 0) {
                inactiveTbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="p-6 text-center text-slate-400 text-xs">
                            Hiện không có nhân viên nào trong danh sách nghỉ việc / tạm nghỉ việc.
                        </td>
                    </tr>
                `;
            } else {
                inactiveTbody.innerHTML = inactiveStaff.map(s => `
                    <tr class="border-b border-slate-100 bg-red-50/20 hover:bg-red-50/40 transition text-xs">
                        <td class="p-3 font-mono font-bold text-slate-400">${s.id}</td>
                        <td class="p-3">
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-slate-700 line-through">${s.name}</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">Đã khóa TK</span>
                            </div>
                            <span class="text-[10px] text-slate-400">${s.phone || "Chưa cập nhật SĐT"}</span>
                        </td>
                        <td class="p-3 text-slate-500 font-mono">${s.email}</td>
                        <td class="p-3">
                            <span class="px-2 py-0.5 rounded-full font-bold text-[10px] bg-slate-100 text-slate-600">${s.role}</span>
                        </td>
                        <td class="p-3 text-slate-500">${s.shift || ""}</td>
                        <td class="p-3 text-center">
                            <div class="flex items-center justify-center gap-1.5">
                                <button onclick="editStaff('${s.id}')"
                                    class="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-[#005A2B] hover:text-[#FFD700] text-slate-700 font-bold transition flex items-center gap-1 cursor-pointer">
                                    <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                                    <span>Chi tiết</span>
                                </button>
                                <button onclick="deleteStaff('${s.id}')"
                                    class="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition cursor-pointer">
                                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join("");
            }
        }

        if (window.lucide) lucide.createIcons();

    } catch (error) {
        console.error("Lỗi tải danh sách nhân viên:", error);
        showToast("Không thể tải danh sách nhân viên từ máy chủ!", "error");
    }
}


function openAddStaffModal() {
  document.getElementById("modal-staff-title").innerText = "Thêm Nhân Viên Mới";
  document.getElementById("modal-staff-id").value = "";
  document.getElementById("staff-name").value = "";
  document.getElementById("staff-email").value = "";
  document.getElementById("staff-password").value = "";
  // Ẩn và xóa mật khẩu xác nhận của chủ cửa hàng
const ownerPasswordGroup = document.getElementById("owner-current-password-group");
const currentPasswordInput = document.getElementById("staff-current-password");

if (ownerPasswordGroup) {
    ownerPasswordGroup.classList.add("hidden");
}

if (currentPasswordInput) {
    currentPasswordInput.value = "";
    currentPasswordInput.required = false;
}

// Khôi phục trạng thái mật khẩu khi thêm thu ngân
const staffPasswordInput = document.getElementById("staff-password");

if (staffPasswordInput) {
    staffPasswordInput.required = true;
    staffPasswordInput.placeholder = "Nhập mật khẩu";
}
  document.getElementById("staff-phone").value = "";
  document.getElementById("staff-role").value = "Nhân viên thu ngân";
  document.getElementById("staff-role").disabled = false;
  document.getElementById("staff-shift").value = "Ca Sáng (06:00 - 14:00)";
  const statusSelect = document.getElementById("staff-status");
  if (statusSelect) {
    statusSelect.value = "Đang làm việc";
    statusSelect.disabled = false;
  }

  const modal = document.getElementById("staff-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  if (window.lucide) lucide.createIcons();
}

function closeStaffModal() {
  const modal = document.getElementById("staff-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}


async function saveStaffFromModal(e) {
    e.preventDefault();

    const id = document.getElementById("modal-staff-id").value;

    const name = document.getElementById("staff-name").value.trim();
    const email = document.getElementById("staff-email").value.trim();
    const password = document.getElementById("staff-password").value.trim();
    const phone = document.getElementById("staff-phone").value.trim();
    const role = document.getElementById("staff-role").value;
    const shift = document.getElementById("staff-shift").value;
    const status = document.getElementById("staff-status")?.value || "Đang làm việc";

    if (!name || !email) {
        showToast("Vui lòng nhập đầy đủ họ tên và email!", "error");
        return;
    }

    try {
        let employeeCode = "";

        // THÊM NHÂN VIÊN MỚI
        if (!id) {
            if (!password) {
                showToast("Vui lòng nhập mật khẩu cho nhân viên mới!", "error");
                return;
            }

            // Chỉ cho phép tạo tài khoản thu ngân
            if (role !== "Nhân viên thu ngân") {
                showToast("Không thể tạo thêm tài khoản Chủ cửa hàng!", "error");
                return;
            }

            // Lấy danh sách hiện tại để tạo mã nhân viên tiếp theo
            const listResponse = await fetch("/api/employees");
            const listResult = await listResponse.json();

            if (!listResponse.ok || !listResult.success) {
                throw new Error("Không thể lấy danh sách nhân viên!");
            }

            const maxId = Math.max(
                0,
                ...listResult.data.map(s => Number(s.EmployeeID) || 0)
            );

            employeeCode = "st-" + String(maxId + 1).padStart(2, "0");

            const response = await fetch("/api/employees", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    EmployeeCode: employeeCode,
                    FullName: name,
                    Email: email,
                    Password: password,
                    Phone: phone,
                    Role: role,
                    Shift: shift,
                    Status: status
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Không thể thêm nhân viên!");
            }

        } 
        else {
            // CHỈNH SỬA NHÂN VIÊN

            const listResponse = await fetch("/api/employees");
            const listResult = await listResponse.json();

            if (!listResponse.ok || !listResult.success) {
                throw new Error("Không thể lấy danh sách nhân viên!");
            }

            const currentEmployee = listResult.data.find(
                s => Number(s.EmployeeID) === Number(id)
            );
            if (!currentEmployee) {
    throw new Error("Không tìm thấy nhân viên!");
}
            // Kiểm tra tài khoản chủ cửa hàng
const isOwner = currentEmployee.Role === "Chủ cửa hàng";

if (isOwner) {
    const currentPassword = document.getElementById("staff-current-password")?.value.trim();
    const newPassword = password;

    if (!currentPassword) {
        showToast("Vui lòng nhập mật khẩu hiện tại để xác nhận!", "error");
        return;
    }

    const response = await fetch("/api/auth/update-owner-profile", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email: currentEmployee.Email,
            currentPassword,
            fullName: name,
            newEmail: email,
            phone,
            newPassword
        })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(result.message || "Không thể cập nhật tài khoản chủ cửa hàng!");
    }

    // Đồng bộ thông tin tài khoản đang đăng nhập
    const sessionUser = JSON.parse(localStorage.getItem("emart_current_user") || "{}");

    sessionUser.name = result.user.name;
    sessionUser.email = result.user.email;
    sessionUser.phone = result.user.phone;

    localStorage.setItem("emart_current_user", JSON.stringify(sessionUser));

    closeStaffModal();
    await renderStaffTable();

    showToast("Cập nhật tài khoản chủ cửa hàng thành công!", "success");
    return;
}

            employeeCode = currentEmployee.EmployeeCode;

            const updateData = {
                EmployeeCode: employeeCode,
                FullName: name,
                Email: email,
                Phone: phone,
                Role: role,
                Shift: shift
            };

            if (password) {
                updateData.Password = password;
            }

            console.log("EmployeeID:", id);
            console.log("EmployeeCode:", employeeCode);
            console.log("DỮ LIỆU CẬP NHẬT:", updateData);

            const response = await fetch(`/api/employees/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(updateData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Không thể cập nhật nhân viên!");
            }

            const statusResponse = await fetch(`/api/employees/${id}/status`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ Status: status })
            });

            const statusResult = await statusResponse.json();

            if (!statusResponse.ok) {
                throw new Error(statusResult.message || "Không thể cập nhật trạng thái!");
            }
        }


        closeStaffModal();
        await renderStaffTable();

        showToast(
            id ? "Cập nhật nhân viên thành công!" : "Thêm nhân viên thành công!",
            "success"
        );

    } catch (error) {
        console.error("Lỗi lưu nhân viên:", error);
        showToast(error.message || "Không thể lưu thông tin nhân viên!", "error");
    }
}


async function editStaff(staffId) {
    try {
        // Lấy danh sách nhân viên từ SQL Server
        const response = await fetch("/api/employees");
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Không thể tải thông tin nhân viên!");
        }

        // Tìm nhân viên theo mã nhân viên
        const s = result.data.find(item =>
            item.EmployeeCode === staffId
        );

        if (!s) {
            showToast("Không tìm thấy nhân viên!", "error");
            return;
        }

        document.getElementById("modal-staff-title").innerText =
            "Chi Tiết Nhân Viên & Trạng Thái";

        document.getElementById("modal-staff-id").value = s.EmployeeID;
        document.getElementById("modal-staff-code").value = s.EmployeeCode;
        document.getElementById("staff-name").value = s.FullName;
        document.getElementById("staff-email").value = s.Email;

        // Không hiển thị mật khẩu cũ
        const passwordInput = document.getElementById("staff-password");
        passwordInput.value = "";
        passwordInput.required = false;
        passwordInput.placeholder = "Để trống nếu không đổi mật khẩu";

        const passwordHint = document.getElementById("staff-password-hint");
        if (passwordHint) {
            passwordHint.innerText = "* Chỉ nhập nếu muốn đổi mật khẩu.";
        }

        const passwordRequired = document.getElementById("staff-password-required");
        if (passwordRequired) {
            passwordRequired.classList.add("hidden");
        }

        document.getElementById("staff-phone").value = s.Phone || "";
        document.getElementById("staff-role").value = s.Role;
        document.getElementById("staff-shift").value = s.Shift || "";

        const statusSelect = document.getElementById("staff-status");

        if (statusSelect) {
            statusSelect.value = s.Status === "Đang làm việc"
                ? "Đang làm việc"
                : "Nghỉ việc (Khóa tài khoản không đăng nhập được)";
        }

        const roleSelect = document.getElementById("staff-role");

        // Không cho phép sửa vai trò hoặc trạng thái chủ cửa hàng
if (s.Role === "Chủ cửa hàng") {
    roleSelect.disabled = true;

    if (statusSelect) {
        statusSelect.value = "Đang làm việc";
        statusSelect.disabled = true;
    }

    // Hiện ô xác nhận mật khẩu hiện tại
    const ownerPasswordGroup = document.getElementById("owner-current-password-group");
    const currentPasswordInput = document.getElementById("staff-current-password");

    if (ownerPasswordGroup) ownerPasswordGroup.classList.remove("hidden");
    if (currentPasswordInput) {
        currentPasswordInput.value = "";
        currentPasswordInput.required = true;
    }

    passwordInput.placeholder = "Để trống nếu không đổi mật khẩu";

} else {
    roleSelect.disabled = false;

    if (statusSelect) {
        statusSelect.disabled = false;
    }

    // Ẩn ô xác nhận mật khẩu của chủ cửa hàng
    const ownerPasswordGroup = document.getElementById("owner-current-password-group");
    const currentPasswordInput = document.getElementById("staff-current-password");

    if (ownerPasswordGroup) ownerPasswordGroup.classList.add("hidden");
    if (currentPasswordInput) {
        currentPasswordInput.value = "";
        currentPasswordInput.required = false;
    }
}

        const modal = document.getElementById("staff-modal");
        modal.classList.remove("hidden");
        modal.classList.add("flex");

        if (window.lucide) {
            lucide.createIcons();
        }

    } catch (error) {
        console.error("Lỗi lấy thông tin nhân viên:", error);
        showToast("Không thể tải thông tin nhân viên!", "error");
    }
}



async function toggleStaffStatus(staffId) {
    try {
        const response = await fetch("/api/employees");
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Không thể tải danh sách nhân viên!");
        }

        const employee = result.data.find(
            item => item.EmployeeCode === staffId
        );

        if (!employee) {
            throw new Error("Không tìm thấy nhân viên!");
        }

        if (employee.Role === "Chủ cửa hàng") {
            showToast("Không thể thay đổi trạng thái tài khoản chủ cửa hàng!", "warning");
            return;
        }

        const newStatus = employee.Status === "Đang làm việc"
            ? "Nghỉ việc (Khóa tài khoản không đăng nhập được)"
            : "Đang làm việc";

        const updateResponse = await fetch(
            `/api/employees/${employee.EmployeeID}/status`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ Status: newStatus })
            }
        );

        const updateResult = await updateResponse.json();

        if (!updateResponse.ok || !updateResult.success) {
            throw new Error(updateResult.message || "Không thể cập nhật trạng thái!");
        }

        await renderStaffTable();

        showToast("Cập nhật trạng thái nhân viên thành công!", "success");

    } catch (error) {
        console.error("Lỗi cập nhật trạng thái:", error);
        showToast(error.message || "Không thể cập nhật trạng thái!", "error");
    }
}


async function deleteStaff(staffId) {
    try {
        const response = await fetch("/api/employees");

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Không thể tải danh sách nhân viên!");
        }

        const employee = result.data.find(
            item => item.EmployeeCode === staffId
        );

        if (!employee) {
            throw new Error("Không tìm thấy nhân viên!");
        }

        if (employee.Role === "Chủ cửa hàng") {
            showToast("Không thể xóa tài khoản Chủ cửa hàng!", "warning");
            return;
        }

        if (!confirm(`Bạn có chắc chắn muốn xóa nhân viên "${employee.FullName}"?`)) {
            return;
        }

        const deleteResponse = await fetch(
            `/api/employees/${employee.EmployeeID}`,
            { method: "DELETE" }
        );

        const deleteResult = await deleteResponse.json();

        if (!deleteResponse.ok || !deleteResult.success) {
            throw new Error(deleteResult.message || "Không thể xóa nhân viên!");
        }

        await renderStaffTable();

        showToast("Đã xóa nhân viên thành công!", "success");

    } catch (error) {
        console.error("Lỗi xóa nhân viên:", error);
        showToast(error.message || "Không thể xóa nhân viên!", "error");
    }
}


// ==========================================
// 6. RENDER CRM TABLE & XÉT DUYỆT NÂNG HẠNG (1 điểm = 1 đồng)
// ==========================================
let currentSelectedCustomer = null;


async function renderCrmTable() {
    const tbody = document.getElementById("crm-table-body");
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="p-6 text-center text-slate-400">
                Đang tải danh sách khách hàng...
            </td>
        </tr>
    `;

    try {
        const response = await fetch("/api/customers");
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Không thể tải khách hàng!");
        }

        const customers = result.data.filter(c => c.Status === "Đang hoạt động");

        if (customers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="p-6 text-center text-slate-400">
                        Chưa có khách hàng thân thiết.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = customers.map(c => {
            const totalSpent = Number(c.TotalSpent) || 0;
            const points = Number(c.TotalPoints) || 0;

            let tier = "Đồng";

            if (totalSpent >= 5000000) {
                tier = "Kim Cương";
            } else if (totalSpent >= 2000000) {
                tier = "Vàng";
            } else if (totalSpent >= 500000) {
                tier = "Bạc";
            }

            return `
                <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
                    <td class="p-3 font-mono font-bold text-slate-900">
                        ${c.Phone || ""}
                    </td>

                    <td class="p-3 font-bold text-slate-800">
                        ${c.FullName || ""}
                    </td>

                    <td class="p-3 font-black text-[#FFA500]">
                        ${points.toLocaleString("vi-VN")} điểm
                        <span class="text-[10px] text-slate-400 font-normal block">
                            (~${formatVND(points)})
                        </span>
                    </td>

                    <td class="p-3 font-black text-[#005A2B]">
                        ${formatVND(totalSpent)}
                    </td>

                    <td class="p-3">
                        <span class="px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            tier === "Kim Cương" ? "bg-purple-100 text-purple-900 border border-purple-300" :
                            tier === "Vàng" ? "bg-amber-100 text-amber-900 border border-amber-300" :
                            tier === "Bạc" ? "bg-slate-100 text-slate-800 border border-slate-300" :
                            "bg-orange-100 text-orange-900 border border-orange-200"
                        }">
                            Hạng ${tier}
                        </span>
                    </td>

                    <td class="p-3 text-center">
                        <button
                            onclick="openCrmDetailModal('${c.Phone}')"
                            class="px-2.5 py-1.5 rounded-xl bg-[#005A2B] hover:bg-[#0B6A36] text-[#FFD700] font-black transition flex items-center justify-center gap-1 mx-auto cursor-pointer shadow-2xs"
                            title="Xem chi tiết chi tiêu & Xét duyệt nâng hạng"
                        >
                            <i data-lucide="award" class="w-3.5 h-3.5"></i>
                            <span>Chi tiết & Xét hạng</span>
                        </button>
                    </td>
                </tr>
            `;
        }).join("");

        if (window.lucide) lucide.createIcons();

    } catch (error) {
        console.error("Lỗi tải khách hàng CRM:", error);

        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="p-6 text-center text-red-500">
                    Không thể tải danh sách khách hàng từ máy chủ!
                </td>
            </tr>
        `;
    }
}




async function openCrmDetailModal(customerPhone) {
  try {
    // 1. Lấy danh sách khách hàng từ SQL Server
    const response = await fetch("/api/customers");
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Không thể tải dữ liệu khách hàng");
    }

    // 2. Tìm khách hàng theo số điện thoại
    const c = result.data.find(item => item.Phone === customerPhone);

    if (!c) {
      showToast("Không tìm thấy khách hàng!", "error");
      return;
    }

    // 3. Lấy thông tin khách hàng
    const totalSpent = Number(c.TotalSpent) || 0;
    const points = Number(c.TotalPoints) || 0;

    let tier = "Đồng";
    if (totalSpent >= 5000000) tier = "Kim Cương";
    else if (totalSpent >= 2000000) tier = "Vàng";
    else if (totalSpent >= 500000) tier = "Bạc";

    currentSelectedCustomer = {
      id: c.CustomerID,
      code: c.CustomerCode,
      phone: c.Phone,
      name: c.FullName,
      points: points,
      totalSpent: totalSpent,
      tier: tier,
      joinedDate: c.CreatedAt
    };

    // 4. Hiển thị thông tin khách hàng lên modal
    const joinedDate = c.CreatedAt
      ? new Date(c.CreatedAt).toLocaleDateString("vi-VN")
      : "Chưa xác định";

    document.getElementById("crm-modal-phone").innerText = c.Phone;
    document.getElementById("crm-modal-name").innerText = c.FullName;

    document.getElementById("crm-modal-joined").innerText =
      "Ngày tham gia: " + joinedDate;

    document.getElementById("crm-modal-points").innerText =
      `${points.toLocaleString("vi-VN")} điểm (= ${formatVND(points)})`;

    document.getElementById("crm-modal-total-spent").innerText =
      formatVND(totalSpent);

    document.getElementById("crm-modal-current-tier").innerText =
      "Hạng hiện tại: " + tier;

    document.getElementById("crm-modal-tier-select").value = tier;

    // 5. Lấy hóa đơn từ SQL Server
    const invoiceResponse = await fetch(
      `/api/sales/invoices?search=${encodeURIComponent(c.Phone)}&page=1&pageSize=100`
    );

    const invoiceResult = await invoiceResponse.json();

    if (!invoiceResponse.ok || !invoiceResult.success) {
      throw new Error(
        invoiceResult.message || "Không thể tải lịch sử hóa đơn"
      );
    }

    // 6. Lọc hóa đơn theo số điện thoại khách hàng
    const custInvoices = (invoiceResult.data || []).filter(
      inv => inv.CustomerPhone === c.Phone
    );

    const totalOrders = custInvoices.length;

    document.getElementById("crm-modal-orders-count").innerText =
      `${totalOrders} đơn hàng`;

    // 7. Hiển thị lịch sử hóa đơn
    const listContainer = document.getElementById("crm-modal-invoices-list");

    if (listContainer) {
      if (custInvoices.length > 0) {
        listContainer.innerHTML = custInvoices.map(inv => `
          <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <p class="font-bold text-slate-800">${inv.InvoiceCode}</p>
              <p class="text-[10px] text-slate-400">
                ${new Date(inv.SaleDate).toLocaleString("vi-VN")}
                • ${inv.PaymentMethod || "Tiền mặt"}
              </p>
            </div>
            <span class="font-black text-[#005A2B]">
              ${formatVND(Number(inv.TotalAmount) || 0)}
            </span>
          </div>
        `).join("");
      } else {
        listContainer.innerHTML = `
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-center">
            <p>Khách hàng chưa có hóa đơn mua sắm nào.</p>
          </div>
        `;
      }
    }

    // 8. Mở modal
    const modal = document.getElementById("crm-detail-modal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");

    if (window.lucide) lucide.createIcons();

  } catch (error) {
    console.error("Lỗi mở chi tiết khách hàng:", error);
    showToast(
      "Không thể tải chi tiết khách hàng: " + error.message,
      "error"
    );
  }
}



function closeCrmDetailModal() {
  const modal = document.getElementById("crm-detail-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function saveCrmTierUpgrade() {
  if (!currentSelectedCustomer) return;
  const newTier = document.getElementById("crm-modal-tier-select").value;

  const customers = getCustomers();
  const c = customers.find(item => item.phone === currentSelectedCustomer.phone);
  if (c) {
    c.tier = newTier;
    saveCustomers(customers);
    renderCrmTable();
    closeCrmDetailModal();
    showToast(`Đã nâng hạng thành viên "${c.name}" lên: HẠNG ${newTier} thành công!`, "success");
  }
}

function autoEvaluateTierBySpending() {
  if (!currentSelectedCustomer) return;
  const invoices = getInvoices();
  const custInvoices = invoices.filter(inv => inv.customerPhone === currentSelectedCustomer.phone);
  const totalSpent = custInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

  let suggestedTier = "Đồng";
  if (totalSpent >= 5000000) {
    suggestedTier = "Kim Cương";
  } else if (totalSpent >= 2000000) {
    suggestedTier = "Vàng";
  } else if (totalSpent >= 500000) {
    suggestedTier = "Bạc";
  }

  document.getElementById("crm-modal-tier-select").value = suggestedTier;
  showToast(`Căn cứ vào tổng chi tiêu ${formatVND(totalSpent)}, hệ thống gợi ý xếp khách hàng vào: HẠNG ${suggestedTier}. Vui lòng bấm "Nâng Hạng" để lưu!`, "info");
}

// ==========================================
// 7. DUYỆT BÁO CÁO CẬN DATE & TỒN KHO TỪ NHÂN VIÊN
// (Chủ duyệt -> Kích hoạt Set giảm giá & Set trả hàng)
// ==========================================
function checkPendingReportsNotification() {
  const reports = getInventoryReports();
  const pending = reports.filter(r => r.status === "Chờ duyệt");
  const badge = document.getElementById("header-report-alert-badge");
  const text = document.getElementById("header-report-alert-text");
  const sidebarBadge = document.getElementById("sidebar-report-badge");

  if (sidebarBadge) {
    if (pending.length > 0) {
      sidebarBadge.classList.remove("hidden");
      sidebarBadge.innerText = pending.length;
    } else {
      sidebarBadge.classList.add("hidden");
    }
  }

  if (badge && text) {
    if (pending.length > 0) {
      badge.classList.remove("hidden");
      text.innerText = `Có ${pending.length} báo cáo kiểm kê từ Nhân viên chờ duyệt!`;
    } else {
      badge.classList.add("hidden");
    }
  }
}


let allEmployeeReports = [];
async function loadEmployeeReports() {
  const container = document.getElementById("employee-reports-container");

  if (!container) return;

  container.innerHTML = `
    <div class="bg-white rounded-2xl p-6 text-center text-slate-400">
      Đang tải báo cáo nhân viên...
    </div>
  `;

  try {
    const response = await fetch("/api/employee-reports");
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Không thể tải báo cáo.");
    }

    allEmployeeReports = result.data || [];
filterEmployeeReports();

  } catch (error) {
    console.error("Lỗi tải báo cáo nhân viên:", error);

    container.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-2xl p-5 text-red-700">
        ${error.message}
      </div>
    `;
  }
}


function filterEmployeeReports() {
  const statusFilter = document.getElementById(
    "employee-report-status-filter"
  )?.value || "all";

  const typeFilter = document.getElementById(
    "employee-report-type-filter"
  )?.value || "all";

  const filteredReports = allEmployeeReports.filter(report => {
    const matchStatus =
      statusFilter === "all" || report.Status === statusFilter;

    const matchType =
      typeFilter === "all" || report.ReportType === typeFilter;

    return matchStatus && matchType;
  });

  renderEmployeeReports(filteredReports);
}


function renderEmployeeReportContent(content) {
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

  const text = String(content || "");
  const marker = "Danh sách sản phẩm cần xử lý:";

  // Báo cáo thông thường không có danh sách sản phẩm
  if (!text.includes(marker)) {
    return `
      <div class="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap">
        ${escapeHTML(text)}
      </div>
    `;
  }

  const note = text.match(/Ghi chú nhân viên:\s*([^\n]*)/);
  const productSection = text.split(marker)[1] || "";

  const products = productSection
    .split(/\n(?=\d+\.\s)/)
    .map(block => {
      const lines = block.trim().split("\n").map(line => line.trim());

      const name = lines[0]?.replace(/^\d+\.\s*/, "") || "";

      const getValue = label => {
        const line = lines.find(line => line.startsWith(`- ${label}:`));
        return line ? line.substring(label.length + 3).trim() : "";
      };

      return {
        name,
        barcode: getValue("Mã vạch"),
        batchCode: getValue("Mã lô"),
        stock: getValue("Tồn kho"),
        expiryDate: getValue("Hạn sử dụng"),
        daysLeft: getValue("Số ngày còn lại"),
        risk: getValue("Tình trạng"),
        discount: getValue("Giảm giá đề xuất")
      };
    })
    .filter(product => product.name);

  const productRows = products.map(product => {
    const days = Number(product.daysLeft);

    const riskClass = product.daysLeft !== "" && days <= 7
      ? "bg-red-100 text-red-700"
      : "bg-amber-100 text-amber-800";

    return `
      <tr class="border-t border-slate-200">
        <td class="p-3">
          <div class="font-bold text-slate-800">
            ${escapeHTML(product.name)}
          </div>
          <div class="text-xs text-slate-400 mt-1">
            Mã vạch: ${escapeHTML(product.barcode || "—")}
          </div>
          <div class="text-xs text-slate-400">
            Mã lô: ${escapeHTML(product.batchCode || "—")}
          </div>
        </td>

        <td class="p-3 text-center font-bold">
          ${escapeHTML(product.stock || "—")}
        </td>

        <td class="p-3 text-center whitespace-nowrap">
          ${escapeHTML(product.expiryDate || "—")}
          <div class="text-xs text-red-600 mt-1">
            ${product.daysLeft !== ""
              ? `${escapeHTML(product.daysLeft)} ngày`
              : ""}
          </div>
        </td>

        <td class="p-3">
          <span class="inline-block px-2 py-1 rounded-full text-xs font-bold ${riskClass}">
            ${escapeHTML(product.risk || "Chưa xác định")}
          </span>
        </td>

        <td class="p-3 text-center font-bold text-emerald-700">
          ${escapeHTML(product.discount || "—")}
        </td>
      </tr>
    `;
  }).join("");

  return `
    ${note ? `
      <div class="bg-slate-50 rounded-xl p-3 mb-4 text-sm text-slate-700">
        <strong>Ghi chú nhân viên:</strong>
        ${escapeHTML(note[1])}
      </div>
    ` : ""}

    <div class="overflow-x-auto border border-slate-200 rounded-xl">
      <table class="w-full text-sm min-w-[750px]">
        <thead class="bg-slate-100 text-slate-600">
          <tr>
            <th class="p-3 text-left">Sản phẩm</th>
            <th class="p-3 text-center">Tồn kho</th>
            <th class="p-3 text-center">Hạn sử dụng</th>
            <th class="p-3 text-left">Tình trạng rủi ro</th>
            <th class="p-3 text-center">Giảm giá đề xuất</th>
          </tr>
        </thead>
        <tbody>
          ${productRows}
        </tbody>
      </table>
    </div>
  `;
}


function renderEmployeeReports(reports) {
  const container = document.getElementById("employee-reports-container");
  if (!container) return;

  if (reports.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <i data-lucide="inbox" class="w-10 h-10 mx-auto text-slate-300 mb-3"></i>
        <p class="font-bold text-slate-700">Chưa có báo cáo nhân viên</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

  container.innerHTML = reports.map(report => {
    const isPending = report.Status === "Chờ duyệt";
    const isApproved = report.Status === "Đã duyệt";

    const statusClass = isPending
      ? "bg-amber-100 text-amber-800"
      : isApproved
        ? "bg-emerald-100 text-emerald-800"
        : "bg-red-100 text-red-700";

    const reportDate = report.ReportDate
      ? new Date(report.ReportDate).toLocaleDateString("vi-VN")
      : "";

    return `
      <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">

        <div class="flex flex-col sm:flex-row sm:justify-between gap-3">
          <div>
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <span class="px-3 py-1 rounded-full text-xs font-bold ${statusClass}">
                ${escapeHTML(report.Status)}
              </span>
              <span class="text-xs text-slate-400 font-mono">
                ${escapeHTML(report.ReportCode)}
              </span>
            </div>

            <h3 class="font-bold text-slate-900">
              ${escapeHTML(report.Title)}
            </h3>

            <p class="text-xs text-slate-500 mt-1">
              Nhân viên: ${escapeHTML(report.EmployeeName)}
              (${escapeHTML(report.EmployeeCode)})
            </p>
          </div>

          <div class="text-xs text-slate-500">
            Ngày báo cáo: ${escapeHTML(reportDate)}
          </div>
        </div>

        <div class="bg-slate-50 rounded-xl p-4">
          <p class="text-xs font-bold text-slate-600 mb-2">
            Loại báo cáo: ${escapeHTML(report.ReportType)}
          </p>
          ${renderEmployeeReportContent(report.Content)}
        </div>

        ${report.ApprovalNote ? `
          <div class="text-xs text-slate-600 border-l-4 border-slate-300 pl-3">
            <strong>Ghi chú xử lý:</strong>
            ${escapeHTML(report.ApprovalNote)}
          </div>
        ` : ""}

        ${isPending ? `
          <div class="flex flex-wrap gap-2">
            <button
              onclick="handleEmployeeReportStatus(${Number(report.ReportID)}, 'Đã duyệt')"
              class="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold">
              <i data-lucide="check-check" class="w-4 h-4 inline"></i>
              Duyệt báo cáo
            </button>

            <button
              onclick="handleEmployeeReportStatus(${Number(report.ReportID)}, 'Từ chối')"
              class="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold">
              <i data-lucide="x-circle" class="w-4 h-4 inline"></i>
              Từ chối
            </button>
          </div>
        ` : `
          <p class="text-xs text-slate-500">
            Người xử lý: ${escapeHTML(report.ApproverName || "Chưa xác định")}
          </p>
        `}
      </div>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}


async function handleEmployeeReportStatus(reportId, status) {
  let approvalNote = "";

  if (status === "Từ chối") {
    approvalNote = prompt("Nhập lý do từ chối báo cáo:");

    if (approvalNote === null) return;

    if (!approvalNote.trim()) {
      alert("Vui lòng nhập lý do từ chối.");
      return;
    }
  } else {
    const confirmed = confirm("Bạn có chắc chắn muốn duyệt báo cáo này?");
    if (!confirmed) return;

    approvalNote = "Báo cáo hợp lệ, đã được chủ cửa hàng kiểm tra.";
  }

  // Lấy ID chủ cửa hàng đang đăng nhập
const user = getCurrentUser();

const approvedBy = Number(user?.employeeId);

if (!Number.isInteger(approvedBy) || approvedBy <= 0) {
  alert("Không xác định được EmployeeID của người duyệt.");
  return;
}

  try {
    const response = await fetch(
      `/api/employee-reports/${reportId}/status`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status,
          approvalNote,
          approvedBy: approvedBy
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Không thể xử lý báo cáo.");
    }

    alert(result.message);

    // Tải lại danh sách từ SQL Server
    await loadEmployeeReports();

  } catch (error) {
    console.error("Lỗi xử lý báo cáo:", error);
    alert(error.message || "Không thể kết nối máy chủ.");
  }
}


function renderReportsSection() {
  const reports = getInventoryReports();
  const container = document.getElementById("reports-container");
  if (!container) return;

  if (reports.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-400">
        <i data-lucide="inbox" class="w-10 h-10 mx-auto text-slate-300 mb-2"></i>
        <p class="font-bold text-slate-700">Chưa có báo cáo kiểm kê nào được gửi từ nhân viên</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = reports.map(report => {
    const isPending = report.status === "Chờ duyệt";

    return `
      <div class="bg-white rounded-3xl border ${isPending ? 'border-amber-300 shadow-md' : 'border-slate-200 shadow-xs'} p-5 space-y-4 transition">
        
        <!-- Report Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full font-mono font-bold text-xs ${
                isPending ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse' : 'bg-emerald-100 text-emerald-800'
              }">
                ● ${report.status}
              </span>
              <h3 class="font-black text-sm text-slate-900 font-mono">${report.id}</h3>
              <span class="text-xs text-slate-400">• ${report.submittedAt}</span>
            </div>
            <p class="text-xs text-slate-600">
              Nhân viên gửi: <strong class="text-slate-800">${report.reporterName}</strong> (Mã NV: <span class="font-mono">${report.reporterId}</span>)
            </p>
          </div>

          <!-- Action Button for Store Owner: Approve Report -->
          <div>
            ${isPending ? `
              <button 
                onclick="approveReport('${report.id}')" 
                class="px-4 py-2 rounded-xl bg-[#005A2B] hover:bg-[#0B6A36] text-[#FFD700] font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <i data-lucide="check-check" class="w-4 h-4"></i>
                <span>DUYỆT BÁO CÁO NÀY</span>
              </button>
            ` : `
              <span class="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold inline-flex items-center gap-1.5">
                <i data-lucide="shield-check" class="w-4 h-4 text-emerald-600"></i>
                <span>Đã phê duyệt (Được quyền Giảm giá & Trả hàng)</span>
              </span>
            `}
          </div>
        </div>

        <!-- Staff Note -->
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700">
          <span class="font-bold text-slate-900 block mb-0.5">Lời nhắn từ nhân viên:</span>
          <p class="italic">"${report.note || 'Không có ghi chú thêm.'}"</p>
        </div>

        <!-- Table of reported products -->
        <div>
          <p class="font-bold text-xs text-slate-800 mb-2 uppercase">
            Danh sách hàng hóa cần can thiệp (${report.items?.length || 0} sản phẩm):
          </p>
          
          <div class="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <table class="w-full text-left text-xs border-collapse">
              <thead class="bg-slate-50 text-[11px] font-bold text-slate-500 border-b border-slate-200">
                <tr>
                  <th class="p-3">Sản phẩm & Lô</th>
                  <th class="p-3">Tồn kho</th>
                  <th class="p-3">Hạn sử dụng</th>
                  <th class="p-3">Tình trạng rủi ro</th>
                  <th class="p-3 text-center">Thao tác sau duyệt</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${report.items.map(item => `
                  <tr class="hover:bg-slate-50">
                    <td class="p-3">
                      <span class="font-bold text-slate-900 block">${item.name}</span>
                      <span class="text-[10px] text-slate-400 font-mono">#${item.barcode} • Lô: ${item.batchCode}</span>
                      <div class="flex flex-wrap items-center gap-1.5 mt-1">
                        ${item.appliedDiscount ? `<span class="px-2 py-0.5 rounded-md bg-emerald-100 text-[#005A2B] font-black text-[10px] border border-emerald-300">Đã giảm -${item.appliedDiscount}% (${formatVND(item.newPrice || 0)})</span>` : ''}
                        ${item.returnedQty ? `<span class="px-2 py-0.5 rounded-md bg-red-100 text-red-700 font-black text-[10px] border border-red-300">Đã trả NCC: ${item.returnedQty} cái</span>` : ''}
                      </div>
                    </td>
                    <td class="p-3 font-bold ${item.stock <= (item.minStockAlert || 5) ? 'text-red-600' : 'text-slate-800'}">
                      ${item.stock} cái
                    </td>
                    <td class="p-3 font-mono text-slate-700">
                      ${item.expiryDate} 
                      <span class="font-bold ${item.daysLeft <= 1 ? 'text-red-600' : 'text-amber-600'}">(${item.daysLeft}d)</span>
                    </td>
                    <td class="p-3">
                      <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        item.daysLeft <= 1 ? 'bg-red-100 text-red-700 border border-red-200' :
                        item.daysLeft <= 7 ? 'bg-amber-100 text-amber-800' : 'bg-orange-100 text-orange-800'
                      }">
                        ${item.type}
                      </span>
                    </td>
                    <td class="p-3 text-center whitespace-nowrap">
                      ${!isPending ? `
                        <div class="flex items-center justify-center gap-1.5 flex-nowrap whitespace-nowrap">
                          <!-- Khi chủ duyệt thì sẽ được giảm giá -->
                          <button 
                            onclick="quickSetDiscountFromReport('${item.id}')" 
                            class="px-2.5 py-1.5 rounded-xl bg-[#005A2B] hover:bg-[#0B6A36] text-[#FFD700] font-black text-[11px] shadow-2xs transition inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                            title="Chủ cửa hàng thiết lập % giảm giá xả hàng"
                          >
                            <i data-lucide="tag" class="w-3 h-3 shrink-0"></i>
                            <span>Giảm giá</span>
                          </button>
                          
                          <!-- Khi chủ duyệt thì sẽ được trả hàng -->
                          <button 
                            onclick="openReturnBatchModal('${item.id}')" 
                            class="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-black text-[11px] transition inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                            title="Xuất trả lô hàng cho Nhà cung cấp"
                          >
                            <i data-lucide="undo-2" class="w-3 h-3 text-red-600 shrink-0"></i>
                            <span>Trả hàng</span>
                          </button>
                        </div>
                      ` : `
                        <span class="text-[11px] text-slate-400 italic whitespace-nowrap">Vui lòng bấm duyệt báo cáo trước</span>
                      `}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function approveReport(reportId) {
  const reports = getInventoryReports();
  const report = reports.find(r => r.id === reportId);
  if (!report) return;

  report.status = "Đã duyệt";
  saveInventoryReports(reports);
  renderReportsSection();
  checkPendingReportsNotification();
  showToast(`Đã duyệt báo cáo ${reportId} thành công!\nHiện tại bạn có thể bấm trực tiếp các nút "Giảm giá" và "Trả hàng" cho từng món trong báo cáo.`, "success");
}

let currentDiscountProduct = null;

function quickSetDiscountFromReport(productId) {
  const products = getProducts();
  const p = products.find(prod => prod.id === productId);
  if (!p) {
    showToast("Không tìm thấy sản phẩm này trong danh mục kho!", "error");
    return;
  }

  currentDiscountProduct = p;
  const currentPercent = p.price < p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : 30;

  document.getElementById("discount-modal-prod-id").value = p.id;
  document.getElementById("discount-modal-product-name").innerText = p.name;
  document.getElementById("discount-modal-original-price").innerText = formatVND(p.originalPrice);
  document.getElementById("discount-modal-percent").value = currentPercent;
  updateReportDiscountPreview();

  const modal = document.getElementById("report-discount-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  if (window.lucide) lucide.createIcons();

  showToast(`🏷️ Đang mở bảng thiết lập % giảm giá cho "${p.name}". Chọn mức % và bấm "Xác Nhận Giảm Giá".`, "info");
}

function setReportDiscountRate(percent) {
  const input = document.getElementById("discount-modal-percent");
  if (input) {
    input.value = percent;
    updateReportDiscountPreview();
  }
}

function updateReportDiscountPreview() {
  if (!currentDiscountProduct) return;
  const percent = Number(document.getElementById("discount-modal-percent")?.value) || 0;
  const clamped = Math.min(99, Math.max(0, percent));
  const newPrice = Math.round(currentDiscountProduct.originalPrice * (1 - clamped / 100));
  const newPriceEl = document.getElementById("discount-modal-new-price");
  if (newPriceEl) {
    newPriceEl.innerText = `${formatVND(newPrice)} (-${clamped}%)`;
  }
}

function closeReportDiscountModal() {
  const modal = document.getElementById("report-discount-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  currentDiscountProduct = null;
}

function confirmReportDiscount() {
  const prodId = document.getElementById("discount-modal-prod-id").value;
  const percent = Number(document.getElementById("discount-modal-percent").value);

  if (isNaN(percent) || percent <= 0 || percent >= 100) {
    showToast("Phần trăm giảm giá không hợp lệ! Vui lòng nhập số từ 1% đến 99%.", "warning");
    return;
  }

  const products = getProducts();
  const p = products.find(prod => prod.id === prodId);
  if (!p) return;

  p.price = Math.round(p.originalPrice * (1 - percent / 100));
  saveProducts(products);

  // Đồng bộ trạng thái đã giảm giá vào báo cáo nhân viên
  const reports = getInventoryReports();
  reports.forEach(r => {
    if (Array.isArray(r.items)) {
      r.items.forEach(it => {
        if (it.id === prodId) {
          it.appliedDiscount = percent;
          it.newPrice = p.price;
        }
      });
    }
  });
  saveInventoryReports(reports);

  closeReportDiscountModal();
  renderReportsSection();
  renderFefoAlerts();
  renderProductsTable();

  showToast(`✅ ĐÃ ÁP DỤNG GIẢM GIÁ -${percent}% THÀNH CÔNG!\n• Sản phẩm: ${p.name}\n• Giá gốc: ${formatVND(p.originalPrice)} → Giá xả hàng mới: ${formatVND(p.price)}`, "success");
}

// ==========================================
// 8. CẤU HÌNH TÀI KHOẢN NGÂN HÀNG & VÍ HỘ KINH DOANH
// (Dành riêng cho Chủ cửa hàng)
// ==========================================

async function renderPaymentSettingsSection() {
  const config = await loadPaymentConfigFromAPI();

  const bankCodeEl = document.getElementById("cfg-bank-code");
  const bankNameEl = document.getElementById("cfg-bank-name");
  const accNumEl = document.getElementById("cfg-account-number");
  const accNameEl = document.getElementById("cfg-account-name");
  const momoPhoneEl = document.getElementById("cfg-momo-phone");
  const momoNameEl = document.getElementById("cfg-momo-name");
  const zalopayPhoneEl = document.getElementById("cfg-zalopay-phone");
  const zalopayNameEl = document.getElementById("cfg-zalopay-name");

  if (bankCodeEl) bankCodeEl.value = config.bankCode || "VCB";
  if (bankNameEl) bankNameEl.value = config.bankName || "Vietcombank";
  if (accNumEl) accNumEl.value = config.accountNumber || "";
  if (accNameEl) accNameEl.value = config.accountName || "";
  if (momoPhoneEl) momoPhoneEl.value = config.momoPhone || "";
  if (momoNameEl) momoNameEl.value = config.momoName || "";
  if (zalopayPhoneEl) zalopayPhoneEl.value = config.zalopayPhone || "";
  if (zalopayNameEl) zalopayNameEl.value = config.zalopayName || "";

  updateLiveDashboardQrPreview();
}


function updateBankNameText(selectEl) {
  const selectedOption = selectEl.options[selectEl.selectedIndex];
  const bankName = selectedOption.getAttribute("data-name") || selectedOption.text;
  document.getElementById("cfg-bank-name").value = bankName;
  updateLiveDashboardQrPreview();
}

function updateLiveDashboardQrPreview() {
  const bankCode = document.getElementById("cfg-bank-code")?.value || "VCB";
  const accNum = document.getElementById("cfg-account-number")?.value || "0071008899668";
  const accName = document.getElementById("cfg-account-name")?.value || "HỘ KINH DOANH CỬA HÀNG EMART - NGUYỄN VĂN AN";
  const bankSelect = document.getElementById("cfg-bank-code");
  const bankName = bankSelect?.options[bankSelect.selectedIndex]?.text || "Vietcombank";

  const qrUrl = `https://api.vietqr.io/image/${bankCode}-${accNum}-compact2.png?amount=50000&addInfo=EMART%20POS&accountName=${encodeURIComponent(accName)}`;

  const imgEl = document.getElementById("dashboard-qr-preview");
  if (imgEl) imgEl.src = qrUrl;

  const prevName = document.getElementById("preview-acc-name");
  const prevNum = document.getElementById("preview-acc-num");
  const prevBank = document.getElementById("preview-bank");

  if (prevName) prevName.innerText = accName;
  if (prevNum) prevNum.innerText = accNum;
  if (prevBank) prevBank.innerText = bankName;
}


async function savePaymentSettingsFromDashboard(e) {
  e.preventDefault();

  const bankCode = document.getElementById("cfg-bank-code").value;
  const bankSelect = document.getElementById("cfg-bank-code");

  const bankName =
    bankSelect.options[bankSelect.selectedIndex].getAttribute("data-name")
    || bankSelect.options[bankSelect.selectedIndex].text;

  const accountNumber = document.getElementById("cfg-account-number").value.trim();
  const accountName = document.getElementById("cfg-account-name").value.trim();
  const momoPhone = document.getElementById("cfg-momo-phone").value.trim();
  const momoName = document.getElementById("cfg-momo-name").value.trim();
  const zalopayPhone = document.getElementById("cfg-zalopay-phone").value.trim();
  const zalopayName = document.getElementById("cfg-zalopay-name").value.trim();

  const newConfig = {
    bankCode,
    bankName,
    accountNumber,
    accountName,
    momoPhone,
    momoName,
    zalopayPhone,
    zalopayName
  };

  try {
    await savePaymentConfig(newConfig);

    updateLiveDashboardQrPreview();

    showToast(
      `Đã lưu cấu hình tài khoản Hộ Kinh Doanh thành công!\n
      Ngân hàng: ${bankName}\n
      Số TK: ${accountNumber}\n
      Chủ HKD: ${accountName}\n
      Dữ liệu đã được lưu vào SQL Server.`,
      "success"
    );

  } catch (error) {
    console.error("Lỗi lưu cấu hình:", error);

    showToast(
      error.message || "Không thể lưu cấu hình thanh toán!",
      "error"
    );
  }
}

// ==========================================
// 9. BÁO CÁO KẾT CA, KIỂM KÉT & TỒN KHO (LỌC TẤT CẢ / NGÀY / THÁNG / NĂM & XUẤT EXCEL)
// ==========================================
let currentShiftReportToConfirm = null;
let currentShiftFilterMode = "all"; // 'all' | 'day' | 'month' | 'year'

function extractShiftReportDateParts(r) {
  if (r.dateISO && /^\d{4}-\d{2}-\d{2}$/.test(r.dateISO)) {
    return {
      isoDate: r.dateISO,
      yearMonth: r.dateISO.slice(0, 7),
      year: r.dateISO.slice(0, 4)
    };
  }
  const raw = r.date || r.timeSubmitted || "";
  const match = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return {
      isoDate: `${yyyy}-${mm}-${dd}`,
      yearMonth: `${yyyy}-${mm}`,
      year: yyyy
    };
  }
  return { isoDate: "", yearMonth: "", year: "" };
}

function setShiftFilterMode(mode) {
  currentShiftFilterMode = mode;
  const modes = ["all", "day", "month", "year"];
  modes.forEach(m => {
    const btn = document.getElementById(`shift-mode-${m}`);
    if (!btn) return;
    if (m === mode) {
      btn.className = "px-2.5 py-1.5 rounded-lg bg-[#005A2B] text-[#FFD700] text-xs font-extrabold transition cursor-pointer shadow-2xs";
    } else {
      btn.className = "px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 text-xs font-bold transition cursor-pointer";
    }
  });

  const dayWrap = document.getElementById("shift-filter-day-wrap");
  const monthWrap = document.getElementById("shift-filter-month-wrap");
  const yearWrap = document.getElementById("shift-filter-year-wrap");

  if (dayWrap) {
    dayWrap.classList.toggle("hidden", mode !== "day");
    dayWrap.classList.toggle("flex", mode === "day");
  }
  if (monthWrap) {
    monthWrap.classList.toggle("hidden", mode !== "month");
    monthWrap.classList.toggle("flex", mode === "month");
  }
  if (yearWrap) {
    yearWrap.classList.toggle("hidden", mode !== "year");
    yearWrap.classList.toggle("flex", mode === "year");
  }

  renderShiftReportsSection();
}

function clearShiftDateFilter() {
  setShiftFilterMode("all");
}

function getFilteredShiftReports() {
  const reports = getShiftReports();

  // Đồng bộ danh sách năm trong dropdown nếu có năm mới phát sinh
  const yearSelect = document.getElementById("shift-filter-year");
  if (yearSelect) {
    const existingYears = new Set(["2026", "2025", "2024"]);
    reports.forEach(r => {
      const { year } = extractShiftReportDateParts(r);
      if (year) existingYears.add(year);
    });
    const currentSelectedYear = yearSelect.value || "2026";
    const sortedYears = Array.from(existingYears).sort((a, b) => b.localeCompare(a));
    yearSelect.innerHTML = sortedYears.map(y => `<option value="${y}" ${y === currentSelectedYear ? "selected" : ""}>Năm ${y}</option>`).join("");
  }

  if (currentShiftFilterMode === "day") {
    const dayVal = document.getElementById("shift-filter-date")?.value || "";
    if (!dayVal) {
      return { filtered: reports, filterLabel: "Tất cả các ngày", fileSuffix: "Tat_Ca" };
    }
    const [yyyy, mm, dd] = dayVal.split("-");
    const vnDate = dd && mm && yyyy ? `${dd}/${mm}/${yyyy}` : dayVal;
    const filtered = reports.filter(r => extractShiftReportDateParts(r).isoDate === dayVal);
    return {
      filtered,
      filterLabel: `ngày ${vnDate}`,
      fileSuffix: `Ngay_${dayVal}`
    };
  }

  if (currentShiftFilterMode === "month") {
    const monthVal = document.getElementById("shift-filter-month")?.value || "";
    if (!monthVal) {
      return { filtered: reports, filterLabel: "Tất cả các tháng", fileSuffix: "Tat_Ca" };
    }
    const [yyyy, mm] = monthVal.split("-");
    const vnMonth = mm && yyyy ? `tháng ${mm}/${yyyy}` : monthVal;
    const filtered = reports.filter(r => extractShiftReportDateParts(r).yearMonth === monthVal);
    return {
      filtered,
      filterLabel: vnMonth,
      fileSuffix: `Thang_${monthVal}`
    };
  }

  if (currentShiftFilterMode === "year") {
    const yearVal = document.getElementById("shift-filter-year")?.value || "2026";
    const filtered = reports.filter(r => extractShiftReportDateParts(r).year === yearVal);
    return {
      filtered,
      filterLabel: `năm ${yearVal}`,
      fileSuffix: `Nam_${yearVal}`
    };
  }

  return {
    filtered: reports,
    filterLabel: "Tất cả thời gian",
    fileSuffix: "Tat_Ca"
  };
}

function exportFilteredShiftReportsToExcel() {
  const { filtered, filterLabel, fileSuffix } = getFilteredShiftReports();

  if (!filtered || filtered.length === 0) {
    showToast(`Không có báo cáo kết ca nào trong phạm vi lọc (${filterLabel}) để xuất file Excel!`, "warning");
    return;
  }

  const exportDateStr = getFormattedExportDateStr();

  const headers = [
    "STT",
    "Mã Báo Cáo",
    "Ngày Báo Cáo",
    "Giờ Nộp Báo Cáo",
    "Ca Làm Việc",
    "Mã Nhân Viên",
    "Thu Ngân Bàn Giao",
    "Tổng Số Đơn Hàng",
    "Tổng Doanh Thu (VND)",
    "Doanh Thu Tiền Mặt Bill (VND)",
    "Doanh Thu Chuyển Khoản QR (VND)",
    "Tiền Lẻ Đầu Ca (VND)",
    "Tiền Két Lý Thuyết (VND)",
    "Tiền Két Thực Tế Đếm Được (VND)",
    "Chênh Lệch Két (VND)",
    "Tình Trạng Kiểm Két",
    "SL Hàng Đã Bán",
    "Tồn Kho Cuối Ca",
    "Trạng Thái Xác Nhận",
    "Ghi Chú Bàn Giao"
  ];

  const dataRows = filtered.map((r, index) => [
    index + 1,
    r.id || "",
    r.date || r.dateISO || "",
    r.timeSubmitted || r.date || "",
    r.shiftName || "",
    r.cashierId || "",
    r.cashierName || "",
    Number(r.totalOrders || 0),
    Number(r.totalRevenue || 0),
    Number(r.systemCash || 0),
    Number(r.systemTransfer || 0),
    Number(r.initialDrawerCash || 0),
    Number(r.expectedDrawerCash || 0),
    Number(r.actualDrawerCash || 0),
    Number(r.cashDifference || 0),
    r.differenceStatus || ((r.cashDifference || 0) === 0 ? "Khớp két 100%" : "Có chênh lệch"),
Number(r.totalSoldItems || 0),
Number(r.totalStockRemaining || 0),
    r.status || "",
    r.note || ""
  ]);

  // Dòng tổng cộng
  const sumOrders = filtered.reduce((s, r) => s + Number(r.totalOrders || 0), 0);
  const sumRev = filtered.reduce((s, r) => s + Number(r.totalRevenue || 0), 0);
  const sumCash = filtered.reduce((s, r) => s + Number(r.systemCash || 0), 0);
  const sumTransfer = filtered.reduce((s, r) => s + Number(r.systemTransfer || 0), 0);
  const sumActualDrawer = filtered.reduce((s, r) => s + Number(r.actualDrawerCash || 0), 0);
  const sumDiff = filtered.reduce((s, r) => s + Number(r.cashDifference || 0), 0);

  dataRows.push([
    "",
    `TỔNG CỘNG (${filtered.length} CA)`,
    filterLabel.toUpperCase(),
    "",
    "",
    "",
    "",
    sumOrders,
    sumRev,
    sumCash,
    sumTransfer,
    "",
    "",
    sumActualDrawer,
    sumDiff,
    sumDiff === 0 ? "Khớp két 100%" : `Chênh lệch: ${sumDiff}`,
    "",
    "",
    "",
    ""
  ]);

  // Hàng cuối ghi ngày xuất file
  dataRows.push([
    "",
    `Ngày xuất file: ${exportDateStr}`,
    `Phạm vi lọc: ${filterLabel}`,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    ""
  ]);

  const colWidths = [
    { wch: 7 },  // STT
    { wch: 28 }, // Mã Báo Cáo / Ngày xuất file
    { wch: 20 }, // Ngày Báo Cáo
    { wch: 18 }, // Giờ Nộp
    { wch: 24 }, // Ca Làm Việc
    { wch: 15 }, // Mã NV
    { wch: 20 }, // Thu Ngân
    { wch: 18 }, // Tổng Số Đơn
    { wch: 22 }, // Tổng Doanh Thu
    { wch: 26 }, // Tiền Mặt Bill
    { wch: 28 }, // Chuyển Khoản QR
    { wch: 20 }, // Tiền Lẻ Đầu Ca
    { wch: 22 }, // Két Lý Thuyết
    { wch: 26 }, // Két Thực Tế
    { wch: 20 }, // Chênh Lệch
    { wch: 20 }, // Tình Trạng
    { wch: 16 }, // SL Hàng Bán
    { wch: 16 }, // Tồn Kho
    { wch: 24 }, // Trạng Thái
    { wch: 45 }  // Ghi Chú
  ];

  const fileName = `Bao_Cao_Ket_Ca_Emart_${fileSuffix}.xlsx`;
  exportStyledExcelWorkbook({
    headers,
    dataRows,
    colWidths,
    sheetName: "BaoCaoKetCa",
    fileName
  });

  showToast(`📊 ĐÃ XUẤT FILE EXCEL THÀNH CÔNG!\n• Tên file: ${fileName}\n• Phạm vi lọc: ${filterLabel}\n• Số lượng: ${filtered.length} báo cáo kết ca\n• Ngày xuất file: ${exportDateStr}`, "success");
}

function checkPendingShiftReportsNotification() {
  const reports = getShiftReports();
  const pending = reports.filter(r => r.status === "Chờ chủ xác nhận");
  const headerBadge = document.getElementById("header-shift-alert-badge");
  const headerText = document.getElementById("header-shift-alert-text");
  const sidebarBadge = document.getElementById("sidebar-shift-badge");

  if (sidebarBadge) {
    if (reports.length > 0) {
      sidebarBadge.classList.remove("hidden");
      sidebarBadge.innerText = reports.length;
    } else {
      sidebarBadge.classList.add("hidden");
    }
  }

  if (pending.length > 0) {
    if (headerBadge) {
      headerBadge.classList.remove("hidden");
      if (headerText) headerText.innerText = `${pending.length} Báo cáo kết ca mới chờ duyệt!`;
    }
  } else {
    if (headerBadge) headerBadge.classList.add("hidden");
  }
}

function renderShiftReportsSection() {
  const { filtered, filterLabel } = getFilteredShiftReports();

  // Thống kê metrics cho phạm vi đang lọc
  let totalRev = 0;
  let totalOrders = 0;
  let totalCash = 0;
  let totalTransfer = 0;
  let allMatched = true;

  filtered.forEach(r => {
    totalRev += (r.totalRevenue || 0);
    totalOrders += (r.totalOrders || 0);
    totalCash += (r.actualDrawerCash || r.systemCash || 0);
    totalTransfer += (r.systemTransfer || 0);
    if ((r.cashDifference || 0) !== 0) {
      allMatched = false;
    }
  });

  document.getElementById("shift-summary-total-revenue").innerText = formatVND(totalRev);
  document.getElementById("shift-summary-orders").innerText = `${totalOrders} đơn bán • ${filtered.length} ca kết (${filterLabel})`;
  document.getElementById("shift-summary-cash").innerText = formatVND(totalCash);
  document.getElementById("shift-summary-transfer").innerText = formatVND(totalTransfer);

  const statusEl = document.getElementById("shift-summary-status");
  if (statusEl) {
    if (filtered.length === 0) {
      statusEl.className = "text-sm font-bold text-slate-400 mt-1";
      statusEl.innerText = "Chưa có báo cáo";
    } else if (allMatched) {
      statusEl.className = "text-base font-black text-emerald-700 mt-1";
      statusEl.innerText = "Khớp két 100%";
    } else {
      statusEl.className = "text-base font-black text-amber-600 mt-1";
      statusEl.innerText = "Có ca chênh lệch két";
    }
  }

  // Render bảng danh sách các báo cáo
  const tbody = document.getElementById("shift-reports-table-body");
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-8 text-center text-slate-400 text-xs">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
          <span>Không có báo cáo kết ca nào trong ${filterLabel}.</span>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const isPending = r.status === "Chờ chủ xác nhận";
    const isDiffZero = (r.cashDifference || 0) === 0;
    const diffText = isDiffZero ? "Khớp 100%" : (r.cashDifference > 0 ? `+${formatVND(r.cashDifference)}` : `${formatVND(r.cashDifference)}`);
    const diffBadge = isDiffZero 
      ? '<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Khớp két 100%</span>'
      : (r.cashDifference > 0 
        ? `<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">Thừa: ${diffText}</span>`
        : `<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">Thiếu: ${diffText}</span>`);

    return `
      <tr class="hover:bg-slate-50/80 transition">
        <td class="p-3">
          <span class="font-mono font-bold text-slate-900 block">${r.id}</span>
          <span class="text-[10px] text-slate-400 font-medium">${r.timeSubmitted || r.date}</span>
        </td>
        <td class="p-3 font-semibold text-slate-800">
          <span>${r.shiftName || 'Ca Sáng'}</span>
        </td>
        <td class="p-3">
          <div class="font-black text-slate-900">${r.cashierName || 'Trần Thị Mai'}</div>
          <span class="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-bold">${r.cashierId || 'st-02'}</span>
        </td>
        <td class="p-3 font-mono font-bold text-[#005A2B]">
          ${formatVND(r.systemCash || 0)}
        </td>
        <td class="p-3 font-mono font-bold text-blue-700">
          ${formatVND(r.systemTransfer || 0)}
        </td>
        <td class="p-3 font-mono font-black text-slate-900">
          ${formatVND(r.actualDrawerCash || 0)}
        </td>
        <td class="p-3">
          ${diffBadge}
        </td>
        <td class="p-3 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <button 
              onclick="openShiftDetailModal('${r.id}')" 
              class="px-2.5 py-1.5 rounded-xl ${isPending ? 'bg-amber-400 hover:bg-amber-500 text-slate-950 font-black animate-pulse' : 'bg-[#005A2B] hover:bg-[#0B6A36] text-white font-bold'} text-xs transition shadow-2xs flex items-center gap-1 cursor-pointer"
            >
              <i data-lucide="${isPending ? 'check-circle' : 'eye'}" class="w-3.5 h-3.5"></i>
              <span>${isPending ? 'Xem & Xác Nhận' : 'Xem Chi Tiết'}</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}


function openShiftDetailModal(reportId) {
  const reports = getShiftReports();
  const report = reports.find(r => r.id === reportId);

  if (!report) {
    showToast("Không tìm thấy báo cáo kết ca.", "error");
    return;
  }

  currentShiftReportToConfirm = report;

  document.getElementById("shift-detail-id").innerText = report.id || "--";
  document.getElementById("shift-detail-time").innerText =
    report.timeSubmitted || report.date || "--";

  document.getElementById("shift-detail-shift").innerText =
    report.shiftName || "--";

  document.getElementById("shift-detail-cashier").innerText =
    `${report.cashierName || "Không rõ"} (Mã NV: ${report.cashierId || "--"})`;

  document.getElementById("shift-detail-initial").innerText =
    formatVND(report.initialDrawerCash || 0);

  document.getElementById("shift-detail-cash-rev").innerText =
    formatVND(report.systemCash || 0);

  document.getElementById("shift-detail-expected").innerText =
    formatVND(report.expectedDrawerCash || 0);

  document.getElementById("shift-detail-actual").innerText =
    formatVND(report.actualDrawerCash || 0);

  const diffBadge = document.getElementById("shift-detail-diff-badge");

  if (diffBadge) {
    const difference = Number(report.cashDifference || 0);

    if (difference === 0) {
      diffBadge.className =
        "px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-300";
      diffBadge.innerText = "Khớp két 100% (0 ₫)";
    } else if (difference > 0) {
      diffBadge.className =
        "px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-amber-100 text-amber-900 border border-amber-300";
      diffBadge.innerText = `Thừa tiền: +${formatVND(difference)}`;
    } else {
      diffBadge.className =
        "px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-red-100 text-red-800 border border-red-300";
      diffBadge.innerText = `Thiếu tiền: ${formatVND(difference)}`;
    }
  }

  document.getElementById("shift-detail-transfer-rev").innerText =
    formatVND(report.systemTransfer || 0);

  // Inventory summary lấy trực tiếp từ SQL Server
  document.getElementById("shift-detail-sold-qty").innerText =
    `${report.totalSoldItems || 0} sản phẩm`;

  document.getElementById("shift-detail-remaining-stock").innerText =
    `${report.totalStockRemaining || 0} sản phẩm`;

  const itemsListEl = document.getElementById("shift-detail-items-list");

  if (itemsListEl) {
    itemsListEl.innerHTML =
      `<span class="text-slate-400 italic">Báo cáo SQL Server hiện chưa lưu chi tiết từng mặt hàng đã bán.</span>`;
  }

  document.getElementById("shift-detail-note").innerText =
    report.note || "Không có ghi chú.";

  // Status banner và nút xác nhận
  const statusBox = document.getElementById("shift-detail-status-box");
  const confirmContainer = document.getElementById("shift-detail-confirm-container");

  const isPending = report.status === "Chờ chủ xác nhận";

  if (isPending) {
    if (statusBox) {
      statusBox.className =
        "p-2.5 rounded-xl text-center text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200";
      statusBox.innerHTML =
        `<i data-lucide="clock" class="w-4 h-4 inline mr-1 text-amber-600"></i> Báo cáo mới nhận từ Thu ngân • Chờ Chủ shop xác nhận đối chiếu`;
    }

    if (confirmContainer) {
      confirmContainer.classList.remove("hidden");
    }
  } else {
    if (statusBox) {
      const isRejected = report.status === "Từ chối";

      statusBox.className = isRejected
        ? "p-2.5 rounded-xl text-center text-xs font-bold bg-red-50 text-red-800 border border-red-200"
        : "p-2.5 rounded-xl text-center text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200";

      statusBox.innerHTML = isRejected
        ? `<i data-lucide="x-circle" class="w-4 h-4 inline mr-1"></i> Báo cáo đã bị từ chối`
        : `<i data-lucide="check-check" class="w-4 h-4 inline mr-1 text-emerald-600"></i> Đã được Chủ cửa hàng xác nhận`;
    }

    if (confirmContainer) {
      confirmContainer.classList.add("hidden");
    }
  }

  const modal = document.getElementById("shift-detail-modal");

  modal.classList.remove("hidden");
  modal.classList.add("flex");

  if (window.lucide) {
    lucide.createIcons();
  }
}


function closeShiftDetailModal() {
  const modal = document.getElementById("shift-detail-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  currentShiftReportToConfirm = null;
}


async function confirmShiftReportOwner() {
  if (!currentShiftReportToConfirm) return;

  const report = currentShiftReportToConfirm;
  const currentUser = getCurrentUser();

  if (!currentUser || !currentUser.employeeId) {
    showToast("Không xác định được tài khoản chủ cửa hàng!", "error");
    return;
  }

  try {
    const response = await fetch(
      `/api/shift-reports/${report.reportId}/status`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: "Đã xác nhận",
          approvedBy: Number(currentUser.employeeId),
          approvalNote: "Chủ cửa hàng đã kiểm tra và xác nhận báo cáo kết ca."
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Không thể xác nhận báo cáo.");
    }

    await loadShiftReportsFromAPI();

    const updatedReport = getShiftReports().find(
      item => item.reportId === report.reportId
    );

    renderShiftReportsSection();
    checkPendingShiftReportsNotification();

    if (updatedReport) {
      openShiftDetailModal(updatedReport.id);
    }

    showToast(
      `Đã xác nhận báo cáo kết ca ${report.id} thành công!`,
      "success"
    );

  } catch (error) {
    console.error("Lỗi xác nhận báo cáo:", error);
    showToast(error.message || "Lỗi khi xác nhận báo cáo!", "error");
  }
}

async function rejectShiftReportOwner() {
  if (!currentShiftReportToConfirm) return;

  const report = currentShiftReportToConfirm;
  const currentUser = getCurrentUser();

  if (!currentUser || !currentUser.employeeId) {
    showToast("Không xác định được tài khoản chủ cửa hàng!", "error");
    return;
  }

  // Yêu cầu nhập lý do từ chối
  const reason = prompt("Vui lòng nhập lý do từ chối báo cáo kết ca:");

  if (reason === null) return;

  if (!reason.trim()) {
    showToast("Bạn phải nhập lý do từ chối báo cáo!", "warning");
    return;
  }

  try {
    const response = await fetch(
      `/api/shift-reports/${report.reportId}/status`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: "Từ chối",
          approvedBy: Number(currentUser.employeeId),
          approvalNote: reason.trim()
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Không thể từ chối báo cáo.");
    }

    await loadShiftReportsFromAPI();

    const updatedReport = getShiftReports().find(
      item => item.reportId === report.reportId
    );

    renderShiftReportsSection();
    checkPendingShiftReportsNotification();

    if (updatedReport) {
      openShiftDetailModal(updatedReport.id);
    }

    showToast(
      `Đã từ chối báo cáo kết ca ${report.id}.`,
      "success"
    );

  } catch (error) {
    console.error("Lỗi từ chối báo cáo:", error);
    showToast(error.message || "Lỗi khi từ chối báo cáo!", "error");
  }
}


updateFefoControlDate();

// ================= BACKUP & RESTORE =================


// Hiển thị thông báo Backup
function showBackupMessage(message, type = "success") {
  const messageEl = document.getElementById("backup-message");
  if (!messageEl) return;

  messageEl.textContent = message;
  messageEl.className = "p-3 rounded-xl text-xs font-bold";

  if (type === "success") {
    messageEl.classList.add(
      "bg-emerald-50", "text-emerald-700",
      "border", "border-emerald-200"
    );
  } else if (type === "info") {
    messageEl.classList.add(
      "bg-blue-50", "text-blue-700",
      "border", "border-blue-200"
    );
  } else {
    messageEl.classList.add(
      "bg-red-50", "text-red-700",
      "border", "border-red-200"
    );
  }

  messageEl.classList.remove("hidden");
}


// Tải danh sách bản Backup
async function loadStorePOSBackups() {
  const tableBody = document.getElementById("backup-table-body");
  if (!tableBody) return;

  tableBody.innerHTML = `
    <tr>
      <td colspan="5" class="p-5 text-center text-slate-400">
        Đang tải danh sách Backup...
      </td>
    </tr>
  `;

  try {
    const response = await fetch("/api/backup");
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Không thể tải danh sách Backup.");
    }

    if (!result.data || result.data.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="p-5 text-center text-slate-400">
            Chưa có bản Backup nào.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = result.data.map(file => {
      const date = new Date(file.createdAt).toLocaleString("vi-VN");
      const size = (file.size / 1024 / 1024).toFixed(2) + " MB";
      const safeFileName = escapeBackupText(file.fileName);
      const isSafetyBackup = file.fileName.startsWith("StorePOS_BeforeRestore_");
      const restoreLabel = isSafetyBackup
  ? "Khôi phục (Bản dự phòng)"
  : "Khôi phục";

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50">
          <td class="p-3 font-bold text-slate-800">${safeFileName}</td>
          <td class="p-3 text-slate-600">${date}</td>
          <td class="p-3 text-slate-600">${size}</td>

          <td class="p-3 text-center">
            <button
              type="button"
              onclick="verifyStorePOSBackup('${safeFileName}')"
              class="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold">
              Kiểm tra
            </button>
          </td>

          <td class="p-3 text-center">
           
<button
  type="button"
  data-restore-file="${safeFileName}"
  disabled
  class="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-400 font-bold cursor-not-allowed opacity-80">
  <i data-lucide="lock" class="w-3 h-3 inline"></i>
  Khôi phục đang khóa
</button>

          </td>
        </tr>
      `;
    }).join("");

  } catch (error) {
    console.error("Lỗi tải danh sách Backup:", error);

    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="p-5 text-center text-red-500">
          ${escapeBackupText(error.message)}
        </td>
      </tr>
    `;
  }
}

// Tránh chèn nội dung không an toàn vào HTML
function escapeBackupText(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// Tạo bản Backup mới
async function createStorePOSBackup() {
  const confirmed = confirm(
    "Bạn có chắc chắn muốn sao lưu toàn bộ database StorePOS vào USB không?"
  );

  if (!confirmed) return;

  try {
    showBackupMessage("Đang tạo bản Backup, vui lòng chờ...");

    const response = await fetch("/api/backup/create", {
      method: "POST"
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Tạo Backup thất bại.");
    }

    showBackupMessage(result.message || "Tạo Backup thành công!");

    await loadStorePOSBackups();

  } catch (error) {
    console.error("Lỗi tạo Backup:", error);
    showBackupMessage(error.message, "error");
  }
}

// Kiểm tra tính hợp lệ của bản Backup
async function verifyStorePOSBackup(fileName) {
  try {
    showBackupMessage(`Đang kiểm tra file ${fileName}...`);

    const response = await fetch("/api/backup/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fileName })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Kiểm tra Backup thất bại.");
    }

    showBackupMessage(`${fileName}: ${result.message}`);

  } catch (error) {
    console.error("Lỗi kiểm tra Backup:", error);
    showBackupMessage(error.message, "error");
  }
}

// Khôi phục database từ file Backup

async function restoreStorePOSBackup(fileName) {

  const isSafetyBackup = fileName.startsWith("StorePOS_BeforeRestore_");

  const warningMessage = isSafetyBackup
    ? `ĐÂY LÀ BẢN BACKUP DỰ PHÒNG!\n\nFile: ${fileName}\n\nNếu tiếp tục, dữ liệu hiện tại trong database StorePOS sẽ bị thay thế bằng dữ liệu trong file này.\n\nHãy chắc chắn rằng bạn muốn thực hiện thao tác này.`
    : `CẢNH BÁO: KHÔI PHỤC DATABASE THẬT!\n\nFile: ${fileName}\n\nNếu tiếp tục, toàn bộ dữ liệu hiện tại trong database StorePOS sẽ bị thay thế.\n\nHãy chắc chắn rằng bạn muốn thực hiện thao tác này.`;

  const confirmed = confirm(warningMessage);

  if (!confirmed) return;

  const restoreButtons = document.querySelectorAll("[data-restore-file]");

  const currentButton = Array.from(restoreButtons).find(
    button => button.dataset.restoreFile === fileName
  );

  restoreButtons.forEach(button => {
    button.disabled = true;
    button.classList.add("opacity-50", "cursor-not-allowed");
  });

  if (currentButton) {
    currentButton.textContent = "ĐANG KHÔI PHỤC...";
  }

  try {
    showBackupMessage("Đang khôi phục dữ liệu, vui lòng chờ...", "info");

    const response = await fetch("/api/backup/restore", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fileName: fileName,
        confirmRestore: true
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Khôi phục dữ liệu thất bại.");
    }

    showBackupMessage(
      `Khôi phục thành công! Database: ${result.data.database}. Bản dự phòng: ${result.data.safetyBackupFileName}`,
      "success"
    );

  } catch (error) {
    console.error("Lỗi khôi phục Backup:", error);
    showBackupMessage(error.message, "error");

  } finally {
    restoreButtons.forEach(button => {
      button.disabled = false;
      button.classList.remove("opacity-50", "cursor-not-allowed");

      const isSafety = button.dataset.restoreFile.startsWith(
        "StorePOS_BeforeRestore_"
      );

      button.textContent = isSafety
        ? "Khôi phục (Bản dự phòng)"
        : "Khôi phục";
    });

    await loadStorePOSBackups();
  }
}
