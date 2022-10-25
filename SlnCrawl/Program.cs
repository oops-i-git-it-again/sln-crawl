using Microsoft.Build.Locator;

var vsInstances = MSBuildLocator.QueryVisualStudioInstances();
Console.WriteLine($"{vsInstances.Count()} Visual Studio instances.");
