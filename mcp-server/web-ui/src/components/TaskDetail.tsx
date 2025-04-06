import React, { useState, useEffect } from 'react';
import { TaskDetail as TaskDetailType } from '@/services/api'; // Using path alias
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"; // Shadcn Card
import { Skeleton } from "@/components/ui/skeleton"; // Shadcn Skeleton
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Shadcn Alert

interface TaskDetailProps {
  taskId: string; // The ID of the task to display
}

const TaskDetail: React.FC<TaskDetailProps> = ({ taskId }) => {
  const [task, setTask] = useState<TaskDetailType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      setError("No task ID provided.");
      setLoading(false);
      return;
    }

    const fetchTaskDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        // Using placeholder data until backend returns JSON
        // const fetchedTask = await getTaskById(taskId);
        const placeholderTask: TaskDetailType | null =
          taskId === '1' ? { id: '1', title: 'Install backend deps (Placeholder)', status: 'done', priority: 'high', dependencies: [], description: 'Install express, cors, find-free-port...', implementationDetails: 'Run pnpm add...', testStrategy: 'Verify package.json...' } :
          taskId === '8' ? { id: '8', title: 'Create Task List component (Placeholder)', status: 'done', priority: 'medium', dependencies: ['7'], description: 'Create the React component...', implementationDetails: 'Use useState, useEffect...', testStrategy: 'Check rendering...' } :
          null; // Simulate task not found for other IDs

        console.log(`Using placeholder task for TaskDetail component (ID: ${taskId}).`);
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));
        setTask(placeholderTask);
        // setTask(fetchedTask);

        if (!placeholderTask && taskId) { // Check taskId exists before showing not found
             setError(`Task with ID ${taskId} not found (using placeholder data).`);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        console.error(`Error fetching task detail for ID ${taskId}:`, err);
      } finally {
        setLoading(false);
      }
    };

    fetchTaskDetail();
  }, [taskId]); // Re-run effect if taskId changes

  if (loading) {
    return (
       <Card>
         <CardHeader>
           <Skeleton className="h-6 w-1/2 mb-2" /> {/* Title Skeleton */}
           <Skeleton className="h-4 w-1/4" /> {/* Status/Priority Skeleton */}
         </CardHeader>
         <CardContent className="space-y-3">
           <Skeleton className="h-4 w-full" />
           <Skeleton className="h-4 w-full" />
           <Skeleton className="h-4 w-3/4" />
         </CardContent>
         <CardFooter>
            <Skeleton className="h-4 w-1/3" /> {/* Footer Skeleton */}
         </CardFooter>
       </Card>
    );
  }

  if (error) {
     return (
       <Alert variant="destructive">
         <AlertTitle>Error</AlertTitle>
         <AlertDescription>{error}</AlertDescription>
       </Alert>
     );
  }

  if (!task) {
    // This case should ideally be covered by the error state when task is not found
    return (
       <Alert variant="default">
         <AlertTitle>Not Found</AlertTitle>
         <AlertDescription>Task with ID {taskId} could not be found.</AlertDescription>
       </Alert>
    );
  }

  // Display Task Details using Card
  return (
    <Card className="w-full max-w-2xl"> {/* Example width constraint */}
      <CardHeader>
        <CardTitle>Task #{task.id}: {task.title}</CardTitle>
        <CardDescription>
          Status: {task.status} | Priority: {task.priority}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <p><strong>Dependencies:</strong> {Array.isArray(task.dependencies) ? task.dependencies.join(', ') : task.dependencies || 'None'}</p>
        <div>
            <h4 className="font-semibold">Description:</h4>
            <p className="text-sm text-muted-foreground">{task.description || 'N/A'}</p>
        </div>
         <div>
            <h4 className="font-semibold">Implementation:</h4>
            <p className="text-sm text-muted-foreground">{task.implementationDetails || 'N/A'}</p>
        </div>
         <div>
            <h4 className="font-semibold">Testing:</h4>
            <p className="text-sm text-muted-foreground">{task.testStrategy || 'N/A'}</p>
        </div>
        {/* TODO: Display subtasks if available */}
      </CardContent>
      <CardFooter>
        {/* Add actions or links here if needed */}
      </CardFooter>
    </Card>
  );
};

export default TaskDetail;