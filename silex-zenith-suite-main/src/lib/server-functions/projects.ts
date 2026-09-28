import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { db } from "@/db";
import { projects, tasks, clients, taskAssignees, taskTags, users, workspaceMembers } from "@/db/schema";
import { eq, and, isNull, desc, inArray } from "drizzle-orm";

// Input Schemas
export const getProjectsInputSchema = z.object({
  workspaceId: z.string().optional(),
  clientId: z.string().optional(),
  status: z.string().optional(),
});

export const getProjectByIdInputSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  workspaceId: z.string().optional(),
});

export const createProjectInputSchema = z.object({
  name: z.string().min(1, "Project name is required").max(255),
  code: z.string().max(50).optional(),
  description: z.string().optional(),
  clientId: z.string().optional(),
  budgetCents: z.number().int().min(0).optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.string().default("active"),
  workspaceId: z.string().optional(),
});

export const getDashboardTasksInputSchema = z.object({
  workspaceId: z.string().optional(),
  projectId: z.string().optional(),
});

export const createTaskInputSchema = z.object({
  workspaceId: z.string().optional(),
  projectId: z.string().optional(),
  title: z.string().min(1, "Task title is required").max(255),
  description: z.string().optional(),
  priority: z.string().default("medium"),
  status: z.string().default("todo"),
  dueDate: z.string().optional(),
  estimatedHours: z.union([z.number(), z.string()]).optional(),
  assigneeUserIds: z.array(z.string()).optional(),
});

export const updateTaskStatusInputSchema = z.object({
  workspaceId: z.string().optional(),
  taskId: z.string().min(1, "Task ID is required"),
  status: z.string().min(1, "Status is required"),
});

export const updateTaskInputSchema = z.object({
  workspaceId: z.string().optional(),
  taskId: z.string().min(1, "Task ID is required"),
  title: z.string().min(1, "Title cannot be empty").optional(),
  description: z.string().nullable().optional(),
  priority: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  estimatedHours: z.union([z.number(), z.string()]).nullable().optional(),
  assigneeUserIds: z.array(z.string()).optional(),
});

export const deleteTaskInputSchema = z.object({
  workspaceId: z.string().optional(),
  taskId: z.string().min(1, "Task ID is required"),
});

/**
 * Server Function: getProjectsFn
 * Retrieves all projects for the authorized workspace joined with optional client information.
 */
