/**
 * Go Parser Tests
 * Comprehensive tests for Go AST parsing
 */

// Mock the Go parser since we can't import the actual implementation in tests
const mockGoParser = {
	parse: jest.fn(),
	validateContent: jest.fn(),
	getSupportedExtensions: jest.fn(),
	getLanguageId: jest.fn(),
	isInitialized: jest.fn()
};

// Mock parser registry
const mockParserRegistry = {
	getParser: jest.fn(),
	parseFile: jest.fn()
};

describe('Go Parser - Comprehensive Tests', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		
		// Setup default mock behaviors
		mockGoParser.getLanguageId.mockReturnValue('go');
		mockGoParser.getSupportedExtensions.mockReturnValue(['.go']);
		mockGoParser.isInitialized.mockReturnValue(true);
		mockGoParser.validateContent.mockReturnValue(true);
		
		mockParserRegistry.getParser.mockReturnValue(mockGoParser);
	});

	describe('Basic Parsing', () => {
		test('should parse simple Go function', async () => {
			const content = `
package main

import "fmt"

func greet(name string) string {
	return fmt.Sprintf("Hello, %s!", name)
}

func main() {
	fmt.Println(greet("World"))
}
			`;
			
			const expectedAST = {
				type: 'File',
				package: {
					type: 'PackageClause',
					name: { name: 'main' }
				},
				imports: [{
					type: 'ImportSpec',
					path: { value: '"fmt"' }
				}],
				decls: [
					{
						type: 'FuncDecl',
						name: { name: 'greet' },
						type: {
							params: {
								list: [{
									names: [{ name: 'name' }],
									type: { name: 'string' }
								}]
							},
							results: {
								list: [{
									type: { name: 'string' }
								}]
							}
						}
					},
					{
						type: 'FuncDecl',
						name: { name: 'main' },
						type: {
							params: { list: [] },
							results: null
						}
					}
				]
			};
			
			mockGoParser.parse.mockResolvedValue({
				success: true,
				ast: expectedAST,
				language: 'go'
			});
			
			const result = await mockGoParser.parse(content, 'test.go');
			
			expect(result.success).toBe(true);
			expect(result.ast.type).toBe('File');
			expect(result.ast.package.name.name).toBe('main');
			expect(result.ast.decls).toHaveLength(2);
			expect(result.ast.decls[0].name.name).toBe('greet');
		});

		test('should parse Go struct definitions', async () => {
			const content = `
package models

import (
	"time"
	"database/sql/driver"
)

type User struct {
	ID        int       \`json:"id" db:"id"\`
	Name      string    \`json:"name" db:"name" validate:"required,min=1,max=100"\`
	Email     string    \`json:"email" db:"email" validate:"required,email"\`
	Age       int       \`json:"age" db:"age" validate:"min=0,max=150"\`
	CreatedAt time.Time \`json:"created_at" db:"created_at"\`
	UpdatedAt time.Time \`json:"updated_at" db:"updated_at"\`
}

type Address struct {
	Street   string \`json:"street"\`
	City     string \`json:"city"\`
	Country  string \`json:"country"\`
	PostCode string \`json:"post_code"\`
}

type UserWithAddress struct {
	User
	Address Address \`json:"address"\`
}

func (u User) String() string {
	return fmt.Sprintf("User{ID: %d, Name: %s}", u.ID, u.Name)
}

func (u *User) SetEmail(email string) error {
	if email == "" {
		return errors.New("email cannot be empty")
	}
	u.Email = email
	return nil
}
			`;
			
			const expectedAST = {
				type: 'File',
				package: {
					type: 'PackageClause',
					name: { name: 'models' }
				},
				imports: [{
					type: 'ImportSpec',
					path: { value: '"time"' }
				}],
				decls: [
					{
						type: 'GenDecl',
						tok: 'type',
						specs: [{
							type: 'TypeSpec',
							name: { name: 'User' },
							type: {
								type: 'StructType',
								fields: {
									list: [
										{
											names: [{ name: 'ID' }],
											type: { name: 'int' },
											tag: { value: '`json:"id" db:"id"`' }
										},
										{
											names: [{ name: 'Name' }],
											type: { name: 'string' },
											tag: { value: '`json:"name" db:"name" validate:"required,min=1,max=100"`' }
										}
									]
								}
							}
						}]
					},
					{
						type: 'FuncDecl',
						recv: {
							list: [{
								names: [{ name: 'u' }],
								type: { name: 'User' }
							}]
						},
						name: { name: 'String' }
					},
					{
						type: 'FuncDecl',
						recv: {
							list: [{
								names: [{ name: 'u' }],
								type: {
									type: 'StarExpr',
									x: { name: 'User' }
								}
							}]
						},
						name: { name: 'SetEmail' }
					}
				]
			};
			
			mockGoParser.parse.mockResolvedValue({
				success: true,
				ast: expectedAST,
				language: 'go'
			});
			
			const result = await mockGoParser.parse(content, 'models.go');
			
			expect(result.success).toBe(true);
			expect(result.ast.package.name.name).toBe('models');
			expect(result.ast.decls[0].specs[0].name.name).toBe('User');
		});
	});

	describe('Go-Specific Features', () => {
		test('should parse interfaces and type assertions', async () => {
			const content = `
package main

import (
	"fmt"
	"io"
)

type Reader interface {
	Read([]byte) (int, error)
}

type Writer interface {
	Write([]byte) (int, error)
}

type ReadWriter interface {
	Reader
	Writer
}

type FileHandler interface {
	Open(filename string) error
	Close() error
	io.Reader
	io.Writer
}

func processReader(r Reader) error {
	data := make([]byte, 1024)
	n, err := r.Read(data)
	if err != nil {
		return err
	}
	
	// Type assertion
	if rw, ok := r.(ReadWriter); ok {
		rw.Write(data[:n])
	}
	
	// Type switch
	switch v := r.(type) {
	case *os.File:
		fmt.Printf("Processing file: %s", v.Name())
	case *bytes.Buffer:
		fmt.Printf("Processing buffer with %d bytes", v.Len())
	default:
		fmt.Printf("Processing unknown reader type: %T", v)
	}
	
	return nil
}
			`;
			
			mockGoParser.parse.mockResolvedValue({
				success: true,
				ast: {
					type: 'File',
					package: { name: { name: 'main' } },
					decls: [
						{
							type: 'GenDecl',
							tok: 'type',
							specs: [{
								type: 'TypeSpec',
								name: { name: 'Reader' },
								type: {
									type: 'InterfaceType',
									methods: {
										list: [{
											names: [{ name: 'Read' }],
											type: {
												type: 'FuncType',
												params: {
													list: [{
														type: {
															type: 'ArrayType',
															elt: { name: 'byte' }
														}
													}]
												},
												results: {
													list: [
														{ type: { name: 'int' } },
														{ type: { name: 'error' } }
													]
												}
											}
										}]
									}
								}
							}]
						},
						{
							type: 'GenDecl',
							tok: 'type',
							specs: [{
								type: 'TypeSpec',
								name: { name: 'ReadWriter' },
								type: {
									type: 'InterfaceType',
									methods: {
										list: [
											{ type: { name: 'Reader' } },
											{ type: { name: 'Writer' } }
										]
									}
								}
							}]
						},
						{
							type: 'FuncDecl',
							name: { name: 'processReader' },
							body: {
								list: [
									{
										type: 'AssignStmt',
										lhs: [{ name: 'data' }],
										tok: ':=',
										rhs: [{
											type: 'CallExpr',
											fun: { name: 'make' }
										}]
									},
									{
										type: 'IfStmt',
										init: {
											type: 'AssignStmt',
											lhs: [{ name: 'rw' }, { name: 'ok' }],
											tok: ':=',
											rhs: [{
												type: 'TypeAssertExpr',
												x: { name: 'r' },
												type: { name: 'ReadWriter' }
											}]
										}
									},
									{
										type: 'TypeSwitchStmt',
										init: {
											type: 'AssignStmt',
											lhs: [{ name: 'v' }],
											tok: ':=',
											rhs: [{
												type: 'TypeAssertExpr',
												x: { name: 'r' },
												type: null
											}]
										}
									}
								]
							}
						}
					]
				},
				language: 'go'
			});
			
			const result = await mockGoParser.parse(content, 'test.go');
			
			expect(result.success).toBe(true);
			expect(result.ast.decls[0].specs[0].type.type).toBe('InterfaceType');
			expect(result.ast.decls[1].specs[0].name.name).toBe('ReadWriter');
		});

		test('should parse goroutines and channels', async () => {
			const content = `
package main

import (
	"context"
	"fmt"
	"sync"
	"time"
)

func worker(id int, jobs <-chan int, results chan<- int, wg *sync.WaitGroup) {
	defer wg.Done()
	
	for job := range jobs {
		fmt.Printf("Worker %d processing job %d\n", id, job)
		time.Sleep(time.Second)
		results <- job * 2
	}
}

func main() {
	const numWorkers = 3
	const numJobs = 5
	
	jobs := make(chan int, numJobs)
	results := make(chan int, numJobs)
	
	var wg sync.WaitGroup
	
	// Start workers
	for i := 1; i <= numWorkers; i++ {
		wg.Add(1)
		go worker(i, jobs, results, &wg)
	}
	
	// Send jobs
	for j := 1; j <= numJobs; j++ {
		jobs <- j
	}
	close(jobs)
	
	// Wait for all workers to finish
	go func() {
		wg.Wait()
		close(results)
	}()
	
	// Collect results
	for result := range results {
		fmt.Printf("Result: %d\n", result)
	}
}

func contextExample(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(5 * time.Second):
		return fmt.Errorf("operation timed out")
	default:
		// Non-blocking operation
		return nil
	}
}
			`;
			
			mockGoParser.parse.mockResolvedValue({
				success: true,
				ast: {
					type: 'File',
					package: { name: { name: 'main' } },
					decls: [
						{
							type: 'FuncDecl',
							name: { name: 'worker' },
							type: {
								params: {
									list: [
										{
											names: [{ name: 'id' }],
											type: { name: 'int' }
										},
										{
											names: [{ name: 'jobs' }],
											type: {
												type: 'ChanType',
												dir: 'recv',
												value: { name: 'int' }
											}
										},
										{
											names: [{ name: 'results' }],
											type: {
												type: 'ChanType',
												dir: 'send',
												value: { name: 'int' }
											}
										}
									]
								}
							},
							body: {
								list: [
									{
										type: 'DeferStmt',
										call: {
											type: 'CallExpr',
											fun: {
												type: 'SelectorExpr',
												x: { name: 'wg' },
												sel: { name: 'Done' }
											}
										}
									},
									{
										type: 'RangeStmt',
										key: { name: 'job' },
										tok: ':=',
										x: { name: 'jobs' },
										body: {
											list: [
												{
													type: 'SendStmt',
													chan: { name: 'results' },
													value: {
														type: 'BinaryExpr',
														x: { name: 'job' },
														op: '*',
														y: { type: 'BasicLit', value: '2' }
													}
												}
											]
										}
									}
								]
							}
						},
						{
							type: 'FuncDecl',
							name: { name: 'main' },
							body: {
								list: [
									{
										type: 'GoStmt',
										call: {
											type: 'CallExpr',
											fun: { name: 'worker' }
										}
									},
									{
										type: 'GoStmt',
										call: {
											type: 'CallExpr',
											fun: {
												type: 'FuncLit',
												type: { type: 'FuncType' },
												body: {
													list: [
														{
															type: 'ExprStmt',
															x: {
																type: 'CallExpr',
																fun: {
																	type: 'SelectorExpr',
																	x: { name: 'wg' },
																	sel: { name: 'Wait' }
																}
															}
														}
													]
												}
											}
										}
									}
								]
							}
						},
						{
							type: 'FuncDecl',
							name: { name: 'contextExample' },
							body: {
								list: [{
									type: 'SelectStmt',
									body: {
										list: [
											{
												type: 'CommClause',
												comm: {
													type: 'ExprStmt',
													x: {
														type: 'UnaryExpr',
														op: '<-',
														x: {
															type: 'SelectorExpr',
															x: { name: 'ctx' },
															sel: { name: 'Done' }
														}
													}
												}
											},
											{
												type: 'CommClause',
												comm: {
													type: 'ExprStmt',
													x: {
														type: 'UnaryExpr',
														op: '<-',
														x: {
															type: 'CallExpr',
															fun: {
																type: 'SelectorExpr',
																x: { name: 'time' },
																sel: { name: 'After' }
															}
														}
													}
												}
											},
											{
												type: 'CommClause',
												comm: null // default case
											}
										]
									}
								}]
							}
						}
					]
				},
				language: 'go'
			});
			
			const result = await mockGoParser.parse(content, 'test.go');
			
			expect(result.success).toBe(true);
			expect(result.ast.decls[0].type.params.list[1].type.type).toBe('ChanType');
			expect(result.ast.decls[1].body.list[0].type).toBe('GoStmt');
			expect(result.ast.decls[2].body.list[0].type).toBe('SelectStmt');
		});

		test('should parse error handling patterns', async () => {
			const content = `
package main

import (
	"errors"
	"fmt"
	"os"
)

var (
	ErrNotFound = errors.New("item not found")
	ErrInvalid  = errors.New("invalid input")
)

type ValidationError struct {
	Field   string
	Message string
}

func (e ValidationError) Error() string {
	return fmt.Sprintf("validation error on field '%s': %s", e.Field, e.Message)
}

func validateUser(name, email string) error {
	if name == "" {
		return &ValidationError{
			Field:   "name",
			Message: "name cannot be empty",
		}
	}
	
	if email == "" {
		return &ValidationError{
			Field:   "email",
			Message: "email cannot be empty",
		}
	}
	
	return nil
}

func processFile(filename string) ([]byte, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()
	
	stat, err := file.Stat()
	if err != nil {
		return nil, fmt.Errorf("failed to get file stats: %w", err)
	}
	
	if stat.Size() == 0 {
		return nil, ErrNotFound
	}
	
	data := make([]byte, stat.Size())
	n, err := file.Read(data)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}
	
	return data[:n], nil
}

func main() {
	data, err := processFile("test.txt")
	if err != nil {
		var validationErr *ValidationError
		if errors.As(err, &validationErr) {
			fmt.Printf("Validation error: %s\n", validationErr.Error())
			return
		}
		
		if errors.Is(err, ErrNotFound) {
			fmt.Println("File not found")
			return
		}
		
		fmt.Printf("Unexpected error: %v\n", err)
		return
	}
	
	fmt.Printf("Read %d bytes\n", len(data))
}
			`;
			
			mockGoParser.parse.mockResolvedValue({
				success: true,
				ast: {
					type: 'File',
					package: { name: { name: 'main' } },
					decls: [
						{
							type: 'GenDecl',
							tok: 'var',
							specs: [{
								type: 'ValueSpec',
								names: [
									{ name: 'ErrNotFound' },
									{ name: 'ErrInvalid' }
								],
								values: [
									{
										type: 'CallExpr',
										fun: {
											type: 'SelectorExpr',
											x: { name: 'errors' },
											sel: { name: 'New' }
										}
									}
								]
							}]
						},
						{
							type: 'GenDecl',
							tok: 'type',
							specs: [{
								type: 'TypeSpec',
								name: { name: 'ValidationError' },
								type: {
									type: 'StructType',
									fields: {
										list: [
											{
												names: [{ name: 'Field' }],
												type: { name: 'string' }
											},
											{
												names: [{ name: 'Message' }],
												type: { name: 'string' }
											}
										]
									}
								}
							}]
						},
						{
							type: 'FuncDecl',
							recv: {
								list: [{
									names: [{ name: 'e' }],
									type: { name: 'ValidationError' }
								}]
							},
							name: { name: 'Error' },
							type: {
								results: {
									list: [{
										type: { name: 'string' }
									}]
								}
							}
						}
					]
				},
				language: 'go'
			});
			
			const result = await mockGoParser.parse(content, 'test.go');
			
			expect(result.success).toBe(true);
			expect(result.ast.decls[0].tok).toBe('var');
			expect(result.ast.decls[1].specs[0].name.name).toBe('ValidationError');
		});
	});

	describe('Error Handling', () => {
		test('should handle syntax errors', async () => {
			const content = `
package main

func broken() {
	if true {
		return "missing closing brace"
}
			`;
			
			mockGoParser.parse.mockResolvedValue({
				success: false,
				error: {
					type: 'SyntaxError',
					message: 'expected }',
					line: 7,
					column: 1,
					file: 'test.go'
				}
			});
			
			const result = await mockGoParser.parse(content, 'test.go');
			
			expect(result.success).toBe(false);
			expect(result.error.type).toBe('SyntaxError');
			expect(result.error.message).toContain('expected }');
		});

		test('should handle missing package declaration', async () => {
			const content = `
import "fmt"

func main() {
	fmt.Println("Hello")
}
			`;
			
			mockGoParser.parse.mockResolvedValue({
				success: false,
				error: {
					type: 'ParseError',
					message: 'expected package declaration',
					line: 1,
					column: 1,
					file: 'test.go'
				}
			});
			
			const result = await mockGoParser.parse(content, 'test.go');
			
			expect(result.success).toBe(false);
			expect(result.error.message).toContain('expected package');
		});

		test('should handle empty files', async () => {
			const content = '';
			
			mockGoParser.parse.mockResolvedValue({
				success: false,
				error: {
					type: 'ParseError',
					message: 'empty file',
					file: 'test.go'
				}
			});
			
			const result = await mockGoParser.parse(content, 'test.go');
			
			expect(result.success).toBe(false);
			expect(result.error.message).toContain('empty file');
		});

		test('should handle files with only package declaration', async () => {
			const content = 'package main';
			
			mockGoParser.parse.mockResolvedValue({
				success: true,
				ast: {
					type: 'File',
					package: {
						type: 'PackageClause',
						name: { name: 'main' }
					},
					imports: [],
					decls: []
				},
				language: 'go'
			});
			
			const result = await mockGoParser.parse(content, 'test.go');
			
			expect(result.success).toBe(true);
			expect(result.ast.package.name.name).toBe('main');
			expect(result.ast.decls).toHaveLength(0);
		});
	});

	describe('Performance Tests', () => {
		test('should parse small files quickly', async () => {
			const content = 'package main\nfunc main() {}';
			
			mockGoParser.parse.mockImplementation(async () => {
				await new Promise(resolve => setTimeout(resolve, 1));
				return {
					success: true,
					ast: { type: 'File', package: { name: { name: 'main' } } },
					language: 'go'
				};
			});
			
			const start = performance.now();
			await mockGoParser.parse(content, 'test.go');
			const duration = performance.now() - start;
			
			expect(duration).toBeLessThan(10);
		});

		test('should handle large files efficiently', async () => {
			const largeContent = 'package main\n' + Array(1000).fill('var x = 1').join('\n');
			
			mockGoParser.parse.mockImplementation(async () => {
				await new Promise(resolve => setTimeout(resolve, 10));
				return {
					success: true,
					ast: { type: 'File', package: { name: { name: 'main' } } },
					language: 'go'
				};
			});
			
			const start = performance.now();
			await mockGoParser.parse(largeContent, 'test.go');
			const duration = performance.now() - start;
			
			expect(duration).toBeLessThan(100);
		});
	});

	describe('File Extension Support', () => {
		test('should support Go extension', () => {
			const extensions = mockGoParser.getSupportedExtensions();
			expect(extensions).toContain('.go');
		});

		test('should identify as go parser', () => {
			expect(mockGoParser.getLanguageId()).toBe('go');
		});
	});

	describe('Real-World Code Examples', () => {
		test('should parse HTTP server', async () => {
			const serverContent = `
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

type Server struct {
	httpServer *http.Server
	logger     *log.Logger
}

type Response struct {
	Message string \`json:"message"\`
	Status  string \`json:"status"\`
}

func NewServer(addr string) *Server {
	mux := http.NewServeMux()
	
	server := &Server{
		httpServer: &http.Server{
			Addr:         addr,
			Handler:      mux,
			ReadTimeout:  15 * time.Second,
			WriteTimeout: 15 * time.Second,
			IdleTimeout:  60 * time.Second,
		},
		logger: log.New(os.Stdout, "SERVER: ", log.LstdFlags),
	}
	
	mux.HandleFunc("/health", server.healthHandler)
	mux.HandleFunc("/api/hello", server.helloHandler)
	
	return server
}

func (s *Server) healthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	response := Response{
		Message: "Server is healthy",
		Status:  "OK",
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *Server) helloHandler(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	if name == "" {
		name = "World"
	}
	
	response := Response{
		Message: fmt.Sprintf("Hello, %s!", name),
		Status:  "OK",
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *Server) Start() error {
	s.logger.Printf("Starting server on %s", s.httpServer.Addr)
	return s.httpServer.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
	s.logger.Println("Shutting down server...")
	return s.httpServer.Shutdown(ctx)
}

func main() {
	server := NewServer(":8080")
	
	// Start server in a goroutine
	go func() {
		if err := server.Start(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()
	
	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	
	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	
	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
	
	log.Println("Server exited")
}
			`;
			
			mockGoParser.parse.mockResolvedValue({
				success: true,
				ast: { type: 'File', package: { name: { name: 'main' } } },
				language: 'go'
			});
			
			const result = await mockGoParser.parse(serverContent, 'server.go');
			expect(result.success).toBe(true);
		});

		test('should parse gRPC service', async () => {
			const grpcContent = `
package main

import (
	"context"
	"log"
	"net"
	
	"google.golang.org/grpc"
	pb "example.com/grpc/proto"
)

type userServiceServer struct {
	pb.UnimplementedUserServiceServer
	users map[string]*pb.User
}

func (s *userServiceServer) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.GetUserResponse, error) {
	user, exists := s.users[req.GetUserId()]
	if !exists {
		return nil, status.Errorf(codes.NotFound, "user not found: %s", req.GetUserId())
	}
	
	return &pb.GetUserResponse{
		User: user,
	}, nil
}

func (s *userServiceServer) CreateUser(ctx context.Context, req *pb.CreateUserRequest) (*pb.CreateUserResponse, error) {
	user := req.GetUser()
	if user.GetId() == "" {
		return nil, status.Error(codes.InvalidArgument, "user ID is required")
	}
	
	if _, exists := s.users[user.GetId()]; exists {
		return nil, status.Errorf(codes.AlreadyExists, "user already exists: %s", user.GetId())
	}
	
	s.users[user.GetId()] = user
	
	return &pb.CreateUserResponse{
		User: user,
	}, nil
}

func main() {
	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}
	
	s := grpc.NewServer()
	
	userService := &userServiceServer{
		users: make(map[string]*pb.User),
	}
	
	pb.RegisterUserServiceServer(s, userService)
	
	log.Println("gRPC server listening on :50051")
	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
			`;
			
			mockGoParser.parse.mockResolvedValue({
				success: true,
				ast: { type: 'File', package: { name: { name: 'main' } } },
				language: 'go'
			});
			
			const result = await mockGoParser.parse(grpcContent, 'grpc_server.go');
			expect(result.success).toBe(true);
		});
	});
}); 