package main

import (
	"fmt"
	"os"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/huh"
	"github.com/charmbracelet/lipgloss"
)

const (
	addTaskFormKeyFile          = "file"
	addTaskFormKeyPrompt        = "prompt" // For AI generation
	addTaskFormKeyTitle         = "title"  // Manual
	addTaskFormKeyDescription   = "description" // Manual
	addTaskFormKeyDetails       = "details" // Manual
	addTaskFormKeyTestStrategy  = "test-strategy" // Manual
	addTaskFormKeyDependencies  = "dependencies"
	addTaskFormKeyPriority      = "priority"
	addTaskFormKeyType          = "type"
	addTaskFormKeyResearch      = "research"
	// addTaskFormKeyManual        = "manual-creation" // Could be a toggle
)

// TaskPriority represents task priority levels.
type TaskPriority string

const (
	PriorityHigh   TaskPriority = "high"
	PriorityMedium TaskPriority = "medium"
	PriorityLow    TaskPriority = "low"
)

// TaskType represents task types.
type TaskType string

const (
	TypeStandard   TaskType = "standard"
	TypeCheckpoint TaskType = "checkpoint"
)

// AddTaskModel holds the state for the add task form.
type AddTaskModel struct {
	form         *huh.Form
	aborted      bool
	isProcessing bool
	statusMsg    string
	width        int

	// Form values
	FilePath      string
	Prompt        string // AI prompt
	Title         string // Manual title
	Description   string // Manual description
	Details       string // Manual details
	TestStrategy  string // Manual test strategy
	Dependencies  string // Comma-separated IDs
	Priority      TaskPriority
	Type          TaskType
	UseResearch   bool
	// IsManual      bool // If true, show manual fields, else show AI prompt
}

// NewAddTaskForm creates a new form for the add-task command.
func NewAddTaskForm() *AddTaskModel {
	m := &AddTaskModel{
		Priority:    PriorityMedium, // Default priority
		Type:        TypeStandard,   // Default type
		UseResearch: false,
		// IsManual:    false, // Default to AI prompt
	}

	// Note: The form doesn't dynamically show/hide fields based on IsManual.
	// All fields are defined. Users should fill relevant ones.
	// A more complex setup could use form groups that are conditionally shown,
	// or multiple forms/steps. For this iteration, all fields are available.

	m.form = huh.NewForm(
		huh.NewGroup( // Group 1: File and Core Task Info
			huh.NewInput().
				Key(addTaskFormKeyFile).
				Title("Tasks File Path").
				Description("Path to the tasks file (e.g., tasks.md).").
				Prompt("📄 ").
				Validate(func(s string) error {
					if s == "" { return fmt.Errorf("file path cannot be empty") }
					return nil
				}).
				Value(&m.FilePath),
		),
		// Group for AI-assisted generation (prompt)
		huh.NewGroup(
			huh.NewText(). // Use Text for potentially longer prompts
				Key(addTaskFormKeyPrompt).
				Title("AI Prompt for Task (Optional)").
				Description("Describe the task for AI generation. Leave blank for manual entry of title/description etc.").
				Prompt("✨ ").
				CharLimit(1000).
				Value(&m.Prompt),
		).WithHideFunc(func() bool { return false }), // Always show for now

		// Group for Manual Creation Fields - shown if AI prompt is empty, or always available
		huh.NewGroup(
			huh.NewInput().
				Key(addTaskFormKeyTitle).
				Title("Task Title (Manual)").
				Description("Enter the task title if not using AI prompt.").
				Prompt("🏷️ ").
				Value(&m.Title),
			huh.NewText().
				Key(addTaskFormKeyDescription).
				Title("Task Description (Manual)").
				Description("Detailed description of the task.").
				Prompt("📝 ").
				CharLimit(2000).
				Value(&m.Description),
			huh.NewText().
				Key(addTaskFormKeyDetails).
				Title("Implementation Details (Manual, Optional)").
				Description("Specifics on how to implement the task.").
				Value(&m.Details),
			huh.NewText().
				Key(addTaskFormKeyTestStrategy).
				Title("Test Strategy (Manual, Optional)").
				Description("How to test this task.").
				Value(&m.TestStrategy),
		).WithTitle("Manual Task Details (if AI Prompt is empty or for refinement)"),

		// Group for Common Task Attributes
		huh.NewGroup(
			huh.NewInput().
				Key(addTaskFormKeyDependencies).
				Title("Dependencies (Optional)").
				Description("Comma-separated task IDs (e.g., \"1,2.1,3\").").
				Prompt("🔗 ").
				Value(&m.Dependencies),

			huh.NewSelect[TaskPriority]().
				Key(addTaskFormKeyPriority).
				Title("Priority").
				Options(
					huh.NewOption("High", PriorityHigh),
					huh.NewOption("Medium", PriorityMedium),
					huh.NewOption("Low", PriorityLow),
				).
				Value(&m.Priority),

			huh.NewSelect[TaskType]().
				Key(addTaskFormKeyType).
				Title("Task Type").
				Options(
					huh.NewOption("Standard", TypeStandard),
					huh.NewOption("Checkpoint", TypeCheckpoint),
				).
				Value(&m.Type),

			huh.NewConfirm().
				Key(addTaskFormKeyResearch).
				Title("Use Research Capabilities").
				Description("Enhance task generation/details with research?").
				Affirmative("Yes").
				Negative("No").
				Value(&m.UseResearch),
		).WithTitle("Task Attributes"),
	).WithTheme(huh.ThemeDracula())

	return m
}