export const getProjectsFn = createServerFn({ method: "GET" })
  .validator((data?: unknown) => getProjectsInputSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data?.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const rows = await db
      .select({
        project: projects,
        client: {
          id: clients.id,
          companyName: clients.companyName,
        },
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(
        and(
          eq(projects.workspaceId, auth.workspaceId),
          isNull(projects.deletedAt)
        )
      )
      .orderBy(desc(projects.createdAt));

    let activeCount = 0;
    let completedCount = 0;
    let totalBudgetCents = 0;

    const formattedProjects = rows.map(({ project, client }) => {
      if (project.status === "completed" || project.status === "Closed") {
        completedCount++;
      } else {
        activeCount++;
      }

      if (project.budgetCents) {
        totalBudgetCents += project.budgetCents;
      }

      return {
        id: project.id,
        name: project.name,
        code: project.code,
        description: project.description,
        status: project.status,
        budgetCents: project.budgetCents || 0,
        clientName: client?.companyName || "Internal Project",
        clientId: project.clientId,
        startDate: project.startDate ? project.startDate.toISOString() : null,
        dueDate: project.dueDate ? project.dueDate.toISOString() : null,
        createdAt: project.createdAt.toISOString(),
      };
    });

    return {
      projects: formattedProjects,
      stats: {
        totalCount: rows.length,
        activeCount,
        completedCount,
        totalBudgetCents,
      },
    };
  });

/**
 * Server Function: getProjectByIdFn
 * Retrieves project details and associated tasks for the authorized workspace augmented with assignees and tags.
 */
export const getProjectByIdFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => getProjectByIdInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const projectRows = await db
      .select({
        project: projects,
        client: clients,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(
        and(
          eq(projects.id, data.projectId),
          eq(projects.workspaceId, auth.workspaceId),
          isNull(projects.deletedAt)
        )
      )
      .limit(1);

    if (projectRows.length === 0) {
      return null;
    }

    const { project, client } = projectRows[0];

    const taskRows = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.projectId, project.id),
          eq(tasks.workspaceId, auth.workspaceId),
          isNull(tasks.deletedAt)
        )
      )
      .orderBy(desc(tasks.createdAt));

    const taskIds = taskRows.map((t) => t.id);

    const assigneesByTaskId: Record<
      string,
      Array<{ id: string; fullName: string; email: string; avatarUrl: string | null }>
    > = {};

    if (taskIds.length > 0) {
      const assigneeRows = await db
        .select({
          taskId: taskAssignees.taskId,
          user: {
            id: users.id,
            fullName: users.fullName,
            email: users.email,
            avatarUrl: users.avatarUrl,
          },
        })
        .from(taskAssignees)
        .innerJoin(users, eq(taskAssignees.userId, users.id))
        .where(
          and(
            inArray(taskAssignees.taskId, taskIds),
            eq(taskAssignees.workspaceId, auth.workspaceId)
          )
        );

      for (const row of assigneeRows) {
        if (!assigneesByTaskId[row.taskId]) {
          assigneesByTaskId[row.taskId] = [];
        }
        assigneesByTaskId[row.taskId].push(row.user);
      }
    }

    const activeMembers = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(
        and(
          eq(workspaceMembers.workspaceId, auth.workspaceId),
          eq(workspaceMembers.status, "active")
        )
      );

    const workspaceTags = await db
      .select({
        id: taskTags.id,
        name: taskTags.name,
        colorHex: taskTags.colorHex,
      })
      .from(taskTags)
      .where(eq(taskTags.workspaceId, auth.workspaceId));

    return {
      project: {
        id: project.id,
        name: project.name,
        code: project.code,
        description: project.description,
        status: project.status,
        budgetCents: project.budgetCents || 0,
        startDate: project.startDate ? project.startDate.toISOString() : null,
        dueDate: project.dueDate ? project.dueDate.toISOString() : null,
        createdAt: project.createdAt.toISOString(),
      },
      client: client
        ? {
            id: client.id,
            companyName: client.companyName,
          }
        : null,
      members: activeMembers,
      tasks: taskRows.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        estimatedHours: t.estimatedHours ? Number(t.estimatedHours) : null,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        completedAt: t.completedAt ? t.completedAt.toISOString() : null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        assignees: assigneesByTaskId[t.id] || [],
        tags: workspaceTags || [],
      })),
    };
  });

export const getWorkspaceMembersInputSchema = z.object({
  workspaceId: z.string().optional(),
});

export const getWorkspaceMembersFn = createServerFn({ method: "GET" })
  .validator((data?: unknown) => getWorkspaceMembersInputSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data?.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const members = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(
        and(
          eq(workspaceMembers.workspaceId, auth.workspaceId),
          eq(workspaceMembers.status, "active")
        )
      );

    return { members };
  });

/**
 * Server Function: createProjectFn
 * Creates a new project in the authorized workspace after validating client ownership.
 */
export const createProjectFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => createProjectInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const { publishDomainEvent } = await import("@/lib/events");

    return await db.transaction(async (tx) => {
      if (data.clientId) {
        const clientRows = await tx
          .select({ id: clients.id })
          .from(clients)
          .where(
            and(
              eq(clients.id, data.clientId),
              eq(clients.workspaceId, auth.workspaceId),
              isNull(clients.deletedAt)
            )
          )
          .limit(1);

        if (clientRows.length === 0) {
          throw new Error("Target client does not exist or does not belong to authorized workspace.");
        }
      }

      const [newProject] = await tx
        .insert(projects)
        .values({
          workspaceId: auth.workspaceId,
          clientId: data.clientId || null,
          name: data.name,
          code: data.code || null,
          description: data.description || null,
          status: data.status || "active",
          budgetCents: data.budgetCents || 0,
          startDate: data.startDate ? new Date(data.startDate) : null,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          createdBy: auth.userId,
        })
        .returning();

      // Publish project.created domain event
      await publishDomainEvent(
        {
          workspaceId: auth.workspaceId,
          eventType: "project.created",
          aggregateType: "project",
          aggregateId: newProject.id,
          actorId: auth.userId,
          payload: {
            projectId: newProject.id,
            name: newProject.name,
            clientId: newProject.clientId,
            status: newProject.status,
            budgetCents: newProject.budgetCents || 0,
            createdBy: auth.userId,
          },
        },
        tx
      );

      return {
        id: newProject.id,
        name: newProject.name,
        status: newProject.status,
        createdAt: newProject.createdAt.toISOString(),
      };
    });
  });

