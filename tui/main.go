package main

import (
	"fmt"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/huh"
)

type view int

const (
	mainMenuView view = iota
	parsePRDView
	updateTaskView
	updateSingleTaskView
	updateSubtaskView
	generateFilesView
	setStatusView
	listTasksView
	expandTaskView
	analyzeComplexityView
	clearSubtasksView
	addTaskView
	nextTaskView
	showTaskView
	addDependencyView // New view for Add Dependency form
	// Add other views as needed
)

// backToMenuMsg signals the main model to return to the main menu.
type backToMenuMsg struct{}

type model struct {
	currentView            view
	mainMenuForm           *huh.Form
	parsePRDModel          tea.Model
	updateTaskModel        tea.Model
	updateSingleTaskModel  tea.Model
	updateSubtaskModel     tea.Model
	generateFilesModel     tea.Model
	setStatusModel         tea.Model
	listTasksModel         tea.Model
	expandTaskModel        tea.Model
	analyzeComplexityModel tea.Model
	clearSubtasksModel     tea.Model
	addTaskModel           tea.Model
	nextTaskModel          tea.Model
	showTaskModel          tea.Model
	addDependencyModel     tea.Model // Instance of AddDependencyModel
	width, height          int
}

// newModel initializes the main application model.
func newModel() model {
	mainMenuSelect := huh.NewSelect[string]().
		Key("command").
		Title("Select a command").
		Options(
			huh.NewOption("Parse PRD", "parsePRD"),
			huh.NewOption("Add Task", "addTask"),
			huh.NewOption("Next Task", "nextTask"),
			huh.NewOption("Show Task", "showTask"),
			huh.NewOption("Add Dependency", "addDependency"), // New command
			huh.NewOption("Update Tasks", "updateTask"),
			huh.NewOption("Update Single Task", "updateSingleTask"),
			huh.NewOption("Update Subtask", "updateSubtask"),
			huh.NewOption("Clear Subtasks", "clearSubtasks"),
			huh.NewOption("Generate Task Files", "generateFiles"),
			huh.NewOption("Set Task Status", "setStatus"),
			huh.NewOption("List Tasks", "listTasks"),
			huh.NewOption("Expand Task", "expandTask"),
			huh.NewOption("Analyze Task Complexity", "analyzeComplexity"),
		).
		Value(new(string))

	mainMenuForm := huh.NewForm(
		huh.NewGroup(mainMenuSelect),
	).WithTheme(huh.ThemeDracula())

	return model{
		mainMenuForm: mainMenuForm,
		currentView:  mainMenuView,
	}
}

