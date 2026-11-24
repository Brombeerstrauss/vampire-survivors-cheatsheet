// Tests the plugin's logic without the game: dotnet run -- minimap | grading | stagemap
public static class Program
{
    public static int Main(string[] args)
    {
        string test = args.Length > 0 ? args[0] : "";
        switch (test)
        {
            case "minimap": MinimapTest.Run(); return 0;
            case "grading": GradingTest.Run(); return 0;
            case "stagemap": StageMapTest.Run(); return 0;
            default:
                System.Console.WriteLine("Usage: dotnet run -- minimap | grading | stagemap");
                return 1;
        }
    }
}
