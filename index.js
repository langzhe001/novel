import JSZip from 'jszip';

/**
 * ============================================
 * 🎨 前端 UI (支持文件上传)
 * ============================================
 */
const HTML_UI = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>小说章节拆分器 (文件上传版)</title>
<style>
    :root { --primary: #0f766e; --bg: #f0fdfa; --surface: #ffffff; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: #333; display: flex; justify-content: center; padding: 20px; }
    .container { background: var(--surface); padding: 2rem; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); width: 100%; max-width: 500px; }
    h1 { text-align: center; color: #115e59; margin-bottom: 1.5rem; font-size: 1.5rem; }
    
    .form-group { margin-bottom: 1.25rem; }
    label { display: block; font-weight: 600; margin-bottom: 0.5rem; color: #374151; }
    
    /* 文件上传样式 */
    .file-upload { border: 2px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; cursor: pointer; transition: 0.2s; }
    .file-upload:hover { border-color: var(--primary); background: #f0fdfa; }
    input[type="file"] { display: none; }
    #fileName { margin-top: 10px; color: var(--primary); font-weight: bold; font-size: 0.9rem; }

    input[type="text"], input[type="number"] { width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; }
    
    button { width: 100%; background: var(--primary); color: white; padding: 1rem; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 1rem; margin-top: 1rem; }
    button:hover { background: #0d9488; }
    button:disabled { background: #94a3b8; cursor: wait; }

    #status { margin-top: 1rem; padding: 0.75rem; border-radius: 6px; display: none; text-align: center; font-size: 0.9rem; }
    .error { background: #fee2e2; color: #991b1b; }
    .success { background: #dcfce7; color: #166534; }
</style>
</head>
<body>
<div class="container">
    <h1>📄 TXT 小说拆分打包</h1>
    <form id="uploadForm">
        
        <div class="form-group">
            <label>上传小说文件 (.txt)</label>
            <div class="file-upload" onclick="document.getElementById('fileInput').click()">
                <span id="uploadText">点击选择文件</span>
                <input type="file" id="fileInput" accept=".txt" required>
                <div id="fileName"></div>
            </div>
        </div>

        <div class="form-group">
            <label>拆分设置</label>
            <div style="display: flex; gap: 10px;">
                <div style="flex:1">
                    <input type="number" id="splitCount" value="50" placeholder="每50章">
                    <div style="font-size:12px; color:#666; margin-top:4px;">每多少章</div>
                </div>
                <div style="flex:2">
                    <input type="text" id="regex" value="(第[零一二三四五六七八九十百千万0-9]+章[^\\n]*)">
                    <div style="font-size:12px; color:#666; margin-top:4px;">章节正则</div>
                </div>
            </div>
        </div>

        <button type="submit" id="submitBtn">开始处理并下载</button>
    </form>
    <div id="status"></div>
</div>

<script>
    const fileInput = document.getElementById('fileInput');
    const fileNameDisplay = document.getElementById('fileName');
    
    // 显示选中的文件名
    fileInput.addEventListener('change', (e) => {
        if (fileInput.files.length > 0) {
            fileNameDisplay.textContent = "已选: " + fileInput.files[0].name;
            document.getElementById('uploadText').textContent = "更换文件";
        }
    });

    document.getElementById('uploadForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (fileInput.files.length === 0) {
            alert('请先选择一个 TXT 文件！');
            return;
        }

        const btn = document.getElementById('submitBtn');
        const status = document.getElementById('status');
        
        btn.disabled = true;
        btn.textContent = '正在上传处理...';
        status.style.display = 'none';

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        formData.append('split', document.getElementById('splitCount').value);
        formData.append('regex', document.getElementById('regex').value);

        try {
            const res = await fetch(window.location.href, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText);
            }

            // 下载文件
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            // 获取上传的文件名（去掉后缀）
            let originalName = fileInput.files[0].name.replace(/\.[^/.]+$/, "");
            a.download = \`\${originalName}_split.zip\`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            
            status.className = 'success';
            status.textContent = '✅ 处理完成！已自动下载';
            status.style.display = 'block';

        } catch (error) {
            console.error(error);
            status.className = 'error';
            status.textContent = '❌ 失败: ' + error.message;
            status.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.textContent = '开始处理并下载';
        }
    });
</script>
</body>
</html>
`;

/**
 * ============================================
 * ⚙️ 后端逻辑 (处理 FormData)
 * ============================================
 */
export default {
    async fetch(request, env, ctx) {
        // 1. GET: 返回界面
        if (request.method === 'GET') {
            return new Response(HTML_UI, {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
        }

        // 2. POST: 处理文件
        if (request.method === 'POST') {
            try {
                // 解析 Multipart FormData
                const formData = await request.formData();
                const file = formData.get('file');
                const splitStr = formData.get('split');
                const regexStr = formData.get('regex');

                if (!file || !(file instanceof File)) {
                    throw new Error("请上传有效的 txt 文件");
                }

                // 读取文件内容 (Cloudflare Worker 支持 blob.text())
                // 注意：默认按 UTF-8 读取。如果小说是 GBK 编码可能会乱码，
                // 现在的浏览器和编辑器大多默认 UTF-8，这里不做复杂编码检测。
                const text = await file.text();

                // 正则处理
                const safeRegex = regexStr || "(第[零一二三四五六七八九十百千万0-9]+章[^\\n]*)";
                const regex = new RegExp(safeRegex, 'g');
                
                // 拆分逻辑
                const parts = text.split(regex);
                const chapters = [];
                
                // 处理“前言” (正则匹配前的部分)
                if (parts[0] && parts[0].trim()) {
                    chapters.push({ title: "序章/前言", content: parts[0] });
                }

                // 提取章节 (split 保留捕获组，结构为 [前文, 标题1, 内容1, 标题2, 内容2...])
                for (let i = 1; i < parts.length; i += 2) {
                    const title = (parts[i] || "").trim();
                    const content = (parts[i+1] || "").trim();
                    if (title && content) {
                        chapters.push({ title, content });
                    }
                }

                if (chapters.length === 0) {
                    // 如果没识别到章节，可能是正则不对，或者整个文件就是一章
                    // 这种情况下把整个文件当作一章
                    chapters.push({ title: "全文", content: text });
                }

                // 打包逻辑
                const splitSize = parseInt(splitStr) || 50;
                const zip = new JSZip();

                for (let i = 0; i < chapters.length; i += splitSize) {
                    const group = chapters.slice(i, i + splitSize);
                    
                    // 计算当前分卷的起始章节序号 (从1开始)
                    const startIdx = i + 1;
                    const endIdx = i + group.length;
                    
                    // 计算分卷号 (Part Index)，从1开始
                    const partNum = Math.floor(i / splitSize) + 1;

                    // 规范化文件名: px-0-50.txt (实际逻辑改为 p卷号-起始章-结束章)
                    // 例如: p1-1-50.txt
                    const filename = `p${partNum}-${startIdx}-${endIdx}.txt`;

                    // 拼接内容
                    const fileContent = group.map(c => `${c.title}\n\n${c.content}\n\n`).join("\n\n");
                    
                    zip.file(filename, fileContent);
                }

                const zipBlob = await zip.generateAsync({ type: "blob" });

                return new Response(zipBlob, {
                    headers: {
                        'Content-Type': 'application/zip',
                        'Content-Disposition': 'attachment; filename="download.zip"'
                    }
                });

            } catch (err) {
                return new Response("处理出错: " + err.message, { status: 500 });
            }
        }

        return new Response("Method not allowed", { status: 405 });
    }
};
