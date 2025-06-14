Generate comprehensive tests for $ARGUMENTS.

Analyze the code and create tests that:

1. **Unit Tests**
   - Test individual functions/methods in isolation
   - Mock external dependencies appropriately
   - Cover happy path scenarios
   - Include edge cases and error conditions
   - Test boundary values

2. **Integration Tests**
   - Test component interactions
   - Verify data flow between modules
   - Test with real (or realistic) dependencies
   - Ensure proper error propagation

3. **Test Structure**
   - Use descriptive test names that explain what is being tested
   - Follow AAA pattern (Arrange, Act, Assert)
   - Group related tests logically
   - Include setup and teardown where needed

4. **Coverage Goals**
   - Aim for high code coverage but prioritize meaningful tests
   - Test all public APIs
   - Cover critical business logic thoroughly
   - Include regression tests for bug fixes

5. **Test Data**
   - Use realistic test data
   - Include edge cases (empty, null, maximum values)
   - Create fixtures for complex data structures
   - Ensure tests are deterministic

Generate the tests in the appropriate testing framework for this project, following existing patterns and conventions.