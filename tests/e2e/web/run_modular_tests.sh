#!/bin/bash
set -eo pipefail

# Task Master Web API - Modular E2E Test Runner
# Executes individual test suites or all tests with comprehensive reporting

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_PORT=3002
SERVER_URL="http://localhost:$TEST_PORT"

# Test suite definitions (using parallel arrays)
TEST_SUITE_NAMES=(
    "core"
    "subtasks" 
    "expansion"
    "dependencies"
    "movement"
    "tags"
    "analysis"
    "errors"
)

TEST_SUITE_FILES=(
    "test_core_task_operations.sh"
    "test_subtask_operations.sh"
    "test_task_expansion.sh"
    "test_dependency_management.sh"
    "test_task_movement.sh"
    "test_tag_management.sh"
    "test_analysis_research.sh"
    "test_error_handling.sh"
)

# Test results tracking
TEST_RESULTS_NAMES=()
TEST_RESULTS_STATUS=()
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
START_TIME=$(date +%s)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function to get test file by suite name
get_test_file() {
    local suite_name="$1"
    for i in "${!TEST_SUITE_NAMES[@]}"; do
        if [ "${TEST_SUITE_NAMES[$i]}" = "$suite_name" ]; then
            echo "${TEST_SUITE_FILES[$i]}"
            return 0
        fi
    done
    return 1
}

# Helper function to check if suite name is valid
is_valid_suite() {
    local suite_name="$1"
    for name in "${TEST_SUITE_NAMES[@]}"; do
        if [ "$name" = "$suite_name" ]; then
            return 0
        fi
    done
    return 1
}

# Helper function to record test result
record_test_result() {
    local suite_name="$1"
    local status="$2"
    TEST_RESULTS_NAMES+=("$suite_name")
    TEST_RESULTS_STATUS+=("$status")
}

# Helper function to get test result
get_test_result() {
    local suite_name="$1"
    for i in "${!TEST_RESULTS_NAMES[@]}"; do
        if [ "${TEST_RESULTS_NAMES[$i]}" = "$suite_name" ]; then
            echo "${TEST_RESULTS_STATUS[$i]}"
            return 0
        fi
    done
    echo "UNKNOWN"
}

# Usage information
show_usage() {
    echo "Usage: $0 [OPTIONS] [TEST_SUITE...]"
    echo ""
    echo "Run Task Master Web API modular E2E tests"
    echo ""
    echo "Options:"
    echo "  -h, --help        Show this help message"
    echo "  -l, --list        List available test suites"
    echo "  -a, --all         Run all test suites (default)"
    echo "  -v, --verbose     Enable verbose output"
    echo "  -q, --quiet       Suppress test output (show only summary)"
    echo "  --port PORT       Use custom port (default: 3002)"
    echo "  --no-server-check Skip server availability check"
    echo "  --parallel        Run tests in parallel (experimental - not recommended for AI-heavy tests)"
    echo ""
    echo "⚠️  Note: Parallel execution is not recommended due to AI service bottlenecks"
    echo "   and single server limitations. Sequential execution is more reliable."
    echo ""
    echo "Test Suites:"
    for i in "${!TEST_SUITE_NAMES[@]}"; do
        local suite="${TEST_SUITE_NAMES[$i]}"
        local file="${TEST_SUITE_FILES[$i]}"
        echo "  $suite            ${file%.*}"
    done
    echo ""
    echo "Examples:"
    echo "  $0                     # Run all tests sequentially (recommended)"
    echo "  $0 core subtasks       # Run specific test suites"
    echo "  $0 --verbose errors    # Run error tests with verbose output"
    echo "  $0 --quiet --all       # Run all tests with minimal output"
    echo ""
    echo "Advanced (use with caution):"
    echo "  $0 --parallel tags movement  # Parallel execution (may cause server issues)"
}

# List available test suites
list_test_suites() {
    echo "Available test suites:"
    echo ""
    for i in "${!TEST_SUITE_NAMES[@]}"; do
        local suite="${TEST_SUITE_NAMES[$i]}"
        local file="${TEST_SUITE_FILES[$i]}"
        local description=""
        if [ -f "$SCRIPT_DIR/$file" ]; then
            description=$(grep -m1 "# Tests" "$SCRIPT_DIR/$file" | sed 's/^# Tests//' | xargs)
        fi
        printf "  %-12s %s\n" "$suite" "$description"
    done
}

