# StorePOS – Hệ thống quản lý cửa hàng Emart

StorePOS là ứng dụng quản lý cửa hàng bán lẻ, hỗ trợ quản lý sản phẩm, bán hàng, tồn kho, hóa đơn, báo cáo và sao lưu dữ liệu.

## 1. Công nghệ sử dụng

- **Frontend:** HTML, CSS, JavaScript, Bootstrap.
- **Backend:** Node.js, Express.js.
- **Database:** Microsoft SQL Server 2022 Express.
- **Container:** Docker và Docker Compose.

## 2. Các chức năng chính

- Quản lý sản phẩm, danh mục và nhà cung cấp.
- Tìm kiếm sản phẩm và quản lý giá bán.
- Bán hàng và tạo hóa đơn.
- Quản lý tồn kho và cảnh báo hàng sắp hết.
- Theo dõi hạn sử dụng sản phẩm theo FEFO.
- Quản lý lịch sử hóa đơn.
- Báo cáo doanh thu và tình hình kinh doanh.
- Sao lưu và kiểm tra file backup.

## 3. Yêu cầu cài đặt

Trước khi chạy dự án, cần cài đặt:

1. Node.js.
2. Docker Desktop.
3. Git (nếu tải dự án bằng Git Clone).
4. Visual Studio Code (khuyến nghị).

## 4. Tải dự án

Clone repository:

```bash
git clone <GITHUB_REPOSITORY_URL>
```

Di chuyển vào thư mục dự án:

```bash
cd CuaHang
```

## 5. Cấu hình môi trường

Tạo file `.env` từ file mẫu:

**PowerShell:**

```powershell
Copy-Item .env.example .env
```

Mở file `.env` và cấu hình các biến môi trường:

- `DOCKER_DB_PASSWORD`: Mật khẩu SQL Server dành cho Docker.
- `BACKUP_HOST_PATH`: Đường dẫn thư mục lưu trữ backup trên máy tính.

Ví dụ:

```dotenv
DOCKER_DB_PASSWORD=YourStrongPasswordHere
BACKUP_HOST_PATH=E:/StorePOS_Backup
```

Tạo thư mục backup tương ứng nếu chưa tồn tại.

Không chia sẻ file `.env` và không đưa mật khẩu thật lên GitHub.

## 6. Khởi chạy bằng Docker

Mở Docker Desktop, chờ Docker Engine hoạt động.

Tại thư mục gốc dự án, chạy:

```bash
docker compose up -d --build
```

Kiểm tra trạng thái container:

```bash
docker compose ps
```

Xem log khi cần kiểm tra lỗi:

```bash
docker compose logs -f
```

## 7. Truy cập ứng dụng

Sau khi backend khởi động thành công, truy cập:

```text
http://localhost:3000
```

## 8. Dừng ứng dụng

```bash
docker compose down
```

Lệnh trên dừng và xóa container nhưng không xóa các thư mục dữ liệu đã mount.

**Không sử dụng `docker compose down -v` nếu chưa hiểu rõ ảnh hưởng đến dữ liệu.**

## 9. Lưu ý về cơ sở dữ liệu

- SQL Server chạy trong Docker container.
- Dữ liệu database được lưu trong thư mục `docker-data`.
- File backup được lưu trong thư mục được cấu hình tại `BACKUP_HOST_PATH`.
- File `DataCH.sql` hiện chỉ tạo database `StorePOS`, chưa tạo đầy đủ các bảng và dữ liệu mẫu.
- Khi thiết lập trên máy mới, cần chuẩn bị schema và dữ liệu database phù hợp trước khi sử dụng đầy đủ các chức năng.

## 10. Cấu trúc dự án

```text
CuaHang/
├── client/
├── server/
├── docs/
├── backup/
├── DataCH.sql
├── Dockerfile
├── docker-compose.yml
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
└── README.md
```

---

**StorePOS – Retail Store Management System**