/**
 * Server Function: createTaskFn
 * Creates a task in the authorized workspace, assigns members, and publishes task.created inside a transaction.
 */
export const createTaskFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => createTaskInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const { publishDomainEvent } = await import("@/lib/events");

    return await db.transaction(async (tx) => {
      if (data.projectId) {
        const [projectRow] = await tx
          .select({ id: projects.id })
          .from(projects)
          .where(
            and(
              eq(projects.id, data.projectId),
              eq(projects.workspaceId, auth.workspaceId),
              isNull(projects.deletedAt)
            )
          )
          .limit(1);

        if (!projectRow) {
          throw new Error("PROJECT_NOT_FOUND: Target project does not exist or access denied.");
        }
      }

      const assigneeIds = Array.from(new Set(data.assigneeUserIds || [])).filter(Boolean);
      if (assigneeIds.length > 0) {
        const validMembers = await tx
          .select({ userId: workspaceMembers.userId })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, auth.workspaceId),
              inArray(workspaceMembers.userId, assigneeIds),
              eq(workspaceMembers.status, "active")
            )
          );

        if (validMembers.length !== assigneeIds.length) {
          throw new Error("INVALID_ASSIGNEE: One or more assignees do not belong to the authorized workspace.");
        }
      }

      const [newTask] = await tx
        .insert(tasks)
        .values({
          workspaceId: auth.workspaceId,
          projectId: data.projectId || null,
          title: data.title.trim(),
          description: data.description || null,
          status: data.status || "todo",
          priority: data.priority || "medium",
          estimatedHours: data.estimatedHours != null ? String(data.estimatedHours) : null,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          createdBy: auth.userId,
        })
        .returning();

      if (assigneeIds.length > 0) {
        await tx.insert(taskAssignees).values(
          assigneeIds.map((userId) => ({
            taskId: newTask.id,
            userId,
            workspaceId: auth.workspaceId,
          }))
        );
      }

      await publishDomainEvent(
        {
          workspaceId: auth.workspaceId,
          eventType: "task.created",
          aggregateType: "task",
          aggregateId: newTask.id,
          actorId: auth.userId,
          payload: {
            taskId: newTask.id,
            projectId: newTask.projectId,
            title: newTask.title,
            priority: newTask.priority,
            status: newTask.status,
            dueDate: newTask.dueDate ? newTask.dueDate.toISOString() : null,
            createdBy: auth.userId,
          },
        },
        tx
      );

      return {
        id: newTask.id,
        workspaceId: newTask.workspaceId,
        projectId: newTask.projectId,
        title: newTask.title,
        description: newTask.description,
        status: newTask.status,
        priority: newTask.priority,
        estimatedHours: newTask.estimatedHours ? Number(newTask.estimatedHours) : null,
        dueDate: newTask.dueDate ? newTask.dueDate.toISOString() : null,
        completedAt: newTask.completedAt ? newTask.completedAt.toISOString() : null,
        assigneeUserIds: assigneeIds,
        createdAt: newTask.createdAt.toISOString(),
        updatedAt: newTask.updatedAt.toISOString(),
      };
    });
  });

/**
 * Server Function: updateTaskStatusFn
 * Updates a task's status, managing completedAt and emitting task.updated / task.completed events in a transaction.
 */
