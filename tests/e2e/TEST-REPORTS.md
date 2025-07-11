# E2E Test Reports

Task Master's E2E tests now generate comprehensive test reports using Jest Stare, providing an interactive and visually appealing test report similar to Playwright's reporting capabilities.

## Test Report Formats

When you run `npm run test:e2e:jest`, the following reports are generated:

### 1. Jest Stare HTML Report
- **Location**: `test-results/index.html`
- **Features**:
  - Interactive dashboard with charts and graphs
  - Test execution timeline and performance metrics
  - Detailed failure messages with stack traces
  - Console output for each test
  - Search and filter capabilities
  - Pass/Fail/Skip statistics with visual charts
  - Test duration analysis
  - Collapsible test suites
  - Coverage link integration
  - Summary statistics

### 2. JSON Results
- **Location**: `test-results/jest-results.json`
- **Use Cases**:
  - Programmatic access to test results
  - Custom reporting tools
  - Test result analysis

### 3. JUnit XML Report
- **Location**: `test-results/e2e-junit.xml`
- **Use Cases**:
  - CI/CD integration
  - Test result parsing
  - Historical tracking

### 4. Console Output
- Standard Jest terminal output with verbose mode enabled

## Running Tests with Reports

```bash
# Run all E2E tests and generate reports
npm run test:e2e:jest

# View the HTML report
npm run test:e2e:jest:report

# Run specific tests
npm run test:e2e:jest:command "add-task"
```

## Report Configuration

The report configuration is defined in `jest.e2e.config.js`:

- **HTML Reporter**: Includes failure messages, console logs, and execution warnings
- **JUnit Reporter**: Includes console output and suite errors
- **Coverage**: Separate coverage directory at `coverage-e2e/`

## CI/CD Integration

The JUnit XML report can be consumed by CI tools like:
- Jenkins (JUnit plugin)
- GitHub Actions (test-reporter action)
- GitLab CI (artifact reports)
- CircleCI (test results)

## Ignored Files

The following are automatically ignored by git:
- `test-results/` directory
- `coverage-e2e/` directory
- Individual report files

## Viewing Historical Results

To keep historical test results:
1. Copy the `test-results` directory before running new tests
2. Use a timestamp suffix: `test-results-2024-01-15/`
3. Compare HTML reports side by side