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
	prdFormKeyFile     = "file"
	prdFormKeyOutput   = "output"
	prdFormKeyNumTasks = "num-tasks"
	prdFormKeyForce    = "force"
	prdFormKeyAppend   = "append"
)

// ParsePRDModel holds the state for the parse-prd form.
type ParsePRDModel struct {
	form         *huh.Form
	aborted      bool
	isProcessing bool   // To simulate command execution
	status       string // For messages after completion or errors
	width        int    // Terminal width for layout

	// Fields to store form values, bound to the form
	FilePath   string
	OutputPath string
	NumTasks   int  // Will be parsed from string input
	Force      bool
	Append     bool
}

// NewParsePRDModel creates a new form for the parse-prd command.
func NewParsePRDModel() *ParsePRDModel {
	// Initialize the model with default values
	// These defaults will be used to pre-populate form fields where appropriate
	// or serve as fallback if a field isn't explicitly set.
	m := &ParsePRDModel{
		NumTasks: 5, // Default number of tasks
		Force:    false,
		Append:   false,
	}

	// Temporary string for NumTasks input, as huh.Input works with *string.
	// We'll parse this into m.NumTasks upon form completion.
	numTasksStr := strconv.Itoa(m.NumTasks)

	m.form = huh.NewForm(
		huh.NewGroup(
			huh.NewInput().
				Key(prdFormKeyFile).
				Title("PRD File Path").
				Description("Path to the Product Requirements Document.").
				Prompt("📄 ").
				Validate(func(s string) error {
					if s == "" {
						return fmt.Errorf("file path cannot be empty")
					}
					// TODO: Add more robust validation (e.g., check if file exists)
					return nil
				}).
				Value(&m.FilePath), // Direct binding

			huh.NewInput().
				Key(prdFormKeyOutput).
				Title("Output File Path").
				Description("Path for the generated tasks file (e.g., tasks.md).").
				Prompt("📄 ").
				Validate(func(s string) error {
					if s == "" {
						return fmt.Errorf("output path cannot be empty")
					}
					return nil
				}).
				Value(&m.OutputPath), // Direct binding
		),
		huh.NewGroup(
			huh.NewInput().
				Key(prdFormKeyNumTasks).
				Title("Number of Tasks").
				Description("How many tasks to generate?").
				Prompt("🔢 ").
				Validate(func(s string) error {
					if s == "" {
						// Or allow empty to use default, then handle in completion logic
						return fmt.Errorf("number of tasks cannot be empty")
					}
					val, err := strconv.Atoi(s)
					if err != nil {
						return fmt.Errorf("must be a valid integer")
					}
					if val <= 0 {
						return fmt.Errorf("must be greater than 0")
					}
					return nil
				}).
				Value(&numTasksStr), // Use temporary string, parse on completion

			huh.NewConfirm().
				Key(prdFormKeyForce).
				Title("Force Overwrite").
				Description("Overwrite output file if it exists?").
				Affirmative("Yes").
				Negative("No").
				Value(&m.Force), // Direct binding

			huh.NewConfirm().
				Key(prdFormKeyAppend).
				Title("Append to Output").
				Description("Append to output file if it exists?").
				Affirmative("Yes").
				Negative("No").
				Value(&m.Append), // Direct binding
		),
	).WithTheme(huh.ThemeDracula())

	return m
}

func (m *ParsePRDModel) Init() tea.Cmd {
	m.isProcessing = false
	m.status = ""
	m.aborted = false
	return m.form.Init()
}

