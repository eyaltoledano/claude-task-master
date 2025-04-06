import React, { useState, useEffect } from 'react';
import { TaskSummary } from '@/services/api'; // Using path alias
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // Shadcn Table
import { Skeleton } from "@/components/ui/skeleton"; // Shadcn Skeleton
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Shadcn Alert

const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        setError(null);
        // Using placeholder data until backend returns JSON
        // const fetchedTasks = await getTasks();
        const placeholderTasks: TaskSummary[] = [
          { id: '1', title: 'Install backend deps (Placeholder)', status: 'done', priority: 'high', dependencies: [] },
          { id: '2', title: 'Implement port finding (Placeholder)', status: 'done', priority: 'high', dependencies: ['1'] },
          { id: '4', title: 'Implement GET /api/tasks (Placeholder)', status: 'done', priority: 'high', dependencies: ['2'] },
          { id: '8', title: 'Create Task List component (Placeholder)', status: 'done', priority: 'medium', dependencies: ['7'] }, // Marked as done for demo
          { id: '9', title: 'Create Task Detail component (Placeholder)', status: 'done', priority: 'medium', dependencies: ['7'] }, // Marked as done for demo
        ];
        console.log("Using placeholder tasks for TaskList component.");
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));
        setTasks(placeholderTasks);
        // setTasks(fetchedTasks);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        console.error("Error fetching tasks:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-1/4" /> {/* Title Skeleton */}
        <Skeleton className="h-10 w-full" /> {/* Header Skeleton */}
        <Skeleton className="h-10 w-full" /> {/* Row Skeleton */}
        <Skeleton className="h-10 w-full" /> {/* Row Skeleton */}
        <Skeleton className="h-10 w-full" /> {/* Row Skeleton */}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load tasks: {error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Task List (Placeholder Data)</h2>
      <Table>
        <TableCaption>A list of your tasks.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">ID</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead className="text-right">Dependencies</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell className="font-medium">{task.id}</TableCell>
              <TableCell>{task.title}</TableCell>
              <TableCell>{task.status}</TableCell>
              <TableCell>{task.priority}</TableCell>
              <TableCell className="text-right">
                {Array.isArray(task.dependencies) ? task.dependencies.join(', ') : task.dependencies || 'None'}
              </TableCell>
              {/* TODO: Add link/button to view details */}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default TaskList;