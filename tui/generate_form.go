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
	generateFormKeyFile   = "file"
	generateFormKeyOutput = "output" // Directory path
)

// GenerateFilesModel holds the state for the generate (task files) form.
type GenerateFilesModel struct {
	form         *huh.Form
	aborted      bool
	isProcessing bool
	status       string
	width        int

	// Form values
	FilePath      string // Path to the input tasks file
	OutputDirectory string // Path to the output directory
}

// NewGenerateFilesForm creates a new form for the generate command.
func NewGenerateFilesForm() *GenerateFilesModel {
	m := &GenerateFilesModel{}

	m.form = huh.NewForm(
		huh.NewGroup(
			huh.NewInput().
				Key(generateFormKeyFile).
				Title("Tasks File Path").
				Description("Path to the input tasks file (e.g., tasks.md).").
				Prompt("📄 ").
				Validate(func(s string) error {
					if s == "" {
						return fmt.Errorf("tasks file path cannot be empty")
					}
					// Consider adding file existence validation if needed
					return nil
				}).
				Value(&m.FilePath),

			huh.NewInput().
				Key(generateFormKeyOutput).
				Title("Output Directory").
				Description("Path to the directory where task files will be generated.").
				Prompt("📁 ").
				Validate(func(s string) error {
					if s == "" {
						return fmt.Errorf("output directory cannot be empty")
					}
					// Consider adding directory validation (e.g., check if exists, or creatable)
					return nil
				}).
				Value(&m.OutputDirectory),
		),
	).WithTheme(huh.ThemeDracula())

	return m
}

func (m *GenerateFilesModel) Init() tea.Cmd {
	m.isProcessing = false
	m.status = ""
	m.aborted = false
	return m.form.Init()
}

func (m *GenerateFilesModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
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
		fmt.Fprintf(os.Stderr, "Critical Error: generate_form.go - form update did not return *huh.Form. Got: %T\n", formModel)
		return m, tea.Quit
	}
	cmds = append(cmds, cmd)

	if m.form.State == huh.StateCompleted {
		m.status = fmt.Sprintf("Form complete. Values:\n  Tasks File: %s\n  Output Directory: %s\n\n(Simulating command execution...)",
			m.FilePath, m.OutputDirectory)
		m.isProcessing = true
		// TODO: return m, m.executeActualGenerateCommand()
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

func (m *GenerateFilesModel) View() string {
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
func (m *GenerateFilesModel) GetFormValues() (map[string]interface{}, error) {
	if m.form.State != huh.StateCompleted {
		return nil, fmt.Errorf("form is not yet completed")
	}
	return map[string]interface{}{
		generateFormKeyFile:   m.FilePath,
		generateFormKeyOutput: m.OutputDirectory,
	}, nil
}

// Ensure GenerateFilesModel implements tea.Model.
var _ tea.Model = &GenerateFilesModel{}
