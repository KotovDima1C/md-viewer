namespace MdViewer;

static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
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
