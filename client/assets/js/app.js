document.getElementById("app").innerHTML = `

<div class="d-flex">

    <!-- Sidebar -->
    <div class="sidebar">

        <h3>StorePOS</h3>

        <a href="#" onclick="loadPage('dashboard')">
            <i class="fa-solid fa-house"></i>
            Dashboard
        </a>

        <a href="#" onclick="loadPage('categories')">
            <i class="fa-solid fa-layer-group"></i>
            Danh mục
        </a>

        <a href="#">
            <i class="fa-solid fa-box"></i>
            Sản phẩm
        </a>

        <a href="#">
            <i class="fa-solid fa-truck"></i>
            Nhà cung cấp
        </a>

        <a href="#">
            <i class="fa-solid fa-cart-shopping"></i>
            Bán hàng
        </a>

        <a href="#">
            <i class="fa-solid fa-chart-column"></i>
            Báo cáo
        </a>

        <a href="#">
            <i class="fa-solid fa-robot"></i>
            AI Trợ lý
        </a>

    </div>


    <!-- Nội dung chính -->
    <div class="content">

        <!-- Topbar -->
        <div class="topbar">

            <h3 id="pageTitle">
                Dashboard
            </h3>

            <div>

                <i class="fa-solid fa-bell me-3"></i>

                <i class="fa-solid fa-moon me-3"></i>

                <i class="fa-solid fa-user"></i>

            </div>

        </div>


        <!-- Nội dung page -->
        <div id="content" class="mt-4"></div>

    </div>

</div>

`;

// Mở Dashboard mặc định
loadPage("dashboard");