package main

import (
	"fmt"
	"os"
	"strings"
	// "regexp" // For more complex ID validation if needed

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/huh"
	"github.com/charmbracelet/lipgloss"
)

const (
	updateSubtaskFormKeyFile     = "file"
	updateSubtaskFormKeyID       = "id" // Subtask ID, e.g., "1.2"
	updateSubtaskFormKeyPrompt   = "prompt"
	updateSubtaskFormKeyResearch = "research"
)

// UpdateSubtaskModel holds the state for the update-subtask form.
type UpdateSubtaskModel struct {
	form         *huh.Form
	aborted      bool
	isProcessing bool
	status       string
	width        int

	// Form values
	FilePath   string
	SubtaskID  string // e.g., "1.2"
	Prompt     string
	Research   bool
}

// NewUpdateSubtaskForm creates a new form for the update-subtask command.
func NewUpdateSubtaskForm() *UpdateSubtaskModel {
	m := &UpdateSubtaskModel{
		Research: false, // Default for research
	}

	// Example validation for subtask ID format (e.g., "1.2", "10.3.1")
	// var subtaskIDRegex = regexp.MustCompile(`^\d+(\.\d+)*$`)

	m.form = huh.NewForm(
		huh.NewGroup(
			huh.NewInput().
				Key(updateSubtaskFormKeyFile).
				Title("Tasks File Path").
				Description("Path to the tasks file (e.g., tasks.md).").
				Prompt("📄 ").
				Validate(func(s string) error {
					if s == "" {
						return fmt.Errorf("file path cannot be empty")
					}
					return nil
				}).
				Value(&m.FilePath),

			huh.NewInput().
				Key(updateSubtaskFormKeyID).
				Title("Subtask ID").
				Description("ID of the subtask to update (e.g., \"1.2\", \"3.1.4\").").
				Prompt("🆔 ").
				Validate(func(s string) error {
					if s == "" {
						return fmt.Errorf("subtask ID cannot be empty")
					}
					// if !subtaskIDRegex.MatchString(s) {
					// 	return fmt.Errorf("invalid subtask ID format (e.g., '1.2', '10.3.1')")
					// }
					return nil
				}).
				Value(&m.SubtaskID),

			huh.NewText().
				Key(updateSubtaskFormKeyPrompt).
				Title("Update Prompt").
				Description("Explain the information to add or changes for this subtask.").
				Prompt("💬 ").
				CharLimit(500). // Optional
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
				Key(updateSubtaskFormKeyResearch).
				Title("Use Research").
				Description("Incorporate research-backed updates for this subtask?").
				Affirmative("Yes").
				Negative("No").
				Value(&m.Research),
		),
	).WithTheme(huh.ThemeDracula())

	return m
}

func (m *UpdateSubtaskModel) Init() tea.Cmd {
	m.isProcessing = false
	m.status = ""
	m.aborted = false
	return m.form.Init()
}

func (m *UpdateSubtaskModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
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
		fmt.Fprintf(os.Stderr, "Critical Error: update_subtask_form.go - form update did not return *huh.Form. Got: %T\n", formModel)
		return m, tea.Quit
	}
	cmds = append(cmds, cmd)

	if m.form.State == huh.StateCompleted {
		m.status = fmt.Sprintf("Form complete. Values:\n  File: %s\n  Subtask ID: %s\n  Prompt: %s\n  Research: %t\n\n(Simulating command execution...)",
			m.FilePath, m.SubtaskID, m.Prompt, m.Research)
		m.isProcessing = true
		// TODO: return m, m.executeActualUpdateSubtaskCommand()
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

func (m *UpdateSubtaskModel) View() string {
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

// GetFormValues retrieves the structured data after completion.
func (m *UpdateSubtaskModel) GetFormValues() (map[string]interface{}, error) {
	if m.form.State != huh.StateCompleted {
		return nil, fmt.Errorf("form is not yet completed")
	}
	return map[string]interface{}{
		updateSubtaskFormKeyFile:     m.FilePath,
		updateSubtaskFormKeyID:       m.SubtaskID,
		updateSubtaskFormKeyPrompt:   m.Prompt,
		updateSubtaskFormKeyResearch: m.Research,
	}, nil
}

// Ensure UpdateSubtaskModel implements tea.Model.
var _ tea.Model = &UpdateSubtaskModel{}