export const updateTaskStatusFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateTaskStatusInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const { publishDomainEvent } = await import("@/lib/events");

    return await db.transaction(async (tx) => {
      const [existingTask] = await tx
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.id, data.taskId),
            eq(tasks.workspaceId, auth.workspaceId),
            isNull(tasks.deletedAt)
          )
        )
        .limit(1);

      if (!existingTask) {
        throw new Error("TASK_NOT_FOUND: Task not found or access denied.");
      }

      const isOldCompleted = existingTask.status === "completed" || existingTask.status === "done";
      const isNewCompleted = data.status === "completed" || data.status === "done";

      const now = new Date();
      let completedAtValue: Date | null = existingTask.completedAt;

      if (!isOldCompleted && isNewCompleted) {
        completedAtValue = now;
      } else if (isOldCompleted && !isNewCompleted) {
        completedAtValue = null;
      }

      const [updatedTask] = await tx
        .update(tasks)
        .set({
          status: data.status,
          completedAt: completedAtValue,
          updatedAt: now,
        })
        .where(
          and(
            eq(tasks.id, data.taskId),
            eq(tasks.workspaceId, auth.workspaceId)
          )
        )
        .returning();

      if (!isOldCompleted && isNewCompleted) {
        await publishDomainEvent(
          {
            workspaceId: auth.workspaceId,
            eventType: "task.updated",
            aggregateType: "task",
            aggregateId: updatedTask.id,
            actorId: auth.userId,
            payload: {
              taskId: updatedTask.id,
              projectId: updatedTask.projectId,
              title: updatedTask.title,
              priority: updatedTask.priority,
              status: updatedTask.status,
            },
          },
          tx
        );

        await publishDomainEvent(
          {
            workspaceId: auth.workspaceId,
            eventType: "task.completed",
            aggregateType: "task",
            aggregateId: updatedTask.id,
            actorId: auth.userId,
            payload: {
              taskId: updatedTask.id,
              projectId: updatedTask.projectId,
              title: updatedTask.title,
              completedAt: updatedTask.completedAt!.toISOString(),
              createdBy: auth.userId,
            },
          },
          tx
        );
      } else if (existingTask.status !== data.status) {
        await publishDomainEvent(
          {
            workspaceId: auth.workspaceId,
            eventType: "task.updated",
            aggregateType: "task",
            aggregateId: updatedTask.id,
            actorId: auth.userId,
            payload: {
              taskId: updatedTask.id,
              projectId: updatedTask.projectId,
              title: updatedTask.title,
              priority: updatedTask.priority,
              status: updatedTask.status,
            },
          },
          tx
        );
      }

      return {
        id: updatedTask.id,
        workspaceId: updatedTask.workspaceId,
        projectId: updatedTask.projectId,
        title: updatedTask.title,
        status: updatedTask.status,
        completedAt: updatedTask.completedAt ? updatedTask.completedAt.toISOString() : null,
        updatedAt: updatedTask.updatedAt.toISOString(),
      };
    });
  });

/**
 * Server Function: updateTaskFn
 * Updates editable task details and replaces assignees atomically within a transaction.
 */
