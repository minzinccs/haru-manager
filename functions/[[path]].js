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

    // Endpoint để tạo bảng curation_pool
    if (request.method === 'POST' && path === '/api/setup') {
        try {
            const statements = [
                `CREATE TABLE IF NOT EXISTS curation_pool (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename TEXT NOT NULL,
                    data TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'unverified'
                );`,
                `CREATE INDEX IF NOT EXISTS idx_curation_status ON curation_pool (status);`,
                `CREATE INDEX IF NOT EXISTS idx_curation_filename ON curation_pool (filename);`
            ];

            for (const sql of statements) {
                const stmt = db.prepare(sql);
                await stmt.run();
            }

            return new Response(JSON.stringify({ 
                success: true, 
                message: "✅ Đã tạo thành công bảng `curation_pool` và các chỉ mục cần thiết." 
            }), {
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (e) {
            console.error("Lỗi khi thiết lập DB:", e);
            return new Response(JSON.stringify({ error: e.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    }

    // Endpoint để kiểm tra trạng thái database
    if (request.method === 'GET' && path === '/api/status') {
        try {
            // Kiểm tra xem bảng curation_pool có tồn tại không
            const checkTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='curation_pool'");
            const tableExists = await checkTable.first();
            
            if (!tableExists) {
                return new Response(JSON.stringify({ 
                    status: 'missing_table',
                    message: "Bảng curation_pool chưa tồn tại. Vui lòng chạy setup trước."
                }), {
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            // Đếm số lượng bản ghi
            const countQuery = db.prepare("SELECT COUNT(*) as count FROM curation_pool");
            const countResult = await countQuery.first();
            const totalCount = countResult.count;

            // Đếm theo status
            const statusQuery = db.prepare("SELECT status, COUNT(*) as count FROM curation_pool GROUP BY status");
            const statusResults = await statusQuery.all();

            return new Response(JSON.stringify({ 
                status: 'ok',
                table_exists: true,
                total_count: totalCount,
                status_breakdown: statusResults.results
            }), {
                headers: { 'Content-Type': 'application/json' },
            });

        } catch (e) {
            console.error("Lỗi khi kiểm tra status:", e);
            return new Response(JSON.stringify({ error: e.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    }

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

            console.log('Executing query:', query, 'with params:', params);

            const stmt = db.prepare(query).bind(...params);
            const { results } = await stmt.all();
            
            console.log('Query results:', results);

            // Parse chuỗi JSON trong cột 'data' thành object
            const data = results.map(item => ({
                ...item,
                data: item.data ? JSON.parse(item.data) : {}
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
                const filename = item.new_filename || item.original_filename;
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
                await stmt.run();
                
                // Đồng bộ status sang bảng images
                const imageStmt = db.prepare(`
                    UPDATE images 
                    SET status = ? 
                    WHERE file_name = (
                        SELECT filename 
                        FROM curation_pool 
                        WHERE id = ?
                    )
                `).bind(body.status, id);
                await imageStmt.run();
                
            } else if (body.data) {
                // Cập nhật dữ liệu JSON
                const jsonDataString = JSON.stringify(body.data);
                stmt = db.prepare("UPDATE curation_pool SET data = ? WHERE id = ?").bind(jsonDataString, id);
                await stmt.run();
            } else {
                return new Response(JSON.stringify({ error: 'Không có dữ liệu hợp lệ để cập nhật.' }), { status: 400 });
            }

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
