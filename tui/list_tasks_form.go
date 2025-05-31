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
	listTasksFormKeyFile         = "file"
	listTasksFormKeyStatusFilter = "status-filter"
	listTasksFormKeyWithSubtasks = "with-subtasks"
)

// FilterStatus represents the possible statuses for filtering tasks, including "none".
type FilterStatus string

const (
	FilterStatusNone       FilterStatus = "none"
	FilterStatusTodo       FilterStatus = "todo"
	FilterStatusInProgress FilterStatus = "in-progress"
	FilterStatusReview     FilterStatus = "review"
	FilterStatusDone       FilterStatus = "done"
)

// ListTasksModel holds the state for the list tasks form.
type ListTasksModel struct {
	form         *huh.Form
	aborted      bool
	isProcessing bool
	statusMsg    string
	width        int

	// Form values
	FilePath      string
	StatusFilter  FilterStatus
	WithSubtasks  bool
}

// NewListTasksForm creates a new form for the list tasks command.
func NewListTasksForm() *ListTasksModel {
	m := &ListTasksModel{
		StatusFilter: FilterStatusNone, // Default to no filter
		WithSubtasks: true,             // Default to showing subtasks
	}

	m.form = huh.NewForm(
		huh.NewGroup(
			huh.NewInput().
				Key(listTasksFormKeyFile).
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
		),
		huh.NewGroup(
			huh.NewSelect[FilterStatus]().
				Key(listTasksFormKeyStatusFilter).
				Title("Filter by Status").
				Description("Select a status to filter tasks by, or 'None'.").
				Options(
					huh.NewOption("None (Show All)", FilterStatusNone),
					huh.NewOption("To Do", FilterStatusTodo),
					huh.NewOption("In Progress", FilterStatusInProgress),
					huh.NewOption("Review", FilterStatusReview),
					huh.NewOption("Done", FilterStatusDone),
				).
				Value(&m.StatusFilter),

			huh.NewConfirm().
				Key(listTasksFormKeyWithSubtasks).
				Title("Show Subtasks").
				Description("Include subtasks in the output?").
				Affirmative("Yes").
				Negative("No").
				Value(&m.WithSubtasks),
		),
	).WithTheme(huh.ThemeDracula())

	return m
}

func (m *ListTasksModel) Init() tea.Cmd {
	m.isProcessing = false
	m.statusMsg = ""
	m.aborted = false
	return m.form.Init()
}

func (m *ListTasksModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
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
		fmt.Fprintf(os.Stderr, "Critical Error: list_tasks_form.go - form update did not return *huh.Form. Got: %T\n", formModel)
		return m, tea.Quit
	}
	cmds = append(cmds, cmd)

	if m.form.State == huh.StateCompleted {
		m.statusMsg = fmt.Sprintf("Form complete. Values:\n  File: %s\n  Status Filter: %s\n  With Subtasks: %t\n\n(Simulating command execution...)",
			m.FilePath, m.StatusFilter, m.WithSubtasks)
		m.isProcessing = true
		// TODO: return m, m.executeActualListCommand()
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

func (m *ListTasksModel) View() string {
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
func (m *ListTasksModel) GetFormValues() (map[string]interface{}, error) {
	if m.form.State != huh.StateCompleted {
		return nil, fmt.Errorf("form is not yet completed")
	}
	return map[string]interface{}{
		listTasksFormKeyFile:         m.FilePath,
		listTasksFormKeyStatusFilter: m.StatusFilter,
		listTasksFormKeyWithSubtasks: m.WithSubtasks,
	}, nil
}

// Ensure ListTasksModel implements tea.Model.
var _ tea.Model = &ListTasksModel{}