func (m model) Init() tea.Cmd {
	switch m.currentView {
	case mainMenuView:
		return m.mainMenuForm.Init()
	case parsePRDView:
		if m.parsePRDModel != nil { return m.parsePRDModel.Init() }
	case updateTaskView:
		if m.updateTaskModel != nil { return m.updateTaskModel.Init() }
	case updateSingleTaskView:
		if m.updateSingleTaskModel != nil { return m.updateSingleTaskModel.Init() }
	case updateSubtaskView:
		if m.updateSubtaskModel != nil { return m.updateSubtaskModel.Init() }
	case generateFilesView:
		if m.generateFilesModel != nil { return m.generateFilesModel.Init() }
	case setStatusView:
		if m.setStatusModel != nil { return m.setStatusModel.Init() }
	case listTasksView:
		if m.listTasksModel != nil { return m.listTasksModel.Init() }
	case expandTaskView:
		if m.expandTaskModel != nil { return m.expandTaskModel.Init() }
	case analyzeComplexityView:
		if m.analyzeComplexityModel != nil { return m.analyzeComplexityModel.Init() }
	case clearSubtasksView:
		if m.clearSubtasksModel != nil { return m.clearSubtasksModel.Init() }
	case addTaskView:
		if m.addTaskModel != nil { return m.addTaskModel.Init() }
	case nextTaskView:
		if m.nextTaskModel != nil { return m.nextTaskModel.Init() }
	case showTaskView:
		if m.showTaskModel != nil { return m.showTaskModel.Init() }
	case addDependencyView:
		if m.addDependencyModel != nil { return m.addDependencyModel.Init() }
	}
	return nil
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd
	var cmd tea.Cmd

	// Handle specific messages first
	switch msg := msg.(type) {
	case backToMenuMsg:
		m.currentView = mainMenuView
		m.parsePRDModel = nil; m.updateTaskModel = nil; m.updateSingleTaskModel = nil
		m.updateSubtaskModel = nil; m.generateFilesModel = nil; m.setStatusModel = nil
		m.listTasksModel = nil; m.expandTaskModel = nil; m.analyzeComplexityModel = nil
		m.clearSubtasksModel = nil; m.addTaskModel = nil; m.nextTaskModel = nil
		m.showTaskModel = nil; m.addDependencyModel = nil // Clear this model too
		if m.mainMenuForm != nil {
			m.mainMenuForm.State = huh.StateNormal
			return m, m.mainMenuForm.Init()
		}
		return m, nil
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		// Propagate width to current sub-model
		switch m.currentView {
		case parsePRDView:
			if prdModel, ok := m.parsePRDModel.(*ParsePRDModel); ok { prdModel.width = m.width }
		case updateTaskView:
			if utModel, ok := m.updateTaskModel.(*UpdateTaskModel); ok { utModel.width = m.width }
		case updateSingleTaskView:
			if ustModel, ok := m.updateSingleTaskModel.(*UpdateSingleTaskModel); ok { ustModel.width = m.width }
		case updateSubtaskView:
			if usubModel, ok := m.updateSubtaskModel.(*UpdateSubtaskModel); ok { usubModel.width = m.width }
		case generateFilesView:
			if genModel, ok := m.generateFilesModel.(*GenerateFilesModel); ok { genModel.width = m.width }
		case setStatusView:
			if statusModel, ok := m.setStatusModel.(*SetStatusModel); ok { statusModel.width = m.width }
		case listTasksView:
			if ltModel, ok := m.listTasksModel.(*ListTasksModel); ok { ltModel.width = m.width }
		case expandTaskView:
			if etModel, ok := m.expandTaskModel.(*ExpandTaskModel); ok { etModel.width = m.width }
		case analyzeComplexityView:
			if acModel, ok := m.analyzeComplexityModel.(*AnalyzeComplexityModel); ok { acModel.width = m.width }
		case clearSubtasksView:
			if csModel, ok := m.clearSubtasksModel.(*ClearSubtasksModel); ok { csModel.width = m.width }
		case addTaskView:
			if atModel, ok := m.addTaskModel.(*AddTaskModel); ok { atModel.width = m.width }
		case nextTaskView:
			if ntModel, ok := m.nextTaskModel.(*NextTaskModel); ok { ntModel.width = m.width }
		case showTaskView:
			if stModel, ok := m.showTaskModel.(*ShowTaskModel); ok { stModel.width = m.width }
		case addDependencyView:
			if adModel, ok := m.addDependencyModel.(*AddDependencyModel); ok { adModel.width = m.width }
		}
	}

	// Delegate updates to the current view's model
	switch m.currentView {
	case mainMenuView:
		if m.mainMenuForm == nil { return m, tea.Quit }
		formModel, menuCmd := m.mainMenuForm.Update(msg)
		if updatedForm, ok := formModel.(*huh.Form); ok {
			m.mainMenuForm = updatedForm
		} else {
			fmt.Fprintf(os.Stderr, "Main menu update returned unexpected model type: %T\n", formModel)
			return m, tea.Quit
		}
		cmds = append(cmds, menuCmd)

		if m.mainMenuForm.State == huh.StateCompleted {
			selectedCommand := m.mainMenuForm.GetString("command")
			switch selectedCommand {
			case "parsePRD":
				m.currentView = parsePRDView; m.parsePRDModel = NewParsePRDModel(); return m, m.parsePRDModel.Init()
			case "addTask":
				m.currentView = addTaskView; m.addTaskModel = NewAddTaskForm(); return m, m.addTaskModel.Init()
			case "nextTask":
				m.currentView = nextTaskView; m.nextTaskModel = NewNextTaskForm(); return m, m.nextTaskModel.Init()
			case "showTask":
				m.currentView = showTaskView; m.showTaskModel = NewShowTaskForm(); return m, m.showTaskModel.Init()
			case "addDependency":
				m.currentView = addDependencyView; m.addDependencyModel = NewAddDependencyForm(); return m, m.addDependencyModel.Init()
			case "updateTask":
				m.currentView = updateTaskView; m.updateTaskModel = NewUpdateTaskForm(); return m, m.updateTaskModel.Init()
			case "updateSingleTask":
				m.currentView = updateSingleTaskView; m.updateSingleTaskModel = NewUpdateSingleTaskForm(); return m, m.updateSingleTaskModel.Init()
			case "updateSubtask":
				m.currentView = updateSubtaskView; m.updateSubtaskModel = NewUpdateSubtaskForm(); return m, m.updateSubtaskModel.Init()
			case "clearSubtasks":
				m.currentView = clearSubtasksView; m.clearSubtasksModel = NewClearSubtasksForm(); return m, m.clearSubtasksModel.Init()
			case "generateFiles":
				m.currentView = generateFilesView; m.generateFilesModel = NewGenerateFilesForm(); return m, m.generateFilesModel.Init()
			case "setStatus":
				m.currentView = setStatusView; m.setStatusModel = NewSetStatusForm(); return m, m.setStatusModel.Init()
			case "listTasks":
				m.currentView = listTasksView; m.listTasksModel = NewListTasksForm(); return m, m.listTasksModel.Init()
			case "expandTask":
				m.currentView = expandTaskView; m.expandTaskModel = NewExpandTaskForm(); return m, m.expandTaskModel.Init()
			case "analyzeComplexity":
				m.currentView = analyzeComplexityView; m.analyzeComplexityModel = NewAnalyzeComplexityForm(); return m, m.analyzeComplexityModel.Init()
			default:
				m.mainMenuForm.State = huh.StateNormal; return m, m.mainMenuForm.Init()
			}
		}

	case parsePRDView:
		if m.parsePRDModel == nil { m.currentView = mainMenuView; return m, m.mainMenuForm.Init() }
		updatedSubModel, subCmd := m.parsePRDModel.Update(msg)
		if prdM, ok := updatedSubModel.(*ParsePRDModel); ok { m.parsePRDModel = prdM } else { return m.Update(updatedSubModel) }
		cmds = append(cmds, subCmd)
	case updateTaskView:
		if m.updateTaskModel == nil { m.currentView = mainMenuView; return m, m.mainMenuForm.Init() }
		updatedSubModel, subCmd := m.updateTaskModel.Update(msg)
		if utM, ok := updatedSubModel.(*UpdateTaskModel); ok { m.updateTaskModel = utM } else { return m.Update(updatedSubModel) }
		cmds = append(cmds, subCmd)
	case updateSingleTaskView:
		if m.updateSingleTaskModel == nil { m.currentView = mainMenuView; return m, m.mainMenuForm.Init() }
		updatedSubModel, subCmd := m.updateSingleTaskModel.Update(msg)
		if ustM, ok := updatedSubModel.(*UpdateSingleTaskModel); ok { m.updateSingleTaskModel = ustM } else { return m.Update(updatedSubModel) }
		cmds = append(cmds, subCmd)
	case updateSubtaskView:
		if m.updateSubtaskModel == nil { m.currentView = mainMenuView; return m, m.mainMenuForm.Init() }
		updatedSubModel, subCmd := m.updateSubtaskModel.Update(msg)
		if usubM, ok := updatedSubModel.(*UpdateSubtaskModel); ok { m.updateSubtaskModel = usubM } else { return m.Update(updatedSubModel) }
		cmds = append(cmds, subCmd)
	case generateFilesView:
		if m.generateFilesModel == nil { m.currentView = mainMenuView; return m, m.mainMenuForm.Init() }
		updatedSubModel, subCmd := m.generateFilesModel.Update(msg)
		if genM, ok := updatedSubModel.(*GenerateFilesModel); ok { m.generateFilesModel = genM } else { return m.Update(updatedSubModel) }
		cmds = append(cmds, subCmd)
	case setStatusView:
		if m.setStatusModel == nil { m.currentView = mainMenuView; return m, m.mainMenuForm.Init() }
		updatedSubModel, subCmd := m.setStatusModel.Update(msg)
		if statusM, ok := updatedSubModel.(*SetStatusModel); ok { m.setStatusModel = statusM } else { return m.Update(updatedSubModel) }
		cmds = append(cmds, subCmd)
	case listTasksView:
		if m.listTasksModel == nil { m.currentView = mainMenuView; return m, m.mainMenuForm.Init() }
		updatedSubModel, subCmd := m.listTasksModel.Update(msg)
		if ltM, ok := updatedSubModel.(*ListTasksModel); ok { m.listTasksModel = ltM } else { return m.Update(updatedSubModel) }
		cmds = append(cmds, subCmd)
	case expandTaskView:
		if m.expandTaskModel == nil { m.currentView = mainMenuView; return m, m.mainMenuForm.Init() }
		updatedSubModel, subCmd := m.expandTaskModel.Update(msg)
		if etM, ok := updatedSubModel.(*ExpandTaskModel); ok { m.expandTaskModel = etM } else { return m.Update(updatedSubModel) }
		cmds = append(cmds, subCmd)
	case analyzeComplexityView:
		if m.analyzeComplexityModel == nil { m.currentView = mainMenuView; return m, m.mainMenuForm.Init() }
		updatedSubModel, subCmd := m.analyzeComplexityModel.Update(msg)
		if acM, ok := updatedSubModel.(*AnalyzeComplexityModel); ok { m.analyzeComplexityModel = acM } else { return m.Update(updatedSubModel) }
		cmds = append(cmds, subCmd)
	case clearSubtasksView:
		if m.clearSubtasksModel == nil { m.currentView = mainMenuView; return m, m.mainMenuForm.Init() }
		updatedSubModel, subCmd := m.clearSubtasksModel.Update(msg)
		if csM, ok := updatedSubModel.(*ClearSubtasksModel); ok { m.clearSubtasksModel = csM } else { return m.Update(updatedSubModel) }
		cmds = append(cmds, subCmd)
	case addTaskView:
		if m.addTaskModel == nil { m.currentView = mainMenuView; return m, m.mainMenuForm.Init() }
		updatedSubModel, subCmd := m.addTaskModel.Update(msg)
		if atM, ok := updatedSubModel.(*AddTaskModel); ok { m.addTaskModel = atM } else { return m.Update(updatedSubModel) }
		cmds = append(cmds, subCmd)
	case nextTaskView:
		if m.nextTaskModel == nil { m.currentView = mainMenuView; return m, m.mainMenuForm.Init() }
		updatedSubModel, subCmd := m.nextTaskModel.Update(msg)
		if ntM, ok := updatedSubModel.(*NextTaskModel); ok { m.nextTaskModel = ntM } else { return m.Update(updatedSubModel) }
		cmds = append(cmds, subCmd)
	case showTaskView:
		if m.showTaskModel == nil { m.currentView = mainMenuView; return m, m.mainMenuForm.Init() }
		updatedSubModel, subCmd := m.showTaskModel.Update(msg)
		if stM, ok := updatedSubModel.(*ShowTaskModel); ok { m.showTaskModel = stM } else { return m.Update(updatedSubModel) }
		cmds = append(cmds, subCmd)
	case addDependencyView:
		if m.addDependencyModel == nil { m.currentView = mainMenuView; return m, m.mainMenuForm.Init() }
		updatedSubModel, subCmd := m.addDependencyModel.Update(msg)
		if adM, ok := updatedSubModel.(*AddDependencyModel); ok { m.addDependencyModel = adM } else { return m.Update(updatedSubModel) }
		cmds = append(cmds, subCmd)
			}
		}
	}
	// Global key bindings
	if keyMsg, ok := msg.(tea.KeyMsg); ok {
		switch keyMsg.String() {
		// input and respond with messages.
		// We need to also update the form’s model so that it can process
		case "ctrl+c": // Global quit, if not handled by form
			return m, tea.Quit
		}
	}
	return m, tea.Batch(cmds...)
}

