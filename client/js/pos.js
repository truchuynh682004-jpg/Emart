/**
 * Emart POS Checkout Logic (Pure Vanilla JS)
 * Đầy đủ tính năng cho Nhân viên thu ngân:
 * 1. Thêm khách hàng thân thiết mới ngay tại quầy POS.
 * 2. Tổng hợp sản phẩm sắp hết date (FEFO) & tồn kho gửi báo cáo lên Chủ shop duyệt.
 * 3. Thanh toán hiển thị rõ thuế VAT 8% (cả trên giỏ, modal và hóa đơn).
 * 4. Quét mã VietQR chuyển thẳng về tài khoản Hộ Kinh Doanh của Chủ cửa hàng.
 * 5. Quét mã Momo / ZaloPay hiển thị mã thanh toán và thông tin Hộ Kinh Doanh.
 * 6. In hóa đơn bán lẻ: Chỉ để lại Mã nhân viên (Mã NV), KHÔNG ĐỂ TÊN NHÂN VIÊN.
 */

let cart = [];
let selectedCategory = "all";
let currentCustomer = null;
let usePoints = false;
let currentPayMethod = "Tiền mặt";
let currentEwallet = "momo";
let tempReportItems = [];

// Lấy danh sách hóa đơn thuộc ca hiện tại
function getCurrentShiftInvoices() {
  const user = getCurrentUser();

  if (!user || !user.shiftStartedAt) {
    return [];
  }

  const shiftStartTime = new Date(user.shiftStartedAt).getTime();

  return getInvoices().filter(invoice => {
    const invoiceTime = new Date(invoice.createdAt).getTime();

    return !Number.isNaN(invoiceTime) &&
           invoiceTime >= shiftStartTime;
  });
}

// Audio beep sound using Web Audio API
function playBeep(type = "success") {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "success") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === "pay") {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    // Audio might be blocked until user interacts
  }
}

