document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    const mainContainer = document.querySelector('.main-container');
    const sidebarToggle = document.getElementById('sidebar-toggle');

    const tableBody = document.getElementById('data-table-body');
    const statusFilter = document.getElementById('status-filter');
    const searchInput = document.getElementById('search-input');
    const modal = document.getElementById('json-editor-modal');
    const closeButton = document.querySelector('.close-button');
    const saveJsonButton = document.getElementById('save-json-button');
    const cancelJsonButton = document.getElementById('cancel-json-button');
    const jsonEditorTextarea = document.getElementById('json-editor-textarea');

    let currentEditingId = null;

    // --- SEARCH ẢNH THỦ CÔNG ---
    const searchBtn = document.getElementById('search-btn');
    const searchInputBar = document.getElementById('search-input');
    const previewImg = document.getElementById('preview-img');

    async function searchAndShowImage() {
        const searchTerm = searchInputBar.value.trim();
        const imageListDiv = document.getElementById('image-list');
        try {
            const params = new URLSearchParams();
            params.append('status', 'all');
            if (searchTerm) params.append('search', searchTerm);
            const response = await fetch(`/api/images?${params.toString()}`);
            if (!response.ok) throw new Error('Lỗi mạng');
            const data = await response.json();
            // Hiển thị ảnh đầu tiên
            if (data && data.length > 0) {
                previewImg.src = `https://haru-bot.minzinccs1.workers.dev/${data[0].filename}`;
                previewImg.alt = data[0].filename;
            } else {
                previewImg.src = '';
                previewImg.alt = 'Không tìm thấy ảnh';
            }
            // Hiển thị danh sách ảnh
            if (imageListDiv) {
                if (data && data.length > 0) {
                    imageListDiv.innerHTML = data.map(item => `
                        <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #444;">
                            <img src="https://haru-bot.minzinccs1.workers.dev/${item.filename}" alt="${item.filename}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;border:1px solid #555;">
                            <div style="flex:1;">
                                <div style="color:#e0e0e0;font-size:15px;">${item.filename}</div>
                                <div style="color:#aaa;font-size:13px;">
                                    ${item.data?.type ? `Type: ${item.data.type}` : ''} 
                                    ${item.data?.score !== undefined ? `| Điểm: ${item.data.score}` : ''}
                                </div>
                            </div>
                        </div>
                    `).join('');
                } else {
                    imageListDiv.innerHTML = '<div style="color:#aaa;padding:8px;">Không tìm thấy ảnh nào.</div>';
                }
            }
        } catch (e) {
            previewImg.src = '';
            previewImg.alt = 'Lỗi khi tìm ảnh';
            if (imageListDiv) imageListDiv.innerHTML = '<div style="color:#aaa;padding:8px;">Lỗi khi tìm ảnh.</div>';
        }
    }

    const randomBtn = document.getElementById('random-btn');
    if (searchBtn && searchInputBar) {
        searchBtn.addEventListener('click', searchAndShowImage);
        searchInputBar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') searchAndShowImage();
        });
    }

    // Function để setup database
    async function setupDatabase() {
        try {
            const response = await fetch('/api/setup', { method: 'POST' });
            const result = await response.json();
            if (result.success) {
                console.log('Database setup successful:', result.message);
                return true;
            } else {
                console.error('Database setup failed:', result.error);
                return false;
            }
        } catch (e) {
            console.error('Error setting up database:', e);
            return false;
        }
    }

    // Thêm event listener cho nút setup
    const setupBtn = document.getElementById('setup-btn');
    if (setupBtn) {
        setupBtn.addEventListener('click', async () => {
            try {
                const success = await setupDatabase();
                if (success) {
                    alert('✅ Database đã được setup thành công!');
                } else {
                    alert('❌ Lỗi khi setup database. Vui lòng thử lại.');
                }
            } catch (e) {
                console.error('Setup error:', e);
                alert('❌ Lỗi khi setup database: ' + e.message);
            }
        });
    }

    // Thêm event listener cho nút upload JSON
    const uploadBtn = document.getElementById('upload-btn');
    const jsonUpload = document.getElementById('json-upload');
    
    if (uploadBtn && jsonUpload) {
        uploadBtn.addEventListener('click', () => {
            jsonUpload.click();
        });

        jsonUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const jsonData = JSON.parse(text);
                
                if (!Array.isArray(jsonData)) {
                    alert('❌ File JSON phải chứa một mảng dữ liệu.');
                    return;
                }

                // Gửi dữ liệu lên server
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(jsonData)
                });

                const result = await response.json();
                if (result.success) {
                    alert(`✅ Upload thành công ${jsonData.length} ảnh!`);
                    // Refresh danh sách
                    if (randomBtn) {
                        randomBtn.click();
                    }
                } else {
                    alert('❌ Lỗi khi upload: ' + (result.error || 'Unknown error'));
                }
            } catch (e) {
                console.error('Upload error:', e);
                alert('❌ Lỗi khi đọc file JSON: ' + e.message);
            }
        });
    }

    if (randomBtn) {
        randomBtn.addEventListener('click', async () => {
            const imageListDiv = document.getElementById('image-list');
            try {
                const params = new URLSearchParams();
                params.append('status', 'unverified');
                const response = await fetch(`/api/images?${params.toString()}`);
                if (!response.ok) {
                    // Nếu có lỗi, thử setup database
                    if (response.status === 500) {
                        const setupSuccess = await setupDatabase();
                        if (setupSuccess) {
                            // Thử lại sau khi setup
                            const retryResponse = await fetch(`/api/images?${params.toString()}`);
                            if (!retryResponse.ok) throw new Error('Lỗi mạng');
                            const data = await retryResponse.json();
                            if (data && data.length > 0) {
                                const pick = data[Math.floor(Math.random() * data.length)];
                                previewImg.src = `https://haru-bot.minzinccs1.workers.dev/${pick.filename}`;
                                previewImg.alt = pick.filename;
                                if (imageListDiv) {
                                    imageListDiv.innerHTML = data.map(item => `
                                        <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #444;${item.id===pick.id?'background:#222;':''}">
                                            <img src="https://haru-bot.minzinccs1.workers.dev/${item.filename}" alt="${item.filename}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;border:1px solid #555;">
                                            <div style="flex:1;">
                                                <div style="color:#e0e0e0;font-size:15px;">${item.filename}</div>
                                                <div style="color:#aaa;font-size:13px;">
                                                    ${item.data?.type ? `Type: ${item.data.type}` : ''} 
                                                    ${item.data?.score !== undefined ? `| Điểm: ${item.data.score}` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    `).join('');
                                }
                                return;
                            }
                        }
                    }
                    throw new Error('Lỗi mạng');
                }
                const data = await response.json();
                if (data && data.length > 0) {
                    const pick = data[Math.floor(Math.random() * data.length)];
                    previewImg.src = `https://haru-bot.minzinccs1.workers.dev/${pick.filename}`;
                    previewImg.alt = pick.filename;
                    // Hiển thị danh sách ảnh, highlight ảnh random
                    if (imageListDiv) {
                        imageListDiv.innerHTML = data.map(item => `
                            <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #444;${item.id===pick.id?'background:#222;':''}">
                                <img src="https://haru-bot.minzinccs1.workers.dev/${item.filename}" alt="${item.filename}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;border:1px solid #555;">
                                <div style="flex:1;">
                                    <div style="color:#e0e0e0;font-size:15px;">${item.filename}</div>
                                    <div style="color:#aaa;font-size:13px;">
                                        ${item.data?.type ? `Type: ${item.data.type}` : ''} 
                                        ${item.data?.score !== undefined ? `| Điểm: ${item.data.score}` : ''}
                                    </div>
                                </div>
                            </div>
                        `).join('');
                    }
                } else {
                    previewImg.src = '';
                    previewImg.alt = 'Không tìm thấy ảnh chưa duyệt';
                    if (imageListDiv) imageListDiv.innerHTML = '<div style="color:#aaa;padding:8px;">Không tìm thấy ảnh chưa duyệt. Có thể bảng curation_pool đang trống hoặc chưa có ảnh nào có status="unverified".</div>';
                }
            } catch (e) {
                console.error('Error in random button:', e);
                previewImg.src = '';
                previewImg.alt = 'Lỗi khi random ảnh';
                if (imageListDiv) imageListDiv.innerHTML = '<div style="color:#aaa;padding:8px;">Lỗi khi random ảnh. Vui lòng thử lại hoặc liên hệ admin.</div>';
            }
        });
    }

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
    // Thiết lập trạng thái ban đầu bằng cách kích hoạt sự kiện click
    sidebarToggle.click();
    fetchData();
});