func (m model) View() string {
	switch m.currentView {
	// ... (other cases remain the same)
	case mainMenuView:
		if m.mainMenuForm != nil { return m.mainMenuForm.View() }
		return "Error: Main menu not initialized."
	case parsePRDView:
		if m.parsePRDModel != nil { return m.parsePRDModel.View() }
		return "Error: Parse PRD form not initialized."
	case updateTaskView:
		if m.updateTaskModel != nil { return m.updateTaskModel.View() }
		return "Error: Update Task form not initialized."
	case updateSingleTaskView:
		if m.updateSingleTaskModel != nil { return m.updateSingleTaskModel.View() }
		return "Error: Update Single Task form not initialized."
	case updateSubtaskView:
		if m.updateSubtaskModel != nil { return m.updateSubtaskModel.View() }
		return "Error: Update Subtask form not initialized."
	case generateFilesView:
		if m.generateFilesModel != nil { return m.generateFilesModel.View() }
		return "Error: Generate Task Files form not initialized."
	case setStatusView:
		if m.setStatusModel != nil { return m.setStatusModel.View() }
		return "Error: Set Task Status form not initialized."
	case listTasksView:
		if m.listTasksModel != nil { return m.listTasksModel.View() }
		return "Error: List Tasks form not initialized."
	case expandTaskView:
		if m.expandTaskModel != nil { return m.expandTaskModel.View() }
		return "Error: Expand Task form not initialized."
	case analyzeComplexityView:
		if m.analyzeComplexityModel != nil { return m.analyzeComplexityModel.View() }
		return "Error: Analyze Task Complexity form not initialized."
	case clearSubtasksView:
		if m.clearSubtasksModel != nil { return m.clearSubtasksModel.View() }
		return "Error: Clear Subtasks form not initialized."
	case addTaskView:
		if m.addTaskModel != nil { return m.addTaskModel.View() }
		return "Error: Add Task form not initialized."
	case nextTaskView:
		if m.nextTaskModel != nil { return m.nextTaskModel.View() }
		return "Error: Next Task form not initialized."
	case showTaskView:
		if m.showTaskModel != nil { return m.showTaskModel.View() }
		return "Error: Show Task form not initialized."
	case addDependencyView:
		if m.addDependencyModel != nil { return m.addDependencyModel.View() }
		return "Error: Add Dependency form not initialized."
	default:
		return "Unknown view."
	}
}

func main() {
	initialModel := newModel()
	p := tea.NewProgram(initialModel, tea.WithAltScreen())

	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error running program: %v\n", err)
		os.Exit(1)
	}
}
