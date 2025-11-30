import JSZip from 'jszip';

/**
 * ============================================
 * 🎨 前端 UI 页面 (HTML/CSS/JS)
 * ============================================
 */
const HTML_UI = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cloudflare 小说拆分器</title>
<style>
    :root { --primary: #2563eb; --bg: #f8fafc; --surface: #ffffff; --text: #334155; }
    body { font-family: -apple-system, sans-serif; background: var(--bg); color: var(--text); display: flex; justify-content: center; padding: 20px; margin: 0; }
    .container { background: var(--surface); padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); width: 100%; max-width: 600px; }
    h1 { text-align: center; color: #1e293b; margin-bottom: 1.5rem; }
    label { display: block; font-weight: 600; margin-bottom: 0.5rem; margin-top: 1rem; }
    input, textarea { width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; }
    input:focus, textarea:focus { outline: 2px solid var(--primary); border-color: transparent; }
    .row { display: flex; gap: 1rem; }
    .col { flex: 1; }
    button { width: 100%; background: var(--primary); color: white; padding: 1rem; border: none; border-radius: 6px; font-weight: bold; margin-top: 2rem; cursor: pointer; transition: 0.2s; }
    button:hover { background: #1d4ed8; }
    button:disabled { background: #94a3b8; cursor: not-allowed; }
    #status { margin-top: 1rem; padding: 1rem; border-radius: 6px; display: none; text-align: center; }
    .success { background: #dcfce7; color: #166534; }
    .error { background: #fee2e2; color: #991b1b; }
    .hint { font-size: 0.85rem; color: #64748b; margin-top: 0.25rem; }
</style>
</head>
<body>
<div class="container">
    <h1>📚 小说章节拆分打包器</h1>
    <form id="appForm">
        <label>方式一：粘贴文本</label>
        <textarea id="text" rows="6" placeholder="在此粘贴小说内容..."></textarea>

        <label>方式二：TXT 下载链接 (可选)</label>
        <input type="url" id="url" placeholder="https://example.com/novel.txt">
        <div class="hint">如果填写了链接，将忽略上方粘贴的文本。</div>

        <div class="row">
            <div class="col">
                <label>每多少章打包</label>
                <input type="number" id="split" value="50" min="1">
            </div>
            <div class="col">
                <label>拆分后格式</label>
                <input type="text" value=".txt" disabled>
            </div>
        </div>

        <label>章节识别正则</label>
        <input type="text" id="regex" value="(第[零一二三四五六七八九十百千万0-9]+章[^\\n]*)">
        <div class="hint">默认可识别：第1章、第一章、第一百章 标题</div>

        <button type="submit" id="btn">🚀 开始拆分并下载 ZIP</button>
    </form>
    <div id="status"></div>
</div>

<script>
    document.getElementById('appForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn');
        const status = document.getElementById('status');
        const textVal = document.getElementById('text').value;
        const urlVal = document.getElementById('url').value;
        
        if (!textVal && !urlVal) {
            alert('请粘贴文本或提供下载链接！');
            return;
        }

        btn.disabled = true;
        btn.innerText = '处理中 (大文件可能需要几十秒)...';
        status.style.display = 'none';

        try {
            const res = await fetch(window.location.href, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: textVal,
                    url: urlVal,
                    split: document.getElementById('split').value,
                    regex: document.getElementById('regex').value
                })
            });

            if (!res.ok) throw new Error(await res.text());

            // 触发下载
            const blob = await res.blob();
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = "novel_chapters.zip";
            link.click();

            status.className = 'success';
            status.innerText = '✅ 成功！下载已开始。';
            status.style.display = 'block';
        } catch (err) {
            status.className = 'error';
            status.innerText = '❌ 错误: ' + err.message;
            status.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.innerText = '🚀 开始拆分并下载 ZIP';
        }
    });
</script>
</body>
</html>
`;

/**
 * ============================================
 * ⚙️ 后端逻辑 (Worker)
 * ============================================
 */
export default {
    async fetch(request, env, ctx) {
        // 1. GET 请求：返回前端页面
        if (request.method === 'GET') {
            return new Response(HTML_UI, {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
        }

        // 2. POST 请求：处理拆分逻辑
        if (request.method === 'POST') {
            try {
                const body = await request.json();
                let fullText = body.text || "";

                // 如果有 URL，优先下载 URL 内容
                if (body.url) {
                    const dlRes = await fetch(body.url);
                    if (!dlRes.ok) throw new Error("无法下载该链接的文件");
                    fullText = await dlRes.text();
                }

                if (!fullText) throw new Error("没有内容可拆分");

                // 识别章节
                // 我们给正则加上 'g' 标志，并尝试分割
                const regexStr = body.regex || "(第[零一二三四五六七八九十百千万0-9]+章[^\\n]*)";
                const regex = new RegExp(regexStr, 'g');
                
                // 使用 split 分割，保留捕获组（章节名）
                // split结果通常是: [前言, 章节名1, 内容1, 章节名2, 内容2...]
                const parts = fullText.split(regex);
                
                const chapters = [];
                // 如果第一个部分有内容但不是章节名（如序章前的内容），归为“前言”
                if (parts[0] && parts[0].trim()) {
                    chapters.push({ title: "000_前言", content: parts[0] });
                }

                for (let i = 1; i < parts.length; i += 2) {
                    const title = (parts[i] || "未知章节").trim();
                    const content = (parts[i+1] || "").trim();
                    if (content) {
                        chapters.push({ title, content });
                    }
                }

                if (chapters.length === 0) throw new Error("未识别到任何章节，请检查正则表达式");

                // 分组并打包
                const splitSize = parseInt(body.split) || 50;
                const zip = new JSZip();
                
                for (let i = 0; i < chapters.length; i += splitSize) {
                    const group = chapters.slice(i, i + splitSize);
                    const groupTitle = `Part_${Math.floor(i/splitSize)+1}_${group[0].title}_to_${group[group.length-1].title}.txt`;
                    
                    // 过滤文件名中的非法字符
                    const safeTitle = groupTitle.replace(/[\\/:*?"<>|]/g, '_');
                    
                    // 拼接内容
                    const fileContent = group.map(c => `${c.title}\n\n${c.content}\n\n`).join("- - - - -\n\n");
                    
                    zip.file(safeTitle, fileContent);
                }

                // 生成二进制流
                const zipBlob = await zip.generateAsync({ type: "blob" });

                return new Response(zipBlob, {
                    headers: {
                        'Content-Type': 'application/zip',
                        'Content-Disposition': 'attachment; filename="novel_chapters.zip"'
                    }
                });

            } catch (err) {
                return new Response(err.message, { status: 400 });
            }
        }

        return new Response("Method not allowed", { status: 405 });
    }
};