export const updateTaskFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateTaskInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const { publishDomainEvent } = await import("@/lib/events");

    return await db.transaction(async (tx) => {
      const [existingTask] = await tx
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.id, data.taskId),
            eq(tasks.workspaceId, auth.workspaceId),
            isNull(tasks.deletedAt)
          )
        )
        .limit(1);

      if (!existingTask) {
        throw new Error("TASK_NOT_FOUND: Task not found or access denied.");
      }

      let finalAssigneeIds: string[] | undefined = undefined;
      if (data.assigneeUserIds !== undefined) {
        const assigneeIds = Array.from(new Set(data.assigneeUserIds)).filter(Boolean);

        if (assigneeIds.length > 0) {
          const validMembers = await tx
            .select({ userId: workspaceMembers.userId })
            .from(workspaceMembers)
            .where(
              and(
                eq(workspaceMembers.workspaceId, auth.workspaceId),
                inArray(workspaceMembers.userId, assigneeIds),
                eq(workspaceMembers.status, "active")
              )
            );

          if (validMembers.length !== assigneeIds.length) {
            throw new Error("INVALID_ASSIGNEE: One or more assignees do not belong to authorized workspace.");
          }
        }

        await tx
          .delete(taskAssignees)
          .where(
            and(
              eq(taskAssignees.taskId, data.taskId),
              eq(taskAssignees.workspaceId, auth.workspaceId)
            )
          );

        if (assigneeIds.length > 0) {
          await tx.insert(taskAssignees).values(
            assigneeIds.map((userId) => ({
              taskId: data.taskId,
              userId,
              workspaceId: auth.workspaceId,
            }))
          );
        }

        finalAssigneeIds = assigneeIds;
      }

      const updateValues: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (data.title !== undefined) updateValues.title = data.title.trim();
      if (data.description !== undefined) updateValues.description = data.description;
      if (data.priority !== undefined) updateValues.priority = data.priority;
      if (data.dueDate !== undefined) {
        updateValues.dueDate = data.dueDate ? new Date(data.dueDate) : null;
      }
      if (data.estimatedHours !== undefined) {
        updateValues.estimatedHours = data.estimatedHours != null ? String(data.estimatedHours) : null;
      }

      const [updatedTask] = await tx
        .update(tasks)
        .set(updateValues)
        .where(
          and(
            eq(tasks.id, data.taskId),
            eq(tasks.workspaceId, auth.workspaceId)
          )
        )
        .returning();

      await publishDomainEvent(
        {
          workspaceId: auth.workspaceId,
          eventType: "task.updated",
          aggregateType: "task",
          aggregateId: updatedTask.id,
          actorId: auth.userId,
          payload: {
            taskId: updatedTask.id,
            projectId: updatedTask.projectId,
            title: updatedTask.title,
            priority: updatedTask.priority,
            status: updatedTask.status,
          },
        },
        tx
      );

      return {
        id: updatedTask.id,
        workspaceId: updatedTask.workspaceId,
        projectId: updatedTask.projectId,
        title: updatedTask.title,
        description: updatedTask.description,
        status: updatedTask.status,
        priority: updatedTask.priority,
        estimatedHours: updatedTask.estimatedHours ? Number(updatedTask.estimatedHours) : null,
        dueDate: updatedTask.dueDate ? updatedTask.dueDate.toISOString() : null,
        completedAt: updatedTask.completedAt ? updatedTask.completedAt.toISOString() : null,
        assigneeUserIds: finalAssigneeIds,
        updatedAt: updatedTask.updatedAt.toISOString(),
      };
    });
  });

/**
 * Server Function: deleteTaskFn
 * Soft deletes a task in the authorized workspace (sets deletedAt). Never physically deletes.
 */
export const deleteTaskFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => deleteTaskInputSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const [taskRow] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.id, data.taskId),
          eq(tasks.workspaceId, auth.workspaceId),
          isNull(tasks.deletedAt)
        )
      )
      .limit(1);

    if (!taskRow) {
      throw new Error("TASK_NOT_FOUND: Task not found or access denied.");
    }

    const now = new Date();
    await db
      .update(tasks)
      .set({
        deletedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(tasks.id, data.taskId),
          eq(tasks.workspaceId, auth.workspaceId)
        )
      );

    return {
      success: true,
      taskId: data.taskId,
    };
  });

/**
 * Server Function: getDashboardTasksFn
 * Retrieves active/pending tasks for the authorized workspace.
 */
