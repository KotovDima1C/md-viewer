using System.Diagnostics;
using System.Net;
using System.Text;
using Markdig;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;

namespace MdViewer;

/// <summary>
/// Окно просмотра. Markdown рендерится в HTML через Markdig и отдаётся встроенному
/// движку Edge (WebView2) с виртуального адреса https://md.local/&lt;абсолютный путь&gt;,
/// поэтому относительные картинки и ссылки на соседние .md работают как в браузере.
/// JavaScript в странице выключен: чужой .md не сможет ничего выполнить.
/// </summary>
sealed class MainForm : Form
{
    const string Host = "md.local";
    const string Origin = "https://" + Host + "/";

    static readonly string[] MarkdownExt = [".md", ".markdown", ".mdown", ".mkd", ".mkdn", ".mdwn"];

    static readonly MarkdownPipeline Pipeline = new MarkdownPipelineBuilder()
        .UseAdvancedExtensions()   // таблицы, списки задач, сноски, автоссылки, якоря заголовков…
        .UseYamlFrontMatter()      // не показывать служебный блок --- … --- в начале файла
        .Build();

    static readonly Lazy<string> Css = new(() =>
    {
        using var s = typeof(MainForm).Assembly.GetManifestResourceStream("style.css")!;
        using var r = new StreamReader(s);
        return r.ReadToEnd();
    });

