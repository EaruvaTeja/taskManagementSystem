from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Task
from ..schemas import TaskCreate, TaskPriority, TaskResponse, TaskStatus, TaskUpdate


router = APIRouter(
    prefix="/tasks",
    tags=["Tasks"],
)


def save_changes(db: Session) -> None:
    """Commit database changes and handle database errors."""
    try:
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="A database error occurred.",
        ) from exc


def get_task_or_404(db: Session, task_id: int) -> Task:
    """Return a task or raise a 404 error."""
    task = db.get(Task, task_id)

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found.",
        )

    return task


@router.post(
    "/",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new task",
    response_description="The newly created task.",
)
def create_task(
    task_data: TaskCreate,
    db: Session = Depends(get_db),
):
    """Create a new task. The title is required and cannot be empty."""
    data = task_data.model_dump()
    data["title"] = data["title"].strip()

    if not data["title"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Task title cannot be empty.",
        )

    task = Task(**data)
    db.add(task)
    save_changes(db)
    db.refresh(task)

    return task


@router.get(
    "/",
    response_model=list[TaskResponse],
    summary="List tasks",
    response_description="A list of tasks matching the supplied filters.",
)
def get_tasks(
    search: str | None = Query(default=None, max_length=200),
    task_status: TaskStatus | None = Query(default=None, alias="status"),
    priority: TaskPriority | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """List tasks, optionally filtering by title, status, and priority."""
    query = db.query(Task)

    if search and search.strip():
        query = query.filter(Task.title.ilike(f"%{search.strip()}%"))

    if task_status is not None:
        query = query.filter(Task.status == task_status)

    if priority is not None:
        query = query.filter(Task.priority == priority)

    return query.order_by(Task.id.desc()).all()


@router.get(
    "/{task_id}",
    response_model=TaskResponse,
    summary="Get a single task",
    response_description="The task with the requested ID.",
)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve one task by its ID."""
    return get_task_or_404(db, task_id)


@router.put(
    "/{task_id}",
    response_model=TaskResponse,
    summary="Replace a task",
    response_description="The updated task.",
)
def replace_task(
    task_id: int,
    task_data: TaskCreate,
    db: Session = Depends(get_db),
):
    """Replace a task's editable fields.

    All non-supplied fields fall back to `TaskCreate` defaults, so this
    operation performs a full replace of the editable columns.
    """
    task = get_task_or_404(db, task_id)

    data = task_data.model_dump()
    data["title"] = data["title"].strip()

    if not data["title"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Task title cannot be empty.",
        )

    for field, value in data.items():
        setattr(task, field, value)

    save_changes(db)
    db.refresh(task)

    return task


@router.patch(
    "/{task_id}",
    response_model=TaskResponse,
    summary="Update a task",
    response_description="The updated task.",
)
def update_task(
    task_id: int,
    task_data: TaskUpdate,
    db: Session = Depends(get_db),
):
    """Update only the fields supplied in the request."""
    changes = task_data.model_dump(exclude_unset=True)

    if not changes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one field to update.",
        )

    if "title" in changes:
        if changes["title"] is None or not changes["title"].strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Task title cannot be empty.",
            )

        changes["title"] = changes["title"].strip()

    # status and priority are non-nullable columns. Reject explicit nulls
    # with a 422 instead of letting the database raise an IntegrityError.
    for required_field in ("status", "priority"):
        if required_field in changes and changes[required_field] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Task {required_field} cannot be null.",
            )

    task = get_task_or_404(db, task_id)

    for field, value in changes.items():
        setattr(task, field, value)

    save_changes(db)
    db.refresh(task)

    return task


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a task",
    response_description="Empty response on successful deletion.",
)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
):
    """Delete a task permanently."""
    task = get_task_or_404(db, task_id)

    db.delete(task)
    save_changes(db)

    return Response(status_code=status.HTTP_204_NO_CONTENT)