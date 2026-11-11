USE StorePOS;
GO

CREATE TABLE Categories
(
    CategoryID INT IDENTITY(1,1) PRIMARY KEY,

    CategoryCode NVARCHAR(20) NOT NULL UNIQUE,

    CategoryName NVARCHAR(100) NOT NULL,

    Description NVARCHAR(255),

    CreatedAt DATETIME DEFAULT GETDATE(),

    UpdatedAt DATETIME DEFAULT GETDATE()
);
GO

CREATE TABLE Suppliers
(
    SupplierID INT IDENTITY(1,1) PRIMARY KEY,

    SupplierCode NVARCHAR(20) UNIQUE,

    SupplierName NVARCHAR(150) NOT NULL,

    ContactPerson NVARCHAR(100),

    Phone NVARCHAR(20),

    Email NVARCHAR(100),

    Address NVARCHAR(255),

    CreatedAt DATETIME DEFAULT GETDATE()
);
GO

CREATE TABLE Products
(
    ProductID INT IDENTITY(1,1) PRIMARY KEY,

    Barcode NVARCHAR(50) UNIQUE,

    ProductCode NVARCHAR(30) UNIQUE,

    ProductName NVARCHAR(200) NOT NULL,

    CategoryID INT,

    SupplierID INT,

    Unit NVARCHAR(30),

    PurchasePrice DECIMAL(18,2),

    SellingPrice DECIMAL(18,2),

    MinStock INT DEFAULT 0,

    CurrentStock INT DEFAULT 0,

    ImageURL NVARCHAR(255),

    IsActive BIT DEFAULT 1,

    CreatedAt DATETIME DEFAULT GETDATE(),

    UpdatedAt DATETIME DEFAULT GETDATE(),

    CONSTRAINT FK_Product_Category
        FOREIGN KEY(CategoryID)
        REFERENCES Categories(CategoryID),

    CONSTRAINT FK_Product_Supplier
        FOREIGN KEY(SupplierID)
        REFERENCES Suppliers(SupplierID)
);
GO

USE StorePOS;
GO

INSERT INTO Categories (CategoryCode, CategoryName, Description)
VALUES
('DM001', N'Nước giải khát', N'Các loại nước uống'),
('DM002', N'Bánh kẹo', N'Các loại bánh kẹo'),
('DM003', N'Gia vị', N'Các loại gia vị'),
('DM004', N'Hóa mỹ phẩm', N'Dầu gội, sữa tắm...');
GO
SELECT * FROM Categories;