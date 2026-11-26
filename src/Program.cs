namespace MdViewer;

static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        // Неожиданная ошибка в окне — в журнал, а не системным диалогом «Unhandled exception»:
        // просмотрщик должен продолжать показывать документ.
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        Application.ThreadException += (_, e) => MainForm.LogError("app", e.Exception.ToString());
        AppDomain.CurrentDomain.UnhandledException += (_, e) => MainForm.LogError("app", e.ExceptionObject.ToString() ?? "");

        ApplicationConfiguration.Initialize();

        string? path = args.Length > 0 ? args[0] : null;
        if (path == null)
        {
            path = MainForm.AskForFile(null);
            if (path == null) return;
        }

        Application.Run(new MainForm(Path.GetFullPath(path)));
    }
}