func (m *AddTaskModel) Init() tea.Cmd {
	m.isProcessing = false
	m.statusMsg = ""
	m.aborted = false
	return m.form.Init()
}

func (m *AddTaskModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	if m.isProcessing {
		if keyMsg, ok := msg.(tea.KeyMsg); ok {
			if keyMsg.String() == "ctrl+c" || keyMsg.String() == "q" { return m, tea.Quit }
		}
		return m, nil
	}

	var cmds []tea.Cmd
	formModel, cmd := m.form.Update(msg)
	if updatedForm, ok := formModel.(*huh.Form); ok {
		m.form = updatedForm
	} else {
		m.statusMsg = "Error: Form update returned unexpected type."
		fmt.Fprintf(os.Stderr, "Critical Error: add_task_form.go - form update did not return *huh.Form. Got: %T\n", formModel)
		return m, tea.Quit
	}
	cmds = append(cmds, cmd)

	// Validation: if prompt is empty, title must be provided.
	promptIsEmpty := m.form.GetString(addTaskFormKeyPrompt) == ""
	titleIsEmpty := m.form.GetString(addTaskFormKeyTitle) == ""

	titleField := m.form.GetGroup(2).GetField(addTaskFormKeyTitle) // Assuming title is in 3rd group (index 2)

	if promptIsEmpty && titleIsEmpty {
		if titleField != nil { titleField.Error(fmt.Errorf("task Title is required if AI Prompt is empty")) }
		if m.form.State == huh.StateCompleted { m.form.State = huh.StateNormal }
	} else {
		if titleField != nil { titleField.Error(nil) } // Clear error if condition met
	}


	if m.form.State == huh.StateCompleted {
		// Re-check for final submission
		if m.Prompt == "" && m.Title == "" { // Check bound struct fields
			m.statusMsg = "Error: Either an AI Prompt or a manual Task Title is required."
			m.form.State = huh.StateNormal // Revert to allow correction
			return m, nil
		}

		m.statusMsg = fmt.Sprintf("Form complete. Values:\n"+
			"  File: %s\n  AI Prompt: %s\n  Title: %s\n  Description: %s\n"+
			"  Details: %s\n  Test Strategy: %s\n  Dependencies: %s\n"+
			"  Priority: %s\n  Type: %s\n  Research: %t\n\n(Simulating command execution...)",
			m.FilePath, m.Prompt, m.Title, m.Description, m.Details, m.TestStrategy,
			m.Dependencies, m.Priority, m.Type, m.UseResearch)
		m.isProcessing = true
		// TODO: return m, m.executeActualAddTaskCommand()
		return m, nil
	}

	if m.form.State == huh.StateAborted {
		m.aborted = true
		return m, func() tea.Msg { return backToMenuMsg{} }
	}

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "esc":
			if !m.isProcessing {
				m.aborted = true; return m, func() tea.Msg { return backToMenuMsg{} }
			}
		}
	case tea.WindowSizeMsg:
		m.width = msg.Width
	}

	return m, tea.Batch(cmds...)
}

func (m *AddTaskModel) View() string {
	if m.aborted { return "Form aborted. Returning to main menu..." }

	var viewBuilder strings.Builder
	viewBuilder.WriteString(m.form.View())

	if m.statusMsg != "" {
		viewBuilder.WriteString("\n\n")
		statusStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("205"))
		if strings.HasPrefix(m.statusMsg, "Error:") {
			statusStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("196"))
		}
		viewBuilder.WriteString(statusStyle.Render(m.statusMsg))
	}

	helpStyle := lipgloss.NewStyle().Faint(true)
	if m.isProcessing {
		viewBuilder.WriteString(helpStyle.Render("\n\nProcessing... Press Ctrl+C to force quit."))
	} else if m.form.State != huh.StateCompleted && m.form.State != huh.StateAborted {
		viewBuilder.WriteString(helpStyle.Render("\n\nPress Esc to return to main menu, Ctrl+C to quit application."))
	}
	return lipgloss.NewStyle().Width(m.width).Padding(1, 2).Render(viewBuilder.String())
}

var _ tea.Model = &AddTaskModel{}
