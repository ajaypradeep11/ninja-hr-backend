// src/contexts/workplace/application/training.handlers.ts
// Training catalog + assignment CQRS handlers (grouped in one file — they're
// thin wrappers over the repository).
import { CommandHandler, ICommandHandler, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { WorkplaceRepository } from '../infrastructure/workplace.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type {
  AssignTrainingInput,
  CreateCourseInput,
  PeerCourseInput,
  TrainingAssignment,
  TrainingCourse,
  TrainingCourseCover,
  TrainingCourseMaterial,
  TrainingStatus,
} from '../domain/workplace.types';

/* -------------------------------- Catalog ------------------------------- */

export class CreateCourseCommand {
  constructor(public readonly input: CreateCourseInput) {}
}
@CommandHandler(CreateCourseCommand)
export class CreateCourseHandler implements ICommandHandler<CreateCourseCommand, TrainingCourse[]> {
  constructor(private readonly repo: WorkplaceRepository) {}
  execute({ input }: CreateCourseCommand) {
    return this.repo.createCourse(input);
  }
}

export class UpdateCourseCommand {
  constructor(
    public readonly id: string,
    public readonly input: Partial<CreateCourseInput> & { active?: boolean },
  ) {}
}
@CommandHandler(UpdateCourseCommand)
export class UpdateCourseHandler implements ICommandHandler<UpdateCourseCommand, TrainingCourse[]> {
  constructor(private readonly repo: WorkplaceRepository) {}
  execute({ id, input }: UpdateCourseCommand) {
    return this.repo.updateCourse(id, input);
  }
}

export class GetCourseCoverQuery {
  constructor(public readonly id: string) {}
}
@QueryHandler(GetCourseCoverQuery)
export class GetCourseCoverHandler implements IQueryHandler<GetCourseCoverQuery, TrainingCourseCover> {
  constructor(private readonly repo: WorkplaceRepository) {}
  execute({ id }: GetCourseCoverQuery) {
    return this.repo.getTrainingCourseCover(id);
  }
}

export class GetCourseMaterialQuery {
  constructor(public readonly id: string) {}
}
@QueryHandler(GetCourseMaterialQuery)
export class GetCourseMaterialHandler
  implements IQueryHandler<GetCourseMaterialQuery, TrainingCourseMaterial>
{
  constructor(private readonly repo: WorkplaceRepository) {}
  execute({ id }: GetCourseMaterialQuery) {
    return this.repo.getTrainingCourseMaterial(id);
  }
}

export class DeleteCourseCommand {
  constructor(public readonly id: string) {}
}
@CommandHandler(DeleteCourseCommand)
export class DeleteCourseHandler implements ICommandHandler<DeleteCourseCommand, TrainingCourse[]> {
  constructor(private readonly repo: WorkplaceRepository) {}
  execute({ id }: DeleteCourseCommand) {
    return this.repo.deleteCourse(id);
  }
}

/* ------------------------------ Assignments ----------------------------- */

export class AssignTrainingCommand {
  constructor(public readonly input: AssignTrainingInput) {}
}
@CommandHandler(AssignTrainingCommand)
export class AssignTrainingHandler
  implements ICommandHandler<AssignTrainingCommand, TrainingAssignment[]>
{
  constructor(private readonly repo: WorkplaceRepository) {}
  execute({ input }: AssignTrainingCommand) {
    return this.repo.assignTraining(input);
  }
}

export class GetAllAssignmentsQuery {}
@QueryHandler(GetAllAssignmentsQuery)
export class GetAllAssignmentsHandler
  implements IQueryHandler<GetAllAssignmentsQuery, TrainingAssignment[]>
{
  constructor(private readonly repo: WorkplaceRepository) {}
  execute() {
    return this.repo.getAllAssignments();
  }
}

export class GetCourseAssignmentsQuery {
  constructor(public readonly courseId: string) {}
}
@QueryHandler(GetCourseAssignmentsQuery)
export class GetCourseAssignmentsHandler
  implements IQueryHandler<GetCourseAssignmentsQuery, TrainingAssignment[]>
{
  constructor(private readonly repo: WorkplaceRepository) {}
  execute({ courseId }: GetCourseAssignmentsQuery) {
    return this.repo.getCourseAssignments(courseId);
  }
}

export class GetMyTrainingQuery {
  constructor(public readonly actor: ActorContext) {}
}
@QueryHandler(GetMyTrainingQuery)
export class GetMyTrainingHandler implements IQueryHandler<GetMyTrainingQuery, TrainingAssignment[]> {
  constructor(private readonly repo: WorkplaceRepository) {}
  execute({ actor }: GetMyTrainingQuery) {
    return this.repo.getMyTraining(actor);
  }
}

export class UpdateAssignmentCommand {
  constructor(
    public readonly id: string,
    public readonly input: { status?: TrainingStatus; progress?: number },
    public readonly actor: ActorContext,
  ) {}
}
@CommandHandler(UpdateAssignmentCommand)
export class UpdateAssignmentHandler
  implements ICommandHandler<UpdateAssignmentCommand, TrainingAssignment>
{
  constructor(private readonly repo: WorkplaceRepository) {}
  execute({ id, input, actor }: UpdateAssignmentCommand) {
    return this.repo.updateAssignment(id, input, actor);
  }
}

/* --------------------------- Peer-created courses ------------------------ */

export class GetMyCoursesQuery {
  constructor(public readonly actor: ActorContext) {}
}
@QueryHandler(GetMyCoursesQuery)
export class GetMyCoursesHandler implements IQueryHandler<GetMyCoursesQuery, TrainingCourse[]> {
  constructor(private readonly repo: WorkplaceRepository) {}
  execute({ actor }: GetMyCoursesQuery) {
    return this.repo.getMyCourses(actor);
  }
}

export class CreatePeerCourseCommand {
  constructor(public readonly input: PeerCourseInput, public readonly actor: ActorContext) {}
}
@CommandHandler(CreatePeerCourseCommand)
export class CreatePeerCourseHandler
  implements ICommandHandler<CreatePeerCourseCommand, TrainingCourse[]>
{
  constructor(private readonly repo: WorkplaceRepository) {}
  execute({ input, actor }: CreatePeerCourseCommand) {
    return this.repo.createPeerCourse(input, actor);
  }
}

export class UpdatePeerCourseCommand {
  constructor(
    public readonly id: string,
    public readonly input: Partial<PeerCourseInput> & { submit?: boolean },
    public readonly actor: ActorContext,
  ) {}
}
@CommandHandler(UpdatePeerCourseCommand)
export class UpdatePeerCourseHandler
  implements ICommandHandler<UpdatePeerCourseCommand, TrainingCourse[]>
{
  constructor(private readonly repo: WorkplaceRepository) {}
  execute({ id, input, actor }: UpdatePeerCourseCommand) {
    return this.repo.updatePeerCourse(id, input, actor);
  }
}

export class DeletePeerCourseCommand {
  constructor(public readonly id: string, public readonly actor: ActorContext) {}
}
@CommandHandler(DeletePeerCourseCommand)
export class DeletePeerCourseHandler
  implements ICommandHandler<DeletePeerCourseCommand, TrainingCourse[]>
{
  constructor(private readonly repo: WorkplaceRepository) {}
  execute({ id, actor }: DeletePeerCourseCommand) {
    return this.repo.deletePeerCourse(id, actor);
  }
}
