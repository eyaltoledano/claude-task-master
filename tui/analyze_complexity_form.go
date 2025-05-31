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
	analyzeComplexityFormKeyFile      = "file"
	analyzeComplexityFormKeyOutput    = "output"
	analyzeComplexityFormKeyModel     = "model"
	analyzeComplexityFormKeyThreshold = "threshold"
	analyzeComplexityFormKeyResearch  = "research"
)

// AnalyzeComplexityModel holds the state for the analyze task complexity form.
type AnalyzeComplexityModel struct {
	form         *huh.Form
	aborted      bool
	isProcessing bool
	statusMsg    string
	width        int

	// Form values
	FilePath         string
	OutputPath       string
	LLMModel         string // LLM model name
	MinComplexity    int    // Minimum complexity score threshold
	UseResearch      bool
}

// NewAnalyzeComplexityForm creates a new form for the analyze-complexity command.
func NewAnalyzeComplexityForm() *AnalyzeComplexityModel {
	m := &AnalyzeComplexityModel{
		LLMModel:      "gpt-4o", // Default LLM model
		MinComplexity: 5,        // Default minimum complexity
		UseResearch:   false,
	}

	// Temporary string for MinComplexity input
	minComplexityStr := strconv.Itoa(m.MinComplexity)

	m.form = huh.NewForm(
		huh.NewGroup(
			huh.NewInput().
				Key(analyzeComplexityFormKeyFile).
				Title("Tasks File Path").
				Description("Path to the input tasks file (e.g., tasks.md).").
				Prompt("📄 ").
				Validate(func(s string) error {
					if s == "" { return fmt.Errorf("tasks file path cannot be empty") }
					return nil
				}).
				Value(&m.FilePath),

			huh.NewInput().
				Key(analyzeComplexityFormKeyOutput).
				Title("Output Report File Path").
				Description("Path for the complexity analysis report (e.g., complexity_report.md).").
				Prompt("📄 ").
				Validate(func(s string) error {
					if s == "" { return fmt.Errorf("output report file path cannot be empty") }
					return nil
				}).
				Value(&m.OutputPath),
		),
		huh.NewGroup(
			huh.NewInput().
				Key(analyzeComplexityFormKeyModel).
				Title("LLM Model").
				Description("Specify the LLM model for complexity analysis (e.g., gpt-4o, claude-3-opus).").
				Prompt("🤖 ").
				Validate(func(s string) error {
					if s == "" { return fmt.Errorf("LLM model cannot be empty") }
					return nil
				}).
				Value(&m.LLMModel), // Default value set in struct is used by huh.Input

			huh.NewInput().
				Key(analyzeComplexityFormKeyThreshold).
				Title("Minimum Complexity Score").
				Description("Minimum complexity score to report (e.g., 1-10).").
				Prompt("🔢 ").
				Validate(func(s string) error {
					if s == "" { return fmt.Errorf("minimum complexity score cannot be empty") }
					val, err := strconv.Atoi(s)
					if err != nil { return fmt.Errorf("must be a valid integer") }
					if val < 0 || val > 10 { return fmt.Errorf("must be between 0 and 10 (inclusive)")} // Assuming a 0-10 scale
					return nil
				}).
				Value(&minComplexityStr), // Use temporary string, parse on completion
		),
		huh.NewGroup(
			huh.NewConfirm().
				Key(analyzeComplexityFormKeyResearch).
				Title("Use Research-Backed Analysis").
				Description("Enhance complexity analysis with research-backed techniques?").
				Affirmative("Yes").
				Negative("No").
				Value(&m.UseResearch),
		),
	).WithTheme(huh.ThemeDracula())

	return m
}

func (m *AnalyzeComplexityModel) Init() tea.Cmd {
	m.isProcessing = false
	m.statusMsg = ""
	m.aborted = false
	return m.form.Init()
}

func (m *AnalyzeComplexityModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
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
		fmt.Fprintf(os.Stderr, "Critical Error: analyze_complexity_form.go - form update did not return *huh.Form. Got: %T\n", formModel)
		return m, tea.Quit
	}
	cmds = append(cmds, cmd)

	if m.form.State == huh.StateCompleted {
		minComplexityStrValue := m.form.GetString(analyzeComplexityFormKeyThreshold)
		parsedMinComplexity, err := strconv.Atoi(minComplexityStrValue)
		if err != nil {
			m.statusMsg = fmt.Sprintf("Error parsing minimum complexity: %v. Please correct.", err)
			m.form.State = huh.StateNormal
			if group := m.form.GetGroup(1); group != nil { // Assuming threshold is in the second group
				if field := group.GetField(analyzeComplexityFormKeyThreshold); field != nil {
					field.Error(fmt.Errorf("invalid number: %s", minComplexityStrValue))
				}
			}
			return m, nil
		}
		m.MinComplexity = parsedMinComplexity

		m.statusMsg = fmt.Sprintf("Form complete. Values:\n"+
			"  File: %s\n  Output: %s\n  Model: %s\n  Threshold: %d\n  Research: %t\n\n(Simulating command execution...)",
			m.FilePath, m.OutputPath, m.LLMModel, m.MinComplexity, m.UseResearch)
		m.isProcessing = true
		// TODO: return m, m.executeActualAnalyzeComplexityCommand()
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

func (m *AnalyzeComplexityModel) View() string {
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
func (m *AnalyzeComplexityModel) GetFormValues() (map[string]interface{}, error) {
	if m.form.State != huh.StateCompleted {
		return nil, fmt.Errorf("form is not yet completed")
	}
	return map[string]interface{}{
		analyzeComplexityFormKeyFile:      m.FilePath,
		analyzeComplexityFormKeyOutput:    m.OutputPath,
		analyzeComplexityFormKeyModel:     m.LLMModel,
		analyzeComplexityFormKeyThreshold: m.MinComplexity,
		analyzeComplexityFormKeyResearch:  m.UseResearch,
	}, nil
}

var _ tea.Model = &AnalyzeComplexityModel{}
