async function loadPage(page) {

    try {

        const response = await fetch(`pages/${page}.html`);

        if (!response.ok) {
            throw new Error("Không tìm thấy trang: " + page);
        }

        const html = await response.text();

        const content = document.getElementById("content");

        content.innerHTML = html;

        // Chạy các thẻ <script> bên trong page
        const scripts = content.querySelectorAll("script");

        scripts.forEach(oldScript => {

            const newScript = document.createElement("script");

            // Nếu script có src
            if (oldScript.src) {
                newScript.src = oldScript.src;
            } else {
                newScript.textContent = oldScript.textContent;
            }

            document.body.appendChild(newScript);

            oldScript.remove();
        });

    } catch (error) {

        console.error(error);

        document.getElementById("content").innerHTML = `
            <div class="alert alert-danger">
                Không thể tải trang.
            </div>
        `;
    }
}