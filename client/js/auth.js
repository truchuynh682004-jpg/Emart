/**
 * Emart Authentication & Session Management
 */

function getCurrentUser() {
  return getStorage("emart_current_user", null);
}


async function login(email, password, role) {
    if (!email || !password || !role) {
        return {
            success: false,
            message: "Vui lòng nhập đầy đủ tài khoản, mật khẩu và chọn vai trò!"
        };
    }

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email.trim(),
                password: password.trim(),
                role: role
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            return {
                success: false,
                message: result.message || "Đăng nhập thất bại!"
            };
        }

        const shiftStartKey = `emart_shift_start_${result.user.employeeId}`;
const savedShiftStart = localStorage.getItem(shiftStartKey);

const userWithSession = {
  ...result.user,
  shiftStartedAt: savedShiftStart || new Date().toISOString()
};

localStorage.setItem(shiftStartKey, userWithSession.shiftStartedAt);

setStorage("emart_current_user", userWithSession);

        return {
            success: true,
            user: userWithSession
        };

    } catch (error) {
        console.error("Lỗi đăng nhập:", error);

        return {
            success: false,
            message: "Không thể kết nối máy chủ! Vui lòng thử lại."
        };
    }
}


function logout() {
  localStorage.removeItem("emart_current_user");
  window.location.href = "index.html#section-login";
}

function requireAuth(redirectUrl = "index.html#section-login") {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = redirectUrl;
    return null;
  }
  return user;
}

function requireRole(allowedRoles, redirectUrl = "pos.html") {
  const user = requireAuth("index.html#section-login");
  if (!user) return null;
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!roles.includes(user.role)) {
    window.location.replace(redirectUrl);
    return null;
  }
  return user;
}

function updateHeaderUserUI() {
  const user = getCurrentUser();
  const userContainer = document.getElementById("header-user-section");
  const adminNav = document.getElementById("header-nav-admin");

  // Phân quyền nút điều hướng trên Quầy POS:
  // - Chủ cửa hàng: Vào Quản trị trung tâm (dashboard.html)
  // - Nhân viên thu ngân: Được phép vào trang Quản lý kho & Date FEFO (dashboard.html?tab=products)
  if (adminNav) {
    if (user) {
      adminNav.classList.remove("hidden");
      if (user.role === "Chủ cửa hàng") {
        adminNav.href = "dashboard.html";
        adminNav.innerHTML = `
          <i data-lucide="layout-dashboard" class="w-4 h-4 text-[#FFD700]"></i>
          <span>Quản Trị Trung Tâm</span>
        `;
      } else {
        adminNav.href = "dashboard.html?tab=products";
        adminNav.innerHTML = `
          <i data-lucide="package" class="w-4 h-4 text-[#FFD700]"></i>
          <span>Quản Lý Kho (FEFO)</span>
        `;
      }
    } else {
      adminNav.classList.add("hidden");
    }
  }

  if (!userContainer) return;

  if (user) {
    const isOwner = user.role === "Chủ cửa hàng";
    const rawShift = user.shift || "Ca Sáng (06:00 - 14:00)";
    const shiftMatch = rawShift.match(/^([^(]+)\s*\(([^)]+)\)/);
    const shiftTitle = shiftMatch ? shiftMatch[1].trim() : rawShift;
    const shiftHours = shiftMatch ? shiftMatch[2].trim() : "06:00 - 14:00";
    
    // Giao diện thẻ nhân viên thu ngân / chủ cửa hàng:
    // Tên nhân viên & vai trò bên trái, Ca làm việc ở trên - Giờ làm ở dưới rõ ràng
    userContainer.innerHTML = `
      <div class="flex items-center gap-2.5 sm:gap-3 bg-white text-slate-900 px-3 py-1.5 sm:py-2 rounded-2xl shadow-sm border border-slate-200/90 transition select-none hover:shadow-md">
        <!-- Avatar với trạng thái ca làm việc -->
        <div class="relative shrink-0">
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${isOwner ? 'bg-gradient-to-br from-[#FFA500] to-[#E68A00] text-slate-950' : 'bg-gradient-to-br from-[#005A2B] to-[#0B6A36] text-[#FFD700]'} font-black flex items-center justify-center text-xs sm:text-sm shadow-xs border border-white">
            ${isOwner ? '👑' : 'TM'}
          </div>
          <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" title="Đang trong ca trực"></span>
        </div>

        <!-- Chi tiết Họ Tên & Chức Danh Nhân Viên -->
        <div class="leading-tight min-w-0 pr-1 text-left">
          <div class="flex items-center gap-1.5 sm:gap-2">
            <span class="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight truncate max-w-[140px] sm:max-w-[180px]">${user.name}</span>
            <span class="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 shrink-0">${user.id || 'NV'}</span>
          </div>
          <div class="flex items-center gap-1.5 text-xs text-slate-600 mt-0.5">
            <span class="inline-flex items-center gap-1 font-bold ${isOwner ? 'text-amber-800 bg-amber-50 border-amber-200' : 'text-[#005A2B] bg-emerald-50 border-emerald-200'} text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md border">
              <i data-lucide="${isOwner ? 'shield-check' : 'user-check'}" class="w-3 h-3 ${isOwner ? 'text-[#FFA500]' : 'text-[#005A2B]'}"></i>
              <span>${user.role}</span>
            </span>
          </div>
        </div>

        <!-- Khối Ca Làm Việc (Ở trên) & Giờ Làm Việc (Ở dưới) -->
        <div class="hidden sm:flex flex-col items-start justify-center pl-2.5 border-l border-slate-200 leading-tight shrink-0">
          <span class="text-[11px] font-extrabold text-[#005A2B] flex items-center gap-1">
            <i data-lucide="clock" class="w-3 h-3 text-[#FFA500]"></i>
            <span>${shiftTitle}</span>
          </span>
          <span class="text-[10px] font-mono font-bold text-slate-500 mt-0.5 pl-4">${shiftHours}</span>
        </div>

        <!-- Nút Đăng Xuất -->
        <button onclick="logout()" title="Đăng xuất khỏi quầy" class="p-1.5 sm:p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer border border-transparent hover:border-red-100 ml-0.5 shrink-0">
          <i data-lucide="log-out" class="w-4 h-4"></i>
        </button>
      </div>
    `;
  } else {
    userContainer.innerHTML = `
      <a href="#section-login" onclick="const el=document.getElementById('section-login'); if(el){event.preventDefault(); el.scrollIntoView({behavior:'smooth'});} else {window.location.href='index.html#section-login';}" class="header-galaxy-btn">
        <i data-lucide="log-in" class="w-4 h-4 text-[#005A2B] shrink-0"></i>
        <span>Đăng nhập</span>
      </a>
    `;
  }
  if (window.lucide) {
    lucide.createIcons();
  }
}
