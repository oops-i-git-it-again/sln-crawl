using ConsoleApp;

namespace ConsoleApp.XUnit;

public class UnitTest1
{
    [Fact]
    public void AddNumbers()
    {
        var calculator = new Calculator();
        var actual = calculator.Add(1, 2);
        Assert.Equal(3, actual);
    }
}