export const getDashboardTasksFn = createServerFn({ method: "GET" })
  .validator((data?: unknown) => getDashboardTasksInputSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const auth = await requireWorkspaceAccess({ workspaceId: data?.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const taskRows = await db
      .select({
        task: tasks,
        project: {
          id: projects.id,
          name: projects.name,
        },
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          eq(tasks.workspaceId, auth.workspaceId),
          isNull(tasks.deletedAt)
        )
      )
      .orderBy(desc(tasks.createdAt));

    let todoCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;

    const formattedTasks = taskRows.map(({ task, project }) => {
      if (task.status === "completed" || task.status === "done") {
        completedCount++;
      } else if (task.status === "in_progress") {
        inProgressCount++;
      } else {
        todoCount++;
      }

      return {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        projectName: project?.name || "Workspace Task",
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      };
    });

    return {
      tasks: formattedTasks,
      stats: {
        totalCount: taskRows.length,
        todoCount,
        inProgressCount,
        completedCount,
      },
    };
  });

export const getTaskCommentsInputSchema = z.object({
  workspaceId: z.string().optional(),
  taskId: z.string().min(1, "Task ID is required"),
});

export interface TaskCommentItem {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

/**
 * Server Function: getTaskCommentsFn
 * Retrieves workspace and task-scoped comments timeline for a task.
 */
export const getTaskCommentsFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => getTaskCommentsInputSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{ taskId: string; comments: TaskCommentItem[] }> => {
      const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

      if (!db) {
        throw new Error("Database client is uninitialized.");
      }

      const { taskComments, users } = await import("@/db/schema");

      // Verify task belongs to authorized workspace
      const [taskRow] = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.id, data.taskId),
            eq(tasks.workspaceId, auth.workspaceId),
            isNull(tasks.deletedAt)
          )
        )
        .limit(1);

      if (!taskRow) {
        throw new Error("TASK_NOT_FOUND: Task not found or access denied.");
      }

      const commentRows = await db
        .select({
          comment: taskComments,
          author: {
            id: users.id,
            fullName: users.fullName,
            email: users.email,
          },
        })
        .from(taskComments)
        .leftJoin(users, eq(taskComments.authorId, users.id))
        .where(
          and(
            eq(taskComments.taskId, data.taskId),
            eq(taskComments.workspaceId, auth.workspaceId),
            isNull(taskComments.deletedAt)
          )
        )
        .orderBy(taskComments.createdAt);

      return {
        taskId: data.taskId,
        comments: commentRows.map(({ comment, author }) => ({
          id: comment.id,
          taskId: comment.taskId,
          authorId: comment.authorId,
          authorName: author?.fullName || author?.email || "Workspace User",
          content: comment.content,
          createdAt: comment.createdAt.toISOString(),
        })),
      };
    }
  );

export const createTaskCommentInputSchema = z.object({
  workspaceId: z.string().optional(),
  taskId: z.string().min(1, "Task ID is required"),
  content: z.string().min(1, "Comment content cannot be empty"),
});

/**
 * Server Function: createTaskCommentFn
 * Creates a new task comment in the authorized workspace associated with the authenticated user.
 */
export const createTaskCommentFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => createTaskCommentInputSchema.parse(data))
  .handler(async ({ data }): Promise<TaskCommentItem> => {
    const auth = await requireWorkspaceAccess({ workspaceId: data.workspaceId });

    if (!db) {
      throw new Error("Database client is uninitialized.");
    }

    const { taskComments, users } = await import("@/db/schema");
    const { publishDomainEvent } = await import("@/lib/events");

    return await db.transaction(async (tx) => {
      // Verify task belongs to authorized workspace
      const [taskRow] = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.id, data.taskId),
            eq(tasks.workspaceId, auth.workspaceId),
            isNull(tasks.deletedAt)
          )
        )
        .limit(1);

      if (!taskRow) {
        throw new Error("TASK_NOT_FOUND: Target task does not exist or access denied.");
      }

      const [createdComment] = await tx
        .insert(taskComments)
        .values({
          workspaceId: auth.workspaceId,
          taskId: data.taskId,
          authorId: auth.userId,
          content: data.content.trim(),
        })
        .returning();

      const [authorUser] = await tx
        .select({ fullName: users.fullName, email: users.email })
        .from(users)
        .where(eq(users.id, auth.userId))
        .limit(1);

      // Publish comment.created domain event
      await publishDomainEvent(
        {
          workspaceId: auth.workspaceId,
          eventType: "comment.created",
          aggregateType: "task_comment",
          aggregateId: createdComment.id,
          actorId: auth.userId,
          payload: {
            commentId: createdComment.id,
            taskId: createdComment.taskId,
            authorId: createdComment.authorId,
            contentSnippet: createdComment.content.slice(0, 150),
          },
        },
        tx
      );

      return {
        id: createdComment.id,
        taskId: createdComment.taskId,
        authorId: createdComment.authorId,
        authorName: authorUser?.fullName || authorUser?.email || "Workspace User",
        content: createdComment.content,
        createdAt: createdComment.createdAt.toISOString(),
      };
    });
  });