    static readonly string AppDataDir =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "md-viewer");

    // Контроллер движка создаём сами (без WinForms-обёртки), чтобы получать нажатия клавиш:
    // иначе Esc, Ctrl+W и прочие уходят в страницу и до окна не доходят.
    CoreWebView2Controller? ctl;
    CoreWebView2? Core => ctl?.CoreWebView2;
    readonly Color bg;
    readonly System.Windows.Forms.Timer reloadTimer = new() { Interval = 150 };
    readonly Task<string> firstRender;
    readonly string firstFile;
    string currentFile;
    FileSystemWatcher? watcher;

    public MainForm(string file)
    {
        firstFile = currentFile = file;
        // Рендерим Markdown параллельно с запуском движка — экономит время до первой картинки.
        firstRender = Task.Run(() => BuildPage(file));

        Text = Title(file);
        using (var ico = typeof(MainForm).Assembly.GetManifestResourceStream("app.ico"))
            if (ico != null) Icon = new Icon(ico); // все размеры: заголовок, панель задач, Alt+Tab
        AutoScaleMode = AutoScaleMode.Dpi;
        StartPosition = FormStartPosition.WindowsDefaultLocation;
        LoadBounds();

        bg = IsDarkTheme() ? Color.FromArgb(13, 17, 23) : Color.White;
        BackColor = bg; // без белой вспышки в тёмной теме

        reloadTimer.Tick += (_, _) => { reloadTimer.Stop(); Core?.Reload(); };
        FormClosing += (_, _) => SaveBounds();
        FormClosed += (_, _) => { watcher?.Dispose(); ctl?.Close(); };
        Resize += (_, _) =>
        {
            if (ctl == null) return;
            ctl.IsVisible = WindowState != FormWindowState.Minimized;
            ctl.Bounds = ClientRectangle;
        };
        Activated += (_, _) => ctl?.MoveFocus(CoreWebView2MoveFocusReason.Programmatic);

        _ = InitAsync();
    }

    async Task InitAsync()
    {
        try
        {
            var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(AppDataDir, "WebView2"));
            ctl = await env.CreateCoreWebView2ControllerAsync(Handle);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, "Не удалось запустить движок WebView2:\n" + ex.Message, "MD Viewer",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
            return;
        }

        ctl.DefaultBackgroundColor = bg;
        ctl.Bounds = ClientRectangle;
        ctl.AcceleratorKeyPressed += (_, e) =>
        {
            if (e.KeyEventKind is not (CoreWebView2KeyEventKind.KeyDown or CoreWebView2KeyEventKind.SystemKeyDown)) return;
            var keys = (Keys)e.VirtualKey | ModifierKeys;
            if (!OwnKeys.Contains(keys)) return;
            e.Handled = true;
            // Диалоги и закрытие — уже после выхода из обработчика движка
            BeginInvoke(() => HandleKey(keys));
        };
        ctl.MoveFocus(CoreWebView2MoveFocusReason.Programmatic);

        var core = ctl.CoreWebView2;
        core.Settings.IsScriptEnabled = false;
        core.Settings.AreDevToolsEnabled = false;
        core.Settings.IsWebMessageEnabled = false;
        core.Settings.AreHostObjectsAllowed = false;
        core.Settings.IsStatusBarEnabled = true; // адрес ссылки при наведении

        core.AddWebResourceRequestedFilter(Origin + "*", CoreWebView2WebResourceContext.All);
        core.WebResourceRequested += (_, e) => e.Response = Serve(env: core.Environment, e.Request.Uri);
        core.NavigationStarting += OnNavigationStarting;
        core.NewWindowRequested += (_, e) => { e.Handled = true; OpenOutside(e.Uri); };
        core.SourceChanged += (_, _) => OnPageChanged(core.Source);

        core.Navigate(PathToUrl(firstFile));
    }

    // ---------- отдача страниц и файлов ----------

    CoreWebView2WebResourceResponse Serve(CoreWebView2Environment env, string url)
    {
        var path = UrlToPath(url);
        if (path == null || !File.Exists(path))
            return Html(env, 404, Page("Файл не найден", $"<p>Нет файла <code>{WebUtility.HtmlEncode(path ?? url)}</code></p>"));

        try
        {
            if (IsMarkdown(path))
            {
                var html = path == firstFile && firstRender.IsCompletedSuccessfully && !reloadedOnce
                    ? firstRender.Result
                    : BuildPage(path);
                reloadedOnce |= path == firstFile;
                return Html(env, 200, html);
            }

            var bytes = ReadShared(path);
            return env.CreateWebResourceResponse(new MemoryStream(bytes), 200, "OK",
                "Content-Type: " + MimeType(path) + "\r\nCache-Control: no-cache");
        }
        catch (Exception ex)
        {
            return Html(env, 500, Page("Ошибка", $"<p>{WebUtility.HtmlEncode(ex.Message)}</p>"));
        }
    }
    bool reloadedOnce;

    static CoreWebView2WebResourceResponse Html(CoreWebView2Environment env, int status, string html) =>
        env.CreateWebResourceResponse(new MemoryStream(Encoding.UTF8.GetBytes(html)), status, status == 200 ? "OK" : "Error",
            "Content-Type: text/html; charset=utf-8\r\nCache-Control: no-cache");

    static string BuildPage(string path)
    {
        var text = Encoding.UTF8.GetString(ReadShared(path));
        if (text.Length > 0 && text[0] == '\uFEFF') text = text[1..];
        return Page(Path.GetFileName(path), Markdown.ToHtml(text, Pipeline));
    }

    static string Page(string title, string body) =>
        "<!doctype html><html lang=\"ru\"><head><meta charset=\"utf-8\">" +
        "<meta http-equiv=\"Content-Security-Policy\" content=\"script-src 'none'; object-src 'none'\">" +
        $"<title>{WebUtility.HtmlEncode(title)}</title><style>{Css.Value}</style></head>" +
        $"<body><article class=\"markdown-body\">{body}</article></body></html>";

    static byte[] ReadShared(string path)
    {
        using var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        using var ms = new MemoryStream();
        fs.CopyTo(ms);
        return ms.ToArray();
    }

    // ---------- навигация ----------

    void OnNavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri)) return;

        if (uri.Host == Host && uri.Scheme == "https")
        {
            var path = UrlToPath(e.Uri);
            if (path != null && !IsMarkdown(path) && File.Exists(path))
            {
                e.Cancel = true; // не-markdown файл (pdf, docx…) — открываем программой по умолчанию
                OpenOutside(path);
            }
            return;
        }

        e.Cancel = true;
        if (uri.IsFile)
        {
            // файл перетащили в окно
            if (IsMarkdown(uri.LocalPath)) Core!.Navigate(PathToUrl(uri.LocalPath));
            return;
        }
        if (uri.Scheme is "http" or "https" or "mailto") OpenOutside(e.Uri);
    }

    void OnPageChanged(string url)
    {
        var path = UrlToPath(url);
        if (path == null || !IsMarkdown(path)) return;
        currentFile = path;
        Text = Title(path);
        Watch(path);
    }

    void Watch(string path)
    {
        var dir = Path.GetDirectoryName(path);
        if (dir == null) return;
        if (watcher != null && watcher.Path == dir && watcher.Filter == Path.GetFileName(path)) return;
        watcher?.Dispose();
        try
        {
            watcher = new FileSystemWatcher(dir, Path.GetFileName(path))
            {
                NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.Size | NotifyFilters.FileName,
                SynchronizingObject = this,
                EnableRaisingEvents = true,
            };
            // Редакторы часто сохраняют через «записать временный и переименовать» — ловим оба случая.
            watcher.Changed += (_, _) => ScheduleReload();
            watcher.Created += (_, _) => ScheduleReload();
            watcher.Renamed += (_, _) => ScheduleReload();
        }
        catch { watcher = null; } // сетевые и прочие экзотические пути — просто без автообновления
    }

    void ScheduleReload() { reloadTimer.Stop(); reloadTimer.Start(); }

    // ---------- клавиши ----------

    protected override bool ProcessCmdKey(ref Message msg, Keys keyData) =>
        HandleKey(keyData) || base.ProcessCmdKey(ref msg, keyData);

    static readonly HashSet<Keys> OwnKeys =
    [
        Keys.Escape, Keys.Control | Keys.W, Keys.Control | Keys.O, Keys.Control | Keys.E,
        Keys.Control | Keys.D0, Keys.Control | Keys.NumPad0,
    ];

    bool HandleKey(Keys keyData)
    {
        switch (keyData)
        {
            case Keys.Escape:
            case Keys.Control | Keys.W:
                Close();
                return true;
            case Keys.Control | Keys.O:
                var p = AskForFile(Path.GetDirectoryName(currentFile));
                if (p != null) Core?.Navigate(PathToUrl(p));
                return true;
            case Keys.Control | Keys.E:
                OpenOutside(currentFile, edit: true);
                return true;
            case Keys.Control | Keys.D0:
            case Keys.Control | Keys.NumPad0:
                if (ctl != null) ctl.ZoomFactor = 1;
                return true;
        }
        return false;
    }

    public static string? AskForFile(string? dir)
    {
        using var dlg = new OpenFileDialog
        {
            Title = "Открыть Markdown",
            Filter = "Markdown|*.md;*.markdown;*.mdown;*.mkd;*.mkdn;*.mdwn|Все файлы|*.*",
            InitialDirectory = dir ?? "",
        };
        return dlg.ShowDialog() == DialogResult.OK ? dlg.FileName : null;
    }

    static void OpenOutside(string target, bool edit = false)
    {
        try
        {
            if (edit)
                Process.Start(new ProcessStartInfo("notepad.exe", $"\"{target}\"") { UseShellExecute = true });
            else
                Process.Start(new ProcessStartInfo(target) { UseShellExecute = true });
        }
        catch { /* нет программы для такого типа — молча игнорируем */ }
    }

    // ---------- адреса ----------

    // C:\Docs\a b.md  →  https://md.local/C%3A/Docs/a%20b.md
    // \\srv\share\x.md →  https://md.local/UNC/srv/share/x.md
    static string PathToUrl(string path)
    {
        path = Path.GetFullPath(path);
        string rest = path.StartsWith(@"\\") ? "UNC\\" + path[2..] : path;
        return Origin + string.Join("/", rest.Split('\\').Select(Uri.EscapeDataString));
    }

    static string? UrlToPath(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Host != Host) return null;
        var parts = uri.AbsolutePath.TrimStart('/').Split('/').Select(Uri.UnescapeDataString).ToArray();
        if (parts.Length == 0) return null;
        var path = parts[0] == "UNC" ? @"\\" + string.Join('\\', parts[1..]) : string.Join('\\', parts);
        if (!Path.IsPathFullyQualified(path)) return null;
        try { return Path.GetFullPath(path); } catch { return null; }
    }

    static bool IsMarkdown(string path) =>
        MarkdownExt.Contains(Path.GetExtension(path), StringComparer.OrdinalIgnoreCase);

    static string MimeType(string path) => Path.GetExtension(path).ToLowerInvariant() switch
    {
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".gif" => "image/gif",
        ".webp" => "image/webp",
        ".svg" => "image/svg+xml",
        ".bmp" => "image/bmp",
        ".ico" => "image/x-icon",
        ".avif" => "image/avif",
        ".css" => "text/css",
        ".txt" => "text/plain; charset=utf-8",
        ".mp4" => "video/mp4",
        ".webm" => "video/webm",
        ".mp3" => "audio/mpeg",
        _ => "application/octet-stream",
    };

    static string Title(string path) => Path.GetFileName(path) + " — MD Viewer";

    // ---------- окно ----------

    static bool IsDarkTheme()
    {
        try
        {
            var v = Registry.GetValue(@"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize",
                "AppsUseLightTheme", 1);
            return v is int i && i == 0;
        }
        catch { return false; }
    }

    static string BoundsFile => Path.Combine(AppDataDir, "window.txt");

    void LoadBounds()
    {
        var area = Screen.PrimaryScreen?.WorkingArea ?? new Rectangle(0, 0, 1280, 800);
        Size = new Size(Math.Min(1000, area.Width - 40), Math.Min(1100, area.Height - 40));
        try
        {
            var n = File.ReadAllText(BoundsFile).Split(',').Select(int.Parse).ToArray();
            var r = new Rectangle(n[0], n[1], n[2], n[3]);
            if (Screen.AllScreens.Any(s => s.WorkingArea.IntersectsWith(r)) && r.Width > 200 && r.Height > 200)
            {
                StartPosition = FormStartPosition.Manual;
                Bounds = r;
            }
            if (n.Length > 4 && n[4] == 1) WindowState = FormWindowState.Maximized;
        }
        catch { /* первый запуск */ }
    }

    void SaveBounds()
    {
        try
        {
            var r = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
            Directory.CreateDirectory(AppDataDir);
            File.WriteAllText(BoundsFile,
                $"{r.X},{r.Y},{r.Width},{r.Height},{(WindowState == FormWindowState.Maximized ? 1 : 0)}");
        }
        catch { }
    }
}
