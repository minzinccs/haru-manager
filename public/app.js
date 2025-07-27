document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    const mainContainer = document.querySelector('.main-container');
    const sidebarToggle = document.getElementById('sidebar-toggle');

    const tableBody = document.getElementById('data-table-body');
    const statusFilter = document.getElementById('status-filter');
    const searchInput = document.getElementById('search-input');
    const jsonUpload = document.getElementById('json-upload');
    const modal = document.getElementById('json-editor-modal');
    const closeButton = document.querySelector('.close-button');
    const saveJsonButton = document.getElementById('save-json-button');
    const cancelJsonButton = document.getElementById('cancel-json-button');
    const jsonEditorTextarea = document.getElementById('json-editor-textarea');

    let currentEditingId = null;

    // --- API Functions (sẽ được thay thế bằng Cloudflare Functions) ---

    async function fetchData(status = 'unverified', searchTerm = '') {
        tableBody.innerHTML = '<tr><td colspan="5">Đang tải dữ liệu...</td></tr>';
        try {
            // Xây dựng URL với các tham số truy vấn
            const params = new URLSearchParams();
            params.append('status', status);
            if (searchTerm) {
                params.append('search', searchTerm);
            }
            
            const response = await fetch(`/api/images?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`Lỗi mạng: ${response.statusText}`);
            }
            const data = await response.json();
            renderTable(data);
        } catch (error) {
            console.error('Không thể lấy dữ liệu:', error);
            tableBody.innerHTML = '<tr><td colspan="5">Không thể tải dữ liệu. Vui lòng kiểm tra console.</td></tr>';
        }
    }

    async function updateStatus(id, newStatus) {
        try {
            const response = await fetch(`/api/images/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!response.ok) {
                throw new Error('Cập nhật trạng thái thất bại.');
            }
            // Không cần tải lại toàn bộ bảng, chỉ cần cập nhật giao diện (tùy chọn)
            console.log(`Cập nhật thành công trạng thái cho ID ${id}`);
        } catch (error) {
            console.error('Lỗi khi cập nhật trạng thái:', error);
            alert('Cập nhật trạng thái thất bại.');
            // Tải lại để đồng bộ
            fetchData(statusFilter.value, searchInput.value);
        }
    }

    async function updateJsonData(id, newData) {
        try {
            const response = await fetch(`/api/images/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: newData }),
            });
            if (!response.ok) {
                throw new Error('Cập nhật JSON thất bại.');
            }
            closeModal();
            // Tải lại dữ liệu để thấy thay đổi
            fetchData(statusFilter.value, searchInput.value);
        } catch (error) {
            console.error('Lỗi khi cập nhật JSON:', error);
            alert('Cập nhật JSON thất bại.');
        }
    }
    
    async function uploadJsonFile(file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const jsonData = JSON.parse(event.target.result);
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(jsonData),
                });

                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error || 'Tải lên thất bại.');
                }
                
                alert(result.message);
                fetchData(statusFilter.value, searchInput.value); // Tải lại dữ liệu
            } catch (error) {
                console.error('Lỗi khi tải lên tệp JSON:', error);
                alert(`Đã xảy ra lỗi: ${error.message}`);
            }
        };
        reader.readAsText(file);
    }


    // --- Render Functions ---

    function renderTable(data) {
        if (!data || data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">Không tìm thấy dữ liệu.</td></tr>';
            return;
        }

        tableBody.innerHTML = '';
        data.forEach(item => {
            const row = document.createElement('tr');
            row.dataset.id = item.id;

            // Chuyển đổi data thành chuỗi JSON để lưu trữ
            const jsonDataString = JSON.stringify(item.data, null, 2);
            row.dataset.jsonData = jsonDataString;

            row.innerHTML = `
                <td>${item.id}</td>
                <td><img src="https://placehold.co/60x60/1a1a1a/e0e0e0?text=${item.filename.substring(0,2)}" alt="${item.filename}"></td>
                <td>${item.filename}</td>
                <td>
                    <select class="status-select" data-id="${item.id}">
                        <option value="unverified" ${item.status === 'unverified' ? 'selected' : ''}>Chưa duyệt</option>
                        <option value="approved" ${item.status === 'approved' ? 'selected' : ''}>Đã duyệt</option>
                        <option value="rejected" ${item.status === 'rejected' ? 'selected' : ''}>Đã từ chối</option>
                    </select>
                </td>
                <td>
                    <button class="action-button edit-btn" data-id="${item.id}">Sửa JSON</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // --- Event Listeners ---

    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        mainContainer.classList.toggle('collapsed');
    });

    statusFilter.addEventListener('change', () => {
        fetchData(statusFilter.value, searchInput.value);
    });

    searchInput.addEventListener('input', () => {
        // Đơn giản là lọc lại sau mỗi lần gõ, hoặc có thể thêm debounce
        fetchData(statusFilter.value, searchInput.value);
    });
    
    jsonUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file && file.type === "application/json") {
            uploadJsonFile(file);
        } else {
            alert("Vui lòng chọn một tệp JSON hợp lệ.");
        }
    });

    tableBody.addEventListener('change', (event) => {
        if (event.target.classList.contains('status-select')) {
            const id = event.target.dataset.id;
            const newStatus = event.target.value;
            updateStatus(id, newStatus);
        }
    });

    tableBody.addEventListener('click', (event) => {
        if (event.target.classList.contains('edit-btn')) {
            const row = event.target.closest('tr');
            currentEditingId = row.dataset.id;
            const jsonData = row.dataset.jsonData;
            jsonEditorTextarea.value = jsonData;
            openModal();
        }
    });

    // Modal listeners
    closeButton.addEventListener('click', closeModal);
    cancelJsonButton.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    saveJsonButton.addEventListener('click', () => {
        try {
            const updatedJson = JSON.parse(jsonEditorTextarea.value);
            updateJsonData(currentEditingId, updatedJson);
        } catch (error) {
            alert("Lỗi cú pháp JSON. Vui lòng kiểm tra lại.");
        }
    });

    function openModal() {
        modal.style.display = 'flex';
    }

    function closeModal() {
        modal.style.display = 'none';
        currentEditingId = null;
    }

    // --- Initial Load ---
    // Thiết lập trạng thái ban đầu
    sidebar.classList.add('collapsed');
    mainContainer.classList.add('collapsed');
    fetchData();
});
