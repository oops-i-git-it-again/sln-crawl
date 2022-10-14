using ConsoleApp;

namespace ConsoleApp.NUnit;

public class CalculatorTest
{
    [Test]
    public void AddNumbers()
    {
        var calculator = new Calculator();
        var actual = calculator.Add(1, 2);
        Assert.AreEqual(3, actual);
    }
}