// ==========================================
// 1. RENDER PRODUCTS GRID
// ==========================================
//function renderProducts() {
 // const products = getProducts();
 async function renderProducts() {
  let products;

  try {
    products = await loadProductsFromAPI();
  } catch (error) {
    showToast("Không thể tải sản phẩm từ SQL Server!", "error");
    return;
  }
  const search = document.getElementById("search-input")?.value.trim().toLowerCase() || "";
  const grid = document.getElementById("pos-products-grid");
  if (!grid) return;

  const filtered = products.filter(p => {
    const matchCat = selectedCategory === "all" || p.category === selectedCategory;
    const matchSearch = p.name.toLowerCase().includes(search) || p.barcode.includes(search);
    return matchCat && matchSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400">
        <i data-lucide="package-search" class="w-10 h-10 mx-auto mb-2 opacity-50"></i>
        <p class="font-bold text-sm">Không tìm thấy sản phẩm phù hợp</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const daysLeft = getDaysUntilExpiry(p.expiryDate);
    let fefoTag = "";
    if (daysLeft <= 1) {
      fefoTag = `<span class="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-red-600 text-white font-extrabold text-[10px] shadow-xs">Cận date (${daysLeft}d)</span>`;
    } else if (daysLeft <= 7) {
      fefoTag = `<span class="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px] shadow-xs">Hạn ${daysLeft}d</span>`;
    }

    const isOutOfStock = p.stock <= 0;

    return `
      <div 
        onclick="${isOutOfStock ? '' : `addToCart('${p.id}')`}"
        class="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col justify-between transition cursor-pointer select-none relative group hover:border-[#005A2B] hover:shadow-md h-full ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}"
      >
        <div>
          <div class="pos-product-img-wrapper mb-2">
            <img src="${p.image}" alt="${p.name}">
            ${fefoTag}
            ${p.price < p.originalPrice ? `
              <span class="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-red-500 text-white font-bold text-[10px]">
                -${Math.round((1 - p.price / p.originalPrice) * 100)}%
              </span>
            ` : ''}
          </div>
          <p class="text-[10px] font-mono text-slate-400">#${p.barcode}</p>
          <h4 class="font-bold text-xs text-slate-800 line-clamp-2 h-9 mt-0.5 leading-snug">${p.name}</h4>
        </div>

        <div class="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span class="font-black text-xs sm:text-sm text-[#005A2B]">${formatVND(p.price)}</span>
            ${p.price < p.originalPrice ? `<span class="text-[10px] text-slate-400 line-through block">${formatVND(p.originalPrice)}</span>` : ''}
          </div>
          <span class="text-[10px] font-bold ${p.stock <= (p.minStockAlert || 5) ? 'text-red-500' : 'text-slate-500'}">
            Kho: ${p.stock}
          </span>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Add to Cart
function addToCart(productId) {
  const products = getProducts();
  const product = products.find(p => p.id === productId);
  if (!product) return;

  if (product.stock <= 0) {
    showToast("Sản phẩm đã hết hàng trong kho!", "warning");
    return;
  }

  const existing = cart.find(item => item.product.id === productId);
  if (existing) {
    if (existing.quantity >= product.stock) {
      showToast(`Số lượng trong kho chỉ còn ${product.stock} sản phẩm!`, "warning");
      return;
    }
    existing.quantity += 1;
  } else {
    cart.push({ product, quantity: 1 });
  }

  playBeep("success");
  renderCart();
}

function updateQuantity(productId, delta) {
  const item = cart.find(i => i.product.id === productId);
  if (!item) return;

  if (delta > 0 && item.quantity >= item.product.stock) {
    showToast(`Số lượng trong kho chỉ còn ${item.product.stock} sản phẩm!`, "warning");
    return;
  }

  item.quantity += delta;
  if (item.quantity <= 0) {
    cart = cart.filter(i => i.product.id !== productId);
  }

  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.product.id !== productId);
  renderCart();
}

function clearCart() {
  if (cart.length === 0) return;
  if (confirm("Bạn có chắc muốn hủy đơn hàng hiện tại?")) {
    cart = [];
    currentCustomer = null;
    usePoints = false;
    renderCart();
  }
}

// ==========================================
// 2. TÍNH TOÁN HÓA ĐƠN & THUẾ VAT 8% RÕ RÀNG
// ==========================================
function calculateTotals() {
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  
  let memberDiscount = 0;
  if (currentCustomer && usePoints) {
    const maxDiscount = subtotal * 0.5;
    const pointValue = currentCustomer.points * 1; // 1 điểm = 1 đồng
    memberDiscount = Math.min(pointValue, maxDiscount);
  }

  const taxableAmount = Math.max(0, subtotal - memberDiscount);
  const vat = Math.round(taxableAmount * 0.08); // Thuế VAT 8% ghi rõ
  const total = taxableAmount + vat;

  return { subtotal, memberDiscount, vat, total };
}

function renderCart() {
  const cartList = document.getElementById("pos-cart-list");
  const cartCount = document.getElementById("pos-cart-count");
  if (!cartList) return;

  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (cartCount) cartCount.innerText = totalQty;

  if (cart.length === 0) {
    cartList.innerHTML = `
      <div class="h-64 flex flex-col items-center justify-center text-slate-400 text-center p-6">
        <div class="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <i data-lucide="shopping-bag" class="w-7 h-7 text-slate-300"></i>
        </div>
        <p class="font-bold text-sm text-slate-600">Giỏ hàng đang trống</p>
        <p class="text-xs text-slate-400 mt-1">Chọn sản phẩm bên trái hoặc quét mã vạch barcode (F2)</p>
      </div>
    `;
  } else {
    cartList.innerHTML = cart.map(item => `
      <div class="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-xs">
        <div class="min-w-0 flex-1">
          <h5 class="font-bold text-xs text-slate-800 truncate">${item.product.name}</h5>
          <p class="text-[11px] text-[#005A2B] font-black">${formatVND(item.product.price)}</p>
        </div>
        
        <div class="flex items-center gap-1.5 shrink-0">
          <button onclick="updateQuantity('${item.product.id}', -1)" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition">
            -
          </button>
          <span class="w-6 text-center font-bold text-xs">${item.quantity}</span>
          <button onclick="updateQuantity('${item.product.id}', 1)" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition">
            +
          </button>
          <button onclick="removeFromCart('${item.product.id}')" class="w-7 h-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition ml-1" title="Xóa">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  // Update Summary UI (Ghi rõ cả VAT 8%)
  const { subtotal, memberDiscount, vat, total } = calculateTotals();
  document.getElementById("summary-subtotal").innerText = formatVND(subtotal);
  document.getElementById("summary-discount").innerText = formatVND(memberDiscount);
  document.getElementById("summary-vat").innerText = formatVND(vat);
  document.getElementById("summary-total").innerText = formatVND(total);

  const checkoutBtn = document.getElementById("btn-checkout");
  if (checkoutBtn) {
    checkoutBtn.disabled = cart.length === 0;
  }

  if (window.lucide) lucide.createIcons();
}

// ==========================================
// 3. CRM KHÁCH HÀNG THÂN THIẾT (Tra cứu & Thêm khách mới tại POS)
// ==========================================

async function lookupCustomer() {
  const phoneInput = document.getElementById("crm-phone-input");
  const phone = phoneInput ? phoneInput.value.trim() : "";
  const infoBox = document.getElementById("crm-customer-info");

  if (!phone) {
    showToast("Vui lòng nhập số điện thoại khách hàng!", "warning");
    return;
  }

  try {
    // Lấy danh sách khách hàng từ SQL Server
    const response = await fetch("/api/customers");
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Không thể tải danh sách khách hàng");
    }

    // Tìm khách hàng theo số điện thoại
    const cust = result.data.find(c => c.Phone === phone);

    if (!cust) {
      showToast("Không tìm thấy hội viên!", "info");
      currentCustomer = null;
      usePoints = false;
      infoBox.classList.add("hidden");
      renderCart();
      return;
    }

    // Tính hạng thành viên
    const totalSpent = Number(cust.TotalSpent) || 0;

    let tier = "Đồng";
    if (totalSpent >= 5000000) tier = "Kim Cương";
    else if (totalSpent >= 2000000) tier = "Vàng";
    else if (totalSpent >= 500000) tier = "Bạc";

    // Lưu thông tin khách hàng đang mua hàng
    currentCustomer = {
      id: cust.CustomerID,
      code: cust.CustomerCode,
      phone: cust.Phone,
      name: cust.FullName,
      points: Number(cust.AvailablePoints) || 0,
      totalSpent: totalSpent,
      tier: tier
    };

    usePoints = false;

    infoBox.classList.remove("hidden");
    infoBox.innerHTML = `
      <div class="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs flex items-center justify-between">
        <div>
          <p class="font-bold text-amber-900">${cust.FullName} (${tier})</p>
          <p class="text-[11px] text-amber-700">
            Điểm khả dụng:
            <strong>${currentCustomer.points.toLocaleString("vi-VN")} điểm</strong>
            (= ${formatVND(currentCustomer.points)})
          </p>
        </div>
        <label class="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-amber-900">
          <input type="checkbox" id="chk-use-points"
            onchange="toggleUsePoints(this.checked)"
            class="rounded text-[#005A2B] focus:ring-0">
          <span>Dùng điểm</span>
        </label>
      </div>
    `;

    renderCart();

    showToast("Đã tìm thấy khách hàng thân thiết!", "success");

  } catch (error) {
    console.error("Lỗi tìm khách hàng:", error);
    showToast("Không thể tìm khách hàng: " + error.message, "error");
  }
}


function toggleUsePoints(checked) {
  usePoints = checked;
  renderCart();
}

// Modal Thêm Khách Hàng Thân Thiết (Dành cho Nhân viên tại POS)
function openAddCustomerModal() {
  const phoneInput = document.getElementById("crm-phone-input");
  const currentPhone = phoneInput ? phoneInput.value.trim() : "";
  document.getElementById("new-cust-phone").value = currentPhone;
  document.getElementById("new-cust-name").value = "";

  const modal = document.getElementById("add-customer-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  if (window.lucide) lucide.createIcons();
}

function closeAddCustomerModal() {
  const modal = document.getElementById("add-customer-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}


async function saveCustomerFromPOS(e) {
  e.preventDefault();

  const phone = document.getElementById("new-cust-phone").value.trim();
  const name = document.getElementById("new-cust-name").value.trim();

  if (!phone || !name) {
    showToast("Vui lòng nhập đầy đủ họ tên và số điện thoại!", "warning");
    return;
  }

  try {
    // Tạo mã khách hàng
    const customerCode = "KH" + Date.now();

    // Gửi thông tin khách hàng lên SQL Server
    const response = await fetch("/api/customers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        CustomerCode: customerCode,
        FullName: name,
        Phone: phone
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Không thể thêm khách hàng");
    }

    // Tự động gán khách hàng mới vào đơn hàng hiện tại
    const newCust = {
      id: result.data?.CustomerID || null,
      code: customerCode,
      phone: phone,
      name: name,
      points: 0,
      totalSpent: 0,
      tier: "Đồng"
    };

    currentCustomer = newCust;
    usePoints = false;

    document.getElementById("crm-phone-input").value = phone;

    const infoBox = document.getElementById("crm-customer-info");
    infoBox.classList.remove("hidden");

    infoBox.innerHTML = `
      <div class="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs">
        <p class="font-bold text-amber-900">
          ${name} (Đồng) - Mới tạo
        </p>
        <p class="text-[11px] text-amber-700">
          Điểm khả dụng: <strong>0 điểm</strong>
          (Đơn này sẽ được tích điểm)
        </p>
      </div>
    `;

    closeAddCustomerModal();
    renderCart();

    showToast(
      `Đã thêm khách hàng "${name}" vào SQL Server thành công!`,
      "success"
    );

  } catch (error) {
    console.error("Lỗi thêm khách hàng:", error);
    showToast(error.message || "Không thể thêm khách hàng!", "error");
  }
}


// ==========================================
// 4. BÁO CÁO CẬN DATE & TỒN KHO (Nhân viên tổng hợp gửi Chủ shop)
// ==========================================
function openInventoryReportModal() {
  tempReportItems = [];
  document.getElementById("report-staff-note").value = "";
  aggregateInventoryReport();

  const modal = document.getElementById("inventory-report-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  if (window.lucide) lucide.createIcons();
}

function closeInventoryReportModal() {
  const modal = document.getElementById("inventory-report-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function aggregateInventoryReport() {
  const products = getProducts();
  tempReportItems = [];

  products.forEach(p => {
    const daysLeft = getDaysUntilExpiry(p.expiryDate);
    const minAlert = p.minStockAlert || 5;
    const isNearExpiry = daysLeft <= 7;
    const isLowStock = p.stock <= minAlert;

    if (isNearExpiry || isLowStock) {
      let riskType = "";
      let suggestedDiscount = 30;

      if (daysLeft <= 1 && isLowStock) {
        riskType = "Nguy cấp: Cận hạn ≤ 1d & Chạm ngưỡng tồn";
        suggestedDiscount = 50;
      } else if (daysLeft <= 1) {
        riskType = `Nguy cấp: Hết hạn trong ${daysLeft} ngày`;
        suggestedDiscount = 45;
      } else if (daysLeft <= 7) {
        riskType = `Cận date: Còn ${daysLeft} ngày`;
        suggestedDiscount = 30;
      } else if (isLowStock) {
        riskType = `Tồn kho thấp (${p.stock} ≤ ${minAlert})`;
        suggestedDiscount = 0;
      }

      tempReportItems.push({
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        batchCode: p.batchCode || ("LOT-" + p.barcode.slice(-4)),
        stock: p.stock,
        minStockAlert: minAlert,
        expiryDate: p.expiryDate,
        daysLeft,
        type: riskType,
        suggestedDiscount
      });
    }
  });

  renderReportItemsTable();
}

function renderReportItemsTable() {
  const countEl = document.getElementById("report-items-count");
  const tbody = document.getElementById("report-items-table-body");
  if (!tbody) return;

  if (countEl) countEl.innerText = tempReportItems.length;

  if (tempReportItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="p-6 text-center text-slate-400">
          <i data-lucide="shield-check" class="w-8 h-8 mx-auto text-emerald-500 mb-1"></i>
          <p class="font-bold text-slate-700">Tất cả hàng hóa đều an toàn (Chưa có sản phẩm nào cận date hoặc chạm ngưỡng tồn)</p>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = tempReportItems.map((item, index) => `
    <tr class="hover:bg-slate-50 text-xs">
      <td class="p-2.5">
        <span class="font-bold text-slate-900 block">${item.name}</span>
        <span class="text-[10px] text-slate-400 font-mono">#${item.barcode} • Lô: ${item.batchCode}</span>
      </td>
      <td class="p-2.5 font-bold ${item.stock <= item.minStockAlert ? 'text-red-600' : 'text-slate-800'}">
        ${item.stock} cái
      </td>
      <td class="p-2.5 font-mono text-slate-600">
        ${item.expiryDate}
        <span class="text-[10px] font-bold block ${item.daysLeft <= 1 ? 'text-red-600' : 'text-amber-600'}">(${item.daysLeft}d)</span>
      </td>
      <td class="p-2.5">
        <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${
          item.daysLeft <= 1 ? 'bg-red-100 text-red-700 border border-red-200' :
          item.daysLeft <= 7 ? 'bg-amber-100 text-amber-800' : 'bg-orange-100 text-orange-800'
        }">
          ${item.type}
        </span>
      </td>
      <td class="p-2.5 text-center">
        <button type="button" onclick="removeReportItem(${index})" class="p-1 text-slate-400 hover:text-red-600 rounded" title="Loại khỏi báo cáo">
          <i data-lucide="x" class="w-3.5 h-3.5"></i>
        </button>
      </td>
    </tr>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

function removeReportItem(index) {
  tempReportItems.splice(index, 1);
  renderReportItemsTable();
}


async function submitInventoryReportToOwner() {
  if (tempReportItems.length === 0) {
    showToast(
      "Không có sản phẩm nào trong danh sách báo cáo. Vui lòng bấm 'BẤM TỔNG HỢP' trước!",
      "warning"
    );
    return;
  }

  const user = getCurrentUser();

  if (!user || !Number.isInteger(Number(user.employeeId))) {
    showToast("Không xác định được mã nhân viên. Vui lòng đăng nhập lại!", "error");
    return;
  }

  const employeeId = Number(user.employeeId);

  const note = document.getElementById("report-staff-note").value.trim()
    || "Nhân viên tổng hợp danh sách hàng cận date và tồn kho.";

  const now = new Date();

  const reportDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");

  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} ${now.getDate().toString().padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

  // Nội dung báo cáo gửi lên SQL Server

const itemDetails = tempReportItems.map((item, index) => {
  return [
    `${index + 1}. ${item.name || "Chưa có tên sản phẩm"}`,
    `   - Mã vạch: ${item.barcode || "Không có"}`,
    `   - Mã lô: ${item.batchCode || "Không có"}`,
    `   - Tồn kho: ${item.stock ?? 0}`,
    `   - Hạn sử dụng: ${item.expiryDate || "Không có"}`,
    `   - Số ngày còn lại: ${item.daysLeft ?? "Không xác định"}`,
    `   - Tình trạng: ${item.type || "Chưa xác định"}`,
    `   - Giảm giá đề xuất: ${item.suggestedDiscount ?? 0}%`
  ].join("\n");
}).join("\n\n");


  const content = [
    `Ghi chú nhân viên: ${note}`,
    "",
    "Danh sách sản phẩm cần xử lý:",
    itemDetails
  ].join("\n");

  try {
    // 1. Gửi báo cáo lên SQL Server
    const response = await fetch("/api/employee-reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        employeeId,
        reportType: "Báo cáo kiểm kê / cận date",
        title: "Báo cáo hàng hóa cận date và tồn kho",
        content,
        reportDate
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Không thể gửi báo cáo lên máy chủ.");
    }

    // 2. Lưu localStorage để giữ chức năng FEFO cũ
    const newReport = {
      id: "RP-" + Date.now().toString().slice(-6),
      submittedAt: timeStr,
      reporterId: user.id || "st-02",
      reporterName: user.name || "Nhân viên thu ngân",
      status: "Chờ duyệt",
      note,
      items: [...tempReportItems]
    };

    const reports = getInventoryReports();
    reports.unshift(newReport);
    saveInventoryReports(reports);

    closeInventoryReportModal();

    showToast(
      "Đã gửi báo cáo thành công lên Chủ cửa hàng và lưu vào hệ thống!",
      "success"
    );

  } catch (error) {
    console.error("Lỗi gửi báo cáo nhân viên:", error);

    showToast(
      error.message || "Không thể gửi báo cáo. Vui lòng thử lại!",
      "error"
    );
  }
}


// ==========================================
// 5. THANH TOÁN (VIETQR TÀI KHOẢN HỘ KINH DOANH & MOMO / ZALOPAY)
// ==========================================
async function openPaymentModal() {
  if (cart.length === 0) return;

  // Tải cấu hình thanh toán mới nhất từ SQL Server
  await loadPaymentConfigFromAPI();

  const { vat, total } = calculateTotals();

  document.getElementById("modal-pay-total").innerText = formatVND(total);
  document.getElementById("modal-pay-vat-note").innerText =
    `(Thuế VAT 8%: ${formatVND(vat)})`;

  document.getElementById("input-customer-paid").value = 0;

  isDefaultExactCash = false;
  calculateChange();

  // Cập nhật thông tin QR theo cấu hình vừa tải
  updatePaymentDisplay();

  const modal = document.getElementById("payment-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");

  if (window.lucide) lucide.createIcons();
}

function closePaymentModal() {
  const modal = document.getElementById("payment-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function setPaymentMethod(method) {
  currentPayMethod = method;

  // Update tabs style
  const tabCash = document.getElementById("pay-tab-cash");
  const tabVietqr = document.getElementById("pay-tab-vietqr");
  const tabEwallet = document.getElementById("pay-tab-ewallet");

  [tabCash, tabVietqr, tabEwallet].forEach(tab => {
    tab.className = "pay-method-btn p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 flex flex-col items-center gap-1 cursor-pointer text-center font-bold text-xs text-slate-700";
  });

  if (method === "Tiền mặt") {
    tabCash.className = "pay-method-btn p-2.5 rounded-xl border border-[#005A2B] bg-emerald-50/70 flex flex-col items-center gap-1 cursor-pointer text-center font-bold text-xs text-[#005A2B]";
  } else if (method === "Chuyển khoản QR") {
    tabVietqr.className = "pay-method-btn p-2.5 rounded-xl border border-[#005A2B] bg-emerald-50/70 flex flex-col items-center gap-1 cursor-pointer text-center font-bold text-xs text-[#005A2B]";
  } else if (method === "Ví điện tử") {
    tabEwallet.className = "pay-method-btn p-2.5 rounded-xl border border-purple-600 bg-purple-50/70 flex flex-col items-center gap-1 cursor-pointer text-center font-bold text-xs text-purple-700";
  }

  // Toggle views
  document.getElementById("view-payment-cash").classList.toggle("hidden", method !== "Tiền mặt");
  document.getElementById("view-payment-vietqr").classList.toggle("hidden", method !== "Chuyển khoản QR");
  document.getElementById("view-payment-ewallet").classList.toggle("hidden", method !== "Ví điện tử");

  updatePaymentDisplay();
  if (window.lucide) lucide.createIcons();
}

function setEwalletSubTab(tab) {
  currentEwallet = tab;
  const btnMomo = document.getElementById("btn-ewallet-momo");
  const btnZalo = document.getElementById("btn-ewallet-zalopay");

  if (tab === "momo") {
    btnMomo.className = "flex-1 py-1.5 rounded-lg text-xs font-bold bg-[#A50064] text-white shadow-xs";
    btnZalo.className = "flex-1 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900";
  } else {
    btnZalo.className = "flex-1 py-1.5 rounded-lg text-xs font-bold bg-[#0068FF] text-white shadow-xs";
    btnMomo.className = "flex-1 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900";
  }
  updatePaymentDisplay();
}

function updatePaymentDisplay() {
  const { total } = calculateTotals();
  const config = getPaymentConfig();
  const tempInvoiceId = "HD" + Math.floor(1000 + Math.random() * 9000);

  // 1. Quét mã VietQR về tài khoản Hộ Kinh Doanh của Chủ shop
  if (currentPayMethod === "Chuyển khoản QR") {
    document.getElementById("vietqr-acc-name").innerText = config.accountName || "HỘ KINH DOANH EMART";
    document.getElementById("vietqr-acc-num").innerText = config.accountNumber || "0071008899668";
    document.getElementById("vietqr-bank-name").innerText = config.bankName || "Vietcombank";
    document.getElementById("vietqr-memo").innerText = `EMART ${tempInvoiceId}`;

    const qrUrl = `https://api.vietqr.io/image/${config.bankCode || 'VCB'}-${config.accountNumber || '0071008899668'}-compact2.png?amount=${total}&addInfo=EMART%20${tempInvoiceId}&accountName=${encodeURIComponent(config.accountName || 'HO KINH DOANH EMART')}`;
    const imgEl = document.getElementById("vietqr-image-display");
    if (imgEl) {
      imgEl.src = qrUrl;
    }
  }

  // 2. Quét mã ví Momo / ZaloPay
  if (currentPayMethod === "Ví điện tử") {
    const isMomo = currentEwallet === "momo";
    const label = document.getElementById("ewallet-type-label");
    const nameEl = document.getElementById("ewallet-acc-name");
    const phoneEl = document.getElementById("ewallet-phone");
    const amountEl = document.getElementById("ewallet-amount");
    const qrImg = document.getElementById("ewallet-qr-display");

    if (isMomo) {
      if (label) label.innerText = "Mã QR Ví MoMo (Hộ Kinh Doanh)";
      if (label) label.className = "text-[10px] font-bold text-[#A50064] block mt-1";
      if (nameEl) nameEl.innerText = config.momoName || "HỘ KINH DOANH EMART (NGUYỄN VĂN AN)";
      if (phoneEl) phoneEl.innerText = config.momoPhone || "0909123456";
      // QR image generator using QR server
      const qrData = `2|99|${config.momoPhone}|${config.momoName}|${total}|0|0|EMART POS`;
      if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}`;
    } else {
      if (label) label.innerText = "Mã QR ZaloPay (Hộ Kinh Doanh)";
      if (label) label.className = "text-[10px] font-bold text-[#0068FF] block mt-1";
      if (nameEl) nameEl.innerText = config.zalopayName || "HỘ KINH DOANH EMART (NGUYỄN VĂN AN)";
      if (phoneEl) phoneEl.innerText = config.zalopayPhone || "0909123456";
      const qrData = `zalopay://${config.zalopayPhone}?amount=${total}&note=EMART`;
      if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}`;
    }

    if (amountEl) amountEl.innerText = formatVND(total);
  }
}

let isDefaultExactCash = true;

function parseCustomerCashInput() {
  const raw = (document.getElementById("input-customer-paid")?.value || "").toString();
  if (!raw.trim()) return 0;
  // Tách theo dấu + để cộng nhiều tờ tiền (VD: "100000 + 50000 + 20000")
  const parts = raw.split("+");
  let sum = 0;
  parts.forEach(part => {
    const cleaned = part.replace(/[^\d]/g, "");
    if (cleaned) {
      sum += Number(cleaned);
    }
  });
  return sum;
}

function setQuickCash(amount) {
  const { total } = calculateTotals();
  const input = document.getElementById("input-customer-paid");
  if (!input) return;
  if (amount === "exact") {
    input.value = total;
    isDefaultExactCash = true;
  } else {
    if (isDefaultExactCash || !input.value) {
      input.value = amount;
      isDefaultExactCash = false;
    } else {
      input.value = (Number(input.value) || 0) + Number(amount);
    }
  }
  calculateChange();
}

function clearCashInput() {
  const input = document.getElementById("input-customer-paid");
  if (!input) return;
  input.value = 0;
  isDefaultExactCash = false;
  input.focus();
  input.select();
  calculateChange();
}

function calculateChange() {
  const { total } = calculateTotals();
  const inputEl = document.getElementById("input-customer-paid");
  if (inputEl && inputEl.value.length > 1 && inputEl.value.startsWith("0")) {
    inputEl.value = String(Number(inputEl.value));
  }
  const customerPaid = Number(inputEl?.value) || 0;
  const change = Math.max(0, customerPaid - total);
  document.getElementById("modal-pay-change").innerText = formatVND(change);
  
  const confirmBtn = document.getElementById("btn-confirm-payment");
  if (confirmBtn && currentPayMethod === "Tiền mặt") {
    confirmBtn.disabled = customerPaid < total;
  } else if (confirmBtn) {
    confirmBtn.disabled = false;
  }
}

// ==========================================
// 6. XÁC NHẬN THANH TOÁN & IN BILL
// Yêu cầu: 
// - Hóa đơn ghi rõ cả VAT
// - Chỉ để lại MÃ NHÂN VIÊN, KHÔNG ĐỂ TÊN NHÂN VIÊN
// ==========================================

async function confirmPayment() {
  const { subtotal, memberDiscount, vat, total } = calculateTotals();
  let customerPaid =
    Number(document.getElementById("input-customer-paid")?.value) || 0;

  if (currentPayMethod === "Tiền mặt" && customerPaid < total) {
    showToast("Số tiền khách đưa chưa đủ để thanh toán đơn hàng!", "error");
    return;
  }

  if (cart.length === 0) {
    showToast("Giỏ hàng đang trống!", "error");
    return;
  }

  if (currentPayMethod !== "Tiền mặt") {
    customerPaid = total;
  }

  const user = getCurrentUser() || {
    name: "Trần Thị Mai",
    id: "st-02"
  };

  // Chuyển giỏ hàng sang dữ liệu gửi đến SQL Server
  const items = cart.map(item => ({
    productId: Number(item.product.id),
    quantity: Number(item.quantity)
  }));

  try {
    const response = await fetch("/api/sales/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
     body: JSON.stringify({
  items,
  paymentMethod: currentPayMethod,
  customerName: currentCustomer
    ? currentCustomer.name
    : "Khách vãng lai",
  customerPhone: currentCustomer
    ? currentCustomer.phone
    : null,

  // Số điểm khách muốn sử dụng (1 điểm = 1 VNĐ)
  pointsToRedeem: currentCustomer && usePoints
    ? Math.floor(memberDiscount)
    : 0
})
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Thanh toán thất bại.");
    }

    const sale = result.data;
    const now = new Date();

    const timeStr =
      `${now.getHours().toString().padStart(2, "0")}:` +
      `${now.getMinutes().toString().padStart(2, "0")} ` +
      `${now.getDate().toString().padStart(2, "0")}/` +
      `${(now.getMonth() + 1).toString().padStart(2, "0")}/` +
      `${now.getFullYear()}`;

    // Tạo dữ liệu hóa đơn hiển thị và in
    const newInvoice = {
      id: sale.invoiceCode,
      databaseId: sale.invoiceId,
      time: timeStr,
      createdAt: now.toISOString(),
      cashier: user.name,
      cashierId: user.id || "st-02",
      subtotal: sale.subTotal,
      memberDiscount: sale.discountAmount,
      vat: sale.vatAmount,
      totalAmount: sale.totalAmount,
      paymentMethod: currentPayMethod,
      customerPhone: currentCustomer ? currentCustomer.phone : "",
      customerName: currentCustomer
        ? currentCustomer.name
        : "Khách vãng lai",
      receivedAmount: customerPaid,
      changeDue: customerPaid - sale.totalAmount,
      items: sale.items.map(item => ({
        name: item.productName,
        quantity: item.quantity,
        price: item.unitPrice,
        total: item.lineTotal
      }))
    };

  
    // Lưu bản sao hóa đơn ở localStorage để giao diện hiện tại sử dụng
    const invoices = getInvoices();
    invoices.unshift(newInvoice);
    saveInvoices(invoices);

    // Làm mới dữ liệu sản phẩm từ SQL Server
    await loadProductsFromAPI();

    playBeep("pay");
    closePaymentModal();

    showReceiptModal(
      newInvoice,
      customerPaid,
      customerPaid - sale.totalAmount
    );

    // Xóa giỏ hàng sau khi server xác nhận thanh toán thành công
    cart = [];
    currentCustomer = null;
    usePoints = false;

    document.getElementById("crm-customer-info")?.classList.add("hidden");

    const phoneInput = document.getElementById("crm-phone-input");
    if (phoneInput) phoneInput.value = "";

    renderCart();
    await renderProducts();

    showToast("Thanh toán thành công, hóa đơn đã lưu vào SQL Server!", "success");
  } catch (error) {
    console.error("Lỗi thanh toán:", error);
    showToast(error.message || "Không thể kết nối máy chủ thanh toán.", "error");
  }
}

function showReceiptModal(invoice, paid, change) {
  const modal = document.getElementById("receipt-modal");
  const content = document.getElementById("receipt-modal-content");
  if (!modal || !content) return;

  // CHỈ ĐỂ LẠI MÃ NHÂN VIÊN, KHÔNG ĐỂ TÊN NHÂN VIÊN THEO YÊU CẦU
  content.innerHTML = `
    <div class="text-center pb-3 border-b border-dashed border-slate-300">
      <h3 class="text-lg font-black text-slate-900 uppercase tracking-wide">SIÊU THỊ TIỆN LỢI EMART</h3>
      <p class="text-[11px] text-slate-500">366 Phan Văn Trị, P.5, Q. Gò Vấp, TP.HCM</p>
      <p class="text-[11px] text-slate-500">Hotline: 1900 6868 • Phục vụ 24/7</p>
      <div class="my-2 border-t border-dashed border-slate-300"></div>
      <h4 class="font-bold text-sm text-slate-800 uppercase">HÓA ĐƠN BÁN LẺ</h4>
      <p class="text-[11px] font-mono text-slate-500">Mã HĐ: <strong>${invoice.id}</strong> | ${invoice.time}</p>
      <!-- CHỈ ĐỂ LẠI MÃ NHÂN VIÊN: KHÔNG ĐỂ TÊN NHÂN VIÊN -->
      <p class="text-[11px] font-bold text-slate-700">Mã NV: <span class="font-mono text-slate-900">${invoice.cashierId || 'NV-02'}</span></p>
      ${invoice.customerPhone ? `<p class="text-[11px] text-slate-600 font-semibold">Khách hàng: ${invoice.customerPhone}</p>` : ''}
    </div>

    <!-- Items List -->
    <div class="py-3 border-b border-dashed border-slate-300 space-y-1.5 text-xs">
      <div class="grid grid-cols-12 font-bold text-slate-400 pb-1 text-[11px]">
        <span class="col-span-6">Tên hàng</span>
        <span class="col-span-2 text-center">SL</span>
        <span class="col-span-4 text-right">T.Tiền</span>
      </div>
      ${invoice.items.map(item => `
        <div class="grid grid-cols-12 text-slate-800">
          <span class="col-span-6 truncate font-medium">${item.name}</span>
          <span class="col-span-2 text-center font-bold">${item.quantity}</span>
          <span class="col-span-4 text-right font-bold">${formatVND(item.price * item.quantity)}</span>
        </div>
      `).join('')}
    </div>

    <!-- Totals with explicit VAT 8% itemized line -->
    <div class="py-3 border-b border-dashed border-slate-300 space-y-1 text-xs">
      <div class="flex justify-between text-slate-600 text-[11px]">
        <span>Tiền hàng (chưa VAT):</span>
        <span>${formatVND(invoice.subtotal || invoice.totalAmount)}</span>
      </div>
      ${invoice.memberDiscount > 0 ? `
        <div class="flex justify-between text-emerald-700 text-[11px]">
          <span>Giảm trừ điểm thành viên:</span>
          <span>-${formatVND(invoice.memberDiscount)}</span>
        </div>
      ` : ''}
      <div class="flex justify-between text-slate-800 text-[11px] font-semibold">
        <span>Thuế GTGT (VAT 8%):</span>
        <span>${formatVND(invoice.vat || 0)}</span>
      </div>
      <div class="flex justify-between font-bold text-sm text-slate-950 pt-1.5 border-t border-slate-200">
        <span>TỔNG CỘNG:</span>
        <span class="text-base font-black text-[#005A2B]">${formatVND(invoice.totalAmount)}</span>
      </div>
      <div class="flex justify-between text-slate-600 text-[11px] pt-1">
        <span>Phương thức:</span>
        <span class="font-bold">${invoice.paymentMethod}</span>
      </div>
      <div class="flex justify-between text-slate-600 text-[11px]">
        <span>Tiền khách đưa:</span>
        <span>${formatVND(paid)}</span>
      </div>
      <div class="flex justify-between text-slate-600 text-[11px]">
        <span>Tiền thừa thối lại:</span>
        <span class="font-bold text-slate-900">${formatVND(change)}</span>
      </div>
    </div>

    <div class="text-center pt-3 text-[11px] text-slate-500 space-y-1">
      <p class="font-bold text-slate-700">Cảm ơn Quý khách & Hẹn gặp lại!</p>
      <p class="text-[10px] text-slate-400 font-mono">Wifi Emart: Free • Pass: emart247</p>
    </div>
  `;

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeReceiptModal() {
  const modal = document.getElementById("receipt-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

// ==========================================
// 7. KẾT CA, KIỂM KÉT TIỀN MẶT / CHUYỂN KHOẢN & HÀNG TỒN CUỐI NGÀY
// ==========================================
let currentShiftCashRevenue = 0;
let currentShiftTransferRevenue = 0;
let currentShiftSoldItemsMap = [];


// Lấy hóa đơn phát sinh trong ca hiện tại
function getCurrentShiftInvoices() {
  const user = getCurrentUser();

  if (!user || !user.shiftStartedAt) {
    return [];
  }

  const shiftStartTime = new Date(user.shiftStartedAt).getTime();

  return getInvoices().filter(invoice => {
    const invoiceTime = new Date(
      invoice.createdAt || invoice.CreatedAt || invoice.date
    ).getTime();

    return !Number.isNaN(invoiceTime) &&
           invoiceTime >= shiftStartTime;
  });
}


function switchShiftInventoryView(mode) {
  const soldBtn = document.getElementById("btn-shift-view-sold");
  const allBtn = document.getElementById("btn-shift-view-all");
  const soldView = document.getElementById("shift-inventory-sold-view");
  const allView = document.getElementById("shift-inventory-all-view");

  if (!soldBtn || !allBtn || !soldView || !allView) return;

  if (mode === "sold") {
    soldBtn.className = "px-3 py-1 rounded-xl text-xs font-bold bg-[#005A2B] text-white transition";
    allBtn.className = "px-3 py-1 rounded-xl text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition";
    soldView.classList.remove("hidden");
    allView.classList.add("hidden");
  } else {
    allBtn.className = "px-3 py-1 rounded-xl text-xs font-bold bg-[#005A2B] text-white transition";
    soldBtn.className = "px-3 py-1 rounded-xl text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition";
    allView.classList.remove("hidden");
    soldView.classList.add("hidden");
  }
}

function toggleDenominationCalculator() {
  const box = document.getElementById("shift-denomination-box");
  if (box) {
    box.classList.toggle("hidden");
  }
}

function resetDenominations() {
  document.querySelectorAll(".denom-input").forEach(input => input.value = "");
  calculateFromDenominations();
}

function calculateFromDenominations() {
  let total = 0;
  document.querySelectorAll(".denom-input").forEach(input => {
    const qty = Number(input.value) || 0;
    const val = Number(input.dataset.val) || 0;
    total += (qty * val);
  });

  const preview = document.getElementById("denom-total-preview");
  if (preview) {
    preview.innerText = "Tổng: " + formatVND(total);
  }

  const actualInput = document.getElementById("shift-actual-cash");
  if (actualInput) {
    actualInput.value = total;
    recalculateShiftReconciliation();
  }
}

function openShiftClosingModal() {
  const user = getCurrentUser() || { name: "Trần Thị Mai", id: "st-02", shift: "Ca Sáng (06:00 - 14:00)" };
  const invoices = getCurrentShiftInvoices();
  const products = getProducts();

  // Thống kê doanh thu ca và hàng hóa đã xuất bán
  let cashRev = 0;
  let transferRev = 0;
  let soldItemsCount = 0;
  const soldMap = {};

  invoices.forEach(inv => {
    if (inv.paymentMethod === "Tiền mặt") {
      cashRev += (inv.totalAmount || 0);
    } else {
      transferRev += (inv.totalAmount || 0);
    }

    if (Array.isArray(inv.items)) {
      inv.items.forEach(item => {
        soldItemsCount += (item.quantity || 1);
        if (!soldMap[item.name]) {
          soldMap[item.name] = { name: item.name, qty: 0, price: item.price || 0 };
        }
        soldMap[item.name].qty += (item.quantity || 1);
      });
    }
  });

  currentShiftCashRevenue = cashRev;
  currentShiftTransferRevenue = transferRev;
  currentShiftSoldItemsMap = Object.values(soldMap);

  // Thống kê tồn kho
  const totalRemainingStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
  const nearExpiryCount = products.filter(p => getDaysUntilExpiry(p.expiryDate) <= 7).length;

  // Điền dữ liệu vào giao diện
  const subtitleEl = document.getElementById("shift-modal-subtitle");
  if (subtitleEl) {
    subtitleEl.innerHTML = `Thu ngân bàn giao: <strong class="text-slate-800">${user.name}</strong> (Mã NV: <span class="font-mono">${user.id || 'st-02'}</span>) • <span>${user.shift || 'Ca Sáng (06:00 - 14:00)'}</span> • <span>Ngày 16/09/2026</span>`;
  }

  document.getElementById("shift-sold-orders").innerText = invoices.length + " đơn";
  document.getElementById("shift-sold-items-qty").innerText = soldItemsCount + " cái";
  document.getElementById("shift-remaining-stock").innerText = totalRemainingStock + " cái";
  document.getElementById("shift-near-expiry-count").innerText = nearExpiryCount + " mặt hàng";

  // 1. Danh sách các mặt hàng đã bán trong ca
  const soldListEl = document.getElementById("shift-sold-items-list");
  if (soldListEl) {
    if (currentShiftSoldItemsMap.length > 0) {
      soldListEl.innerHTML = currentShiftSoldItemsMap.map(it => `
        <div class="px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition">
          <div class="min-w-0 pr-2">
            <p class="font-bold text-slate-800 truncate">${it.name}</p>
            <p class="text-[10px] text-slate-400 font-mono">${formatVND(it.price || 0)} / món</p>
          </div>
          <span class="font-black text-[#005A2B] shrink-0 text-sm bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">${it.qty} cái</span>
        </div>
      `).join('');
    } else {
      soldListEl.innerHTML = `<div class="p-4 text-slate-400 text-center italic">Chưa có giao dịch bán lẻ nào trong ca làm việc.</div>`;
    }
  }

  // 2. Danh sách toàn bộ tồn kho quầy kệ cuối ngày
  const allStockEl = document.getElementById("shift-all-stock-list");
  if (allStockEl) {
    allStockEl.innerHTML = products.map(p => {
      const days = getDaysUntilExpiry(p.expiryDate);
      const isUrgent = days <= 3;
      const isWarning = days > 3 && days <= 7;
      const isLowStock = p.stock <= (p.minStockAlert || 5);

      return `
        <div class="px-3 py-2 grid grid-cols-12 gap-2 items-center hover:bg-slate-50 transition text-xs">
          <div class="col-span-6 min-w-0">
            <p class="font-bold text-slate-800 truncate">${p.name}</p>
            <p class="text-[10px] text-slate-400 font-mono">${p.barcode} • Lô ${p.batchCode || 'LOT'}</p>
          </div>
          <div class="col-span-3 text-center">
            <span class="text-[10px] font-bold ${isUrgent ? 'text-red-700 bg-red-50 border border-red-200' : isWarning ? 'text-amber-700 bg-amber-50 border border-amber-200' : 'text-emerald-700 bg-emerald-50 border border-emerald-200'} px-1.5 py-0.5 rounded">
              ${p.expiryDate} (${days > 0 ? days + ' ngày' : 'Hôm nay'})
            </span>
          </div>
          <div class="col-span-3 text-right">
            <span class="font-black ${isLowStock ? 'text-red-600 bg-red-50 border border-red-200' : 'text-[#005A2B] bg-slate-50'} px-2 py-0.5 rounded text-xs">
              ${p.stock} cái
            </span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Tiền mặt & Chuyển khoản
  document.getElementById("shift-system-transfer").innerText = formatVND(transferRev);
  document.getElementById("shift-system-cash").innerText = formatVND(cashRev);

  const initialCash = Number(document.getElementById("shift-initial-cash").value) || 1000000;
  const expectedCash = initialCash + cashRev;
  document.getElementById("shift-expected-cash").innerText = formatVND(expectedCash);
  document.getElementById("shift-actual-cash").value = expectedCash; // Mặc định tự điền đúng để nhân viên tiện kiểm

  switchShiftInventoryView("sold");
  recalculateShiftReconciliation();

  const modal = document.getElementById("shift-closing-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  if (window.lucide) lucide.createIcons();
}

function closeShiftClosingModal() {
  const modal = document.getElementById("shift-closing-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function recalculateShiftReconciliation() {
  const initialCash = Number(document.getElementById("shift-initial-cash").value) || 0;
  const expectedCash = initialCash + currentShiftCashRevenue;
  document.getElementById("shift-expected-cash").innerText = formatVND(expectedCash);

  const actualCash = Number(document.getElementById("shift-actual-cash").value) || 0;
  const diff = actualCash - expectedCash;
  const badge = document.getElementById("shift-difference-badge");
  if (!badge) return;

  if (diff === 0) {
    badge.className = "p-3 rounded-xl text-center font-black text-xs flex items-center justify-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300";
    badge.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-700"></i><span>KÉT TIỀN KHỚP 100% (Không chênh lệch: 0 ₫ - Đạt tiêu chuẩn bàn giao)</span>`;
  } else if (diff > 0) {
    badge.className = "p-3 rounded-xl text-center font-black text-xs flex items-center justify-center gap-1.5 bg-amber-100 text-amber-900 border border-amber-300";
    badge.innerHTML = `<i data-lucide="alert-triangle" class="w-4 h-4 text-amber-700"></i><span>THỪA TIỀN TRONG KÉT: +${formatVND(diff)} (Nhân viên nộp lại tiền thừa cho Chủ shop)</span>`;
  } else {
    badge.className = "p-3 rounded-xl text-center font-black text-xs flex items-center justify-center gap-1.5 bg-red-100 text-red-800 border border-red-300";
    badge.innerHTML = `<i data-lucide="alert-octagon" class="w-4 h-4 text-red-700"></i><span>THIẾU TIỀN TRONG KÉT: ${formatVND(diff)} (Vui lòng kiểm tra lại hóa đơn và tiền thối)</span>`;
  }
  if (window.lucide) lucide.createIcons();
}

function setCashDrawerExact() {
  const initialCash = Number(document.getElementById("shift-initial-cash").value) || 0;
  const expectedCash = initialCash + currentShiftCashRevenue;
  document.getElementById("shift-actual-cash").value = expectedCash;
  recalculateShiftReconciliation();
}


async function submitShiftReportToOwner() {
  const user = getCurrentUser();

  // Kiểm tra tài khoản nhân viên
  if (!user || !user.employeeId) {
    showToast("Không xác định được nhân viên đang đăng nhập!", "error");
    return;
  }

  const initialCash =
    Number(document.getElementById("shift-initial-cash").value) || 0;

  const actualCash =
    Number(document.getElementById("shift-actual-cash").value) || 0;

  const expectedCash = initialCash + currentShiftCashRevenue;
  const diff = actualCash - expectedCash;

  const note =
    document.getElementById("shift-note").value.trim() ||
    "Bàn giao kết ca không có sự cố phát sinh. Hàng hóa quầy kệ đầy đủ.";

  let diffStatus = "Khớp két 100%";

  if (diff > 0) {
    diffStatus = "Thừa tiền: +" + formatVND(diff);
  } else if (diff < 0) {
    diffStatus = "Thiếu tiền: " + formatVND(diff);
  }

  const products = getProducts();
  const invoices = getCurrentShiftInvoices();
  const now = new Date();

  // Ngày báo cáo theo định dạng SQL Server
  const dateISO = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");

  // Thống kê hàng hóa
  const totalSoldItems = currentShiftSoldItemsMap.reduce(
    (sum, item) => sum + Number(item.qty || 0),
    0
  );

  const totalStockRemaining = products.reduce(
    (sum, product) => sum + Number(product.stock || 0),
    0
  );

  const nearExpiryCount = products.filter(
    product => getDaysUntilExpiry(product.expiryDate) <= 7
  ).length;

  const lowStockCount = products.filter(
    product => product.stock <= (product.minStockAlert || 5)
  ).length;

  // Dữ liệu gửi lên SQL Server
  const newShiftReport = {
    employeeId: Number(user.employeeId),
    shiftName: user.shift || "Ca Sáng (06:00 - 14:00)",
    reportDate: dateISO,

    totalOrders: invoices.length,
    totalRevenue: currentShiftCashRevenue + currentShiftTransferRevenue,

    systemCash: currentShiftCashRevenue,
    systemTransfer: currentShiftTransferRevenue,

    initialDrawerCash: initialCash,
    expectedDrawerCash: expectedCash,
    actualDrawerCash: actualCash,
    cashDifference: diff,
    differenceStatus: diffStatus,

    totalSoldItems,
    totalStockRemaining,
    nearExpiryCount,
    lowStockCount,

    note
  };

  try {
    const response = await fetch("/api/shift-reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(newShiftReport)
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Không thể gửi báo cáo kết ca.");
    }
    // Bắt đầu ca mới sau khi gửi báo cáo thành công
const nextShiftStart = new Date().toISOString();

if (user && user.employeeId) {
  const shiftStartKey = `emart_shift_start_${user.employeeId}`;

  localStorage.setItem(shiftStartKey, nextShiftStart);

  user.shiftStartedAt = nextShiftStart;
  setStorage("emart_current_user", user);
}

    closeShiftClosingModal();

    showToast(
      `ĐÃ KẾT CA & GỬI BÁO CÁO THÀNH CÔNG!\n\n` +
      `• Thu ngân: ${user.name} (Mã: ${user.id})\n` +
      `• Tiền mặt két: ${formatVND(actualCash)} (${diffStatus})\n` +
      `• Chuyển khoản QR: ${formatVND(currentShiftTransferRevenue)}\n\n` +
      `Mã báo cáo: ${result.data.ReportCode}\n` +
      `Báo cáo đã được lưu vào SQL Server!`,
      "success"
    );

  } catch (error) {
    console.error("Lỗi gửi báo cáo kết ca:", error);

    showToast(
      error.message || "Không thể gửi báo cáo kết ca!",
      "error"
    );
  }
}


// Global Keyboard Shortcuts (F2, F4, F8, Esc)
document.addEventListener("keydown", (e) => {
  if (e.key === "F2") {
    e.preventDefault();
    document.getElementById("search-input")?.focus();
  } else if (e.key === "F4") {
    e.preventDefault();
    document.getElementById("crm-phone-input")?.focus();
  } else if (e.key === "F8") {
    e.preventDefault();
    openPaymentModal();
  } else if (e.key === "Escape") {
    closePaymentModal();
    closeReceiptModal();
    closeAddCustomerModal();
    closeInventoryReportModal();
    closeShiftClosingModal();
  }
});
