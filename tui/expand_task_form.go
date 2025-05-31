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
	expandTaskFormKeyFile     = "file"
	expandTaskFormKeyID       = "id"
	expandTaskFormKeyAll      = "all"
	expandTaskFormKeyNum      = "num"
	expandTaskFormKeyResearch = "research"
	expandTaskFormKeyPrompt   = "prompt"
	expandTaskFormKeyForce    = "force"
)

// ExpandTaskModel holds the state for the expand task form.
type ExpandTaskModel struct {
	form         *huh.Form
	aborted      bool
	isProcessing bool
	statusMsg    string
	width        int

	// Form values
	FilePath     string
	TaskID       string // Can be empty if 'all' is true
	AllPending   bool   // Expand all pending tasks
	NumSubtasks  int    // Number of subtasks to generate
	UseResearch  bool
	Prompt       string // Additional context
	ForceExpand  bool   // Force expansion even if subtasks exist
}

// NewExpandTaskForm creates a new form for the expand task command.
func NewExpandTaskForm() *ExpandTaskModel {
	m := &ExpandTaskModel{
		NumSubtasks: 3,  // Default number of subtasks
		UseResearch: false,
		ForceExpand: false,
		AllPending:  false,
	}

	// Temporary string for NumSubtasks input
	numSubtasksStr := strconv.Itoa(m.NumSubtasks)

	m.form = huh.NewForm(
		huh.NewGroup(
			huh.NewInput().
				Key(expandTaskFormKeyFile).
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
				Key(expandTaskFormKeyID).
				Title("Task ID (Optional)").
				Description("ID of the task to expand. Leave empty if 'Expand All' is Yes.").
				Prompt("🆔 ").
				// Validate based on whether 'AllPending' is true or false during form processing
				Value(&m.TaskID),

			huh.NewConfirm().
				Key(expandTaskFormKeyAll).
				Title("Expand All Pending Tasks").
				Description("Expand all tasks that are currently pending?").
				Affirmative("Yes").
				Negative("No").
				Value(&m.AllPending),
		),
		huh.NewGroup(
			huh.NewInput().
				Key(expandTaskFormKeyNum).
				Title("Number of Subtasks").
				Description("How many subtasks to generate for each expansion?").
				Prompt("🔢 ").
				Validate(func(s string) error {
					if s == "" { return fmt.Errorf("number of subtasks cannot be empty") }
					val, err := strconv.Atoi(s)
					if err != nil { return fmt.Errorf("must be a valid integer") }
					if val <= 0 { return fmt.Errorf("must be greater than 0") }
					return nil
				}).
				Value(&numSubtasksStr), // Use temporary string, parse on completion

			huh.NewConfirm().
				Key(expandTaskFormKeyResearch).
				Title("Use Research").
				Description("Incorporate research for generating subtasks?").
				Affirmative("Yes").
				Negative("No").
				Value(&m.UseResearch),
		),
		huh.NewGroup(
			huh.NewText().
				Key(expandTaskFormKeyPrompt).
				Title("Additional Context (Optional)").
				Description("Provide additional context or specific instructions for subtask generation.").
				Prompt("💬 ").
				CharLimit(1000).
				Value(&m.Prompt),

			huh.NewConfirm().
				Key(expandTaskFormKeyForce).
				Title("Force Expansion").
				Description("Force expansion even if the task already has subtasks?").
				Affirmative("Yes").
				Negative("No").
				Value(&m.ForceExpand),
		),
	).WithTheme(huh.ThemeDracula())

	return m
}

func (m *ExpandTaskModel) Init() tea.Cmd {
	m.isProcessing = false
	m.statusMsg = ""
	m.aborted = false
	return m.form.Init()
}

func (m *ExpandTaskModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	if m.isProcessing { // Standard processing lock
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
		fmt.Fprintf(os.Stderr, "Critical Error: expand_task_form.go - form update did not return *huh.Form. Got: %T\n", formModel)
		return m, tea.Quit
	}
	cmds = append(cmds, cmd)

	// Custom validation: If 'AllPending' is false, 'TaskID' must not be empty.
	// This is checked after form processes its own state, before completion.
	if !m.form.GetBool(expandTaskFormKeyAll) && m.form.GetString(expandTaskFormKeyID) == "" {
		// This logic might be better placed within a ValidateFunc on the group or form,
		// or handled upon completion attempt. For now, let's ensure it doesn't go to completed state.
		if m.form.State == huh.StateCompleted { // Prevent completion if invalid
			m.form.State = huh.StateNormal
		}
		// Set error on the TaskID field
		idField := m.form.GetGroup(0).GetField(expandTaskFormKeyID)
		if idField != nil {
			idField.Error(fmt.Errorf("task ID is required if 'Expand All' is No"))
		}
	} else if m.form.GetBool(expandTaskFormKeyAll) && m.form.GetString(expandTaskFormKeyID) != "" {
        // If 'AllPending' is true, TaskID should ideally be empty or ignored.
        // Clear error if previously set.
        idField := m.form.GetGroup(0).GetField(expandTaskFormKeyID)
		if idField != nil {
            idField.Error(nil) // Clear error
        }
    }


	if m.form.State == huh.StateCompleted {
		// Final check for TaskID if 'All' is not selected
		if !m.AllPending && m.TaskID == "" {
			m.statusMsg = "Error: Task ID is required when not expanding all pending tasks."
			m.form.State = huh.StateNormal // Revert to allow correction
			// Attempt to focus the TaskID field or show error more directly if possible
			// For now, statusMsg will have to do, or the field-specific error above.
			return m, nil
		}

		numSubtasksStrValue := m.form.GetString(expandTaskFormKeyNum)
		parsedNumSubtasks, err := strconv.Atoi(numSubtasksStrValue)
		if err != nil {
			m.statusMsg = fmt.Sprintf("Error parsing number of subtasks: %v. Please correct.", err)
			m.form.State = huh.StateNormal
			if group := m.form.GetGroup(1); group != nil {
				if field := group.GetField(expandTaskFormKeyNum); field != nil {
					field.Error(fmt.Errorf("invalid number: %s", numSubtasksStrValue))
				}
			}
			return m, nil
		}
		m.NumSubtasks = parsedNumSubtasks

		m.statusMsg = fmt.Sprintf("Form complete. Values:\n"+
			"  File: %s\n  Task ID: %s\n  Expand All: %t\n  Num Subtasks: %d\n"+
			"  Use Research: %t\n  Prompt: %s\n  Force Expand: %t\n\n(Simulating command execution...)",
			m.FilePath, m.TaskID, m.AllPending, m.NumSubtasks, m.UseResearch, m.Prompt, m.ForceExpand)
		m.isProcessing = true
		// TODO: return m, m.executeActualExpandCommand()
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

func (m *ExpandTaskModel) View() string {
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

// GetFormValues retrieves the structured data after completion.
func (m *ExpandTaskModel) GetFormValues() (map[string]interface{}, error) {
	if m.form.State != huh.StateCompleted {
		return nil, fmt.Errorf("form is not yet completed")
	}
	return map[string]interface{}{
		expandTaskFormKeyFile:     m.FilePath,
		expandTaskFormKeyID:       m.TaskID,
		expandTaskFormKeyAll:      m.AllPending,
		expandTaskFormKeyNum:      m.NumSubtasks,
		expandTaskFormKeyResearch: m.UseResearch,
		expandTaskFormKeyPrompt:   m.Prompt,
		expandTaskFormKeyForce:    m.ForceExpand,
	}, nil
}

var _ tea.Model = &ExpandTaskModel{}
