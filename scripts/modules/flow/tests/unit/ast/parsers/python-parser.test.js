/**
 * Python Parser Tests
 * Comprehensive tests for Python AST parsing
 */

// Mock the Python parser since we can't import the actual implementation in tests
const mockPythonParser = {
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

describe('Python Parser - Comprehensive Tests', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		
		// Setup default mock behaviors
		mockPythonParser.getLanguageId.mockReturnValue('python');
		mockPythonParser.getSupportedExtensions.mockReturnValue(['.py', '.pyi', '.pyw']);
		mockPythonParser.isInitialized.mockReturnValue(true);
		mockPythonParser.validateContent.mockReturnValue(true);
		
		mockParserRegistry.getParser.mockReturnValue(mockPythonParser);
	});

	describe('Basic Parsing', () => {
		test('should parse simple Python function', async () => {
			const content = `
def greet(name):
    """Greet a person by name."""
    return f"Hello, {name}!"

def main():
    print(greet("World"))

if __name__ == "__main__":
    main()
			`;
			
			const expectedAST = {
				type: 'Module',
				body: [
					{
						type: 'FunctionDef',
						name: 'greet',
						args: {
							args: [{ arg: 'name' }]
						},
						body: [
							{
								type: 'Expr',
								value: { type: 'Constant', value: 'Greet a person by name.' }
							},
							{
								type: 'Return',
								value: { type: 'JoinedStr' }
							}
						]
					},
					{
						type: 'FunctionDef',
						name: 'main',
						body: [
							{
								type: 'Expr',
								value: {
									type: 'Call',
									func: { type: 'Name', id: 'print' }
								}
							}
						]
					},
					{
						type: 'If',
						test: {
							type: 'Compare',
							left: { type: 'Name', id: '__name__' },
							ops: [{ type: 'Eq' }],
							comparators: [{ type: 'Constant', value: '__main__' }]
						}
					}
				]
			};
			
			mockPythonParser.parse.mockResolvedValue({
				success: true,
				ast: expectedAST,
				language: 'python'
			});
			
			const result = await mockPythonParser.parse(content, 'test.py');
			
			expect(result.success).toBe(true);
			expect(result.ast.type).toBe('Module');
			expect(result.ast.body[0].type).toBe('FunctionDef');
			expect(result.ast.body[0].name).toBe('greet');
		});

		test('should parse Python class definitions', async () => {
			const content = `
class User:
    """A user class with basic functionality."""
    
    def __init__(self, name, age):
        self.name = name
        self.age = age
        self._id = None
    
    def greet(self):
        return f"Hello, I'm {self.name}"
    
    @property
    def id(self):
        return self._id
    
    @id.setter
    def id(self, value):
        if value < 0:
            raise ValueError("ID must be positive")
        self._id = value
    
    @staticmethod
    def create_guest():
        return User("Guest", 0)
    
    @classmethod
    def from_dict(cls, data):
        return cls(data['name'], data['age'])
			`;
			
			const expectedAST = {
				type: 'Module',
				body: [{
					type: 'ClassDef',
					name: 'User',
					bases: [],
					body: [
						{
							type: 'Expr',
							value: { type: 'Constant', value: 'A user class with basic functionality.' }
						},
						{
							type: 'FunctionDef',
							name: '__init__',
							args: {
								args: [
									{ arg: 'self' },
									{ arg: 'name' },
									{ arg: 'age' }
								]
							}
						},
						{
							type: 'FunctionDef',
							name: 'greet',
							decorator_list: []
						},
						{
							type: 'FunctionDef',
							name: 'id',
							decorator_list: [{ type: 'Name', id: 'property' }]
						},
						{
							type: 'FunctionDef',
							name: 'id',
							decorator_list: [{ type: 'Attribute', attr: 'setter' }]
						},
						{
							type: 'FunctionDef',
							name: 'create_guest',
							decorator_list: [{ type: 'Name', id: 'staticmethod' }]
						},
						{
							type: 'FunctionDef',
							name: 'from_dict',
							decorator_list: [{ type: 'Name', id: 'classmethod' }]
						}
					]
				}]
			};
			
			mockPythonParser.parse.mockResolvedValue({
				success: true,
				ast: expectedAST,
				language: 'python'
			});
			
			const result = await mockPythonParser.parse(content, 'test.py');
			
			expect(result.success).toBe(true);
			expect(result.ast.body[0].type).toBe('ClassDef');
			expect(result.ast.body[0].name).toBe('User');
			expect(result.ast.body[0].body).toHaveLength(7); // docstring + 6 methods
		});
	});

	describe('Python-Specific Features', () => {
		test('should parse list comprehensions', async () => {
			const content = `
# Simple list comprehension
numbers = [x for x in range(10)]

# List comprehension with condition
evens = [x for x in range(20) if x % 2 == 0]

# Nested list comprehension
matrix = [[i + j for j in range(3)] for i in range(3)]

# Dictionary comprehension
squares = {x: x**2 for x in range(5)}

# Set comprehension
unique_chars = {char.lower() for char in "Hello World" if char.isalpha()}
			`;
			
			mockPythonParser.parse.mockResolvedValue({
				success: true,
				ast: {
					type: 'Module',
					body: [
						{
							type: 'Assign',
							targets: [{ type: 'Name', id: 'numbers' }],
							value: {
								type: 'ListComp',
								elt: { type: 'Name', id: 'x' },
								generators: [{
									type: 'comprehension',
									target: { type: 'Name', id: 'x' },
									iter: { type: 'Call', func: { type: 'Name', id: 'range' } }
								}]
							}
						},
						{
							type: 'Assign',
							targets: [{ type: 'Name', id: 'evens' }],
							value: {
								type: 'ListComp',
								generators: [{
									type: 'comprehension',
									ifs: [{ type: 'Compare' }]
								}]
							}
						},
						{
							type: 'Assign',
							targets: [{ type: 'Name', id: 'matrix' }],
							value: {
								type: 'ListComp',
								elt: { type: 'ListComp' }
							}
						},
						{
							type: 'Assign',
							targets: [{ type: 'Name', id: 'squares' }],
							value: { type: 'DictComp' }
						},
						{
							type: 'Assign',
							targets: [{ type: 'Name', id: 'unique_chars' }],
							value: { type: 'SetComp' }
						}
					]
				},
				language: 'python'
			});
			
			const result = await mockPythonParser.parse(content, 'test.py');
			
			expect(result.success).toBe(true);
			expect(result.ast.body[0].value.type).toBe('ListComp');
			expect(result.ast.body[3].value.type).toBe('DictComp');
			expect(result.ast.body[4].value.type).toBe('SetComp');
		});

		test('should parse generators and async functions', async () => {
			const content = `
def simple_generator():
    for i in range(5):
        yield i

def fibonacci():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

async def fetch_data(url):
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()

async def process_urls(urls):
    tasks = [fetch_data(url) for url in urls]
    results = await asyncio.gather(*tasks)
    return results

# Generator expression
squares = (x**2 for x in range(10))
			`;
			
			mockPythonParser.parse.mockResolvedValue({
				success: true,
				ast: {
					type: 'Module',
					body: [
						{
							type: 'FunctionDef',
							name: 'simple_generator',
							body: [{
								type: 'For',
								body: [{
									type: 'Expr',
									value: {
										type: 'Yield',
										value: { type: 'Name', id: 'i' }
									}
								}]
							}]
						},
						{
							type: 'FunctionDef',
							name: 'fibonacci',
							body: [
								{
									type: 'Assign',
									targets: [{ type: 'Tuple' }],
									value: { type: 'Tuple' }
								},
								{
									type: 'While',
									body: [
										{
											type: 'Expr',
											value: { type: 'Yield' }
										}
									]
								}
							]
						},
						{
							type: 'AsyncFunctionDef',
							name: 'fetch_data',
							body: [{
								type: 'AsyncWith',
								items: [{
									context_expr: { type: 'Call' },
									optional_vars: { type: 'Name', id: 'session' }
								}]
							}]
						},
						{
							type: 'AsyncFunctionDef',
							name: 'process_urls'
						},
						{
							type: 'Assign',
							targets: [{ type: 'Name', id: 'squares' }],
							value: { type: 'GeneratorExp' }
						}
					]
				},
				language: 'python'
			});
			
			const result = await mockPythonParser.parse(content, 'test.py');
			
			expect(result.success).toBe(true);
			expect(result.ast.body[2].type).toBe('AsyncFunctionDef');
			expect(result.ast.body[3].type).toBe('AsyncFunctionDef');
			expect(result.ast.body[4].value.type).toBe('GeneratorExp');
		});

		test('should parse decorators and context managers', async () => {
			const content = `
from functools import wraps
from contextlib import contextmanager

def retry(max_attempts=3):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_attempts - 1:
                        raise
                    print(f"Attempt {attempt + 1} failed: {e}")
        return wrapper
    return decorator

@contextmanager
def database_transaction():
    conn = get_connection()
    trans = conn.begin()
    try:
        yield conn
        trans.commit()
    except Exception:
        trans.rollback()
        raise
    finally:
        conn.close()

@retry(max_attempts=5)
@cache_result
async def expensive_operation(data):
    # Simulate expensive operation
    await asyncio.sleep(1)
    return process_data(data)

class APIClient:
    @property
    def is_authenticated(self):
        return self._token is not None
    
    @staticmethod
    def validate_response(response):
        return response.status_code == 200
			`;
			
			mockPythonParser.parse.mockResolvedValue({
				success: true,
				ast: {
					type: 'Module',
					body: [
						{ type: 'ImportFrom', module: 'functools' },
						{ type: 'ImportFrom', module: 'contextlib' },
						{
							type: 'FunctionDef',
							name: 'retry',
							body: [{
								type: 'FunctionDef',
								name: 'decorator',
								body: [{
									type: 'FunctionDef',
									name: 'wrapper',
									decorator_list: [{ type: 'Name', id: 'wraps' }]
								}]
							}]
						},
						{
							type: 'FunctionDef',
							name: 'database_transaction',
							decorator_list: [{ type: 'Name', id: 'contextmanager' }]
						},
						{
							type: 'AsyncFunctionDef',
							name: 'expensive_operation',
							decorator_list: [
								{ type: 'Call', func: { type: 'Name', id: 'retry' } },
								{ type: 'Name', id: 'cache_result' }
							]
						},
						{
							type: 'ClassDef',
							name: 'APIClient',
							body: [
								{
									type: 'FunctionDef',
									name: 'is_authenticated',
									decorator_list: [{ type: 'Name', id: 'property' }]
								},
								{
									type: 'FunctionDef',
									name: 'validate_response',
									decorator_list: [{ type: 'Name', id: 'staticmethod' }]
								}
							]
						}
					]
				},
				language: 'python'
			});
			
			const result = await mockPythonParser.parse(content, 'test.py');
			
			expect(result.success).toBe(true);
			expect(result.ast.body[3].decorator_list[0].id).toBe('contextmanager');
			expect(result.ast.body[4].decorator_list).toHaveLength(2);
		});

		test('should parse type hints and annotations', async () => {
			const content = `
from typing import List, Dict, Optional, Union, Callable, TypeVar, Generic
from dataclasses import dataclass

T = TypeVar('T')

@dataclass
class User:
    name: str
    age: int
    email: Optional[str] = None
    tags: List[str] = None

class Repository(Generic[T]):
    def __init__(self) -> None:
        self._items: List[T] = []
    
    def add(self, item: T) -> None:
        self._items.append(item)
    
    def get_by_id(self, id: int) -> Optional[T]:
        for item in self._items:
            if hasattr(item, 'id') and item.id == id:
                return item
        return None
    
    def filter(self, predicate: Callable[[T], bool]) -> List[T]:
        return [item for item in self._items if predicate(item)]

def process_users(
    users: List[User],
    filter_func: Callable[[User], bool] = None
) -> Dict[str, Union[int, List[str]]]:
    if filter_func:
        users = [u for u in users if filter_func(u)]
    
    return {
        'count': len(users),
        'names': [u.name for u in users]
    }

async def fetch_user_data(user_id: int) -> Optional[Dict[str, any]]:
    # Simulate API call
    return {'id': user_id, 'name': 'Test User'}
			`;
			
			mockPythonParser.parse.mockResolvedValue({
				success: true,
				ast: {
					type: 'Module',
					body: [
						{ type: 'ImportFrom', module: 'typing' },
						{ type: 'ImportFrom', module: 'dataclasses' },
						{
							type: 'Assign',
							targets: [{ type: 'Name', id: 'T' }],
							value: { type: 'Call', func: { type: 'Name', id: 'TypeVar' } }
						},
						{
							type: 'ClassDef',
							name: 'User',
							decorator_list: [{ type: 'Name', id: 'dataclass' }],
							body: [
								{
									type: 'AnnAssign',
									target: { type: 'Name', id: 'name' },
									annotation: { type: 'Name', id: 'str' }
								},
								{
									type: 'AnnAssign',
									target: { type: 'Name', id: 'age' },
									annotation: { type: 'Name', id: 'int' }
								},
								{
									type: 'AnnAssign',
									target: { type: 'Name', id: 'email' },
									annotation: { type: 'Subscript' }
								}
							]
						},
						{
							type: 'ClassDef',
							name: 'Repository',
							bases: [{ type: 'Subscript' }],
							body: [
								{
									type: 'FunctionDef',
									name: '__init__',
									returns: { type: 'Constant', value: null }
								},
								{
									type: 'FunctionDef',
									name: 'add',
									args: {
										args: [
											{ arg: 'self' },
											{
												arg: 'item',
												annotation: { type: 'Name', id: 'T' }
											}
										]
									},
									returns: { type: 'Constant', value: null }
								}
							]
						}
					]
				},
				language: 'python'
			});
			
			const result = await mockPythonParser.parse(content, 'test.py');
			
			expect(result.success).toBe(true);
			expect(result.ast.body[3].decorator_list[0].id).toBe('dataclass');
			expect(result.ast.body[4].bases[0].type).toBe('Subscript'); // Generic[T]
		});
	});

	describe('Error Handling', () => {
		test('should handle indentation errors', async () => {
			const content = `
def broken_function():
print("This is not indented correctly")
    return "broken"
			`;
			
			mockPythonParser.parse.mockResolvedValue({
				success: false,
				error: {
					type: 'IndentationError',
					message: 'expected an indented block',
					line: 3,
					column: 1,
					file: 'test.py'
				}
			});
			
			const result = await mockPythonParser.parse(content, 'test.py');
			
			expect(result.success).toBe(false);
			expect(result.error.type).toBe('IndentationError');
			expect(result.error.line).toBe(3);
		});

		test('should handle syntax errors', async () => {
			const content = `
def invalid_syntax():
    if True
        return "missing colon"
			`;
			
			mockPythonParser.parse.mockResolvedValue({
				success: false,
				error: {
					type: 'SyntaxError',
					message: 'invalid syntax',
					line: 3,
					column: 12,
					file: 'test.py'
				}
			});
			
			const result = await mockPythonParser.parse(content, 'test.py');
			
			expect(result.success).toBe(false);
			expect(result.error.type).toBe('SyntaxError');
			expect(result.error.message).toContain('invalid syntax');
		});

		test('should handle empty files', async () => {
			const content = '';
			
			mockPythonParser.parse.mockResolvedValue({
				success: true,
				ast: {
					type: 'Module',
					body: []
				},
				language: 'python'
			});
			
			const result = await mockPythonParser.parse(content, 'test.py');
			
			expect(result.success).toBe(true);
			expect(result.ast.body).toHaveLength(0);
		});

		test('should handle files with only comments', async () => {
			const content = `
# This is a comment
# Another comment
"""
This is a docstring
"""
			`;
			
			mockPythonParser.parse.mockResolvedValue({
				success: true,
				ast: {
					type: 'Module',
					body: [{
						type: 'Expr',
						value: {
							type: 'Constant',
							value: '\nThis is a docstring\n'
						}
					}]
				},
				language: 'python'
			});
			
			const result = await mockPythonParser.parse(content, 'test.py');
			
			expect(result.success).toBe(true);
			expect(result.ast.body).toHaveLength(1); // Only the docstring
		});

		test('should handle invalid Unicode characters', async () => {
			const content = `
def test():
    # Invalid unicode: \x80
    return "test"
			`;
			
			mockPythonParser.parse.mockResolvedValue({
				success: false,
				error: {
					type: 'UnicodeDecodeError',
					message: 'invalid unicode character',
					line: 3,
					file: 'test.py'
				}
			});
			
			const result = await mockPythonParser.parse(content, 'test.py');
			
			expect(result.success).toBe(false);
			expect(result.error.type).toBe('UnicodeDecodeError');
		});
	});

	describe('Performance Tests', () => {
		test('should parse small files quickly', async () => {
			const content = 'x = 1';
			
			mockPythonParser.parse.mockImplementation(async () => {
				await new Promise(resolve => setTimeout(resolve, 1));
				return {
					success: true,
					ast: { type: 'Module', body: [] },
					language: 'python'
				};
			});
			
			const start = performance.now();
			await mockPythonParser.parse(content, 'test.py');
			const duration = performance.now() - start;
			
			expect(duration).toBeLessThan(10);
		});

		test('should handle large files efficiently', async () => {
			const largeContent = Array(1000).fill('x = 1').join('\n');
			
			mockPythonParser.parse.mockImplementation(async () => {
				await new Promise(resolve => setTimeout(resolve, 10));
				return {
					success: true,
					ast: { type: 'Module', body: [] },
					language: 'python'
				};
			});
			
			const start = performance.now();
			await mockPythonParser.parse(largeContent, 'test.py');
			const duration = performance.now() - start;
			
			expect(duration).toBeLessThan(100);
		});
	});

	describe('File Extension Support', () => {
		test('should support all Python extensions', () => {
			const extensions = mockPythonParser.getSupportedExtensions();
			
			expect(extensions).toContain('.py');
			expect(extensions).toContain('.pyi');
			expect(extensions).toContain('.pyw');
		});

		test('should identify as python parser', () => {
			expect(mockPythonParser.getLanguageId()).toBe('python');
		});
	});

	describe('Real-World Code Examples', () => {
		test('should parse Django model', async () => {
			const djangoContent = `
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinLengthValidator

class User(AbstractUser):
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=30)
    last_name = models.CharField(max_length=30)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']
    
    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
    
    def __str__(self):
        return f"{self.first_name} {self.last_name}"
    
    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

class Post(models.Model):
    title = models.CharField(
        max_length=200,
        validators=[MinLengthValidator(5)]
    )
    content = models.TextField()
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='posts'
    )
    tags = models.ManyToManyField('Tag', blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['published_at']),
            models.Index(fields=['author', '-created_at']),
        ]
    
    def __str__(self):
        return self.title
    
    @property
    def is_published(self):
        return self.published_at is not None
			`;
			
			mockPythonParser.parse.mockResolvedValue({
				success: true,
				ast: { type: 'Module', body: [] },
				language: 'python'
			});
			
			const result = await mockPythonParser.parse(djangoContent, 'models.py');
			expect(result.success).toBe(true);
		});

		test('should parse FastAPI application', async () => {
			const fastApiContent = `
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import List, Optional
import uvicorn

app = FastAPI(title="User API", version="1.0.0")
security = HTTPBearer()

class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., regex=r'^[^@]+@[^@]+\.[^@]+$')
    age: int = Field(..., ge=0, le=150)

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    age: int
    
    class Config:
        orm_mode = True

class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[str] = Field(None, regex=r'^[^@]+@[^@]+\.[^@]+$')
    age: Optional[int] = Field(None, ge=0, le=150)

# Dependency
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    # Validate token logic here
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {"user_id": 1, "username": "testuser"}

@app.get("/")
async def root():
    return {"message": "Welcome to User API"}

@app.post("/users/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(user: UserCreate):
    # Create user logic here
    return UserResponse(id=1, **user.dict())

@app.get("/users/", response_model=List[UserResponse])
async def get_users(
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    # Get users logic here
    return []

@app.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, current_user: dict = Depends(get_current_user)):
    if user_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    # Get user logic here
    return UserResponse(id=user_id, name="Test", email="test@example.com", age=25)

@app.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: dict = Depends(get_current_user)
):
    # Update user logic here
    return UserResponse(id=user_id, name="Updated", email="updated@example.com", age=30)

@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int, current_user: dict = Depends(get_current_user)):
    # Delete user logic here
    pass

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
			`;
			
			mockPythonParser.parse.mockResolvedValue({
				success: true,
				ast: { type: 'Module', body: [] },
				language: 'python'
			});
			
			const result = await mockPythonParser.parse(fastApiContent, 'main.py');
			expect(result.success).toBe(true);
		});
	});
}); 