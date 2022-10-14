using ConsoleApp;

namespace ConsoleApp.MsTest;

[TestClass]
public class CalculatorTest
{
    [TestMethod]
    public void AddNumbers()
    {
        var calculator = new Calculator();
        var actual = calculator.Add(1, 2);
        Assert.AreEqual(3, actual);
    }
}
