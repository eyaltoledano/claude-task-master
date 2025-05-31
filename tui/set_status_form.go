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
	setStatusFormKeyFile         = "file"
	setStatusFormKeyIDs          = "ids" // Comma-separated task IDs
	setStatusFormKeyStatus       = "status"
	setStatusFormKeyCriteriaMet = "criteria-met"
)

// TaskStatus represents the possible statuses for a task.
type TaskStatus string

const (
	StatusTodo       TaskStatus = "todo"
	StatusInProgress TaskStatus = "in-progress"
	StatusReview     TaskStatus = "review"
	StatusDone       TaskStatus = "done"
)

// SetStatusModel holds the state for the set-status form.
type SetStatusModel struct {
	form         *huh.Form
	aborted      bool
	isProcessing bool
	statusMsg    string // Renamed from 'status' to avoid conflict with form field
	width        int

	// Form values
	FilePath     string
	TaskIDs      string // Comma-separated string of task IDs
	NewStatus    TaskStatus
	CriteriaMet bool
}

// NewSetStatusForm creates a new form for the set-status command.
func NewSetStatusForm() *SetStatusModel {
	m := &SetStatusModel{
		NewStatus:   StatusTodo, // Default status
		CriteriaMet: false,      // Default for criteria met
	}

	m.form = huh.NewForm(
		huh.NewGroup(
			huh.NewInput().
				Key(setStatusFormKeyFile).
				Title("Tasks File Path").
				Description("Path to the tasks file (e.g., tasks.md).").
				Prompt("📄 ").
				Validate(func(s string) error {
					if s == "" {
						return fmt.Errorf("tasks file path cannot be empty")
					}
					return nil
				}).
				Value(&m.FilePath),

			huh.NewInput().
				Key(setStatusFormKeyIDs).
				Title("Task ID(s)").
				Description("Enter task ID(s), comma-separated (e.g., \"1\", \"2.1,3\").").
				Prompt("🆔 ").
				Validate(func(s string) error {
					if s == "" {
						return fmt.Errorf("task ID(s) cannot be empty")
					}
					// Basic validation, can be expanded (e.g., regex for ID format)
					return nil
				}).
				Value(&m.TaskIDs),
		),
		huh.NewGroup(
			huh.NewSelect[TaskStatus]().
				Key(setStatusFormKeyStatus).
				Title("New Status").
				Description("Select the new status for the task(s).").
				Options(
					huh.NewOption("To Do", StatusTodo),
					huh.NewOption("In Progress", StatusInProgress),
					huh.NewOption("Review", StatusReview),
					huh.NewOption("Done", StatusDone),
				).
				Value(&m.NewStatus),

			huh.NewConfirm().
				Key(setStatusFormKeyCriteriaMet).
				Title("Acceptance Criteria Met").
				Description("Are all acceptance criteria met (for checkpoint tasks)?").
				Affirmative("Yes").
				Negative("No").
				Value(&m.CriteriaMet),
		),
	).WithTheme(huh.ThemeDracula())

	return m
}

func (m *SetStatusModel) Init() tea.Cmd {
	m.isProcessing = false
	m.statusMsg = ""
	m.aborted = false
	return m.form.Init()
}

func (m *SetStatusModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	if m.isProcessing {
		if keyMsg, ok := msg.(tea.KeyMsg); ok {
			switch keyMsg.String() {
			case "ctrl+c", "q":
				return m, tea.Quit
			}
		}
		return m, nil
	}

	var cmds []tea.Cmd
	formModel, cmd := m.form.Update(msg)
	if updatedForm, ok := formModel.(*huh.Form); ok {
		m.form = updatedForm
	} else {
		m.statusMsg = "Error: Form update returned unexpected type."
		fmt.Fprintf(os.Stderr, "Critical Error: set_status_form.go - form update did not return *huh.Form. Got: %T\n", formModel)
		return m, tea.Quit
	}
	cmds = append(cmds, cmd)

	if m.form.State == huh.StateCompleted {
		m.statusMsg = fmt.Sprintf("Form complete. Values:\n  File: %s\n  Task IDs: %s\n  New Status: %s\n  Criteria Met: %t\n\n(Simulating command execution...)",
			m.FilePath, m.TaskIDs, m.NewStatus, m.CriteriaMet)
		m.isProcessing = true
		// TODO: return m, m.executeActualSetStatusCommand()
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
				m.aborted = true
				return m, func() tea.Msg { return backToMenuMsg{} }
			}
		}
	case tea.WindowSizeMsg:
		m.width = msg.Width
	}

	return m, tea.Batch(cmds...)
}

func (m *SetStatusModel) View() string {
	if m.aborted {
		return "Form aborted. Returning to main menu..."
	}

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

	return lipgloss.NewStyle().
		Width(m.width).
		Padding(1, 2).
		Render(viewBuilder.String())
}

// GetFormValues retrieves the structured data after completion.
func (m *SetStatusModel) GetFormValues() (map[string]interface{}, error) {
	if m.form.State != huh.StateCompleted {
		return nil, fmt.Errorf("form is not yet completed")
	}
	return map[string]interface{}{
		setStatusFormKeyFile:        m.FilePath,
		setStatusFormKeyIDs:         m.TaskIDs,
		setStatusFormKeyStatus:      m.NewStatus,
		setStatusFormKeyCriteriaMet: m.CriteriaMet,
	}, nil
}

// Ensure SetStatusModel implements tea.Model.
var _ tea.Model = &SetStatusModel{}