# Check if server is running and accessible
check_server() {
    echo -e "${BLUE}🔍 Checking server availability...${NC}"
    
    if ! curl -s --connect-timeout 5 "$SERVER_URL/api/health" >/dev/null 2>&1; then
        echo -e "${RED}❌ Server not accessible at $SERVER_URL${NC}"
        echo ""
        echo "Please start the web server in test mode first:"
          echo "  npm run start:web:test"
  echo "  OR"
  echo "  node web/server.js --port=$TEST_PORT --daemon"
        echo ""
        exit 1
    fi
    
    # Verify test mode
    local health_response=$(curl -s "$SERVER_URL/api/health" 2>/dev/null || echo '{}')
    echo -e "${GREEN}✅ Server is accessible and ready for testing${NC}"
    echo ""
}

# Run a single test suite
run_test_suite() {
    local suite_name="$1"
    local test_file="$2"
    local verbose="$3"
    local quiet="$4"
    
    echo -e "${BLUE}🧪 Running test suite: $suite_name${NC}"
    echo "   File: $test_file"
    echo ""
    
    local test_start_time=$(date +%s)
    local output_file="/tmp/taskmaster_test_${suite_name}_$$.log"
    local exit_code=0
    
    # Run the test and capture output
    if [ "$quiet" = "true" ]; then
        bash "$SCRIPT_DIR/$test_file" > "$output_file" 2>&1 || exit_code=$?
    elif [ "$verbose" = "true" ]; then
        bash "$SCRIPT_DIR/$test_file" 2>&1 | tee "$output_file" || exit_code=$?
    else
        bash "$SCRIPT_DIR/$test_file" > "$output_file" 2>&1 || exit_code=$?
        # Show just the summary lines
        grep -E "(✅|❌|🎉|===)" "$output_file" || true
    fi
    
    local test_end_time=$(date +%s)
    local test_duration=$((test_end_time - test_start_time))
    
    # Record results
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ $exit_code -eq 0 ]; then
        record_test_result "$suite_name" "PASSED"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✅ $suite_name completed successfully${NC} (${test_duration}s)"
    else
        record_test_result "$suite_name" "FAILED"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "${RED}❌ $suite_name failed${NC} (${test_duration}s)"
        
        # Show failure details if not verbose
        if [ "$verbose" != "true" ] && [ "$quiet" != "true" ]; then
            echo "   Last few lines of output:"
            tail -n 10 "$output_file" | sed 's/^/   /'
        fi
    fi
    
    # Clean up temp file
    rm -f "$output_file"
    echo ""
}

