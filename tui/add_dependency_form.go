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
	addDepFormKeyFile      = "file"
	addDepFormKeyTaskID    = "id"       // Task ID to add dependency to
	addDepFormKeyDependsOn = "depends-on" // Task ID that is the dependency
)

// AddDependencyModel holds the state for the add-dependency form.
type AddDependencyModel struct {
	form         *huh.Form
	aborted      bool
	isProcessing bool
	statusMsg    string
	width        int

	// Form values
	FilePath  string
	TaskID    string
	DependsOn string
}

// NewAddDependencyForm creates a new form for the add-dependency command.
func NewAddDependencyForm() *AddDependencyModel {
	m := &AddDependencyModel{}

	m.form = huh.NewForm(
		huh.NewGroup(
			huh.NewInput().
				Key(addDepFormKeyFile).
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
				Key(addDepFormKeyTaskID).
				Title("Task ID").
				Description("ID of the task to add a dependency to (e.g., \"2\").").
				Prompt("🆔 ").
				Validate(func(s string) error {
					if s == "" {
						return fmt.Errorf("task ID cannot be empty")
					}
					return nil
				}).
				Value(&m.TaskID),

			huh.NewInput().
				Key(addDepFormKeyDependsOn).
				Title("Depends On ID").
				Description("ID of the task that the above task will depend on (e.g., \"1\").").
				Prompt("🔗 ").
				Validate(func(s string) error {
					if s == "" {
						return fmt.Errorf("'depends on' ID cannot be empty")
					}
					// Could add validation to ensure TaskID and DependsOn are different
					return nil
				}).
				Value(&m.DependsOn),
		),
	).WithTheme(huh.ThemeDracula())

	return m
}

func (m *AddDependencyModel) Init() tea.Cmd {
	m.isProcessing = false
	m.statusMsg = ""
	m.aborted = false
	return m.form.Init()
}

func (m *AddDependencyModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	if m.isProcessing {
		if keyMsg, ok := msg.(tea.KeyMsg); ok {
			if keyMsg.String() == "ctrl+c" || keyMsg.String() == "q" {
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
		fmt.Fprintf(os.Stderr, "Critical Error: add_dependency_form.go - form update did not return *huh.Form. Got: %T\n", formModel)
		return m, tea.Quit
	}
	cmds = append(cmds, cmd)

	if m.form.State == huh.StateCompleted {
		if m.TaskID == m.DependsOn && m.TaskID != "" { // Check bound struct fields
			m.statusMsg = "Error: Task ID and 'Depends On' ID cannot be the same."
			m.form.State = huh.StateNormal // Revert to allow correction
			// Optionally, set errors on specific fields
			taskIDField := m.form.GetGroup(0).GetField(addDepFormKeyTaskID)
			dependsOnField := m.form.GetGroup(0).GetField(addDepFormKeyDependsOn)
			if taskIDField != nil { taskIDField.Error(fmt.Errorf("cannot be the same as 'Depends On' ID")) }
			if dependsOnField != nil { dependsOnField.Error(fmt.Errorf("cannot be the same as Task ID")) }
			return m, nil
		} else {
            // Clear errors if they were previously set and condition is no longer met
            taskIDField := m.form.GetGroup(0).GetField(addDepFormKeyTaskID)
			dependsOnField := m.form.GetGroup(0).GetField(addDepFormKeyDependsOn)
            if taskIDField != nil { taskIDField.Error(nil) }
			if dependsOnField != nil { dependsOnField.Error(nil) }
        }


		m.statusMsg = fmt.Sprintf("Form complete. Values:\n  File: %s\n  Task ID: %s\n  Depends On ID: %s\n\n(Simulating command execution...)",
			m.FilePath, m.TaskID, m.DependsOn)
		m.isProcessing = true
		// TODO: return m, m.executeActualAddDependencyCommand()
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

func (m *AddDependencyModel) View() string {
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
		viewBuilder.WriteString(helpStyle.Render("\n\nProcessing dependency... Press Ctrl+C to quit."))
	} else if m.form.State != huh.StateCompleted && m.form.State != huh.StateAborted {
		viewBuilder.WriteString(helpStyle.Render("\n\nPress Esc to return to main menu, Ctrl+C to quit application."))
	}

	return lipgloss.NewStyle().
		Width(m.width).
		Padding(1, 2).
		Render(viewBuilder.String())
}

// GetFormValues retrieves the structured data after completion.
func (m *AddDependencyModel) GetFormValues() (map[string]interface{}, error) {
	if m.form.State != huh.StateCompleted {
		return nil, fmt.Errorf("form is not yet completed")
	}
	if m.TaskID == m.DependsOn && m.TaskID != "" {
        return nil, fmt.Errorf("task ID and 'Depends On' ID cannot be the same")
    }
	return map[string]interface{}{
		addDepFormKeyFile:      m.FilePath,
		addDepFormKeyTaskID:    m.TaskID,
		addDepFormKeyDependsOn: m.DependsOn,
	}, nil
}

var _ tea.Model = &AddDependencyModel{}
