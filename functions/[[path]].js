// API đa năng cho Haru Manager

export async function onRequest(context) {
    // context chứa thông tin về request, env (biến môi trường), ...
    const { request, env } = context;
    const url = new URL(request.url);

    // Phân tích đường dẫn để xác định hành động
    // Ví dụ: /api/images, /api/images/123, ...
    const path = url.pathname;

    // Lấy D1 binding từ biến môi trường
    const db = env.DB;

    // --- Xử lý các phương thức HTTP ---

    if (request.method === 'GET' && path.startsWith('/api/images')) {
        try {
            const status = url.searchParams.get('status') || 'unverified';
            const searchTerm = url.searchParams.get('search') || '';

            let query;
            let params = [];

            if (status === 'all') {
                query = "SELECT id, filename, status, data FROM curation_pool WHERE filename LIKE ? ORDER BY id DESC";
                params.push(`%${searchTerm}%`);
            } else {
                query = "SELECT id, filename, status, data FROM curation_pool WHERE status = ? AND filename LIKE ? ORDER BY id DESC";
                params.push(status, `%${searchTerm}%`);
            }

            const stmt = db.prepare(query).bind(...params);
            const { results } = await stmt.all();
            
            // Parse chuỗi JSON trong cột 'data' thành object
            const data = results.map(item => ({
                ...item,
                data: JSON.parse(item.data)
            }));

            return new Response(JSON.stringify(data), {
                headers: { 'Content-Type': 'application/json' },
            });

        } catch (e) {
            console.error("Lỗi D1:", e);
            return new Response(JSON.stringify({ error: e.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    }

    if (request.method === 'POST' && path.startsWith('/api/upload')) {
        try {
            const jsonData = await request.json();
            if (!Array.isArray(jsonData)) {
                return new Response(JSON.stringify({ error: 'Dữ liệu JSON phải là một mảng.' }), { status: 400 });
            }

            const stmts = jsonData.map(item => {
                const filename = item.original_filename;
                const data = JSON.stringify(item);
                return db.prepare("INSERT INTO curation_pool (filename, data, status) VALUES (?, ?, 'unverified')").bind(filename, data);
            });

            await db.batch(stmts);

            return new Response(JSON.stringify({ success: true, message: `Nạp thành công ${stmts.length} ảnh.` }), {
                headers: { 'Content-Type': 'application/json' },
            });

        } catch (e) {
            console.error("Lỗi khi tải lên JSON:", e);
            return new Response(JSON.stringify({ error: e.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    }

    if (request.method === 'PUT' && path.startsWith('/api/images')) {
        try {
            const id = path.split('/').pop();
            if (!id) {
                return new Response(JSON.stringify({ error: 'Thiếu ID ảnh.' }), { status: 400 });
            }

            const body = await request.json();
            let stmt;

            if (body.status) {
                // Cập nhật trạng thái
                stmt = db.prepare("UPDATE curation_pool SET status = ? WHERE id = ?").bind(body.status, id);
            } else if (body.data) {
                // Cập nhật dữ liệu JSON
                const jsonDataString = JSON.stringify(body.data);
                stmt = db.prepare("UPDATE curation_pool SET data = ? WHERE id = ?").bind(jsonDataString, id);
            } else {
                return new Response(JSON.stringify({ error: 'Không có dữ liệu hợp lệ để cập nhật.' }), { status: 400 });
            }

            await stmt.run();

            return new Response(JSON.stringify({ success: true, message: `Cập nhật thành công ID ${id}.` }), {
                headers: { 'Content-Type': 'application/json' },
            });

        } catch (e) {
            console.error("Lỗi D1 khi cập nhật:", e);
            return new Response(JSON.stringify({ error: e.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    }


    // Nếu không phải là một route API đã biết, chuyển yêu cầu cho Pages
    // để nó có thể phục vụ các tệp tĩnh như index.html
    return context.next();
}
