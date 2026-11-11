// ========================================
// LẤY DANH SÁCH DANH MỤC
// ========================================
async function getCategories() {

    try {

        const response = await fetch("/api/categories");

        if (!response.ok) {
            throw new Error("Không thể lấy danh sách danh mục");
        }

        return await response.json();

    } catch (error) {

        console.error("Lỗi API:", error);

        return [];

    }
}


// ========================================
// THÊM DANH MỤC
// ========================================
async function createCategory(categoryData) {

    try {

        const response = await fetch("/api/categories", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(categoryData)

        });


        const result = await response.json();


        if (!response.ok) {

            throw new Error(
                result.message || "Không thể thêm danh mục"
            );

        }


        return result;

    } catch (error) {

        console.error("Lỗi thêm danh mục:", error);

        throw error;

    }
}
// ========================================
// SỬA DANH MỤC
// ========================================
async function updateCategory(categoryId, categoryData) {

    try {

        const response = await fetch(
            `/api/categories/${categoryId}`,
            {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(categoryData)
            }
        );


        const result = await response.json();


        if (!response.ok) {

            throw new Error(
                result.message || "Không thể sửa danh mục"
            );

        }


        return result;

    } catch (error) {

        console.error("Lỗi sửa danh mục:", error);

        throw error;

    }
}
// ========================================
// XÓA DANH MỤC
// ========================================
async function removeCategory(categoryId) {

    try {

        const response = await fetch(
            `/api/categories/${categoryId}`,
            {
                method: "DELETE"
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "Không thể xóa danh mục"
            );
        }

        return result;

    } catch (error) {

        console.error("Lỗi xóa danh mục:", error);

        throw error;

    }
}