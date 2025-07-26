# Official Task Master AI Extension

Transform your [Task Master AI](https://github.com/TaskMasterEYJ/task-master-ai) projects into a beautiful, interactive Kanban board directly in VS Code. Drag, drop, and manage your tasks with ease while maintaining real-time synchronization with your Task Master project files.

![Task Master AI Kanban](https://img.shields.io/badge/VS%20Code-Extension-blue)
![Free](https://img.shields.io/badge/Price-Free-brightgreen)
![Version](https://img.shields.io/badge/Version-1.0.0-blue)

## ✨ Features

### 🎯 **Visual Task Management**
- **Drag & Drop Kanban Board** - Intuitive task management with visual columns
- **Real-time Synchronization** - Changes sync instantly with your Task Master project files
- **Status Columns** - To Do, In Progress, Review, Done, and Deferred
- **Task Details View** - View and edit implementation details, test strategies, and notes

![Kanban Board](assets/screenshots/kanban-board.png)

### 🤖 **AI-Powered Features**
- **Task Content Generation** - Regenerate task descriptions using AI
- **Smart Task Updates** - Append findings and progress notes automatically
- **MCP Integration** - Seamless connection to Task Master AI via Model Context Protocol
- **Intelligent Caching** - Smart performance optimization with background refresh

![Task Details](assets/screenshots/task-details.png)

### 🚀 **Performance & Usability**
- **Offline Support** - Continue working even when disconnected
- **Auto-refresh** - Automatic polling for task changes with smart frequency
- **VS Code Native** - Perfectly integrated with VS Code themes and UI
- **Modern Interface** - Built with ShadCN UI components and Tailwind CSS

## 🛠️ Installation

### Prerequisites

1. **VS Code** 1.90.0 or higher
2. **Node.js** 18.0 or higher (for Task Master MCP server)

### Install the Extension

1. **From VS Code Marketplace:**
   - Click the **Install** button above
   - The extension will be automatically added to your VS Code instance

## 🚀 Quick Start

### 1. **Initialize Task Master Project**
If you don't have a Task Master project yet:
```bash
cd your-project
   npx task-master-ai init
   ```

### 2. **Open Kanban Board**
- **Command Palette** (Ctrl+Shift+P): `Task Master Kanban: Show Board`
- **Or** the extension automatically activates when you have a `.taskmaster` folder in your workspace

### 3. **MCP Server Setup**
The extension automatically handles the Task Master MCP server connection:
- **No manual installation required** - The extension spawns the MCP server automatically
- **Uses npx by default** - Automatically downloads Task Master AI when needed
- **Configurable** - You can customize the MCP server command in settings if needed

### 4. **Start Managing Tasks**
- **Drag tasks** between columns to change status
- **Click tasks** to view detailed information
- **Use AI features** to enhance task content
- **Add subtasks** with the + button on parent tasks

## 📋 Usage Guide

### **Managing Tasks**

| Action | How To |
|--------|--------|
| **Change Task Status** | Drag task to different column |
| **View Details** | Click on any task |
| **Edit Task** | Click task, then use edit controls |
| **Add Subtask** | Click + button on parent task |
| **Use AI Features** | Open task details and use AI panel |

### **Kanban Columns**

- **📝 To Do** - Tasks ready to be worked on
- **⚡ In Progress** - Currently active tasks  
- **👀 Review** - Tasks pending review or approval
- **✅ Done** - Completed tasks
- **⏸️ Deferred** - Postponed or blocked tasks

### **AI-Powered Task Management**

The extension integrates seamlessly with Task Master AI via MCP to provide:
- **Smart Task Generation** - AI creates detailed implementation plans
- **Progress Tracking** - Append timestamped notes and findings
- **Content Enhancement** - Regenerate task descriptions for clarity
- **Research Integration** - Get up-to-date information for your tasks

## ⚙️ Configuration

Access settings via **File → Preferences → Settings** and search for "Task Master":

### **MCP Connection Settings**
- **MCP Server Command** - Path to task-master-ai executable (default: `npx`)
- **MCP Server Args** - Arguments for the server command (default: `-y`, `--package=task-master-ai`, `task-master-ai`)
- **Connection Timeout** - Server response timeout (default: 30s)
- **Auto Refresh** - Enable automatic task updates (default: enabled)

### **UI Preferences**
- **Theme** - Auto, Light, or Dark mode
- **Show Completed Tasks** - Display done tasks in board (default: enabled)
- **Task Display Limit** - Maximum tasks to show (default: 100)

### **Performance Options**
- **Cache Duration** - How long to cache task data (default: 5s)
- **Concurrent Requests** - Max simultaneous API calls (default: 5)

## 🔧 Troubleshooting

### **Extension Not Loading**
1. Ensure Node.js 18+ is installed
2. Check workspace contains `.taskmaster` folder
3. Restart VS Code
4. Check Output panel (View → Output → Task Master Kanban)

### **MCP Connection Issues**
1. **Command not found**: Ensure Node.js and npx are in your PATH
2. **Timeout errors**: Increase timeout in settings
3. **Permission errors**: Check Node.js permissions
4. **Network issues**: Verify internet connection for npx downloads

### **Tasks Not Updating**
1. Check MCP connection status in status bar
2. Verify `.taskmaster/tasks/tasks.json` exists
3. Try manual refresh: `Task Master Kanban: Check Connection`
4. Review error logs in Output panel

### **Performance Issues**
1. Reduce task display limit in settings
2. Increase cache duration
3. Disable auto-refresh if needed
4. Close other VS Code extensions temporarily

## 🆘 Support & Resources

### **Getting Help**
- 📖 **Documentation**: [Task Master AI Docs](https://github.com/eyaltoledano/claude-task-master)
- 🐛 **Report Issues**: [GitHub Issues](https://github.com/eyaltoledano/claude-task-master/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/eyaltoledano/claude-task-master/discussions)

### **Related Projects**
- 📡 **MCP Protocol**: [Model Context Protocol](https://modelcontextprotocol.io/)

## 🎯 Tips for Best Results

### **Project Organization**
- Use descriptive task titles
- Add detailed implementation notes
- Set appropriate task dependencies
- Leverage AI features for complex tasks

### **Workflow Optimization**
- Review task details before starting work
- Use subtasks for complex features
- Update task status as you progress
- Add findings and learnings to task notes

### **Collaboration**
- Keep task descriptions updated
- Use consistent status conventions
- Document decisions in task details
- Share knowledge through task notes

---

## 🏆 Why Task Master Kanban?

✅ **Visual workflow management** for your Task Master projects  
✅ **AI-powered task enhancement** built right in  
✅ **Real-time synchronization** keeps everything in sync  
✅ **Native VS Code integration** feels like part of the editor  
✅ **Free and open source** with active development  

**Transform your development workflow today!** 🚀

---

*Originally Made with ❤️ by [David Maliglowka](https://x.com/DavidMaliglowka)*

## Support

This is an open-source project maintained in my spare time. While I strive to fix bugs and improve the extension, support is provided on a best-effort basis. Feel free to:
- Report issues on [GitHub](https://github.com/eyaltoledano/claude-task-master/issues)
- Submit pull requests with improvements
- Fork the project if you need specific modifications

## Disclaimer

This extension is provided "as is" without any warranties. Use at your own risk. The author is not responsible for any issues, data loss, or damages that may occur from using this extension. Please backup your work regularly and test thoroughly before using in important projects.