func (m *ParsePRDModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	if m.isProcessing {
		// If processing, only allow exiting or handling specific processing messages.
		if keyMsg, ok := msg.(tea.KeyMsg); ok {
			switch keyMsg.String() {
			case "ctrl+c", "q": // Allow quitting during processing
				return m, tea.Quit
			}
		}
		return m, nil
	}

	var cmds []tea.Cmd

	// Process the form.
	formModel, cmd := m.form.Update(msg)
	if updatedForm, ok := formModel.(*huh.Form); ok {
		m.form = updatedForm
	} else {
		m.status = "Error: Form update returned unexpected type."
		fmt.Fprintf(os.Stderr, "Critical Error: form update did not return *huh.Form. Got: %T\n", formModel)
		return m, tea.Quit // Critical error, exit
	}
	cmds = append(cmds, cmd)

	if m.form.State == huh.StateCompleted {
		// Form is submitted. Values bound directly to m.FilePath, m.OutputPath, m.Force, m.Append.
		// Need to parse NumTasks from the temporary string value used in the form input.
		numTasksInputValue := m.form.GetString(prdFormKeyNumTasks) // Get the string from the form
		parsedNumTasks, err := strconv.Atoi(numTasksInputValue)
		if err != nil {
			// This should ideally be caught by validation, but double-check.
			m.status = fmt.Sprintf("Error parsing number of tasks: %v. Please correct.", err)
			m.form.State = huh.StateNormal // Revert state to allow correction
			// Find the NumTasks field and set its error
			if group := m.form.GetGroup(1); group != nil {
				if field := group.GetField(prdFormKeyNumTasks); field != nil {
					field.Error(fmt.Errorf("invalid number: %s", numTasksInputValue))
				}
			}
			return m, nil // Return without further command to allow user to fix
		}
		m.NumTasks = parsedNumTasks // Update the model's NumTasks field

		m.status = fmt.Sprintf("Form complete. Values:\n  File: %s\n  Output: %s\n  NumTasks: %d\n  Force: %t\n  Append: %t\n\n(Simulating command execution...)",
			m.FilePath, m.OutputPath, m.NumTasks, m.Force, m.Append)
		m.isProcessing = true

		// TODO: return m, m.executeParsePRDCommand()
		return m, nil
	}

	if m.form.State == huh.StateAborted {
		m.aborted = true
		return m, func() tea.Msg { return backToMenuMsg{} } // Signal to go back
	}

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		// Standard Bubble Tea quit behavior, respects form's own ctrl+c handling.
		// Esc is handled below for navigation.
		case "esc":
			if !m.isProcessing { // Don't allow escape if processing
				m.aborted = true
				return m, func() tea.Msg { return backToMenuMsg{} }
			}
		}
	case tea.WindowSizeMsg:
		m.width = msg.Width
		// If `huh.Form` has a SetWidth or similar, call it here.
		// For now, this is for the ParsePRDModel's View method.
	}

	return m, tea.Batch(cmds...)
}

func (m *ParsePRDModel) View() string {
	if m.aborted {
		// This view is shown briefly as the model is about to be switched.
		return "Form aborted. Returning to main menu..."
	}

	var viewBuilder strings.Builder
	viewBuilder.WriteString(m.form.View())

	if m.status != "" {
		viewBuilder.WriteString("\n\n")
		statusStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("205")) // Default status color
		if strings.HasPrefix(m.status, "Error:") {
			statusStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("196")) // Red for errors
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

// GetFormValues can be called after the form is completed and processing is done (or before processing starts)
// to get the structured data.
func (m *ParsePRDModel) GetFormValues() (map[string]interface{}, error) {
	if m.form.State != huh.StateCompleted {
		return nil, fmt.Errorf("form is not yet completed")
	}
	// Values are already parsed and stored in m.FilePath, m.OutputPath, etc.
	return map[string]interface{}{
		prdFormKeyFile:     m.FilePath,
		prdFormKeyOutput:   m.OutputPath,
		prdFormKeyNumTasks: m.NumTasks,
		prdFormKeyForce:    m.Force,
		prdFormKeyAppend:   m.Append,
	}, nil
}

// This message is used by this model to signal navigation.
// It should be handled in the main model's Update function.
// type backToMenuMsg struct{} // Assuming this is defined in main.go or a shared file.

// Ensure ParsePRDModel implements tea.Model.
var _ tea.Model = &ParsePRDModel{}
