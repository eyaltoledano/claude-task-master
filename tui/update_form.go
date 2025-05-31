package main

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/huh"
	"github.com/charmbracelet/lipgloss"
)

const (
	updateFormKeyFile     = "file"
	updateFormKeyFrom     = "from"
	updateFormKeyPrompt   = "prompt"
	updateFormKeyResearch = "research"
)

// UpdateTaskModel holds the state for the update tasks form.
type UpdateTaskModel struct {
	form         *huh.Form
	aborted      bool
	isProcessing bool
	status       string
	width        int

	// Form values
	FilePath string
	FromTask int // Task ID to start updating from
	Prompt   string
	Research bool
}

// NewUpdateTaskForm creates a new form for the update command.
func NewUpdateTaskForm() *UpdateTaskModel {
	m := &UpdateTaskModel{
		FromTask: 1, // Default to start from task 1
		Research: false,
	}

	// Temporary string for FromTask input
	fromTaskStr := strconv.Itoa(m.FromTask)

	m.form = huh.NewForm(
		huh.NewGroup(
			huh.NewInput().
				Key(updateFormKeyFile).
				Title("Tasks File Path").
				Description("Path to the tasks file (e.g., tasks.md).").
				Prompt("📄 ").
				Validate(func(s string) error {
					if s == "" {
						return fmt.Errorf("file path cannot be empty")
					}
					// Consider adding file existence check if appropriate
					return nil
				}).
				Value(&m.FilePath),

			huh.NewInput().
				Key(updateFormKeyFrom).
				Title("From Task ID").
				Description("Task ID to start updating from.").
				Prompt("🔢 ").
				Validate(func(s string) error {
					if s == "" {
						return fmt.Errorf("'from' task ID cannot be empty")
					}
					val, err := strconv.Atoi(s)
					if err != nil {
						return fmt.Errorf("must be a valid integer")
					}
					if val <= 0 {
						return fmt.Errorf("task ID must be greater than 0")
					}
					return nil
				}).
				Value(&fromTaskStr), // Use temporary string, parse on completion

			huh.NewText(). // For potentially longer prompt text
				Key(updateFormKeyPrompt).
				Title("Update Prompt").
				Description("Explain the changes to be applied to the tasks.").
				Prompt("💬 ").
				CharLimit(500). // Optional character limit
				Validate(func(s string) error {
					if s == "" {
						return fmt.Errorf("prompt cannot be empty")
					}
					return nil
				}).
				Value(&m.Prompt),
		),
		huh.NewGroup(
			huh.NewConfirm().
				Key(updateFormKeyResearch).
				Title("Use Research").
				Description("Incorporate research-backed task updates?").
				Affirmative("Yes").
				Negative("No").
				Value(&m.Research),
		),
	).WithTheme(huh.ThemeDracula())

	return m
}

func (m *UpdateTaskModel) Init() tea.Cmd {
	m.isProcessing = false
	m.status = ""
	m.aborted = false
	return m.form.Init()
}

func (m *UpdateTaskModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
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
		m.status = "Error: Form update returned unexpected type."
		fmt.Fprintf(os.Stderr, "Critical Error: update_form.go - form update did not return *huh.Form. Got: %T\n", formModel)
		return m, tea.Quit
	}
	cmds = append(cmds, cmd)

	if m.form.State == huh.StateCompleted {
		// Parse FromTask from string
		fromTaskStrValue := m.form.GetString(updateFormKeyFrom)
		parsedFromTask, err := strconv.Atoi(fromTaskStrValue)
		if err != nil {
			m.status = fmt.Sprintf("Error parsing 'from' task ID: %v. Please correct.", err)
			m.form.State = huh.StateNormal
			if group := m.form.GetGroup(0); group != nil { // Assuming 'from' is in the first group
				if field := group.GetField(updateFormKeyFrom); field != nil {
					field.Error(fmt.Errorf("invalid number: %s", fromTaskStrValue))
				}
			}
			return m, nil
		}
		m.FromTask = parsedFromTask

		m.status = fmt.Sprintf("Form complete. Values:\n  File: %s\n  From Task: %d\n  Prompt: %s\n  Research: %t\n\n(Simulating command execution...)",
			m.FilePath, m.FromTask, m.Prompt, m.Research)
		m.isProcessing = true
		// TODO: return m, m.executeActualUpdateCommand()
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

func (m *UpdateTaskModel) View() string {
	if m.aborted {
		return "Form aborted. Returning to main menu..."
	}

	var viewBuilder strings.Builder
	viewBuilder.WriteString(m.form.View())

	if m.status != "" {
		viewBuilder.WriteString("\n\n")
		statusStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("205"))
		if strings.HasPrefix(m.status, "Error:") {
			statusStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("196"))
		}
		viewBuilder.WriteString(statusStyle.Render(m.status))
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

// GetFormValues can be used to retrieve the structured data after completion.
func (m *UpdateTaskModel) GetFormValues() (map[string]interface{}, error) {
	if m.form.State != huh.StateCompleted {
		return nil, fmt.Errorf("form is not yet completed")
	}
	return map[string]interface{}{
		updateFormKeyFile:     m.FilePath,
		updateFormKeyFrom:     m.FromTask,
		updateFormKeyPrompt:   m.Prompt,
		updateFormKeyResearch: m.Research,
	}, nil
}

// Ensure UpdateTaskModel implements tea.Model.
var _ tea.Model = &UpdateTaskModel{}