# Run tests in parallel
run_tests_parallel() {
    local test_suites=("$@")
    local pids=()
    local temp_dir="/tmp/taskmaster_parallel_tests_$$"
    local completed_tests=()
    
    mkdir -p "$temp_dir"
    
    echo -e "${YELLOW}🚀 Running ${#test_suites[@]} test suites in parallel...${NC}"
    echo ""
    
    # Start all tests
    for suite in "${test_suites[@]}"; do
        local test_file=$(get_test_file "$suite")
        if [ -n "$test_file" ] && [ -f "$SCRIPT_DIR/$test_file" ]; then
            (
                local start_time=$(date +%s)
                bash "$SCRIPT_DIR/$test_file" > "$temp_dir/${suite}.log" 2>&1
                local exit_code=$?
                local end_time=$(date +%s)
                local duration=$((end_time - start_time))
                echo "$exit_code" > "$temp_dir/${suite}.exit"
                echo "$duration" > "$temp_dir/${suite}.duration"
                echo "COMPLETED" > "$temp_dir/${suite}.status"
            ) &
            pids+=($!)
            echo "Started $suite (PID: $!)"
        fi
    done
    
    # Monitor test completion with real-time feedback
    echo ""
    echo "Monitoring test progress..."
    local completed_count=0
    local total_count=${#test_suites[@]}
    
    while [ $completed_count -lt $total_count ]; do
        sleep 2
        
        # Check for newly completed tests
        for suite in "${test_suites[@]}"; do
            if [[ ! " ${completed_tests[@]} " =~ " ${suite} " ]] && [ -f "$temp_dir/${suite}.status" ]; then
                completed_tests+=("$suite")
                completed_count=$((completed_count + 1))
                
                local exit_code=$(cat "$temp_dir/${suite}.exit" 2>/dev/null || echo "1")
                local duration=$(cat "$temp_dir/${suite}.duration" 2>/dev/null || echo "0")
                
                if [ "$exit_code" -eq 0 ]; then
                    echo -e "${GREEN}✅ $suite completed successfully${NC} (${duration}s) [$completed_count/$total_count]"
                else
                    echo -e "${RED}❌ $suite failed${NC} (${duration}s) [$completed_count/$total_count]"
                    # Show last few lines of failed test output
                    if [ -f "$temp_dir/${suite}.log" ]; then
                        echo "   Last few lines:"
                        tail -n 3 "$temp_dir/${suite}.log" | sed 's/^/   /' || true
                    fi
                fi
            fi
        done
    done
    
    # Wait for all processes to finish (should be quick since we monitored completion)
    for pid in "${pids[@]}"; do
        wait "$pid" 2>/dev/null || true
    done
    
    echo ""
    echo -e "${BLUE}All tests completed!${NC}"
    
    # Collect final results
    for suite in "${test_suites[@]}"; do
        if [ -f "$temp_dir/${suite}.exit" ]; then
            local exit_code=$(cat "$temp_dir/${suite}.exit")
            TOTAL_TESTS=$((TOTAL_TESTS + 1))
            
            if [ "$exit_code" -eq 0 ]; then
                record_test_result "$suite" "PASSED"
                PASSED_TESTS=$((PASSED_TESTS + 1))
            else
                record_test_result "$suite" "FAILED"
                FAILED_TESTS=$((FAILED_TESTS + 1))
            fi
        fi
    done
    
    # Clean up
    rm -rf "$temp_dir"
}

# Show final test summary
show_summary() {
    local end_time=$(date +%s)
    local total_duration=$((end_time - START_TIME))
    
    echo ""
    echo "=============================================="
    echo -e "${BLUE}📊 TEST EXECUTION SUMMARY${NC}"
    echo "=============================================="
    echo ""
    
    # Results table
    echo "Test Suite Results:"
    echo "-------------------"
    for i in "${!TEST_RESULTS_NAMES[@]}"; do
        local suite="${TEST_RESULTS_NAMES[$i]}"
        local result="${TEST_RESULTS_STATUS[$i]}"
        if [ "$result" = "PASSED" ]; then
            echo -e "  $suite: ${GREEN}✅ PASSED${NC}"
        else
            echo -e "  $suite: ${RED}❌ FAILED${NC}"
        fi
    done
    echo ""
    
    # Statistics
    echo "Statistics:"
    echo "-----------"
    echo "  Total test suites: $TOTAL_TESTS"
    echo -e "  Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "  Failed: ${RED}$FAILED_TESTS${NC}"
    if [ $TOTAL_TESTS -gt 0 ]; then
        echo "  Success rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
    fi
    echo "  Total duration: ${total_duration}s"
    echo ""
    
    # Final status
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
        exit 0
    else
        echo -e "${RED}💥 SOME TESTS FAILED!${NC}"
        exit 1
    fi
}

# Main execution
main() {
    local run_all=true
    local verbose=false
    local quiet=false
    local skip_server_check=false
    local parallel=false
    local test_suites_to_run=()
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -l|--list)
                list_test_suites
                exit 0
                ;;
            -a|--all)
                run_all=true
                shift
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            -q|--quiet)
                quiet=true
                shift
                ;;
            --port)
                TEST_PORT="$2"
                SERVER_URL="http://localhost:$TEST_PORT"
                shift 2
                ;;
            --no-server-check)
                skip_server_check=true
                shift
                ;;
            --parallel)
                parallel=true
                shift
                ;;
            -*)
                echo "Unknown option: $1"
                show_usage
                exit 1
                ;;
            *)
                # Test suite name
                if is_valid_suite "$1"; then
                    test_suites_to_run+=("$1")
                    run_all=false
                else
                    echo "Unknown test suite: $1"
                    echo "Use --list to see available test suites"
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # Set default test suites if none specified
    if [ "$run_all" = "true" ] || [ ${#test_suites_to_run[@]} -eq 0 ]; then
        test_suites_to_run=("${TEST_SUITE_NAMES[@]}")
    fi
    
    # Header
    echo "=============================================="
    echo -e "${BLUE}🧪 Task Master Web API - Modular E2E Tests${NC}"
    echo "=============================================="
    echo ""
    echo "Test suites to run: ${test_suites_to_run[*]}"
    echo "Server URL: $SERVER_URL"
    echo "Verbose: $verbose"
    echo "Quiet: $quiet"
    echo "Parallel: $parallel"
    echo ""
    
    # Check server availability
    if [ "$skip_server_check" != "true" ]; then
        check_server
    fi
    
    # Run tests
    if [ "$parallel" = "true" ]; then
        run_tests_parallel "${test_suites_to_run[@]}"
    else
        for suite in "${test_suites_to_run[@]}"; do
            local test_file=$(get_test_file "$suite")
            if [ -n "$test_file" ] && [ -f "$SCRIPT_DIR/$test_file" ]; then
                run_test_suite "$suite" "$test_file" "$verbose" "$quiet"
            else
                echo -e "${RED}❌ Test file not found: $test_file${NC}"
                record_test_result "$suite" "FAILED"
                TOTAL_TESTS=$((TOTAL_TESTS + 1))
                FAILED_TESTS=$((FAILED_TESTS + 1))
            fi
        done
    fi
    
    # Show summary
    show_summary
}

# Run main function with all arguments
main "$@" 